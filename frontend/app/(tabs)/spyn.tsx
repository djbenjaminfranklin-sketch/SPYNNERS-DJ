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
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_SIZE = Math.min(SCREEN_WIDTH * 0.38, 150);

// Colors matching spynners.com
const DETECTION_GRADIENT = ['#FF6B6B', '#EE5A5A', '#E53935'];
const RECORD_GRADIENT = ['#EC407A', '#D81B60', '#AD1457'];
const CYAN_COLOR = '#5CB3CC';
const DARK_BG = '#0a0a0a';

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
  const [isUsbConnected, setIsUsbConnected] = useState(false);
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
        Animated.timing(glowAnim1, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(glowAnim1, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    );
    
    const glowLoop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim2, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(glowAnim2, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    );

    const scaleLoop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim1, { toValue: 1.03, duration: 1500, useNativeDriver: true }),
        Animated.timing(scaleAnim1, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );

    const scaleLoop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim2, { toValue: 1.03, duration: 1700, useNativeDriver: true }),
        Animated.timing(scaleAnim2, { toValue: 1, duration: 1700, useNativeDriver: true }),
      ])
    );

    glowLoop1.start();
    setTimeout(() => glowLoop2.start(), 1000);
    scaleLoop1.start();
    setTimeout(() => scaleLoop2.start(), 850);

    return () => {
      glowLoop1.stop();
      glowLoop2.stop();
      scaleLoop1.stop();
      scaleLoop2.stop();
      if (djIntervalRef.current) clearInterval(djIntervalRef.current);
      if (recognitionIntervalRef.current) clearInterval(recognitionIntervalRef.current);
    };
  }, []);

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

  // ==================== SPYN DETECTION - Single Track Recognition ====================
  const startDetection = async () => {
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
      setTimeout(() => stopDetection(), 10000);
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement');
    }
  };

  const stopDetection = async () => {
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

  // ==================== SPYN RECORD SET - DJ Set Recording with Auto-Recognition ====================
  const startRecordSet = async () => {
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
        '🎧 SPYN Record Set',
        isUsbConnected 
          ? 'Enregistrement USB démarré...\nLes tracks seront identifiées automatiquement.'
          : 'Enregistrement Micro démarré...\nConnectez un câble USB pour une meilleure qualité.',
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
      const currentTime = djSetDuration;
      
      // Avoid duplicate recognitions within 25 seconds
      if (currentTime - lastRecognitionTime < 25) return;
      setLastRecognitionTime(currentTime);

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

  const stopRecordSet = async () => {
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

  // Toggle USB/Mixer connection
  const toggleUsbConnection = () => {
    Alert.alert(
      '🔌 Connexion USB / Table de Mixage',
      isUsbConnected 
        ? 'Déconnecter l\'entrée USB?'
        : 'Pour enregistrer depuis votre table de mixage:\n\n1. Connectez un câble USB ou audio de la sortie REC/BOOTH\n2. Utilisez un adaptateur Lightning/USB-C si nécessaire\n3. L\'app capturera le signal audio direct\n\nMeilleure qualité qu\'avec le micro!',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: isUsbConnected ? 'Déconnecter' : 'Câble connecté',
          onPress: () => setIsUsbConnected(!isUsbConnected)
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
  const glowOpacity1 = glowAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const glowOpacity2 = glowAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  // ==================== RENDER ====================
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* Main SPYN Buttons Section */}
        {!recording && !djRecording && !recognizing && !result && (
          <View style={styles.spynButtonsSection}>
            {/* SPYN DETECTION Button */}
            <View style={styles.spynButtonWrapper}>
              <Animated.View 
                style={[
                  styles.glowRing, 
                  { 
                    opacity: glowOpacity1,
                    borderColor: '#FF6B6B',
                    shadowColor: '#FF6B6B',
                  }
                ]}
              />
              <Animated.View style={{ transform: [{ scale: scaleAnim1 }] }}>
                <TouchableOpacity 
                  onPress={startDetection} 
                  activeOpacity={0.85}
                  style={styles.spynButtonTouchable}
                >
                  <LinearGradient
                    colors={DETECTION_GRADIENT}
                    style={styles.spynButton}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                  >
                    <Text style={styles.spynText}>SPYN</Text>
                    <Text style={styles.spynSubtext}>DETECTION</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
              <Text style={styles.spynLabel}>Micro</Text>
            </View>

            {/* SPYN RECORD SET Button */}
            <View style={styles.spynButtonWrapper}>
              <Animated.View 
                style={[
                  styles.glowRing, 
                  { 
                    opacity: glowOpacity2,
                    borderColor: '#EC407A',
                    shadowColor: '#EC407A',
                  }
                ]}
              />
              <Animated.View style={{ transform: [{ scale: scaleAnim2 }] }}>
                <TouchableOpacity 
                  onPress={startRecordSet} 
                  activeOpacity={0.85}
                  style={styles.spynButtonTouchable}
                >
                  <LinearGradient
                    colors={RECORD_GRADIENT}
                    style={styles.spynButton}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                  >
                    <Text style={styles.spynText}>SPYN</Text>
                    <Text style={styles.spynSubtext}>RECORD SET</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
              <TouchableOpacity onPress={toggleUsbConnection}>
                <Text style={[styles.spynLabel, isUsbConnected && styles.spynLabelActive]}>
                  {isUsbConnected ? '🔌 USB Connecté' : 'USB + Rec'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recognition in progress */}
        {recognizing && (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color={CYAN_COLOR} />
            <Text style={styles.statusText}>Analyse ACRCloud...</Text>
            <Text style={styles.statusSubtext}>Identification de la track en cours</Text>
          </View>
        )}

        {/* Single track recording in progress */}
        {recording && (
          <View style={styles.recordingStatus}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <LinearGradient
                colors={DETECTION_GRADIENT}
                style={styles.recordingCircle}
              >
                <Ionicons name="mic" size={50} color="#fff" />
              </LinearGradient>
            </Animated.View>
            <Text style={styles.statusText}>Écoute en cours... (10s)</Text>
            <Text style={styles.statusSubtext}>Approchez le téléphone de la source audio</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={stopDetection}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* DJ Set Recording in progress */}
        {djRecording && (
          <View style={styles.djSetContainer}>
            <View style={styles.recordingHeader}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingLabel}>REC</Text>
              {isUsbConnected && (
                <View style={styles.usbBadge}>
                  <Text style={styles.usbBadgeText}>USB</Text>
                </View>
              )}
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
            
            <TouchableOpacity style={styles.stopButton} onPress={stopRecordSet}>
              <Ionicons name="stop" size={28} color="#fff" />
              <Text style={styles.stopButtonText}>Arrêter l'enregistrement</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recognition Result */}
        {result && (
          <View style={styles.resultContainer}>
            <View style={styles.resultIconContainer}>
              <Ionicons name="checkmark-circle" size={70} color="#4CAF50" />
            </View>
            <Text style={styles.resultTitle}>Track Identifiée!</Text>
            <View style={styles.resultCard}>
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
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: DARK_BG,
  },
  scrollView: { 
    flex: 1,
  },
  scrollContent: { 
    padding: Spacing.lg, 
    paddingTop: 80,
    alignItems: 'center',
    minHeight: '100%',
  },
  
  // SPYN Buttons Section
  spynButtonsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: Spacing.xl,
    paddingHorizontal: 10,
  },
  spynButtonWrapper: {
    alignItems: 'center',
    position: 'relative',
  },
  glowRing: {
    position: 'absolute',
    width: BUTTON_SIZE + 20,
    height: BUTTON_SIZE + 20,
    borderRadius: (BUTTON_SIZE + 20) / 2,
    borderWidth: 2,
    top: -10,
    left: -10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  spynButtonTouchable: {
    borderRadius: BUTTON_SIZE / 2,
    overflow: 'hidden',
  },
  spynButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spynText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
  },
  spynSubtext: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1,
    marginTop: 4,
  },
  spynLabel: {
    marginTop: 16,
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  spynLabelActive: {
    color: '#4CAF50',
  },
  
  // Status & Recording
  statusContainer: { 
    alignItems: 'center', 
    gap: 16, 
    marginTop: 40,
  },
  statusText: { 
    fontSize: 20, 
    color: CYAN_COLOR, 
    fontWeight: '600',
  },
  statusSubtext: { 
    fontSize: 14, 
    color: Colors.textMuted, 
    textAlign: 'center',
  },
  recordingStatus: { 
    alignItems: 'center', 
    gap: Spacing.md, 
    marginTop: 40,
  },
  recordingCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.backgroundCard,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: CYAN_COLOR,
  },
  cancelButtonText: { 
    color: CYAN_COLOR, 
    fontSize: 14,
    fontWeight: '500',
  },
  
  // DJ Set Recording
  djSetContainer: { 
    alignItems: 'center', 
    gap: Spacing.md, 
    width: '100%', 
    marginTop: 20,
  },
  recordingHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
  },
  recordingDot: { 
    width: 14, 
    height: 14, 
    borderRadius: 7, 
    backgroundColor: '#ff4444',
  },
  recordingLabel: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#ff4444',
  },
  usbBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  usbBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  djSetTimer: { 
    fontSize: 72, 
    fontWeight: 'bold', 
    color: CYAN_COLOR, 
    fontVariant: ['tabular-nums'],
  },
  tracklistContainer: {
    width: '100%',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: CYAN_COLOR + '40',
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
    color: CYAN_COLOR,
    fontWeight: '600',
    width: 45,
  },
  tracklistInfo: { flex: 1 },
  tracklistTrackTitle: { 
    fontSize: 14, 
    color: Colors.text, 
    fontWeight: '500',
  },
  tracklistArtist: { 
    fontSize: 12, 
    color: Colors.textMuted,
  },
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
  stopButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600',
  },
  
  // Result
  resultContainer: { 
    alignItems: 'center', 
    width: '100%', 
    marginTop: 20,
  },
  resultIconContainer: {
    marginBottom: 16,
  },
  resultTitle: { 
    fontSize: 26, 
    fontWeight: 'bold', 
    color: Colors.text, 
    marginBottom: 24,
  },
  resultCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    width: '100%',
    gap: 6,
    borderWidth: 1,
    borderColor: CYAN_COLOR + '40',
  },
  resultLabel: { 
    fontSize: 12, 
    color: Colors.textMuted,
    marginTop: 8,
  },
  resultValue: { 
    fontSize: 18, 
    color: Colors.text, 
    fontWeight: '600',
  },
  confidenceText: { 
    fontSize: 13, 
    color: '#4CAF50', 
    marginTop: 12,
  },
  resetButton: {
    backgroundColor: CYAN_COLOR,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: 24,
    paddingHorizontal: Spacing.xl,
  },
  resetButtonText: { 
    color: '#000', 
    fontSize: 16, 
    fontWeight: '600',
  },
});
