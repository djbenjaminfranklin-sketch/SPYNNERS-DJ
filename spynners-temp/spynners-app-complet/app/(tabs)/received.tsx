import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import LanguageSelector from '../../src/components/LanguageSelector';

export default function ReceivedScreen() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [receivedTracks, setReceivedTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL;

  useEffect(() => {
    fetchReceivedTracks();
    return () => {
      if (sound) sound.unloadAsync();
    };
  }, []);

  const fetchReceivedTracks = async () => {
  try {
    // Backend endpoint not available in this build; keep UI stable.
    setReceivedTracks([]);
  } catch (error) {
    console.error('Error fetching received tracks:', error);
    setReceivedTracks([]);
  }
};
  const onRefresh = () => {
    setRefreshing(true);
    fetchReceivedTracks();
  };

  const playTrack = async (track: any) => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }
      
      if (playingId === track.id) {
        setPlayingId(null);
        return;
      }

      if (track.audio_url) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: track.audio_url },
          { shouldPlay: true }
        );
        setSound(newSound);
        setPlayingId(track.id);
        
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlayingId(null);
          }
        });
      } else {
        Alert.alert('Error', 'Audio not available for this track');
      }
    } catch (error) {
      console.error('Play error:', error);
      Alert.alert('Error', 'Could not play this track');
    }
  };

  const markAsListened = async (trackId: string) => {
    // Update local state
    setReceivedTracks(tracks =>
      tracks.map(t => t.id === trackId ? { ...t, listened: true } : t)
    );
  };

  const deleteTrack = (trackId: string) => {
    Alert.alert(
      'Delete Track',
      'Remove this track from your received list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setReceivedTracks(tracks => tracks.filter(t => t.id !== trackId));
          }
        }
      ]
    );
  };

  const renderReceivedTrack = (track: any) => (
    <View key={track.id} style={[styles.trackCard, !track.listened && styles.unlistenedCard]}>
      <View style={styles.trackHeader}>
        {track.cover_art ? (
          <Image source={{ uri: track.cover_art }} style={styles.coverArt} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="musical-note" size={24} color={Colors.textMuted} />
          </View>
        )}
        <View style={styles.trackInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
            {!track.listened && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>}
          </View>
          <Text style={styles.trackArtist}>{track.artist}</Text>
          <View style={styles.senderInfo}>
            <Ionicons name="person" size={12} color={Colors.primary} />
            <Text style={styles.senderText}>From: {track.sender_name || 'Anonymous'}</Text>
          </View>
          {track.sent_from === 'website' && (
            <View style={styles.sourceTag}>
              <Ionicons name="globe" size={10} color="#00C853" />
              <Text style={styles.sourceText}>via Website</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => deleteTrack(track.id)} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
      
      {track.message && (
        <View style={styles.messageBox}>
          <Ionicons name="chatbubble" size={14} color={Colors.textMuted} />
          <Text style={styles.messageText}>{track.message}</Text>
        </View>
      )}
      
      <View style={styles.trackActions}>
        <TouchableOpacity 
          style={styles.actionBtn} 
          onPress={() => {
            playTrack(track);
            markAsListened(track.id);
          }}
        >
          <Ionicons 
            name={playingId === track.id ? "pause" : "play"} 
            size={18} 
            color={Colors.primary} 
          />
          <Text style={styles.actionText}>{playingId === track.id ? 'Pause' : 'Play'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="download" size={18} color={Colors.primary} />
          <Text style={styles.actionText}>Download</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="add-circle" size={18} color={Colors.primary} />
          <Text style={styles.actionText}>Playlist</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.dateText}>
        {track.received_at ? new Date(track.received_at).toLocaleDateString() : 
         track.timestamp ? new Date(track.timestamp).toLocaleDateString() : ''}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading received tracks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Received Tracks</Text>
            <Text style={styles.headerSubtitle}>Tracks sent to you by other SPYNNERS</Text>
          </View>
          <LanguageSelector />
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{receivedTracks.filter(t => !t.listened).length}</Text>
            <Text style={styles.statLabel}>New</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{receivedTracks.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        {/* Sync indicator */}
        <View style={styles.syncIndicator}>
          <Ionicons name="sync" size={14} color={Colors.primary} />
          <Text style={styles.syncText}>Synced with spynners.com</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {receivedTracks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mail-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyTitle}>No tracks received yet</Text>
            <Text style={styles.emptyText}>When other SPYNNERS send you tracks (from the app or website), they will appear here.</Text>
          </View>
        ) : (
          receivedTracks.map(renderReceivedTrack)
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: Spacing.md, color: Colors.textSecondary },
  header: { padding: Spacing.lg, paddingTop: 30, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.borderAccent },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: Colors.primary },
  headerSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  statBox: { backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: Colors.primary },
  statLabel: { fontSize: 12, color: Colors.textMuted },
  syncIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  syncText: { fontSize: 11, color: Colors.primary },
  content: { flex: 1, padding: Spacing.md },
  trackCard: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  unlistenedCard: { borderColor: Colors.primary, borderWidth: 2 },
  trackHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  coverArt: { width: 56, height: 56, borderRadius: BorderRadius.sm },
  coverPlaceholder: { width: 56, height: 56, borderRadius: BorderRadius.sm, backgroundColor: Colors.backgroundInput, justifyContent: 'center', alignItems: 'center' },
  trackInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trackTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, flex: 1 },
  newBadge: { backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  newBadgeText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  trackArtist: { fontSize: 13, color: Colors.textSecondary },
  senderInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  senderText: { fontSize: 11, color: Colors.primary },
  sourceTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  sourceText: { fontSize: 10, color: '#00C853' },
  deleteButton: { padding: 8 },
  messageBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: Spacing.sm, backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.sm, padding: Spacing.sm },
  messageText: { flex: 1, fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic' },
  trackActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 13, color: Colors.primary },
  dateText: { fontSize: 10, color: Colors.textMuted, marginTop: Spacing.sm, textAlign: 'right' },
  emptyState: { alignItems: 'center', padding: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: Spacing.md },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
});
