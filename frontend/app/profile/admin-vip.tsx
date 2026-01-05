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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { isUserAdmin } from '../../src/components/AdminBadge';
import { LinearGradient } from 'expo-linear-gradient';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';

type VIPTrack = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  bpm?: number;
  artwork_url?: string;
  download_count?: number;
  is_vip: boolean;
};

export default function AdminVIP() {
  const router = useRouter();
  const { user } = useAuth();
  const [vipTracks, setVipTracks] = useState<VIPTrack[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'tracks' | 'promos'>('tracks');

  const isAdmin = isUserAdmin(user);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    try {
      const response = await base44Tracks.list({ limit: 500 });
      const tracks = Array.isArray(response) ? response : (response?.items || []);
      setVipTracks(tracks.filter((t: any) => t.is_vip));
    } catch (error) {
      console.error('[AdminVIP] Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const createNewPromo = () => {
    Alert.alert('Nouvelle Promo', 'Création d\'une nouvelle promo V.I.P.');
  };

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="lock-closed" size={64} color={Colors.textMuted} />
        <Text style={styles.accessDeniedTitle}>Accès Refusé</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#E040FB" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerIcon}>
          <Ionicons name="diamond" size={24} color="#E040FB" />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>V.I.P. Management</Text>
          <Text style={styles.headerSubtitle}>Gérer les tracks et promos V.I.P.</Text>
        </View>
        <TouchableOpacity style={styles.newPromoBtn} onPress={createNewPromo}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newPromoBtnText}>New Promo</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tracks' && styles.tabActive]}
          onPress={() => setActiveTab('tracks')}
        >
          <LinearGradient
            colors={activeTab === 'tracks' ? ['#E040FB', '#9C27B0'] : [Colors.backgroundCard, Colors.backgroundCard]}
            style={styles.tabGradient}
          >
            <Text style={[styles.tabText, activeTab === 'tracks' && styles.tabTextActive]}>V.I.P. Tracks ({vipTracks.length})</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'promos' && styles.tabActive]}
          onPress={() => setActiveTab('promos')}
        >
          <LinearGradient
            colors={activeTab === 'promos' ? ['#E040FB', '#9C27B0'] : [Colors.backgroundCard, Colors.backgroundCard]}
            style={styles.tabGradient}
          >
            <Text style={[styles.tabText, activeTab === 'promos' && styles.tabTextActive]}>Promos ({promos.length})</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E040FB" />}
      >
        {activeTab === 'tracks' && (
          <View style={styles.trackGrid}>
            {vipTracks.map((track) => (
              <View key={track.id} style={styles.trackCard}>
                <View style={styles.vipBadge}>
                  <Ionicons name="diamond" size={12} color="#fff" />
                  <Text style={styles.vipBadgeText}>V.I.P.</Text>
                </View>
                {track.artwork_url ? (
                  <Image source={{ uri: track.artwork_url }} style={styles.trackImage} />
                ) : (
                  <View style={styles.trackImagePlaceholder}>
                    <Ionicons name="musical-note" size={32} color={Colors.textMuted} />
                  </View>
                )}
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={2}>{track.title}</Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                  <Text style={styles.trackGenre}>{track.genre}</Text>
                  <View style={styles.trackMeta}>
                    <Text style={styles.trackBpm}>{track.bpm || 0} BPM</Text>
                    <Text style={styles.trackDownloads}>{track.download_count || 0} downloads</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'promos' && (
          <View style={styles.emptyState}>
            <Ionicons name="megaphone-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Aucune promo active</Text>
            <Text style={styles.emptyText}>Créez une nouvelle promo V.I.P.</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContent: { justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: Spacing.md, color: Colors.textSecondary },
  accessDeniedTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 16 },
  backButton: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.primary, borderRadius: BorderRadius.md },
  backButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, paddingTop: 50, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border, flexWrap: 'wrap' },
  headerBack: { padding: 8 },
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E040FB20', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  headerContent: { marginLeft: 12, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textMuted },
  newPromoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E040FB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md },
  newPromoBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  tabsRow: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm },
  tab: { flex: 1, overflow: 'hidden', borderRadius: BorderRadius.md },
  tabActive: {},
  tabGradient: { paddingVertical: 12, alignItems: 'center', borderRadius: BorderRadius.md },
  tabText: { fontSize: 14, color: Colors.textMuted, fontWeight: '500' },
  tabTextActive: { color: '#fff', fontWeight: '600' },

  content: { flex: 1 },
  contentContainer: { paddingHorizontal: Spacing.md },

  trackGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  trackCard: { width: '48%', backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, marginBottom: Spacing.md, overflow: 'hidden', borderWidth: 2, borderColor: '#E040FB40' },
  vipBadge: { position: 'absolute', top: 8, left: 8, zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E040FB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  vipBadgeText: { fontSize: 10, fontWeight: '600', color: '#fff' },
  trackImage: { width: '100%', aspectRatio: 1, backgroundColor: Colors.backgroundInput },
  trackImagePlaceholder: { width: '100%', aspectRatio: 1, backgroundColor: Colors.backgroundInput, justifyContent: 'center', alignItems: 'center' },
  trackInfo: { padding: Spacing.sm },
  trackTitle: { fontSize: 13, fontWeight: '600', color: Colors.text },
  trackArtist: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  trackGenre: { fontSize: 10, color: '#E040FB', marginTop: 4 },
  trackMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  trackBpm: { fontSize: 10, color: Colors.textMuted },
  trackDownloads: { fontSize: 10, color: Colors.textMuted },

  emptyState: { alignItems: 'center', padding: 48, marginTop: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: Spacing.md },
  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 8 },
});
