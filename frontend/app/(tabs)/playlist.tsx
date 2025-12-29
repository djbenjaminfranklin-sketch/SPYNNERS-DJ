import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Share,
  Image,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';

const PLAYLISTS_STORAGE_KEY = 'spynners_playlists';

interface Playlist {
  id: string;
  name: string;
  tracks: any[];
  created_at: string;
}

export default function PlaylistScreen() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadPlaylists = async () => {
    try {
      const stored = await AsyncStorage.getItem(PLAYLISTS_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setPlaylists(data);
        // Auto-select first playlist if none selected
        if (!selectedPlaylist && data.length > 0) {
          setSelectedPlaylist(data[0]);
        } else if (selectedPlaylist) {
          // Refresh selected playlist data
          const updated = data.find((p: Playlist) => p.id === selectedPlaylist.id);
          if (updated) setSelectedPlaylist(updated);
        }
      } else {
        // Create default playlist
        const defaultPlaylist: Playlist = {
          id: 'default',
          name: 'Ma Playlist',
          tracks: [],
          created_at: new Date().toISOString(),
        };
        await AsyncStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify([defaultPlaylist]));
        setPlaylists([defaultPlaylist]);
        setSelectedPlaylist(defaultPlaylist);
      }
    } catch (error) {
      console.error('Error loading playlists:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPlaylists();
      return () => {
        if (sound) sound.unloadAsync();
        if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      };
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadPlaylists();
  };

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) {
      Alert.alert('Error', 'Please enter a playlist name');
      return;
    }

    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name: newPlaylistName.trim(),
      tracks: [],
      created_at: new Date().toISOString(),
    };

    const updated = [...playlists, newPlaylist];
    await AsyncStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(updated));
    setPlaylists(updated);
    setSelectedPlaylist(newPlaylist);
    setNewPlaylistName('');
    setShowNewPlaylistModal(false);
  };

  const sharePlaylist = async (playlist: Playlist) => {
    const trackList = playlist.tracks.map((t, i) => `${i + 1}. ${t.title} - ${t.artist}`).join('\n');
    const shareText = `🎵 Ma playlist SPYNNERS: ${playlist.name}\n\n${trackList || 'Playlist vide'}\n\n📲 Découvrez SPYNNERS: https://spynners.com`;
    
    try {
      if (Platform.OS === 'web') {
        // Try Web Share API
        if (typeof navigator !== 'undefined' && navigator.share) {
          try {
            await navigator.share({
              title: `Playlist: ${playlist.name}`,
              text: shareText,
              url: 'https://spynners.com',
            });
            return;
          } catch (e) { 
            console.log('Web Share cancelled:', e);
          }
        }
        
        // Clipboard fallback for web
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(shareText);
            Alert.alert('✓ Copié!', 'La playlist a été copiée dans le presse-papier.');
            return;
          } catch (e) {
            console.log('Clipboard error:', e);
          }
        }
        
        // Ultimate fallback
        try {
          const textArea = document.createElement('textarea');
          textArea.value = shareText;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          Alert.alert('✓ Copié!', 'La playlist a été copiée dans le presse-papier.');
        } catch (e) {
          Alert.alert('Partager', shareText);
        }
      } else {
        // Native share
        await Share.share({ 
          message: shareText, 
          title: `Playlist: ${playlist.name}` 
        });
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Erreur', 'Impossible de partager la playlist.');
    }
  };

  const deletePlaylist = async (playlistId: string) => {
    if (playlists.length <= 1) {
      Alert.alert('Error', 'You must have at least one playlist');
      return;
    }

    Alert.alert('Delete Playlist', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = playlists.filter(p => p.id !== playlistId);
          await AsyncStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(updated));
          setPlaylists(updated);
          if (selectedPlaylist?.id === playlistId) {
            setSelectedPlaylist(updated[0]);
          }
        },
      },
    ]);
  };

  const removeTrackFromPlaylist = async (trackId: string) => {
    if (!selectedPlaylist) return;

    const updatedTracks = selectedPlaylist.tracks.filter(t => t._id !== trackId);
    const updatedPlaylist = { ...selectedPlaylist, tracks: updatedTracks };
    const updatedPlaylists = playlists.map(p => p.id === selectedPlaylist.id ? updatedPlaylist : p);

    await AsyncStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(updatedPlaylists));
    setPlaylists(updatedPlaylists);
    setSelectedPlaylist(updatedPlaylist);
  };

  const formatTime = (millis: number) => {
    const minutes = Math.floor(millis / 60000);
    const seconds = ((millis % 60000) / 1000).toFixed(0);
    return `${minutes}:${Number(seconds) < 10 ? '0' : ''}${seconds}`;
  };

  const playTrack = async (track: any) => {
    try {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      if (sound) { await sound.unloadAsync(); setSound(null); }

      if (playing === track._id) {
        setPlaying(null); setIsPlaying(false); setPosition(0); setDuration(0);
        return;
      }

      setPlaying(track._id);
      setIsPlaying(true);

      if (track.is_vip) Alert.alert('💎 VIP', 'Preview uniquement');

      if (track.audio_url) {
        try {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: track.audio_url },
            { shouldPlay: true, positionMillis: track.is_vip ? (track.vip_preview_start || 0) * 1000 : 0 },
            (status) => {
              if (status.isLoaded) {
                setPosition(status.positionMillis || 0);
                setDuration(status.durationMillis || 0);
                if (track.is_vip && status.positionMillis >= (track.vip_preview_end || 30) * 1000) {
                  newSound.stopAsync(); setPlaying(null); setIsPlaying(false);
                }
                if (status.didJustFinish) { setPlaying(null); setIsPlaying(false); }
              }
            }
          );
          setSound(newSound);
          return;
        } catch (e) { console.log('Audio error:', e); }
      }

      // Fallback
      const trackDuration = (track.duration || 180) * 1000;
      setDuration(trackDuration);
      playIntervalRef.current = setInterval(() => {
        setPosition(prev => {
          if (prev >= trackDuration) {
            if (playIntervalRef.current) clearInterval(playIntervalRef.current);
            setPlaying(null); setIsPlaying(false);
            return 0;
          }
          return prev + 1000;
        });
      }, 1000);
    } catch (error) { console.error('Play error:', error); }
  };

  const pauseTrack = async () => {
    if (sound) await sound.pauseAsync();
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    setIsPlaying(false);
  };

  const resumeTrack = async () => {
    if (sound) await sound.playAsync();
    setIsPlaying(true);
  };

  const seekTo = async (value: number) => {
    setPosition(value);
    if (sound) await sound.setPositionAsync(value);
  };

  const renderWaveform = (track: any) => {
    const bars = 28;
    const progressPercent = duration > 0 ? position / duration : 0;
    return (
      <View style={styles.waveform}>
        {[...Array(bars)].map((_, i) => (
          <View key={i} style={[styles.waveBar, {
            height: Math.random() * 18 + 8,
            backgroundColor: progressPercent * bars > i ? (track.is_vip ? '#FFD700' : Colors.primary) : Colors.border,
          }]} />
        ))}
      </View>
    );
  };

  const renderTrack = ({ item, index }: { item: any; index: number }) => (
    <View style={[styles.trackCard, item.is_vip && styles.trackCardVip]}>
      <View style={styles.trackContent}>
        <Text style={styles.trackNumber}>{index + 1}</Text>
        
        <View style={styles.coverArtContainer}>
          {item.cover_art ? (
            <Image source={{ uri: item.cover_art }} style={styles.artwork} />
          ) : (
            <View style={[styles.artwork, styles.artworkPlaceholder]}>
              <Ionicons name="musical-note" size={18} color={Colors.primary} />
            </View>
          )}
          {item.is_vip && <View style={styles.vipBadge}><Text style={styles.vipBadgeText}>VIP</Text></View>}
        </View>

        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
        </View>

        <TouchableOpacity
          style={[styles.playButton, item.is_vip && styles.playButtonVip]}
          onPress={() => {
            if (playing === item._id && isPlaying) pauseTrack();
            else if (playing === item._id && !isPlaying) resumeTrack();
            else playTrack(item);
          }}
        >
          <Ionicons name={playing === item._id && isPlaying ? 'pause' : 'play'} size={20} color={item.is_vip ? '#FFD700' : Colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteButton} onPress={() => removeTrackFromPlaylist(item._id)}>
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
        </TouchableOpacity>
      </View>

      {playing === item._id && (
        <View style={styles.playerSection}>
          {renderWaveform(item)}
          <View style={styles.progressContainer}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={duration || 1}
              value={position}
              onValueChange={seekTo}
              minimumTrackTintColor={item.is_vip ? '#FFD700' : Colors.primary}
              maximumTrackTintColor={Colors.border}
              thumbTintColor={item.is_vip ? '#FFD700' : Colors.primary}
            />
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>
      )}
    </View>
  );

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes Playlists</Text>
        <View style={styles.headerActions}>
          {selectedPlaylist && (
            <TouchableOpacity style={styles.shareButton} onPress={() => sharePlaylist(selectedPlaylist)}>
              <Ionicons name="share-outline" size={22} color={Colors.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.addButton} onPress={() => setShowNewPlaylistModal(true)}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Playlist Tabs */}
      <View style={styles.playlistTabs}>
        <FlatList
          horizontal
          data={playlists}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.playlistTab, selectedPlaylist?.id === item.id && styles.playlistTabActive]}
              onPress={() => setSelectedPlaylist(item)}
              onLongPress={() => deletePlaylist(item.id)}
            >
              <Text style={[styles.playlistTabText, selectedPlaylist?.id === item.id && styles.playlistTabTextActive]}>
                {item.name}
              </Text>
              <Text style={styles.playlistTabCount}>{item.tracks.length}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Tracks */}
      {selectedPlaylist && selectedPlaylist.tracks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="musical-notes" size={64} color={Colors.border} />
          <Text style={styles.emptyText}>Playlist vide</Text>
          <Text style={styles.emptySubtext}>Ajoutez des tracks depuis Home ou Library</Text>
        </View>
      ) : (
        <FlatList
          data={selectedPlaylist?.tracks || []}
          renderItem={renderTrack}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        />
      )}

      {/* New Playlist Modal */}
      <Modal visible={showNewPlaylistModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouvelle Playlist</Text>
            <TextInput
              style={styles.modalInput}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              placeholder="Nom de la playlist"
              placeholderTextColor={Colors.textMuted}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonCancel} onPress={() => setShowNewPlaylistModal(false)}>
                <Text style={styles.modalButtonCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonCreate} onPress={createPlaylist}>
                <Text style={styles.modalButtonCreateText}>Créer</Text>
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
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.lg, paddingTop: 60, backgroundColor: Colors.backgroundCard,
    borderBottomWidth: 1, borderBottomColor: Colors.borderAccent,
  },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: Colors.primary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  shareButton: { padding: 10 },
  addButton: { backgroundColor: Colors.primary, padding: 10, borderRadius: 20 },
  playlistTabs: { backgroundColor: Colors.backgroundCard, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  playlistTab: {
    paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 6,
    backgroundColor: Colors.backgroundInput, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  playlistTabActive: { backgroundColor: Colors.primary },
  playlistTabText: { fontSize: 14, color: Colors.textSecondary },
  playlistTabTextActive: { color: '#fff', fontWeight: '600' },
  playlistTabCount: { fontSize: 12, color: Colors.textMuted, backgroundColor: Colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  listContent: { padding: Spacing.md },
  trackCard: {
    backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.borderAccent, padding: Spacing.sm, marginBottom: Spacing.sm,
  },
  trackCardVip: { borderColor: '#FFD700', borderWidth: 2 },
  trackContent: { flexDirection: 'row', alignItems: 'center' },
  trackNumber: { fontSize: 12, fontWeight: 'bold', color: Colors.primary, width: 20 },
  coverArtContainer: { position: 'relative', marginRight: Spacing.sm },
  artwork: { width: 44, height: 44, borderRadius: 6 },
  artworkPlaceholder: { backgroundColor: Colors.backgroundInput, justifyContent: 'center', alignItems: 'center' },
  vipBadge: { position: 'absolute', top: -3, right: -3, backgroundColor: '#FFD700', paddingHorizontal: 3, borderRadius: 3 },
  vipBadgeText: { fontSize: 6, fontWeight: 'bold', color: '#000' },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 13, fontWeight: '600', color: Colors.text },
  trackArtist: { fontSize: 11, color: Colors.textSecondary },
  playButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.backgroundInput,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.primary, marginRight: 8,
  },
  playButtonVip: { borderColor: '#FFD700' },
  deleteButton: { padding: 8 },
  playerSection: { marginTop: Spacing.sm },
  waveform: { flexDirection: 'row', height: 26, alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  waveBar: { width: 3, borderRadius: 2 },
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  slider: { flex: 1, height: 30 },
  timeText: { fontSize: 9, color: Colors.textMuted, width: 32 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 },
  emptyText: { fontSize: 18, fontWeight: '600', color: Colors.textSecondary, marginTop: 16 },
  emptySubtext: { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: 24, width: '85%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },
  modalInput: {
    backgroundColor: Colors.backgroundInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.md, padding: 12, fontSize: 16, color: Colors.text, marginBottom: 20,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalButtonCancel: { flex: 1, padding: 12, borderRadius: BorderRadius.md, backgroundColor: Colors.backgroundInput, alignItems: 'center' },
  modalButtonCancelText: { color: Colors.textSecondary, fontWeight: '600' },
  modalButtonCreate: { flex: 1, padding: 12, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  modalButtonCreateText: { color: '#fff', fontWeight: '600' },
});
