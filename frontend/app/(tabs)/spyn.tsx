import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import { base44Notifications } from '../../src/services/base44Api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_SIZE = Math.min(SCREEN_WIDTH * 0.45, 180);

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
const MAX_SESSION_DURATION = 5 * 60 * 60 * 1000;
const RECOGNITION_INTERVAL = 12000;
const RECORDING_DURATION = 8000;

// Venue types that qualify for Black Diamond
const VALID_VENUE_TYPES = [
  'night_club', 'bar', 'restaurant', 'cafe', 'casino',
  'establishment', 'food', 'point_of_interest', 'event_venue',
  'nightclub', 'club', 'lounge', 'pub', 'disco'
];

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
  producer_id?: string;
}

interface LocationInfo {
  latitude?: number;
  longitude?: number;
  venue?: string;
  city?: string;
  country?: string;
  venue_type?: string;
  is_valid_venue?: boolean;
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
  const [locationLoading, setLocationLoading] = useState(true);
  
  const [correctedVenue, setCorrectedVenue] = useState('');
  const [whoPlayed, setWhoPlayed] = useState<'me' | 'another' | null>(null);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const barAnims = useRef([...Array(12)].map(() => new Animated.Value(0.3))).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const diamondRotate = useRef(new Animated.Value(0)).current;
  
  const recognitionLoopRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isRecordingRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const identifiedTracksRef = useRef<string[]>([]);

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
    barAnimRefs.current = barAnims.map((anim) => {
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
      setLocationLoading(false);
    } catch (error) {
      console.error('Location permission error:', error);
      setLocationLoading(false);
    }
  };

  const updateLocation = async () => {
    try {
      setLocationLoading(true);
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const lat = currentLocation.coords.latitude;
      const lng = currentLocation.coords.longitude;
      
      let venueName = undefined;
      let venueType = undefined;
      let isValidVenue = false;
      
      try {
        const response = await axios.get(
          `${BACKEND_URL}/api/nearby-places`,
          { params: { lat, lng }, timeout: 10000 }
        );
        if (response.data.success && response.data.venue) {
          venueName = response.data.venue;
          venueType = response.data.venue_type || response.data.types?.[0];
          
          // Check if it's a valid venue for Black Diamond
          const types = response.data.types || [];
          isValidVenue = types.some((type: string) => 
            VALID_VENUE_TYPES.some(valid => type.toLowerCase().includes(valid))
          );
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
        venue_type: venueType,
        is_valid_venue: isValidVenue,
      });
      setLocationLoading(false);
    } catch (error) {
      console.error('Location update error:', error);
      setLocationLoading(false);
    }
  };

  // ==================== START SESSION - ONE CLICK ONLY ====================
  
