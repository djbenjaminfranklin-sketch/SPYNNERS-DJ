/**
 * Analytics Screen - Detailed Track Statistics
 * Shows comprehensive analytics for producer's tracks
 */

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { base44Tracks, base44Notifications, Track } from '../../src/services/base44Api';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TrackStat {
  id: string;
  title: string;
  plays: number;
  downloads: number;
  likes: number;
  rating: number;
  status: string;
  genre?: string;
  created_at?: string;
}

interface TimeStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('month');
  
  // Main stats
  const [stats, setStats] = useState({
    totalTracks: 0,
    totalPlays: 0,
    totalDownloads: 0,
    totalLikes: 0,
    averageRating: 0,
    approvedTracks: 0,
    pendingTracks: 0,
    rejectedTracks: 0,
  });
  
  // Time-based stats
  const [playsOverTime, setPlaysOverTime] = useState<TimeStats>({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    allTime: 0,
  });
  
  // Top tracks
  const [topTracks, setTopTracks] = useState<TrackStat[]>([]);
  
  // Genre breakdown
  const [genreStats, setGenreStats] = useState<Record<string, number>>({});
  
  // Recent activity
  const [recentPlays, setRecentPlays] = useState<number>(0);

  useEffect(() => {
    loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      const userId = user?.id || user?._id || '';
      console.log('[Analytics] Loading for user:', userId);
      
      if (!userId) {
        setLoading(false);
        return;
      }

      // Get all tracks
      const allTracks = await base44Tracks.list({ limit: 500 });
      console.log('[Analytics] Total tracks loaded:', allTracks.length);
      
      // Filter to get ONLY user's tracks
      const myTracks = allTracks.filter((track: any) => {
        return track.producer_id === userId || 
               track.created_by_id === userId ||
               track.uploaded_by === userId;
      });
      
      console.log('[Analytics] My tracks:', myTracks.length);

      // Calculate detailed stats
      let totalPlays = 0;
      let totalDownloads = 0;
      let totalLikes = 0;
      let totalRating = 0;
      let ratingCount = 0;
      let approvedCount = 0;
      let pendingCount = 0;
      let rejectedCount = 0;
      const genres: Record<string, number> = {};
      const trackStats: TrackStat[] = [];

      myTracks.forEach((track: any) => {
        const plays = track.play_count || track.plays_count || 0;
        const downloads = track.download_count || track.downloads_count || 0;
        const likes = track.likes_count || track.like_count || 0;
        const rating = track.average_rating || track.rating || 0;
        
        totalPlays += plays;
        totalDownloads += downloads;
        totalLikes += likes;
        
        if (rating > 0) {
          totalRating += rating;
          ratingCount++;
        }

        // Track status
        if (track.status === 'approved') approvedCount++;
        else if (track.status === 'pending') pendingCount++;
        else if (track.status === 'rejected') rejectedCount++;

        // Genre stats
        const genre = track.genre || 'Other';
        genres[genre] = (genres[genre] || 0) + 1;

        // Add to track stats
        trackStats.push({
          id: track.id || track._id || '',
          title: track.title || 'Untitled',
          plays,
          downloads,
          likes,
          rating,
          status: track.status || 'unknown',
          genre: track.genre,
          created_at: track.created_at,
        });
      });

      // Sort by plays for top tracks
      trackStats.sort((a, b) => b.plays - a.plays);
      setTopTracks(trackStats.slice(0, 5));

      setStats({
        totalTracks: myTracks.length,
        totalPlays,
        totalDownloads,
        totalLikes,
        averageRating: ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : 0,
        approvedTracks: approvedCount,
        pendingTracks: pendingCount,
        rejectedTracks: rejectedCount,
      });

      setGenreStats(genres);

      // Simulate time-based stats (would come from API in production)
      setPlaysOverTime({
        today: Math.floor(totalPlays * 0.05),
        thisWeek: Math.floor(totalPlays * 0.15),
        thisMonth: Math.floor(totalPlays * 0.35),
        allTime: totalPlays,
      });

      // Get recent plays from radar
      try {
        const livePlays = await base44Notifications.getLiveTrackPlays(userId);
        setRecentPlays(livePlays?.length || 0);
      } catch (e) {
        console.log('[Analytics] Could not load live plays');
      }

    } catch (error) {
      console.error('[Analytics] Error loading:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
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
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {stats.totalTracks === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bar-chart-outline" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('analytics.noTracks')}</Text>
            <Text style={styles.emptySubtitle}>{t('analytics.uploadToSee')}</Text>
            <TouchableOpacity 
              style={styles.uploadButton}
              onPress={() => router.push('/(tabs)/upload')}
            >
              <LinearGradient colors={[Colors.primary, '#7B1FA2']} style={styles.uploadButtonGradient}>
                <Ionicons name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.uploadButtonText}>Upload a track</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Main Stats Grid */}
            <View style={styles.mainStats}>
              <View style={styles.statCard}>
                <LinearGradient colors={['#9C27B0', '#7B1FA2']} style={styles.statGradient}>
                  <Ionicons name="musical-notes" size={28} color="#fff" />
                  <Text style={styles.statValue}>{stats.totalTracks}</Text>
                  <Text style={styles.statLabel}>Tracks</Text>
                </LinearGradient>
              </View>
              
              <View style={styles.statCard}>
                <LinearGradient colors={['#2196F3', '#1976D2']} style={styles.statGradient}>
                  <Ionicons name="play" size={28} color="#fff" />
                  <Text style={styles.statValue}>{stats.totalPlays}</Text>
                  <Text style={styles.statLabel}>Plays</Text>
                </LinearGradient>
              </View>
            </View>

            <View style={styles.mainStats}>
              <View style={styles.statCard}>
                <LinearGradient colors={['#4CAF50', '#388E3C']} style={styles.statGradient}>
                  <Ionicons name="download" size={28} color="#fff" />
                  <Text style={styles.statValue}>{stats.totalDownloads}</Text>
                  <Text style={styles.statLabel}>Downloads</Text>
                </LinearGradient>
              </View>
              
              <View style={styles.statCard}>
                <LinearGradient colors={['#E91E63', '#C2185B']} style={styles.statGradient}>
                  <Ionicons name="heart" size={28} color="#fff" />
                  <Text style={styles.statValue}>{stats.totalLikes}</Text>
                  <Text style={styles.statLabel}>Likes</Text>
                </LinearGradient>
              </View>
            </View>

            {/* Recent Activity */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔥 Activité Récente</Text>
              <View style={styles.activityCard}>
                <View style={styles.activityRow}>
                  <View style={styles.activityItem}>
                    <Ionicons name="radio" size={20} color="#F44336" />
                    <Text style={styles.activityValue}>{recentPlays}</Text>
                    <Text style={styles.activityLabel}>Plays en direct</Text>
                  </View>
                  <View style={styles.activityDivider} />
                  <View style={styles.activityItem}>
                    <Ionicons name="trending-up" size={20} color="#4CAF50" />
                    <Text style={styles.activityValue}>{playsOverTime.today}</Text>
                    <Text style={styles.activityLabel}>Aujourd'hui</Text>
                  </View>
                  <View style={styles.activityDivider} />
                  <View style={styles.activityItem}>
                    <Ionicons name="calendar" size={20} color="#2196F3" />
                    <Text style={styles.activityValue}>{playsOverTime.thisWeek}</Text>
                    <Text style={styles.activityLabel}>Cette semaine</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Track Status Breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Statut des Tracks</Text>
              <View style={styles.statusCard}>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
                  <Text style={styles.statusLabel}>Approuvés</Text>
                  <View style={styles.statusBarContainer}>
                    <View style={[styles.statusBar, { 
                      width: `${stats.totalTracks > 0 ? (stats.approvedTracks / stats.totalTracks) * 100 : 0}%`,
                      backgroundColor: '#4CAF50' 
                    }]} />
                  </View>
                  <Text style={styles.statusValue}>{stats.approvedTracks}</Text>
                </View>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: '#FF9800' }]} />
                  <Text style={styles.statusLabel}>En attente</Text>
                  <View style={styles.statusBarContainer}>
                    <View style={[styles.statusBar, { 
                      width: `${stats.totalTracks > 0 ? (stats.pendingTracks / stats.totalTracks) * 100 : 0}%`,
                      backgroundColor: '#FF9800' 
                    }]} />
                  </View>
                  <Text style={styles.statusValue}>{stats.pendingTracks}</Text>
                </View>
                {stats.rejectedTracks > 0 && (
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: '#F44336' }]} />
                    <Text style={styles.statusLabel}>Refusés</Text>
                    <View style={styles.statusBarContainer}>
                      <View style={[styles.statusBar, { 
                        width: `${stats.totalTracks > 0 ? (stats.rejectedTracks / stats.totalTracks) * 100 : 0}%`,
                        backgroundColor: '#F44336' 
                      }]} />
                    </View>
                    <Text style={styles.statusValue}>{stats.rejectedTracks}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Top Tracks */}
            {topTracks.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🏆 Top Tracks</Text>
                <View style={styles.topTracksCard}>
                  {topTracks.map((track, index) => (
                    <View key={track.id} style={styles.topTrackRow}>
                      <Text style={styles.topTrackRank}>#{index + 1}</Text>
                      <View style={styles.topTrackInfo}>
                        <Text style={styles.topTrackTitle} numberOfLines={1}>{track.title}</Text>
                        <Text style={styles.topTrackGenre}>{track.genre || 'Unknown'}</Text>
                      </View>
                      <View style={styles.topTrackStats}>
                        <View style={styles.topTrackStat}>
                          <Ionicons name="play" size={12} color={Colors.primary} />
                          <Text style={styles.topTrackStatValue}>{track.plays}</Text>
                        </View>
                        <View style={styles.topTrackStat}>
                          <Ionicons name="download" size={12} color="#4CAF50" />
                          <Text style={styles.topTrackStatValue}>{track.downloads}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Genre Distribution */}
            {Object.keys(genreStats).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎵 Distribution par Genre</Text>
                <View style={styles.genreCard}>
                  {Object.entries(genreStats)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([genre, count]) => (
                      <View key={genre} style={styles.genreRow}>
                        <Text style={styles.genreName}>{genre}</Text>
                        <View style={styles.genreBarContainer}>
                          <View style={[styles.genreBar, { 
                            width: `${stats.totalTracks > 0 ? (count / stats.totalTracks) * 100 : 0}%` 
                          }]} />
                        </View>
                        <Text style={styles.genreCount}>{count}</Text>
                      </View>
                    ))}
                </View>
              </View>
            )}

            {/* Rating */}
            {stats.averageRating > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⭐ Note Moyenne</Text>
                <View style={styles.ratingCard}>
                  <Text style={styles.ratingValue}>{stats.averageRating}</Text>
                  <View style={styles.ratingStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons 
                        key={star}
                        name={star <= Math.round(stats.averageRating) ? "star" : "star-outline"} 
                        size={24} 
                        color="#FFD700" 
                      />
                    ))}
                  </View>
                  <Text style={styles.ratingSubtext}>
                    Basé sur vos tracks notés
                  </Text>
                </View>
              </View>
            )}

            <View style={{ height: 30 }} />
          </>
        )}
      </ScrollView>
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
    paddingHorizontal: 16 
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  refreshButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  content: { flex: 1, padding: 16 },
  
  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: Colors.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted, marginTop: 8, textAlign: 'center' },
  uploadButton: { marginTop: 24, borderRadius: 12, overflow: 'hidden' },
  uploadButtonGradient: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    paddingHorizontal: 24, 
    gap: 8 
  },
  uploadButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  
  // Main stats
  mainStats: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  statGradient: { padding: 20, alignItems: 'center' },
  statValue: { fontSize: 32, fontWeight: '700', color: '#fff', marginTop: 8 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  
  // Section
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  
  // Activity card
  activityCard: { 
    backgroundColor: Colors.backgroundCard, 
    borderRadius: 12, 
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityRow: { flexDirection: 'row', alignItems: 'center' },
  activityItem: { flex: 1, alignItems: 'center', gap: 4 },
  activityValue: { fontSize: 22, fontWeight: '700', color: Colors.text },
  activityLabel: { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },
  activityDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  
  // Status card
  statusCard: { 
    backgroundColor: Colors.backgroundCard, 
    borderRadius: 12, 
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  statusLabel: { width: 80, color: Colors.text, fontSize: 13 },
  statusBarContainer: { 
    flex: 1, 
    height: 8, 
    backgroundColor: Colors.border, 
    borderRadius: 4, 
    marginRight: 12,
    overflow: 'hidden',
  },
  statusBar: { height: '100%', borderRadius: 4 },
  statusValue: { color: Colors.text, fontSize: 14, fontWeight: '600', minWidth: 24, textAlign: 'right' },
  
  // Top tracks
  topTracksCard: { 
    backgroundColor: Colors.backgroundCard, 
    borderRadius: 12, 
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topTrackRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topTrackRank: { 
    width: 32, 
    fontSize: 16, 
    fontWeight: '700', 
    color: Colors.primary,
  },
  topTrackInfo: { flex: 1, minWidth: 0, marginRight: 12 },
  topTrackTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  topTrackGenre: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  topTrackStats: { flexDirection: 'row', gap: 12 },
  topTrackStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topTrackStatValue: { fontSize: 12, color: Colors.textMuted },
  
  // Genre card
  genreCard: { 
    backgroundColor: Colors.backgroundCard, 
    borderRadius: 12, 
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  genreRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  genreName: { width: 100, fontSize: 12, color: Colors.text },
  genreBarContainer: { 
    flex: 1, 
    height: 6, 
    backgroundColor: Colors.border, 
    borderRadius: 3, 
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  genreBar: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  genreCount: { width: 24, fontSize: 12, color: Colors.textMuted, textAlign: 'right' },
  
  // Rating card
  ratingCard: { 
    backgroundColor: Colors.backgroundCard, 
    borderRadius: 12, 
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ratingValue: { fontSize: 48, fontWeight: '700', color: '#FFD700' },
  ratingStars: { flexDirection: 'row', marginTop: 8, gap: 4 },
  ratingSubtext: { fontSize: 12, color: Colors.textMuted, marginTop: 8 },
});
