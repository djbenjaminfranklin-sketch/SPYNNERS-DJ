import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Image,
  ScrollView,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { usePlayer } from '../../src/contexts/PlayerContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { base44Playlists, base44Tracks, Playlist, Track } from '../../src/services/base44Api';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

export default function PlaylistScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayer();
  
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Track detail states
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  useEffect(() => {
    loadPlaylists();
  }, [user]);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const userId = user?.id || user?._id || '';
      console.log('[Playlist] Loading playlists for user:', userId);
      
      // Get all playlists
      const allPlaylists = await base44Playlists.list();
      console.log('[Playlist] All playlists loaded:', allPlaylists.length);
      
      // Filter to show only MY playlists
      const myPlaylists = allPlaylists.filter((p: any) => {
        const playlistUserId = p.user_id || p.created_by_id || '';
        return playlistUserId === userId;
      });
      
      console.log('[Playlist] My playlists:', myPlaylists.length);
      setPlaylists(myPlaylists);
    } catch (error) {
      console.error('[Playlist] Error loading playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPlaylists();
    setRefreshing(false);
  };

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) {
      Alert.alert('Error', 'Please enter a playlist name');
      return;
    }
    
    try {
      const userId = user?.id || user?._id || '';
      await base44Playlists.create({
        name: newPlaylistName,
        user_id: userId,
        tracks: [],
        is_public: false,
      });
      
      setNewPlaylistName('');
      setShowCreateModal(false);
      loadPlaylists();
      Alert.alert('Success', 'Playlist created!');
    } catch (error) {
      console.error('[Playlist] Error creating playlist:', error);
      Alert.alert('Error', 'Failed to create playlist');
    }
  };

  // Load tracks for a specific playlist
  const loadPlaylistTracks = async (playlist: any) => {
    try {
      setLoadingTracks(true);
      const trackIds = playlist.track_ids || playlist.tracks || [];
      
      console.log('[Playlist] Loading tracks for playlist:', playlist.name, '- Track IDs:', trackIds.length);
      
      if (trackIds.length === 0) {
        setPlaylistTracks([]);
        return;
      }
      
      // Fetch all tracks and filter by IDs in the playlist
      const allTracks = await base44Tracks.list({ limit: 200 });
      const filteredTracks = allTracks.filter((track: Track) => {
        const trackId = track.id || track._id || '';
        return trackIds.includes(trackId);
      });
      
      console.log('[Playlist] Loaded tracks:', filteredTracks.length);
      setPlaylistTracks(filteredTracks);
    } catch (error) {
      console.error('[Playlist] Error loading playlist tracks:', error);
      setPlaylistTracks([]);
    } finally {
      setLoadingTracks(false);
    }
  };

  const openPlaylist = async (playlist: any) => {
    setSelectedPlaylist(playlist);
    setShowDetailModal(true);
    await loadPlaylistTracks(playlist);
  };

  // Play all tracks in playlist
  const playAllTracks = async () => {
    if (playlistTracks.length > 0) {
      // Pass the entire playlist to enable next/previous
      await playTrack(playlistTracks[0], playlistTracks);
    }
  };
  
  // Play a single track from playlist (with queue)
  const playSingleTrack = async (track: Track) => {
    await playTrack(track, playlistTracks);
  };

  // Share playlist
  const handleSharePlaylist = async () => {
    if (!selectedPlaylist) return;
    try {
      const playlistId = selectedPlaylist.id || selectedPlaylist._id;
      const playlistUrl = `https://spynners.com/playlist/${playlistId}`;
      await Share.share({
        message: `Check out my playlist "${selectedPlaylist.name}" on SPYNNERS! ${playlistUrl}`,
        url: playlistUrl,
        title: selectedPlaylist.name,
      });
    } catch (error) {
      console.error('[Playlist] Share error:', error);
    }
  };

  // Get cover image URL
  const getCoverImageUrl = (track: Track): string | null => {
    const url = track.artwork_url || track.cover_image;
    if (url) {
      if (url.startsWith('http')) return url;
      return `https://base44.app/api/apps/691a4d96d819355b52c063f3/files/public/691a4d96d819355b52c063f3/${url}`;
    }
    return null;
  };

  // Get artist name
  const getArtistName = (track: Track): string => {
    return track.producer_name || track.artist_name || 'Unknown Artist';
  };

  const renderPlaylist = ({ item }: { item: any }) => {
    const trackCount = item.track_ids?.length || item.tracks?.length || 0;
    const coverUrl = item.cover_url;
    
    return (
      <TouchableOpacity 
        style={styles.playlistCard}
        onPress={() => openPlaylist(item)}
        activeOpacity={0.7}
      >
        {/* Cover Image */}
        <View style={styles.playlistCover}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="musical-notes" size={28} color={Colors.textMuted} />
            </View>
          )}
        </View>
        
        <View style={styles.playlistInfo}>
          <Text style={styles.playlistName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.playlistCount}>
            {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
          </Text>
        </View>

        <View style={styles.playlistMeta}>
          {item.is_public ? (
            <Ionicons name="globe-outline" size={16} color={Colors.textMuted} />
          ) : (
            <Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} />
          )}
        </View>

        <View style={styles.chevron}>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('page.myPlaylists')}</Text>
          <Text style={styles.headerSubtitle}>{playlists.length} playlists</Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Playlist List */}
      {playlists.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="list-outline" size={80} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{t('page.noPlaylists')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('page.createPlaylistHint') || 'Create your first playlist to organize your favorite tracks'}
          </Text>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <LinearGradient colors={[Colors.primary, '#7B1FA2']} style={styles.createButtonGradient}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createButtonText}>{t('page.createPlaylist')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id || item._id || Math.random().toString()}
          renderItem={renderPlaylist}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        />
      )}

      {/* Create Playlist Modal */}
      <Modal visible={showCreateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('page.createPlaylist')}</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder={t('page.playlistName')}
              placeholderTextColor={Colors.textMuted}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewPlaylistName('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalCreateButton}
                onPress={createPlaylist}
              >
                <LinearGradient colors={[Colors.primary, '#7B1FA2']} style={styles.modalCreateGradient}>
                  <Text style={styles.modalCreateText}>Create</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Playlist Detail Modal */}
      <Modal visible={showDetailModal} transparent animationType="slide">
        <View style={styles.detailModalOverlay}>
          <View style={styles.detailModalContent}>
            <View style={styles.detailModalHeader}>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.detailModalTitle}>{selectedPlaylist?.name}</Text>
              <View style={{ width: 28 }} />
            </View>

            {selectedPlaylist?.cover_url ? (
              <Image source={{ uri: selectedPlaylist.cover_url }} style={styles.detailCover} />
            ) : (
              <View style={[styles.detailCover, styles.detailCoverPlaceholder]}>
                <Ionicons name="musical-notes" size={60} color={Colors.textMuted} />
              </View>
            )}

            <View style={styles.detailInfo}>
              <Text style={styles.detailTrackCount}>
                {playlistTracks.length} tracks
              </Text>
              {selectedPlaylist?.description && (
                <Text style={styles.detailDescription}>{selectedPlaylist.description}</Text>
              )}
            </View>

            <View style={styles.detailActions}>
              <TouchableOpacity style={styles.detailActionButton} onPress={playAllTracks}>
                <LinearGradient colors={[Colors.primary, '#7B1FA2']} style={styles.detailActionGradient}>
                  <Ionicons name="play" size={24} color="#fff" />
                  <Text style={styles.detailActionText}>{t('common.playAll')}</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.detailActionButton} onPress={() => {
                if (playlistTracks.length > 0) {
                  const randomIndex = Math.floor(Math.random() * playlistTracks.length);
                  playTrack(playlistTracks[randomIndex]);
                }
              }}>
                <View style={styles.detailActionOutline}>
                  <Ionicons name="shuffle" size={24} color={Colors.primary} />
                  <Text style={[styles.detailActionText, { color: Colors.primary }]}>{t('common.shuffle')}</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Share Button */}
            <TouchableOpacity style={styles.sharePlaylistButton} onPress={handleSharePlaylist}>
              <Ionicons name="share-social-outline" size={20} color={Colors.primary} />
              <Text style={styles.sharePlaylistText}>Share Playlist</Text>
            </TouchableOpacity>

            {/* Track List */}
            <View style={styles.trackListContainer}>
              <Text style={styles.trackListTitle}>{t('playlist.tracks')}</Text>
              
              {loadingTracks ? (
                <View style={styles.trackListLoading}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.trackListLoadingText}>{t('playlist.loadingTracks')}</Text>
                </View>
              ) : playlistTracks.length === 0 ? (
                <View style={styles.trackListEmpty}>
                  <Ionicons name="musical-notes-outline" size={40} color={Colors.textMuted} />
                  <Text style={styles.trackListEmptyText}>{t('playlist.noTracksInPlaylist')}</Text>
                  <Text style={styles.trackListEmptySubtext}>{t('playlist.addTracksHint')}</Text>
                </View>
              ) : (
                <ScrollView style={styles.trackList} showsVerticalScrollIndicator={false}>
                  {playlistTracks.map((track, index) => {
                    const trackId = track.id || track._id || '';
                    const isCurrentTrack = currentTrack && (currentTrack.id || currentTrack._id) === trackId;
                    const coverUrl = getCoverImageUrl(track);
                    
                    return (
                      <TouchableOpacity 
                        key={trackId} 
                        style={[styles.trackItem, isCurrentTrack && styles.trackItemActive]}
                        onPress={() => playTrack(track)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.trackNumber}>{index + 1}</Text>
                        
                        <View style={styles.trackItemCover}>
                          {coverUrl ? (
                            <Image source={{ uri: coverUrl }} style={styles.trackItemCoverImage} />
                          ) : (
                            <View style={styles.trackItemCoverPlaceholder}>
                              <Ionicons name="musical-notes" size={16} color={Colors.textMuted} />
                            </View>
                          )}
                        </View>
                        
                        <View style={styles.trackItemInfo}>
                          <Text style={[styles.trackItemTitle, isCurrentTrack && styles.trackItemTitleActive]} numberOfLines={1}>
                            {track.title}
                          </Text>
                          <Text style={styles.trackItemArtist} numberOfLines={1}>
                            {getArtistName(track)} • {track.bpm || '—'} BPM
                          </Text>
                        </View>
                        
                        {isCurrentTrack && isPlaying ? (
                          <TouchableOpacity onPress={togglePlayPause}>
                            <Ionicons name="pause-circle" size={32} color={Colors.primary} />
                          </TouchableOpacity>
                        ) : (
                          <Ionicons name="play-circle-outline" size={32} color={Colors.textMuted} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { color: Colors.textMuted, marginTop: 12 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingTop: 50, 
    paddingBottom: 16, 
    paddingHorizontal: 16,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  addButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playlistCover: {
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
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistInfo: { flex: 1 },
  playlistName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  playlistCount: { fontSize: 12, color: Colors.primary, marginTop: 2 },
  playlistMeta: { marginRight: 8 },
  chevron: { marginLeft: 4 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: { fontSize: 22, fontWeight: '600', color: Colors.text, marginTop: 20 },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted, marginTop: 8, textAlign: 'center' },
  createButton: { marginTop: 24, borderRadius: 12, overflow: 'hidden' },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  createButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: { fontSize: 20, fontWeight: '600', color: Colors.text, textAlign: 'center', marginBottom: 20 },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 14,
    color: Colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  modalCancelText: { color: Colors.textMuted, fontSize: 16, fontWeight: '500' },
  modalCreateButton: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  modalCreateGradient: { padding: 14, alignItems: 'center' },
  modalCreateText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  // Detail Modal
  detailModalOverlay: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  detailModalContent: {
    flex: 1,
    paddingTop: 50,
  },
  detailModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  detailModalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  detailCover: {
    width: 200,
    height: 200,
    borderRadius: 12,
    alignSelf: 'center',
  },
  detailCoverPlaceholder: {
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailInfo: { alignItems: 'center', marginTop: 20 },
  detailTrackCount: { fontSize: 16, color: Colors.textMuted },
  detailDescription: { fontSize: 14, color: Colors.text, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
  detailActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 24 },
  detailActionButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  detailActionGradient: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 14, gap: 8 },
  detailActionOutline: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 14, gap: 8, borderWidth: 1, borderColor: Colors.primary, borderRadius: 12 },
  detailActionText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  sharePlaylistButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8, 
    paddingVertical: 12, 
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    backgroundColor: Colors.primary + '10',
  },
  sharePlaylistText: { color: Colors.primary, fontSize: 14, fontWeight: '500' },
  // Track list styles
  trackListContainer: { flex: 1, marginTop: 20, paddingHorizontal: 16 },
  trackListTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  trackListLoading: { alignItems: 'center', paddingVertical: 30 },
  trackListLoadingText: { color: Colors.textMuted, marginTop: 8, fontSize: 14 },
  trackListEmpty: { alignItems: 'center', paddingVertical: 30 },
  trackListEmptyText: { color: Colors.text, fontSize: 16, fontWeight: '500', marginTop: 12 },
  trackListEmptySubtext: { color: Colors.textMuted, fontSize: 13, marginTop: 4 },
  trackList: { flex: 1 },
  trackItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 10, 
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: Colors.backgroundCard,
    gap: 10,
  },
  trackItemActive: { backgroundColor: Colors.primary + '20', borderWidth: 1, borderColor: Colors.primary },
  trackNumber: { width: 24, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  trackItemCover: { width: 44, height: 44, borderRadius: 6, overflow: 'hidden' },
  trackItemCoverImage: { width: '100%', height: '100%' },
  trackItemCoverPlaceholder: { 
    width: '100%', 
    height: '100%', 
    backgroundColor: Colors.background, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  trackItemInfo: { flex: 1, minWidth: 0 },
  trackItemTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  trackItemTitleActive: { color: Colors.primary },
  trackItemArtist: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});
