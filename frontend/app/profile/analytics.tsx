import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { base44Tracks, Track } from '../../src/services/base44Api';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

export default function AnalyticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
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
      
      // Get all approved tracks
      const allTracks = await base44Tracks.list({ limit: 200 });
      
      // Filter only approved tracks
      const approvedTracks = allTracks.filter((track: any) => track.status === 'approved');

      // Calculate stats for ALL approved tracks
      let totalPlays = 0;
      let totalDownloads = 0;
      let totalRating = 0;
      let ratingCount = 0;

      approvedTracks.forEach((track: any) => {
        totalPlays += track.play_count || 0;
        totalDownloads += track.download_count || 0;
        
        if (track.average_rating || track.rating) {
          totalRating += track.average_rating || track.rating || 0;
          ratingCount++;
        }
      });

      // Count by status
      const pendingTracks = allTracks.filter((t: any) => t.status === 'pending').length;

      setStats({
        totalTracks: approvedTracks.length,
        totalPlays,
        totalDownloads,
        averageRating: ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : 0,
        approvedTracks: approvedTracks.length,
        pendingTracks: pendingTracks,
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
        <Text style={styles.loadingText}>Loading analytics...</Text>
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
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Main Stats */}
        <View style={styles.mainStats}>
          <View style={styles.statCard}>
            <LinearGradient colors={['#9C27B0', '#7B1FA2']} style={styles.statGradient}>
              <Ionicons name="musical-notes" size={28} color="#fff" />
              <Text style={styles.statValue}>{stats.totalTracks}</Text>
              <Text style={styles.statLabel}>Total Tracks</Text>
            </LinearGradient>
          </View>
          
          <View style={styles.statCard}>
            <LinearGradient colors={['#2196F3', '#1976D2']} style={styles.statGradient}>
              <Ionicons name="play" size={28} color="#fff" />
              <Text style={styles.statValue}>{stats.totalPlays}</Text>
              <Text style={styles.statLabel}>Total Plays</Text>
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
            <LinearGradient colors={['#FF9800', '#F57C00']} style={styles.statGradient}>
              <Ionicons name="star" size={28} color="#fff" />
              <Text style={styles.statValue}>{stats.averageRating}</Text>
              <Text style={styles.statLabel}>Avg. Rating</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Status breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Track Status</Text>
          
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.statusLabel}>Approved</Text>
              <Text style={styles.statusValue}>{stats.approvedTracks}</Text>
            </View>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: '#FF9800' }]} />
              <Text style={styles.statusLabel}>Pending</Text>
              <Text style={styles.statusValue}>{stats.pendingTracks}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.comingSoon}>
          More detailed analytics coming soon...
        </Text>
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
  comingSoon: { textAlign: 'center', color: Colors.textMuted, marginTop: 30, fontSize: 14 },
});
