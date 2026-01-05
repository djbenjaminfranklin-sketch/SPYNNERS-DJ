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
  TextInput,
  Modal,
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

type VIPPromo = {
  id: string;
  name: string;
  description?: string;
  track_ids?: string[];
  price?: number;
  duration_days?: number;
  is_active?: boolean;
  created_at?: string;
};

export default function AdminVIP() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [vipTracks, setVipTracks] = useState<VIPTrack[]>([]);
  const [promos, setPromos] = useState<VIPPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'tracks' | 'promos'>('tracks');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPromoName, setNewPromoName] = useState('');
  const [newPromoDescription, setNewPromoDescription] = useState('');
  const [newPromoPrice, setNewPromoPrice] = useState('');
  const [creatingPromo, setCreatingPromo] = useState(false);

  const isAdmin = isUserAdmin(user);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    try {
      // Fetch VIP tracks and promos in parallel
      const [tracksRes, promosRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/tracks?limit=500`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { tracks: [] } })),
        axios.get(`${BACKEND_URL}/api/admin/vip-promos`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { promos: [] } })),
      ]);
      
      // Filter VIP tracks
      if (tracksRes.data?.success && tracksRes.data?.tracks) {
        const allTracks = tracksRes.data.tracks;
        const vip = allTracks.filter((t: any) => t.is_vip === true).map((t: any) => ({
          id: t.id || t._id,
          title: t.title,
          artist: t.artist_name || t.producer_name,
          genre: t.genre || 'Unknown',
          bpm: t.bpm,
          artwork_url: t.artwork_url,
          download_count: t.download_count || 0,
          is_vip: true,
        }));
        setVipTracks(vip);
      }
      
      // Set promos
      if (promosRes.data?.success && promosRes.data?.promos) {
        setPromos(promosRes.data.promos);
      }
      
      console.log('[AdminVIP] Loaded', vipTracks.length, 'VIP tracks and', promos.length, 'promos');
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

  const createNewPromo = async () => {
    if (!newPromoName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom pour la promo');
      return;
    }

    setCreatingPromo(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/admin/vip-promos`,
        {
          name: newPromoName.trim(),
          description: newPromoDescription.trim() || null,
          price: newPromoPrice ? parseInt(newPromoPrice) : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data?.success) {
        Alert.alert('Succès ✅', 'Promo V.I.P. créée avec succès!');
        setShowCreateModal(false);
        setNewPromoName('');
        setNewPromoDescription('');
        setNewPromoPrice('');
        loadData();
      } else {
        Alert.alert('Erreur', response.data?.message || 'Échec de la création');
      }
    } catch (error: any) {
      console.error('[AdminVIP] Create promo error:', error);
      Alert.alert('Erreur', error?.response?.data?.detail || 'Échec de la création de la promo');
    } finally {
      setCreatingPromo(false);
    }
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
          <Text style={styles.headerSubtitle}>{vipTracks.length} tracks V.I.P. • {promos.length} promos</Text>
        </View>
        <TouchableOpacity style={styles.newPromoBtn} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newPromoBtnText}>Promo</Text>
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
            <Ionicons name="musical-notes" size={18} color={activeTab === 'tracks' ? '#fff' : Colors.textMuted} />
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
            <Ionicons name="megaphone" size={18} color={activeTab === 'promos' ? '#fff' : Colors.textMuted} />
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
          <>
            {vipTracks.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="diamond-outline" size={64} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>Aucune track V.I.P.</Text>
                <Text style={styles.emptyText}>Les tracks V.I.P. apparaîtront ici</Text>
              </View>
            ) : (
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
                        <Text style={styles.trackDownloads}>{track.download_count || 0} DL</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'promos' && (
          <>
            {promos.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="megaphone-outline" size={64} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>Aucune promo active</Text>
                <Text style={styles.emptyText}>Créez une nouvelle promo V.I.P.</Text>
                <TouchableOpacity style={styles.createPromoBtn} onPress={() => setShowCreateModal(true)}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.createPromoBtnText}>Créer une promo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.promoList}>
                {promos.map((promo) => (
                  <View key={promo.id} style={styles.promoCard}>
                    <LinearGradient
                      colors={['#E040FB', '#9C27B0']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.promoGradient}
                    >
                      <View style={styles.promoHeader}>
                        <View style={styles.promoIconWrap}>
                          <Ionicons name="diamond" size={24} color="#fff" />
                        </View>
                        <View style={styles.promoHeaderContent}>
                          <Text style={styles.promoName}>{promo.name}</Text>
                          {promo.description && (
                            <Text style={styles.promoDescription} numberOfLines={2}>{promo.description}</Text>
                          )}
                        </View>
                        {promo.is_active && (
                          <View style={styles.activeBadge}>
                            <Text style={styles.activeBadgeText}>ACTIF</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.promoDetails}>
                        {promo.price !== undefined && (
                          <View style={styles.promoDetailItem}>
                            <Ionicons name="diamond-outline" size={14} color="rgba(255,255,255,0.8)" />
                            <Text style={styles.promoDetailText}>{promo.price} diamants</Text>
                          </View>
                        )}
                        {promo.track_ids && promo.track_ids.length > 0 && (
                          <View style={styles.promoDetailItem}>
                            <Ionicons name="musical-notes" size={14} color="rgba(255,255,255,0.8)" />
                            <Text style={styles.promoDetailText}>{promo.track_ids.length} tracks</Text>
                          </View>
                        )}
                        {promo.duration_days && (
                          <View style={styles.promoDetailItem}>
                            <Ionicons name="time" size={14} color="rgba(255,255,255,0.8)" />
                            <Text style={styles.promoDetailText}>{promo.duration_days} jours</Text>
                          </View>
                        )}
                      </View>
                    </LinearGradient>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Create Promo Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvelle Promo V.I.P.</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Nom de la promo *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: Pack House Summer 2025"
              placeholderTextColor={Colors.textMuted}
              value={newPromoName}
              onChangeText={setNewPromoName}
            />

            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              placeholder="Description de la promo..."
              placeholderTextColor={Colors.textMuted}
              value={newPromoDescription}
              onChangeText={setNewPromoDescription}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.modalLabel}>Prix (en diamants)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 50"
              placeholderTextColor={Colors.textMuted}
              value={newPromoPrice}
              onChangeText={setNewPromoPrice}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={[styles.modalCreateBtn, creatingPromo && styles.modalCreateBtnDisabled]}
              onPress={createNewPromo}
              disabled={creatingPromo}
            >
              {creatingPromo ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="diamond" size={20} color="#fff" />
                  <Text style={styles.modalCreateBtnText}>Créer la promo</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  tabGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: BorderRadius.md },
  tabText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
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

  promoList: { gap: Spacing.md },
  promoCard: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  promoGradient: { padding: Spacing.md },
  promoHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  promoIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  promoHeaderContent: { flex: 1, marginLeft: Spacing.md },
  promoName: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  promoDescription: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  activeBadge: { backgroundColor: '#4CAF50', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  activeBadgeText: { fontSize: 10, fontWeight: '600', color: '#fff' },
  promoDetails: { flexDirection: 'row', marginTop: Spacing.md, gap: Spacing.md },
  promoDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  promoDetailText: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },

  emptyState: { alignItems: 'center', padding: 48, marginTop: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: Spacing.md },
  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 8 },
  createPromoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E040FB', paddingHorizontal: 20, paddingVertical: 12, borderRadius: BorderRadius.md, marginTop: Spacing.lg },
  createPromoBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  modalLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 6, marginTop: Spacing.md },
  modalInput: { backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  modalTextarea: { height: 80, textAlignVertical: 'top' },
  modalCreateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#E040FB', paddingVertical: 16, borderRadius: BorderRadius.md, marginTop: Spacing.lg },
  modalCreateBtnDisabled: { opacity: 0.6 },
  modalCreateBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
