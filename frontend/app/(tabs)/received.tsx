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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { base44Tracks, Track } from '../../src/services/base44Api';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

export default function ReceivedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadReceivedTracks();
  }, [user]);

  const loadReceivedTracks = async () => {
    try {
      setLoading(true);
      console.log('[Received] Loading received tracks...');
      
      // For now, show empty state since we don't have a "sent tracks" feature implemented
      // In a real implementation, this would query tracks sent to the current user
      setTracks([]);
    } catch (error) {
      console.error('[Received] Error loading tracks:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReceivedTracks();
    setRefreshing(false);
  };

  const getCoverImageUrl = (track: Track): string | null => {
    const url = track.artwork_url || track.cover_image;
    if (url && url.startsWith('http')) return url;
    return null;
  };

  const getArtistName = (track: Track): string => {
    return track.producer_name || track.artist_name || 'Unknown Artist';
  };

  const renderTrack = ({ item }: { item: Track }) => {
    const coverUrl = getCoverImageUrl(item);
    
    return (
      <View style={styles.trackCard}>
        <View style={styles.trackCover}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="musical-notes" size={24} color={Colors.textMuted} />
            </View>
          )}
        </View>

        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.trackArtist} numberOfLines={1}>{getArtistName(item)}</Text>
          <Text style={styles.trackMeta}>{item.genre}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="play" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="download" size={20} color={Colors.textMuted} />
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
      {tracks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="mail-outline" size={80} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{t('page.noReceivedTracks')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('page.receivedTracksHint') || 'Tracks sent to you by other members will appear here'}
          </Text>
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
  trackCover: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  trackArtist: { fontSize: 13, color: Colors.primary, marginTop: 2 },
  trackMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
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
});
