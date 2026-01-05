import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { isUserAdmin } from '../../src/components/AdminBadge';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';

type Session = {
  id: string;
  dj_name: string;
  location: string;
  venue: string;
  started_at: string;
  status: 'active' | 'ended';
  tracks_detected: number;
  diamonds_earned: number;
};

export default function AdminSessions() {
  const router = useRouter();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    tracks_detected: 0,
    unique_djs: 0,
  });

  const isAdmin = isUserAdmin(user);

  useEffect(() => {
    if (isAdmin) {
      loadSessions();
    }
  }, [isAdmin]);

  const loadSessions = async () => {
    try {
      // Mock data - replace with actual API call
      const mockSessions: Session[] = [
        { id: '1', dj_name: 'Jonathan Roux', location: 'Verel-Pragondran (France)', venue: '-', started_at: '2026-01-05T22:33:00', status: 'active', tracks_detected: 0, diamonds_earned: 0 },
        { id: '2', dj_name: 'romain bieules', location: 'Unknown location', venue: '-', started_at: '2026-01-04T22:23:00', status: 'active', tracks_detected: 0, diamonds_earned: 0 },
        { id: '3', dj_name: 'Jason Youtube', location: 'Unknown location', venue: '-', started_at: '2026-01-04T22:20:00', status: 'active', tracks_detected: 0, diamonds_earned: 0 },
        { id: '4', dj_name: 'William Thuotte', location: 'Unknown location', venue: '-', started_at: '2026-01-04T17:51:00', status: 'active', tracks_detected: 0, diamonds_earned: 0 },
        { id: '5', dj_name: 'Mad Mike', location: 'Esmonts (Suisse)', venue: '-', started_at: '2026-01-04T17:14:00', status: 'active', tracks_detected: 0, diamonds_earned: 0 },
      ];
      
      setSessions(mockSessions);
      setStats({
        total: 856,
        active: 397,
        tracks_detected: 311,
        unique_djs: 175,
      });
    } catch (error) {
      console.error('[AdminSessions] Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSessions();
  };

  const exportReport = () => {
    Alert.alert('Export', `Export du rapport complet (${stats.total} sessions)`);
  };

  const filteredSessions = sessions.filter(s => 
    s.dj_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <ActivityIndicator size="large" color="#2196F3" />
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
          <Ionicons name="radio" size={24} color="#2196F3" />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>SPYN Sessions</Text>
          <Text style={styles.headerSubtitle}>Monitoring des sessions DJ</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2196F3" />}
      >
        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderColor: '#00BCD4' }]}>
            <Ionicons name="disc" size={24} color="#00BCD4" />
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total sessions</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#4CAF50' }]}>
            <Ionicons name="radio-button-on" size={24} color="#4CAF50" />
            <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.active}</Text>
            <Text style={styles.statLabel}>Active now</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#FF9800' }]}>
            <Ionicons name="musical-note" size={24} color="#FF9800" />
            <Text style={styles.statNumber}>{stats.tracks_detected}</Text>
            <Text style={styles.statLabel}>Tracks detected</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#9C27B0' }]}>
            <Ionicons name="headset" size={24} color="#9C27B0" />
            <Text style={styles.statNumber}>{stats.unique_djs}</Text>
            <Text style={styles.statLabel}>Unique DJs</Text>
          </View>
        </View>

        {/* Search & Export */}
        <View style={styles.actionRow}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by DJ, city or venue..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity style={styles.exportBtn} onPress={exportReport}>
            <Ionicons name="download" size={16} color="#fff" />
            <Text style={styles.exportBtnText}>Export Full Report ({stats.total} sessions)</Text>
          </TouchableOpacity>
        </View>

        {/* Session History */}
        <Text style={styles.sectionTitle}>Session history ({stats.total})</Text>
        
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>DJ</Text>
          <Text style={[styles.tableHeaderText, { flex: 2 }]}>Location</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Started</Text>
          <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>Status</Text>
          <Text style={[styles.tableHeaderText, { flex: 0.6 }]}>Tracks</Text>
        </View>

        {filteredSessions.map((session) => (
          <View key={session.id} style={styles.sessionRow}>
            <Text style={[styles.sessionText, { flex: 1.5 }]}>{session.dj_name}</Text>
            <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="location" size={12} color="#00BCD4" />
              <Text style={styles.sessionText} numberOfLines={1}>{session.location}</Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="calendar" size={12} color={Colors.textMuted} />
              <Text style={styles.sessionText}>{new Date(session.started_at).toLocaleDateString()}</Text>
            </View>
            <View style={{ flex: 0.8 }}>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Active</Text>
              </View>
            </View>
            <View style={{ flex: 0.6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="musical-note" size={12} color="#FF9800" />
              <Text style={styles.sessionText}>{session.tracks_detected}</Text>
            </View>
          </View>
        ))}

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

  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, paddingTop: 50, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerBack: { padding: 8 },
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2196F320', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  headerContent: { marginLeft: 12, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textMuted },

  content: { flex: 1, padding: Spacing.md },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: { width: '48%', backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1 },
  statNumber: { fontSize: 28, fontWeight: 'bold', color: Colors.text, marginTop: 8 },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },

  actionRow: { marginBottom: Spacing.md },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 14, color: Colors.text },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#00BCD4', paddingHorizontal: 16, paddingVertical: 12, borderRadius: BorderRadius.md, alignSelf: 'flex-start' },
  exportBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: Spacing.md },

  tableHeader: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tableHeaderText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },

  sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sessionText: { fontSize: 12, color: Colors.text },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F4433620', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F44336' },
  statusText: { fontSize: 10, color: '#F44336', fontWeight: '500' },
});
