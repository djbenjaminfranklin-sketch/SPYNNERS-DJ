import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import { useAuth } from '../../src/contexts/AuthContext';
import Constants from 'expo-constants';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_SIZE = Math.min(SCREEN_WIDTH * 0.28, 110);
const GLOW_SIZE = BUTTON_SIZE + 20;

// Colors
const SPYN_COLOR = '#E53935'; // Red
const RECORD_COLOR = '#EC407A'; // Pink
const SUCCESS_COLOR = '#4CAF50';

// Recognition interval during DJ Set (every 30 seconds)
const RECOGNITION_INTERVAL = 30000;

interface RecognizedTrack {
  id: string;
  title: string;
  artist: string;
  timestamp: number;
  confidence?: number;
}

export default function SpynScreen() {
  // States
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [djRecording, setDjRecording] = useState<Audio.Recording | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [djSetDuration, setDjSetDuration] = useState(0);
  const [recognizedTracks, setRecognizedTracks] = useState<RecognizedTrack[]>([]);
  const [isAudioInputConnected, setIsAudioInputConnected] = useState(false);
  const [lastRecognitionTime, setLastRecognitionTime] = useState(0);
  
  const { token } = useAuth();
  const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL;
  
  // Refs
  const djIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tempRecordingRef = useRef<Audio.Recording | null>(null);

  // Animations
  const glowAnim1 = useRef(new Animated.Value(0)).current;
  const glowAnim2 = useRef(new Animated.Value(0)).current;
  const scaleAnim1 = useRef(new Animated.Value(1)).current;
  const scaleAnim2 = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start glow animations
    const glowLoop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim1, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(glowAnim1, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ])
    );
    
    const glowLoop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim2, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(glowAnim2, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ])
    );

    const scaleLoop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim1, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
        Animated.timing(scaleAnim1, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );

    const scaleLoop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim2, { toValue: 1.05, duration: 1400, useNativeDriver: true }),
        Animated.timing(scaleAnim2, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    );

    glowLoop1.start();
    setTimeout(() => glowLoop2.start(), 750);
    scaleLoop1.start();
    setTimeout(() => scaleLoop2.start(), 600);

    // Check for audio input
    checkAudioInput();

    return () => {
      glowLoop1.stop();
      glowLoop2.stop();
      scaleLoop1.stop();
      scaleLoop2.stop();
      if (djIntervalRef.current) clearInterval(djIntervalRef.current);
      if (recognitionIntervalRef.current) clearInterval(recognitionIntervalRef.current);
    };
  }, []);

  // Check if external audio input is connected (mixer cable)
  const checkAudioInput = async () => {
    try {
      // Request audio permissions first
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;

      // On iOS/Android, we can detect audio route changes
      // This is a simplified check - on real device would use native modules
      const audioMode = await Audio.getPermissionsAsync();
      
      // For now, we'll show the option and let user confirm
      // In production, use expo-av's audio session to detect input sources
      setIsAudioInputConnected(false);
    } catch (error) {
      console.log('Audio input check error:', error);
    }
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  // ==================== SPYN - Single Track Recognition ====================
  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Requise', 'Accès au microphone nécessaire pour identifier les tracks');
        return;
      }

      await Audio.setAudioModeAsync({ 
        allowsRecordingIOS: true, 
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
      
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      startPulse();

      // Auto-stop after 10 seconds
      setTimeout(() => stopRecording(), 10000);
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      stopPulse();
      const uri = recording.getURI();
      setRecording(null);
      if (uri) await recognizeAudio(uri);
    } catch (error) {
      console.error('Stop recording error:', error);
    }
  };

  const recognizeAudio = async (audioUri: string) => {
    setRecognizing(true);
    setResult(null);

    try {
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await axios.post(
        `${BACKEND_URL}/api/recognize-audio`,
        { audio_base64: audioBase64 },
        { 
          headers: { 
            'Content-Type': 'application/json', 
            Authorization: `Bearer ${token}` 
          },
          timeout: 30000,
        }
      );

      if (response.data.success) {
        setResult(response.data);
      } else {
        Alert.alert('Non Reconnu', 'Impossible d\'identifier cette track. Essayez avec un extrait plus clair.');
      }
    } catch (error: any) {
      console.error('Recognition error:', error);
      Alert.alert('Erreur', 'La reconnaissance a échoué. Vérifiez votre connexion.');
    } finally {
      setRecognizing(false);
    }
  };

  // ==================== DJ SET Recording with Auto-Recognition ====================
  const startDjSet = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Requise', 'Accès au microphone nécessaire');
        return;
      }

      await Audio.setAudioModeAsync({ 
        allowsRecordingIOS: true, 
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
      
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setDjRecording(newRecording);
      setDjSetDuration(0);
      setRecognizedTracks([]);
      setLastRecognitionTime(0);
      
      // Timer for duration display
      djIntervalRef.current = setInterval(() => {
        setDjSetDuration(prev => prev + 1);
      }, 1000);

      // Start automatic track recognition every 30 seconds
      recognitionIntervalRef.current = setInterval(() => {
        recognizeCurrentTrack();
      }, RECOGNITION_INTERVAL);

      // First recognition after 5 seconds
      setTimeout(() => recognizeCurrentTrack(), 5000);

      Alert.alert(
        '🎧 DJ Set Démarré',
        'Enregistrement en cours...\nLes tracks seront identifiées automatiquement toutes les 30 secondes.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('DJ Set error:', error);
      Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement');
    }
  };

  // Recognize current playing track during DJ Set
  const recognizeCurrentTrack = async () => {
    if (!djRecording) return;
    
    try {
      // Create a temporary short recording for recognition
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;

      // We need to capture a 10-second snippet
      // Since we can't pause the main recording, we'll use the recognition timestamp
      const currentTime = djSetDuration;
      
      // Avoid duplicate recognitions within 25 seconds
      if (currentTime - lastRecognitionTime < 25) return;
      setLastRecognitionTime(currentTime);

      // For the demo, we'll show that recognition is happening
      // In production, this would sample the audio input
      console.log(`[DJ Set] Attempting track recognition at ${formatDuration(currentTime)}`);
      
      // Create temp recording for recognition (10 seconds)
      await Audio.setAudioModeAsync({ 
        allowsRecordingIOS: true, 
        playsInSilentModeIOS: true 
      });
      
      const { recording: tempRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      tempRecordingRef.current = tempRecording;

      // Record for 10 seconds
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      if (tempRecordingRef.current) {
        await tempRecordingRef.current.stopAndUnloadAsync();
        const uri = tempRecordingRef.current.getURI();
        tempRecordingRef.current = null;

        if (uri) {
          const audioBase64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const response = await axios.post(
            `${BACKEND_URL}/api/recognize-audio`,
            { audio_base64: audioBase64 },
            { 
              headers: { 
                'Content-Type': 'application/json', 
                Authorization: `Bearer ${token}` 
              },
              timeout: 30000,
            }
          );

          if (response.data.success && response.data.title) {
            const newTrack: RecognizedTrack = {
              id: Date.now().toString(),
              title: response.data.title,
              artist: response.data.artist || 'Unknown',
              timestamp: currentTime,
              confidence: response.data.score,
            };

            // Avoid duplicate tracks
            setRecognizedTracks(prev => {
              const isDuplicate = prev.some(t => 
                t.title.toLowerCase() === newTrack.title.toLowerCase() &&
                t.artist.toLowerCase() === newTrack.artist.toLowerCase()
              );
              if (isDuplicate) return prev;
              return [...prev, newTrack];
            });
          }
        }
      }
    } catch (error) {
      console.log('Auto-recognition error:', error);
    }
  };

  const stopDjSet = async () => {
    if (!djRecording) return;
    
    try {
      // Stop intervals
      if (djIntervalRef.current) {
        clearInterval(djIntervalRef.current);
        djIntervalRef.current = null;
      }
      if (recognitionIntervalRef.current) {
        clearInterval(recognitionIntervalRef.current);
        recognitionIntervalRef.current = null;
      }
      if (tempRecordingRef.current) {
        try {
          await tempRecordingRef.current.stopAndUnloadAsync();
        } catch {}
        tempRecordingRef.current = null;
      }

      await djRecording.stopAndUnloadAsync();
      const uri = djRecording.getURI();
      const finalDuration = djSetDuration;
      const tracks = [...recognizedTracks];
      setDjRecording(null);

      if (uri) {
        const trackListText = tracks.length > 0
          ? `\n\nTracks identifiées (${tracks.length}):\n${tracks.map((t, i) => 
              `${i + 1}. ${t.title} - ${t.artist} (${formatDuration(t.timestamp)})`
            ).join('\n')}`
          : '\n\nAucune track identifiée automatiquement.';

        Alert.alert(
          '🎵 DJ Set Terminé',
          `Durée: ${formatDuration(finalDuration)}${trackListText}`,
          [
            { 
              text: 'Supprimer', 
              style: 'destructive', 
              onPress: () => {
                setDjSetDuration(0);
                setRecognizedTracks([]);
              }
            },
            { 
              text: 'Sauvegarder', 
              onPress: async () => {
                const fileName = `dj_set_${Date.now()}.m4a`;
                const destPath = `${FileSystem.documentDirectory}${fileName}`;
                await FileSystem.moveAsync({ from: uri, to: destPath });
                
                // Save tracklist
                const tracklistPath = `${FileSystem.documentDirectory}dj_set_${Date.now()}_tracklist.json`;
                await FileSystem.writeAsStringAsync(tracklistPath, JSON.stringify({
                  duration: finalDuration,
                  tracks: tracks,
                  date: new Date().toISOString(),
                }));
                
                Alert.alert('✅ Sauvegardé!', `DJ Set et tracklist sauvegardés`);
                setDjSetDuration(0);
                setRecognizedTracks([]);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Stop DJ set error:', error);
    }
  };

  // Toggle external audio input mode (for mixer)
  const toggleAudioInput = () => {
    Alert.alert(
      '🎛️ Entrée Audio Externe',
      isAudioInputConnected 
        ? 'Déconnecter l\'entrée de la table de mixage?'
        : 'Pour enregistrer depuis votre table de mixage:\n\n1. Connectez un câble audio de la sortie REC/BOOTH de votre table vers l\'entrée de votre téléphone\n2. Utilisez un adaptateur si nécessaire\n3. L\'app capturera le signal audio direct',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: isAudioInputConnected ? 'Déconnecter' : 'J\'ai connecté le câble',
          onPress: () => setIsAudioInputConnected(!isAudioInputConnected)
        }
      ]
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Animation values
  const glowOpacity1 = glowAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });
  const glowOpacity2 = glowAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });
  const glowScale1 = glowAnim1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const glowScale2 = glowAnim2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

  // ==================== RENDER ====================
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SPYN</Text>
        <Text style={styles.headerSubtitle}>Reconnaissance Audio & Enregistrement DJ</Text>
        
        {/* Audio Input Toggle */}
        <TouchableOpacity 
          style={[styles.audioInputButton, isAudioInputConnected && styles.audioInputConnected]}
          onPress={toggleAudioInput}
        >
          <Ionicons 
            name={isAudioInputConnected ? "radio" : "radio-outline"} 
            size={18} 
            color={isAudioInputConnected ? SUCCESS_COLOR : Colors.textMuted} 
          />
          <Text style={[
            styles.audioInputText,
            isAudioInputConnected && styles.audioInputTextConnected
          ]}>
            {isAudioInputConnected ? 'Mixeur Connecté' : 'Entrée Audio'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Recognition in progress */}
        {recognizing ? (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.statusText}>Analyse ACRCloud...</Text>
            <Text style={styles.statusSubtext}>Identification de la track en cours</Text>
          </View>
        ) : result ? (
          /* Recognition Result */
          <View style={styles.resultContainer}>
            <Ionicons name="checkmark-circle" size={60} color={SUCCESS_COLOR} />
            <Text style={styles.resultTitle}>Track Identifiée!</Text>
            <View style={styles.resultInfo}>
              <Text style={styles.resultLabel}>Titre</Text>
              <Text style={styles.resultValue}>{result.title || 'Unknown'}</Text>
              <Text style={styles.resultLabel}>Artiste</Text>
              <Text style={styles.resultValue}>{result.artist || 'Unknown'}</Text>
              {result.album && (
                <>
                  <Text style={styles.resultLabel}>Album</Text>
                  <Text style={styles.resultValue}>{result.album}</Text>
                </>
              )}
              {result.score && (
                <Text style={styles.confidenceText}>Confiance: {result.score}%</Text>
              )}
            </View>
            <TouchableOpacity style={styles.resetButton} onPress={() => setResult(null)}>
              <Text style={styles.resetButtonText}>Nouvelle Recherche</Text>
            </TouchableOpacity>
          </View>
        ) : recording ? (
          /* Single Track Recording */
          <View style={styles.recordingStatus}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={styles.recordingIndicator}>
                <Ionicons name="radio" size={60} color={SPYN_COLOR} />
              </View>
            </Animated.View>
            <Text style={styles.statusText}>Écoute en cours... (10s)</Text>
            <Text style={styles.statusSubtext}>Approchez le téléphone de la source audio</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={stopRecording}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        ) : djRecording ? (
          /* DJ Set Recording */
          <View style={styles.djSetContainer}>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingLabel}>REC</Text>
            </View>
            
            <Text style={styles.djSetTimer}>{formatDuration(djSetDuration)}</Text>
            
            {/* Recognized Tracks List */}
            {recognizedTracks.length > 0 && (
              <View style={styles.tracklistContainer}>
                <Text style={styles.tracklistTitle}>
                  Tracks Identifiées ({recognizedTracks.length})
                </Text>
                {recognizedTracks.slice(-5).map((track, index) => (
                  <View key={track.id} style={styles.tracklistItem}>
                    <Text style={styles.tracklistTime}>{formatDuration(track.timestamp)}</Text>
                    <View style={styles.tracklistInfo}>
                      <Text style={styles.tracklistTrackTitle} numberOfLines={1}>
                        {track.title}
                      </Text>
                      <Text style={styles.tracklistArtist} numberOfLines={1}>
                        {track.artist}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            
            <TouchableOpacity style={styles.stopButton} onPress={stopDjSet}>
              <Ionicons name="stop" size={32} color="#fff" />
              <Text style={styles.stopButtonText}>Arrêter</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Main Buttons */
          <View style={styles.buttonsContainer}>
            {/* SPYN Button - Single Recognition */}
            <View style={styles.buttonWrapper}>
              <Animated.View 
                style={[
                  styles.glowRing, 
                  styles.glowRingPrimary, 
                  { opacity: glowOpacity1, transform: [{ scale: glowScale1 }] }
                ]}
              />
              <Animated.View style={{ transform: [{ scale: scaleAnim1 }] }}>
                <TouchableOpacity 
                  style={[styles.roundButton, styles.roundButtonPrimary]} 
                  onPress={startRecording} 
                  activeOpacity={0.8}
                >
                  <Ionicons name="radio" size={40} color="#fff" />
                  <Text style={styles.roundButtonText}>SPYN</Text>
                </TouchableOpacity>
              </Animated.View>
              <Text style={styles.buttonLabel}>Identifier une Track</Text>
            </View>

            {/* Record Set Button */}
            <View style={styles.buttonWrapper}>
              <Animated.View 
                style={[
                  styles.glowRing, 
                  styles.glowRingSecondary, 
                  { opacity: glowOpacity2, transform: [{ scale: glowScale2 }] }
                ]}
              />
              <Animated.View style={{ transform: [{ scale: scaleAnim2 }] }}>
                <TouchableOpacity 
                  style={[styles.roundButton, styles.roundButtonSecondary]} 
                  onPress={startDjSet} 
                  activeOpacity={0.8}
                >
                  <Ionicons name="mic" size={40} color="#fff" />
                  <Text style={styles.roundButtonText}>Record</Text>
                </TouchableOpacity>
              </Animated.View>
              <Text style={styles.buttonLabel}>Enregistrer DJ Set</Text>
            </View>
          </View>
        )}

        {/* Info Section */}
        {!recording && !djRecording && !recognizing && !result && (
          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <Ionicons name="musical-notes" size={24} color={SPYN_COLOR} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>SPYN</Text>
                <Text style={styles.infoText}>
                  Identifie instantanément une track avec ACRCloud
                </Text>
              </View>
            </View>
            
            <View style={styles.infoCard}>
              <Ionicons name="disc" size={24} color={RECORD_COLOR} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Record Set</Text>
                <Text style={styles.infoText}>
                  Enregistre votre DJ set avec identification automatique des tracks toutes les 30s
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="hardware-chip" size={24} color={Colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Entrée Mixeur</Text>
                <Text style={styles.infoText}>
                  Connectez votre table de mixage pour une meilleure qualité d'enregistrement
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    padding: Spacing.lg,
    paddingTop: 60,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderAccent,
  },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: Colors.primary },
  headerSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  audioInputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundInput,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
    gap: 6,
  },
  audioInputConnected: {
    backgroundColor: '#4CAF5020',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  audioInputText: { fontSize: 12, color: Colors.textMuted },
  audioInputTextConnected: { color: '#4CAF50', fontWeight: '600' },
  content: { flex: 1 },
  contentContainer: { padding: Spacing.lg, alignItems: 'center' },
  buttonsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-evenly', 
    width: '100%', 
    gap: Spacing.xl,
    marginTop: Spacing.xl,
  },
  buttonWrapper: { alignItems: 'center', position: 'relative' },
  glowRing: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  glowRingPrimary: { 
    borderColor: SPYN_COLOR, 
    shadowColor: SPYN_COLOR, 
    shadowOffset: { width: 0, height: 0 }, 
    shadowOpacity: 0.8, 
    shadowRadius: 15 
  },
  glowRingSecondary: { 
    borderColor: RECORD_COLOR, 
    shadowColor: RECORD_COLOR, 
    shadowOffset: { width: 0, height: 0 }, 
    shadowOpacity: 0.8, 
    shadowRadius: 15 
  },
  roundButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  roundButtonPrimary: { backgroundColor: SPYN_COLOR },
  roundButtonSecondary: { backgroundColor: RECORD_COLOR },
  roundButtonText: { fontSize: 11, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  buttonLabel: { marginTop: 16, fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  statusContainer: { alignItems: 'center', gap: 16, marginTop: 60 },
  statusText: { fontSize: 18, color: Colors.primary, fontWeight: '600' },
  statusSubtext: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  recordingStatus: { alignItems: 'center', gap: Spacing.md, marginTop: 40 },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#ff4444' },
  recordingLabel: { fontSize: 18, fontWeight: 'bold', color: '#ff4444' },
  djSetContainer: { alignItems: 'center', gap: Spacing.md, width: '100%', marginTop: 20 },
  djSetTimer: { 
    fontSize: 64, 
    fontWeight: 'bold', 
    color: Colors.primary, 
    fontVariant: ['tabular-nums'] 
  },
  tracklistContainer: {
    width: '100%',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  tracklistTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  tracklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  tracklistTime: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    width: 45,
  },
  tracklistInfo: { flex: 1 },
  tracklistTrackTitle: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  tracklistArtist: { fontSize: 11, color: Colors.textMuted },
  stopButton: {
    backgroundColor: '#ff4444',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  stopButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  cancelButton: {
    backgroundColor: Colors.backgroundInput,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  cancelButtonText: { color: Colors.textSecondary, fontSize: 14 },
  resultContainer: { alignItems: 'center', width: '100%', marginTop: 40 },
  resultTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginTop: 16, marginBottom: 24 },
  resultInfo: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    width: '100%',
    gap: 8,
  },
  resultLabel: { fontSize: 12, color: Colors.textMuted },
  resultValue: { fontSize: 18, color: Colors.text, fontWeight: '600', marginBottom: 8 },
  confidenceText: { fontSize: 12, color: SUCCESS_COLOR, marginTop: 8 },
  resetButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: 24,
    paddingHorizontal: Spacing.xl,
  },
  resetButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  infoSection: { 
    width: '100%', 
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  infoText: { fontSize: 12, color: Colors.textMuted, lineHeight: 18 },
});