  const startSession = async () => {
    try {
      console.log('[SPYN] Starting session immediately...');
      
      // Set session active FIRST
      setSessionActive(true);
      sessionActiveRef.current = true;
      setIdentifiedTracks([]);
      setCurrentTrack(null);
      identifiedTracksRef.current = [];
      
      // Start animations immediately
      startListeningAnimation();
      setIsListening(true);
      
      const now = new Date();
      setStartedAtTime(now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      // Update location in background
      if (locationPermission) {
        updateLocation();
      }

      const newSession: SessionInfo = {
        startTime: now,
        venue: location?.venue,
        city: location?.city,
        country: location?.country,
      };

      setSession(newSession);
      setCorrectedVenue(location?.venue || '');

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - newSession.startTime.getTime();
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        setSessionDuration(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );

        if (elapsed >= MAX_SESSION_DURATION) {
          handleEndSession();
        }
      }, 1000);

      // Start recognition IMMEDIATELY
      console.log('[SPYN] Starting continuous recognition immediately...');
      performRecognition();
      
      // Then set up the loop
      recognitionLoopRef.current = setInterval(() => {
        if (sessionActiveRef.current && !isRecordingRef.current) {
          performRecognition();
        }
      }, RECOGNITION_INTERVAL);

    } catch (error) {
      console.error('Start session error:', error);
      Alert.alert('Error', 'Could not start session');
    }
  };

  const performRecognition = async () => {
    if (isRecordingRef.current || !sessionActiveRef.current) {
      return;
    }
    
    isRecordingRef.current = true;
    console.log('[SPYN] Starting recognition cycle...');

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
      if (!granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;

      await new Promise(resolve => setTimeout(resolve, RECORDING_DURATION));

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (uri) {
        const audioBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
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

      console.log('[SPYN] ACRCloud Response:', response.data);

      if (response.data.success && response.data.title) {
        const trackKey = `${response.data.title}-${response.data.artist}`.toLowerCase();
        
        if (!identifiedTracksRef.current.includes(trackKey)) {
          console.log('[SPYN] New track:', trackKey);
          
          identifiedTracksRef.current.push(trackKey);
          
          const trackResult: TrackResult = {
            ...response.data,
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            id: `${Date.now()}`,
          };

          setCurrentTrack(trackResult);
          setIdentifiedTracks(prev => [trackResult, ...prev]);
        }
      }
    } catch (error: any) {
      console.error('[SPYN] Recognition error:', error?.response?.data || error.message);
    } finally {
      setRecognizing(false);
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

    // Send emails to all identified track producers via Base44 SDK
    if (identifiedTracks.length > 0) {
      console.log('[SPYN] Sending emails to producers via Base44...');
      
      for (const track of identifiedTracks) {
        try {
          // Use the Base44 sendTrackPlayedEmail function
          await base44Notifications.sendTrackPlayedEmail({
            track_id: track.id || '',
            track_title: track.title || 'Unknown Track',
            artist_name: track.artist || 'Unknown Artist',
            dj_name: user?.full_name || 'DJ',
            club_name: correctedVenue || location?.venue || 'Unknown Venue',
            location: `${location?.city || 'Unknown'}, ${location?.country || 'Unknown'}`,
            played_at: new Date().toISOString(),
          });
          console.log(`[SPYN] Email sent for: ${track.title}`);
        } catch (e) {
          console.log(`[SPYN] Could not send email for: ${track.title}`, e);
        }
      }
    }

    // Award Black Diamond ONLY if valid venue (club, bar, restaurant)
    const canEarnDiamond = identifiedTracks.length > 0 && location?.is_valid_venue;
    
    if (canEarnDiamond) {
      console.log('[SPYN] Valid venue detected, awarding Black Diamond...');
      try {
        const awardResponse = await axios.post(
          `${BACKEND_URL}/api/award-diamond`,
          { 
            user_id: user?.id,
            type: 'black',
            reason: 'spyn_session',
            venue: correctedVenue || location?.venue,
            venue_type: location?.venue_type,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (awardResponse.data.success && !awardResponse.data.already_awarded) {
          console.log('[SPYN] Black Diamond awarded!');
          
          // Update user's diamond count
          try {
            const userId = user?.id || (user as any)?._id;
            if (userId) {
              const userResponse = await axios.get(
                `${BACKEND_URL}/api/base44/entities/User/${userId}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              
              const currentDiamonds = userResponse.data?.black_diamonds || userResponse.data?.diamonds || 0;
              
              await axios.put(
                `${BACKEND_URL}/api/base44/entities/User/${userId}`,
                { black_diamonds: currentDiamonds + 1 },
                { headers: { Authorization: `Bearer ${token}` } }
              );
            }
          } catch (e) {
            console.log('[SPYN] Could not update user diamonds');
          }

          setShowEndSessionModal(false);
          setShowDiamondModal(true);
          
          Animated.loop(
            Animated.timing(diamondRotate, {
              toValue: 1,
              duration: 2000,
              easing: Easing.linear,
              useNativeDriver: true,
            })
          ).start();

          setTimeout(() => {
            setShowDiamondModal(false);
            diamondRotate.setValue(0);
            resetSessionState();
          }, 3000);
          return;
        } else {
          console.log('[SPYN] Diamond already awarded today or failed');
        }
      } catch (e) {
        console.log('[SPYN] Could not award diamond:', e);
      }
    } else {
      console.log('[SPYN] No Black Diamond: tracks=' + identifiedTracks.length + ', valid_venue=' + location?.is_valid_venue);
    }

    setShowEndSessionModal(false);
    resetSessionState();
  };

  const resetSessionState = () => {
    setSessionActive(false);
    setSession(null);
    setCurrentTrack(null);
    setSessionDuration('00:00:00');
    setWhoPlayed(null);
    setCorrectedVenue('');
    identifiedTracksRef.current = [];
  };

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
        
        {/* LOCATION BANNER - ALWAYS VISIBLE */}
        <View style={styles.locationBanner}>
          <Ionicons name="location" size={16} color={location?.is_valid_venue ? GREEN_COLOR : CYAN_COLOR} />
          {locationLoading ? (
            <Text style={styles.locationText}>Detecting location...</Text>
          ) : location ? (
            <Text style={[styles.locationText, location?.is_valid_venue && { color: GREEN_COLOR }]}>
              {location.venue ? `${location.venue}, ` : ''}{location.city || 'Your Location'}
              {location.is_valid_venue && ' ✓'}
            </Text>
          ) : (
            <Text style={styles.locationText}>Location not available</Text>
          )}
        </View>

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
          </>
        )}

        {/* ==================== ACTIVE SESSION ==================== */}
        {sessionActive && (
          <>
            <View style={styles.sessionHeader}>
              <View style={styles.sessionInfo}>
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeText}>Active Session</Text>
                </View>
                <Text style={styles.sessionDuration}>{sessionDuration}</Text>
              </View>
            </View>

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
                <LinearGradient colors={['#00BFA5', '#00897B']} style={styles.micButton}>
                  <Ionicons name="mic" size={36} color="#fff" />
                </LinearGradient>
              </Animated.View>

              <Text style={styles.listeningStatus}>
                {recognizing ? 'Analyzing...' : 'Listening...'}
              </Text>
            </View>

            {/* END SESSION BUTTON - DIRECTLY AFTER MIC */}
            <TouchableOpacity style={styles.endSessionButtonLarge} onPress={handleEndSession}>
              <Ionicons name="stop-circle" size={20} color="#fff" />
              <Text style={styles.endSessionButtonText}>End Session</Text>
            </TouchableOpacity>

            {/* Current Track */}
            {currentTrack && (
              <View style={styles.currentTrackContainer}>
                <View style={styles.successBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={GREEN_COLOR} />
                  <Text style={styles.successText}>Track Identified!</Text>
                </View>
                
                <View style={styles.currentTrackCard}>
                  {currentTrack.cover_image ? (
                    <Image source={{ uri: currentTrack.cover_image }} style={styles.currentTrackImage} />
                  ) : (
                    <View style={[styles.currentTrackImage, styles.placeholderImage]}>
                      <Ionicons name="musical-notes" size={32} color="#666" />
                    </View>
                  )}
                  <View style={styles.currentTrackInfo}>
                    <Text style={styles.currentTrackTitle}>"{currentTrack.title}"</Text>
                    <Text style={styles.currentTrackArtist}>{currentTrack.artist}</Text>
                    {currentTrack.album && <Text style={styles.currentTrackAlbum}>{currentTrack.album}</Text>}
                  </View>
                </View>
              </View>
            )}

            {/* Identified Tracks List */}
            {identifiedTracks.length > 0 && (
              <View style={styles.identifiedSection}>
                <Text style={styles.sectionTitle}>Identified ({identifiedTracks.length})</Text>
                {identifiedTracks.map((track, index) => (
                  <View key={track.id || index} style={styles.trackItem}>
                    {track.cover_image ? (
                      <Image source={{ uri: track.cover_image }} style={styles.trackImage} />
                    ) : (
                      <View style={[styles.trackImage, styles.placeholderImage]}>
                        <Ionicons name="musical-notes" size={20} color="#666" />
                      </View>
                    )}
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
      </ScrollView>

      {/* END SESSION MODAL */}
      <Modal visible={showEndSessionModal} transparent animationType="fade" onRequestClose={() => setShowEndSessionModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.endSessionModalContent}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowEndSessionModal(false)}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>

            <Text style={styles.endSessionTitle}>End Session</Text>
            <Text style={styles.endSessionSubtitle}>Confirm the end of your mixing session.</Text>

            <View style={styles.venueCard}>
              <View style={styles.venueHeader}>
                <View style={[styles.venueDot, { backgroundColor: location?.is_valid_venue ? GREEN_COLOR : '#888' }]} />
                <View style={styles.venueTextContainer}>
                  <Text style={styles.venueName}>{location?.venue || 'Unknown Venue'}</Text>
                  <Text style={styles.venueCity}>
                    {location?.city || 'Unknown'} • {location?.is_valid_venue ? 'Club identifié ✓' : 'Lieu non reconnu'}
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

            <Text style={styles.whoPlayedTitle}>Who played this session?</Text>
            
            <TouchableOpacity style={[styles.radioOption, whoPlayed === 'me' && styles.radioOptionSelected]} onPress={() => setWhoPlayed('me')}>
              <View style={[styles.radioCircle, whoPlayed === 'me' && styles.radioCircleSelected]} />
              <Text style={styles.radioText}>It was me</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.radioOption, whoPlayed === 'another' && styles.radioOptionSelected]} onPress={() => setWhoPlayed('another')}>
              <View style={[styles.radioCircle, whoPlayed === 'another' && styles.radioCircleSelected]} />
              <Text style={styles.radioText}>Another DJ</Text>
            </TouchableOpacity>

            {identifiedTracks.length === 0 && (
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={18} color="#FFB74D" />
                <Text style={styles.warningText}>No track identified - No Black Diamond</Text>
              </View>
            )}

            {identifiedTracks.length > 0 && !location?.is_valid_venue && (
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={18} color="#FFB74D" />
                <Text style={styles.warningText}>Location not recognized as club/bar - No Black Diamond</Text>
              </View>
            )}

            <TouchableOpacity style={styles.confirmEndButton} onPress={confirmEndSession}>
              <Ionicons name="stop-circle" size={20} color="#fff" />
              <Text style={styles.confirmEndButtonText}>End Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* BLACK DIAMOND MODAL */}
      <Modal visible={showDiamondModal} transparent animationType="fade">
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
  
  mainButtonContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 30,
    width: BUTTON_SIZE + 50,
    height: BUTTON_SIZE + 50,
  },
  glowRingOuter: { position: 'absolute', width: BUTTON_SIZE + 50, height: BUTTON_SIZE + 50 },
  gradientRing: { width: '100%', height: '100%', borderRadius: (BUTTON_SIZE + 50) / 2, borderWidth: 3, borderColor: 'transparent' },
  glowEffect: { position: 'absolute', width: BUTTON_SIZE + 30, height: BUTTON_SIZE + 30, borderRadius: (BUTTON_SIZE + 30) / 2, backgroundColor: '#FF6B6B' },
  mainButton: { width: BUTTON_SIZE, height: BUTTON_SIZE, borderRadius: BUTTON_SIZE / 2, justifyContent: 'center', alignItems: 'center' },
  spynText: { fontSize: 36, fontWeight: 'bold', color: '#fff', letterSpacing: 4 },
  detectionText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)', letterSpacing: 1, marginTop: 4 },
  instructionText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 40 },

  sessionHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: 20 },
  sessionInfo: { alignItems: 'center' },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(76, 175, 80, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, marginBottom: 4 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN_COLOR },
  activeText: { color: GREEN_COLOR, fontSize: 12, fontWeight: '600' },
  sessionDuration: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 4 },

  listeningSection: { alignItems: 'center', width: '100%', marginBottom: 15 },
  soundBarsContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height: 70, marginBottom: 20, gap: 4 },
  soundBar: { width: 6, borderRadius: 3 },
  micContainer: { marginBottom: 12 },
  micButton: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
  listeningStatus: { color: '#00BFA5', fontSize: 16, fontWeight: '600' },

  endSessionButtonLarge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E53935', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 30, gap: 10, marginBottom: 25 },
  endSessionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  currentTrackContainer: { width: '100%', marginBottom: 20 },
  successBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  successText: { color: GREEN_COLOR, fontSize: 14, fontWeight: '600' },
  currentTrackCard: { backgroundColor: CARD_BG, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: GREEN_COLOR + '40' },
  currentTrackImage: { width: 80, height: 80, borderRadius: 8 },
  currentTrackInfo: { flex: 1, marginLeft: 14 },
  currentTrackTitle: { color: CYAN_COLOR, fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  currentTrackArtist: { color: '#fff', fontSize: 14, marginBottom: 4 },
  currentTrackAlbum: { color: Colors.textMuted, fontSize: 12 },

  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12, alignSelf: 'flex-start' },
  trackItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, padding: 12, borderRadius: 12, marginBottom: 8, width: '100%' },
  trackImage: { width: 50, height: 50, borderRadius: 6 },
  placeholderImage: { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  trackInfo: { flex: 1, marginLeft: 12 },
  trackTitle: { color: '#fff', fontSize: 14, fontWeight: '500' },
  trackArtist: { color: Colors.textMuted, fontSize: 12 },
  trackTime: { color: Colors.textMuted, fontSize: 11 },
  identifiedSection: { width: '100%', marginBottom: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  endSessionModalContent: { backgroundColor: CARD_BG, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: CYAN_COLOR + '30' },
  modalCloseButton: { position: 'absolute', top: 16, right: 16, zIndex: 10 },
  endSessionTitle: { color: CYAN_COLOR, fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  endSessionSubtitle: { color: '#888', fontSize: 14, marginBottom: 20 },
  venueCard: { backgroundColor: '#252540', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: CYAN_COLOR + '30' },
  venueHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  venueDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: GREEN_COLOR, marginRight: 12, marginTop: 4 },
  venueTextContainer: { flex: 1 },
  venueName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  venueCity: { color: CYAN_COLOR, fontSize: 13, marginTop: 2 },
  correctLabel: { color: '#888', fontSize: 13, marginBottom: 8 },
  venueInput: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 12, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: CYAN_COLOR + '30', marginBottom: 12 },
  startedAtText: { color: CYAN_COLOR, fontSize: 13, marginBottom: 6 },
  tracksCountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tracksCountText: { color: '#888', fontSize: 13 },
  whoPlayedTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  radioOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252540', padding: 14, borderRadius: 10, marginBottom: 10, gap: 12 },
  radioOptionSelected: { borderWidth: 1, borderColor: CYAN_COLOR },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: CYAN_COLOR },
  radioCircleSelected: { backgroundColor: CYAN_COLOR },
  radioText: { color: '#fff', fontSize: 14 },
  warningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 183, 77, 0.15)', padding: 14, borderRadius: 10, marginTop: 10, marginBottom: 20, gap: 10 },
  warningText: { color: '#FFB74D', fontSize: 13, flex: 1 },
  confirmEndButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: ORANGE_COLOR, paddingVertical: 16, borderRadius: 12, marginTop: 10, gap: 10 },
  confirmEndButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  diamondModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  diamondModalContent: { alignItems: 'center', padding: 40 },
  diamondIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  diamondTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  diamondSubtitle: { color: CYAN_COLOR, fontSize: 18, textAlign: 'center' },
});
