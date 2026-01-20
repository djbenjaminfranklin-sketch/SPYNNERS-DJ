import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { usePlayer } from '../../src/contexts/PlayerContext';
import { base44TrackSend, TrackSend } from '../../src/services/base44Api';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function ReceivedScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const { t, language } = useLanguage();
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayer();
  
  const [receivedTracks, setReceivedTracks] = useState<TrackSend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadReceivedTracks();
    }
  }, [user, token]);

  const loadReceivedTracks = async () => {
    try {
      setLoading(true);
      console.log('[Received] Loading received tracks...');
      
      const userId = user?.id || user?._id;
      if (!userId) {
        console.log('[Received] No user ID found');
        setReceivedTracks([]);
        return;
      }
      
      // Load tracks received via TrackSend entity
      const tracks = await base44TrackSend.getReceived(userId);
      console.log('[Received] Loaded', tracks.length, 'tracks');
      setReceivedTracks(tracks);
      
      // Mark unviewed tracks as viewed
      for (const track of tracks) {
        if (!track.viewed && (track.id || track._id)) {
          await base44TrackSend.markAsViewed(track.id || track._id || '');
        }
      }
    } catch (error) {
      console.error('[Received] Error loading tracks:', error);
      setReceivedTracks([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReceivedTracks();
    setRefreshing(false);
  };

  // Handle play button
  const handlePlay = async (item: TrackSend) => {
    if (!item.track_audio_url) {
      Alert.alert(
        language === 'fr' ? 'Erreur' : 'Error',
        language === 'fr' ? 'Fichier audio non disponible' : 'No audio file available'
      );
      return;
    }

    // Check if this track is already playing
    const trackId = item.track_id || item.id || item._id || '';
    if (currentTrack?.id === trackId) {
      // Toggle play/pause
      togglePlayPause();
    } else {
      // Play new track
      await playTrack({
        id: trackId,
        title: item.track_title || 'Unknown Track',
        artist: item.track_producer_name || 'Unknown Artist',
        audioUrl: item.track_audio_url,
        coverImage: item.track_artwork_url,
        genre: item.track_genre,
      });
    }
  };

  // Handle download button
  const handleDownload = async (item: TrackSend) => {
    if (!item.track_audio_url) {
      Alert.alert(
        language === 'fr' ? 'Erreur' : 'Error',
        language === 'fr' ? 'Fichier audio non disponible' : 'No audio file available'
      );
      return;
    }

    const trackId = item.id || item._id || '';
    setDownloadingId(trackId);

    try {
      if (Platform.OS === 'web') {
        // Web: Open URL in new tab or trigger download
        window.open(item.track_audio_url, '_blank');
      } else {
        // Mobile: Download and share
        const filename = `${(item.track_title || 'track').replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
        const downloadDir = FileSystem.documentDirectory;
        const downloadPath = `${downloadDir}${filename}`;

        console.log('[Received] Downloading to:', downloadPath);
        
        // Download the file
        const downloadResult = await FileSystem.downloadAsync(
          item.track_audio_url,
          downloadPath
        );

        if (downloadResult.status === 200) {
          console.log('[Received] Download successful:', downloadResult.uri);
          
          // Share the file (allows user to save to Files, AirDrop, etc.)
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(downloadResult.uri, {
              mimeType: 'audio/mpeg',
              dialogTitle: language === 'fr' ? 'Sauvegarder le track' : 'Save track',
            });
          } else {
            Alert.alert(
              language === 'fr' ? 'Succès' : 'Success',
              language === 'fr' ? 'Track téléchargé' : 'Track downloaded'
            );
          }
        } else {
          throw new Error('Download failed');
        }
      }
    } catch (error) {
      console.error('[Received] Download error:', error);
      Alert.alert(
        language === 'fr' ? 'Erreur' : 'Error',
        language === 'fr' ? 'Impossible de télécharger le fichier' : 'Unable to download file'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle delete button
  const handleDelete = (item: TrackSend) => {
    const trackId = item.id || item._id || '';
    
    Alert.alert(
      language === 'fr' ? 'Supprimer le track ?' : 'Delete track?',
      language === 'fr' 
        ? `Voulez-vous supprimer "${item.track_title || 'ce track'}" de votre liste ?`
        : `Do you want to remove "${item.track_title || 'this track'}" from your list?`,
      [
        { 
          text: language === 'fr' ? 'Annuler' : 'Cancel', 
          style: 'cancel' 
        },
        {
          text: language === 'fr' ? 'Supprimer' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(trackId);
            try {
              const success = await base44TrackSend.delete(trackId);
              if (success) {
                // Remove from local state
                setReceivedTracks(prev => prev.filter(t => (t.id || t._id) !== trackId));
                console.log('[Received] Track deleted successfully');
              } else {
                throw new Error('Delete failed');
              }
            } catch (error) {
              console.error('[Received] Delete error:', error);
              Alert.alert(
                language === 'fr' ? 'Erreur' : 'Error',
                language === 'fr' ? 'Impossible de supprimer le track' : 'Unable to delete track'
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const renderTrack = ({ item }: { item: TrackSend }) => {
    const coverUrl = item.track_artwork_url;
    const trackId = item.track_id || item.id || item._id || '';
    const isCurrentTrack = currentTrack?.id === trackId;
    const isTrackPlaying = isCurrentTrack && isPlaying;
    const isDownloading = downloadingId === (item.id || item._id);
    const isDeleting = deletingId === (item.id || item._id);
    
    return (
      <View style={[styles.trackCard, isCurrentTrack && styles.trackCardPlaying]}>
        <View style={styles.trackCover}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="musical-notes" size={24} color={Colors.textMuted} />
            </View>
          )}
          {isCurrentTrack && (
            <View style={styles.nowPlayingBadge}>
              <Ionicons name="volume-high" size={12} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>{item.track_title}</Text>
          <Text style={styles.trackArtist} numberOfLines={1}>{item.track_producer_name || 'Unknown Artist'}</Text>
          <View style={styles.senderInfo}>
            <Ionicons name="person" size={12} color={Colors.textMuted} />
            <Text style={styles.senderText}>De: {item.sender_name}</Text>
          </View>
          {item.message && (
            <Text style={styles.messageText} numberOfLines={1}>"{item.message}"</Text>
          )}
          <Text style={styles.trackMeta}>{item.track_genre}</Text>
        </View>

        <View style={styles.actions}>
          {/* Play Button */}
          <TouchableOpacity 
            style={[styles.actionButton, isTrackPlaying && styles.actionButtonActive]}
            onPress={() => handlePlay(item)}
            disabled={!item.track_audio_url}
          >
            <Ionicons 
              name={isTrackPlaying ? "pause" : "play"} 
              size={20} 
              color={isTrackPlaying ? '#fff' : (item.track_audio_url ? Colors.primary : Colors.textMuted)} 
            />
          </TouchableOpacity>
          
          {/* Download Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleDownload(item)}
            disabled={isDownloading || !item.track_audio_url}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons 
                name="download" 
                size={20} 
                color={item.track_audio_url ? Colors.primary : Colors.textMuted} 
              />
            )}
          </TouchableOpacity>
          
          {/* Delete Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleDelete(item)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#ff6b6b" />
            ) : (
              <Ionicons name="trash" size={20} color="#ff6b6b" />
            )}
          </TouchableOpacity>
        </View>
      </View>
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
        <Text style={styles.headerTitle}>{t('page.receivedTracks')}</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Track List */}
      {receivedTracks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="mail-outline" size={80} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{t('page.noReceivedTracks')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('page.receivedTracksHint') || 'Tracks sent to you by other members will appear here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={receivedTracks}
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  listContent: { padding: 12 },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trackCardPlaying: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  trackCover: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    position: 'relative',
  },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nowPlayingBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    padding: 3,
  },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  trackArtist: { fontSize: 13, color: Colors.primary, marginTop: 2 },
  senderInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  senderText: { fontSize: 11, color: Colors.textMuted },
  messageText: { fontSize: 11, color: '#888', fontStyle: 'italic', marginTop: 2 },
  trackMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 6 },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonActive: {
    backgroundColor: Colors.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: { fontSize: 22, fontWeight: '600', color: Colors.text, marginTop: 20 },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted, marginTop: 8, textAlign: 'center' },
});
