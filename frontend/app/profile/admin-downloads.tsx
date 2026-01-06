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
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { isUserAdmin } from '../../src/components/AdminBadge';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';

type Download = {
  id: string;
  date: string;
  dj_name: string;
  track_title: string;
  producer: string;
  genre: string;
};

export default function AdminDownloads() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    unique_djs: 0,
    tracks_downloaded: 0,
  });

  const isAdmin = isUserAdmin(user);

  useEffect(() => {
    if (isAdmin) {
      loadDownloads();
    }
  }, [isAdmin]);

  const loadDownloads = async () => {
    try {
      // Fetch real downloads data from backend
      const response = await axios.get(`${BACKEND_URL}/api/admin/downloads?limit=500`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data?.success) {
        const downloadsData = response.data.downloads || [];
        
        // Format download entries
        const formattedDownloads = downloadsData.map((d: any) => ({
          id: d.track_id || Math.random().toString(),
          date: new Date().toISOString().split('T')[0],
          dj_name: '-',
          track_title: d.track_title || 'Unknown Track',
          producer: d.producer || 'Unknown Producer',
          genre: d.genre || 'Unknown',
          download_count: d.download_count || 0,
        }));
        
        setDownloads(formattedDownloads);
        setStats({
          total: response.data.total_downloads || 0,
          unique_djs: 0, // Would need separate API call
          tracks_downloaded: response.data.tracks_with_downloads || 0,
        });
      }
    } catch (error) {
      console.error('[AdminDownloads] Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDownloads();
  };

  const selectDate = () => {
    Alert.alert('Sélectionner une date', 'Fonctionnalité de sélection de date');
  };

  const filteredDownloads = downloads.filter(d => 
    d.dj_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.track_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.producer.toLowerCase().includes(searchQuery.toLowerCase())
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
        <ActivityIndicator size="large" color="#00BFA5" />
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
          <Ionicons name="download" size={24} color="#00BFA5" />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Downloads</Text>
          <Text style={styles.headerSubtitle}>Historique des téléchargements</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00BFA5" />}
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="download" size={24} color="#00BFA5" />
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total downloads</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color="#2196F3" />
            <Text style={styles.statNumber}>{stats.unique_djs}</Text>
            <Text style={styles.statLabel}>Unique DJs</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="musical-note" size={24} color="#FF9800" />
            <Text style={styles.statNumber}>{stats.tracks_downloaded}</Text>
            <Text style={styles.statLabel}>Tracks downloaded</Text>
          </View>
        </View>

        {/* Search & Date Filter */}
        <View style={styles.filterRow}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by DJ, track or producer..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity style={styles.dateBtn} onPress={selectDate}>
            <Ionicons name="calendar" size={16} color="#fff" />
            <Text style={styles.dateBtnText}>Select a date</Text>
          </TouchableOpacity>
        </View>

        {/* Download History */}
        <Text style={styles.sectionTitle}>Download history ({stats.total})</Text>
        
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>Date</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>DJ</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Track</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Producer</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Genre</Text>
        </View>

        {filteredDownloads.map((download) => (
          <View key={download.id} style={styles.downloadRow}>
            <View style={{ flex: 0.8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.downloadText}>{download.date}</Text>
            </View>
            <Text style={[styles.downloadText, { flex: 1.2 }]}>{download.dj_name}</Text>
            <Text style={[styles.downloadText, { flex: 1.5 }]} numberOfLines={1}>{download.track_title}</Text>
            <Text style={[styles.downloadText, { flex: 1.2 }]} numberOfLines={1}>{download.producer}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.genreTag}>
                <Text style={styles.genreTagText} numberOfLines={1}>{download.genre}</Text>
              </View>
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
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00BFA520', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  headerContent: { marginLeft: 12, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textMuted },

  content: { flex: 1, padding: Spacing.md },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginTop: 8 },
  statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 4, textAlign: 'center' },

  filterRow: { marginBottom: Spacing.md },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 14, color: Colors.text },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00BFA5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.md, alignSelf: 'flex-start' },
  dateBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: Spacing.md },

  tableHeader: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tableHeaderText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },

  downloadRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  downloadText: { fontSize: 12, color: Colors.text },

  genreTag: { backgroundColor: '#00BFA520', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start' },
  genreTagText: { fontSize: 10, color: '#00BFA5', fontWeight: '500' },
});
