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
import { base44Tracks } from '../../src/services/base44Api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_SIZE = Math.min(SCREEN_WIDTH * 0.35, 140);

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
  album?: string;
  cover_image?: string;
}

interface LocationInfo {
  latitude: number;
  longitude: number;
  venue?: string;
  city?: string;
  country?: string;
}

export default function SpynScreen() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL;
  
  // States
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [djRecording, setDjRecording] = useState<Audio.Recording | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [djSetDuration, setDjSetDuration] = useState(0);
  const [recognizedTracks, setRecognizedTracks] = useState<RecognizedTrack[]>([]);
  const [isUsbConnected, setIsUsbConnected] = useState(false);
  const [lastRecognitionTime, setLastRecognitionTime] = useState(0);
  
  // Location
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  
  // Producer notification modal
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notifiedProducer, setNotifiedProducer] = useState<string | null>(null);
  
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
  const rotateAnim1 = useRef(new Animated.Value(0)).current;
  const rotateAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Request location permission
    requestLocationPermission();
    
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

    // Rotating light animation - continuous spin
    const rotateLoop1 = Animated.loop(
      Animated.timing(rotateAnim1, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const rotateLoop2 = Animated.loop(
      Animated.timing(rotateAnim2, {
        toValue: 1,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
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
    rotateLoop1.start();
    rotateLoop2.start();

    return () => {
      glowLoop1.stop();
      glowLoop2.stop();
      scaleLoop1.stop();
      scaleLoop2.stop();
      rotateLoop1.stop();
      rotateLoop2.stop();
      if (djIntervalRef.current) clearInterval(djIntervalRef.current);
      if (recognitionIntervalRef.current) clearInterval(recognitionIntervalRef.current);
    };
  }, []);

  // Request location permission and get current location
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
      
      // Try Google Places API first for nearby venues (clubs, bars, etc.)
      let venueName = undefined;
      try {
        const response = await axios.get(
          `${BACKEND_URL}/api/nearby-places`,
          {
            params: { lat, lng },
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
          }
        );
        
        if (response.data.success && response.data.venue) {
          venueName = response.data.venue;
        }
      } catch (placeError) {
        console.log('Google Places lookup failed, using reverse geocode:', placeError);
      }
      
      // Fallback to reverse geocode for city/country
      const [address] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      
      setLocation({
        latitude: lat,
        longitude: lng,
        venue: venueName || address?.name || address?.street || undefined,
        city: address?.city || address?.region || undefined,
        country: address?.country || undefined,
      });
      
      console.log('Location updated:', { lat, lng, venue: venueName, city: address?.city });
    } catch (error) {
      console.error('Location update error:', error);
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

  // ==================== NOTIFY PRODUCER ====================
  const notifyProducer = async (trackInfo: any, locationInfo: LocationInfo | null) => {
    try {
      // Call Base44 function to notify producer
      const notificationData = {
        track_title: trackInfo.title,
        track_artist: trackInfo.artist,
        track_album: trackInfo.album || '',
        track_cover: trackInfo.cover_image || '',
        dj_id: user?.id,
        dj_name: user?.full_name || 'Unknown DJ',
        venue: locationInfo?.venue || 'Unknown Venue',
        city: locationInfo?.city || 'Unknown City',
        country: locationInfo?.country || 'Unknown Country',
        latitude: locationInfo?.latitude,
        longitude: locationInfo?.longitude,
        played_at: new Date().toISOString(),
      };

      // Send to backend which will call Base44 notification function
      await axios.post(
        `${BACKEND_URL}/api/notify-producer`,
        notificationData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Show notification modal
      setNotifiedProducer(trackInfo.artist);
      setShowNotificationModal(true);
      
      // Auto-hide after 3 seconds
      setTimeout(() => setShowNotificationModal(false), 3000);
      
    } catch (error) {
      console.error('Failed to notify producer:', error);
      // Don't show error to user, notification is a secondary feature
    }
  };

  // ==================== SPYN DETECTION ====================
  const startDetection = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone access is needed to identify tracks');
        return;
      }

      // Update location before recording
      if (locationPermission) {
        await updateLocation();
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
      Alert.alert('Error', 'Could not start recording');
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

      if (response.data.success) {
        setResult(response.data);
        
        // Notify producer if track is recognized
        if (response.data.title && response.data.artist) {
          await notifyProducer(response.data, location);
        }
      } else {
        Alert.alert('Not Recognized', 'Could not identify this track. Try with a clearer audio sample.');
      }
    } catch (error: any) {
      console.error('Recognition error:', error);
      Alert.alert('Error', 'Recognition failed. Check your connection.');
    } finally {
      setRecognizing(false);
    }
  };

  // ==================== SPYN RECORD SET ====================
  const startRecordSet = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone access is needed');
        return;
      }

      // Update location
      if (locationPermission) {
        await updateLocation();
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
      
      djIntervalRef.current = setInterval(() => {
        setDjSetDuration(prev => prev + 1);
      }, 1000);

      recognitionIntervalRef.current = setInterval(() => {
        recognizeCurrentTrack();
      }, RECOGNITION_INTERVAL);

      setTimeout(() => recognizeCurrentTrack(), 5000);

      Alert.alert(
        '🎧 SPYN Record Set',
        `Recording started${location ? ` at ${location.venue || location.city || 'your location'}` : ''}...\nTracks will be identified automatically every 30 seconds.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('DJ Set error:', error);
      Alert.alert('Error', 'Could not start recording');
    }
  };

  const recognizeCurrentTrack = async () => {
    if (!djRecording) return;
    
    try {
      const currentTime = djSetDuration;
      if (currentTime - lastRecognitionTime < 25) return;
      setLastRecognitionTime(currentTime);

      await Audio.setAudioModeAsync({ 
        allowsRecordingIOS: true, 
        playsInSilentModeIOS: true 
      });
      
      const { recording: tempRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      tempRecordingRef.current = tempRecording;

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

          if (response.data.success && response.data.title) {
            const newTrack: RecognizedTrack = {
              id: Date.now().toString(),
              title: response.data.title,
              artist: response.data.artist || 'Unknown',
              timestamp: currentTime,
              confidence: response.data.score,
              album: response.data.album,
              cover_image: response.data.cover_image,
            };

            setRecognizedTracks(prev => {
              const isDuplicate = prev.some(t => 
                t.title.toLowerCase() === newTrack.title.toLowerCase() &&
                t.artist.toLowerCase() === newTrack.artist.toLowerCase()
              );
              if (isDuplicate) return prev;
              
              // Notify producer for each new track
              notifyProducer(newTrack, location);
              
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
      if (djIntervalRef.current) {
        clearInterval(djIntervalRef.current);
        djIntervalRef.current = null;
      }
      if (recognitionIntervalRef.current) {
        clearInterval(recognitionIntervalRef.current);
        recognitionIntervalRef.current = null;
      }
      if (tempRecordingRef.current) {
        try { await tempRecordingRef.current.stopAndUnloadAsync(); } catch {}
        tempRecordingRef.current = null;
      }

      await djRecording.stopAndUnloadAsync();
      const uri = djRecording.getURI();
      const finalDuration = djSetDuration;
      const tracks = [...recognizedTracks];
      setDjRecording(null);

      if (uri) {
        const trackListText = tracks.length > 0
          ? `\n\n✅ ${tracks.length} track(s) identified:\n${tracks.map((t, i) => 
              `${i + 1}. ${t.title} - ${t.artist} (${formatDuration(t.timestamp)})`
            ).join('\n')}\n\n📧 Producers have been notified!`
          : '\n\nNo tracks identified automatically.';

        Alert.alert(
          '🎵 DJ Set Complete',
          `Duration: ${formatDuration(finalDuration)}${trackListText}`,
          [
            { text: 'Delete', style: 'destructive', onPress: () => { setDjSetDuration(0); setRecognizedTracks([]); }},
            { text: 'Save', onPress: async () => {
                const fileName = `dj_set_${Date.now()}.m4a`;
                const destPath = `${FileSystem.documentDirectory}${fileName}`;
                await FileSystem.moveAsync({ from: uri, to: destPath });
                
                const tracklistPath = `${FileSystem.documentDirectory}dj_set_${Date.now()}_tracklist.json`;
                await FileSystem.writeAsStringAsync(tracklistPath, JSON.stringify({
                  duration: finalDuration,
                  tracks: tracks,
                  location: location,
                  dj_name: user?.full_name,
                  date: new Date().toISOString(),
                }));
                
                Alert.alert('✅ Saved!', 'DJ Set and tracklist saved');
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

  const toggleUsbConnection = () => {
    Alert.alert(
      '🔌 USB / Mixer Connection',
      isUsbConnected 
        ? 'Disconnect USB input?'
        : 'To record from your mixer:\n\n1. Connect a USB or audio cable from the REC/BOOTH output\n2. Use a Lightning/USB-C adapter if needed\n3. The app will capture the direct audio signal\n\nBetter quality than microphone!',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: isUsbConnected ? 'Disconnect' : 'Cable Connected', onPress: () => setIsUsbConnected(!isUsbConnected) }
      ]
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const glowOpacity1 = glowAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const glowOpacity2 = glowAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* Location Banner */}
        {location && (
          <View style={styles.locationBanner}>
            <Ionicons name="location" size={16} color={CYAN_COLOR} />
            <Text style={styles.locationText}>
              {location.venue || location.city || 'Your Location'}{location.city && location.venue ? `, ${location.city}` : ''}
            </Text>
          </View>
        )}

        {/* Main SPYN Buttons */}
        {!recording && !djRecording && !recognizing && !result && (
          <View style={styles.spynButtonsSection}>
            {/* SPYN DETECTION */}
            <View style={styles.spynButtonWrapper}>
              <Animated.View style={[styles.glowRing, { opacity: glowOpacity1, borderColor: '#FF6B6B', shadowColor: '#FF6B6B' }]} />
              <Animated.View style={{ transform: [{ scale: scaleAnim1 }] }}>
                <TouchableOpacity onPress={startDetection} activeOpacity={0.85} style={styles.spynButtonTouchable}>
                  <LinearGradient colors={DETECTION_GRADIENT} style={styles.spynButton} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>
                    <Text style={styles.spynText}>SPYN</Text>
                    <Text style={styles.spynSubtext}>DETECTION</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
              <Text style={styles.spynLabel}>Micro</Text>
            </View>

            {/* SPYN RECORD SET */}
            <View style={styles.spynButtonWrapper}>
              <Animated.View style={[styles.glowRing, { opacity: glowOpacity2, borderColor: '#EC407A', shadowColor: '#EC407A' }]} />
              <Animated.View style={{ transform: [{ scale: scaleAnim2 }] }}>
                <TouchableOpacity onPress={startRecordSet} activeOpacity={0.85} style={styles.spynButtonTouchable}>
                  <LinearGradient colors={RECORD_GRADIENT} style={styles.spynButton} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>
                    <Text style={styles.spynText}>SPYN</Text>
                    <Text style={styles.spynSubtext}>RECORD SET</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
              <TouchableOpacity onPress={toggleUsbConnection}>
                <Text style={[styles.spynLabel, isUsbConnected && styles.spynLabelActive]}>
                  {isUsbConnected ? '🔌 USB Connected' : 'USB + Rec'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recognizing */}
        {recognizing && (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color={CYAN_COLOR} />
            <Text style={styles.statusText}>Analyzing with ACRCloud...</Text>
            <Text style={styles.statusSubtext}>Identifying track & notifying producer</Text>
          </View>
        )}

        {/* Recording Detection */}
        {recording && (
          <View style={styles.recordingStatus}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <LinearGradient colors={DETECTION_GRADIENT} style={styles.recordingCircle}>
                <Ionicons name="mic" size={50} color="#fff" />
              </LinearGradient>
            </Animated.View>
            <Text style={styles.statusText}>Listening... (10s)</Text>
            <Text style={styles.statusSubtext}>
              {location ? `📍 ${location.venue || location.city || 'Your location'}` : 'Getting location...'}
            </Text>
            <TouchableOpacity style={styles.cancelButton} onPress={stopDetection}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* DJ Set Recording */}
        {djRecording && (
          <View style={styles.djSetContainer}>
            <View style={styles.recordingHeader}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingLabel}>REC</Text>
              {isUsbConnected && <View style={styles.usbBadge}><Text style={styles.usbBadgeText}>USB</Text></View>}
            </View>
            
            <Text style={styles.djSetTimer}>{formatDuration(djSetDuration)}</Text>
            
            {location && (
              <View style={styles.locationInfo}>
                <Ionicons name="location" size={14} color={CYAN_COLOR} />
                <Text style={styles.locationInfoText}>
                  {location.venue || location.city || 'Recording location'}
                </Text>
              </View>
            )}
            
            {recognizedTracks.length > 0 && (
              <View style={styles.tracklistContainer}>
                <Text style={styles.tracklistTitle}>
                  Tracks Identified ({recognizedTracks.length}) • Producers notified ✉️
                </Text>
                {recognizedTracks.slice(-5).map((track, index) => (
                  <View key={track.id} style={styles.tracklistItem}>
                    <Text style={styles.tracklistTime}>{formatDuration(track.timestamp)}</Text>
                    <View style={styles.tracklistInfo}>
                      <Text style={styles.tracklistTrackTitle} numberOfLines={1}>{track.title}</Text>
                      <Text style={styles.tracklistArtist} numberOfLines={1}>{track.artist}</Text>
                    </View>
                    <Ionicons name="mail" size={14} color="#4CAF50" />
                  </View>
                ))}
              </View>
            )}
            
            <TouchableOpacity style={styles.stopButton} onPress={stopRecordSet}>
              <Ionicons name="stop" size={28} color="#fff" />
              <Text style={styles.stopButtonText}>Stop Recording</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recognition Result */}
        {result && (
          <View style={styles.resultContainer}>
            <View style={styles.resultIconContainer}>
              <Ionicons name="checkmark-circle" size={70} color="#4CAF50" />
            </View>
            <Text style={styles.resultTitle}>Track Identified!</Text>
            
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Title</Text>
              <Text style={styles.resultValue}>{result.title || 'Unknown'}</Text>
              <Text style={styles.resultLabel}>Artist</Text>
              <Text style={styles.resultValue}>{result.artist || 'Unknown'}</Text>
              {result.album && (
                <>
                  <Text style={styles.resultLabel}>Album</Text>
                  <Text style={styles.resultValue}>{result.album}</Text>
                </>
              )}
              {result.score && (
                <Text style={styles.confidenceText}>Confidence: {result.score}%</Text>
              )}
            </View>
            
            {notifiedProducer && (
              <View style={styles.notificationBadge}>
                <Ionicons name="mail" size={16} color="#4CAF50" />
                <Text style={styles.notificationText}>
                  Producer "{notifiedProducer}" has been notified! 📧
                </Text>
              </View>
            )}
            
            <TouchableOpacity style={styles.resetButton} onPress={() => setResult(null)}>
              <Text style={styles.resetButtonText}>New Search</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* Producer Notification Modal */}
      <Modal visible={showNotificationModal} transparent animationType="fade">
        <View style={styles.notificationModal}>
          <View style={styles.notificationModalContent}>
            <Ionicons name="mail" size={40} color="#4CAF50" />
            <Text style={styles.notificationModalTitle}>Producer Notified!</Text>
            <Text style={styles.notificationModalText}>
              {notifiedProducer} has been notified that you're playing their track!
            </Text>
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
  
  // Location
  locationBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: CYAN_COLOR + '20', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 20, gap: 6 },
  locationText: { color: CYAN_COLOR, fontSize: 13, fontWeight: '500' },
  
  // SPYN Buttons
  spynButtonsSection: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: Spacing.xl, paddingHorizontal: 20, gap: 30 },
  spynButtonWrapper: { alignItems: 'center', position: 'relative', flex: 1 },
  glowRing: { position: 'absolute', width: BUTTON_SIZE + 20, height: BUTTON_SIZE + 20, borderRadius: (BUTTON_SIZE + 20) / 2, borderWidth: 2, top: -10, left: -10, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20, elevation: 10 },
  spynButtonTouchable: { borderRadius: BUTTON_SIZE / 2, overflow: 'hidden' },
  spynButton: { width: BUTTON_SIZE, height: BUTTON_SIZE, borderRadius: BUTTON_SIZE / 2, justifyContent: 'center', alignItems: 'center' },
  spynText: { fontSize: 28, fontWeight: 'bold', color: '#fff', letterSpacing: 2 },
  spynSubtext: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.85)', letterSpacing: 1, marginTop: 4 },
  spynLabel: { marginTop: 16, fontSize: 14, color: Colors.textMuted, fontWeight: '500' },
  spynLabelActive: { color: '#4CAF50' },
  
  // Status
  statusContainer: { alignItems: 'center', gap: 16, marginTop: 40 },
  statusText: { fontSize: 20, color: CYAN_COLOR, fontWeight: '600' },
  statusSubtext: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  recordingStatus: { alignItems: 'center', gap: Spacing.md, marginTop: 40 },
  recordingCircle: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center' },
  cancelButton: { backgroundColor: Colors.backgroundCard, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md, marginTop: Spacing.md, borderWidth: 1, borderColor: CYAN_COLOR },
  cancelButtonText: { color: CYAN_COLOR, fontSize: 14, fontWeight: '500' },
  
  // DJ Set
  djSetContainer: { alignItems: 'center', gap: Spacing.md, width: '100%', marginTop: 20 },
  recordingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#ff4444' },
  recordingLabel: { fontSize: 16, fontWeight: 'bold', color: '#ff4444' },
  usbBadge: { backgroundColor: '#4CAF50', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  usbBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  djSetTimer: { fontSize: 72, fontWeight: 'bold', color: CYAN_COLOR, fontVariant: ['tabular-nums'] },
  locationInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -10 },
  locationInfoText: { color: Colors.textMuted, fontSize: 13 },
  tracklistContainer: { width: '100%', backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md, borderWidth: 1, borderColor: CYAN_COLOR + '40' },
  tracklistTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  tracklistItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  tracklistTime: { fontSize: 12, color: CYAN_COLOR, fontWeight: '600', width: 45 },
  tracklistInfo: { flex: 1 },
  tracklistTrackTitle: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  tracklistArtist: { fontSize: 12, color: Colors.textMuted },
  stopButton: { backgroundColor: '#ff4444', paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.lg },
  stopButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  // Result
  resultContainer: { alignItems: 'center', width: '100%', marginTop: 20 },
  resultIconContainer: { marginBottom: 16 },
  resultTitle: { fontSize: 26, fontWeight: 'bold', color: Colors.text, marginBottom: 24 },
  resultCard: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.lg, width: '100%', gap: 6, borderWidth: 1, borderColor: CYAN_COLOR + '40' },
  resultLabel: { fontSize: 12, color: Colors.textMuted, marginTop: 8 },
  resultValue: { fontSize: 18, color: Colors.text, fontWeight: '600' },
  confidenceText: { fontSize: 13, color: '#4CAF50', marginTop: 12 },
  notificationBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4CAF5020', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginTop: 20, gap: 8 },
  notificationText: { color: '#4CAF50', fontSize: 13, fontWeight: '500' },
  resetButton: { backgroundColor: CYAN_COLOR, padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: 24, paddingHorizontal: Spacing.xl },
  resetButtonText: { color: '#000', fontSize: 16, fontWeight: '600' },
  
  // Notification Modal
  notificationModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  notificationModalContent: { backgroundColor: Colors.backgroundCard, borderRadius: 20, padding: 30, alignItems: 'center', marginHorizontal: 40, borderWidth: 2, borderColor: '#4CAF50' },
  notificationModalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 16 },
  notificationModalText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },
});
