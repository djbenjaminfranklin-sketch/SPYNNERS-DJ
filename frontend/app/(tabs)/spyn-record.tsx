/**
 * SPYN Record - Professional DJ Set Recording
 * Records high-quality audio from mixer input, analyzes tracks in real-time
 * Saves MP3 320kbps locally to device
 * Supports USB audio interfaces and offline mode
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ScrollView,
  Animated,
  Platform,
  SafeAreaView,
  StatusBar,
  Image,
  NativeModules,
  NativeEventEmitter,
  Modal,
  TextInput,
  Easing,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
// Import legacy FileSystem API for SDK 54 compatibility
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import offlineService from '../../src/services/offlineService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Colors
const CYAN_COLOR = '#00D4FF';
const PINK_COLOR = '#FF006E';
const ORANGE_COLOR = '#FF6B35';
const GREEN_COLOR = '#00FF88';
const PURPLE_COLOR = '#9D4EDD';
const DARK_BG = '#0a0a1a';

// Backend URL - use current origin on web, hardcoded for mobile
const getBackendUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://dj-spyn-dashboard.preview.emergentagent.com';
};
const BACKEND_URL = getBackendUrl();

// Recording settings for high quality
const RECORDING_OPTIONS = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 320000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: Audio.IOSAudioQuality.MAX,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 320000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm;codecs=opus',
    bitsPerSecond: 320000,
  },
};

// Analysis interval (every 10 seconds)
const ANALYSIS_INTERVAL = 10000;

interface IdentifiedTrack {
  id: string;
  title: string;
  artist: string;
  timestamp: string; // When it was detected in the recording
  elapsedTime: number; // Seconds from start
  coverImage?: string;
  spynnersTrackId?: string;
  producerId?: string;
}

interface WaveformBar {
  height: number;
  color: string;
}

export default function SpynRecordScreen() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  
  // Audio source state
  const [audioSource, setAudioSource] = useState<'internal' | 'external' | 'usb'>('internal');
  const [audioSourceName, setAudioSourceName] = useState<string>('Microphone interne');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isCheckingUSB, setIsCheckingUSB] = useState(false);
  
  // Offline state
  const [isOffline, setIsOffline] = useState(false);
  const [offlineSessionId, setOfflineSessionId] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  
  // Track if we successfully made API calls (proves we're online)
  const hasSuccessfulApiCallRef = useRef(false);
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [identifiedTracks, setIdentifiedTracks] = useState<IdentifiedTrack[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<string>('');
  
  // End Session Modal state
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [correctedVenue, setCorrectedVenue] = useState('');
  const [whoPlayed, setWhoPlayed] = useState<'me' | 'another' | null>(null);
  const [otherDjName, setOtherDjName] = useState('');
  const [saveMix, setSaveMix] = useState(true);
  const [sessionFileUri, setSessionFileUri] = useState<string>('');
  const [sessionStartTime, setSessionStartTime] = useState<string>('');
  
  // Location state
  const [location, setLocation] = useState<{
    latitude?: number;
    longitude?: number;
    venue?: string;
    city?: string;
    country?: string;
    venue_type?: string;
    is_valid_venue?: boolean;
  } | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  
  // Diamond modal
  const [showDiamondModal, setShowDiamondModal] = useState(false);
  const diamondRotate = useRef(new Animated.Value(0)).current;
  
  // Waveform
  const [waveformData, setWaveformData] = useState<WaveformBar[]>([]);
  
  // Refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingSegmentsRef = useRef<string[]>([]); // Store all recording segment URIs for native
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const waveformIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  // Reference for USB check interval
  const usbCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Request permissions and detect audio sources on mount
  useEffect(() => {
    requestPermissions();
    detectAudioSources();
    initOfflineService();
    requestLocationPermission();
    
    // Listen for device changes (plug/unplug)
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', detectAudioSources);
    }
    
    // Periodically check for USB on mobile (only when not recording)
    usbCheckIntervalRef.current = setInterval(() => {
      if (Platform.OS !== 'web' && !isRecordingRef.current) {
        detectAudioSources();
      }
    }, 5000); // Check every 5 seconds
    
    return () => {
      cleanup();
      if (usbCheckIntervalRef.current) {
        clearInterval(usbCheckIntervalRef.current);
      }
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener('devicechange', detectAudioSources);
      }
    };
  }, []);

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
      console.error('[SPYN Record] Location permission error:', error);
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
      
      // Valid venue types for Black Diamond
      const VALID_VENUE_TYPES = [
        'night_club', 'bar', 'restaurant', 'cafe', 'casino',
        'establishment', 'food', 'point_of_interest', 'event_venue',
        'nightclub', 'club', 'lounge', 'pub', 'disco'
      ];
      
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
        console.log('[SPYN Record] Places lookup failed, using reverse geocoding');
      }
      
      // Get address via reverse geocoding
      const [address] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      
      const newLocation = {
        latitude: lat,
        longitude: lng,
        venue: venueName || address?.name || address?.street || undefined,
        city: address?.city || address?.region || undefined,
        country: address?.country || undefined,
        venue_type: venueType,
        is_valid_venue: isValidVenue,
      };
      
      console.log('[SPYN Record] Location updated:', newLocation);
      setLocation(newLocation);
      setCorrectedVenue(newLocation.venue || '');
      setLocationLoading(false);
    } catch (error) {
      console.error('[SPYN Record] Location update error:', error);
      setLocationLoading(false);
    }
  };

  // Initialize offline service - SIMPLIFIED
  const initOfflineService = async () => {
    // ALWAYS start in ONLINE mode - we'll only go offline if API calls fail
    console.log('[SPYN Record] Init: Starting in ONLINE mode by default');
    setIsOffline(false);
    
    try {
      // Check for pending sessions silently
      const pendingCount = await offlineService.getPendingCount();
      setPendingSyncCount(pendingCount);
    } catch (error) {
      console.log('[SPYN Record] Could not check pending sessions:', error);
    }
  };

  // Check for pending sessions to sync
  const checkPendingSessions = async () => {
    try {
      const pendingCount = await offlineService.getPendingCount();
      setPendingSyncCount(pendingCount);
      
      if (pendingCount > 0 && !isOffline) {
        Alert.alert(
          'Sessions en attente',
          `Vous avez ${pendingCount} session(s) à synchroniser. Voulez-vous les synchroniser maintenant ?`,
          [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Synchroniser', onPress: syncAllOfflineSessions }
          ]
        );
      }
    } catch (error) {
      console.error('[SPYN Record] Error checking pending sessions:', error);
    }
  };

  // Sync all offline sessions
  const syncAllOfflineSessions = async () => {
    try {
      setCurrentAnalysis('Synchronisation en cours...');
      const result = await offlineService.syncPendingSessions(token || '');
      
      if (result.synced > 0) {
        Alert.alert('Succès', `${result.synced} session(s) synchronisée(s) !`);
      }
      if (result.failed > 0) {
        Alert.alert('Attention', `${result.failed} session(s) ont échoué. Réessayez plus tard.`);
      }
      
      // Update pending count
      const pendingCount = await offlineService.getPendingCount();
      setPendingSyncCount(pendingCount);
    } catch (error) {
      console.error('[SPYN Record] Sync error:', error);
      Alert.alert('Erreur', 'Impossible de synchroniser les sessions.');
    } finally {
      setCurrentAnalysis('');
    }
  };

  // Sync single offline session (legacy support)
  const syncOfflineSession = async () => {
    await syncAllOfflineSessions();
  };

  // Detect available audio input devices
  const detectAudioSources = async () => {
    // Skip detection if we're currently recording
    if (isRecording || isRecordingRef.current) {
      console.log('[SPYN Record] Skipping audio source detection during recording');
      return;
    }
    
    try {
      setIsCheckingUSB(true);
      
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
        // Web: Use standard Web Audio API
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          tempStream.getTracks().forEach(track => track.stop());
        } catch (e) {
          console.log('[SPYN Record] Permission needed for device detection');
        }
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        console.log('[SPYN Record] Available audio inputs:', audioInputs);
        setAvailableDevices(audioInputs);
        
        // Detect external/USB device
        const externalDevice = audioInputs.find(device => {
          const label = device.label.toLowerCase();
          return (
            label.includes('usb') ||
            label.includes('interface') ||
            label.includes('mixer') ||
            label.includes('audio in') ||
            label.includes('line in') ||
            label.includes('external') ||
            label.includes('scarlett') ||
            label.includes('focusrite') ||
            label.includes('behringer') ||
            label.includes('native instruments') ||
            label.includes('pioneer') ||
            label.includes('denon') ||
            label.includes('allen') ||
            label.includes('mackie') ||
            label.includes('presonus') ||
            label.includes('steinberg') ||
            label.includes('motu') ||
            label.includes('apogee') ||
            label.includes('universal audio') ||
            label.includes('roland') ||
            label.includes('yamaha') ||
            label.includes('soundcraft') ||
            label.includes('irig') ||
            label.includes('lightning') ||
            (device.deviceId !== 'default' && !label.includes('built-in') && !label.includes('internal'))
          );
        });
        
        if (externalDevice) {
          const isUSB = externalDevice.label.toLowerCase().includes('usb');
          setAudioSource(isUSB ? 'usb' : 'external');
          setAudioSourceName(externalDevice.label || 'Source externe détectée');
          setSelectedDeviceId(externalDevice.deviceId);
          console.log('[SPYN Record] ✅ External audio source detected:', externalDevice.label);
        } else if (audioInputs.length > 0) {
          const defaultDevice = audioInputs.find(d => d.deviceId === 'default') || audioInputs[0];
          setAudioSource('internal');
          setAudioSourceName(defaultDevice.label || 'Microphone');
          setSelectedDeviceId(defaultDevice.deviceId);
        }
      } else {
        // Native (iOS/Android) - iOS automatically routes audio through connected devices
        // No need for test recording - just check if we have permission and inform user
        try {
          const status = await Audio.getPermissionsAsync();
          
          if (status.granted) {
            console.log('[SPYN Record] Audio permission granted - iOS will auto-route external devices');
            // On iOS, when a USB/Lightning audio interface is connected, 
            // the system automatically uses it as the input source
            setAudioSource('internal');
            setAudioSourceName('Source audio (auto iOS)');
            console.log('[SPYN Record] iOS audio routing active - external devices will be used automatically if connected');
          } else {
            setAudioSource('internal');
            setAudioSourceName('Microphone (permission requise)');
          }
        } catch (error) {
          console.log('[SPYN Record] Native audio detection error:', error);
          setAudioSource('internal');
          setAudioSourceName('Source audio détectée automatiquement');
        }
      }
    } catch (error) {
      console.error('[SPYN Record] Error detecting audio sources:', error);
    } finally {
      setIsCheckingUSB(false);
    }
  };

  const requestPermissions = async () => {
    try {
      // Audio permission
      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      
      // Media library permission (to save files)
      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
      
      if (audioStatus === 'granted') {
        setHasPermission(true);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });
      } else {
        Alert.alert('Permission requise', 'L\'accès au microphone est nécessaire pour enregistrer.');
      }
    } catch (error) {
      console.error('Permission error:', error);
    }
  };

  const cleanup = () => {
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
    if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  // Start pulse animation when recording
  useEffect(() => {
    if (isRecording && !isPaused) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, isPaused]);

  // Format duration as HH:MM:SS
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate waveform data from audio analysis
  const updateWaveform = useCallback(() => {
    // For web: use Web Audio API analyser
    if (Platform.OS === 'web' && analyserRef.current) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Sample 40 bars from the frequency data
      const bars: WaveformBar[] = [];
      const step = Math.floor(bufferLength / 40);
      
      for (let i = 0; i < 40; i++) {
        const value = dataArray[i * step] || 0;
        const normalizedHeight = (value / 255) * 100;
        
        // Color based on intensity
        let color = CYAN_COLOR;
        if (normalizedHeight > 70) color = PINK_COLOR;
        else if (normalizedHeight > 50) color = ORANGE_COLOR;
        else if (normalizedHeight > 30) color = GREEN_COLOR;
        
        bars.push({ height: Math.max(5, normalizedHeight), color });
      }
      
      setWaveformData(bars);
    } else if (isRecordingRef.current && !isPaused) {
      // For native mobile: Generate animated waveform based on recording status
      // This provides visual feedback even though we can't access real audio data
      const bars: WaveformBar[] = [];
      const time = Date.now() / 1000;
      
      for (let i = 0; i < 40; i++) {
        // Create a wave pattern that looks like real audio
        const wave1 = Math.sin(time * 2 + i * 0.3) * 30;
        const wave2 = Math.sin(time * 3.5 + i * 0.2) * 20;
        const wave3 = Math.sin(time * 1.2 + i * 0.5) * 15;
        const noise = Math.random() * 15;
        
        // Combine waves for more natural look
        const baseHeight = 25 + wave1 + wave2 + wave3 + noise;
        const height = Math.max(8, Math.min(85, baseHeight));
        
        // Color based on intensity
        let color = CYAN_COLOR;
        if (height > 65) color = PINK_COLOR;
        else if (height > 50) color = ORANGE_COLOR;
        else if (height > 35) color = GREEN_COLOR;
        
        bars.push({ height, color });
      }
      
      setWaveformData(bars);
    } else {
      // Not recording - show static low bars
      const bars: WaveformBar[] = [];
      for (let i = 0; i < 40; i++) {
        bars.push({ height: 5, color: CYAN_COLOR });
      }
      setWaveformData(bars);
    }
  }, [isPaused]);

  // Start recording
  const startRecording = async () => {
    try {
      console.log('[SPYN Record] Starting recording... Platform:', Platform.OS);
      
      if (Platform.OS === 'web') {
        await startWebRecording();
      } else {
        await startNativeRecording();
      }
      
      setIsRecording(true);
      isRecordingRef.current = true; // Also update ref for closures
      setIsPaused(false);
      startTimeRef.current = Date.now();
      setIdentifiedTracks([]);
      identifiedTracksRef.current = [];
      
      // Reset sent emails tracker for new session
      sentEmailsRef.current.clear();
      
      // Reset API call tracker for new session
      hasSuccessfulApiCallRef.current = false;
      
      console.log('[SPYN Record] Reset trackers for new session');
      
      // Set session start time for display
      const now = new Date();
      setSessionStartTime(now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      
      // Reset recording segments for native platforms
      recordingSegmentsRef.current = [];
      
      // Update location in background when starting
      if (locationPermission) {
        updateLocation();
      }
      
      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingDuration(elapsed);
      }, 1000);
      
      // Start waveform updates
      waveformIntervalRef.current = setInterval(updateWaveform, 100);
      
      // Start periodic analysis during recording (every 30 seconds)
      // This allows tracks to be identified and displayed in real-time
      analysisIntervalRef.current = setInterval(() => {
        console.log('[SPYN Record] Periodic analysis trigger');
        analyzeCurrentAudio();
      }, 30000); // Analyze every 30 seconds
      
      // Do an initial analysis after 15 seconds
      setTimeout(() => {
        if (isRecordingRef.current) {
          console.log('[SPYN Record] Initial analysis after 15 seconds');
          analyzeCurrentAudio();
        }
      }, 15000);
      
      // Simple continuous recording - with periodic analysis
      console.log('[SPYN Record] Recording mode: Continuous with periodic analysis (every 30s)');
      console.log('[SPYN Record] ✅ Recording started successfully');
      
    } catch (error) {
      console.error('[SPYN Record] Start error:', error);
      Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement');
    }
  };

  const startWebRecording = async () => {
    try {
      console.log('[SPYN Record] 🎙️ Starting web recording...');
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported in this browser');
      }
      
      // Build audio constraints with selected device if available
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      };
      
      // Use selected external device if available
      if (selectedDeviceId && selectedDeviceId !== 'default') {
        audioConstraints.deviceId = { exact: selectedDeviceId };
        console.log('[SPYN Record] Using specific device:', selectedDeviceId);
      }
      
      console.log('[SPYN Record] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: audioConstraints
      });
      console.log('[SPYN Record] ✅ Microphone access granted!');
      
      mediaStreamRef.current = stream;
      
      // Log the actual device being used
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const settings = audioTrack.getSettings();
        console.log('[SPYN Record] ✅ Recording from:', audioTrack.label);
        console.log('[SPYN Record] Audio settings:', settings);
        
        // Update UI with actual source
        if (audioTrack.label) {
          const label = audioTrack.label.toLowerCase();
          if (label.includes('usb') || label.includes('interface') || label.includes('external') ||
              label.includes('line') || label.includes('mixer') || !label.includes('built-in')) {
            setAudioSource('external');
            setAudioSourceName(audioTrack.label);
          } else {
            setAudioSource('internal');
            setAudioSourceName(audioTrack.label);
          }
        }
      }
      
      // Setup audio analyser for waveform
      try {
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
        console.log('[SPYN Record] ✅ Audio analyser set up');
      } catch (analyserError) {
        console.warn('[SPYN Record] Could not set up analyser:', analyserError);
      }
      
      // Setup MediaRecorder with best available codec
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      }
      console.log('[SPYN Record] Using mimeType:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('[SPYN Record] Audio chunk received, size:', event.data.size, 'Total chunks:', audioChunksRef.current.length);
        }
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('[SPYN Record] MediaRecorder error:', event);
      };
      
      mediaRecorder.onstart = () => {
        console.log('[SPYN Record] ✅ MediaRecorder started!');
      };
      
      mediaRecorder.start(1000); // Collect data every second
      mediaRecorderRef.current = mediaRecorder;
      
      console.log('[SPYN Record] ✅ Web recording initialized successfully');
    } catch (error: any) {
      console.error('[SPYN Record] ❌ Web recording error:', error);
      if (error.name === 'NotAllowedError') {
        Alert.alert('Permission refusée', 'Vous devez autoriser l\'accès au microphone pour enregistrer.');
      } else if (error.name === 'NotFoundError') {
        Alert.alert('Microphone non trouvé', 'Aucun microphone n\'a été détecté.');
      } else {
        Alert.alert('Erreur', `Impossible d'accéder au microphone: ${error.message}`);
      }
      throw error;
    }
  };

  const startNativeRecording = async () => {
    try {
      console.log('[SPYN Record] Starting native recording...');
      
      // Request permissions first
      console.log('[SPYN Record] Requesting audio permissions...');
      const { granted } = await Audio.requestPermissionsAsync();
      console.log('[SPYN Record] Permission result:', granted);
      
      if (!granted) {
        console.log('[SPYN Record] Audio permission not granted');
        Alert.alert('Permission requise', 'L\'accès au microphone est nécessaire');
        throw new Error('Permission not granted');
      }
      
      // Set audio mode for recording - same as SPYN
      console.log('[SPYN Record] Setting audio mode...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      console.log('[SPYN Record] Audio mode set successfully');
      
      // Use the modern API - createAsync with HIGH_QUALITY preset (same as SPYN)
      console.log('[SPYN Record] Creating recording...');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      
      console.log('[SPYN Record] ✅ Native recording started successfully, recording object:', !!recording);
    } catch (error: any) {
      console.error('[SPYN Record] ❌ Native recording error:', error?.message || error);
      Alert.alert('Erreur', `Impossible de démarrer l'enregistrement: ${error?.message || 'Erreur inconnue'}`);
      throw error;
    }
  };

  // Reference to track if analysis is in progress
  const isAnalyzingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const identifiedTracksRef = useRef<IdentifiedTrack[]>([]);
  
  // Track emails already sent to prevent duplicates
  const sentEmailsRef = useRef<Set<string>>(new Set());

  // Update ref when state changes
  useEffect(() => {
    identifiedTracksRef.current = identifiedTracks;
  }, [identifiedTracks]);

  // Analyze current audio segment
  const analyzeCurrentAudio = async () => {
    console.log('[SPYN Record] analyzeCurrentAudio called, isRecording:', isRecordingRef.current, 'isPaused:', isPaused, 'isAnalyzing:', isAnalyzingRef.current);
    
    if (!isRecordingRef.current || isPaused) {
      console.log('[SPYN Record] Skipping analysis - not recording or paused');
      return;
    }
    if (isAnalyzingRef.current) {
      console.log('[SPYN Record] Analysis already in progress, skipping...');
      return;
    }
    
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    setCurrentAnalysis('Analyse en cours...');
    console.log('[SPYN Record] 🔍 Starting analysis...');
    
    try {
      let audioBase64 = '';
      
      if (Platform.OS === 'web') {
        console.log('[SPYN Record] Web platform - getting audio chunks. Total chunks:', audioChunksRef.current.length);
        // Get recent audio chunk for analysis
        if (audioChunksRef.current.length > 0) {
          // Take last 10 seconds of audio (last 10 chunks)
          const recentChunks = audioChunksRef.current.slice(-10);
          console.log('[SPYN Record] Using', recentChunks.length, 'chunks for analysis');
          const blob = new Blob(recentChunks, { type: 'audio/webm' });
          console.log('[SPYN Record] Blob created, size:', blob.size);
          
          audioBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1];
              console.log('[SPYN Record] Base64 created, length:', base64?.length || 0);
              resolve(base64 || '');
            };
            reader.onerror = (e) => {
              console.error('[SPYN Record] FileReader error:', e);
              reject(e);
            };
            reader.readAsDataURL(blob);
          });
        }
      } else {
        // NATIVE (iOS/Android): Stop, read, restart with proper delays
        console.log('[SPYN Record] Native analysis starting...');
        
        const currentRecording = recordingRef.current;
        if (currentRecording) {
          try {
            // 1. Stop current recording
            console.log('[SPYN Record] Stopping recording...');
            await currentRecording.stopAndUnloadAsync();
            const uri = currentRecording.getURI();
            console.log('[SPYN Record] Recording stopped, URI:', uri);
            
            // Clear the ref immediately
            recordingRef.current = null;
            
            // 2. Wait for iOS to release audio session
            await new Promise(resolve => setTimeout(resolve, 200));
            
            if (uri) {
              // Save for final concatenation
              recordingSegmentsRef.current.push(uri);
              
              // 3. Read audio file
              try {
                const response = await fetch(uri);
                const blob = await response.blob();
                audioBase64 = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const result = reader.result as string;
                    resolve(result.split(',')[1] || '');
                  };
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
                console.log('[SPYN Record] Audio read, length:', audioBase64.length);
              } catch (readErr) {
                console.error('[SPYN Record] Read error:', readErr);
              }
            }
            
            // 4. Restart recording if still in recording mode
            if (isRecordingRef.current) {
              console.log('[SPYN Record] Restarting recording...');
              try {
                await Audio.setAudioModeAsync({
                  allowsRecordingIOS: true,
                  playsInSilentModeIOS: true,
                });
                
                // Small delay before creating new recording
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const { recording: newRecording } = await Audio.Recording.createAsync(
                  Audio.RecordingOptionsPresets.HIGH_QUALITY
                );
                recordingRef.current = newRecording;
                console.log('[SPYN Record] Recording restarted successfully');
              } catch (restartErr) {
                console.error('[SPYN Record] Restart error:', restartErr);
                // If restart fails, stop the session
                setIsRecording(false);
                isRecordingRef.current = false;
                Alert.alert('Erreur', 'Impossible de continuer l\'enregistrement. Session sauvegardée.');
              }
            }
          } catch (err) {
            console.error('[SPYN Record] Recording cycle error:', err);
          }
        }
      }
      
      // Send for analysis if we have audio
      if (audioBase64 && audioBase64.length > 0) {
        console.log('[SPYN Record] Sending audio for analysis, length:', audioBase64.length);
        
        // ALWAYS try to send to backend first - only go offline if it fails
        try {
          // Online mode - send to backend
          console.log('[SPYN Record] Sending audio to backend for recognition...');
          
          // Send to backend for recognition
          const response = await axios.post(`${BACKEND_URL}/api/recognize-audio`, {
            audio_base64: audioBase64,
          }, {
            timeout: 30000,
          });
          
          // Mark that we successfully made an API call (proves we're online!)
          hasSuccessfulApiCallRef.current = true;
          console.log('[SPYN Record] ✅ API call successful - we are ONLINE');
          
          console.log('[SPYN Record] Recognition response:', response.data);
          
          if (response.data.success && response.data.title) {
            const elapsedTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
            
            // IMPROVED DEDUPLICATION: Normalize title for comparison
            // Remove extra spaces, special characters, and convert to lowercase
            const normalizeTitle = (title: string) => {
              return title
                .toLowerCase()
                .replace(/[^\w\s]/g, '') // Remove special characters
                .replace(/\s+/g, ' ')    // Normalize spaces
                .trim();
            };
            
            const normalizedNewTitle = normalizeTitle(response.data.title);
            const normalizedNewArtist = response.data.artist ? normalizeTitle(response.data.artist) : '';
            
            // Check if this track (by normalized title AND artist) was already identified
            const isDuplicate = identifiedTracksRef.current.some(t => {
              const existingTitle = normalizeTitle(t.title);
              const existingArtist = normalizeTitle(t.artist || '');
              
              // Match if title is the same, or if both title and artist match closely
              return existingTitle === normalizedNewTitle || 
                     (existingTitle.includes(normalizedNewTitle) || normalizedNewTitle.includes(existingTitle));
            });
            
            console.log('[SPYN Record] Dedup check:', {
              newTitle: response.data.title,
              normalizedNewTitle,
              existingTracks: identifiedTracksRef.current.map(t => t.title),
              isDuplicate
            });
            
            if (!isDuplicate) {
              const newTrack: IdentifiedTrack = {
                id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                title: response.data.title,
                artist: response.data.artist || 'Unknown Artist',
                timestamp: formatDuration(elapsedTime),
                elapsedTime,
                coverImage: response.data.cover_image,
                spynnersTrackId: response.data.spynners_track_id,
                producerId: response.data.producer_id,
              };
              
              // Update ref FIRST to prevent race conditions
              identifiedTracksRef.current = [...identifiedTracksRef.current, newTrack];
              
              // Force UI update with functional setState
              setIdentifiedTracks(prevTracks => {
                const updatedTracks = [...prevTracks, newTrack];
                console.log('[SPYN Record] UI State updated, total tracks:', updatedTracks.length);
                return updatedTracks;
              });
              
              setCurrentAnalysis(`✅ ${response.data.title}`);
              
              console.log('[SPYN Record] ✅ NEW Track identified:', newTrack.title, '- Total:', identifiedTracksRef.current.length);
              
              // Send email immediately to the producer
              sendEmailForTrack(newTrack);
            } else {
              setCurrentAnalysis(`⏭️ Déjà identifié`);
              console.log('[SPYN Record] Track already identified, skipping:', response.data.title);
            }
          } else {
            setCurrentAnalysis('Aucun track détecté');
            console.log('[SPYN Record] No track detected in audio sample');
          }
        } catch (apiError: any) {
          // API call failed - this could mean we're truly offline
          console.error('[SPYN Record] API call failed:', apiError?.message);
          setCurrentAnalysis('Erreur de connexion');
        }
      } else {
        setCurrentAnalysis('Pas d\'audio à analyser');
        console.log('[SPYN Record] No audio data to analyze');
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Unknown error';
      console.error('[SPYN Record] Analysis error:', errorMessage);
      console.error('[SPYN Record] Full error:', JSON.stringify(error?.response?.data || error, null, 2));
      setCurrentAnalysis(`Erreur: ${errorMessage.substring(0, 50)}`);
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
      setTimeout(() => setCurrentAnalysis(''), 3000);
    }
  };

  // Send email immediately for a single track
  const sendEmailForTrack = async (track: IdentifiedTrack) => {
    // Create a unique key for this track
    const trackKey = `${track.title.toLowerCase()}_${(track.artist || '').toLowerCase()}`.replace(/\s+/g, '_');
    
    // Check if email was already sent for this track in this session
    if (sentEmailsRef.current.has(trackKey)) {
      console.log(`[SPYN Record] 📧 Email already sent for ${track.title} - skipping duplicate`);
      return;
    }
    
    // IMPORTANT: Only send email if we're at a valid venue (club, bar, restaurant, etc.)
    if (!location?.is_valid_venue) {
      console.log(`[SPYN Record] 📧 Skipping email for ${track.title} - not at a valid venue (home or unknown location)`);
      return;
    }
    
    // Need either producerId or spynnersTrackId to send email
    if (!track.spynnersTrackId && !track.producerId) {
      console.log(`[SPYN Record] Skipping email for ${track.title} - no track ID or producer ID`);
      return;
    }
    
    if (!token) {
      console.log('[SPYN Record] No auth token, skipping email');
      return;
    }
    
    // Mark as sent BEFORE attempting to prevent race conditions
    sentEmailsRef.current.add(trackKey);
    
    try {
      const djName = user?.full_name || 'DJ';
      
      console.log(`[SPYN Record] 📧 Sending email for: ${track.title} at venue: ${location?.venue}, trackId: ${track.spynnersTrackId}, producerId: ${track.producerId}`);
      
      // Format expected by Spynners API
      const emailPayload = {
        trackId: track.spynnersTrackId,
        producerId: track.producerId,
        trackTitle: track.title || 'Unknown Track',
        artistName: track.artist || 'Unknown Artist',
        djName: djName,
        djAvatar: user?.avatar || '',
        playedAt: new Date().toISOString(),
        trackArtworkUrl: track.coverImage || '',
        venue: location?.venue || 'Unknown Venue',
      };
      
      console.log('[SPYN Record] Email payload:', JSON.stringify(emailPayload));
      
      // Call Spynners API directly instead of going through backend proxy
      const response = await axios.post(
        'https://spynners.com/api/functions/sendTrackPlayedEmail',
        emailPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000, // 30 seconds timeout
        }
      );
      
      console.log(`[SPYN Record] ✅ Email sent for: ${track.title}`, response.data);
    } catch (e: any) {
      console.log(`[SPYN Record] ❌ Email error for: ${track.title}`, e?.response?.data || e.message);
      // Don't remove from sentEmailsRef on error to prevent retry spam
    }
  };

  // Handle stop button press - show End Session Modal
  const handleStopButtonPress = async () => {
    console.log('[SPYN Record] Stop button pressed - showing End Session Modal');
    
    // Stop timers but don't process yet
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
    if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
    
    // Stop the actual recording and get the file
    let fileUri = '';
    
    try {
      if (Platform.OS === 'web') {
        fileUri = await stopWebRecording();
      } else {
        fileUri = await stopNativeRecording();
      }
      console.log('[SPYN Record] Recording file saved:', fileUri);
    } catch (error) {
      console.error('[SPYN Record] Error stopping recording:', error);
    }
    
    // Update refs
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsPaused(false);
    
    // Store the file URI for later processing
    setSessionFileUri(fileUri);
    
    // Show the End Session Modal
    setShowEndSessionModal(true);
  };

  // Confirm end session and process
  const confirmEndSession = async () => {
    try {
      console.log('[SPYN Record] Processing end session...');
      setShowEndSessionModal(false);
      setCurrentAnalysis('Analyse en cours...');
      
      let audioBase64ForAnalysis = '';
      const fileUri = sessionFileUri;
      
      // Read audio for analysis
      if (fileUri) {
        if (Platform.OS === 'web') {
          if (audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            audioBase64ForAnalysis = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1] || '');
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }
        } else {
          try {
            console.log('[SPYN Record] Reading final file with LegacyFileSystem...');
            audioBase64ForAnalysis = await LegacyFileSystem.readAsStringAsync(fileUri, {
              encoding: LegacyFileSystem.EncodingType.Base64,
            });
            console.log('[SPYN Record] ✅ Audio read for analysis, length:', audioBase64ForAnalysis.length);
          } catch (readError: any) {
            console.error('[SPYN Record] ❌ Error reading audio:', readError?.message || readError);
            if (!fileUri.startsWith('file://')) {
              try {
                const fileUriWithPrefix = `file://${fileUri}`;
                audioBase64ForAnalysis = await LegacyFileSystem.readAsStringAsync(fileUriWithPrefix, {
                  encoding: LegacyFileSystem.EncodingType.Base64,
                });
              } catch (prefixError) {
                console.error('[SPYN Record] ❌ Read with prefix also failed:', prefixError);
              }
            }
          }
        }
      }
      
      // Analyze the recording
      setCurrentAnalysis('Analyse de la session...');
      const detectedTracks: IdentifiedTrack[] = [];
      const detectedTitles = new Set<string>();
      
      if (audioBase64ForAnalysis && audioBase64ForAnalysis.length > 0) {
        console.log('[SPYN Record] Analyzing audio, length:', audioBase64ForAnalysis.length);
        
        try {
          const response = await axios.post(`${BACKEND_URL}/api/recognize-audio`, {
            audio_base64: audioBase64ForAnalysis,
          }, {
            timeout: 60000,
          });
          
          console.log('[SPYN Record] Analysis response:', response.data);
          
          if (response.data.success && response.data.title) {
            const trackKey = response.data.title.toLowerCase();
            if (!detectedTitles.has(trackKey)) {
              detectedTitles.add(trackKey);
              
              const newTrack: IdentifiedTrack = {
                id: `${Date.now()}`,
                title: response.data.title,
                artist: response.data.artist || 'Unknown Artist',
                timestamp: formatDuration(recordingDuration),
                elapsedTime: recordingDuration,
                coverImage: response.data.cover_image,
                spynnersTrackId: response.data.spynners_track_id,
                producerId: response.data.producer_id,
              };
              
              detectedTracks.push(newTrack);
              setIdentifiedTracks(prev => [...prev, newTrack]);
              setCurrentAnalysis(`✅ ${response.data.title}`);
              
              sendEmailForTrack(newTrack);
              console.log('[SPYN Record] ✅ Track identified:', newTrack.title);
            }
          } else {
            console.log('[SPYN Record] No track detected in response');
          }
        } catch (analysisError: any) {
          console.error('[SPYN Record] Analysis error:', analysisError?.message || analysisError);
          setCurrentAnalysis('Erreur d\'analyse');
        }
      }
      
      const allTracks = [...identifiedTracks, ...detectedTracks];
      
      // Award Black Diamond if valid venue
      const isValidVenue = location?.is_valid_venue === true;
      const canEarnDiamond = allTracks.length > 0 && isValidVenue && !isOffline;
      
      if (canEarnDiamond) {
        console.log('[SPYN Record] Valid venue detected, awarding Black Diamond...');
        try {
          const awardResponse = await axios.post(
            `${BACKEND_URL}/api/award-diamond`,
            { 
              user_id: user?.id,
              type: 'black',
              reason: 'spyn_record_session',
              venue: correctedVenue || location?.venue,
              venue_type: location?.venue_type,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          if (awardResponse.data.success && !awardResponse.data.already_awarded) {
            console.log('[SPYN Record] Black Diamond awarded!');
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
            }, 3000);
          }
        } catch (e) {
          console.log('[SPYN Record] Could not award diamond:', e);
        }
      }
      
      // Save session - ONLINE or OFFLINE depending on connection status
      setCurrentAnalysis('Sauvegarde de la session...');
      try {
        const sessionData = {
          id: `session_${Date.now()}`,
          userId: user?.id || 'unknown',
          djName: whoPlayed === 'another' ? otherDjName : (user?.full_name || 'DJ'),
          duration: recordingDuration,
          recordedAt: new Date().toISOString(),
          tracks: allTracks.map(t => ({
            title: t.title,
            artist: t.artist,
            timestamp: t.timestamp,
            coverImage: t.coverImage,
            spynnersTrackId: t.spynnersTrackId,
            producerId: t.producerId,
          })),
          audioUri: fileUri,
          venue: correctedVenue || location?.venue,
          city: location?.city,
          country: location?.country,
        };
        
        // SIMPLIFIED: Never save to offline storage
        // If we got here, we successfully communicated with the backend
        // Just log the session data
        console.log('[SPYN Record] Session completed - not saving to offline storage');
        console.log('[SPYN Record] Session data:', JSON.stringify(sessionData, null, 2));
        
        // TODO: In the future, send session to Spynners API here
        
        console.log('[SPYN Record] Session saved successfully');
        
        // Save the mix if requested
        if (saveMix && fileUri) {
          setCurrentAnalysis('Préparation du mix pour sauvegarde...');
          await saveRecording(fileUri);
        }
        
        // Reset state
        setCurrentAnalysis('');
        setIdentifiedTracks([]);
        identifiedTracksRef.current = [];
        recordingSegmentsRef.current = [];
        setRecordingDuration(0);
        setSessionFileUri('');
        setWhoPlayed(null);
        setOtherDjName('');
        setSaveMix(true);
        
        // Show completion alert
        Alert.alert(
          '🎉 Session terminée !',
          `Durée: ${formatDuration(recordingDuration)}\nTracks identifiés: ${allTracks.length}${saveMix ? '\n\n📁 Le mix a été préparé pour la sauvegarde.' : ''}`,
          [{ text: 'OK' }]
        );
        
      } catch (saveError) {
        console.error('[SPYN Record] Error saving session:', saveError);
        Alert.alert('Erreur', 'Impossible de sauvegarder la session');
      }
      
    } catch (error) {
      console.error('[SPYN Record] Stop error:', error);
      Alert.alert('Erreur', 'Erreur lors de l\'arrêt de l\'enregistrement');
    }
  };

  // Legacy stopRecording function - now redirects to handleStopButtonPress
  const stopRecording = () => {
    handleStopButtonPress();
  };

  const stopWebRecording = async (): Promise<string> => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          
          // Clean up
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
          }
          if (audioContextRef.current) {
            audioContextRef.current.close();
          }
          
          resolve(url);
        };
        
        mediaRecorderRef.current.stop();
      } else {
        resolve('');
      }
    });
  };

  const stopNativeRecording = async (): Promise<string> => {
    if (recordingRef.current) {
      // Stop the final recording segment
      await recordingRef.current.stopAndUnloadAsync();
      const finalUri = recordingRef.current.getURI();
      recordingRef.current = null;
      
      // Add the final segment to our collection
      if (finalUri) {
        recordingSegmentsRef.current.push(finalUri);
      }
      
      console.log('[SPYN Record] Total recording segments:', recordingSegmentsRef.current.length);
      
      // If we have multiple segments, we need to concatenate them
      if (recordingSegmentsRef.current.length > 1) {
        console.log('[SPYN Record] Concatenating', recordingSegmentsRef.current.length, 'segments...');
        
        try {
          // Read all segments as base64
          const segmentData: string[] = [];
          for (const segmentUri of recordingSegmentsRef.current) {
            try {
              const base64Data = await LegacyFileSystem.readAsStringAsync(segmentUri, {
                encoding: LegacyFileSystem.EncodingType.Base64,
              });
              segmentData.push(base64Data);
              console.log('[SPYN Record] Read segment:', segmentUri, 'size:', base64Data.length);
            } catch (readError) {
              console.error('[SPYN Record] Error reading segment:', segmentUri, readError);
            }
          }
          
          if (segmentData.length > 0) {
            // Send all segments to backend for concatenation
            console.log('[SPYN Record] Sending', segmentData.length, 'segments to backend for concatenation...');
            
            const response = await axios.post(`${BACKEND_URL}/api/concatenate-audio`, {
              audio_segments: segmentData,
              output_format: 'm4a'
            }, {
              timeout: 180000, // 3 minutes timeout for large concatenations
            });
            
            if (response.data.success) {
              console.log('[SPYN Record] Concatenation successful, size:', response.data.size);
              
              // Save the concatenated audio file
              const cacheDir = LegacyFileSystem.cacheDirectory || '';
              const concatenatedPath = `${cacheDir}concatenated_mix_${Date.now()}.m4a`;
              
              await LegacyFileSystem.writeAsStringAsync(concatenatedPath, response.data.audio_base64, {
                encoding: LegacyFileSystem.EncodingType.Base64,
              });
              
              console.log('[SPYN Record] Concatenated file saved to:', concatenatedPath);
              
              // Clean up individual segments
              for (const segmentUri of recordingSegmentsRef.current) {
                try {
                  await LegacyFileSystem.deleteAsync(segmentUri, { idempotent: true });
                } catch (e) {
                  // Ignore cleanup errors
                }
              }
              
              // Reset segments array
              recordingSegmentsRef.current = [];
              
              return concatenatedPath;
            } else {
              console.error('[SPYN Record] Concatenation failed:', response.data.error);
              // Fall back to returning the last segment
              return finalUri || '';
            }
          }
        } catch (concatenationError) {
          console.error('[SPYN Record] Concatenation error:', concatenationError);
          // Fall back to returning the last segment
          return finalUri || '';
        }
      } else if (recordingSegmentsRef.current.length === 1) {
        // Only one segment, return it directly
        return recordingSegmentsRef.current[0];
      }
      
      return finalUri || '';
    }
    return '';
  };

  // Save recording to device
  const saveRecording = async (fileUri: string) => {
    try {
      console.log('[SPYN Record] Saving recording from:', fileUri);
      
      if (!fileUri) {
        Alert.alert('Erreur', 'Aucun fichier audio à sauvegarder');
        return;
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `SPYN_Mix_${timestamp}`;
      
      if (Platform.OS === 'web') {
        // Download file on web
        const link = document.createElement('a');
        link.href = fileUri;
        link.download = `${fileName}.webm`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        Alert.alert('✅ Téléchargement lancé', 'Votre mix a été téléchargé.');
      } else {
        // On iOS/Android, convert to MP3 then share
        console.log('[SPYN Record] Converting to MP3...');
        setCurrentAnalysis('Conversion en MP3...');
        
        try {
          // Read the m4a file as base64
          const audioBase64 = await LegacyFileSystem.readAsStringAsync(fileUri, {
            encoding: LegacyFileSystem.EncodingType.Base64,
          });
          console.log('[SPYN Record] Read audio file, size:', audioBase64.length);
          
          // Send to backend for conversion
          const response = await axios.post(`${BACKEND_URL}/api/convert-audio`, {
            audio_base64: audioBase64,
            output_format: 'mp3'
          }, {
            timeout: 120000, // 2 minutes timeout for large files
          });
          
          if (response.data.success) {
            console.log('[SPYN Record] Conversion successful, MP3 size:', response.data.size);
            
            // Save the MP3 file locally - use LegacyFileSystem for cacheDirectory
            const cacheDir = LegacyFileSystem.cacheDirectory || '';
            const mp3Path = `${cacheDir}${fileName}.mp3`;
            console.log('[SPYN Record] Saving MP3 to:', mp3Path);
            
            await LegacyFileSystem.writeAsStringAsync(mp3Path, response.data.audio_base64, {
              encoding: LegacyFileSystem.EncodingType.Base64,
            });
            console.log('[SPYN Record] MP3 saved successfully');
            
            // Share the MP3 file
            setCurrentAnalysis('');
            await shareRecording(mp3Path);
            
            // Cleanup original m4a
            try {
              await LegacyFileSystem.deleteAsync(fileUri, { idempotent: true });
            } catch (e) {
              // Ignore cleanup errors
            }
          } else {
            console.log('[SPYN Record] Conversion failed, sharing original m4a');
            setCurrentAnalysis('');
            await shareRecording(fileUri);
          }
        } catch (conversionError) {
          console.error('[SPYN Record] Conversion error:', conversionError);
          setCurrentAnalysis('');
          // Fall back to sharing original m4a
          await shareRecording(fileUri);
        }
      }
    } catch (error: any) {
      console.error('[SPYN Record] Save error:', error);
      setCurrentAnalysis('');
      Alert.alert('Erreur', `Impossible de sauvegarder: ${error.message || 'Erreur inconnue'}`);
    }
  };

  const shareRecording = async (uri: string) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
        console.log('[SPYN Record] Mix shared successfully');
      }
    } catch (error) {
      console.error('[SPYN Record] Share error:', error);
    }
  };

  // Pause/Resume recording
  const togglePause = async () => {
    if (!isRecording) return;
    
    try {
      if (Platform.OS === 'web') {
        if (mediaRecorderRef.current) {
          if (isPaused) {
            mediaRecorderRef.current.resume();
          } else {
            mediaRecorderRef.current.pause();
          }
        }
      } else {
        if (recordingRef.current) {
          if (isPaused) {
            await recordingRef.current.startAsync();
          } else {
            await recordingRef.current.pauseAsync();
          }
        }
      }
      
      setIsPaused(!isPaused);
    } catch (error) {
      console.error('[SPYN Record] Pause error:', error);
    }
  };

  // Render waveform
  const renderWaveform = () => (
    <View style={styles.waveformContainer}>
      {waveformData.map((bar, index) => (
        <View
          key={index}
          style={[
            styles.waveformBar,
            {
              height: bar.height,
              backgroundColor: isRecording && !isPaused ? bar.color : '#333',
            },
          ]}
        />
      ))}
    </View>
  );

  // Render identified tracks list
  const renderTracksList = () => (
    <ScrollView style={styles.tracksList} showsVerticalScrollIndicator={false}>
      {identifiedTracks.length === 0 ? (
        <View style={styles.emptyTracks}>
          <Ionicons name="musical-notes-outline" size={40} color="#444" />
          <Text style={styles.emptyTracksText}>
            {t('spynRecord.noTracksYet')}
          </Text>
        </View>
      ) : (
        identifiedTracks.map((track, index) => (
          <View key={track.id} style={styles.trackItem}>
            {/* Cover Image */}
            {track.coverImage ? (
              <Image 
                source={{ uri: track.coverImage }} 
                style={styles.trackCover}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.trackCover, styles.trackCoverPlaceholder]}>
                <Ionicons name="musical-note" size={20} color="#666" />
              </View>
            )}
            <View style={styles.trackInfo}>
              <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
              <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
            </View>
            <View style={styles.trackTimestamp}>
              <Ionicons name="time-outline" size={14} color="#888" />
              <Text style={styles.trackTimestampText}>{track.timestamp}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SPYN Record</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Recording Status */}
      <View style={styles.statusContainer}>
        {isRecording ? (
          <View style={styles.recordingStatus}>
            <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.recordingText}>
              {isPaused ? 'EN PAUSE' : 'ENREGISTREMENT'}
            </Text>
          </View>
        ) : (
          <Text style={styles.readyText}>Prêt à enregistrer</Text>
        )}
      </View>

      {/* Audio Source Indicator */}
      <View style={styles.audioSourceContainer}>
        {/* Offline Indicator */}
        {isOffline && (
          <View style={styles.offlineBadge}>
            <Ionicons name="cloud-offline" size={14} color="#FF6B6B" />
            <Text style={styles.offlineText}>{t('spynRecord.offlineMode')}</Text>
          </View>
        )}
        
        {/* Pending Sync Indicator */}
        {pendingSyncCount > 0 && !isOffline && (
          <TouchableOpacity style={styles.syncBadge} onPress={syncOfflineSession}>
            <Ionicons name="cloud-upload" size={14} color="#FFB800" />
            <Text style={styles.syncText}>{pendingSyncCount} {t('spynRecord.pendingSync')}</Text>
          </TouchableOpacity>
        )}
        
        <View style={[
          styles.audioSourceBadge,
          audioSource === 'usb' ? styles.audioSourceUSB : 
          audioSource === 'external' ? styles.audioSourceExternal : 
          styles.audioSourceInternal
        ]}>
          <Ionicons 
            name={audioSource === 'usb' ? 'hardware-chip' : audioSource === 'external' ? 'headset' : 'mic'} 
            size={16} 
            color={audioSource === 'usb' ? '#00D4FF' : audioSource === 'external' ? GREEN_COLOR : '#888'} 
          />
          <Text style={[
            styles.audioSourceText,
            (audioSource === 'external' || audioSource === 'usb') && styles.audioSourceTextExternal
          ]}>
            {audioSourceName}
          </Text>
          {(audioSource === 'external' || audioSource === 'usb') && (
            <View style={[styles.externalDot, audioSource === 'usb' && styles.usbDot]} />
          )}
          {isCheckingUSB && (
            <Ionicons name="refresh" size={12} color="#666" style={{ marginLeft: 4 }} />
          )}
        </View>
        <TouchableOpacity 
          style={styles.refreshSourceButton}
          onPress={detectAudioSources}
          disabled={isCheckingUSB}
        >
          <Ionicons name="refresh" size={18} color={isCheckingUSB ? '#333' : '#666'} />
        </TouchableOpacity>
      </View>

      {/* Timer */}
      <View style={styles.timerContainer}>
        <Text style={styles.timerText}>{formatDuration(recordingDuration)}</Text>
        {currentAnalysis ? (
          <View style={styles.analysisStatus}>
            {isAnalyzing && <Ionicons name="pulse" size={16} color={CYAN_COLOR} />}
            <Text style={styles.analysisText}>{currentAnalysis}</Text>
          </View>
        ) : null}
      </View>

      {/* Waveform */}
      <View style={styles.waveformSection}>
        <Text style={styles.sectionLabel}>{t('spynRecord.waveform')}</Text>
        {renderWaveform()}
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        {!isRecording ? (
          <TouchableOpacity 
            style={styles.recordButton} 
            onPress={startRecording}
            disabled={!hasPermission}
          >
            <LinearGradient
              colors={[ORANGE_COLOR, PINK_COLOR]}
              style={styles.recordButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="mic" size={40} color="#fff" />
              <Text style={styles.recordButtonText}>{t('spynRecord.start')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={styles.recordingControls}>
            <TouchableOpacity style={styles.controlButton} onPress={togglePause}>
              <Ionicons 
                name={isPaused ? 'play' : 'pause'} 
                size={30} 
                color="#fff" 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.controlButton, styles.stopButton]} 
              onPress={stopRecording}
            >
              <Ionicons name="stop" size={30} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Identified Tracks */}
      <View style={styles.tracksSection}>
        <View style={styles.tracksSectionHeader}>
          <Text style={styles.sectionLabel}>{t('spynRecord.identifiedTracks')}</Text>
          <View style={styles.tracksCount}>
            <Text style={styles.tracksCountText}>{identifiedTracks.length}</Text>
          </View>
        </View>
        {renderTracksList()}
      </View>

      {/* Instructions */}
      {!isRecording && (
        <View style={styles.instructionsContainer}>
          <Ionicons name="information-circle-outline" size={20} color="#666" />
          <Text style={styles.instructionsText}>
            {t('spynRecord.connectMixer')}
          </Text>
        </View>
      )}

      {/* ==================== END SESSION MODAL ==================== */}
      <Modal 
        visible={showEndSessionModal} 
        transparent 
        animationType="fade" 
        onRequestClose={() => setShowEndSessionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.endSessionModalContent}>
              <TouchableOpacity 
                style={styles.modalCloseButton} 
                onPress={() => setShowEndSessionModal(false)}
              >
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>

              <Text style={styles.endSessionTitle}>Fin de Session</Text>
              <Text style={styles.endSessionSubtitle}>
                Confirmez la fin de votre enregistrement.
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
                      {location?.venue || 'Lieu inconnu'}
                    </Text>
                    <Text style={styles.venueCity}>
                      {location?.city || 'Inconnu'} • {location?.is_valid_venue ? 'Club vérifié ✓' : 'Lieu non vérifié'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.correctLabel}>Corriger le nom du lieu si besoin :</Text>
                <TextInput
                  style={styles.venueInput}
                  value={correctedVenue}
                  onChangeText={setCorrectedVenue}
                  placeholder={location?.venue || 'Entrez le nom du lieu'}
                  placeholderTextColor="#666"
                />

                <Text style={styles.startedAtText}>Démarré à {sessionStartTime}</Text>
                <View style={styles.tracksCountRow}>
                  <Ionicons name="musical-notes" size={16} color="#888" />
                  <Text style={styles.tracksCountRowText}>
                    {identifiedTracks.length} track(s) identifié(s)
                  </Text>
                </View>
                <View style={styles.durationRow}>
                  <Ionicons name="time" size={16} color="#888" />
                  <Text style={styles.durationRowText}>
                    Durée: {formatDuration(recordingDuration)}
                  </Text>
                </View>
              </View>

              {/* Who Played Selection */}
              <Text style={styles.whoPlayedTitle}>Qui a joué cette session ?</Text>
              
              <TouchableOpacity 
                style={[styles.radioOption, whoPlayed === 'me' && styles.radioOptionSelected]} 
                onPress={() => setWhoPlayed('me')}
              >
                <View style={[styles.radioCircle, whoPlayed === 'me' && styles.radioCircleSelected]} />
                <Text style={styles.radioText}>C'était moi</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.radioOption, whoPlayed === 'another' && styles.radioOptionSelected]} 
                onPress={() => setWhoPlayed('another')}
              >
                <View style={[styles.radioCircle, whoPlayed === 'another' && styles.radioCircleSelected]} />
                <Text style={styles.radioText}>Un autre DJ</Text>
              </TouchableOpacity>

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

              {/* Save Mix Option */}
              <View style={styles.saveMixSection}>
                <Text style={styles.saveMixTitle}>💾 Sauvegarder le mix</Text>
                <TouchableOpacity 
                  style={[styles.saveMixOption, saveMix && styles.saveMixOptionSelected]} 
                  onPress={() => setSaveMix(!saveMix)}
                >
                  <View style={[styles.checkboxCircle, saveMix && styles.checkboxCircleSelected]}>
                    {saveMix && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                  <Text style={styles.saveMixText}>
                    Télécharger l'enregistrement audio du mix
                  </Text>
                </TouchableOpacity>
                <Text style={styles.saveMixHint}>
                  Le fichier sera préparé pour le téléchargement après la fin de la session.
                </Text>
              </View>

              {/* Warning/Success Messages */}
              {identifiedTracks.length === 0 && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning" size={18} color="#FFB74D" />
                  <Text style={styles.warningText}>
                    Aucun track identifié - Pas de Black Diamond
                  </Text>
                </View>
              )}

              {identifiedTracks.length > 0 && !location?.is_valid_venue && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning" size={18} color="#FFB74D" />
                  <Text style={styles.warningText}>
                    Lieu non reconnu comme club/bar - Pas de Black Diamond
                  </Text>
                </View>
              )}

              {identifiedTracks.length > 0 && location?.is_valid_venue && (
                <View style={styles.successBox}>
                  <Ionicons name="diamond" size={18} color={CYAN_COLOR} />
                  <Text style={styles.successBoxText}>
                    Vous allez gagner un Black Diamond ! 💎
                  </Text>
                </View>
              )}

              <TouchableOpacity style={styles.confirmEndButton} onPress={confirmEndSession}>
                <Ionicons name="stop-circle" size={20} color="#fff" />
                <Text style={styles.confirmEndButtonText}>Confirmer la fin de session</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ==================== BLACK DIAMOND MODAL ==================== */}
      <Modal visible={showDiamondModal} transparent animationType="fade">
        <View style={styles.diamondModalOverlay}>
          <View style={styles.diamondModalContent}>
            <Animated.View style={{ transform: [{ rotateY: diamondRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
              <View style={styles.diamondIcon}>
                <Ionicons name="diamond" size={80} color="#1a1a2e" />
              </View>
            </Animated.View>
            <Text style={styles.diamondTitle}>Félicitations !</Text>
            <Text style={styles.diamondSubtitle}>Vous avez gagné un Black Diamond 💎</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  recordingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF0000',
  },
  recordingText: {
    color: '#FF0000',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
  },
  readyText: {
    color: '#888',
    fontSize: 14,
    letterSpacing: 1,
  },
  // Audio Source Indicator Styles
  audioSourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  audioSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  audioSourceInternal: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#333',
  },
  audioSourceExternal: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderWidth: 1,
    borderColor: GREEN_COLOR + '40',
  },
  audioSourceUSB: {
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    borderWidth: 1,
    borderColor: CYAN_COLOR + '60',
  },
  audioSourceText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 200,
  },
  audioSourceTextExternal: {
    color: GREEN_COLOR,
  },
  externalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN_COLOR,
  },
  usbDot: {
    backgroundColor: CYAN_COLOR,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    marginRight: 8,
  },
  offlineText: {
    color: '#FF6B6B',
    fontSize: 11,
    fontWeight: '600',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.3)',
    marginRight: 8,
  },
  syncText: {
    color: '#FFB800',
    fontSize: 11,
    fontWeight: '600',
  },
  refreshSourceButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  timerText: {
    color: '#fff',
    fontSize: 56,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
  },
  analysisStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderRadius: 20,
  },
  analysisText: {
    color: CYAN_COLOR,
    fontSize: 13,
  },
  waveformSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionLabel: {
    color: '#666',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 80,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 10,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
    minHeight: 4,
  },
  controlsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  recordButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
  },
  recordButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#252540',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#FF0000',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  tracksSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tracksSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tracksCount: {
    backgroundColor: CYAN_COLOR,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tracksCountText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  tracksList: {
    flex: 1,
  },
  emptyTracks: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTracksText: {
    color: '#444',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151525',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  trackCover: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  trackCoverPlaceholder: {
    backgroundColor: '#252540',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: CYAN_COLOR + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trackNumberText: {
    color: CYAN_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  trackArtist: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  trackTimestamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#252540',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  trackTimestampText: {
    color: '#888',
    fontSize: 12,
  },
  instructionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  instructionsText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    flex: 1,
  },
  // ==================== END SESSION MODAL STYLES ====================
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  endSessionModalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  endSessionTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  endSessionSubtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  venueCard: {
    backgroundColor: '#252540',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  venueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  venueDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  venueTextContainer: {
    flex: 1,
  },
  venueName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  venueCity: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  correctLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  venueInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    marginBottom: 12,
  },
  startedAtText: {
    color: '#666',
    fontSize: 12,
    marginBottom: 8,
  },
  tracksCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tracksCountRowText: {
    color: '#888',
    fontSize: 13,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  durationRowText: {
    color: '#888',
    fontSize: 13,
  },
  whoPlayedTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252540',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  radioOptionSelected: {
    backgroundColor: CYAN_COLOR + '20',
    borderWidth: 1,
    borderColor: CYAN_COLOR + '40',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: CYAN_COLOR,
    backgroundColor: CYAN_COLOR,
  },
  radioText: {
    color: '#fff',
    fontSize: 15,
  },
  otherDjContainer: {
    marginBottom: 16,
  },
  otherDjLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  otherDjInput: {
    backgroundColor: '#252540',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
  },
  // Save Mix Section
  saveMixSection: {
    backgroundColor: '#252540',
    borderRadius: 16,
    padding: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: PINK_COLOR + '40',
  },
  saveMixTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  saveMixOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
  },
  saveMixOptionSelected: {
    backgroundColor: PINK_COLOR + '20',
    borderWidth: 1,
    borderColor: PINK_COLOR + '40',
  },
  checkboxCircle: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCircleSelected: {
    borderColor: PINK_COLOR,
    backgroundColor: PINK_COLOR,
  },
  saveMixText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  saveMixHint: {
    color: '#666',
    fontSize: 11,
    marginTop: 10,
    fontStyle: 'italic',
  },
  // Warning/Success boxes
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFB74D15',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  warningText: {
    color: '#FFB74D',
    fontSize: 13,
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CYAN_COLOR + '15',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  successBoxText: {
    color: CYAN_COLOR,
    fontSize: 13,
    flex: 1,
  },
  confirmEndButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53935',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    gap: 10,
  },
  confirmEndButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Diamond Modal
  diamondModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
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
    backgroundColor: CYAN_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  diamondTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  diamondSubtitle: {
    color: CYAN_COLOR,
    fontSize: 18,
  },
});
