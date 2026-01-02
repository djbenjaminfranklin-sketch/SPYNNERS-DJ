import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { usePlayer } from '../../src/contexts/PlayerContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { base44Tracks, Track } from '../../src/services/base44Api';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

export default function LibraryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayer();
  
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMyUploads();
  }, [user]);

  const loadMyUploads = async () => {
    if (!user?.id && !user?._id) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const userId = user.id || user._id || '';
      console.log('[Library] Loading uploads for user:', userId);
      
      // Get ALL tracks with higher limit to make sure we get all user's tracks
      const allTracks = await base44Tracks.list({ limit: 500 });
      
      // Filter by user - show user's tracks but NOT rejected
      const myTracks = allTracks.filter((track: Track) => {
        const isMyTrack = track.created_by_id === userId || 
                          track.producer_id === userId ||
                          track.uploaded_by === userId;
        const isNotRejected = track.status !== 'rejected';
        return isMyTrack && isNotRejected;
      });
      
      console.log('[Library] My uploads (all statuses):', myTracks.length);
      setTracks(myTracks);
    } catch (e) {
      console.error('[Library] fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMyUploads();
    setRefreshing(false);
  };

  // Get cover image URL - same as home.tsx
  const getCoverImageUrl = (track: Track): string | null => {
    const url = track.artwork_url || track.cover_image;
    if (url) {
      if (url.startsWith('http')) {
        return url;
      }
      // Base44 file URL format
      return `https://base44.app/api/apps/691a4d96d819355b52c063f3/files/public/691a4d96d819355b52c063f3/${url}`;
    }
    return null;
  };

  // Get artist name
  const getArtistName = (track: Track): string => {
    return track.producer_name || track.artist_name || 'Unknown Artist';
  };

  // Get status badge color
  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'approved': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'rejected': return '#F44336';
      default: return Colors.textMuted;
    }
  };

  const renderTrack = ({ item }: { item: Track }) => {
    const coverUrl = getCoverImageUrl(item);
    const trackId = item.id || item._id || '';
    const isCurrentTrack = currentTrack && (currentTrack.id || currentTrack._id) === trackId;
    
    return (
      <TouchableOpacity 
        style={[styles.trackCard, isCurrentTrack && styles.trackCardActive]}
        onPress={() => playTrack(item)}
        activeOpacity={0.7}
      >
        {/* Play Button */}
        <TouchableOpacity 
          style={styles.playButton} 
          onPress={() => isCurrentTrack ? togglePlayPause() : playTrack(item)}
        >
          <Ionicons 
            name={isCurrentTrack && isPlaying ? 'pause' : 'play'} 
            size={20} 
            color="#fff" 
          />
        </TouchableOpacity>

        {/* Cover Image */}
        <View style={styles.trackCover}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="musical-notes" size={24} color={Colors.textMuted} />
            </View>
          )}
        </View>

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <Text style={[styles.trackTitle, isCurrentTrack && styles.trackTitleActive]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>{getArtistName(item)}</Text>
          <View style={styles.trackMeta}>
            <Text style={styles.trackGenre}>{item.genre}</Text>
            {item.bpm ? <Text style={styles.trackBpm}>{item.bpm} BPM</Text> : null}
          </View>
        </View>

        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status || 'unknown'}
            </Text>
          </View>
          
          {/* Stats */}
          <View style={styles.trackStats}>
            <View style={styles.statItem}>
              <Ionicons name="play" size={12} color={Colors.textMuted} />
              <Text style={styles.statText}>{item.play_count || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="download" size={12} color={Colors.textMuted} />
              <Text style={styles.statText}>{item.download_count || 0}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <Text style={styles.headerTitle}>{t('page.myUploads')}</Text>
        <View style={styles.headerRight}>
          <Text style={styles.trackCount}>{tracks.length} tracks</Text>
          <TouchableOpacity 
            style={styles.uploadButton}
            onPress={() => router.push('/(tabs)/upload')}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Track List */}
      {tracks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-upload-outline" size={80} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{t('page.noTracks')}</Text>
          <Text style={styles.emptySubtitle}>{t('upload.firstTrackHint') || 'Upload your first track to get started'}</Text>
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)/upload')}
          >
            <LinearGradient colors={[Colors.primary, '#7B1FA2']} style={styles.emptyButtonGradient}>
              <Ionicons name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>{t('page.uploadTrack')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id || item._id || Math.random().toString()}
          renderItem={renderTrack}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.textMuted,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trackCount: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  uploadButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
    paddingBottom: 100, // Space for global player
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  trackCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackCover: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackInfo: {
    flex: 1,
    minWidth: 0,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  trackTitleActive: {
    color: Colors.primary,
  },
  trackArtist: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: 2,
  },
  trackMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  trackGenre: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  trackBpm: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  statusContainer: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  trackStats: {
    flexDirection: 'row',
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
