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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import { useAuth } from '../../src/contexts/AuthContext';
import Constants from 'expo-constants';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_SIZE = Math.min(SCREEN_WIDTH * 0.32, 130);
const GLOW_SIZE = BUTTON_SIZE + 20;

// Colors matching home page
const SPYN_COLOR = '#E53935'; // Red
const RECORD_COLOR = '#EC407A'; // Pink

export default function SpynScreen() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [djRecording, setDjRecording] = useState<Audio.Recording | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [djSetDuration, setDjSetDuration] = useState(0);
  const { token } = useAuth();
  const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL;
  const djIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Animations
  const glowAnim1 = useRef(new Animated.Value(0)).current;
  const glowAnim2 = useRef(new Animated.Value(0)).current;
  const scaleAnim1 = useRef(new Animated.Value(1)).current;
  const scaleAnim2 = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
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

    return () => {
      glowLoop1.stop();
      glowLoop2.stop();
      scaleLoop1.stop();
      scaleLoop2.stop();
      if (djIntervalRef.current) clearInterval(djIntervalRef.current);
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

  // Music Recognition
  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone access needed');
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      startPulse();

      setTimeout(() => stopRecording(), 10000);
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert('Error', 'Could not start recording');
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
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
      );

      setResult(response.data);
    } catch (error: any) {
      Alert.alert('Recognition Failed', 'Could not recognize the audio');
    } finally {
      setRecognizing(false);
    }
  };

  // DJ Set Recording
  const startDjSet = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone access needed');
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setDjRecording(newRecording);
      setDjSetDuration(0);
      djIntervalRef.current = setInterval(() => setDjSetDuration(prev => prev + 1), 1000);
    } catch (error) {
      console.error('DJ Set error:', error);
      Alert.alert('Error', 'Could not start recording');
    }
  };

  const stopDjSet = async () => {
    if (!djRecording) return;
    try {
      if (djIntervalRef.current) {
        clearInterval(djIntervalRef.current);
        djIntervalRef.current = null;
      }

      await djRecording.stopAndUnloadAsync();
      const uri = djRecording.getURI();
      const finalDuration = djSetDuration;
      setDjRecording(null);

      if (uri) {
        Alert.alert(
          'Sauvegarder?',
          `Durée: ${formatDuration(finalDuration)}`,
          [
            { text: 'Supprimer', style: 'destructive', onPress: () => setDjSetDuration(0) },
            { text: 'Sauvegarder', onPress: async () => {
                const fileName = `dj_set_${Date.now()}.m4a`;
                const destPath = `${FileSystem.documentDirectory}${fileName}`;
                await FileSystem.moveAsync({ from: uri, to: destPath });
                Alert.alert('Sauvegardé!', `DJ Set: ${fileName}`);
                setDjSetDuration(0);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Stop DJ set error:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const glowOpacity1 = glowAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });
  const glowOpacity2 = glowAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });
  const glowScale1 = glowAnim1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const glowScale2 = glowAnim2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SPYN</Text>
        <Text style={styles.headerSubtitle}>Music Recognition & DJ Recording</Text>
      </View>

      <View style={styles.content}>
        {recognizing ? (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.statusText}>Recognizing...</Text>
          </View>
        ) : result ? (
          <View style={styles.resultContainer}>
            <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
            <Text style={styles.resultTitle}>Track Found!</Text>
            <View style={styles.resultInfo}>
              <Text style={styles.resultLabel}>Title</Text>
              <Text style={styles.resultValue}>{result.title || 'Unknown'}</Text>
              <Text style={styles.resultLabel}>Artist</Text>
              <Text style={styles.resultValue}>{result.artist || 'Unknown'}</Text>
            </View>
            <TouchableOpacity style={styles.resetButton} onPress={() => setResult(null)}>
              <Text style={styles.resetButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : recording || djRecording ? (
          <View style={styles.recordingStatus}>
            {recording ? (
              <>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <View style={styles.recordingIndicator}>
                    <Ionicons name="radio" size={60} color={SPYN_COLOR} />
                  </View>
                </Animated.View>
                <Text style={styles.statusText}>Listening... (10s)</Text>
                <TouchableOpacity style={styles.cancelButton} onPress={stopRecording}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingLabel}>REC</Text>
                </View>
                <Text style={styles.djSetTimer}>{formatDuration(djSetDuration)}</Text>
                <TouchableOpacity style={styles.stopButton} onPress={stopDjSet}>
                  <Ionicons name="stop" size={32} color="#fff" />
                  <Text style={styles.stopButtonText}>Stop</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <View style={styles.buttonsContainer}>
            {/* SPYN Button */}
            <View style={styles.buttonWrapper}>
              <Animated.View 
                style={[styles.glowRing, styles.glowRingPrimary, { opacity: glowOpacity1, transform: [{ scale: glowScale1 }] }]}
              />
              <Animated.View style={{ transform: [{ scale: scaleAnim1 }] }}>
                <TouchableOpacity style={[styles.roundButton, styles.roundButtonPrimary]} onPress={startRecording} activeOpacity={0.8}>
                  <Ionicons name="radio" size={50} color="#fff" />
                  <Text style={styles.roundButtonText}>SPYN</Text>
                </TouchableOpacity>
              </Animated.View>
              <Text style={styles.buttonLabel}>Recognize Music</Text>
            </View>

            {/* Record Set Button */}
            <View style={styles.buttonWrapper}>
              <Animated.View 
                style={[styles.glowRing, styles.glowRingSecondary, { opacity: glowOpacity2, transform: [{ scale: glowScale2 }] }]}
              />
              <Animated.View style={{ transform: [{ scale: scaleAnim2 }] }}>
                <TouchableOpacity style={[styles.roundButton, styles.roundButtonSecondary]} onPress={startDjSet} activeOpacity={0.8}>
                  <Ionicons name="mic" size={50} color="#fff" />
                  <Text style={styles.roundButtonText}>Record Set</Text>
                </TouchableOpacity>
              </Animated.View>
              <Text style={styles.buttonLabel}>Record DJ Set</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    padding: Spacing.lg, paddingTop: 60,
    backgroundColor: Colors.backgroundCard, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: Colors.borderAccent,
  },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: Colors.primary },
  headerSubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  buttonsContainer: { flexDirection: 'row', justifyContent: 'space-evenly', width: '100%', gap: Spacing.xl },
  buttonWrapper: { alignItems: 'center', position: 'relative' },
  glowRing: {
    position: 'absolute', width: GLOW_SIZE, height: GLOW_SIZE, borderRadius: GLOW_SIZE / 2,
    backgroundColor: 'transparent', borderWidth: 2,
  },
  glowRingPrimary: { borderColor: SPYN_COLOR, shadowColor: SPYN_COLOR, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 15 },
  glowRingSecondary: { borderColor: RECORD_COLOR, shadowColor: RECORD_COLOR, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 15 },
  roundButton: {
    width: BUTTON_SIZE, height: BUTTON_SIZE, borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  roundButtonPrimary: { backgroundColor: SPYN_COLOR },
  roundButtonSecondary: { backgroundColor: RECORD_COLOR },
  roundButtonText: { fontSize: 12, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  buttonLabel: { marginTop: 16, fontSize: 13, color: Colors.textSecondary },
  statusContainer: { alignItems: 'center', gap: 16 },
  statusText: { fontSize: 18, color: Colors.primary, fontWeight: '600' },
  recordingStatus: { alignItems: 'center', gap: Spacing.md },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#ff4444' },
  recordingLabel: { fontSize: 18, fontWeight: 'bold', color: '#ff4444' },
  djSetTimer: { fontSize: 56, fontWeight: 'bold', color: Colors.primary, fontVariant: ['tabular-nums'] },
  stopButton: {
    backgroundColor: '#ff4444', paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  stopButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  cancelButton: {
    backgroundColor: Colors.backgroundInput, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md, marginTop: Spacing.md,
  },
  cancelButtonText: { color: Colors.textSecondary, fontSize: 14 },
  resultContainer: { alignItems: 'center', width: '100%' },
  resultTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginTop: 16, marginBottom: 24 },
  resultInfo: {
    backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md,
    padding: Spacing.lg, width: '100%', gap: 8,
  },
  resultLabel: { fontSize: 12, color: Colors.textMuted },
  resultValue: { fontSize: 18, color: Colors.text, fontWeight: '600', marginBottom: 8 },
  resetButton: {
    backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: BorderRadius.md,
    marginTop: 24, paddingHorizontal: Spacing.xl,
  },
  resetButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
