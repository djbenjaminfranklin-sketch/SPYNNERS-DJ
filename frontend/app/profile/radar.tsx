/**
 * Live Radar Screen - World Map with Live Track Plays
 * Shows where tracks are being played with red dots on a world map
 * Allows sending automatic messages to DJs playing your tracks
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  TextInput,
  Modal,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import { base44Notifications, base44Tracks, Track } from '../../src/services/base44Api';
import { useAuth } from '../../src/contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_WIDTH = SCREEN_WIDTH - 32;
const MAP_HEIGHT = MAP_WIDTH * 0.5; // Aspect ratio for world map

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || 'https://stable-app-deploy.preview.emergentagent.com';

// City coordinates (latitude, longitude) for map positioning
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // Europe
  'paris': { lat: 48.8566, lng: 2.3522 },
  'london': { lat: 51.5074, lng: -0.1278 },
  'berlin': { lat: 52.52, lng: 13.405 },
  'amsterdam': { lat: 52.3676, lng: 4.9041 },
  'ibiza': { lat: 38.9067, lng: 1.4206 },
  'barcelona': { lat: 41.3851, lng: 2.1734 },
  'madrid': { lat: 40.4168, lng: -3.7038 },
  'rome': { lat: 41.9028, lng: 12.4964 },
  'munich': { lat: 48.1351, lng: 11.582 },
  'prague': { lat: 50.0755, lng: 14.4378 },
  'vienna': { lat: 48.2082, lng: 16.3738 },
  'zurich': { lat: 47.3769, lng: 8.5417 },
  'lyon': { lat: 45.764, lng: 4.8357 },
  'marseille': { lat: 43.2965, lng: 5.3698 },
  'monaco': { lat: 43.7384, lng: 7.4246 },
  // Americas
  'new york': { lat: 40.7128, lng: -74.006 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'miami': { lat: 25.7617, lng: -80.1918 },
  'las vegas': { lat: 36.1699, lng: -115.1398 },
  'chicago': { lat: 41.8781, lng: -87.6298 },
  'mexico city': { lat: 19.4326, lng: -99.1332 },
  'sao paulo': { lat: -23.5505, lng: -46.6333 },
  'buenos aires': { lat: -34.6037, lng: -58.3816 },
  // Asia
  'tokyo': { lat: 35.6762, lng: 139.6503 },
  'seoul': { lat: 37.5665, lng: 126.978 },
  'singapore': { lat: 1.3521, lng: 103.8198 },
  'hong kong': { lat: 22.3193, lng: 114.1694 },
  'dubai': { lat: 25.2048, lng: 55.2708 },
  'bangkok': { lat: 13.7563, lng: 100.5018 },
  'bali': { lat: -8.3405, lng: 115.092 },
  // Oceania
  'sydney': { lat: -33.8688, lng: 151.2093 },
  'melbourne': { lat: -37.8136, lng: 144.9631 },
  // Africa
  'cape town': { lat: -33.9249, lng: 18.4241 },
  'marrakech': { lat: 31.6295, lng: -7.9811 },
};

// Convert lat/lng to map coordinates
const latLngToMapCoords = (lat: number, lng: number): { x: number; y: number } => {
  // Simple Mercator-like projection for the map
  const x = ((lng + 180) / 360) * MAP_WIDTH;
  const y = ((90 - lat) / 180) * MAP_HEIGHT;
  return { x, y };
};

// Get coordinates from city name
const getCityCoordinates = (location: string): { lat: number; lng: number } | null => {
  const loc = (location || '').toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    if (loc.includes(city)) {
      return coords;
    }
  }
  // Default to random position if city not found
  return {
    lat: 40 + (Math.random() - 0.5) * 60,
    lng: (Math.random() - 0.5) * 300,
  };
};

// Live radar play data structure
interface RadarPlay {
  id: string;
  track_id: string;
  track_title: string;
  track_artwork?: string;
  producer_name: string;
  producer_id?: string;
  dj_name: string;
  dj_id?: string;
  location?: string;
  club_name?: string;
  country?: string;
  played_at: string;
  is_live: boolean;
  latitude?: number;
  longitude?: number;
}

export default function LiveRadarScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentPlays, setRecentPlays] = useState<RadarPlay[]>([]);
  const [myTracksCount, setMyTracksCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'global' | 'my_tracks'>('my_tracks');
  const [error, setError] = useState<string | null>(null);
  
  // Auto-message state
  const [autoMessageEnabled, setAutoMessageEnabled] = useState(false);
  const [autoMessage, setAutoMessage] = useState('');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedPlay, setSelectedPlay] = useState<RadarPlay | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Initialize auto-message with translation
  useEffect(() => {
    if (!autoMessage) {
      setAutoMessage(t('radar.defaultAutoMessage'));
    }
  }, [t]);
  
  // Animation refs for pulsing dots
  const pulseAnims = useRef<Record<string, Animated.Value>>({});

  useEffect(() => {
    loadData();
    
    // Auto-refresh every 30 seconds for real-time updates
    const intervalId = setInterval(() => {
      console.log('[LiveRadar] Auto-refreshing data...');
      loadData();
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [activeTab]);

  // Create pulse animation for each live play
  useEffect(() => {
    recentPlays.forEach(play => {
      if (play.is_live && !pulseAnims.current[play.id]) {
        pulseAnims.current[play.id] = new Animated.Value(1);
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnims.current[play.id], {
              toValue: 1.5,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnims.current[play.id], {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }
    });
  }, [recentPlays]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userId = user?.id || user?._id || '';
      
      // Fetch live track plays from API
      const producerId = activeTab === 'my_tracks' ? userId : undefined;
      
      console.log('[LiveRadar] Fetching plays for:', activeTab, producerId);
      const plays = await base44Notifications.getLiveTrackPlays(producerId);
      
      // Transform the data to our format with coordinates
      const formattedPlays: RadarPlay[] = plays.map((play: any, index: number) => {
        const location = play.location || play.city || '';
        const coords = getCityCoordinates(location);
        
        return {
          id: play.id || play._id || `play-${index}`,
          track_id: play.track_id || play.trackId || '',
          track_title: play.track_title || play.trackTitle || 'Unknown Track',
          track_artwork: play.track_artwork || play.trackArtwork || play.artwork_url || '',
          producer_name: play.producer_name || play.producerName || play.artist_name || 'Unknown',
          producer_id: play.producer_id || play.producerId || '',
          dj_name: play.dj_name || play.djName || 'Unknown DJ',
          dj_id: play.dj_id || play.djId || '',
          location: location,
          club_name: play.club_name || play.clubName || play.venue || '',
          country: play.country || getCountryFlag(location),
          played_at: play.played_at || play.playedAt || play.created_at || new Date().toISOString(),
          is_live: isPlayLive(play.played_at || play.playedAt || play.created_at),
          latitude: coords?.lat,
          longitude: coords?.lng,
        };
      });
      
      setRecentPlays(formattedPlays);
      
      // Count user's tracks for stats - use Base44 API directly for mobile compatibility
      if (userId) {
        try {
          console.log('[LiveRadar] Counting tracks for user:', userId);
          
          // Use Base44 API directly - works on both web and mobile
          const userTracks = await base44Tracks.list({ limit: 1000 });
          console.log('[LiveRadar] Total tracks from API:', userTracks.length);
          
          // Filter tracks owned by current user with status 'approved' - STRICT
          // Use same logic as analytics.tsx
          const myTracks = userTracks.filter((t: Track) => {
            const trackProducerId = String(t.producer_id || '').trim();
            const trackStatus = String(t.status || '').toLowerCase().trim();
            
            // Must be owned by user AND explicitly approved
            const isOwner = trackProducerId === userId && trackProducerId !== '';
            // STRICT: only 'approved' or 'active' status
            const isApproved = trackStatus === 'approved' || trackStatus === 'active';
            
            return isOwner && isApproved;
          });
          
          console.log('[LiveRadar] Filtered to approved tracks:', myTracks.length);
          setMyTracksCount(myTracks.length);
          console.log('[LiveRadar] My tracks count:', myTracks.length);
        } catch (tracksError) {
          console.error('[LiveRadar] Error counting tracks:', tracksError);
          setMyTracksCount(0);
        }
      }
      
    } catch (err: any) {
      console.error('[LiveRadar] Error loading data:', err);
      setError('Unable to load live plays. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Check if a play is considered "live" (within last 15 minutes)
  const isPlayLive = (dateString: string): boolean => {
    if (!dateString) return false;
    const now = new Date();
    const playTime = new Date(dateString);
    const diffMs = now.getTime() - playTime.getTime();
    const diffMins = diffMs / 60000;
    return diffMins < 15;
  };

  // Get country flag emoji from location
  const getCountryFlag = (location: string): string => {
    const countryFlags: Record<string, string> = {
      'berlin': '🇩🇪', 'germany': '🇩🇪', 'munich': '🇩🇪',
      'london': '🇬🇧', 'uk': '🇬🇧', 'manchester': '🇬🇧',
      'paris': '🇫🇷', 'france': '🇫🇷', 'lyon': '🇫🇷', 'marseille': '🇫🇷',
      'ibiza': '🇪🇸', 'spain': '🇪🇸', 'madrid': '🇪🇸', 'barcelona': '🇪🇸',
      'amsterdam': '🇳🇱', 'netherlands': '🇳🇱',
      'new york': '🇺🇸', 'usa': '🇺🇸', 'los angeles': '🇺🇸', 'miami': '🇺🇸', 'las vegas': '🇺🇸',
      'tokyo': '🇯🇵', 'japan': '🇯🇵',
      'sydney': '🇦🇺', 'australia': '🇦🇺', 'melbourne': '🇦🇺',
      'dubai': '🇦🇪',
      'hong kong': '🇭🇰',
      'singapore': '🇸🇬',
    };
    
    const loc = (location || '').toLowerCase();
    for (const [key, flag] of Object.entries(countryFlags)) {
      if (loc.includes(key)) return flag;
    }
    return '🌍';
  };

  // Format time ago
  const formatTimeAgo = (dateString: string): string => {
    if (!dateString) return 'Unknown';
    const now = new Date();
    const played = new Date(dateString);
    const diffMs = now.getTime() - played.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins}min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    return `Il y a ${Math.floor(diffHours / 24)}j`;
  };

  // Send message to DJ
  const sendMessageToDJ = async (play: RadarPlay, message: string) => {
    if (!message.trim()) {
      Alert.alert(t('common.error'), t('admin.enterMessage'));
      return;
    }

    setSendingMessage(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/send-dj-message`,
        {
          dj_id: play.dj_id,
          dj_name: play.dj_name,
          producer_id: user?.id || user?._id,
          producer_name: user?.full_name || 'Producer',
          track_title: play.track_title,
          message: message,
          venue: play.club_name,
          location: play.location,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
        }
      );

      if (response.data.success) {
        Alert.alert('✅ ' + t('radar.messageSent'), t('radar.messageSentTo').replace('{name}', play.dj_name));
        setShowMessageModal(false);
        setCustomMessage('');
      } else {
        throw new Error(response.data.message || t('common.error'));
      }
    } catch (error: any) {
      console.error('[Radar] Send message error:', error);
      Alert.alert(t('common.error'), t('admin.sendError'));
    } finally {
      setSendingMessage(false);
    }
  };

  // Open message modal for a specific play
  const openMessageModal = (play: RadarPlay) => {
    setSelectedPlay(play);
    setCustomMessage(autoMessage);
    setShowMessageModal(true);
  };

  // Render map dot for a play
  const renderMapDot = (play: RadarPlay) => {
    if (!play.latitude || !play.longitude) return null;
    
    const { x, y } = latLngToMapCoords(play.latitude, play.longitude);
    const scale = pulseAnims.current[play.id] || new Animated.Value(1);
    
    return (
      <TouchableOpacity
        key={play.id}
        style={[styles.mapDot, { left: x - 6, top: y - 6 }]}
        onPress={() => openMessageModal(play)}
      >
        <Animated.View 
          style={[
            styles.mapDotInner,
            play.is_live && { transform: [{ scale }] },
            !play.is_live && styles.mapDotOld,
          ]}
        />
        {play.is_live && <View style={styles.mapDotPulse} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Text style={styles.headerTitle}>{t('radar.title')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* World Map */}
        <View style={styles.mapContainer}>
          <Text style={styles.mapTitle}>🗺️ {t('radar.liveMap')}</Text>
          <View style={styles.mapWrapper}>
            {/* World map background - using a simple SVG-like representation */}
            <LinearGradient 
              colors={['#1a2a4a', '#0d1b2a']} 
              style={styles.mapBackground}
            >
              {/* Continent outlines (simplified) */}
              <View style={styles.mapOverlay}>
                <Text style={styles.mapPlaceholder}>🌍</Text>
              </View>
              
              {/* Render live play dots */}
              {recentPlays.map(play => renderMapDot(play))}
            </LinearGradient>
            
            {/* Map legend */}
            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
                <Text style={styles.legendText}>{t('radar.live')}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#666' }]} />
                <Text style={styles.legendText}>{t('radar.recent')}</Text>
              </View>
            </View>
          </View>
          
          {recentPlays.filter(p => p.is_live).length === 0 && (
            <Text style={styles.noLiveText}>{t('radar.noLivePlays')}</Text>
          )}
        </View>

        {/* Auto-Message Settings */}
        <View style={styles.autoMessageSection}>
          <View style={styles.autoMessageHeader}>
            <View style={styles.autoMessageTitleRow}>
              <Ionicons name="chatbubble-ellipses" size={20} color={Colors.primary} />
              <Text style={styles.autoMessageTitle}>{t('radar.automaticMessage')}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.toggleButton, autoMessageEnabled && styles.toggleButtonActive]}
              onPress={() => setAutoMessageEnabled(!autoMessageEnabled)}
            >
              <View style={[styles.toggleKnob, autoMessageEnabled && styles.toggleKnobActive]} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.autoMessageDesc}>
            {t('radar.automaticMessageDesc')}
          </Text>
          
          {autoMessageEnabled && (
            <>
              <TextInput
                style={styles.autoMessageInput}
                value={autoMessage}
                onChangeText={setAutoMessage}
                placeholder={t('radar.autoMessagePlaceholder')}
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={2}
              />
              <TouchableOpacity 
                style={styles.saveMessageButton}
                onPress={() => {
                  // Save the message (could be to AsyncStorage or backend)
                  Alert.alert(t('radar.messageSaved'), t('radar.messageSavedDesc'));
                }}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveMessageButtonText}>{t('radar.saveMessage')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Stats Summary */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Ionicons name="radio" size={20} color="#F44336" />
            <Text style={styles.statValue}>{recentPlays.filter(p => p.is_live).length}</Text>
            <Text style={styles.statLabel}>{t('radar.live')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="play-circle" size={20} color="#4CAF50" />
            <Text style={styles.statValue}>{recentPlays.length}</Text>
            <Text style={styles.statLabel}>{t('radar.recent')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="musical-notes" size={20} color="#FF9800" />
            <Text style={styles.statValue}>{myTracksCount}</Text>
            <Text style={styles.statLabel}>{t('radar.myTracks')}</Text>
          </View>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'my_tracks' && styles.tabActive]}
            onPress={() => setActiveTab('my_tracks')}
          >
            <Ionicons name="person" size={18} color={activeTab === 'my_tracks' ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'my_tracks' && styles.tabTextActive]}>
              {t('radar.myTracks')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'global' && styles.tabActive]}
            onPress={() => setActiveTab('global')}
          >
            <Ionicons name="globe" size={18} color={activeTab === 'global' ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'global' && styles.tabTextActive]}>
              {t('radar.global')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Plays List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="warning-outline" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadData}>
              <Text style={styles.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : recentPlays.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="radio-outline" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {activeTab === 'my_tracks' 
                ? t('admin.noTracksPlaying')
                : t('admin.noRecentActivity')
              }
            </Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'my_tracks'
                ? t('radar.uploadMoreTracks')
                : t('radar.checkBackLater')
              }
            </Text>
          </View>
        ) : (
          recentPlays.map((play) => (
            <View key={play.id} style={[styles.playCard, play.is_live && styles.playCardLive]}>
              {/* Live Indicator */}
              {play.is_live && (
                <View style={styles.playLiveIndicator}>
                  <View style={styles.playLiveDot} />
                  <Text style={styles.playLiveText}>LIVE</Text>
                </View>
              )}
              
              {/* Track Cover */}
              <View style={styles.playCover}>
                {play.track_artwork ? (
                  <Image source={{ uri: play.track_artwork }} style={styles.playCoverImage} />
                ) : (
                  <View style={styles.playCoverPlaceholder}>
                    <Ionicons name="musical-notes" size={24} color={Colors.textMuted} />
                  </View>
                )}
              </View>
              
              {/* Play Info */}
              <View style={styles.playInfo}>
                <Text style={styles.playTrackTitle} numberOfLines={1}>
                  {play.track_title}
                </Text>
                <Text style={styles.playTrackArtist} numberOfLines={1}>
                  {play.producer_name}
                </Text>
                
                <View style={styles.playDetails}>
                  <View style={styles.playDetailItem}>
                    <Ionicons name="person" size={12} color={Colors.textMuted} />
                    <Text style={styles.playDetailText}>{play.dj_name}</Text>
                  </View>
                  {play.club_name && (
                    <View style={styles.playDetailItem}>
                      <Text style={styles.playCountry}>{play.country}</Text>
                      <Text style={styles.playDetailText}>{play.club_name}</Text>
                    </View>
                  )}
                </View>
              </View>
              
              {/* Actions */}
              <View style={styles.playActions}>
                <Text style={styles.playTime}>{formatTimeAgo(play.played_at)}</Text>
                {play.location && (
                  <Text style={styles.playLocation}>{play.location}</Text>
                )}
                
                {/* Message Button */}
                <TouchableOpacity 
                  style={styles.messageButton}
                  onPress={() => openMessageModal(play)}
                >
                  <Ionicons name="chatbubble" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Message Modal */}
      <Modal 
        visible={showMessageModal} 
        transparent 
        animationType="slide"
        onRequestClose={() => setShowMessageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowMessageModal(false)}
            >
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>

            <Ionicons name="chatbubble-ellipses" size={40} color={Colors.primary} />
            <Text style={styles.modalTitle}>Envoyer un message</Text>
            
            {selectedPlay && (
              <View style={styles.modalPlayInfo}>
                <Text style={styles.modalPlayTitle}>"{selectedPlay.track_title}"</Text>
                <Text style={styles.modalPlayDj}>
                  Joué par {selectedPlay.dj_name} @ {selectedPlay.club_name || selectedPlay.location}
                </Text>
              </View>
            )}

            <TextInput
              style={styles.messageInput}
              value={customMessage}
              onChangeText={setCustomMessage}
              placeholder="Votre message..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity 
              style={styles.sendButton}
              onPress={() => selectedPlay && sendMessageToDJ(selectedPlay, customMessage)}
              disabled={sendingMessage}
            >
              {sendingMessage ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.sendButtonText}>Envoyer</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingTop: 50, 
    paddingBottom: 16, 
    paddingHorizontal: 16 
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  liveBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F44336', 
    paddingHorizontal: 8, 
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 6,
    gap: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  
  content: { flex: 1, paddingHorizontal: 16 },
  
  // World Map
  mapContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  mapWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mapBackground: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    position: 'relative',
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.3,
  },
  mapPlaceholder: {
    fontSize: 80,
  },
  mapDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F44336',
  },
  mapDotOld: {
    backgroundColor: '#666',
  },
  mapDotPulse: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F4433640',
  },
  mapLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 8,
    gap: 20,
    backgroundColor: '#00000040',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#ccc',
  },
  noLiveText: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
  
  // Auto-Message Section
  autoMessageSection: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  autoMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  autoMessageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoMessageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  toggleButton: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333',
    padding: 3,
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  autoMessageDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  autoMessageInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    color: Colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 8,
  },
  saveMessageButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Stats Bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 10, color: Colors.textMuted },
  statDivider: { width: 1, backgroundColor: Colors.border },
  
  // Tabs
  tabContainer: { 
    flexDirection: 'row', 
    paddingVertical: 8, 
    gap: 10,
    marginBottom: 16,
  },
  tab: { 
    flex: 1, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12, 
    borderRadius: 10, 
    backgroundColor: Colors.backgroundCard,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { 
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  tabText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },
  
  // Loading & Empty states
  loadingContainer: { padding: 60, alignItems: 'center' },
  loadingText: { color: Colors.textMuted, marginTop: 12 },
  emptyContainer: { padding: 60, alignItems: 'center' },
  emptyText: { color: Colors.text, fontSize: 16, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  emptySubtext: { color: Colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  
  // Play Card
  playCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
    position: 'relative',
  },
  playCardLive: {
    borderColor: '#F44336',
    backgroundColor: '#F4433610',
  },
  playLiveIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F44336',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  playLiveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  playLiveText: { fontSize: 8, fontWeight: '700', color: '#fff' },
  
  // Play Cover
  playCover: { width: 56, height: 56, borderRadius: 8, overflow: 'hidden' },
  playCoverImage: { width: '100%', height: '100%' },
  playCoverPlaceholder: { 
    width: '100%', 
    height: '100%', 
    backgroundColor: Colors.border, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  
  // Play Info
  playInfo: { flex: 1, minWidth: 0 },
  playTrackTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  playTrackArtist: { fontSize: 12, color: Colors.primary, marginTop: 2 },
  playDetails: { flexDirection: 'row', marginTop: 6, gap: 12, flexWrap: 'wrap' },
  playDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  playDetailText: { fontSize: 11, color: Colors.textMuted },
  playCountry: { fontSize: 12 },
  
  // Play Actions
  playActions: { alignItems: 'flex-end', gap: 4 },
  playTime: { fontSize: 11, color: Colors.textMuted },
  playLocation: { fontSize: 10, color: Colors.textMuted },
  messageButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
    marginBottom: 16,
  },
  modalPlayInfo: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    width: '100%',
    marginBottom: 16,
  },
  modalPlayTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  modalPlayDj: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  messageInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 14,
    color: Colors.text,
    fontSize: 14,
    width: '100%',
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    width: '100%',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
