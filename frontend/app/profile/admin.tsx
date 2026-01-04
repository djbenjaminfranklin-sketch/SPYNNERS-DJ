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

type DuplicateGroup = {
  title: string;
  artist: string;
  count: number;
  tracks: PendingTrack[];
};

type AdminStats = {
  total_tracks: number;
  total_users: number;
  pending_tracks: number;
  vip_requests: number;
  recent_activity: any[];
};

export default function AdminScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [pendingTracks, setPendingTracks] = useState<PendingTrack[]>([]);
  const [allTracks, setAllTracks] = useState<PendingTrack[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [acrcloudStats, setAcrcloudStats] = useState<any>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'duplicates' | 'stats'>('pending');
  const [selectedTrack, setSelectedTrack] = useState<PendingTrack | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [registeringACR, setRegisteringACR] = useState<string | null>(null);
  
  // Use global player instead of local audio
  const { playTrack: globalPlayTrack, closePlayer, currentTrack, isPlaying: globalIsPlaying, togglePlayPause } = usePlayer();

  const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';

  // Admin emails - add your email here
  const ADMIN_EMAILS = ['admin@spynners.com', 'contact@spynners.com', 'djbenjaminfranklin@gmail.com', user?.email];

  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  useEffect(() => {
    if (isAdmin) {
      fetchAllData();
    }
  }, [isAdmin]);

  const fetchAllData = async () => {
    try {
      console.log('[Admin] Fetching all data...');
      
      // Try the new getAdminData API first
      const dashboardData = await base44Admin.getDashboard();
      
      if (dashboardData?.success) {
        console.log('[Admin] Dashboard data received:', dashboardData);
        
        // Set stats
        if (dashboardData.stats) {
          setAdminStats(dashboardData.stats);
        }
        
        // Set pending tracks
        if (dashboardData.pending_tracks) {
          setPendingTracks(dashboardData.pending_tracks);
        }
        
        // Set all tracks
        if (dashboardData.approved_tracks) {
          setAllTracks([
            ...(dashboardData.pending_tracks || []),
            ...(dashboardData.approved_tracks || []),
          ]);
        }
      } else {
        // Fallback - fetch tracks directly from Base44 entities
        console.log('[Admin] Falling back to direct entity fetch');
        await fetchTracksFromEntities();
      }
    } catch (error) {
      console.error('[Admin] Error fetching dashboard:', error);
      // Fallback - fetch tracks directly from Base44 entities
      await fetchTracksFromEntities();
    }
    
    setLoading(false);
    setRefreshing(false);
  };

  const fetchTracksFromEntities = async () => {
    try {
      console.log('[Admin] Fetching tracks from entities...');
      const response = await axios.get(
        `${BACKEND_URL}/api/base44/entities/Track`,
        { 
          params: { limit: 500 },
          headers: token ? { Authorization: `Bearer ${token}` } : {} 
        }
      );
      
      let tracks: PendingTrack[] = [];
      if (Array.isArray(response.data)) {
        tracks = response.data;
      } else if (response.data?.items) {
        tracks = response.data.items;
      }
      
      console.log('[Admin] Fetched tracks:', tracks.length);
      
      // Map the tracks to our format
      const mappedTracks = tracks.map((track: any) => ({
        id: track.id || track._id,
        title: track.title || 'Unknown',
        artist: track.artist || track.producer_name || 'Unknown',
        producer_name: track.producer_name,
        genre: track.genre || 'House',
        label: track.label,
        bpm: track.bpm,
        key: track.key,
        description: track.description,
        is_vip: track.is_vip || false,
        audio_url: track.audio_url || track.audio_file,
        artwork_url: track.artwork_url || track.cover_image,
        uploaded_by: track.uploaded_by || track.created_by_id,
        uploaded_at: track.created_date || track.uploaded_at,
        status: track.status || 'approved',
        rejection_reason: track.rejection_reason,
      }));
      
      setAllTracks(mappedTracks);
      setPendingTracks(mappedTracks.filter((t: PendingTrack) => t.status === 'pending'));
      
      // Calculate stats
      setAdminStats({
        total_tracks: mappedTracks.length,
        total_users: 0,
        pending_tracks: mappedTracks.filter((t: PendingTrack) => t.status === 'pending').length,
        vip_requests: 0,
        recent_activity: [],
      });
      
    } catch (error) {
      console.error('[Admin] Error fetching tracks from entities:', error);
    }
  };

  const fetchTracksOld = async () => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/admin/tracks`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      
      if (response.data.success) {
        const tracks = response.data.tracks || [];
        setAllTracks(tracks);
        setPendingTracks(tracks.filter((t: PendingTrack) => t.status === 'pending'));
      }
    } catch (error) {
      console.error('Error fetching admin tracks:', error);
    }
  };

  const fetchDuplicates = async () => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/admin/duplicates`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      
      if (response.data.success) {
        setDuplicateGroups(response.data.duplicate_groups || []);
      }
    } catch (error) {
      console.error('Error fetching duplicates:', error);
    }
  };

  const fetchACRCloudStats = async () => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/admin/acrcloud/stats`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      
      if (response.data.success) {
        setAcrcloudStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching ACRCloud stats:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllData();
  };

  // Use global player for track playback
  const playTrack = async (track: PendingTrack) => {
    try {
      // Convert PendingTrack to the format expected by global player
      const playerTrack = {
        id: track.id,
        title: track.title,
        artist: track.artist || track.producer_name || 'Unknown',
        audio_url: track.audio_url,
        artwork_url: track.artwork_url,
        genre: track.genre,
      };
      
      if (track.audio_url) {
        globalPlayTrack(playerTrack as any);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not play track');
    }
  };

  // Check if current track is playing
  const isTrackPlaying = (trackId: string) => {
    return currentTrack?.id === trackId && globalIsPlaying;
  };

  const approveTrack = async (trackId: string) => {
    setProcessing(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/admin/tracks/approve`,
        { track_id: trackId },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      
      if (response.data.success) {
        Alert.alert('Success', 'Track approved and published!');
        setShowDetailModal(false);
        fetchAllData();
      }
    } catch (error) {
      Alert.alert('Error', 'Could not approve track');
    } finally {
      setProcessing(false);
    }
  };

  const rejectTrack = async (trackId: string) => {
    if (!rejectionReason.trim()) {
      Alert.alert('Error', 'Please provide a rejection reason');
      return;
    }
    
    setProcessing(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/admin/tracks/reject`,
        { track_id: trackId, reason: rejectionReason },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      
      if (response.data.success) {
        Alert.alert('Done', 'Track rejected');
        setShowRejectModal(false);
        setShowDetailModal(false);
        setRejectionReason('');
        fetchAllData();
      }
    } catch (error) {
      Alert.alert('Error', 'Could not reject track');
    } finally {
      setProcessing(false);
    }
  };

  const registerWithACRCloud = async (track: PendingTrack) => {
    setRegisteringACR(track.id);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/admin/acrcloud/register`,
        {
          track_id: track.id,
          audio_url: track.audio_url,
          title: track.title,
          artist: track.artist,
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      
      if (response.data.success) {
        Alert.alert('Success', 'Track registered with ACRCloud!');
        fetchACRCloudStats();
      } else {
        Alert.alert('Error', response.data.message || 'Registration failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not register with ACRCloud');
    } finally {
      setRegisteringACR(null);
    }
  };

  const bulkRegisterACRCloud = async () => {
    const pendingForACR = allTracks.filter(t => t.status === 'approved');
    if (pendingForACR.length === 0) {
      Alert.alert('Info', 'No approved tracks to register');
      return;
    }

    Alert.alert(
      'Bulk Register',
      `Register ${pendingForACR.length} approved tracks with ACRCloud?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Register All',
          onPress: async () => {
            setProcessing(true);
            try {
              const response = await axios.post(
                `${BACKEND_URL}/api/admin/acrcloud/bulk-register`,
                { track_ids: pendingForACR.map(t => t.id) },
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
              );
              
              if (response.data.success) {
                const results = response.data.results;
                const success = results.filter((r: any) => r.success).length;
                Alert.alert('Done', `Registered ${success}/${results.length} tracks`);
                fetchACRCloudStats();
              }
            } catch (error) {
              Alert.alert('Error', 'Bulk registration failed');
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  const checkDuplicates = async (track: PendingTrack) => {
    setProcessing(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/admin/duplicates/check`,
        {
          track_id: track.id,
          title: track.title,
          artist: track.artist,
          audio_url: track.audio_url,
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      
      if (response.data.success) {
        if (response.data.is_duplicate) {
          Alert.alert(
            'Duplicate Found!',
            `Found ${response.data.duplicates.length} potential duplicate(s)`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('No Duplicates', 'This track appears to be unique');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not check for duplicates');
    } finally {
      setProcessing(false);
    }
  };

  const mergeDuplicates = async (keepId: string, deleteIds: string[]) => {
    Alert.alert(
      'Merge Duplicates',
      `Keep 1 track and delete ${deleteIds.length} duplicates?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              const response = await axios.post(
                `${BACKEND_URL}/api/admin/duplicates/merge`,
                { keep_id: keepId, delete_ids: deleteIds },
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
              );
              
              if (response.data.success) {
                Alert.alert('Success', response.data.message);
                fetchAllData();
              }
            } catch (error) {
              Alert.alert('Error', 'Could not merge duplicates');
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  const getFilteredTracks = () => {
    switch (activeTab) {
      case 'pending':
        return allTracks.filter(t => t.status === 'pending');
      case 'approved':
        return allTracks.filter(t => t.status === 'approved');
      case 'rejected':
        return allTracks.filter(t => t.status === 'rejected');
      default:
        return allTracks;
    }
  };

  const openTrackDetail = (track: PendingTrack) => {
    setSelectedTrack(track);
    setShowDetailModal(true);
  };

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="lock-closed" size={64} color={Colors.textMuted} />
        <Text style={styles.accessDeniedTitle}>{t('admin.accessDenied')}</Text>
        <Text style={styles.accessDeniedText}>{t('admin.noPermission')}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{t('admin.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('admin.loadingAdmin')}</Text>
      </View>
    );
  }

  const filteredTracks = getFilteredTracks();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{t('admin.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('admin.subtitle')}</Text>
        </View>
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>{pendingTracks.length}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{pendingTracks.length}</Text>
          <Text style={styles.statLabel}>{t('admin.pending')}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#00C853' }]}>
            {allTracks.filter(t => t.status === 'approved').length}
          </Text>
          <Text style={styles.statLabel}>{t('admin.approved')}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#FF9800' }]}>
            {duplicateGroups.length}
          </Text>
          <Text style={styles.statLabel}>{t('admin.duplicates')}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#2196F3' }]}>
            {acrcloudStats?.stats?.registered || 0}
          </Text>
          <Text style={styles.statLabel}>ACR</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        <View style={styles.tabs}>
          {(['pending', 'approved', 'rejected', 'duplicates', 'acrcloud'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'acrcloud' ? 'ACRCloud' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* ACRCloud Tab */}
        {activeTab === 'acrcloud' && (
          <View style={styles.acrcloudSection}>
            <View style={styles.acrHeader}>
              <View style={styles.acrLogo}>
                <Ionicons name="radio" size={32} color="#00C853" />
              </View>
              <View>
                <Text style={styles.acrTitle}>ACRCloud Integration</Text>
                <Text style={styles.acrSubtitle}>Audio fingerprinting for track recognition</Text>
              </View>
            </View>

            <View style={styles.acrStats}>
              <View style={styles.acrStatItem}>
                <Text style={styles.acrStatNumber}>{acrcloudStats?.stats?.registered || 0}</Text>
                <Text style={styles.acrStatLabel}>Registered</Text>
              </View>
              <View style={styles.acrStatItem}>
                <Text style={[styles.acrStatNumber, { color: '#F44336' }]}>{acrcloudStats?.stats?.failed || 0}</Text>
                <Text style={styles.acrStatLabel}>Failed</Text>
              </View>
              <View style={styles.acrStatItem}>
                <Text style={[styles.acrStatNumber, { color: '#FF9800' }]}>
                  {allTracks.filter(t => t.status === 'approved').length - (acrcloudStats?.stats?.registered || 0)}
                </Text>
                <Text style={styles.acrStatLabel}>Pending</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.bulkRegisterBtn}
              onPress={bulkRegisterACRCloud}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={24} color="#fff" />
                  <Text style={styles.bulkRegisterText}>Register All Approved Tracks</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.sectionLabel}>Recent Registrations</Text>
            {acrcloudStats?.recent?.map((reg: any, i: number) => (
              <View key={i} style={styles.recentReg}>
                <Ionicons 
                  name={reg.success ? "checkmark-circle" : "close-circle"} 
                  size={20} 
                  color={reg.success ? "#00C853" : "#F44336"} 
                />
                <View style={styles.recentRegInfo}>
                  <Text style={styles.recentRegTitle}>{reg.title}</Text>
                  <Text style={styles.recentRegArtist}>{reg.artist}</Text>
                </View>
                <Text style={styles.recentRegDate}>
                  {new Date(reg.registered_at).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Duplicates Tab */}
        {activeTab === 'duplicates' && (
          <View style={styles.duplicatesSection}>
            <View style={styles.dupHeader}>
              <Ionicons name="copy" size={24} color="#FF9800" />
              <Text style={styles.dupTitle}>Duplicate Detection</Text>
            </View>
            
            {duplicateGroups.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={64} color="#00C853" />
                <Text style={styles.emptyTitle}>No Duplicates Found</Text>
                <Text style={styles.emptyText}>All tracks appear to be unique</Text>
              </View>
            ) : (
              duplicateGroups.map((group, i) => (
                <View key={i} style={styles.dupGroup}>
                  <View style={styles.dupGroupHeader}>
                    <View>
                      <Text style={styles.dupGroupTitle}>{group.title}</Text>
                      <Text style={styles.dupGroupArtist}>{group.artist}</Text>
                    </View>
                    <View style={styles.dupCountBadge}>
                      <Text style={styles.dupCountText}>{group.count} copies</Text>
                    </View>
                  </View>
                  
                  {group.tracks.map((track, j) => (
                    <View key={j} style={styles.dupTrack}>
                      <TouchableOpacity 
                        style={styles.dupTrackRadio}
                        onPress={() => {
                          const others = group.tracks.filter((_, idx) => idx !== j).map(t => t.id);
                          mergeDuplicates(track.id, others);
                        }}
                      >
                        <Ionicons name="radio-button-off" size={24} color={Colors.primary} />
                      </TouchableOpacity>
                      <View style={styles.dupTrackInfo}>
                        <Text style={styles.dupTrackId}>ID: {track.id.substring(0, 8)}...</Text>
                        <Text style={styles.dupTrackStatus}>Status: {track.status}</Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.dupDeleteBtn}
                        onPress={() => mergeDuplicates(group.tracks[0].id, [track.id])}
                      >
                        <Ionicons name="trash" size={18} color="#F44336" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ))
            )}
          </View>
        )}

        {/* Tracks List */}
        {(activeTab === 'pending' || activeTab === 'approved' || activeTab === 'rejected') && (
          <>
            {filteredTracks.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="musical-notes-outline" size={64} color={Colors.border} />
                <Text style={styles.emptyTitle}>No tracks</Text>
                <Text style={styles.emptyText}>No {activeTab} tracks at the moment</Text>
              </View>
            ) : (
              filteredTracks.map((track) => (
                <TouchableOpacity
                  key={track.id}
                  style={styles.trackCard}
                  onPress={() => openTrackDetail(track)}
                >
                  <View style={styles.trackHeader}>
                    {track.artwork_url ? (
                      <Image source={{ uri: track.artwork_url }} style={styles.artwork} />
                    ) : (
                      <View style={styles.artworkPlaceholder}>
                        <Ionicons name="musical-note" size={24} color={Colors.textMuted} />
                      </View>
                    )}
                    <View style={styles.trackInfo}>
                      <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                      <Text style={styles.trackArtist}>{track.artist}</Text>
                      <View style={styles.trackMeta}>
                        <Text style={styles.trackGenre}>{track.genre}</Text>
                        {track.is_vip && (
                          <View style={styles.vipBadge}>
                            <Ionicons name="diamond" size={10} color="#FFD700" />
                            <Text style={styles.vipText}>VIP</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      track.status === 'approved' && styles.statusApproved,
                      track.status === 'rejected' && styles.statusRejected,
                    ]}>
                      <Text style={styles.statusText}>{track.status}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.trackActions}>
                    {track.status === 'approved' && (
                      <TouchableOpacity
                        style={styles.trackActionBtn}
                        onPress={() => registerWithACRCloud(track)}
                        disabled={registeringACR === track.id}
                      >
                        {registeringACR === track.id ? (
                          <ActivityIndicator size="small" color="#00C853" />
                        ) : (
                          <Ionicons name="radio" size={16} color="#00C853" />
                        )}
                        <Text style={[styles.trackActionText, { color: '#00C853' }]}>ACR</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.trackActionBtn}
                      onPress={() => checkDuplicates(track)}
                    >
                      <Ionicons name="copy" size={16} color="#FF9800" />
                      <Text style={[styles.trackActionText, { color: '#FF9800' }]}>Check Dup</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.trackFooter}>
                    <Text style={styles.uploadedBy}>By: {track.uploaded_by || 'Unknown'}</Text>
                    <Text style={styles.uploadedAt}>
                      {new Date(track.uploaded_at).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Track Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Track Review</Text>
              <TouchableOpacity onPress={() => {
                closePlayer();
                setShowDetailModal(false);
              }}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedTrack && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailArtwork}>
                  {selectedTrack.artwork_url ? (
                    <Image source={{ uri: selectedTrack.artwork_url }} style={styles.detailImage} />
                  ) : (
                    <View style={styles.detailImagePlaceholder}>
                      <Ionicons name="musical-note" size={48} color={Colors.textMuted} />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={() => isTrackPlaying(selectedTrack.id) ? togglePlayPause() : playTrack(selectedTrack)}
                  >
                    <Ionicons name={isTrackPlaying(selectedTrack.id) ? "pause" : "play"} size={32} color="#fff" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.detailTitle}>{selectedTrack.title}</Text>
                <Text style={styles.detailArtist}>{selectedTrack.artist}</Text>
                
                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Genre</Text>
                    <Text style={styles.detailValue}>{selectedTrack.genre}</Text>
                  </View>
                  {selectedTrack.bpm && (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>BPM</Text>
                      <Text style={styles.detailValue}>{selectedTrack.bpm}</Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                {selectedTrack.status === 'pending' && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.approveBtn]}
                      onPress={() => approveTrack(selectedTrack.id)}
                      disabled={processing}
                    >
                      {processing ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={24} color="#fff" />
                          <Text style={styles.actionBtnText}>Approve</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.rejectBtn]}
                      onPress={() => setShowRejectModal(true)}
                      disabled={processing}
                    >
                      <Ionicons name="close-circle" size={24} color="#fff" />
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ACRCloud & Duplicate buttons */}
                <View style={styles.toolButtons}>
                  <TouchableOpacity
                    style={styles.toolBtn}
                    onPress={() => registerWithACRCloud(selectedTrack)}
                    disabled={registeringACR === selectedTrack.id}
                  >
                    <Ionicons name="radio" size={20} color="#00C853" />
                    <Text style={styles.toolBtnText}>Register ACRCloud</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.toolBtn}
                    onPress={() => checkDuplicates(selectedTrack)}
                  >
                    <Ionicons name="copy" size={20} color="#FF9800" />
                    <Text style={styles.toolBtnText}>Check Duplicates</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Rejection Modal */}
      <Modal
        visible={showRejectModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.rejectModalContent}>
            <Text style={styles.rejectModalTitle}>Rejection Reason</Text>
            <TextInput
              style={styles.rejectInput}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Reason for rejection..."
              placeholderTextColor={Colors.textMuted}
              multiline
            />
            <View style={styles.rejectModalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRejectModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmRejectBtn}
                onPress={() => selectedTrack && rejectTrack(selectedTrack.id)}
              >
                <Text style={styles.confirmRejectBtnText}>Reject</Text>
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
  accessDeniedText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },
  backButton: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.primary, borderRadius: BorderRadius.md },
  backButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, paddingTop: 50, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  headerBack: { padding: 8 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.primary },
  headerSubtitle: { fontSize: 11, color: Colors.textMuted },
  pendingBadge: { marginLeft: 'auto', backgroundColor: '#F44336', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  pendingBadgeText: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  
  statsRow: { flexDirection: 'row', padding: Spacing.sm, gap: Spacing.xs },
  statBox: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.sm, padding: Spacing.sm, alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: Colors.primary },
  statLabel: { fontSize: 10, color: Colors.textMuted },
  
  tabsContainer: { maxHeight: 50 },
  tabs: { flexDirection: 'row', paddingHorizontal: Spacing.sm },
  tab: { paddingVertical: 12, paddingHorizontal: 16, marginRight: 4 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, color: Colors.textMuted },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },
  
  content: { flex: 1, padding: Spacing.sm },
  
  // ACRCloud Section
  acrcloudSection: { padding: Spacing.sm },
  acrHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.md },
  acrLogo: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#00C85320', justifyContent: 'center', alignItems: 'center' },
  acrTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  acrSubtitle: { fontSize: 12, color: Colors.textMuted },
  acrStats: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  acrStatItem: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center' },
  acrStatNumber: { fontSize: 24, fontWeight: 'bold', color: '#00C853' },
  acrStatLabel: { fontSize: 11, color: Colors.textMuted },
  bulkRegisterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#00C853', padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  bulkRegisterText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.md },
  recentReg: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.backgroundCard, padding: Spacing.sm, borderRadius: BorderRadius.sm, marginBottom: 8 },
  recentRegInfo: { flex: 1 },
  recentRegTitle: { fontSize: 14, fontWeight: '500', color: Colors.text },
  recentRegArtist: { fontSize: 12, color: Colors.textMuted },
  recentRegDate: { fontSize: 11, color: Colors.textMuted },
  
  // Duplicates Section
  duplicatesSection: { padding: Spacing.sm },
  dupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.md },
  dupTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  dupGroup: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md, borderLeftWidth: 4, borderLeftColor: '#FF9800' },
  dupGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  dupGroupTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  dupGroupArtist: { fontSize: 13, color: Colors.textSecondary },
  dupCountBadge: { backgroundColor: '#FF9800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  dupCountText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  dupTrack: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  dupTrackRadio: { padding: 4 },
  dupTrackInfo: { flex: 1, marginLeft: 8 },
  dupTrackId: { fontSize: 12, color: Colors.textMuted },
  dupTrackStatus: { fontSize: 11, color: Colors.textSecondary },
  dupDeleteBtn: { padding: 8 },
  
  // Track Card
  trackCard: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  trackHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  artwork: { width: 50, height: 50, borderRadius: BorderRadius.sm },
  artworkPlaceholder: { width: 50, height: 50, borderRadius: BorderRadius.sm, backgroundColor: Colors.backgroundInput, justifyContent: 'center', alignItems: 'center' },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  trackArtist: { fontSize: 12, color: Colors.textSecondary },
  trackMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  trackGenre: { fontSize: 10, color: Colors.primary, backgroundColor: Colors.primary + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  vipBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#FFD70020', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  vipText: { fontSize: 9, color: '#FFD700', fontWeight: '600' },
  statusBadge: { backgroundColor: '#FF9800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusApproved: { backgroundColor: '#00C853' },
  statusRejected: { backgroundColor: '#F44336' },
  statusText: { fontSize: 9, fontWeight: '600', color: '#fff', textTransform: 'uppercase' },
  trackActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  trackActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Colors.backgroundInput, borderRadius: 4 },
  trackActionText: { fontSize: 11, fontWeight: '500' },
  trackFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
  uploadedBy: { fontSize: 10, color: Colors.textMuted },
  uploadedAt: { fontSize: 10, color: Colors.textMuted },
  
  emptyState: { alignItems: 'center', padding: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: Spacing.md },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: Spacing.md, width: '92%', maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  
  detailArtwork: { alignItems: 'center', marginBottom: Spacing.md, position: 'relative' },
  detailImage: { width: 160, height: 160, borderRadius: BorderRadius.md },
  detailImagePlaceholder: { width: 160, height: 160, borderRadius: BorderRadius.md, backgroundColor: Colors.backgroundInput, justifyContent: 'center', alignItems: 'center' },
  playButton: { position: 'absolute', bottom: -20, backgroundColor: Colors.primary, width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  
  detailTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, textAlign: 'center', marginTop: 20 },
  detailArtist: { fontSize: 14, color: Colors.primary, textAlign: 'center', marginTop: 4 },
  
  detailGrid: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  detailItem: { flex: 1, backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.sm, padding: Spacing.sm },
  detailLabel: { fontSize: 10, color: Colors.textMuted },
  detailValue: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  
  actionButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: BorderRadius.md },
  approveBtn: { backgroundColor: '#00C853' },
  rejectBtn: { backgroundColor: '#F44336' },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  
  toolButtons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  toolBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: BorderRadius.md, backgroundColor: Colors.backgroundInput },
  toolBtnText: { fontSize: 12, color: Colors.text },
  
  // Reject Modal
  rejectModalContent: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: Spacing.lg, width: '90%' },
  rejectModalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.md },
  rejectInput: { backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 15, color: Colors.text, height: 100, textAlignVertical: 'top' },
  rejectModalButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { fontSize: 15, color: Colors.textMuted },
  confirmRejectBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: BorderRadius.md, backgroundColor: '#F44336' },
  confirmRejectBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
