import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import { base44Notifications, base44Tracks, Track } from '../../src/services/base44Api';
import { useAuth } from '../../src/contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Live radar play data structure
interface RadarPlay {
  id: string;
  track_id: string;
  track_title: string;
  track_artwork?: string;
  producer_name: string;
  dj_name: string;
  location?: string;
  club_name?: string;
  country?: string;
  played_at: string;
  is_live: boolean;
}

export default function LiveRadarScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentPlays, setRecentPlays] = useState<RadarPlay[]>([]);
  const [myTracksCount, setMyTracksCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'global' | 'my_tracks'>('global');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userId = user?.id || user?._id || '';
      
      // Fetch live track plays from Base44 function
      // If on "my_tracks" tab, pass producer ID to filter
      const producerId = activeTab === 'my_tracks' ? userId : undefined;
      
      console.log('[LiveRadar] Fetching plays for:', activeTab, producerId);
      const plays = await base44Notifications.getLiveTrackPlays(producerId);
      
      // Transform the data to our format
      const formattedPlays: RadarPlay[] = plays.map((play: any, index: number) => ({
        id: play.id || play._id || `play-${index}`,
        track_id: play.track_id || play.trackId || '',
        track_title: play.track_title || play.trackTitle || 'Unknown Track',
        track_artwork: play.track_artwork || play.trackArtwork || play.artwork_url || '',
        producer_name: play.producer_name || play.producerName || play.artist_name || 'Unknown',
        dj_name: play.dj_name || play.djName || 'Unknown DJ',
        location: play.location || play.city || '',
        club_name: play.club_name || play.clubName || play.venue || '',
        country: play.country || getCountryFlag(play.location || play.city),
        played_at: play.played_at || play.playedAt || play.created_at || new Date().toISOString(),
        is_live: isPlayLive(play.played_at || play.playedAt || play.created_at),
      }));
      
      setRecentPlays(formattedPlays);
      
      // Count user's tracks for stats
      if (userId) {
        const userTracks = await base44Tracks.list({ limit: 100 });
        const myTracks = userTracks.filter((t: Track) => 
          t.producer_id === userId || t.created_by_id === userId || t.uploaded_by === userId
        );
        setMyTracksCount(myTracks.length);
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
      'paris': '🇫🇷', 'france': '🇫🇷', 'lyon': '🇫🇷',
      'ibiza': '🇪🇸', 'spain': '🇪🇸', 'madrid': '🇪🇸', 'barcelona': '🇪🇸',
      'amsterdam': '🇳🇱', 'netherlands': '🇳🇱',
      'new york': '🇺🇸', 'usa': '🇺🇸', 'los angeles': '🇺🇸', 'miami': '🇺🇸',
      'tokyo': '🇯🇵', 'japan': '🇯🇵',
      'sydney': '🇦🇺', 'australia': '🇦🇺',
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
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
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
          <Text style={styles.headerTitle}>Live Radar</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Stats Summary */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Ionicons name="radio" size={20} color={Colors.primary} />
          <Text style={styles.statValue}>{recentPlays.filter(p => p.is_live).length}</Text>
          <Text style={styles.statLabel}>Live Now</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="play-circle" size={20} color="#4CAF50" />
          <Text style={styles.statValue}>{recentPlays.length}</Text>
          <Text style={styles.statLabel}>Recent Plays</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="musical-notes" size={20} color="#FF9800" />
          <Text style={styles.statValue}>{myTracksCount}</Text>
          <Text style={styles.statLabel}>My Tracks</Text>
        </View>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'global' && styles.tabActive]}
          onPress={() => setActiveTab('global')}
        >
          <Ionicons name="globe" size={18} color={activeTab === 'global' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'global' && styles.tabTextActive]}>
            Global Activity
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'my_tracks' && styles.tabActive]}
          onPress={() => setActiveTab('my_tracks')}
        >
          <Ionicons name="person" size={18} color={activeTab === 'my_tracks' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'my_tracks' && styles.tabTextActive]}>
            My Tracks
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recent Plays List */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading live activity...</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="warning-outline" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadData}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : recentPlays.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="radio-outline" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {activeTab === 'my_tracks' 
                ? 'No recent plays of your tracks' 
                : 'No recent activity'
              }
            </Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'my_tracks'
                ? 'Upload more tracks to get noticed by DJs!'
                : 'Check back later for live updates'
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
              
              {/* Time & Location */}
              <View style={styles.playMeta}>
                <Text style={styles.playTime}>{formatTimeAgo(play.played_at)}</Text>
                {play.location && (
                  <Text style={styles.playLocation}>{play.location}</Text>
                )}
              </View>
            </View>
          ))
        )}
        
        <View style={{ height: 30 }} />
      </ScrollView>
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
  
  // Stats Bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
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
    paddingHorizontal: 12, 
    paddingVertical: 12, 
    gap: 10 
  },
  tab: { 
    flex: 1, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12, 
    paddingHorizontal: 12,
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
  
  // Content
  content: { flex: 1, paddingHorizontal: 12 },
  loadingContainer: { padding: 60, alignItems: 'center' },
  loadingText: { color: Colors.textMuted, marginTop: 12 },
  emptyContainer: { padding: 60, alignItems: 'center' },
  emptyText: { color: Colors.text, fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  emptySubtext: { color: Colors.textMuted, fontSize: 14, marginTop: 4, textAlign: 'center' },
  retryButton: { 
    marginTop: 16, 
    paddingHorizontal: 24, 
    paddingVertical: 10, 
    backgroundColor: Colors.primary, 
    borderRadius: 8 
  },
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
  playDetails: { flexDirection: 'row', marginTop: 6, gap: 12 },
  playDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  playDetailText: { fontSize: 11, color: Colors.textMuted },
  playCountry: { fontSize: 12 },
  
  // Play Meta
  playMeta: { alignItems: 'flex-end' },
  playTime: { fontSize: 11, color: Colors.textMuted },
  playLocation: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
});
