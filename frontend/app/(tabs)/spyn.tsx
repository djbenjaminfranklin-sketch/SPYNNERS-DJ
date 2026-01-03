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

interface TrackResult {
  success: boolean;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  cover_image?: string;
  score?: number;
}

interface LocationInfo {
  latitude?: number;
  longitude?: number;
  venue?: string;
  city?: string;
  country?: string;
}

export default function SpynScreen() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  
  // States
  const [recording, setRecording] = useState<any>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [identifiedTracks, setIdentifiedTracks] = useState<any[]>([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const barAnims = useRef([...Array(12)].map(() => new Animated.Value(0.3))).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  // Refs
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    requestLocationPermission();
    startIdleAnimations();
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const startIdleAnimations = () => {
    // Rotating glow animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Glow pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, useNativeDriver: false }),
      ])
    ).start();
  };

  const startListeningAnimation = () => {
    // Animate sound bars
    barAnims.forEach((anim, index) => {
      const randomDuration = 200 + Math.random() * 300;
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 0.3 + Math.random() * 0.7,
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

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopListeningAnimation = () => {
    barAnims.forEach(anim => anim.stopAnimation());
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        updateLocation();
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
      
      // Try Google Places API for venue name
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
      
      // Fallback to reverse geocode
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

  // ==================== SPYN DETECTION ====================
  const startDetection = async () => {
    try {
      if (locationPermission) {
        await updateLocation();
      }

      setSessionActive(true);
      setCountdown(10);
      startListeningAnimation();

      // Start countdown
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Web implementation
      if (Platform.OS === 'web') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          const audioChunks: BlobPart[] = [];
          
          mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
          };
          
          mediaRecorder.onstop = async () => {
            stopListeningAnimation();
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Audio = (reader.result as string).split(',')[1];
              await recognizeAudio(base64Audio);
            };
            reader.readAsDataURL(audioBlob);
            stream.getTracks().forEach(track => track.stop());
          };
          
          setRecording(mediaRecorder);
          mediaRecorder.start();
          
          // Auto-stop after 10 seconds
          setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
              setRecording(null);
            }
          }, 10000);
          
          return;
        } catch (webError) {
          console.error('Web recording error:', webError);
          Alert.alert('Error', 'Microphone access denied');
          setSessionActive(false);
          stopListeningAnimation();
          return;
        }
      }

      // Native implementation
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone access is needed');
        setSessionActive(false);
        stopListeningAnimation();
        return;
      }

      await Audio.setAudioModeAsync({ 
        allowsRecordingIOS: true, 
        playsInSilentModeIOS: true,
      });
      
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);

      // Auto-stop after 10 seconds
      setTimeout(() => stopDetection(), 10000);
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert('Error', 'Could not start recording');
      setSessionActive(false);
      stopListeningAnimation();
    }
  };

  const stopDetection = async () => {
    if (!recording) return;
    try {
      stopListeningAnimation();
      
      if (Platform.OS === 'web') {
        if (recording.state === 'recording') {
          recording.stop();
        }
        setRecording(null);
        return;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      
      if (uri) {
        const audioBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await recognizeAudio(audioBase64);
      }
    } catch (error) {
      console.error('Stop recording error:', error);
    }
  };

  const recognizeAudio = async (audioBase64: string) => {
    setRecognizing(true);
    setResult(null);

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
            Authorization: `Bearer ${token}` 
          },
          timeout: 30000,
        }
      );

      console.log('[SPYN] Response:', response.data);

      if (response.data.success) {
        setResult(response.data);
        
        // Add to identified tracks list
        setIdentifiedTracks(prev => [{
          ...response.data,
          time: new Date().toLocaleTimeString(),
        }, ...prev]);
        
        // Send notification email to producer
        if (response.data.title && response.data.artist) {
          await sendProducerNotification(response.data);
        }
      } else {
        Alert.alert(t('spyn.notRecognized') || 'Not Recognized', 
          t('spyn.tryAgain') || 'Could not identify this track. Try again with clearer audio.');
      }
    } catch (error: any) {
      console.error('[SPYN] Recognition error:', error);
      Alert.alert('Error', 'Recognition failed. Please try again.');
    } finally {
      setRecognizing(false);
      setSessionActive(false);
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
      
      console.log('[SPYN] Producer notified successfully');
    } catch (error) {
      console.error('[SPYN] Failed to notify producer:', error);
    }
  };

  const resetDetection = () => {
    setResult(null);
    setSessionActive(false);
    setCountdown(10);
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

        {/* Main Content */}
        {!sessionActive && !recognizing && !result && (
          <>
            {/* SPYN Detection Button */}
            <View style={styles.mainButtonContainer}>
              {/* Rotating glow ring */}
              <Animated.View style={[styles.glowRingOuter, { transform: [{ rotate }] }]}>
                <LinearGradient
                  colors={['#FF6B6B', 'transparent', 'transparent', 'transparent']}
                  style={styles.gradientRing}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                />
              </Animated.View>
              
              {/* Glow effect */}
              <Animated.View style={[styles.glowEffect, { opacity: glowOpacity }]} />
              
              {/* Main button */}
              <TouchableOpacity onPress={startDetection} activeOpacity={0.8}>
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
              {t('spyn.tapToIdentify') || 'Tap to identify the track playing'}
            </Text>

            {/* Identified Tracks History */}
            {identifiedTracks.length > 0 && (
              <View style={styles.historySection}>
                <Text style={styles.historyTitle}>
                  {t('spyn.identifiedTracks') || 'Identified Tracks'} ({identifiedTracks.length})
                </Text>
                {identifiedTracks.slice(0, 5).map((track, index) => (
                  <View key={index} style={styles.historyItem}>
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

        {/* Listening State */}
        {sessionActive && !recognizing && !result && (
          <View style={styles.listeningContainer}>
            {/* Sound Bars Animation */}
            <View style={styles.soundBarsContainer}>
              {barAnims.map((anim, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.soundBar,
                    {
                      height: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 80],
                      }),
                      backgroundColor: `hsl(${180 + index * 10}, 70%, 50%)`,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Microphone Icon */}
            <Animated.View style={[styles.micContainer, { transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient
                colors={['#00BFA5', '#00897B']}
                style={styles.micButton}
              >
                <Ionicons name="mic" size={40} color="#fff" />
              </LinearGradient>
            </Animated.View>

            <Text style={styles.listeningText}>{t('spyn.listening') || 'Listening...'}</Text>
            <Text style={styles.countdownText}>{countdown}s</Text>

            <TouchableOpacity style={styles.cancelButton} onPress={resetDetection}>
              <Text style={styles.cancelButtonText}>{t('common.cancel') || 'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recognizing State */}
        {recognizing && (
          <View style={styles.analyzingContainer}>
            <ActivityIndicator size="large" color={CYAN_COLOR} />
            <Text style={styles.analyzingText}>{t('spyn.analyzing') || 'Analyzing...'}</Text>
          </View>
        )}

        {/* Result State */}
        {result && (
          <View style={styles.resultContainer}>
            {/* Success Badge */}
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              <Text style={styles.successText}>{t('spyn.trackIdentified') || 'Track Identified!'}</Text>
            </View>

            {/* Track Card */}
            <View style={styles.trackCard}>
              {result.cover_image && (
                <Image source={{ uri: result.cover_image }} style={styles.trackCover} />
              )}
              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle}>"{result.title}"</Text>
                <Text style={styles.trackArtist}>{result.artist}</Text>
                {result.genre && (
                  <View style={styles.genreBadge}>
                    <Text style={styles.genreText}>{result.genre}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Location Info */}
            {location && (
              <View style={styles.locationInfo}>
                <View style={styles.locationRow}>
                  <Ionicons name="location" size={16} color="#FF6B6B" />
                  <Text style={styles.locationDetail}>
                    @ {location.venue || location.city}, {location.country}
                  </Text>
                </View>
                <View style={styles.locationRow}>
                  <Ionicons name="time" size={16} color="#888" />
                  <Text style={styles.locationDetail}>
                    {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                  </Text>
                </View>
                <View style={styles.locationRow}>
                  <Image 
                    source={{ uri: user?.avatar || 'https://via.placeholder.com/30' }} 
                    style={styles.djAvatar} 
                  />
                  <Text style={styles.locationDetail}>
                    Played by DJ <Text style={styles.djName}>{user?.full_name || 'Unknown'}</Text>
                  </Text>
                </View>
              </View>
            )}

            {/* Producer Notified */}
            <View style={styles.notifiedBadge}>
              <Ionicons name="mail" size={18} color="#4CAF50" />
              <Text style={styles.notifiedText}>
                {t('spyn.producerNotified') || 'Producer has been notified!'} 📧
              </Text>
            </View>

            {/* New Search Button */}
            <TouchableOpacity style={styles.newSearchButton} onPress={resetDetection}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.newSearchText}>{t('spyn.newSearch') || 'New Search'}</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
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

  // Listening State
  listeningContainer: { alignItems: 'center', marginTop: 20 },
  soundBarsContainer: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    justifyContent: 'center', 
    height: 100, 
    marginBottom: 30,
    gap: 4,
  },
  soundBar: { 
    width: 8, 
    borderRadius: 4,
  },
  micContainer: { marginBottom: 20 },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listeningText: { color: '#00BFA5', fontSize: 20, fontWeight: '600', marginBottom: 8 },
  countdownText: { color: Colors.textMuted, fontSize: 16 },
  cancelButton: { 
    marginTop: 30, 
    paddingHorizontal: 30, 
    paddingVertical: 12, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    borderRadius: 25 
  },
  cancelButtonText: { color: Colors.textMuted, fontSize: 14 },

  // Analyzing State
  analyzingContainer: { alignItems: 'center', marginTop: 50 },
  analyzingText: { color: CYAN_COLOR, fontSize: 18, marginTop: 20 },

  // Result State
  resultContainer: { width: '100%', alignItems: 'center' },
  successBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  successText: { color: '#4CAF50', fontSize: 16, fontWeight: '600' },
  
  trackCard: { 
    backgroundColor: CARD_BG, 
    borderRadius: 16, 
    padding: 20, 
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: CYAN_COLOR + '40',
  },
  trackCover: { width: 100, height: 100, borderRadius: 8 },
  trackInfo: { flex: 1, marginLeft: 16 },
  trackTitle: { color: CYAN_COLOR, fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  trackArtist: { color: '#fff', fontSize: 16, marginBottom: 8 },
  genreBadge: { 
    backgroundColor: CYAN_COLOR + '30', 
    paddingHorizontal: 12, 
    paddingVertical: 4, 
    borderRadius: 15, 
    alignSelf: 'flex-start' 
  },
  genreText: { color: CYAN_COLOR, fontSize: 12 },
  
  locationInfo: { 
    backgroundColor: CARD_BG, 
    borderRadius: 12, 
    padding: 16, 
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: CYAN_COLOR + '30',
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  locationDetail: { color: '#aaa', fontSize: 14 },
  djAvatar: { width: 24, height: 24, borderRadius: 12 },
  djName: { color: CYAN_COLOR, fontWeight: '600' },
  
  notifiedBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 20,
  },
  notifiedText: { color: '#4CAF50', fontSize: 14 },
  
  newSearchButton: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CYAN_COLOR, 
    paddingHorizontal: 30, 
    paddingVertical: 14, 
    borderRadius: 25 
  },
  newSearchText: { color: '#fff', fontSize: 16, fontWeight: '600' },

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
});
