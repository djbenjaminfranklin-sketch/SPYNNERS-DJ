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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { base44Playlists, Playlist } from '../../src/services/base44Api';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

export default function PlaylistScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  useEffect(() => {
    loadPlaylists();
  }, [user]);

  const loadPlaylists = async () => {
    if (!user?.id && !user?._id) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const userId = user.id || user._id || '';
      console.log('[Playlist] Loading playlists for user:', userId);
      
      // Get all playlists and filter by current user only
      const result = await base44Playlists.list(userId);
      console.log('[Playlist] All playlists loaded:', result.length);
      
      // Filter to show only user's playlists (by user_id or created_by_id)
      const myPlaylists = result.filter((p: any) => 
        p.user_id === userId || p.created_by_id === userId
      );
      
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

  const openPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    // TODO: Navigate to playlist detail page
    Alert.alert(
      playlist.name,
      `${(playlist as any).track_ids?.length || playlist.tracks?.length || 0} tracks\n\nPlaylist detail page coming soon!`,
      [{ text: 'OK' }]
    );
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
          {item.description ? (
            <Text style={styles.playlistDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
        </View>

        <View style={styles.playlistMeta}>
          {item.is_public ? (
            <Ionicons name="globe-outline" size={16} color={Colors.textMuted} />
          ) : (
            <Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} />
          )}
        </View>

        <TouchableOpacity 
          style={styles.playButton}
          onPress={() => openPlaylist(item)}
        >
          <Ionicons name="play" size={24} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading playlists...</Text>
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
          <Text style={styles.headerTitle}>My Playlists</Text>
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
          <Text style={styles.emptyTitle}>No Playlists Yet</Text>
          <Text style={styles.emptySubtitle}>
            Create your first playlist to organize your favorite tracks
          </Text>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <LinearGradient colors={[Colors.primary, '#7B1FA2']} style={styles.createButtonGradient}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createButtonText}>Create Playlist</Text>
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
            <Text style={styles.modalTitle}>Create Playlist</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Playlist name"
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
    width: 70,
    height: 70,
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
  playlistDesc: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  playlistMeta: { marginRight: 12 },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
});
