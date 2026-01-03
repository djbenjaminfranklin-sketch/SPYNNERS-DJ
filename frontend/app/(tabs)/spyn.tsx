import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Image,
  Modal,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';
import axios from 'axios';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import Constants from 'expo-constants';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_SIZE = Math.min(SCREEN_WIDTH * 0.32, 130);

// Get backend URL
const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL 
  || process.env.EXPO_PUBLIC_BACKEND_URL 
  || '';

// Colors
const CYAN_COLOR = '#5CB3CC';
const DARK_BG = '#0a0a0a';
const CARD_BG = '#1a1a2e';

// Session settings
const MAX_SESSION_DURATION = 5 * 60 * 60 * 1000; // 5 hours in ms
const RECOGNITION_INTERVAL = 12000; // 12 seconds between recognitions
const RECORDING_DURATION = 10000; // 10 seconds recording

interface TrackResult {
  success: boolean;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  cover_image?: string;
  score?: number;
  time?: string;
  id?: string;
}

interface LocationInfo {
  latitude?: number;
  longitude?: number;
  venue?: string;
  city?: string;
  country?: string;
}

interface SessionInfo {
  id?: string;
  startTime: Date;
  venue?: string;
  city?: string;
  country?: string;
}

export default function SpynScreen() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  
  // States
  const [sessionActive, setSessionActive] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [identifiedTracks, setIdentifiedTracks] = useState<TrackResult[]>([]);
  const [currentTrack, setCurrentTrack] = useState<TrackResult | null>(null);
  const [sessionDuration, setSessionDuration] = useState('00:00:00');
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState<'silence' | 'good' | 'loud'>('silence');
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const barAnims = useRef([...Array(12)].map(() => new Animated.Value(0.3))).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  // Refs
  const sessionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionLoopRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    requestLocationPermission();
    startIdleAnimations();
    return () => {
      stopSession();
    };
  }, []);

  const startIdleAnimations = () => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, useNativeDriver: false }),
      ])
    ).start();
  };

  const startListeningAnimation = () => {
    barAnims.forEach((anim, index) => {
      const randomDuration = 150 + Math.random() * 250;
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 0.4 + Math.random() * 0.6,
            duration: randomDuration,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0.2 + Math.random() * 0.3,
            duration: randomDuration,
            useNativeDriver: false,
          }),
        ])
      ).start();
    });

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopListeningAnimation = () => {
    barAnims.forEach(anim => {
      anim.stopAnimation();
      anim.setValue(0.3);
    });
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        await updateLocation();
      }
    } catch (error) {
      console.error('Location permission error:', error);
    }
  };

  const updateLocation = async () => {
    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const lat = currentLocation.coords.latitude;
      const lng = currentLocation.coords.longitude;
      
      let venueName = undefined;
      try {
        const response = await axios.get(
          `${BACKEND_URL}/api/nearby-places`,
          { params: { lat, lng }, timeout: 10000 }
        );
        if (response.data.success && response.data.venue) {
          venueName = response.data.venue;
        }
      } catch (e) {
        console.log('Places lookup failed');
      }
      
      const [address] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      
      setLocation({
        latitude: lat,
        longitude: lng,
        venue: venueName || address?.name || address?.street || undefined,
        city: address?.city || address?.region || undefined,
        country: address?.country || undefined,
      });
    } catch (error) {
      console.error('Location update error:', error);
    }
  };

  // ==================== SESSION MANAGEMENT ====================
  
  const startSession = async () => {
    try {
      if (locationPermission) {
        await updateLocation();
      }

      // Create session in Base44
      const sessionData = {
        status: 'active',
        dj_id: user?.id,
        dj_name: user?.full_name,
        venue: location?.venue || 'Unknown Venue',
        city: location?.city || 'Unknown City',
        country: location?.country || 'Unknown Country',
        latitude: location?.latitude,
        longitude: location?.longitude,
        started_at: new Date().toISOString(),
        tracks: [],
      };

      let sessionId = undefined;
      try {
        const response = await axios.post(
          `${BACKEND_URL}/api/base44/entities/SessionMix`,
          sessionData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        sessionId = response.data?.id;
      } catch (e) {
        console.log('Could not create session in Base44');
      }

      const newSession: SessionInfo = {
        id: sessionId,
        startTime: new Date(),
        venue: location?.venue,
        city: location?.city,
        country: location?.country,
      };

      setSession(newSession);
      setSessionActive(true);
      setIdentifiedTracks([]);
      setCurrentTrack(null);

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - newSession.startTime.getTime();
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        setSessionDuration(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );

        // Auto-end after 5 hours
        if (elapsed >= MAX_SESSION_DURATION) {
          endSession();
        }
      }, 1000);

      // Start continuous recognition loop
      startContinuousRecognition();

    } catch (error) {
      console.error('Start session error:', error);
      Alert.alert('Error', 'Could not start session');
    }
  };

  const startContinuousRecognition = () => {
    // Start first recognition immediately
    performRecognition();

    // Set up continuous loop
    recognitionLoopRef.current = setInterval(() => {
      if (!isRecordingRef.current) {
        performRecognition();
      }
    }, RECOGNITION_INTERVAL);
  };

  const performRecognition = async () => {
    if (isRecordingRef.current) return;
    
    isRecordingRef.current = true;
    setIsListening(true);
    startListeningAnimation();

    try {
      if (Platform.OS === 'web') {
        await performWebRecognition();
      } else {
        await performNativeRecognition();
      }
    } catch (error) {
      console.error('Recognition error:', error);
    } finally {
      isRecordingRef.current = false;
      setIsListening(false);
      stopListeningAnimation();
    }
  };

  const performWebRecognition = async () => {
    return new Promise<void>((resolve) => {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          const audioChunks: BlobPart[] = [];
          mediaRecorderRef.current = mediaRecorder;

          mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
          };

          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Audio = (reader.result as string).split(',')[1];
              await recognizeAudio(base64Audio);
              resolve();
            };
            reader.readAsDataURL(audioBlob);
            stream.getTracks().forEach(track => track.stop());
          };

          mediaRecorder.start();

          // Stop after recording duration
          setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }, RECORDING_DURATION);
        })
        .catch((error) => {
          console.error('Web recording error:', error);
          resolve();
        });
    });
  };

  const performNativeRecognition = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        console.error('Microphone permission denied');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;

      // Wait for recording duration
      await new Promise(resolve => setTimeout(resolve, RECORDING_DURATION));

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (uri) {
        const audioBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await recognizeAudio(audioBase64);
      }
    } catch (error) {
      console.error('Native recording error:', error);
    }
  };

  const recognizeAudio = async (audioBase64: string) => {
    setRecognizing(true);

    try {
      console.log('[SPYN] Sending audio to ACRCloud...');

      const response = await axios.post(
        `${BACKEND_URL}/api/recognize-audio`,
        {
          audio_base64: audioBase64,
          location: location,
          dj_id: user?.id,
          dj_name: user?.full_name,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000,
        }
      );

      console.log('[SPYN] Response:', response.data);

      if (response.data.success && response.data.title) {
        const trackResult: TrackResult = {
          ...response.data,
          time: new Date().toLocaleTimeString(),
          id: `${Date.now()}`,
        };

        // Check if this is a different track than the current one
        const isDifferentTrack = !currentTrack || 
          currentTrack.title !== trackResult.title || 
          currentTrack.artist !== trackResult.artist;

        if (isDifferentTrack) {
          setCurrentTrack(trackResult);
          setIdentifiedTracks(prev => [trackResult, ...prev]);

          // Send notification to producer
          await sendProducerNotification(trackResult);

          // Update session in Base44
          if (session?.id) {
            try {
              await axios.put(
                `${BACKEND_URL}/api/base44/entities/SessionMix/${session.id}`,
                { 
                  tracks: identifiedTracks.map(t => ({
                    title: t.title,
                    artist: t.artist,
                    time: t.time,
                  }))
                },
                { headers: { Authorization: `Bearer ${token}` } }
              );
            } catch (e) {
              console.log('Could not update session');
            }
          }
        }

        setAudioLevel('good');
      } else {
        setAudioLevel('silence');
      }
    } catch (error: any) {
      console.error('[SPYN] Recognition error:', error);
      setAudioLevel('silence');
    } finally {
      setRecognizing(false);
    }
  };

  const sendProducerNotification = async (trackInfo: TrackResult) => {
    try {
      const notificationData = {
        track_title: trackInfo.title,
        track_artist: trackInfo.artist,
        track_cover: trackInfo.cover_image,
        dj_id: user?.id,
        dj_name: user?.full_name || 'DJ',
        dj_avatar: user?.avatar,
        venue: location?.venue || 'Unknown Venue',
        city: location?.city || 'Unknown City',
        country: location?.country || 'Unknown Country',
        latitude: location?.latitude,
        longitude: location?.longitude,
        played_at: new Date().toISOString(),
      };

      await axios.post(
        `${BACKEND_URL}/api/notify-producer`,
        notificationData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('[SPYN] Producer notified for:', trackInfo.title);
    } catch (error) {
      console.error('[SPYN] Failed to notify producer:', error);
    }
  };

  const stopSession = () => {
    if (recognitionLoopRef.current) {
      clearInterval(recognitionLoopRef.current);
      recognitionLoopRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    stopListeningAnimation();
    isRecordingRef.current = false;
  };

  const endSession = async () => {
    stopSession();

    // Update session status in Base44
    if (session?.id) {
      try {
        await axios.put(
          `${BACKEND_URL}/api/base44/entities/SessionMix/${session.id}`,
          { 
            status: 'completed',
            ended_at: new Date().toISOString(),
            total_tracks: identifiedTracks.length,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('[SPYN] Session completed');
      } catch (e) {
        console.log('Could not update session status');
      }
    }

    setSessionActive(false);
    setShowEndSessionModal(false);
    setSession(null);
    setCurrentTrack(null);
    setSessionDuration('00:00:00');
  };

  // Rotate interpolation
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* Location Banner */}
        {location && (
          <View style={styles.locationBanner}>
            <Ionicons name="location" size={16} color={CYAN_COLOR} />
            <Text style={styles.locationText}>
              {location.venue ? `${location.venue}, ` : ''}{location.city || 'Your Location'}
            </Text>
          </View>
        )}

        {/* ==================== IDLE STATE ==================== */}
        {!sessionActive && (
          <>
            <View style={styles.mainButtonContainer}>
              <Animated.View style={[styles.glowRingOuter, { transform: [{ rotate }] }]}>
                <LinearGradient
                  colors={['#FF6B6B', 'transparent', 'transparent', 'transparent']}
                  style={styles.gradientRing}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                />
              </Animated.View>
              
              <Animated.View style={[styles.glowEffect, { opacity: glowOpacity }]} />
              
              <TouchableOpacity onPress={startSession} activeOpacity={0.8}>
                <LinearGradient
                  colors={['#FF6B6B', '#E53935']}
                  style={styles.mainButton}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                >
                  <Text style={styles.spynText}>SPYN</Text>
                  <Text style={styles.detectionText}>{t('spyn.detection')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Text style={styles.instructionText}>
              {t('spyn.tapToStart') || 'Tap to start a DJ session (max 5 hours)'}
            </Text>

            {/* Previous Tracks History */}
            {identifiedTracks.length > 0 && (
              <View style={styles.historySection}>
                <Text style={styles.historyTitle}>
                  {t('spyn.previousSession') || 'Previous Session'} ({identifiedTracks.length} tracks)
                </Text>
                {identifiedTracks.slice(0, 5).map((track, index) => (
                  <View key={track.id || index} style={styles.historyItem}>
                    {track.cover_image && (
                      <Image source={{ uri: track.cover_image }} style={styles.historyImage} />
                    )}
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyTitle2}>{track.title}</Text>
                      <Text style={styles.historyArtist}>{track.artist}</Text>
                    </View>
                    <Text style={styles.historyTime}>{track.time}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ==================== ACTIVE SESSION ==================== */}
        {sessionActive && (
          <>
            {/* Session Header */}
            <View style={styles.sessionHeader}>
              <View style={styles.sessionInfo}>
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeText}>Active Session</Text>
                </View>
                <Text style={styles.sessionDuration}>{sessionDuration}</Text>
              </View>
              <TouchableOpacity 
                style={styles.endSessionButton} 
                onPress={() => setShowEndSessionModal(true)}
              >
                <Text style={styles.endSessionText}>End Session</Text>
              </TouchableOpacity>
            </View>

            {/* Listening Animation */}
            <View style={styles.listeningSection}>
              <View style={styles.soundBarsContainer}>
                {barAnims.map((anim, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      styles.soundBar,
                      {
                        height: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [15, 60],
                        }),
                        backgroundColor: isListening 
                          ? `hsl(${160 + index * 8}, 70%, 50%)` 
                          : '#333',
                      },
                    ]}
                  />
                ))}
              </View>

              <Animated.View style={[styles.micContainer, { transform: [{ scale: pulseAnim }] }]}>
                <LinearGradient
                  colors={isListening ? ['#00BFA5', '#00897B'] : ['#444', '#333']}
                  style={styles.micButton}
                >
                  <Ionicons name="mic" size={36} color="#fff" />
                </LinearGradient>
              </Animated.View>

              <Text style={styles.listeningStatus}>
                {recognizing ? 'Analyzing...' : isListening ? 'Listening...' : 'Waiting...'}
              </Text>
              <Text style={styles.autoAnalysis}>Auto-analysis every {RECOGNITION_INTERVAL / 1000}s</Text>
            </View>

            {/* Current Track */}
            {currentTrack && (
              <View style={styles.currentTrackContainer}>
                <View style={styles.successBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={styles.successText}>Track Identified!</Text>
                </View>
                
                <View style={styles.trackCard}>
                  {currentTrack.cover_image && (
                    <Image source={{ uri: currentTrack.cover_image }} style={styles.trackCover} />
                  )}
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle}>"{currentTrack.title}"</Text>
                    <Text style={styles.trackArtist}>{currentTrack.artist}</Text>
                    {currentTrack.genre && (
                      <View style={styles.genreBadge}>
                        <Text style={styles.genreText}>{currentTrack.genre}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Identified Tracks List */}
            {identifiedTracks.length > 0 && (
              <View style={styles.identifiedSection}>
                <Text style={styles.identifiedTitle}>
                  Identified tracks ({identifiedTracks.length})
                </Text>
                {identifiedTracks.map((track, index) => (
                  <View key={track.id || index} style={styles.identifiedItem}>
                    {track.cover_image && (
                      <Image source={{ uri: track.cover_image }} style={styles.identifiedImage} />
                    )}
                    <View style={styles.identifiedInfo}>
                      <Text style={styles.identifiedTrackTitle}>{track.title}</Text>
                      <Text style={styles.identifiedArtist}>{track.artist}</Text>
                    </View>
                    <Text style={styles.identifiedTime}>{track.time}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

      </ScrollView>

      {/* ==================== END SESSION MODAL ==================== */}
      <Modal
        visible={showEndSessionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndSessionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>End Session?</Text>
            
            <View style={styles.modalInfo}>
              <View style={styles.modalRow}>
                <Ionicons name="location" size={18} color={CYAN_COLOR} />
                <Text style={styles.modalText}>
                  {location?.venue || location?.city || 'Unknown Location'}
                </Text>
              </View>
              <View style={styles.modalRow}>
                <Ionicons name="time" size={18} color="#888" />
                <Text style={styles.modalText}>Duration: {sessionDuration}</Text>
              </View>
              <View style={styles.modalRow}>
                <Ionicons name="musical-notes" size={18} color="#4CAF50" />
                <Text style={styles.modalText}>{identifiedTracks.length} tracks identified</Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelModalButton}
                onPress={() => setShowEndSessionModal(false)}
              >
                <Text style={styles.cancelModalText}>Continue Session</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmModalButton}
                onPress={endSession}
              >
                <Text style={styles.confirmModalText}>End Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingTop: 60, alignItems: 'center', minHeight: '100%' },
  
  // Location Banner
  locationBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: CYAN_COLOR + '20', 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 25, 
    marginBottom: 30, 
    gap: 8 
  },
  locationText: { color: CYAN_COLOR, fontSize: 14, fontWeight: '600' },
  
  // Main Button
  mainButtonContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 30,
    width: BUTTON_SIZE + 40,
    height: BUTTON_SIZE + 40,
  },
  glowRingOuter: {
    position: 'absolute',
    width: BUTTON_SIZE + 40,
    height: BUTTON_SIZE + 40,
  },
  gradientRing: {
    width: '100%',
    height: '100%',
    borderRadius: (BUTTON_SIZE + 40) / 2,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  glowEffect: {
    position: 'absolute',
    width: BUTTON_SIZE + 20,
    height: BUTTON_SIZE + 20,
    borderRadius: (BUTTON_SIZE + 20) / 2,
    backgroundColor: '#FF6B6B',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 20,
  },
  mainButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spynText: { fontSize: 28, fontWeight: 'bold', color: '#fff', letterSpacing: 3 },
  detectionText: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.9)', letterSpacing: 1, marginTop: 4 },
  instructionText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 40 },

  // Session Header
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  sessionInfo: { alignItems: 'flex-start' },
  activeBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginBottom: 4,
  },
  activeDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#4CAF50' 
  },
  activeText: { color: '#4CAF50', fontSize: 12, fontWeight: '600' },
  sessionDuration: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  endSessionButton: {
    backgroundColor: '#E53935',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  endSessionText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Listening Section
  listeningSection: { alignItems: 'center', width: '100%', marginBottom: 30 },
  soundBarsContainer: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    justifyContent: 'center', 
    height: 70, 
    marginBottom: 20,
    gap: 4,
  },
  soundBar: { 
    width: 6, 
    borderRadius: 3,
  },
  micContainer: { marginBottom: 12 },
  micButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listeningStatus: { color: '#00BFA5', fontSize: 16, fontWeight: '600' },
  autoAnalysis: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },

  // Current Track
  currentTrackContainer: { width: '100%', marginBottom: 20 },
  successBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginBottom: 12,
  },
  successText: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },
  
  trackCard: { 
    backgroundColor: CARD_BG, 
    borderRadius: 16, 
    padding: 16, 
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50' + '40',
  },
  trackCover: { width: 80, height: 80, borderRadius: 8 },
  trackInfo: { flex: 1, marginLeft: 14 },
  trackTitle: { color: CYAN_COLOR, fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  trackArtist: { color: '#fff', fontSize: 14, marginBottom: 6 },
  genreBadge: { 
    backgroundColor: CYAN_COLOR + '30', 
    paddingHorizontal: 10, 
    paddingVertical: 3, 
    borderRadius: 12, 
    alignSelf: 'flex-start' 
  },
  genreText: { color: CYAN_COLOR, fontSize: 11 },

  // Identified Tracks
  identifiedSection: { width: '100%' },
  identifiedTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 12 },
  identifiedItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: CARD_BG, 
    padding: 12, 
    borderRadius: 12,
    marginBottom: 8,
  },
  identifiedImage: { width: 50, height: 50, borderRadius: 6 },
  identifiedInfo: { flex: 1, marginLeft: 12 },
  identifiedTrackTitle: { color: '#fff', fontSize: 14, fontWeight: '500' },
  identifiedArtist: { color: Colors.textMuted, fontSize: 12 },
  identifiedTime: { color: Colors.textMuted, fontSize: 11 },

  // History Section
  historySection: { width: '100%', marginTop: 20 },
  historyTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  historyItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: CARD_BG, 
    padding: 12, 
    borderRadius: 12,
    marginBottom: 8,
  },
  historyImage: { width: 50, height: 50, borderRadius: 6 },
  historyInfo: { flex: 1, marginLeft: 12 },
  historyTitle2: { color: '#fff', fontSize: 14, fontWeight: '500' },
  historyArtist: { color: Colors.textMuted, fontSize: 12 },
  historyTime: { color: Colors.textMuted, fontSize: 12 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: CYAN_COLOR + '30',
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  modalInfo: { marginBottom: 24 },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  modalText: { color: '#aaa', fontSize: 14 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelModalButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelModalText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  confirmModalButton: {
    flex: 1,
    backgroundColor: '#E53935',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmModalText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
