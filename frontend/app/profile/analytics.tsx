import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { base44Tracks, Track } from '../../src/services/base44Api';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

export default function AnalyticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTracks: 0,
    totalPlays: 0,
    totalDownloads: 0,
    averageRating: 0,
    approvedTracks: 0,
    pendingTracks: 0,
  });

  useEffect(() => {
    loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Get user ID - try different possible fields
      const userId = user?.id || user?._id || '';
      console.log('[Analytics] Loading for user:', userId);
      
      if (!userId) {
        console.log('[Analytics] No user ID found');
        setLoading(false);
        return;
      }

      // Get all tracks
      const allTracks = await base44Tracks.list({ limit: 500 });
      console.log('[Analytics] Total tracks loaded:', allTracks.length);
      
      // Filter to get ONLY user's tracks
      const myTracks = allTracks.filter((track: any) => {
        const isMyTrack = 
          track.producer_id === userId || 
          track.created_by_id === userId ||
          track.uploaded_by === userId;
        return isMyTrack;
      });
      
      console.log('[Analytics] My tracks:', myTracks.length);

      // Calculate stats from MY tracks only
      let totalPlays = 0;
      let totalDownloads = 0;
      let totalRating = 0;
      let ratingCount = 0;
      let approvedCount = 0;
      let pendingCount = 0;

      myTracks.forEach((track: any) => {
        totalPlays += track.play_count || 0;
        totalDownloads += track.download_count || 0;
        
        if (track.average_rating || track.rating) {
          totalRating += track.average_rating || track.rating || 0;
          ratingCount++;
        }

        if (track.status === 'approved') {
          approvedCount++;
        } else if (track.status === 'pending') {
          pendingCount++;
        }
      });

      setStats({
        totalTracks: myTracks.length,
        totalPlays,
        totalDownloads,
        averageRating: ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : 0,
        approvedTracks: approvedCount,
        pendingTracks: pendingCount,
      });
    } catch (error) {
      console.error('[Analytics] Error loading:', error);
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.headerTitle}>{t('analytics.title')}</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView style={styles.content}>
        {stats.totalTracks === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bar-chart-outline" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('analytics.noTracks')}</Text>
            <Text style={styles.emptySubtitle}>{t('analytics.uploadToSee')}</Text>
          </View>
        ) : (
          <>
            {/* Main Stats */}
            <View style={styles.mainStats}>
              <View style={styles.statCard}>
                <LinearGradient colors={['#9C27B0', '#7B1FA2']} style={styles.statGradient}>
                  <Ionicons name="musical-notes" size={28} color="#fff" />
                  <Text style={styles.statValue}>{stats.totalTracks}</Text>
                  <Text style={styles.statLabel}>{t('analytics.myTracks')}</Text>
                </LinearGradient>
              </View>
              
              <View style={styles.statCard}>
                <LinearGradient colors={['#2196F3', '#1976D2']} style={styles.statGradient}>
                  <Ionicons name="play" size={28} color="#fff" />
                  <Text style={styles.statValue}>{stats.totalPlays}</Text>
                  <Text style={styles.statLabel}>{t('analytics.totalPlays')}</Text>
                </LinearGradient>
              </View>
            </View>

            <View style={styles.mainStats}>
              <View style={styles.statCard}>
                <LinearGradient colors={['#4CAF50', '#388E3C']} style={styles.statGradient}>
                  <Ionicons name="download" size={28} color="#fff" />
                  <Text style={styles.statValue}>{stats.totalDownloads}</Text>
                  <Text style={styles.statLabel}>{t('analytics.downloads')}</Text>
                </LinearGradient>
              </View>
              
              <View style={styles.statCard}>
                <LinearGradient colors={['#FF9800', '#F57C00']} style={styles.statGradient}>
                  <Ionicons name="star" size={28} color="#fff" />
                  <Text style={styles.statValue}>{stats.averageRating}</Text>
                  <Text style={styles.statLabel}>{t('analytics.avgRating')}</Text>
                </LinearGradient>
              </View>
            </View>

            {/* Status breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('analytics.trackStatus')}</Text>
              
              <View style={styles.statusCard}>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
                  <Text style={styles.statusLabel}>{t('analytics.approved')}</Text>
                  <Text style={styles.statusValue}>{stats.approvedTracks}</Text>
                </View>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: '#FF9800' }]} />
                  <Text style={styles.statusLabel}>{t('analytics.pending')}</Text>
                  <Text style={styles.statusValue}>{stats.pendingTracks}</Text>
                </View>
              </View>
            </View>
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  content: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: Colors.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted, marginTop: 8 },
  mainStats: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  statGradient: { padding: 20, alignItems: 'center' },
  statValue: { fontSize: 32, fontWeight: '700', color: '#fff', marginTop: 8 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  statusCard: { backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  statusLabel: { flex: 1, color: Colors.text, fontSize: 14 },
  statusValue: { color: Colors.text, fontSize: 16, fontWeight: '600' },
});
