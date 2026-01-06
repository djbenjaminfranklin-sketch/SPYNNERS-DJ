import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { base44VIP, base44Tracks, Track, base44Api } from '../../src/services/base44Api';
import { useAuth } from '../../src/contexts/AuthContext';
import { usePlayer } from '../../src/contexts/PlayerContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants
const UNLOCK_COST = 1; // 1 Black Diamond per track
const UNLOCKED_TRACKS_KEY = 'vip_unlocked_tracks';

export default function VIPScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayer();
  const { t } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vipTracks, setVipTracks] = useState<Track[]>([]);
  const [unlockedTracks, setUnlockedTracks] = useState<string[]>([]);
  const [userDiamonds, setUserDiamonds] = useState(0);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const userId = user?.id || user?._id || '';
      
      // Get user's black diamonds - ALWAYS fetch fresh from server
      let diamonds = 0;
      
      // First: Try to get fresh data from server by re-logging in
      try {
        const token = await base44Api.getStoredToken();
        if (token) {
          // Call a simple endpoint to get fresh user data
          const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL || 'https://admin-dashboard-fix-32.preview.emergentagent.com'}/api/user/diamonds`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            diamonds = data.black_diamonds || 0;
            console.log('[VIP] Fresh diamonds from API:', diamonds);
          }
        }
      } catch (apiError) {
        console.log('[VIP] Could not fetch fresh diamonds:', apiError);
      }
      
      // Fallback: check user object (may be stale)
      if (diamonds === 0) {
        diamonds = user?.black_diamonds || user?.data?.black_diamonds || user?.blackDiamonds || user?.diamonds || 0;
        console.log('[VIP] Diamonds from user object (fallback):', diamonds);
      }
      
      setUserDiamonds(diamonds);
      console.log('[VIP] Final diamonds count:', diamonds);
      
      // Load VIP tracks
      const allTracks = await base44Tracks.list({ limit: 200 });
      const vipTracksList = allTracks.filter((t: Track) => t.is_vip === true);
      setVipTracks(vipTracksList);
      
      // Load user's unlocked tracks from LOCAL STORAGE (primary)
      console.log('[VIP] Loading unlocks for userId:', userId);
      if (userId) {
        try {
          // Load from AsyncStorage first (most reliable)
          const storageKey = `${UNLOCKED_TRACKS_KEY}_${userId}`;
          console.log('[VIP] AsyncStorage key:', storageKey);
          const storedUnlocks = await AsyncStorage.getItem(storageKey);
          let localUnlocks: string[] = [];
          if (storedUnlocks) {
            localUnlocks = JSON.parse(storedUnlocks);
            console.log('[VIP] Loaded unlocks from storage:', localUnlocks);
          } else {
            console.log('[VIP] No unlocks in AsyncStorage');
          }
          
          // Also try API (backup)
          try {
            const purchases = await base44VIP.listMyPurchases(userId);
            console.log('[VIP] API purchases:', purchases);
            const apiUnlocks = purchases
              .filter((p: any) => p.track_id)
              .map((p: any) => p.track_id);
            
            // Merge both sources (no duplicates)
            const allUnlocks = [...new Set([...localUnlocks, ...apiUnlocks])];
            setUnlockedTracks(allUnlocks);
            
            // Update storage with merged list
            await AsyncStorage.setItem(`${UNLOCKED_TRACKS_KEY}_${userId}`, JSON.stringify(allUnlocks));
            console.log('[VIP] Total unlocked tracks:', allUnlocks.length);
          } catch (apiError) {
            console.log('[VIP] API purchases failed, using local only:', apiError);
            setUnlockedTracks(localUnlocks);
          }
        } catch (e) {
          console.log('[VIP] Could not load unlocks:', e);
          setUnlockedTracks([]);
        }
      }
      
      console.log('[VIP] Loaded', vipTracksList.length, 'VIP tracks');
    } catch (error) {
      console.error('[VIP] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (refreshUser) await refreshUser();
    await loadData();
    setRefreshing(false);
  };

  // Check if track is unlocked
  const isTrackUnlocked = (trackId: string): boolean => {
    return unlockedTracks.includes(trackId);
  };

  // Handle unlock attempt
  const handleUnlockPress = (track: Track) => {
    const trackId = track.id || track._id || '';
    
    if (isTrackUnlocked(trackId)) {
      // Already unlocked - download directly
      handleDownload(track);
      return;
    }
    
    // Show unlock confirmation
    setSelectedTrack(track);
    setShowUnlockModal(true);
  };

  // Unlock track with black diamond
  const handleUnlock = async () => {
    if (!selectedTrack) return;
    
    const trackId = selectedTrack.id || selectedTrack._id || '';
    const userId = user?.id || user?._id || '';
    
    // IMPORTANT: Check if already unlocked FIRST
    if (isTrackUnlocked(trackId)) {
      console.log('[VIP] Track already unlocked:', trackId);
      setShowUnlockModal(false);
      // Go directly to download
      handleDownload(selectedTrack);
      return;
    }
    
    if (userDiamonds < UNLOCK_COST) {
      Alert.alert(
        t('vip.notEnoughDiamonds'),
        t('vip.needMoreDiamonds'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { 
            text: t('vip.buyDiamonds'), 
            onPress: () => {
              setShowUnlockModal(false);
              router.push('/profile/diamonds');
            }
          }
        ]
      );
      return;
    }
    
    try {
      console.log('[VIP] Unlocking track:', trackId, 'for user:', userId);
      console.log('[VIP] Current diamonds:', userDiamonds);
      
      // Deduct diamond via API - pass current balance for reliable calculation
      try {
        await base44Api.updateUserDiamonds(userId, -UNLOCK_COST, userDiamonds);
        console.log('[VIP] Diamonds deducted successfully on server');
      } catch (diamondError: any) {
        console.log('[VIP] Diamonds API error:', diamondError?.message || diamondError);
        // Don't continue if the server update failed - show error
        Alert.alert(t('common.error'), t('vip.diamondUpdateFailed'));
        return;
      }
      
      // Try to record the purchase (but don't fail if entity doesn't exist)
      try {
        await base44VIP.createPurchase({
          user_id: userId,
          track_id: trackId,
          purchased_at: new Date().toISOString(),
          amount: UNLOCK_COST,
          type: 'track_unlock',
        });
        console.log('[VIP] Purchase recorded');
      } catch (purchaseError) {
        console.log('[VIP] Could not record purchase (entity may not exist):', purchaseError);
        // Continue anyway - the track is unlocked locally
      }
      
      // Update local state
      const newUnlockedTracks = [...unlockedTracks, trackId];
      setUnlockedTracks(newUnlockedTracks);
      setUserDiamonds(prev => prev - UNLOCK_COST);
      
      // SAVE TO ASYNC STORAGE (critical for persistence)
      try {
        await AsyncStorage.setItem(`${UNLOCKED_TRACKS_KEY}_${userId}`, JSON.stringify(newUnlockedTracks));
        console.log('[VIP] Unlocks saved to storage');
      } catch (storageError) {
        console.log('[VIP] Could not save to storage:', storageError);
      }
      
      // Refresh user data
      if (refreshUser) await refreshUser();
      
      setShowUnlockModal(false);
      
      Alert.alert(
        t('vip.trackUnlocked'),
        t('vip.trackUnlockedDesc'),
        [
          { text: 'OK' },
          { 
            text: t('vip.downloadNow'), 
            onPress: () => handleDownload(selectedTrack)
          }
        ]
      );
    } catch (error) {
      console.error('[VIP] Unlock error:', error);
      Alert.alert(t('common.error'), t('vip.unlockError'));
    }
  };

  // Download track
  const handleDownload = async (track: Track) => {
    const trackId = track.id || track._id || '';
    
    if (!isTrackUnlocked(trackId)) {
      handleUnlockPress(track);
      return;
    }
    
    try {
      setDownloading(trackId);
      
      // Try multiple audio URL fields
      const audioUrl = track.audio_url || track.audio_file || track.file_url;
      console.log('[VIP] Attempting download from URL:', audioUrl);
      
      if (!audioUrl) {
        console.log('[VIP] No audio URL found. Track fields:', Object.keys(track));
        Alert.alert(t('common.error'), t('vip.noAudioFile'));
        return;
      }
      
      // For mobile: Use expo-file-system with cacheDirectory (more reliable)
      const safeTitle = (track.title || 'track').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const filename = `${safeTitle}.mp3`;
      
      // Use cacheDirectory instead of documentDirectory (more reliable on mobile)
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) {
        // Fallback: Just open the audio URL directly
        Alert.alert(
          t('vip.downloadReady'),
          t('vip.downloadReadyDesc'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { 
              text: t('vip.openInBrowser'), 
              onPress: () => {
                // Open URL in browser for download
                import('expo-linking').then(Linking => {
                  Linking.openURL(audioUrl);
                });
              }
            }
          ]
        );
        return;
      }
      
      const fileUri = `${cacheDir}${filename}`;
      console.log('[VIP] Downloading to:', fileUri);
      
      // Use the legacy API explicitly
      const FileSystemLegacy = await import('expo-file-system/legacy');
      const downloadResult = await FileSystemLegacy.downloadAsync(audioUrl, fileUri);
      
      console.log('[VIP] Download result status:', downloadResult.status);
      
      if (downloadResult.status === 200) {
        // Share/save the file
        const isAvailable = await Sharing.isAvailableAsync();
        console.log('[VIP] Sharing available:', isAvailable);
        
        if (isAvailable) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'audio/mpeg',
            dialogTitle: t('vip.saveTrack'),
          });
        } else {
          Alert.alert(t('vip.downloadSuccess'), t('vip.downloadSuccessDesc'));
        }
      } else {
        console.log('[VIP] Download failed with status:', downloadResult.status);
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }
    } catch (error: any) {
      console.error('[VIP] Download error:', error?.message || error);
      
      // Fallback: Offer to open in browser
      const audioUrl = track.audio_url || track.audio_file || track.file_url;
      if (audioUrl) {
        Alert.alert(
          t('common.error'),
          t('vip.downloadErrorTryBrowser'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { 
              text: t('vip.openInBrowser'), 
              onPress: () => {
                import('expo-linking').then(Linking => {
                  Linking.openURL(audioUrl);
                });
              }
            }
          ]
        );
      } else {
        Alert.alert(t('common.error'), t('vip.downloadError'));
      }
    } finally {
      setDownloading(null);
    }
  };

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

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#7C4DFF', '#651FFF']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="diamond" size={28} color="#FFD700" />
          <Text style={styles.headerTitle}>{t('vip.title')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Diamond Balance Banner */}
      <View style={styles.diamondBanner}>
        <View style={styles.diamondInfo}>
          <View style={styles.diamondIconContainer}>
            <Ionicons name="diamond" size={32} color="#1a1a2e" />
          </View>
          <View>
            <Text style={styles.diamondLabel}>{t('vip.yourBalance')}</Text>
            <Text style={styles.diamondValue}>{userDiamonds} Black Diamonds</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.buyButton}
          onPress={() => router.push('/profile/diamonds')}
        >
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.buyButtonText}>{t('vip.buyMore')}</Text>
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color={Colors.primary} />
        <Text style={styles.infoText}>
          {t('vip.unlockInfo').replace('{cost}', String(UNLOCK_COST))}
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{vipTracks.length}</Text>
          <Text style={styles.statLabel}>{t('vip.vipTracks')}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{unlockedTracks.length}</Text>
          <Text style={styles.statLabel}>{t('vip.unlocked')}</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.loadingText}>{t('vip.loadingVip')}</Text>
          </View>
        ) : vipTracks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes-outline" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{t('vip.noVipTracks')}</Text>
            <Text style={styles.emptySubtext}>{t('vip.checkBackLater')}</Text>
          </View>
        ) : (
          vipTracks.map((track) => {
            const trackId = track.id || track._id || '';
            const isCurrentTrack = currentTrack && (currentTrack.id || currentTrack._id) === trackId;
            const coverUrl = getCoverImageUrl(track);
            const unlocked = isTrackUnlocked(trackId);
            const isDownloading = downloading === trackId;
            
            return (
              <View key={trackId} style={[styles.trackCard, isCurrentTrack && styles.trackCardActive]}>
                {/* VIP/Lock Badge */}
                <View style={[styles.statusBadge, unlocked ? styles.unlockedBadge : styles.lockedBadge]}>
                  <Ionicons 
                    name={unlocked ? "checkmark-circle" : "lock-closed"} 
                    size={12} 
                    color={unlocked ? "#4CAF50" : "#FFD700"} 
                  />
                </View>
                
                {/* Play Button */}
                <TouchableOpacity 
                  style={styles.playButton}
                  onPress={() => playTrack(track)}
                >
                  <Ionicons 
                    name={isCurrentTrack && isPlaying ? 'pause' : 'play'} 
                    size={20} 
                    color="#fff" 
                  />
                </TouchableOpacity>
                
                {/* Cover */}
                <View style={styles.trackCover}>
                  {coverUrl ? (
                    <Image source={{ uri: coverUrl }} style={styles.coverImage} />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Ionicons name="musical-notes" size={20} color={Colors.textMuted} />
                    </View>
                  )}
                </View>
                
                {/* Track Info */}
                <View style={styles.trackInfo}>
                  <Text style={[styles.trackTitle, isCurrentTrack && styles.trackTitleActive]} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>{getArtistName(track)}</Text>
                  <Text style={styles.trackGenre}>{track.genre}</Text>
                </View>
                
                {/* Unlock/Download Button */}
                <TouchableOpacity 
                  style={[
                    styles.actionButton, 
                    unlocked ? styles.downloadButton : styles.unlockButton
                  ]}
                  onPress={() => handleUnlockPress(track)}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : unlocked ? (
                    <>
                      <Ionicons name="download" size={16} color="#fff" />
                      <Text style={styles.actionButtonText}>{t('vip.download')}</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="diamond" size={14} color="#1a1a2e" />
                      <Text style={styles.unlockButtonText}>{UNLOCK_COST}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
        
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Unlock Confirmation Modal */}
      <Modal
        visible={showUnlockModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnlockModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIcon}>
              <Ionicons name="diamond" size={40} color="#FFD700" />
            </View>
            
            <Text style={styles.modalTitle}>{t('vip.unlockTrack')}</Text>
            
            {selectedTrack && (
              <View style={styles.modalTrackInfo}>
                <Text style={styles.modalTrackTitle}>{selectedTrack.title}</Text>
                <Text style={styles.modalTrackArtist}>{getArtistName(selectedTrack)}</Text>
              </View>
            )}
            
            <View style={styles.modalCost}>
              <Text style={styles.modalCostLabel}>{t('vip.cost')}:</Text>
              <View style={styles.modalCostValue}>
                <Ionicons name="diamond" size={20} color="#1a1a2e" />
                <Text style={styles.modalCostNumber}>{UNLOCK_COST}</Text>
              </View>
            </View>
            
            <View style={styles.modalBalance}>
              <Text style={styles.modalBalanceLabel}>{t('vip.yourBalance')}:</Text>
              <Text style={[
                styles.modalBalanceValue,
                userDiamonds < UNLOCK_COST && styles.modalBalanceInsufficient
              ]}>
                {userDiamonds} Black Diamonds
              </Text>
            </View>
            
            {userDiamonds < UNLOCK_COST && (
              <Text style={styles.modalWarning}>
                {t('vip.insufficientDiamonds')}
              </Text>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowUnlockModal(false)}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.modalConfirmButton,
                  userDiamonds < UNLOCK_COST && styles.modalConfirmButtonDisabled
                ]}
                onPress={handleUnlock}
                disabled={userDiamonds < UNLOCK_COST}
              >
                <Ionicons name="lock-open" size={18} color="#fff" />
                <Text style={styles.modalConfirmText}>{t('vip.unlock')}</Text>
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
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingTop: 50, 
    paddingBottom: 16, 
    paddingHorizontal: 16 
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  
  // Diamond Banner
  diamondBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFD700',
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
  },
  diamondInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  diamondIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  diamondLabel: {
    fontSize: 12,
    color: '#1a1a2e',
    opacity: 0.8,
  },
  diamondValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Info Banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 8,
    padding: 12,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  
  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 10,
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  
  // Content
  content: { flex: 1, padding: 12 },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingVertical: 60 
  },
  loadingText: { color: Colors.textMuted, marginTop: 12 },
  emptyContainer: { 
    alignItems: 'center', 
    paddingVertical: 60 
  },
  emptyText: { 
    color: Colors.text, 
    fontSize: 16, 
    fontWeight: '600', 
    marginTop: 16 
  },
  emptySubtext: { 
    color: Colors.textMuted, 
    fontSize: 13, 
    marginTop: 8 
  },
  
  // Track Card
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trackCardActive: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  statusBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  lockedBadge: {
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  unlockedBadge: {
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  trackCover: {
    width: 50,
    height: 50,
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 10,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackInfo: {
    flex: 1,
    marginRight: 10,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  trackTitleActive: {
    color: '#FFD700',
  },
  trackArtist: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  trackGenre: {
    fontSize: 10,
    color: Colors.primary,
    marginTop: 2,
  },
  
  // Action Buttons
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  unlockButton: {
    backgroundColor: '#FFD700',
  },
  downloadButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  unlockButtonText: {
    color: '#1a1a2e',
    fontSize: 12,
    fontWeight: '700',
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFD70020',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  modalTrackInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTrackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modalTrackArtist: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  modalCost: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70020',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
    gap: 10,
  },
  modalCostLabel: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  modalCostValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalCostNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  modalBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  modalBalanceLabel: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  modalBalanceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  modalBalanceInsufficient: {
    color: '#F44336',
  },
  modalWarning: {
    fontSize: 12,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  modalCancelText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalConfirmButtonDisabled: {
    backgroundColor: Colors.textMuted,
    opacity: 0.5,
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
