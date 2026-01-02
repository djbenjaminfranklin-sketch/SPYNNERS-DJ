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
import { base44Tracks, Track } from '../../src/services/base44Api';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

export default function LibraryScreen() {
  const { user } = useAuth();
  const router = useRouter();
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
      
      // Get all tracks and filter by user
      const allTracks = await base44Tracks.list({ limit: 100 });
      const myTracks = allTracks.filter((track: Track) => 
        track.created_by_id === userId || 
        track.producer_id === userId ||
        track.uploaded_by === userId
      );
      
      console.log('[Library] My uploads:', myTracks.length);
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

  const renderTrack = ({ item }: { item: Track }) => {
    const coverUrl = getCoverImageUrl(item);
    
    return (
      <View style={styles.trackCard}>
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
          <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.trackArtist} numberOfLines={1}>{getArtistName(item)}</Text>
          <View style={styles.trackMeta}>
            <Text style={styles.trackGenre}>{item.genre}</Text>
            {item.bpm ? <Text style={styles.trackBpm}>{item.bpm} BPM</Text> : null}
          </View>
        </View>

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{status.toUpperCase()}</Text>
        </View>

        {/* Stats */}
        <View style={styles.trackStats}>
          <View style={styles.statItem}>
            <Ionicons name="play" size={14} color={Colors.textMuted} />
            <Text style={styles.statText}>{item.play_count || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="download" size={14} color={Colors.textMuted} />
            <Text style={styles.statText}>{item.download_count || 0}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your uploads...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <Text style={styles.headerTitle}>My Uploads</Text>
        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={() => router.push('/(tabs)/upload')}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Track List */}
      {tracks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-upload-outline" size={80} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Uploads Yet</Text>
          <Text style={styles.emptySubtitle}>Upload your first track to get started</Text>
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)/upload')}
          >
            <LinearGradient colors={[Colors.primary, '#7B1FA2']} style={styles.emptyButtonGradient}>
              <Ionicons name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Upload Track</Text>
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
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trackCover: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
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
    marginRight: 10,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  trackArtist: {
    fontSize: 13,
    color: Colors.primary,
    marginBottom: 4,
  },
  trackMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  trackGenre: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  trackBpm: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 10,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  trackStats: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
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
