import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { useLocalSearchParams } from 'expo-router';
import offlineService from '../../src/services/offlineService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_SIZE = Math.min(SCREEN_WIDTH * 0.45, 180);

// Get backend URL - always use the full preview URL to ensure auth headers are transmitted
const getBackendUrl = () => {
  // Always use the full preview domain for API calls
  return 'https://spynners-app-1.preview.emergentagent.com';
};

const BACKEND_URL = getBackendUrl();

// Colors
const CYAN_COLOR = '#5CB3CC';
const DARK_BG = '#0a0a0a';
const CARD_BG = '#1a1a2e';
const ORANGE_COLOR = '#E8A87C';
const GREEN_COLOR = '#4CAF50';
const RED_COLOR = '#E53935';

// Session settings
const MAX_SESSION_DURATION = 5 * 60 * 60 * 1000; // 5 hours
const RECOGNITION_INTERVAL = 12000; // 12 seconds between recognition cycles
const RECORDING_DURATION = 8000; // 8 seconds of recording

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
  const params = useLocalSearchParams();
  const autostart = params.autostart === 'true';
  
  // Session state
  const [sessionActive, setSessionActive] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [identifiedTracks, setIdentifiedTracks] = useState<TrackResult[]>([]);
  const [currentTrack, setCurrentTrack] = useState<TrackResult | null>(null);
  const [sessionDuration, setSessionDuration] = useState('00:00:00');
  const [startedAtTime, setStartedAtTime] = useState('');
  
  // Location state
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  
  // Modal state
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [showDiamondModal, setShowDiamondModal] = useState(false);
  const [correctedVenue, setCorrectedVenue] = useState('');
  const [whoPlayed, setWhoPlayed] = useState<'me' | 'another' | null>(null);
  const [otherDjName, setOtherDjName] = useState('');
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const barAnims = useRef([...Array(12)].map(() => new Animated.Value(0.3))).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const diamondRotate = useRef(new Animated.Value(0)).current;
  
  // Refs for session management
  const recognitionLoopRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isRecordingRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const identifiedTracksRef = useRef<string[]>([]);
  const autostartTriggeredRef = useRef(false);
  
  // Microphone permission state
  const [micPermission, setMicPermission] = useState(false);
  const [micPermissionRequested, setMicPermissionRequested] = useState(false);
  
  // Offline mode state
  const [isOffline, setIsOffline] = useState(false);
  const [offlineRecordingsCount, setOfflineRecordingsCount] = useState(0);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncResults, setSyncResults] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Animation refs
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const rotateAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const barAnimRefs = useRef<Animated.CompositeAnimation[]>([]);

  // ==================== INITIALIZATION ====================
  
  useEffect(() => {
    requestLocationPermission();
    requestMicrophonePermission(); // Request mic permission on page load
    startIdleAnimations();
    initOfflineMode();
    
    // Subscribe to network changes
    const unsubscribeNetwork = offlineService.onNetworkChange((online) => {
      console.log('[SPYN] Network changed callback:', online ? 'ONLINE' : 'OFFLINE');
      setIsOffline(!online);
    });
    
    return () => {
      stopSession();
      stopAllAnimations();
      unsubscribeNetwork();
    };
  }, []);

  // Initialize offline mode
  const initOfflineMode = async () => {
    try {
      // Check network status immediately
      const isOnline = await offlineService.checkNetworkStatus();
      console.log('[SPYN] Initial network check:', isOnline ? 'ONLINE' : 'OFFLINE');
      setIsOffline(!isOnline);
      
      // Get pending sync count
      const pendingCount = await offlineService.getPendingCount();
      setPendingSyncCount(pendingCount);
      
      if (pendingCount > 0) {
        console.log('[SPYN] Pending offline recordings:', pendingCount);
      }
      
      // Register for push notifications (for offline sync alerts)
      await offlineService.registerForPushNotifications();
      
    } catch (error) {
      console.error('[SPYN] Offline init error:', error);
    }
  };

  // Monitor network changes and auto-sync
  useEffect(() => {
    // Auto-sync when coming back online with pending recordings
    const syncIfNeeded = async () => {
      // Refresh pending count whenever network status changes
      const newPendingCount = await offlineService.getPendingCount();
      console.log('[SPYN] Refreshing pending count:', newPendingCount, 'isOffline:', isOffline);
      setPendingSyncCount(newPendingCount);
      
      // AUTO-SYNC when coming back online with pending recordings
      if (!isOffline && newPendingCount > 0 && !isSyncing) {
        console.log('[SPYN] 🔄 AUTO-SYNC: Online with', newPendingCount, 'pending recordings');
        setIsSyncing(true);
        
        try {
          const { synced, failed, results } = await offlineService.syncPendingSessions(token || undefined);
          
          console.log('[SPYN] Auto-sync complete:', synced, 'synced,', failed, 'failed');
          
          // Update pending count
          const remainingCount = await offlineService.getPendingCount();
          setPendingSyncCount(remainingCount);
          
          // Show results
          if (results && results.length > 0) {
            const identifiedTracks = results.filter(r => r.success && r.is_spynners_track);
            setSyncResults(identifiedTracks);
            setShowSyncModal(true);
          } else if (synced > 0) {
            // Show alert if no Spynners tracks identified
            Alert.alert(
              '🔄 Synchronisation terminée',
              `${synced} enregistrement(s) traité(s).\nAucun track Spynners identifié.`,
              [{ text: 'OK' }]
            );
          }
        } catch (error) {
          console.error('[SPYN] Auto-sync error:', error);
        } finally {
          setIsSyncing(false);
        }
      }
    };
    
    syncIfNeeded();
  }, [isOffline, token]);

  // Autostart session when coming from home page
  useEffect(() => {
    if (autostart && micPermission && !sessionActive && !autostartTriggeredRef.current) {
      console.log('[SPYN] Autostart triggered from home page');
      autostartTriggeredRef.current = true;
      // Small delay to ensure everything is loaded
      setTimeout(() => {
        handleSpynButtonPress();
      }, 500);
    }
  }, [autostart, micPermission, sessionActive]);

  // Request microphone permission on page load
  const requestMicrophonePermission = async () => {
    try {
      console.log('[SPYN] Requesting microphone permission on page load...');
      setMicPermissionRequested(true);
      
      if (Platform.OS === 'web') {
        // Web: Request media permission
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop immediately, just wanted permission
        setMicPermission(true);
        console.log('[SPYN] Web microphone permission granted');
      } else {
        // Native: Use expo-av
        const { granted } = await Audio.requestPermissionsAsync();
        setMicPermission(granted);
        console.log('[SPYN] Native microphone permission:', granted ? 'granted' : 'denied');
      }
    } catch (error) {
      console.error('[SPYN] Microphone permission error:', error);
      setMicPermission(false);
    }
  };

  const stopAllAnimations = () => {
    rotateAnimRef.current?.stop();
    glowAnimRef.current?.stop();
    pulseAnimRef.current?.stop();
    barAnimRefs.current.forEach(anim => anim?.stop());
  };

  const startIdleAnimations = () => {
    // Rotating glow ring
    rotateAnimRef.current = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotateAnimRef.current.start();

    // Pulsing glow
    glowAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, useNativeDriver: false }),
      ])
    );
    glowAnimRef.current.start();
  };

  const startListeningAnimation = () => {
    // Sound bars animation
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

    // Continuous pulse animation for mic button
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

  // ==================== LOCATION ====================

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        await updateLocation();
      } else {
        setLocationLoading(false);
      }
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
      let venueTypes: string[] = [];
      let isValidVenue = false;
      
      // Try to get venue from Google Places API
      try {
        const response = await axios.get(
          `${BACKEND_URL}/api/nearby-places`,
          { params: { lat, lng }, timeout: 10000 }
        );
        if (response.data.success && response.data.venue) {
          venueName = response.data.venue;
          venueType = response.data.venue_type || response.data.types?.[0];
          venueTypes = response.data.types || [];
          
          // Check if it's a valid venue for Black Diamond
          isValidVenue = venueTypes.some((type: string) => 
            VALID_VENUE_TYPES.some(valid => type.toLowerCase().includes(valid))
          );
        }
      } catch (e) {
        console.log('Places lookup failed, using reverse geocoding');
      }
      
      // Get address via reverse geocoding
      const [address] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      
      const newLocation: LocationInfo = {
        latitude: lat,
        longitude: lng,
        venue: venueName || address?.name || address?.street || undefined,
        city: address?.city || address?.region || undefined,
        country: address?.country || undefined,
        venue_type: venueType,
        is_valid_venue: isValidVenue,
      };
      
      console.log('[SPYN] Location updated:', newLocation);
      setLocation(newLocation);
      setLocationLoading(false);
    } catch (error) {
      console.error('Location update error:', error);
      setLocationLoading(false);
    }
  };

  // ==================== SESSION MANAGEMENT ====================
  
  const handleSpynButtonPress = useCallback(() => {
    console.log('[SPYN] Button pressed! Starting session immediately...');
    
    // Immediately set session active to switch UI
    setSessionActive(true);
    sessionActiveRef.current = true;
    
    // Reset tracks
    setIdentifiedTracks([]);
    setCurrentTrack(null);
    identifiedTracksRef.current = [];
    
    // Start animations
    startListeningAnimation();
    
    // Set start time
    const now = new Date();
    setStartedAtTime(now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    
    // Create session info
    const newSession: SessionInfo = {
      startTime: now,
      venue: location?.venue,
      city: location?.city,
      country: location?.country,
    };
    setSession(newSession);
    setCorrectedVenue(location?.venue || '');
    
    // Update location in background
    if (locationPermission) {
      updateLocation();
    }
    
    // Start duration timer
    durationIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - now.getTime();
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
    
    // Start recognition immediately
    console.log('[SPYN] Starting first recognition...');
    performRecognition();
    
    // Set up continuous recognition loop
    recognitionLoopRef.current = setInterval(() => {
      if (sessionActiveRef.current && !isRecordingRef.current) {
        performRecognition();
      }
    }, RECOGNITION_INTERVAL);
    
  }, [location, locationPermission]);

  const performRecognition = async () => {
    if (isRecordingRef.current || !sessionActiveRef.current) {
      console.log('[SPYN] Skipping recognition - already recording or session inactive');
      return;
    }
    
    isRecordingRef.current = true;
    setRecognizing(true);
    console.log('[SPYN] Starting recognition cycle...');

    try {
      if (Platform.OS === 'web') {
        await performWebRecognition();
      } else {
        await performNativeRecognition();
      }
    } catch (error) {
      console.error('[SPYN] Recognition error:', error);
    } finally {
      isRecordingRef.current = false;
      setRecognizing(false);
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
              await sendAudioForRecognition(base64Audio);
              resolve();
            };
            reader.readAsDataURL(audioBlob);
            stream.getTracks().forEach(track => track.stop());
          };

          mediaRecorder.start();
          console.log('[SPYN] Web recording started...');

          setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
              console.log('[SPYN] Web recording stopped');
            }
          }, RECORDING_DURATION);
        })
        .catch((error) => {
          console.error('[SPYN] Web recording error:', error);
          resolve();
        });
    });
  };

  const performNativeRecognition = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        console.log('[SPYN] Audio permission not granted');
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
      console.log('[SPYN] Native recording started...');

      await new Promise(resolve => setTimeout(resolve, RECORDING_DURATION));

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('[SPYN] Native recording stopped, URI:', uri);

      if (uri) {
        const audioBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
        await sendAudioForRecognition(audioBase64);
      }
    } catch (error) {
      console.error('[SPYN] Native recording error:', error);
    }
  };

  const sendAudioForRecognition = async (audioBase64: string) => {
    // Check if we're offline
    const isOnline = offlineService.isNetworkAvailable();
    
    if (!isOnline) {
      // OFFLINE MODE: Save recording locally
      console.log('[SPYN] 📴 OFFLINE - Saving recording locally...');
      
      try {
        await offlineService.saveOfflineRecording({
          audioBase64: audioBase64,
          timestamp: new Date().toISOString(),
          location: location ? {
            latitude: location.latitude,
            longitude: location.longitude,
            venue: location.venue,
            city: location.city,
            country: location.country,
            is_valid_venue: location.is_valid_venue,
          } : undefined,
          userId: user?.id || '',
          djName: user?.full_name || 'DJ',
        });
        
        // Update UI
        setOfflineRecordingsCount(prev => prev + 1);
        const pending = await offlineService.getPendingCount();
        setPendingSyncCount(pending);
        
        console.log('[SPYN] ✅ Recording saved offline. Total pending:', pending);
        
        // Show offline indicator on current track area
        setCurrentTrack({
          success: false,
          title: `Recording #${offlineRecordingsCount + 1}`,
          artist: 'Saved offline - will sync when online',
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        });
        
      } catch (error) {
        console.error('[SPYN] Failed to save offline recording:', error);
      }
      
      return;
    }
    
    // ONLINE MODE: Send to ACRCloud
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

      console.log('[SPYN] ACRCloud Response:', JSON.stringify(response.data, null, 2));

      // ONLY show tracks that are found in Spynners database
      if (response.data.success && response.data.title && response.data.spynners_track_id) {
        const trackKey = `${response.data.title}-${response.data.artist}`.toLowerCase();
        
        // Check if we already identified this track
        if (!identifiedTracksRef.current.includes(trackKey)) {
          console.log('[SPYN] ✅ SPYNNERS track identified:', trackKey);
          console.log('[SPYN] Cover image URL:', response.data.cover_image);
          console.log('[SPYN] Producer email:', response.data.producer_email);
          
          identifiedTracksRef.current.push(trackKey);
          
          const trackResult: TrackResult = {
            success: true,
            title: response.data.title,
            artist: response.data.artist,
            album: response.data.album,
            genre: response.data.genre,
            cover_image: response.data.cover_image,
            score: response.data.score,
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            id: response.data.spynners_track_id,
            producer_id: response.data.producer_id,
          };

          setCurrentTrack(trackResult);
          setIdentifiedTracks(prev => [trackResult, ...prev]);
        } else {
          console.log('[SPYN] Track already identified:', trackKey);
        }
      } else if (response.data.success && response.data.title) {
        // Track identified by ACRCloud but NOT in Spynners
        console.log('[SPYN] ⚠️ Track NOT in Spynners:', response.data.title, 'by', response.data.artist);
      } else {
        console.log('[SPYN] No track identified in this cycle');
      }
    } catch (error: any) {
      console.error('[SPYN] Recognition API error:', error?.response?.data || error.message);
      
      // If network error, switch to offline mode
      if (error.code === 'ECONNABORTED' || error.message?.includes('Network') || !error.response) {
        console.log('[SPYN] Network error detected - switching to offline mode');
        setIsOffline(true);
        
        // Save this recording offline
        await offlineService.saveOfflineRecording({
          audioBase64: audioBase64,
          timestamp: new Date().toISOString(),
          location: location ? {
            latitude: location.latitude,
            longitude: location.longitude,
            venue: location.venue,
            city: location.city,
            country: location.country,
            is_valid_venue: location.is_valid_venue,
          } : undefined,
          userId: user?.id || '',
          djName: user?.full_name || 'DJ',
        });
        
        setOfflineRecordingsCount(prev => prev + 1);
        setPendingSyncCount(await offlineService.getPendingCount());
      }
    }
  };

  const stopSession = () => {
    console.log('[SPYN] Stopping session...');
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
  };

  const handleEndSession = () => {
    setShowEndSessionModal(true);
  };

  const confirmEndSession = async () => {
    // Close modal immediately for better UX
    setShowEndSessionModal(false);
    
    stopSession();

    // End offline session if we were recording offline
    if (offlineRecordingsCount > 0) {
      console.log('[SPYN] Ending offline session with', offlineRecordingsCount, 'recordings');
      const endedSession = await offlineService.endOfflineSession();
      
      if (endedSession) {
        // Check if we're back online
        const isOnline = await offlineService.checkNetworkStatus();
        const newPendingCount = await offlineService.getPendingCount();
        setPendingSyncCount(newPendingCount);
        setOfflineRecordingsCount(0);
        
        if (isOnline && newPendingCount > 0) {
          // Show sync modal immediately
          setShowSyncModal(true);
        } else {
          // Still offline - just show saved message
          Alert.alert(
            '📴 Session Offline Sauvegardée',
            `${endedSession.recordings.length} enregistrement(s) sauvegardé(s).\nIls seront traités quand vous serez en ligne.`,
            [{ text: 'OK' }]
          );
        }
      }
      
      resetSessionState();
      return; // Don't continue with online session logic
    }

    // Check if valid venue (restaurant, bar, club, etc.)
    const isValidVenue = location?.is_valid_venue === true;
    
    // Send emails to producers ONLY if in a valid venue AND online
    if (identifiedTracks.length > 0 && token && isValidVenue && !isOffline) {
      console.log('[SPYN] ✅ Valid venue detected - Sending emails to producers...');
      console.log('[SPYN] Venue:', location?.venue, '| Type:', location?.venue_type);
      
      // Fire and forget - don't wait for emails
      identifiedTracks.forEach(async (track) => {
        try {
          console.log(`[SPYN] Sending email for track: ${track.title}, producerId: ${track.producer_id}`);
          
          // Call with required fields: producerId, trackTitle, djName
          const emailPayload = {
            producerId: track.producer_id, // Required field
            trackTitle: track.title || 'Unknown Track', // Required field
            djName: user?.full_name || 'DJ', // Required field
            // Optional fields
            city: location?.city || '',
            country: location?.country || '',
            venue: correctedVenue || location?.venue || '',
            trackArtworkUrl: track.cover_image || '',
            djAvatar: user?.avatar || '',
            playedAt: new Date().toISOString(),
          };
          
          console.log('[SPYN] Email payload:', JSON.stringify(emailPayload));
          
          const response = await axios.post(
            `${BACKEND_URL}/api/base44/functions/invoke/sendTrackPlayedEmail`,
            emailPayload,
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            }
          );
          console.log(`[SPYN] ✅ Email sent for: ${track.title}`, response.data);
        } catch (e: any) {
          console.log(`[SPYN] ❌ Could not send email for: ${track.title}`, e?.response?.data || e.message);
        }
      });
    } else if (identifiedTracks.length > 0 && !isValidVenue) {
      console.log('[SPYN] ⚠️ No emails sent - Not in a valid venue (restaurant/bar/club)');
      console.log('[SPYN] Current location:', location?.venue, '| is_valid_venue:', location?.is_valid_venue);
    } else if (isOffline) {
      console.log('[SPYN] ⚠️ No emails sent - Offline mode (will be sent when synced)');
    } else {
      console.log('[SPYN] No emails sent - tracks:', identifiedTracks.length, ', token:', token ? 'Yes' : 'No');
    }

    // Award Black Diamond ONLY if valid venue (club, bar, restaurant) AND online
    const canEarnDiamond = identifiedTracks.length > 0 && isValidVenue && !isOffline;
    
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
      console.log('[SPYN] No Black Diamond: tracks=' + identifiedTracks.length + ', valid_venue=' + location?.is_valid_venue + ', offline=' + isOffline);
    }

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
    // Keep identified tracks visible for review
  };

  // ==================== ANIMATION INTERPOLATIONS ====================

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

  // ==================== RENDER ====================

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* ==================== DEBUG: NETWORK STATUS (always visible) ==================== */}
        <View style={styles.debugBanner}>
          <Ionicons 
            name={isOffline ? "cloud-offline" : "cloud-done"} 
            size={16} 
            color={isOffline ? "#FFB74D" : "#4CAF50"} 
          />
          <Text style={[styles.debugText, { color: isOffline ? "#FFB74D" : "#4CAF50" }]}>
            {isOffline ? "📴 OFFLINE" : "✅ ONLINE"}
          </Text>
        </View>

        {/* ==================== OFFLINE BANNER ==================== */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline" size={18} color="#FFB74D" />
            <Text style={styles.offlineBannerText}>
              Mode Offline - Recordings saved locally
            </Text>
            {pendingSyncCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingSyncCount}</Text>
              </View>
            )}
          </View>
        )}

        {/* ==================== PENDING SYNC CARD (when online with pending recordings) ==================== */}
        {!isOffline && pendingSyncCount > 0 && !sessionActive && (
          <View style={styles.pendingSyncCard}>
            <View style={styles.pendingSyncHeader}>
              <Ionicons name="cloud-upload" size={24} color={CYAN_COLOR} />
              <View style={styles.pendingSyncInfo}>
                <Text style={styles.pendingSyncTitle}>
                  {pendingSyncCount} enregistrement(s) en attente
                </Text>
                <Text style={styles.pendingSyncSubtitle}>
                  Prêts à être identifiés
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.syncButton} 
              onPress={async () => {
                console.log('[SPYN] Manual sync triggered');
                Alert.alert(
                  '🔄 Synchronisation',
                  'Envoi des enregistrements en cours...',
                  [],
                  { cancelable: false }
                );
                const { synced, failed } = await offlineService.syncPendingSessions(token || undefined);
                const newPending = await offlineService.getPendingCount();
                setPendingSyncCount(newPending);
                
                if (synced > 0) {
                  Alert.alert(
                    '🎵 Synchronisation terminée !',
                    `${synced} enregistrement(s) traité(s) avec succès.${failed > 0 ? `\n${failed} échec(s).` : ''}`,
                    [{ text: 'OK' }]
                  );
                } else if (failed > 0) {
                  Alert.alert(
                    '❌ Erreur de synchronisation',
                    `${failed} enregistrement(s) n'ont pas pu être traités. Réessayez plus tard.`,
                    [{ text: 'OK' }]
                  );
                } else {
                  Alert.alert(
                    'ℹ️ Info',
                    'Aucun enregistrement à synchroniser.',
                    [{ text: 'OK' }]
                  );
                }
              }}
            >
              <Text style={styles.syncButtonText}>Synchroniser maintenant</Text>
              <Ionicons name="sync" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* ==================== LOCATION BANNER - ALWAYS ON TOP ==================== */}
        <View style={styles.locationBanner}>
          <Ionicons 
            name="location" 
            size={18} 
            color={location?.is_valid_venue ? GREEN_COLOR : CYAN_COLOR} 
          />
          {locationLoading ? (
            <Text style={styles.locationText}>Detecting location...</Text>
          ) : location ? (
            <View style={styles.locationTextContainer}>
              <Text style={[styles.locationText, location?.is_valid_venue && { color: GREEN_COLOR }]}>
                {location.venue || location.city || 'Unknown Location'}
              </Text>
              {location.city && location.venue && (
                <Text style={styles.locationSubtext}>{location.city}, {location.country}</Text>
              )}
              {location.is_valid_venue && (
                <View style={styles.validVenueBadge}>
                  <Ionicons name="checkmark-circle" size={12} color={GREEN_COLOR} />
                  <Text style={styles.validVenueText}>Club/Bar verified</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.locationText}>Location not available</Text>
          )}
        </View>

        {/* ==================== IDLE STATE - SPYN BUTTON ==================== */}
        {!sessionActive && (
          <>
            <View style={styles.mainButtonContainer}>
              {/* Rotating outer glow ring */}
              <Animated.View style={[styles.glowRingOuter, { transform: [{ rotate }] }]}>
                <LinearGradient
                  colors={['#FF6B6B', 'transparent', 'transparent', 'transparent']}
                  style={styles.gradientRing}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                />
              </Animated.View>
              
              {/* Pulsing glow effect */}
              <Animated.View style={[styles.glowEffect, { opacity: glowOpacity }]} />
              
              {/* Main SPYN button - ONE CLICK TO START */}
              <TouchableOpacity 
                onPress={handleSpynButtonPress} 
                activeOpacity={0.8}
                style={styles.buttonTouchable}
              >
                <LinearGradient
                  colors={['#FF6B6B', '#E53935']}
                  style={styles.mainButton}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                >
                  <Text style={styles.spynText}>SPYN</Text>
                  <Text style={styles.detectionText}>{t('spyn.detection') || 'DETECTION'}</Text>
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
            {/* Session Header */}
            <View style={styles.sessionHeader}>
              <View style={styles.activeBadge}>
                <View style={styles.activeDot} />
                <Text style={styles.activeText}>Session Active</Text>
              </View>
              <Text style={styles.sessionDuration}>{sessionDuration}</Text>
            </View>

            {/* Listening Animation */}
            <View style={styles.listeningSection}>
              {/* Sound bars */}
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

              {/* Pulsating mic button */}
              <Animated.View style={[styles.micContainer, { transform: [{ scale: pulseAnim }] }]}>
                <LinearGradient colors={['#00BFA5', '#00897B']} style={styles.micButton}>
                  <Ionicons name="mic" size={36} color="#fff" />
                </LinearGradient>
              </Animated.View>

              <Text style={styles.listeningStatus}>
                {recognizing ? '🎵 Analyzing audio...' : isOffline ? '📴 Recording offline...' : '🎧 Listening...'}
              </Text>
              
              {/* Offline recordings counter during session */}
              {isOffline && offlineRecordingsCount > 0 && (
                <View style={styles.offlineCounter}>
                  <Ionicons name="save" size={14} color="#FFB74D" />
                  <Text style={styles.offlineCounterText}>
                    {offlineRecordingsCount} recording(s) saved
                  </Text>
                </View>
              )}
            </View>

            {/* END SESSION BUTTON - DIRECTLY UNDER MIC */}
            <TouchableOpacity style={styles.endSessionButtonLarge} onPress={handleEndSession}>
              <Ionicons name="stop-circle" size={22} color="#fff" />
              <Text style={styles.endSessionButtonText}>End Session</Text>
            </TouchableOpacity>

            {/* Current Track - Show when identified */}
            {currentTrack && (
              <View style={styles.currentTrackContainer}>
                <View style={styles.successBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={GREEN_COLOR} />
                  <Text style={styles.successText}>Track Identified!</Text>
                </View>
                
                <View style={styles.currentTrackCard}>
                  {currentTrack.cover_image ? (
                    <Image 
                      source={{ uri: currentTrack.cover_image }} 
                      style={styles.currentTrackImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.currentTrackImage, styles.placeholderImage]}>
                      <Ionicons name="musical-notes" size={32} color="#666" />
                    </View>
                  )}
                  <View style={styles.currentTrackInfo}>
                    <Text style={styles.currentTrackTitle} numberOfLines={2}>
                      "{currentTrack.title}"
                    </Text>
                    <Text style={styles.currentTrackArtist} numberOfLines={1}>
                      {currentTrack.artist}
                    </Text>
                    {currentTrack.album && (
                      <Text style={styles.currentTrackAlbum} numberOfLines={1}>
                        {currentTrack.album}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Identified Tracks List */}
            {identifiedTracks.length > 0 && (
              <View style={styles.identifiedSection}>
                <Text style={styles.sectionTitle}>
                  Identified Tracks ({identifiedTracks.length})
                </Text>
                {identifiedTracks.map((track, index) => (
                  <View key={track.id || index} style={styles.trackItem}>
                    {track.cover_image ? (
                      <Image 
                        source={{ uri: track.cover_image }} 
                        style={styles.trackImage}
                        resizeMode="cover"
                      />
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

      {/* ==================== END SESSION MODAL ==================== */}
      <Modal 
        visible={showEndSessionModal} 
        transparent 
        animationType="fade" 
        onRequestClose={() => setShowEndSessionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.endSessionModalContent}>
            <TouchableOpacity 
              style={styles.modalCloseButton} 
              onPress={() => setShowEndSessionModal(false)}
            >
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>

            <Text style={styles.endSessionTitle}>End Session</Text>
            <Text style={styles.endSessionSubtitle}>
              Confirm the end of your mixing session.
            </Text>

            {/* Venue Info Card */}
            <View style={styles.venueCard}>
              <View style={styles.venueHeader}>
                <View style={[
                  styles.venueDot, 
                  { backgroundColor: location?.is_valid_venue ? GREEN_COLOR : '#888' }
                ]} />
                <View style={styles.venueTextContainer}>
                  <Text style={styles.venueName}>
                    {location?.venue || 'Unknown Venue'}
                  </Text>
                  <Text style={styles.venueCity}>
                    {location?.city || 'Unknown'} • {location?.is_valid_venue ? 'Club verified ✓' : 'Unverified location'}
                  </Text>
                </View>
              </View>

              <Text style={styles.correctLabel}>Correct venue name if needed:</Text>
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
                <Text style={styles.tracksCountText}>
                  {identifiedTracks.length} tracks identified
                </Text>
              </View>
            </View>

            {/* Who Played Selection */}
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

            {/* DJ Name Input - appears when "Another DJ" is selected */}
            {whoPlayed === 'another' && (
              <View style={styles.otherDjContainer}>
                <Text style={styles.otherDjLabel}>Nom du DJ :</Text>
                <TextInput
                  style={styles.otherDjInput}
                  value={otherDjName}
                  onChangeText={setOtherDjName}
                  placeholder="Entrez le nom du DJ"
                  placeholderTextColor="#666"
                  autoCapitalize="words"
                />
              </View>
            )}

            {/* Warning Messages */}
            {identifiedTracks.length === 0 && (
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={18} color="#FFB74D" />
                <Text style={styles.warningText}>
                  No track identified - No Black Diamond awarded
                </Text>
              </View>
            )}

            {identifiedTracks.length > 0 && !location?.is_valid_venue && (
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={18} color="#FFB74D" />
                <Text style={styles.warningText}>
                  Location not recognized as club/bar - No Black Diamond
                </Text>
              </View>
            )}

            {identifiedTracks.length > 0 && location?.is_valid_venue && (
              <View style={styles.successBox}>
                <Ionicons name="diamond" size={18} color={CYAN_COLOR} />
                <Text style={styles.successBoxText}>
                  You will earn a Black Diamond! 💎
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.confirmEndButton} onPress={confirmEndSession}>
              <Ionicons name="stop-circle" size={20} color="#fff" />
              <Text style={styles.confirmEndButtonText}>Confirm End Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================== BLACK DIAMOND MODAL ==================== */}
      <Modal visible={showDiamondModal} transparent animationType="fade">
        <View style={styles.diamondModalOverlay}>
          <View style={styles.diamondModalContent}>
            <Animated.View style={{ transform: [{ rotateY: diamondSpin }] }}>
              <View style={styles.diamondIcon}>
                <Ionicons name="diamond" size={80} color="#1a1a2e" />
              </View>
            </Animated.View>
            <Text style={styles.diamondTitle}>Félicitations !</Text>
            <Text style={styles.diamondSubtitle}>Vous avez gagné un Black Diamond 💎</Text>
          </View>
        </View>
      </Modal>

      {/* ==================== SYNC OFFLINE MODAL ==================== */}
      <Modal 
        visible={showSyncModal} 
        transparent 
        animationType="slide"
        onRequestClose={() => setShowSyncModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.syncModalContent}>
            <TouchableOpacity 
              style={styles.modalCloseButton} 
              onPress={() => {
                setShowSyncModal(false);
                setSyncResults([]);
              }}
            >
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>

            <Ionicons name="cloud-upload" size={50} color={CYAN_COLOR} style={{ marginBottom: 16 }} />
            
            <Text style={styles.syncModalTitle}>
              {isSyncing ? 'Synchronisation...' : syncResults.length > 0 ? 'Résultats' : 'Session Offline'}
            </Text>
            
            {!isSyncing && syncResults.length === 0 && (
              <>
                <Text style={styles.syncModalSubtitle}>
                  {pendingSyncCount} enregistrement(s) en attente d'identification
                </Text>
                
                <TouchableOpacity 
                  style={styles.syncModalButton}
                  onPress={async () => {
                    setIsSyncing(true);
                    console.log('[SPYN] Syncing offline recordings...');
                    
                    try {
                      const { synced, failed } = await offlineService.syncPendingSessions(token || undefined);
                      
                      // Get results from last session
                      const sessions = await offlineService.getOfflineSessions();
                      const lastSyncedSession = sessions.find(s => s.status === 'synced');
                      
                      if (lastSyncedSession) {
                        const results = lastSyncedSession.recordings
                          .filter(r => r.result?.success)
                          .map(r => r.result);
                        setSyncResults(results);
                      }
                      
                      setPendingSyncCount(await offlineService.getPendingCount());
                      
                      if (synced === 0 && failed === 0) {
                        Alert.alert('Info', 'Aucun enregistrement à synchroniser.');
                        setShowSyncModal(false);
                      }
                    } catch (error) {
                      console.error('[SPYN] Sync error:', error);
                      Alert.alert('Erreur', 'Échec de la synchronisation. Réessayez.');
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                >
                  <Text style={styles.syncModalButtonText}>Synchroniser maintenant</Text>
                  <Ionicons name="sync" size={20} color="#fff" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.syncModalButtonSecondary}
                  onPress={() => {
                    setShowSyncModal(false);
                  }}
                >
                  <Text style={styles.syncModalButtonTextSecondary}>Plus tard</Text>
                </TouchableOpacity>
              </>
            )}
            
            {isSyncing && (
              <View style={styles.syncingContainer}>
                <Animated.View style={{ transform: [{ rotate }] }}>
                  <Ionicons name="sync" size={40} color={CYAN_COLOR} />
                </Animated.View>
                <Text style={styles.syncingText}>Identification en cours...</Text>
              </View>
            )}
            
            {!isSyncing && syncResults.length > 0 && (
              <View style={styles.syncResultsContainer}>
                <Text style={styles.syncResultsTitle}>
                  {syncResults.length} track(s) identifié(s) :
                </Text>
                <ScrollView style={styles.syncResultsList}>
                  {syncResults.map((result, index) => (
                    <View key={index} style={styles.syncResultItem}>
                      {result.cover_image ? (
                        <Image 
                          source={{ uri: result.cover_image }} 
                          style={styles.syncResultImage}
                        />
                      ) : (
                        <View style={[styles.syncResultImage, styles.placeholderImage]}>
                          <Ionicons name="musical-notes" size={20} color="#666" />
                        </View>
                      )}
                      <View style={styles.syncResultInfo}>
                        <Text style={styles.syncResultTitle} numberOfLines={1}>
                          {result.title}
                        </Text>
                        <Text style={styles.syncResultArtist} numberOfLines={1}>
                          {result.artist}
                        </Text>
                      </View>
                      <Ionicons name="checkmark-circle" size={24} color={GREEN_COLOR} />
                    </View>
                  ))}
                </ScrollView>
                
                <TouchableOpacity 
                  style={styles.syncModalButton}
                  onPress={() => {
                    setShowSyncModal(false);
                    setSyncResults([]);
                  }}
                >
                  <Text style={styles.syncModalButtonText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {!isSyncing && syncResults.length === 0 && pendingSyncCount === 0 && (
              <View style={styles.noResultsContainer}>
                <Ionicons name="alert-circle" size={40} color="#FFB74D" />
                <Text style={styles.noResultsText}>
                  Aucun track Spynners identifié dans cette session.
                </Text>
                <Text style={styles.noResultsSubtext}>
                  Assurez-vous de jouer des tracks de la bibliothèque Spynners.
                </Text>
                <TouchableOpacity 
                  style={styles.syncModalButton}
                  onPress={() => setShowSyncModal(false)}
                >
                  <Text style={styles.syncModalButtonText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: DARK_BG 
  },
  scrollView: { 
    flex: 1 
  },
  scrollContent: { 
    padding: Spacing.lg, 
    paddingTop: 60, 
    alignItems: 'center', 
    minHeight: '100%' 
  },
  
  // Debug Banner (always visible for testing)
  debugBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginBottom: 10,
    gap: 6,
  },
  debugText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Location Banner - ALWAYS VISIBLE AT TOP
  locationBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: CYAN_COLOR + '20', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 25, 
    marginBottom: 30, 
    gap: 10,
    width: '100%',
    maxWidth: 350,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationText: { 
    color: CYAN_COLOR, 
    fontSize: 15, 
    fontWeight: '600' 
  },
  locationSubtext: {
    color: CYAN_COLOR + '90',
    fontSize: 12,
    marginTop: 2,
  },
  validVenueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  validVenueText: {
    color: GREEN_COLOR,
    fontSize: 11,
    fontWeight: '600',
  },
  
  // Offline Banner
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFB74D20',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 12,
    gap: 8,
    width: '100%',
    maxWidth: 350,
    borderWidth: 1,
    borderColor: '#FFB74D40',
  },
  offlineBannerText: {
    color: '#FFB74D',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  pendingBadge: {
    backgroundColor: '#FFB74D',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  pendingBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Pending Sync Card (when online with pending recordings)
  pendingSyncCard: {
    backgroundColor: CYAN_COLOR + '15',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    width: '100%',
    maxWidth: 350,
    borderWidth: 1,
    borderColor: CYAN_COLOR + '40',
  },
  pendingSyncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  pendingSyncInfo: {
    flex: 1,
  },
  pendingSyncTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pendingSyncSubtitle: {
    color: CYAN_COLOR,
    fontSize: 13,
    marginTop: 2,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CYAN_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 8,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Main Button Container
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
    height: BUTTON_SIZE + 50 
  },
  gradientRing: { 
    width: '100%', 
    height: '100%', 
    borderRadius: (BUTTON_SIZE + 50) / 2, 
    borderWidth: 3, 
    borderColor: 'transparent' 
  },
  glowEffect: { 
    position: 'absolute', 
    width: BUTTON_SIZE + 30, 
    height: BUTTON_SIZE + 30, 
    borderRadius: (BUTTON_SIZE + 30) / 2, 
    backgroundColor: '#FF6B6B' 
  },
  buttonTouchable: {
    zIndex: 10,
  },
  mainButton: { 
    width: BUTTON_SIZE, 
    height: BUTTON_SIZE, 
    borderRadius: BUTTON_SIZE / 2, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  spynText: { 
    fontSize: 36, 
    fontWeight: 'bold', 
    color: '#fff', 
    letterSpacing: 4 
  },
  detectionText: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: 'rgba(255,255,255,0.9)', 
    letterSpacing: 1, 
    marginTop: 4 
  },
  instructionText: { 
    color: Colors.textMuted, 
    fontSize: 14, 
    textAlign: 'center', 
    marginBottom: 40 
  },

  // Session Header
  sessionHeader: { 
    alignItems: 'center', 
    width: '100%', 
    marginBottom: 20 
  },
  activeBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: 'rgba(76, 175, 80, 0.15)', 
    paddingHorizontal: 14, 
    paddingVertical: 8, 
    borderRadius: 20, 
    marginBottom: 8 
  },
  activeDot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    backgroundColor: GREEN_COLOR 
  },
  activeText: { 
    color: GREEN_COLOR, 
    fontSize: 14, 
    fontWeight: '600' 
  },
  sessionDuration: { 
    color: '#fff', 
    fontSize: 32, 
    fontWeight: 'bold', 
    marginTop: 4 
  },

  // Listening Section
  listeningSection: { 
    alignItems: 'center', 
    width: '100%', 
    marginBottom: 20 
  },
  soundBarsContainer: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    justifyContent: 'center', 
    height: 70, 
    marginBottom: 20, 
    gap: 4 
  },
  soundBar: { 
    width: 6, 
    borderRadius: 3 
  },
  micContainer: { 
    marginBottom: 12 
  },
  micButton: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  listeningStatus: { 
    color: '#00BFA5', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  offlineCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
    backgroundColor: '#FFB74D20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  offlineCounterText: {
    color: '#FFB74D',
    fontSize: 13,
    fontWeight: '500',
  },

  // End Session Button
  endSessionButtonLarge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: RED_COLOR, 
    paddingVertical: 14, 
    paddingHorizontal: 32, 
    borderRadius: 30, 
    gap: 10, 
    marginBottom: 25,
    marginTop: 10,
  },
  endSessionButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600' 
  },

  // Current Track
  currentTrackContainer: { 
    width: '100%', 
    marginBottom: 20 
  },
  successBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginBottom: 12 
  },
  successText: { 
    color: GREEN_COLOR, 
    fontSize: 14, 
    fontWeight: '600' 
  },
  currentTrackCard: { 
    backgroundColor: CARD_BG, 
    borderRadius: 16, 
    padding: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: GREEN_COLOR + '40' 
  },
  currentTrackImage: { 
    width: 80, 
    height: 80, 
    borderRadius: 8,
    backgroundColor: '#333',
  },
  currentTrackInfo: { 
    flex: 1, 
    marginLeft: 14 
  },
  currentTrackTitle: { 
    color: CYAN_COLOR, 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 4 
  },
  currentTrackArtist: { 
    color: '#fff', 
    fontSize: 14, 
    marginBottom: 4 
  },
  currentTrackAlbum: { 
    color: Colors.textMuted, 
    fontSize: 12 
  },

  // Identified Tracks List
  identifiedSection: { 
    width: '100%', 
    marginBottom: 20 
  },
  sectionTitle: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600', 
    marginBottom: 12, 
    alignSelf: 'flex-start' 
  },
  trackItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: CARD_BG, 
    padding: 12, 
    borderRadius: 12, 
    marginBottom: 8, 
    width: '100%' 
  },
  trackImage: { 
    width: 50, 
    height: 50, 
    borderRadius: 6,
    backgroundColor: '#333',
  },
  placeholderImage: { 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  trackInfo: { 
    flex: 1, 
    marginLeft: 12 
  },
  trackTitle: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: '500' 
  },
  trackArtist: { 
    color: Colors.textMuted, 
    fontSize: 12 
  },
  trackTime: { 
    color: Colors.textMuted, 
    fontSize: 11 
  },

  // Modal Styles
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.85)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  endSessionModalContent: { 
    backgroundColor: CARD_BG, 
    borderRadius: 20, 
    padding: 24, 
    width: '100%', 
    maxWidth: 400, 
    borderWidth: 1, 
    borderColor: CYAN_COLOR + '30' 
  },
  modalCloseButton: { 
    position: 'absolute', 
    top: 16, 
    right: 16, 
    zIndex: 10 
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
  venueCard: { 
    backgroundColor: '#252540', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: CYAN_COLOR + '30' 
  },
  venueHeader: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    marginBottom: 16 
  },
  venueDot: { 
    width: 12, 
    height: 12, 
    borderRadius: 6, 
    marginRight: 12, 
    marginTop: 4 
  },
  venueTextContainer: { 
    flex: 1 
  },
  venueName: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  venueCity: { 
    color: CYAN_COLOR, 
    fontSize: 13, 
    marginTop: 2 
  },
  correctLabel: { 
    color: '#888', 
    fontSize: 13, 
    marginBottom: 8 
  },
  venueInput: { 
    backgroundColor: '#1a1a2e', 
    borderRadius: 8, 
    padding: 12, 
    color: '#fff', 
    fontSize: 14, 
    borderWidth: 1, 
    borderColor: CYAN_COLOR + '30', 
    marginBottom: 12 
  },
  startedAtText: { 
    color: CYAN_COLOR, 
    fontSize: 13, 
    marginBottom: 6 
  },
  tracksCountRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  tracksCountText: { 
    color: '#888', 
    fontSize: 13 
  },
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
    gap: 12 
  },
  radioOptionSelected: { 
    borderWidth: 1, 
    borderColor: CYAN_COLOR 
  },
  radioCircle: { 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    borderWidth: 2, 
    borderColor: CYAN_COLOR 
  },
  radioCircleSelected: { 
    backgroundColor: CYAN_COLOR 
  },
  radioText: { 
    color: '#fff', 
    fontSize: 14,
    marginLeft: 12 
  },
  
  // Other DJ input
  otherDjContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  otherDjLabel: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 8,
  },
  otherDjInput: {
    backgroundColor: '#252540',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: CYAN_COLOR + '40',
  },
  
  warningBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255, 183, 77, 0.15)', 
    padding: 14, 
    borderRadius: 10, 
    marginTop: 10, 
    marginBottom: 10, 
    gap: 10 
  },
  warningText: { 
    color: '#FFB74D', 
    fontSize: 13, 
    flex: 1 
  },
  successBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(92, 179, 204, 0.15)', 
    padding: 14, 
    borderRadius: 10, 
    marginTop: 10, 
    marginBottom: 10, 
    gap: 10 
  },
  successBoxText: { 
    color: CYAN_COLOR, 
    fontSize: 13, 
    flex: 1,
    fontWeight: '600',
  },
  confirmEndButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: ORANGE_COLOR, 
    paddingVertical: 16, 
    borderRadius: 12, 
    marginTop: 10, 
    gap: 10 
  },
  confirmEndButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600' 
  },

  // Diamond Modal
  diamondModalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.9)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  diamondModalContent: { 
    alignItems: 'center', 
    padding: 40 
  },
  diamondIcon: { 
    width: 120, 
    height: 120, 
    borderRadius: 60, 
    backgroundColor: '#fff', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 30 
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
  
  // Sync Modal styles
  syncModalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  syncModalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  syncModalSubtitle: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  syncModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CYAN_COLOR,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    gap: 10,
    width: '100%',
    marginTop: 16,
  },
  syncModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  syncModalButtonSecondary: {
    paddingVertical: 12,
    marginTop: 8,
  },
  syncModalButtonTextSecondary: {
    color: '#888',
    fontSize: 14,
  },
  syncingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  syncingText: {
    color: CYAN_COLOR,
    fontSize: 16,
    marginTop: 16,
  },
  syncResultsContainer: {
    width: '100%',
    maxHeight: 350,
  },
  syncResultsTitle: {
    color: GREEN_COLOR,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  syncResultsList: {
    maxHeight: 250,
  },
  syncResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252540',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  syncResultImage: {
    width: 45,
    height: 45,
    borderRadius: 8,
  },
  placeholderImage: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncResultInfo: {
    flex: 1,
  },
  syncResultTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  syncResultArtist: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 2,
  },
  noResultsContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noResultsText: {
    color: '#FFB74D',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  noResultsSubtext: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
});
