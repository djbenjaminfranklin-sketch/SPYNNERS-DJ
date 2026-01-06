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
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../src/contexts/AuthContext';
import { usePlayer } from '../../src/contexts/PlayerContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { base44Admin } from '../../src/services/base44Api';
import { isUserAdmin } from '../../src/components/AdminBadge';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';

type PendingTrack = {
  id: string;
  title: string;
  artist: string;
  producer_name?: string;
  genre: string;
  label?: string;
  bpm?: number;
  key?: string;
  description?: string;
  is_vip: boolean;
  audio_url?: string;
  artwork_url?: string;
  uploaded_by: string;
  uploaded_at: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
};

type AdminStats = {
  total_tracks: number;
  total_users: number;
  pending_tracks: number;
  vip_requests: number;
  approved_tracks: number;
  rejected_tracks: number;
  unreleased_tracks: number;
};

export default function AdminDashboard() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const { playTrack: globalPlayTrack, currentTrack, isPlaying: globalIsPlaying, togglePlayPause, closePlayer } = usePlayer();
  
  const [allTracks, setAllTracks] = useState<PendingTrack[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'requests' | 'vip' | 'approved' | 'unreleased' | 'users' | 'inactive'>('pending');
  const [selectedTrack, setSelectedTrack] = useState<PendingTrack | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';
  const isAdmin = isUserAdmin(user);

  useEffect(() => {
    if (isAdmin) {
      fetchAllData();
    }
  }, [isAdmin]);

  const fetchAllData = async () => {
    try {
      // Fetch real admin stats from backend
      const statsResponse = await axios.get(`${BACKEND_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (statsResponse.data?.success && statsResponse.data?.stats) {
        const stats = statsResponse.data.stats;
        setAdminStats({
          total_tracks: stats.total_tracks || 0,
          total_users: stats.total_users || 0,
          pending_tracks: stats.pending_tracks || 0,
          vip_requests: stats.vip_tracks || 0,
          approved_tracks: stats.approved_tracks || 0,
          rejected_tracks: stats.rejected_tracks || 0,
          unreleased_tracks: 0,
        });
      }
      
      // Fetch real tracks from backend
      const tracksResponse = await axios.get(`${BACKEND_URL}/api/admin/tracks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (tracksResponse.data?.success && tracksResponse.data?.tracks) {
        setAllTracks(tracksResponse.data.tracks.map((track: any) => ({
          id: track.id || track._id,
          title: track.title || 'Sans titre',
          artist: typeof track.artist_name === 'string' ? track.artist_name : 
                  typeof track.artist === 'string' ? track.artist : 
                  track.producer_name || 'Artiste inconnu',
          producer_name: track.producer_name || track.artist_name || 'Producteur inconnu',
          genre: track.genre || 'Unknown',
          label: track.label || '',
          bpm: track.bpm,
          key: track.key || '',
          description: track.description || '',
          is_vip: track.is_vip || false,
          audio_url: track.audio_url,
          artwork_url: track.artwork_url,
          uploaded_by: track.uploaded_by || track.user_id || '',
          uploaded_at: track.created_at || '',
          status: track.status || 'approved',
          rejection_reason: track.rejection_reason || '',
        })));
      }
    } catch (error) {
      console.error('[AdminDashboard] Error:', error);
      // Fallback to old method if new endpoints fail
      try {
        const dashboardData = await base44Admin.getDashboard();
        if (dashboardData?.success) {
          if (dashboardData.stats) {
            setAdminStats({
              total_tracks: dashboardData.stats.total_tracks || 0,
              total_users: dashboardData.stats.total_users || 0,
              pending_tracks: dashboardData.stats.pending_tracks || 0,
              vip_requests: dashboardData.stats.vip_requests || 0,
              approved_tracks: dashboardData.stats.approved_tracks || 0,
              rejected_tracks: dashboardData.stats.rejected_tracks || 0,
              unreleased_tracks: dashboardData.stats.unreleased_tracks || 0,
            });
          }
          if (dashboardData.pending_tracks) {
            setAllTracks([...(dashboardData.pending_tracks || []), ...(dashboardData.approved_tracks || [])]);
          }
        }
      } catch (fallbackError) {
        console.error('[AdminDashboard] Fallback error:', fallbackError);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllData();
  };

  const syncACRCloud = async () => {
    Alert.alert('Sync ACRCloud', 'Cette fonctionnalité synchronise les tracks avec ACRCloud.');
  };

  const cleanDuplicates = async () => {
    Alert.alert('Clean Duplicates', 'Recherche et nettoyage des doublons en cours...');
  };

  const fixMissingBPM = async () => {
    Alert.alert('Fix Missing BPM', 'Analyse et correction des BPM manquants...');
  };

  // Approve a track
  const handleApproveTrack = async (track: PendingTrack) => {
    setProcessing(true);
    try {
      await base44Admin.approveTrack(track.id);
      Alert.alert('✅ Succès', `"${track.title}" a été approuvé !`);
      setShowDetailModal(false);
      fetchAllData(); // Refresh the list
    } catch (error) {
      console.error('[Admin] Approve error:', error);
      Alert.alert('Erreur', 'Impossible d\'approuver cette track.');
    } finally {
      setProcessing(false);
    }
  };

  // Reject a track
  const handleRejectTrack = async (track: PendingTrack) => {
    if (!rejectionReason.trim()) {
      Alert.alert('Erreur', 'Veuillez indiquer une raison de rejet.');
      return;
    }
    setProcessing(true);
    try {
      await base44Admin.rejectTrack(track.id, rejectionReason);
      Alert.alert('❌ Track Rejetée', `"${track.title}" a été rejetée.`);
      setShowRejectModal(false);
      setShowDetailModal(false);
      setRejectionReason('');
      fetchAllData(); // Refresh the list
    } catch (error) {
      console.error('[Admin] Reject error:', error);
      Alert.alert('Erreur', 'Impossible de rejeter cette track.');
    } finally {
      setProcessing(false);
    }
  };

  // Play track preview
  const handlePlayTrack = (track: PendingTrack) => {
    if (track.audio_url) {
      globalPlayTrack({
        id: track.id,
        title: track.title,
        artist_name: track.producer_name || track.artist,
        audio_url: track.audio_url,
        artwork_url: track.artwork_url,
        genre: track.genre,
      });
    } else {
      Alert.alert('Pas d\'audio', 'Cette track n\'a pas de fichier audio disponible.');
    }
  };

  const getFilteredTracks = () => {
    switch (activeTab) {
      case 'pending': return allTracks.filter(t => t.status === 'pending');
      case 'approved': return allTracks.filter(t => t.status === 'approved');
      case 'vip': return allTracks.filter(t => t.is_vip);
      default: return allTracks;
    }
  };

  const filteredTracks = getFilteredTracks();

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
        <ActivityIndicator size="large" color={Colors.primary} />
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
          <Ionicons name="shield-checkmark" size={24} color={Colors.primary} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>Manage tracks and users</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="time" size={24} color="#FF9800" />
            <Text style={styles.statNumber}>{adminStats?.pending_tracks || 0}</Text>
            <Text style={styles.statLabel}>Pending Tracks</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color="#2196F3" />
            <Text style={styles.statNumber}>{adminStats?.total_users || 0}</Text>
            <Text style={styles.statLabel}>Users</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#00BCD4' }]} onPress={syncACRCloud}>
            <Ionicons name="cloud-upload" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Sync ACRCloud</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FF5722' }]} onPress={cleanDuplicates}>
            <Ionicons name="warning" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Clean Duplicates</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#4CAF50' }]} onPress={fixMissingBPM}>
            <Ionicons name="flash" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Fix Missing BPM</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          <View style={styles.tabs}>
            {[
              { key: 'pending', label: `Pending (${adminStats?.pending_tracks || 0})`, icon: 'diamond' },
              { key: 'requests', label: `Requests (0)`, icon: 'diamond' },
              { key: 'vip', label: `V.I.P. (${adminStats?.vip_requests || 0})`, icon: 'diamond' },
              { key: 'approved', label: `Approved (${adminStats?.approved_tracks || 0})`, icon: 'musical-note' },
              { key: 'unreleased', label: `Unreleased (${adminStats?.unreleased_tracks || 0})`, icon: 'folder' },
              { key: 'users', label: 'Users', icon: 'people' },
              { key: 'inactive', label: 'Inactive (0)', icon: 'moon' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key as any)}
              >
                <Ionicons name={tab.icon as any} size={14} color={activeTab === tab.key ? Colors.primary : Colors.textMuted} />
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Content */}
        {filteredTracks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={64} color="#00BCD4" />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyText}>No tracks pending approval at the moment.</Text>
          </View>
        ) : (
          filteredTracks.map((track) => (
            <TouchableOpacity key={track.id} style={styles.trackCard} onPress={() => {
              setSelectedTrack(track);
              setShowDetailModal(true);
            }}>
              {/* Artwork with play button overlay */}
              <View style={styles.trackImageContainer}>
                {track.artwork_url ? (
                  <Image source={{ uri: track.artwork_url }} style={styles.trackImage} />
                ) : (
                  <View style={styles.trackImagePlaceholder}>
                    <Ionicons name="musical-note" size={24} color={Colors.textMuted} />
                  </View>
                )}
                {/* Play button overlay */}
                {track.audio_url ? (
                  <TouchableOpacity 
                    style={styles.playOverlay} 
                    onPress={(e) => {
                      e.stopPropagation();
                      handlePlayTrack(track);
                    }}
                  >
                    <Ionicons 
                      name={currentTrack?.id === track.id && globalIsPlaying ? "pause" : "play"} 
                      size={20} 
                      color="#fff" 
                    />
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.playOverlay, styles.noAudioOverlay]}>
                    <Ionicons name="volume-mute" size={16} color="#fff" />
                  </View>
                )}
              </View>
              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle} numberOfLines={1}>{track.title || 'Sans titre'}</Text>
                <Text style={styles.trackArtist}>{track.artist || 'Artiste inconnu'}</Text>
                <View style={styles.trackMeta}>
                  <Text style={styles.trackGenre}>{track.genre || 'Unknown'}</Text>
                  {!track.audio_url ? (
                    <Text style={styles.noAudioText}>Pas d'audio</Text>
                  ) : null}
                </View>
              </View>
              <View style={[styles.statusBadge, track.status === 'approved' && styles.statusApproved]}>
                <Text style={styles.statusText}>{track.status || 'pending'}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Track Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Track Review</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
            </View>
            {selectedTrack && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {selectedTrack.artwork_url ? (
                  <Image source={{ uri: selectedTrack.artwork_url }} style={styles.modalImage} />
                ) : (
                  <View style={[styles.modalImage, styles.modalImagePlaceholder]}>
                    <Ionicons name="musical-note" size={48} color={Colors.textMuted} />
                  </View>
                )}
                <Text style={styles.modalTrackTitle}>{selectedTrack.title || 'Sans titre'}</Text>
                <Text style={styles.modalTrackArtist}>{selectedTrack.producer_name || selectedTrack.artist || 'Artiste inconnu'}</Text>
                
                {/* Track Details */}
                <View style={styles.trackDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Genre:</Text>
                    <Text style={styles.detailValue}>{selectedTrack.genre || 'Non spécifié'}</Text>
                  </View>
                  {selectedTrack.bpm ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>BPM:</Text>
                      <Text style={styles.detailValue}>{selectedTrack.bpm}</Text>
                    </View>
                  ) : null}
                  {selectedTrack.key ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Key:</Text>
                      <Text style={styles.detailValue}>{selectedTrack.key}</Text>
                    </View>
                  ) : null}
                  {selectedTrack.label ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Label:</Text>
                      <Text style={styles.detailValue}>{selectedTrack.label}</Text>
                    </View>
                  ) : null}
                  {selectedTrack.description ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Description:</Text>
                      <Text style={styles.detailValue}>{selectedTrack.description}</Text>
                    </View>
                  ) : null}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Audio:</Text>
                    <Text style={[styles.detailValue, !selectedTrack.audio_url && styles.noAudioValue]}>
                      {selectedTrack.audio_url ? 'Disponible' : 'Non disponible'}
                    </Text>
                  </View>
                </View>

                {/* Play Button */}
                {selectedTrack.audio_url ? (
                  <TouchableOpacity 
                    style={styles.playBtn} 
                    onPress={() => handlePlayTrack(selectedTrack)}
                  >
                    <Ionicons name="play" size={20} color="#fff" />
                    <Text style={styles.btnText}>Écouter</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.noAudioBtn}>
                    <Ionicons name="volume-mute" size={20} color="#fff" />
                    <Text style={styles.btnText}>Pas de fichier audio</Text>
                  </View>
                )}
                
                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={[styles.approveBtn, processing && styles.btnDisabled]} 
                    onPress={() => handleApproveTrack(selectedTrack)}
                    disabled={processing}
                  >
                    {processing ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={24} color="#fff" />
                        <Text style={styles.btnText}>Approuver</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.rejectBtn, processing && styles.btnDisabled]} 
                    onPress={() => setShowRejectModal(true)}
                    disabled={processing}
                  >
                    <Ionicons name="close" size={24} color="#fff" />
                    <Text style={styles.btnText}>Rejeter</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal visible={showRejectModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.rejectModalContent}>
            <Text style={styles.rejectModalTitle}>Raison du rejet</Text>
            <TextInput
              style={styles.rejectInput}
              placeholder="Expliquez pourquoi cette track est rejetée..."
              placeholderTextColor={Colors.textMuted}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
            />
            <View style={styles.rejectModalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
              >
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmRejectBtn, processing && styles.btnDisabled]} 
                onPress={() => selectedTrack && handleRejectTrack(selectedTrack)}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmRejectBtnText}>Confirmer le rejet</Text>
                )}
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
  centerContent: { justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: Spacing.md, color: Colors.textSecondary },
  accessDeniedTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 16 },
  backButton: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.primary, borderRadius: BorderRadius.md },
  backButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, paddingTop: 50, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerBack: { padding: 8 },
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  headerContent: { marginLeft: 12, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textMuted },

  content: { flex: 1, padding: Spacing.md },

  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  statCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statNumber: { fontSize: 28, fontWeight: 'bold', color: Colors.text, marginTop: 8 },
  statLabel: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: BorderRadius.md },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  tabsScroll: { marginBottom: Spacing.md },
  tabs: { flexDirection: 'row', gap: Spacing.xs },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  tabActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '20' },
  tabText: { fontSize: 12, color: Colors.textMuted },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },

  emptyState: { alignItems: 'center', padding: 48, marginTop: 24 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: Spacing.md },
  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 8 },

  trackCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  trackImageContainer: { position: 'relative', width: 50, height: 50 },
  trackImage: { width: 50, height: 50, borderRadius: BorderRadius.sm },
  trackImagePlaceholder: { width: 50, height: 50, borderRadius: BorderRadius.sm, backgroundColor: Colors.backgroundInput, justifyContent: 'center', alignItems: 'center' },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center' },
  noAudioOverlay: { backgroundColor: 'rgba(255,0,0,0.4)' },
  trackInfo: { flex: 1, marginLeft: Spacing.sm },
  trackTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  trackArtist: { fontSize: 12, color: Colors.textSecondary },
  trackMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  trackGenre: { fontSize: 10, color: Colors.primary },
  noAudioText: { fontSize: 10, color: '#F44336', fontStyle: 'italic' },
  statusBadge: { backgroundColor: '#FF9800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusApproved: { backgroundColor: '#4CAF50' },
  statusText: { fontSize: 10, fontWeight: '600', color: '#fff', textTransform: 'uppercase' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: Spacing.lg, width: '90%', maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  modalImage: { width: '100%', height: 200, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  modalTrackTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, textAlign: 'center' },
  modalTrackArtist: { fontSize: 14, color: Colors.primary, textAlign: 'center', marginTop: 4 },
  
  // Track details
  trackDetails: { marginTop: Spacing.md, backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: Spacing.md },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { fontSize: 12, color: Colors.textMuted },
  detailValue: { fontSize: 12, color: Colors.text, fontWeight: '500' },
  
  // Play button
  playBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: BorderRadius.md, marginTop: Spacing.md },
  
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4CAF50', paddingVertical: 12, borderRadius: BorderRadius.md },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F44336', paddingVertical: 12, borderRadius: BorderRadius.md },
  btnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
  
  // Reject Modal
  rejectModalContent: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: Spacing.lg, width: '85%' },
  rejectModalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, textAlign: 'center', marginBottom: Spacing.md },
  rejectInput: { backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 14, color: Colors.text, height: 100, textAlignVertical: 'top' },
  rejectModalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { fontSize: 14, color: Colors.textMuted },
  confirmRejectBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: BorderRadius.md, backgroundColor: '#F44336' },
  confirmRejectBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
