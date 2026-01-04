import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import axios from 'axios';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || 'https://spyn-rebuild.preview.emergentagent.com';

// Colors
const CYAN_COLOR = '#5CB3CC';
const DARK_BG = '#0a0a0a';
const CARD_BG = '#1a1a2e';
const GREEN_COLOR = '#4CAF50';
const RED_COLOR = '#E53935';
const ORANGE_COLOR = '#FF9800';

interface Track {
  id: string;
  title: string;
  producer_name?: string;
  producer_id?: string;
  genre?: string;
  bpm?: number;
  artwork_url?: string;
  audio_url?: string;
  status?: string;
  plays_count?: number;
  downloads_count?: number;
  likes_count?: number;
  acrcloud_id?: string;
  created_at?: string;
  isrc?: string;
}

export default function ManageTracksScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { t } = useLanguage();
  
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchTracks();
    }
  }, [token]);

  const fetchTracks = async () => {
    try {
      setLoading(true);
      
      if (!token) {
        console.log('[Tracks] No token, cannot fetch tracks');
        setLoading(false);
        return;
      }
      
      console.log('[Tracks] Fetching user tracks via native API...');
      
      // Use the new native API endpoint
      const response = await axios.post(
        `${BACKEND_URL}/api/tracks/my`,
        {
          status: 'approved',
          limit: 100,
          offset: 0
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('[Tracks] API response:', response.data);
      
      // Handle the response from native API
      if (response.data?.success && response.data?.tracks) {
        const userTracks = response.data.tracks.map((track: any) => ({
          id: track.id || track._id,
          title: track.title || 'Unknown',
          producer_name: track.producer_name || track.artist,
          producer_id: track.producer_id || track.created_by_id,
          genre: track.genre || 'House',
          bpm: track.bpm,
          artwork_url: track.artwork_url || track.cover_image,
          audio_url: track.audio_url || track.audio_file,
          status: track.status || 'approved',
          plays_count: track.plays_count || 0,
          downloads_count: track.downloads_count || 0,
          likes_count: track.likes_count || 0,
          acrcloud_id: track.acrcloud_id,
          created_at: track.created_at || track.created_date,
          isrc: track.isrc,
        }));
        
        console.log('[Tracks] Processed tracks:', userTracks.length);
        setTracks(userTracks);
      } else if (Array.isArray(response.data)) {
        // Fallback: direct array response
        const userTracks = response.data.map((track: any) => ({
          id: track.id || track._id,
          title: track.title || 'Unknown',
          producer_name: track.producer_name || track.artist,
          producer_id: track.producer_id || track.created_by_id,
          genre: track.genre || 'House',
          bpm: track.bpm,
          artwork_url: track.artwork_url || track.cover_image,
          audio_url: track.audio_url || track.audio_file,
          status: track.status || 'approved',
          plays_count: track.plays_count || 0,
          downloads_count: track.downloads_count || 0,
          likes_count: track.likes_count || 0,
          acrcloud_id: track.acrcloud_id,
          created_at: track.created_at || track.created_date,
          isrc: track.isrc,
        }));
        setTracks(userTracks);
      } else {
        console.log('[Tracks] No tracks in response');
        setTracks([]);
      }
    } catch (error: any) {
      console.error('[Tracks] Error fetching tracks:', error?.response?.data || error.message);
      // Don't show alert for empty results
      if (error?.response?.status !== 404) {
        Alert.alert('Error', 'Could not load your tracks. Please try again.');
      }
      setTracks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTracks();
  };

  const syncWithACRCloud = async (track: Track) => {
    try {
      setSyncing(track.id);
      
      // Call sync function
      const response = await axios.post(
        `${BACKEND_URL}/api/base44/functions/invoke/syncTrackToACRCloud`,
        { trackId: track.id },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        Alert.alert('Success', 'Track synced with ACRCloud');
        fetchTracks(); // Refresh list
      } else {
        Alert.alert('Error', response.data.message || 'Sync failed');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      Alert.alert('Error', error?.response?.data?.detail || 'Could not sync track');
    } finally {
      setSyncing(null);
    }
  };

  const deleteTrack = async (track: Track) => {
    Alert.alert(
      'Delete Track',
      `Are you sure you want to delete "${track.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(
                `${BACKEND_URL}/api/base44/entities/Track/${track.id}`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  }
                }
              );
              Alert.alert('Success', 'Track deleted');
              setShowTrackModal(false);
              fetchTracks();
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Could not delete track');
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return GREEN_COLOR;
      case 'pending':
        return ORANGE_COLOR;
      case 'rejected':
        return RED_COLOR;
      default:
        return Colors.textMuted;
    }
  };

  const filteredTracks = tracks.filter(track => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      track.title?.toLowerCase().includes(query) ||
      track.genre?.toLowerCase().includes(query)
    );
  });

  const openTrackDetails = (track: Track) => {
    setSelectedTrack(track);
    setShowTrackModal(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={CYAN_COLOR} />
        <Text style={styles.loadingText}>Loading your tracks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Your Tracks</Text>
        <TouchableOpacity onPress={() => router.push('/upload')} style={styles.addButton}>
          <Ionicons name="add" size={24} color={CYAN_COLOR} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tracks..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{tracks.length}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {tracks.filter(t => t.acrcloud_id).length}
          </Text>
          <Text style={styles.statLabel}>Synced</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {tracks.filter(t => !t.acrcloud_id).length}
          </Text>
          <Text style={styles.statLabel}>Not Synced</Text>
        </View>
      </View>

      {/* Tracks List */}
      <ScrollView
        style={styles.tracksList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CYAN_COLOR} />
        }
      >
        {filteredTracks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No tracks match your search' : 'You have no tracks yet'}
            </Text>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => router.push('/upload')}
            >
              <Ionicons name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.uploadButtonText}>Upload Track</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredTracks.map((track) => (
            <TouchableOpacity
              key={track.id}
              style={styles.trackCard}
              onPress={() => openTrackDetails(track)}
            >
              <Image
                source={{ uri: track.artwork_url || 'https://via.placeholder.com/80' }}
                style={styles.trackArtwork}
              />
              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.trackGenre}>{track.genre || 'Unknown Genre'}</Text>
                <View style={styles.trackMeta}>
                  {track.bpm && (
                    <Text style={styles.trackBpm}>{track.bpm} BPM</Text>
                  )}
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(track.status) + '30' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(track.status) }]}>
                      {track.status || 'Unknown'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.trackActions}>
                {track.acrcloud_id ? (
                  <Ionicons name="checkmark-circle" size={24} color={GREEN_COLOR} />
                ) : (
                  <TouchableOpacity
                    onPress={() => syncWithACRCloud(track)}
                    disabled={syncing === track.id}
                  >
                    {syncing === track.id ? (
                      <ActivityIndicator size="small" color={CYAN_COLOR} />
                    ) : (
                      <Ionicons name="sync" size={24} color={ORANGE_COLOR} />
                    )}
                  </TouchableOpacity>
                )}
                <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Track Details Modal */}
      <Modal
        visible={showTrackModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTrackModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowTrackModal(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>

            {selectedTrack && (
              <ScrollView>
                <Image
                  source={{ uri: selectedTrack.artwork_url || 'https://via.placeholder.com/200' }}
                  style={styles.modalArtwork}
                />
                <Text style={styles.modalTitle}>{selectedTrack.title}</Text>
                <Text style={styles.modalSubtitle}>{selectedTrack.genre}</Text>

                <View style={styles.modalStats}>
                  <View style={styles.modalStatItem}>
                    <Ionicons name="play" size={20} color={CYAN_COLOR} />
                    <Text style={styles.modalStatValue}>{selectedTrack.plays_count || 0}</Text>
                    <Text style={styles.modalStatLabel}>Plays</Text>
                  </View>
                  <View style={styles.modalStatItem}>
                    <Ionicons name="download" size={20} color={CYAN_COLOR} />
                    <Text style={styles.modalStatValue}>{selectedTrack.downloads_count || 0}</Text>
                    <Text style={styles.modalStatLabel}>Downloads</Text>
                  </View>
                  <View style={styles.modalStatItem}>
                    <Ionicons name="heart" size={20} color={CYAN_COLOR} />
                    <Text style={styles.modalStatValue}>{selectedTrack.likes_count || 0}</Text>
                    <Text style={styles.modalStatLabel}>Likes</Text>
                  </View>
                </View>

                <View style={styles.modalDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <Text style={[styles.detailValue, { color: getStatusColor(selectedTrack.status) }]}>
                      {selectedTrack.status || 'Unknown'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>BPM</Text>
                    <Text style={styles.detailValue}>{selectedTrack.bpm || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>ISRC</Text>
                    <Text style={styles.detailValue}>{selectedTrack.isrc || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>ACRCloud</Text>
                    <Text style={[styles.detailValue, { color: selectedTrack.acrcloud_id ? GREEN_COLOR : ORANGE_COLOR }]}>
                      {selectedTrack.acrcloud_id ? 'Synced' : 'Not Synced'}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  {!selectedTrack.acrcloud_id && (
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: CYAN_COLOR }]}
                      onPress={() => {
                        setShowTrackModal(false);
                        syncWithACRCloud(selectedTrack);
                      }}
                    >
                      <Ionicons name="sync" size={20} color="#fff" />
                      <Text style={styles.modalButtonText}>Sync to ACRCloud</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: RED_COLOR }]}
                    onPress={() => deleteTrack(selectedTrack)}
                  >
                    <Ionicons name="trash" size={20} color="#fff" />
                    <Text style={styles.modalButtonText}>Delete Track</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textMuted,
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: CARD_BG,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: CARD_BG,
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: CYAN_COLOR,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  tracksList: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CYAN_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  trackArtwork: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  trackGenre: {
    fontSize: 13,
    color: CYAN_COLOR,
    marginTop: 2,
  },
  trackMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 10,
  },
  trackBpm: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  trackActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  modalArtwork: {
    width: 150,
    height: 150,
    borderRadius: 12,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: CYAN_COLOR,
    textAlign: 'center',
    marginTop: 4,
  },
  modalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#333',
  },
  modalStatItem: {
    alignItems: 'center',
  },
  modalStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  modalStatLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  modalDetails: {
    marginTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  detailValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  modalButtons: {
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
