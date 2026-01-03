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
  TextInput,
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
const BUTTON_SIZE = Math.min(SCREEN_WIDTH * 0.45, 180); // BIGGER BUTTON

// Get backend URL
const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL 
  || process.env.EXPO_PUBLIC_BACKEND_URL 
  || '';

// Colors
const CYAN_COLOR = '#5CB3CC';
const DARK_BG = '#0a0a0a';
const CARD_BG = '#1a1a2e';
const ORANGE_COLOR = '#E8A87C';
const GREEN_COLOR = '#4CAF50';

// Session settings
const MAX_SESSION_DURATION = 5 * 60 * 60 * 1000; // 5 hours in ms
const RECOGNITION_INTERVAL = 15000; // 15 seconds between recognitions
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
  const [showDiamondModal, setShowDiamondModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [startedAtTime, setStartedAtTime] = useState('');
  
  // End session form state
  const [correctedVenue, setCorrectedVenue] = useState('');
  const [whoPlayed, setWhoPlayed] = useState<'me' | 'another' | null>(null);
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const barAnims = useRef([...Array(12)].map(() => new Animated.Value(0.3))).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const diamondRotate = useRef(new Animated.Value(0)).current;
  
  // Refs
  const recognitionLoopRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isRecordingRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const lastIdentifiedTrackRef = useRef<string | null>(null);

  // Animation refs for cleanup
  const rotateAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const barAnimRefs = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    requestLocationPermission();
    startIdleAnimations();
    return () => {
      stopSession();
      stopAllAnimations();
    };
  }, []);

  const stopAllAnimations = () => {
    rotateAnimRef.current?.stop();
    glowAnimRef.current?.stop();
    pulseAnimRef.current?.stop();
    barAnimRefs.current.forEach(anim => anim?.stop());
  };

  const startIdleAnimations = () => {
    rotateAnimRef.current = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotateAnimRef.current.start();

    glowAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, useNativeDriver: false }),
      ])
    );
    glowAnimRef.current.start();
  };

  const startListeningAnimation = () => {
    // Sound bars animation - CONTINUOUS
    barAnimRefs.current = barAnims.map((anim, index) => {
      const randomDuration = 150 + Math.random() * 250;
      const animation = Animated.loop(
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
      );
      animation.start();
      return animation;
    });

    // Pulse animation - CONTINUOUS
    pulseAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    );
    pulseAnimRef.current.start();
  };

  const stopListeningAnimation = () => {
    barAnimRefs.current.forEach(anim => anim?.stop());
    barAnims.forEach(anim => anim.setValue(0.3));
    pulseAnimRef.current?.stop();
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

      const now = new Date();
      setStartedAtTime(now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

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
        started_at: now.toISOString(),
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
        startTime: now,
        venue: location?.venue,
        city: location?.city,
        country: location?.country,
      };

      setSession(newSession);
      setCorrectedVenue(location?.venue || '');
      setSessionActive(true);
      sessionActiveRef.current = true;
      setIdentifiedTracks([]);
      setCurrentTrack(null);
      lastIdentifiedTrackRef.current = null;

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
          handleEndSession();
        }
      }, 1000);

      // Start listening animation immediately and keep it running
      startListeningAnimation();
      setIsListening(true);

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
      if (sessionActiveRef.current && !isRecordingRef.current) {
        performRecognition();
      }
    }, RECOGNITION_INTERVAL);
  };

  const performRecognition = async () => {
    if (isRecordingRef.current || !sessionActiveRef.current) return;
    
    isRecordingRef.current = true;

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
        const trackKey = `${response.data.title}-${response.data.artist}`;
        
        // Only add if it's a DIFFERENT track than the last one identified
        if (trackKey !== lastIdentifiedTrackRef.current) {
          const trackResult: TrackResult = {
            ...response.data,
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            id: `${Date.now()}`,
          };

          lastIdentifiedTrackRef.current = trackKey;
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
                  tracks: [...identifiedTracks, trackResult].map(t => ({
                    title: t.title,
                    artist: t.artist,
                    time: t.time,
                    cover: t.cover_image,
                  }))
                },
                { headers: { Authorization: `Bearer ${token}` } }
              );
            } catch (e) {
              console.log('Could not update session');
            }
          }
        }
      }
    } catch (error: any) {
      console.error('[SPYN] Recognition error:', error);
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
    sessionActiveRef.current = false;
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
    setIsListening(false);
  };

  const handleEndSession = () => {
    setShowEndSessionModal(true);
  };

  const confirmEndSession = async () => {
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
            venue: correctedVenue || location?.venue,
            who_played: whoPlayed,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('[SPYN] Session completed');
      } catch (e) {
        console.log('Could not update session status');
      }
    }

    // Award Black Diamond if at least 1 track was identified
    if (identifiedTracks.length > 0) {
      // Award diamond
      try {
        await axios.post(
          `${BACKEND_URL}/api/award-diamond`,
          { 
            user_id: user?.id,
            type: 'black',
            reason: 'spyn_session',
            session_id: session?.id,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (e) {
        console.log('Could not award diamond');
      }

      // Show diamond animation
      setShowEndSessionModal(false);
      setShowDiamondModal(true);
      
      // Start diamond rotation
      Animated.loop(
        Animated.timing(diamondRotate, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Close diamond modal after 3 seconds
      setTimeout(() => {
        setShowDiamondModal(false);
        diamondRotate.setValue(0);
        resetSessionState();
      }, 3000);
    } else {
      setShowEndSessionModal(false);
      resetSessionState();
    }
  };

  const resetSessionState = () => {
    setSessionActive(false);
    setSession(null);
    setCurrentTrack(null);
    setSessionDuration('00:00:00');
    setWhoPlayed(null);
    setCorrectedVenue('');
    lastIdentifiedTrackRef.current = null;
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

  const diamondSpin = diamondRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
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
                <Text style={styles.sectionTitle}>
                  {t('spyn.previousSession') || 'Previous Session'} ({identifiedTracks.length} tracks)
                </Text>
                {identifiedTracks.slice(0, 5).map((track, index) => (
                  <View key={track.id || index} style={styles.trackItem}>
                    <View style={styles.trackImageContainer}>
                      {track.cover_image ? (
                        <Image source={{ uri: track.cover_image }} style={styles.trackImage} />
                      ) : (
                        <View style={[styles.trackImage, styles.placeholderImage]}>
                          <Ionicons name="musical-notes" size={24} color="#666" />
                        </View>
                      )}
                    </View>
                    <View style={styles.trackInfo}>
                      <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                      <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                    </View>
                    <Text style={styles.trackTime}>{track.time}</Text>
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
                        backgroundColor: `hsl(${160 + index * 8}, 70%, 50%)`,
                      },
                    ]}
                  />
                ))}
              </View>

              <Animated.View style={[styles.micContainer, { transform: [{ scale: pulseAnim }] }]}>
                <LinearGradient
                  colors={['#00BFA5', '#00897B']}
                  style={styles.micButton}
                >
                  <Ionicons name="mic" size={36} color="#fff" />
                </LinearGradient>
              </Animated.View>

              <Text style={styles.listeningStatus}>
                {recognizing ? 'Analyzing...' : 'Listening...'}
              </Text>
              <Text style={styles.autoAnalysis}>Auto-analysis every {RECOGNITION_INTERVAL / 1000}s</Text>
            </View>

            {/* Current Track */}
            {currentTrack && (
              <View style={styles.currentTrackContainer}>
                <View style={styles.successBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={GREEN_COLOR} />
                  <Text style={styles.successText}>Track Identified!</Text>
                </View>
                
                <View style={styles.currentTrackCard}>
                  <View style={styles.currentTrackImageContainer}>
                    {currentTrack.cover_image ? (
                      <Image source={{ uri: currentTrack.cover_image }} style={styles.currentTrackImage} />
                    ) : (
                      <View style={[styles.currentTrackImage, styles.placeholderImage]}>
                        <Ionicons name="musical-notes" size={32} color="#666" />
                      </View>
                    )}
                  </View>
                  <View style={styles.currentTrackInfo}>
                    <Text style={styles.currentTrackTitle}>"{currentTrack.title}"</Text>
                    <Text style={styles.currentTrackArtist}>{currentTrack.artist}</Text>
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
                <Text style={styles.sectionTitle}>
                  Identified tracks ({identifiedTracks.length})
                </Text>
                {identifiedTracks.map((track, index) => (
                  <View key={track.id || index} style={styles.trackItem}>
                    <View style={styles.trackImageContainer}>
                      {track.cover_image ? (
                        <Image source={{ uri: track.cover_image }} style={styles.trackImage} />
                      ) : (
                        <View style={[styles.trackImage, styles.placeholderImage]}>
                          <Ionicons name="musical-notes" size={20} color="#666" />
                        </View>
                      )}
                    </View>
                    <View style={styles.trackInfo}>
                      <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                      <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                    </View>
                    <Text style={styles.trackTime}>{track.time}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* End Session Button - BELOW */}
            <TouchableOpacity 
              style={styles.endSessionButtonLarge} 
              onPress={handleEndSession}
            >
              <Ionicons name="stop-circle" size={20} color="#fff" />
              <Text style={styles.endSessionButtonText}>End Session</Text>
            </TouchableOpacity>
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
          <View style={styles.endSessionModalContent}>
            {/* Close button */}
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowEndSessionModal(false)}
            >
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>

            <Text style={styles.endSessionTitle}>End Session</Text>
            <Text style={styles.endSessionSubtitle}>Confirm the end of your mixing session.</Text>

            {/* Venue Info Card */}
            <View style={styles.venueCard}>
              <View style={styles.venueHeader}>
                <View style={styles.venueDot} />
                <View style={styles.venueTextContainer}>
                  <Text style={styles.venueName}>{location?.venue || 'Unknown Venue'}</Text>
                  <Text style={styles.venueCity}>
                    {location?.city || 'Unknown City'} • Club identifié
                  </Text>
                </View>
              </View>

              <Text style={styles.correctLabel}>Corriger le lieu si nécessaire</Text>
              <TextInput
                style={styles.venueInput}
                value={correctedVenue}
                onChangeText={setCorrectedVenue}
                placeholder={location?.venue || 'Enter venue name'}
                placeholderTextColor="#666"
              />

              <Text style={styles.startedAtText}>Started at {startedAtTime}</Text>
              <View style={styles.tracksCountRow}>
                <Ionicons name="musical-notes" size={16} color="#888" />
                <Text style={styles.tracksCountText}>{identifiedTracks.length} tracks identified</Text>
              </View>
            </View>

            {/* Who played question */}
            <Text style={styles.whoPlayedTitle}>Who played this session?</Text>
            
            <TouchableOpacity 
              style={[styles.radioOption, whoPlayed === 'me' && styles.radioOptionSelected]}
              onPress={() => setWhoPlayed('me')}
            >
              <View style={[styles.radioCircle, whoPlayed === 'me' && styles.radioCircleSelected]} />
              <Text style={styles.radioText}>It was me</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.radioOption, whoPlayed === 'another' && styles.radioOptionSelected]}
              onPress={() => setWhoPlayed('another')}
            >
              <View style={[styles.radioCircle, whoPlayed === 'another' && styles.radioCircleSelected]} />
              <Text style={styles.radioText}>Another DJ</Text>
            </TouchableOpacity>

            {/* Warning if no tracks */}
            {identifiedTracks.length === 0 && (
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={18} color="#FFB74D" />
                <Text style={styles.warningText}>No track identified - No Black Diamond this time</Text>
              </View>
            )}

            {/* Confirm Button */}
            <TouchableOpacity 
              style={styles.confirmEndButton}
              onPress={confirmEndSession}
            >
              <Ionicons name="stop-circle" size={20} color="#fff" />
              <Text style={styles.confirmEndButtonText}>End Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================== BLACK DIAMOND MODAL ==================== */}
      <Modal
        visible={showDiamondModal}
        transparent
        animationType="fade"
      >
        <View style={styles.diamondModalOverlay}>
          <View style={styles.diamondModalContent}>
            <Animated.View style={{ transform: [{ rotateY: diamondSpin }] }}>
              <View style={styles.diamondIcon}>
                <Ionicons name="diamond" size={80} color="#1a1a2e" />
              </View>
            </Animated.View>
            <Text style={styles.diamondTitle}>Félicitations !</Text>
            <Text style={styles.diamondSubtitle}>Vous avez gagné un Black Diamond</Text>
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
  
  // Main Button - BIGGER
  mainButtonContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 30,
    width: BUTTON_SIZE + 50,
    height: BUTTON_SIZE + 50,
  },
  glowRingOuter: {
    position: 'absolute',
    width: BUTTON_SIZE + 50,
    height: BUTTON_SIZE + 50,
  },
  gradientRing: {
    width: '100%',
    height: '100%',
    borderRadius: (BUTTON_SIZE + 50) / 2,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  glowEffect: {
    position: 'absolute',
    width: BUTTON_SIZE + 30,
    height: BUTTON_SIZE + 30,
    borderRadius: (BUTTON_SIZE + 30) / 2,
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
  spynText: { fontSize: 36, fontWeight: 'bold', color: '#fff', letterSpacing: 4 },
  detectionText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)', letterSpacing: 1, marginTop: 4 },
  instructionText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 40 },

  // Session Header
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  sessionInfo: { alignItems: 'center' },
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
    backgroundColor: GREEN_COLOR 
  },
  activeText: { color: GREEN_COLOR, fontSize: 12, fontWeight: '600' },
  sessionDuration: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 4 },

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
  successText: { color: GREEN_COLOR, fontSize: 14, fontWeight: '600' },
  
  currentTrackCard: { 
    backgroundColor: CARD_BG, 
    borderRadius: 16, 
    padding: 16, 
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GREEN_COLOR + '40',
  },
  currentTrackImageContainer: { width: 80, height: 80 },
  currentTrackImage: { width: 80, height: 80, borderRadius: 8 },
  currentTrackInfo: { flex: 1, marginLeft: 14 },
  currentTrackTitle: { color: CYAN_COLOR, fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  currentTrackArtist: { color: '#fff', fontSize: 14, marginBottom: 6 },
  genreBadge: { 
    backgroundColor: CYAN_COLOR + '30', 
    paddingHorizontal: 10, 
    paddingVertical: 3, 
    borderRadius: 12, 
    alignSelf: 'flex-start' 
  },
  genreText: { color: CYAN_COLOR, fontSize: 11 },

  // Track Items
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  trackItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: CARD_BG, 
    padding: 12, 
    borderRadius: 12,
    marginBottom: 8,
  },
  trackImageContainer: { width: 50, height: 50 },
  trackImage: { width: 50, height: 50, borderRadius: 6 },
  placeholderImage: { 
    backgroundColor: '#333', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  trackInfo: { flex: 1, marginLeft: 12 },
  trackTitle: { color: '#fff', fontSize: 14, fontWeight: '500' },
  trackArtist: { color: Colors.textMuted, fontSize: 12 },
  trackTime: { color: Colors.textMuted, fontSize: 11 },

  // History Section
  historySection: { width: '100%', marginTop: 20 },
  identifiedSection: { width: '100%', marginBottom: 20 },

  // End Session Button Large
  endSessionButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53935',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    gap: 10,
    marginTop: 20,
    marginBottom: 40,
  },
  endSessionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // End Session Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  endSessionModalContent: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: CYAN_COLOR + '30',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  endSessionTitle: { 
    color: CYAN_COLOR, 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 8 
  },
  endSessionSubtitle: { 
    color: '#888', 
    fontSize: 14, 
    marginBottom: 20 
  },

  // Venue Card
  venueCard: {
    backgroundColor: '#252540',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: CYAN_COLOR + '30',
  },
  venueHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  venueDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: GREEN_COLOR,
    marginRight: 12,
    marginTop: 4,
  },
  venueTextContainer: { flex: 1 },
  venueName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  venueCity: { color: CYAN_COLOR, fontSize: 13, marginTop: 2 },
  correctLabel: { color: '#888', fontSize: 13, marginBottom: 8 },
  venueInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: CYAN_COLOR + '30',
    marginBottom: 12,
  },
  startedAtText: { color: CYAN_COLOR, fontSize: 13, marginBottom: 6 },
  tracksCountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tracksCountText: { color: '#888', fontSize: 13 },

  // Who Played
  whoPlayedTitle: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600', 
    marginBottom: 12 
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252540',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    gap: 12,
  },
  radioOptionSelected: {
    borderWidth: 1,
    borderColor: CYAN_COLOR,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: CYAN_COLOR,
  },
  radioCircleSelected: {
    backgroundColor: CYAN_COLOR,
  },
  radioText: { color: '#fff', fontSize: 14 },

  // Warning
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 183, 77, 0.15)',
    padding: 14,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 20,
    gap: 10,
  },
  warningText: { color: '#FFB74D', fontSize: 13, flex: 1 },

  // Confirm Button
  confirmEndButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE_COLOR,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
    gap: 10,
  },
  confirmEndButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Diamond Modal
  diamondModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  diamondModalContent: {
    alignItems: 'center',
    padding: 40,
  },
  diamondIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  diamondTitle: { 
    color: '#fff', 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 10 
  },
  diamondSubtitle: { 
    color: CYAN_COLOR, 
    fontSize: 18, 
    textAlign: 'center' 
  },
});
