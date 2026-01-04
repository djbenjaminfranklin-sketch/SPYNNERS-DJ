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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { usePlayer } from '../../src/contexts/PlayerContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { base44Users, base44Tracks, Track } from '../../src/services/base44Api';
import { LinearGradient } from 'expo-linear-gradient';

export default function ArtistProfileScreen() {
  const { id } = useLocalSearchParams();
  const { user, token } = useAuth();
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const router = useRouter();
  
  const [artist, setArtist] = useState<any>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (id) {
      loadArtistProfile();
    }
  }, [id]);

  const loadArtistProfile = async () => {
    try {
      setLoading(true);
      
      // Load artist profile
      const profiles = await base44Users.getPublicProfiles(id as string);
      if (profiles && profiles.length > 0) {
        setArtist(profiles[0]);
      }
      
      // Load artist's tracks
      const allTracks = await base44Tracks.list({ limit: 100 });
      const artistTracks = allTracks.filter((track: Track) => 
        track.producer_id === id || track.created_by_id === id
      );
      setTracks(artistTracks);
      
    } catch (error) {
      console.error('[Artist] Error loading profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadArtistProfile();
  };

  const handlePlayTrack = (track: Track) => {
    playTrack(track);
  };

  const getCoverImageUrl = (track: Track) => {
    return track.artwork_url || track.cover_image || track.cover_url || null;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading artist profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Artist Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: currentTrack ? 120 : 40 }}
      >
        {/* Artist Info Card */}
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.artistCard}>
          <View style={styles.artistAvatarContainer}>
            {artist?.profile_image ? (
              <Image source={{ uri: artist.profile_image }} style={styles.artistAvatar} />
            ) : (
              <View style={styles.artistAvatarPlaceholder}>
                <Ionicons name="person" size={40} color={Colors.textMuted} />
              </View>
            )}
          </View>
          
          <Text style={styles.artistName}>{artist?.full_name || artist?.name || 'Unknown Artist'}</Text>
          
          {artist?.user_type && (
            <View style={styles.artistTypeBadge}>
              <Text style={styles.artistTypeText}>{artist.user_type}</Text>
            </View>
          )}
          
          {artist?.bio && (
            <Text style={styles.artistBio}>{artist.bio}</Text>
          )}
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{tracks.length}</Text>
              <Text style={styles.statLabel}>Tracks</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{artist?.followers_count || 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{artist?.total_plays || 0}</Text>
              <Text style={styles.statLabel}>Plays</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Tracks Section */}
        <View style={styles.tracksSection}>
          <Text style={styles.sectionTitle}>Tracks ({tracks.length})</Text>
          
          {tracks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="musical-notes-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No tracks yet</Text>
            </View>
          ) : (
            tracks.map((track) => {
              const trackId = track.id || track._id || '';
              const isCurrentTrack = currentTrack && (currentTrack.id || currentTrack._id) === trackId;
              const coverUrl = getCoverImageUrl(track);
              
              return (
                <TouchableOpacity
                  key={trackId}
                  style={[styles.trackCard, isCurrentTrack && styles.trackCardActive]}
                  onPress={() => handlePlayTrack(track)}
                  activeOpacity={0.7}
                >
                  <View style={styles.trackCover}>
                    {coverUrl ? (
                      <Image source={{ uri: coverUrl }} style={styles.coverImage} />
                    ) : (
                      <View style={styles.coverPlaceholder}>
                        <Ionicons name="musical-notes" size={20} color={Colors.textMuted} />
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                    <Text style={styles.trackMeta}>
                      {track.genre || 'Unknown'} • {track.bpm || '—'} BPM
                    </Text>
                  </View>
                  
                  <View style={styles.playButton}>
                    <Ionicons 
                      name={isCurrentTrack && isPlaying ? 'pause' : 'play'} 
                      size={20} 
                      color="#fff" 
                    />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
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
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  scrollView: {
    flex: 1,
  },
  artistCard: {
    margin: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  artistAvatarContainer: {
    marginBottom: 16,
  },
  artistAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  artistAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artistName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  artistTypeBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  artistTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  artistBio: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  tracksSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  trackCardActive: {
    borderColor: Colors.primary,
    borderWidth: 1,
  },
  trackCover: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  trackMeta: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
