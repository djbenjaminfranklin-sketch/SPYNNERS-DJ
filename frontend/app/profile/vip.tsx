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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { base44VIP, base44Tracks, Track, VIPPromo } from '../../src/services/base44Api';
import { useAuth } from '../../src/contexts/AuthContext';
import { usePlayer } from '../../src/contexts/PlayerContext';
import { useLanguage } from '../../src/contexts/LanguageContext';

export default function VIPScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayer();
  const { t } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [promos, setPromos] = useState<VIPPromo[]>([]);
  const [vipTracks, setVipTracks] = useState<Track[]>([]);
  const [myPurchases, setMyPurchases] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'promos' | 'tracks'>('promos');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const userId = user?.id || user?._id || '';
      
      // Load VIP promos
      const promosData = await base44VIP.listPromos();
      setPromos(promosData.filter((p: VIPPromo) => p.is_active !== false));
      
      // Load VIP tracks (tracks that are in promos)
      const allTracks = await base44Tracks.list({ limit: 200 });
      const vipTracksList = allTracks.filter((t: Track) => t.is_vip === true);
      setVipTracks(vipTracksList);
      
      // Load user's purchases
      if (userId) {
        const purchases = await base44VIP.listMyPurchases(userId);
        setMyPurchases(purchases);
      }
      
      console.log('[VIP] Loaded', promosData.length, 'promos,', vipTracksList.length, 'VIP tracks');
    } catch (error) {
      console.error('[VIP] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Check if user has purchased a promo
  const hasPurchased = (promoId: string): boolean => {
    return myPurchases.some((p: any) => p.promo_id === promoId);
  };

  // Handle purchase
  const handlePurchase = async (promo: VIPPromo) => {
    const promoId = promo.id || promo._id || '';
    
    if (hasPurchased(promoId)) {
      Alert.alert('Already Purchased', 'You already own this VIP promo!');
      return;
    }
    
    Alert.alert(
      'Purchase VIP Promo',
      `Get access to "${promo.name}" for ${promo.price || 0}€?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Purchase', 
          onPress: async () => {
            try {
              const userId = user?.id || user?._id || '';
              await base44VIP.createPurchase({
                user_id: userId,
                promo_id: promoId,
                purchased_at: new Date().toISOString(),
                amount: promo.price,
              });
              Alert.alert('Success', 'VIP Promo purchased successfully!');
              loadData();
            } catch (error) {
              console.error('[VIP] Purchase error:', error);
              Alert.alert('Error', 'Could not complete purchase. Please try again.');
            }
          }
        },
      ]
    );
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

      {/* Stats Banner */}
      <View style={styles.statsBanner}>
        <View style={styles.statItem}>
          <Ionicons name="gift" size={20} color={Colors.primary} />
          <Text style={styles.statValue}>{promos.length}</Text>
          <Text style={styles.statLabel}>{t('vip.promos')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="musical-notes" size={20} color="#FFD700" />
          <Text style={styles.statValue}>{vipTracks.length}</Text>
          <Text style={styles.statLabel}>{t('vip.vipTracks')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
          <Text style={styles.statValue}>{myPurchases.length}</Text>
          <Text style={styles.statLabel}>{t('vip.purchased')}</Text>
        </View>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'promos' && styles.tabActive]}
          onPress={() => setActiveTab('promos')}
        >
          <Ionicons name="gift" size={18} color={activeTab === 'promos' ? '#FFD700' : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'promos' && styles.tabTextActive]}>
            {t('vip.promos')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'tracks' && styles.tabActive]}
          onPress={() => setActiveTab('tracks')}
        >
          <Ionicons name="musical-notes" size={18} color={activeTab === 'tracks' ? '#FFD700' : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'tracks' && styles.tabTextActive]}>
            {t('vip.vipTracks')}
          </Text>
        </TouchableOpacity>
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
        ) : activeTab === 'promos' ? (
          // Promos Tab
          promos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="gift-outline" size={60} color={Colors.textMuted} />
              <Text style={styles.emptyText}>{t('vip.noPromos')}</Text>
              <Text style={styles.emptySubtext}>{t('vip.checkBack')}</Text>
            </View>
          ) : (
            promos.map((promo) => {
              const promoId = promo.id || promo._id || '';
              const isPurchased = hasPurchased(promoId);
              
              return (
                <View key={promoId} style={styles.promoCard}>
                  <LinearGradient 
                    colors={isPurchased ? ['#4CAF50', '#388E3C'] : ['#7C4DFF', '#651FFF']} 
                    style={styles.promoGradient}
                  >
                    <View style={styles.promoHeader}>
                      <Ionicons name={isPurchased ? 'checkmark-circle' : 'diamond'} size={24} color="#FFD700" />
                      <Text style={styles.promoName}>{promo.name}</Text>
                      {isPurchased && (
                        <View style={styles.purchasedBadge}>
                          <Text style={styles.purchasedText}>{t('vip.owned')}</Text>
                        </View>
                      )}
                    </View>
                    
                    {promo.description && (
                      <Text style={styles.promoDescription}>{promo.description}</Text>
                    )}
                    
                    <View style={styles.promoFooter}>
                      <View style={styles.promoInfo}>
                        <Text style={styles.promoTracks}>
                          {(promo.track_ids || []).length} {t('vip.exclusiveTracks')}
                        </Text>
                        {promo.duration_days && (
                          <Text style={styles.promoDuration}>{promo.duration_days} {t('vip.daysAccess')}</Text>
                        )}
                      </View>
                      
                      <TouchableOpacity 
                        style={[styles.promoButton, isPurchased && styles.promoButtonDisabled]}
                        onPress={() => handlePurchase(promo)}
                        disabled={isPurchased}
                      >
                        <Text style={styles.promoButtonText}>
                          {isPurchased ? t('vip.purchased') : `${promo.price || 0}€`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </View>
              );
            })
          )
        ) : (
          // Tracks Tab
          vipTracks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="musical-notes-outline" size={60} color={Colors.textMuted} />
              <Text style={styles.emptyText}>{t('vip.noVipTracks')}</Text>
              <Text style={styles.emptySubtext}>{t('vip.purchasePromo')}</Text>
            </View>
          ) : (
            vipTracks.map((track) => {
              const trackId = track.id || track._id || '';
              const isCurrentTrack = currentTrack && (currentTrack.id || currentTrack._id) === trackId;
              const coverUrl = getCoverImageUrl(track);
              
              return (
                <TouchableOpacity 
                  key={trackId}
                  style={[styles.trackCard, isCurrentTrack && styles.trackCardActive]}
                  onPress={() => playTrack(track)}
                  activeOpacity={0.7}
                >
                  <View style={styles.vipBadge}>
                    <Ionicons name="diamond" size={12} color="#FFD700" />
                  </View>
                  
                  <View style={styles.trackCover}>
                    {coverUrl ? (
                      <Image source={{ uri: coverUrl }} style={styles.coverImage} />
                    ) : (
                      <View style={styles.coverPlaceholder}>
                        <Ionicons name="musical-notes" size={20} color={Colors.textMuted} />
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.trackInfo}>
                    <Text style={[styles.trackTitle, isCurrentTrack && styles.trackTitleActive]} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>{getArtistName(track)}</Text>
                    <Text style={styles.trackGenre}>{track.genre}</Text>
                  </View>
                  
                  {isCurrentTrack && isPlaying ? (
                    <TouchableOpacity onPress={togglePlayPause}>
                      <Ionicons name="pause-circle" size={36} color="#FFD700" />
                    </TouchableOpacity>
                  ) : (
                    <Ionicons name="play-circle-outline" size={36} color={Colors.textMuted} />
                  )}
                </TouchableOpacity>
              );
            })
          )
        )}
        
        <View style={{ height: 30 }} />
      </ScrollView>
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
  
  // Stats Banner
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFD70040',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 10, color: Colors.textMuted },
  statDivider: { width: 1, backgroundColor: Colors.border },
  
  // Tabs
  tabContainer: { 
    flexDirection: 'row', 
    paddingHorizontal: 12, 
    paddingVertical: 12, 
    gap: 10 
  },
  tab: { 
    flex: 1, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12, 
    paddingHorizontal: 12,
    borderRadius: 10, 
    backgroundColor: Colors.backgroundCard,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { 
    backgroundColor: '#FFD70020',
    borderColor: '#FFD700',
  },
  tabText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  tabTextActive: { color: '#FFD700', fontWeight: '600' },
  
  // Content
  content: { flex: 1, paddingHorizontal: 12 },
  loadingContainer: { padding: 60, alignItems: 'center' },
  loadingText: { color: Colors.textMuted, marginTop: 12 },
  emptyContainer: { padding: 60, alignItems: 'center' },
  emptyText: { color: Colors.text, fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { color: Colors.textMuted, fontSize: 14, marginTop: 4 },
  
  // Promo Card
  promoCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  promoGradient: {
    padding: 20,
  },
  promoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  promoName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  purchasedBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  purchasedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000',
  },
  promoDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 16,
    lineHeight: 20,
  },
  promoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promoInfo: {},
  promoTracks: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  promoDuration: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  promoButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  promoButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  promoButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  
  // Track Card
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFD70040',
    gap: 12,
    position: 'relative',
  },
  trackCardActive: {
    borderColor: '#FFD700',
    backgroundColor: '#FFD70010',
  },
  vipBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.backgroundCard,
    padding: 4,
    borderRadius: 4,
    zIndex: 1,
  },
  trackCover: { width: 50, height: 50, borderRadius: 8, overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { 
    width: '100%', 
    height: '100%', 
    backgroundColor: Colors.border, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  trackInfo: { flex: 1, minWidth: 0 },
  trackTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  trackTitleActive: { color: '#FFD700' },
  trackArtist: { fontSize: 12, color: '#FFD700', marginTop: 2 },
  trackGenre: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
});
