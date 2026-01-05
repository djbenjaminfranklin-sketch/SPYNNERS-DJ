import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
  PanResponder,
  Share,
  Alert,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlayer } from '../contexts/PlayerContext';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../theme/colors';
import { Track, Playlist, base44Playlists } from '../services/base44Api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PROGRESS_BAR_WIDTH = 80;

export default function GlobalPlayer() {
  const {
    currentTrack,
    isPlaying,
    playbackPosition,
    playbackDuration,
    isLoading,
    queue,
    currentIndex,
    togglePlayPause,
    seekTo,
    closePlayer,
    playNext,
    playPrevious,
  } = usePlayer();
  
  const { user } = useAuth();

  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const playerAnim = React.useRef(new Animated.Value(0)).current;
  
  const hasQueue = queue.length > 1;

  useEffect(() => {
    Animated.timing(playerAnim, {
      toValue: currentTrack ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [currentTrack]);
  
  // Load playlists when modal opens
  useEffect(() => {
    if (showPlaylistModal && user) {
      loadPlaylists();
    }
  }, [showPlaylistModal, user]);
  
  const loadPlaylists = async () => {
    if (!user) return;
    setLoadingPlaylists(true);
    try {
      const userId = user.id || user._id;
      const data = await base44Playlists.list(userId);
      setPlaylists(data);
    } catch (error) {
      console.error('[GlobalPlayer] Error loading playlists:', error);
    } finally {
      setLoadingPlaylists(false);
    }
  };
  
  const handleAddToPlaylist = async (playlistId: string) => {
    if (!currentTrack) return;
    try {
      const trackId = currentTrack.id || currentTrack._id;
      await base44Playlists.addTrack(playlistId, trackId);
      Alert.alert('✅ Succès', 'Track ajoutée à la playlist !');
      setShowPlaylistModal(false);
    } catch (error) {
      console.error('[GlobalPlayer] Error adding to playlist:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter la track à la playlist');
    }
  };
  
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || !user || !currentTrack) return;
    setCreatingPlaylist(true);
    try {
      const userId = user.id || user._id;
      const trackId = currentTrack.id || currentTrack._id;
      const newPlaylist = await base44Playlists.create({
        name: newPlaylistName.trim(),
        created_by: userId,
        tracks: [trackId],
        is_public: false,
      });
      if (newPlaylist) {
        Alert.alert('✅ Succès', `Playlist "${newPlaylistName}" créée avec la track !`);
        setNewPlaylistName('');
        setShowPlaylistModal(false);
      }
    } catch (error) {
      console.error('[GlobalPlayer] Error creating playlist:', error);
      Alert.alert('Erreur', 'Impossible de créer la playlist');
    } finally {
      setCreatingPlaylist(false);
    }
  };

  // Pan responder for progress bar
  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          setIsDragging(true);
          const { locationX } = evt.nativeEvent;
          const percentage = Math.max(0, Math.min(1, locationX / PROGRESS_BAR_WIDTH));
          setDragPosition(percentage * playbackDuration);
        },
        onPanResponderMove: (evt) => {
          const { locationX } = evt.nativeEvent;
          const percentage = Math.max(0, Math.min(1, locationX / PROGRESS_BAR_WIDTH));
          setDragPosition(percentage * playbackDuration);
        },
        onPanResponderRelease: async (evt) => {
          const { locationX } = evt.nativeEvent;
          const percentage = Math.max(0, Math.min(1, locationX / PROGRESS_BAR_WIDTH));
          const newPosition = Math.floor(percentage * playbackDuration);
          await seekTo(newPosition);
          setIsDragging(false);
        },
        onPanResponderTerminate: () => {
          setIsDragging(false);
        },
      }),
    [playbackDuration, seekTo]
  );

  // Share handler
  const handleShare = async () => {
    if (!currentTrack) return;
    try {
      const trackUrl = `https://spynners.com/track/${currentTrack.id || currentTrack._id}`;
      await Share.share({
        message: `Check out "${currentTrack.title}" by ${getArtistName(currentTrack)} on SPYNNERS! ${trackUrl}`,
        url: trackUrl,
        title: currentTrack.title,
      });
    } catch (error) {
      console.error('[Share] Error:', error);
    }
  };

  // Open playlist modal
  const openPlaylistModal = () => {
    setShowPlaylistModal(true);
  };

  if (!currentTrack) return null;

  // Get cover image URL
  const getCoverImageUrl = (track: Track): string | null => {
    const url = track.artwork_url || track.cover_image;
    if (url && url.startsWith('http')) return url;
    return null;
  };

  // Get artist name
  const getArtistName = (track: Track): string => {
    return track.producer_name || track.artist_name || 'Unknown Artist';
  };

  // Format time
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const coverUrl = getCoverImageUrl(currentTrack);
  const displayPosition = isDragging ? dragPosition : playbackPosition;
  const progressPercentage = playbackDuration > 0 ? (displayPosition / playbackDuration) * 100 : 0;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            {
              translateY: playerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [100, 0],
              }),
            },
          ],
        },
      ]}
    >
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradient}>
        {/* Track Info */}
        <View style={styles.trackInfo}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]}>
              <Ionicons name="musical-notes" size={20} color={Colors.textMuted} />
            </View>
          )}
          <View style={styles.textInfo}>
            <Text style={styles.title} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {getArtistName(currentTrack)}
            </Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={18} color="#fff" />
          </TouchableOpacity>
          
          {/* Previous button - only show if queue has multiple tracks */}
          {hasQueue && (
            <TouchableOpacity style={styles.controlBtn} onPress={playPrevious}>
              <Ionicons name="play-skip-back" size={18} color="#fff" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.playBtn} onPress={togglePlayPause} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
            )}
          </TouchableOpacity>
          
          {/* Next button - only show if queue has multiple tracks */}
          {hasQueue && (
            <TouchableOpacity style={styles.controlBtn} onPress={playNext}>
              <Ionicons name="play-skip-forward" size={18} color="#fff" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.controlBtn} onPress={openPlaylistModal}>
            <Ionicons name="list-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <Text style={styles.time}>{formatTime(displayPosition)}</Text>
          
          <View style={styles.progressContainer} {...panResponder.panHandlers}>
            <View style={styles.progressTrack}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${progressPercentage}%` }
                ]} 
              />
              <View 
                style={[
                  styles.progressThumb,
                  { left: `${progressPercentage}%` }
                ]}
              />
            </View>
          </View>
          
          <Text style={styles.time}>{formatTime(playbackDuration)}</Text>
          
          <TouchableOpacity style={styles.closeBtn} onPress={closePlayer}>
            <Ionicons name="close" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
      
      {/* Playlist Modal */}
      <Modal
        visible={showPlaylistModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPlaylistModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter à une playlist</Text>
              <TouchableOpacity onPress={() => setShowPlaylistModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            {/* Create new playlist */}
            <View style={styles.createSection}>
              <TextInput
                style={styles.createInput}
                placeholder="Nouvelle playlist..."
                placeholderTextColor={Colors.textMuted}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
              />
              <TouchableOpacity 
                style={[styles.createBtn, !newPlaylistName.trim() && styles.createBtnDisabled]}
                onPress={handleCreatePlaylist}
                disabled={!newPlaylistName.trim() || creatingPlaylist}
              >
                {creatingPlaylist ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="add" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
            
            {/* Playlists list */}
            {loadingPlaylists ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
            ) : playlists.length === 0 ? (
              <Text style={styles.emptyText}>Aucune playlist. Créez-en une ci-dessus !</Text>
            ) : (
              <FlatList
                data={playlists}
                keyExtractor={(item) => item.id || item._id || Math.random().toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.playlistItem}
                    onPress={() => handleAddToPlaylist(item.id || item._id || '')}
                  >
                    <Ionicons name="musical-notes" size={24} color={Colors.primary} />
                    <View style={styles.playlistInfo}>
                      <Text style={styles.playlistName}>{item.name}</Text>
                      <Text style={styles.playlistCount}>
                        {item.tracks?.length || 0} track(s)
                      </Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                )}
                style={styles.playlistList}
              />
            )}
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 70, // Above tab bar
    left: 0,
    right: 0,
    height: 80,
    zIndex: 1000,
  },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  cover: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  coverPlaceholder: {
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInfo: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    color: Colors.primary,
    fontSize: 12,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    padding: 4,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  time: {
    color: Colors.textMuted,
    fontSize: 10,
    minWidth: 32,
    textAlign: 'center',
  },
  progressContainer: {
    width: PROGRESS_BAR_WIDTH,
    height: 30,
    justifyContent: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressThumb: {
    position: 'absolute',
    top: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    marginLeft: -7,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  createSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  createInput: {
    flex: 1,
    backgroundColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    color: Colors.text,
    fontSize: 14,
  },
  createBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  playlistList: {
    flexGrow: 0,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: Colors.border,
    borderRadius: 10,
    marginBottom: 10,
    gap: 15,
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  playlistCount: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
});
