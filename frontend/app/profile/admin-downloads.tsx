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
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { isUserAdmin } from '../../src/components/AdminBadge';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';
const BASE44_APP_ID = '691a4d96d819355b52c063f3';
const BASE44_API_URL = `https://spynners.base44.app/api/apps/${BASE44_APP_ID}`;

type Download = {
  id: string;
  date: string;
  dj_name: string;
  track_title: string;
  producer: string;
  genre: string;
  download_count?: number;
};

type DateFilter = {
  startDate: string;
  endDate: string;
};

export default function AdminDownloads() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    startDate: '',
    endDate: '',
  });
  const [tempDateFilter, setTempDateFilter] = useState<DateFilter>({
    startDate: '',
    endDate: '',
  });

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
      console.log('[AdminDownloads] Loading downloads...');
      
      // Fetch tracks directly from Base44 entities API
      let tracksData: any[] = [];
      
      try {
        const url = `${BASE44_API_URL}/entities/Track?limit=500`;
        console.log('[AdminDownloads] Fetching from:', url);
        
        const response = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        });
        
        console.log('[AdminDownloads] Response status:', response.status);
        
        if (Array.isArray(response.data)) {
          tracksData = response.data;
        } else if (response.data?.items) {
          tracksData = response.data.items;
        } else if (response.data?.data) {
          tracksData = response.data.data;
        }
        
        console.log('[AdminDownloads] Got', tracksData.length, 'tracks from Base44');
      } catch (base44Error: any) {
        console.error('[AdminDownloads] Base44 error:', base44Error?.message);
        
        // Fallback to backend proxy
        try {
          const response = await axios.get(`${BACKEND_URL}/api/admin/downloads?limit=500`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000,
          });
          
          if (response.data?.success && response.data?.downloads) {
            const downloadsData = response.data.downloads || [];
            const formattedDownloads = downloadsData.map((d: any) => ({
              id: d.track_id || Math.random().toString(),
              date: d.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
              dj_name: d.dj_name || '-',
              track_title: d.track_title || 'Titre inconnu',
              producer: d.producer || 'Producteur inconnu',
              genre: d.genre || 'Inconnu',
              download_count: d.download_count || 0,
            }));
            
            setDownloads(formattedDownloads);
            setStats({
              total: response.data.total_downloads || 0,
              unique_djs: response.data.unique_djs || 0,
              tracks_downloaded: response.data.tracks_with_downloads || 0,
            });
            setLoading(false);
            setRefreshing(false);
            return;
          }
        } catch (backendError) {
          console.error('[AdminDownloads] Backend also failed:', backendError);
        }
      }
      
      // Process tracks data from Base44
      if (tracksData.length > 0) {
        let totalDownloads = 0;
        const tracksWithDownloads: Download[] = [];
        
        for (const track of tracksData) {
          const downloadCount = track.download_count || 0;
          if (downloadCount > 0) {
            totalDownloads += downloadCount;
            tracksWithDownloads.push({
              id: track.id || track._id || Math.random().toString(),
              date: (track.created_date || track.created_at || track.uploaded_at || '')?.split('T')[0] || new Date().toISOString().split('T')[0],
              dj_name: track.uploaded_by_name || '-',
              track_title: track.title || 'Titre inconnu',
              producer: track.producer_name || track.artist_name || 'Producteur inconnu',
              genre: track.genre || 'Inconnu',
              download_count: downloadCount,
            });
          }
        }
        
        console.log('[AdminDownloads] Processed:', tracksWithDownloads.length, 'tracks with downloads, total:', totalDownloads);
        
        setDownloads(tracksWithDownloads);
        setStats({
          total: totalDownloads,
          unique_djs: 0,
          tracks_downloaded: tracksWithDownloads.length,
        });
      } else {
        console.log('[AdminDownloads] No tracks data found');
        setDownloads([]);
        setStats({ total: 0, unique_djs: 0, tracks_downloaded: 0 });
      }
    } catch (error) {
      console.error('[AdminDownloads] Erreur:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDownloads();
  };

  const getFilteredDownloads = () => {
    let filtered = downloads;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.dj_name.toLowerCase().includes(query) ||
        d.track_title.toLowerCase().includes(query) ||
        d.producer.toLowerCase().includes(query)
      );
    }
    
    if (dateFilter.startDate) {
      const startDate = new Date(dateFilter.startDate);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(d => new Date(d.date) >= startDate);
    }
    
    if (dateFilter.endDate) {
      const endDate = new Date(dateFilter.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(d => new Date(d.date) <= endDate);
    }
    
    return filtered;
  };

  const filteredDownloads = getFilteredDownloads();

  const exportPDF = async () => {
    setExporting(true);
    try {
      console.log('[AdminDownloads] Export PDF...');
      
      const requestBody: any = {};
      if (dateFilter.startDate) requestBody.start_date = dateFilter.startDate;
      if (dateFilter.endDate) requestBody.end_date = dateFilter.endDate;
      
      const response = await axios.post(
        `${BACKEND_URL}/api/admin/downloads/pdf`,
        requestBody,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
          timeout: 120000,
        }
      );
      
      console.log('[AdminDownloads] PDF reçu, taille:', response.data.byteLength);
      
      let filename = 'spynners_telechargements';
      if (dateFilter.startDate) filename += `_${dateFilter.startDate}`;
      if (dateFilter.endDate) filename += `_${dateFilter.endDate}`;
      filename += '.pdf';
      
      if (Platform.OS === 'web') {
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert('Succès ✅', 'PDF téléchargé !');
      } else {
        const uint8Array = new Uint8Array(response.data);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64 = btoa(binary);
        
        const fileUri = `${LegacyFileSystem.cacheDirectory}${filename}`;
        await LegacyFileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: LegacyFileSystem.EncodingType.Base64,
        });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Télécharger le rapport PDF',
          });
        } else {
          Alert.alert('Succès ✅', `PDF sauvegardé: ${filename}`);
        }
      }
      
    } catch (error: any) {
      console.error('[AdminDownloads] Erreur export:', error);
      Alert.alert('Erreur', error?.response?.data?.detail || error?.message || 'Impossible d\'exporter le rapport');
    } finally {
      setExporting(false);
    }
  };

  const applyDateFilter = () => {
    setDateFilter(tempDateFilter);
    setShowDateFilter(false);
  };

  const clearDateFilter = () => {
    setTempDateFilter({ startDate: '', endDate: '' });
    setDateFilter({ startDate: '', endDate: '' });
    setShowDateFilter(false);
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
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
          <Text style={styles.headerTitle}>Téléchargements</Text>
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
            <Text style={styles.statLabel}>Total téléchargements</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color="#2196F3" />
            <Text style={styles.statNumber}>{stats.unique_djs}</Text>
            <Text style={styles.statLabel}>DJs uniques</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="musical-note" size={24} color="#FF9800" />
            <Text style={styles.statNumber}>{stats.tracks_downloaded}</Text>
            <Text style={styles.statLabel}>Tracks téléchargées</Text>
          </View>
        </View>

        {/* Date Filter Section */}
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Filtre par date</Text>
          <View style={styles.filterRow}>
            <TouchableOpacity 
              style={styles.dateFilterBtn}
              onPress={() => {
                setTempDateFilter(dateFilter);
                setShowDateFilter(true);
              }}
            >
              <Ionicons name="calendar" size={18} color="#00BFA5" />
              <Text style={styles.dateFilterBtnText}>
                {dateFilter.startDate || dateFilter.endDate 
                  ? `${formatDateDisplay(dateFilter.startDate) || 'Début'} → ${formatDateDisplay(dateFilter.endDate) || 'Fin'}`
                  : 'Sélectionner les dates'
                }
              </Text>
            </TouchableOpacity>
            
            {(dateFilter.startDate || dateFilter.endDate) && (
              <TouchableOpacity style={styles.clearFilterBtn} onPress={clearDateFilter}>
                <Ionicons name="close-circle" size={20} color="#f44336" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par DJ, track ou producteur..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Export PDF Button */}
        <TouchableOpacity 
          style={[styles.exportBtn, exporting && styles.exportBtnDisabled]} 
          onPress={exportPDF}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="document-text" size={18} color="#fff" />
              <Text style={styles.exportBtnText}>
                Télécharger PDF ({filteredDownloads.length} tracks)
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Download History */}
        <Text style={styles.sectionTitle}>Historique ({filteredDownloads.length})</Text>
        
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>Date</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Track</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Producteur</Text>
          <Text style={[styles.tableHeaderText, { flex: 0.5 }]}>DL</Text>
        </View>

        {filteredDownloads.map((download) => (
          <View key={download.id} style={styles.downloadRow}>
            <Text style={[styles.downloadText, { flex: 0.8 }]}>{download.date}</Text>
            <Text style={[styles.downloadText, { flex: 1.5 }]} numberOfLines={1}>{download.track_title}</Text>
            <Text style={[styles.downloadText, { flex: 1.2 }]} numberOfLines={1}>{download.producer}</Text>
            <Text style={[styles.downloadText, { flex: 0.5, textAlign: 'center', fontWeight: 'bold', color: '#00BFA5' }]}>{download.download_count}</Text>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Date Filter Modal */}
      <Modal
        visible={showDateFilter}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateFilter(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrer par date</Text>
              <TouchableOpacity onPress={() => setShowDateFilter(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.dateInputContainer}>
              <Text style={styles.dateInputLabel}>Date de début</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor={Colors.textMuted}
                value={tempDateFilter.startDate}
                onChangeText={(text) => setTempDateFilter(prev => ({ ...prev, startDate: text }))}
              />
            </View>

            <View style={styles.dateInputContainer}>
              <Text style={styles.dateInputLabel}>Date de fin</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor={Colors.textMuted}
                value={tempDateFilter.endDate}
                onChangeText={(text) => setTempDateFilter(prev => ({ ...prev, endDate: text }))}
              />
            </View>

            {/* Quick presets */}
            <View style={styles.presetsContainer}>
              <Text style={styles.presetsTitle}>Raccourcis</Text>
              <View style={styles.presetsRow}>
                <TouchableOpacity 
                  style={styles.presetBtn}
                  onPress={() => {
                    const today = new Date();
                    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    setTempDateFilter({
                      startDate: weekAgo.toISOString().split('T')[0],
                      endDate: today.toISOString().split('T')[0],
                    });
                  }}
                >
                  <Text style={styles.presetBtnText}>7 derniers jours</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.presetBtn}
                  onPress={() => {
                    const today = new Date();
                    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                    setTempDateFilter({
                      startDate: monthAgo.toISOString().split('T')[0],
                      endDate: today.toISOString().split('T')[0],
                    });
                  }}
                >
                  <Text style={styles.presetBtnText}>30 derniers jours</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.presetsRow}>
                <TouchableOpacity 
                  style={styles.presetBtn}
                  onPress={() => {
                    const today = new Date();
                    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                    setTempDateFilter({
                      startDate: firstDay.toISOString().split('T')[0],
                      endDate: today.toISOString().split('T')[0],
                    });
                  }}
                >
                  <Text style={styles.presetBtnText}>Ce mois</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.presetBtn}
                  onPress={() => {
                    const today = new Date();
                    const threeMonthsAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                    setTempDateFilter({
                      startDate: threeMonthsAgo.toISOString().split('T')[0],
                      endDate: today.toISOString().split('T')[0],
                    });
                  }}
                >
                  <Text style={styles.presetBtnText}>3 derniers mois</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.clearBtn} onPress={clearDateFilter}>
                <Text style={styles.clearBtnText}>Effacer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={applyDateFilter}>
                <Text style={styles.applyBtnText}>Appliquer</Text>
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
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00BFA520', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  headerContent: { marginLeft: 12, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textMuted },

  content: { flex: 1, padding: Spacing.md },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginTop: 8 },
  statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 4, textAlign: 'center' },

  filterSection: { marginBottom: Spacing.md, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  filterTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dateFilterBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#00BFA520', paddingHorizontal: 16, paddingVertical: 12, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: '#00BFA550' },
  dateFilterBtnText: { fontSize: 13, color: '#00BFA5', fontWeight: '500' },
  clearFilterBtn: { padding: 8 },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 14, color: Colors.text },
  
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#00BFA5', paddingHorizontal: 16, paddingVertical: 14, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: Spacing.md },

  tableHeader: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tableHeaderText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },

  downloadRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  downloadText: { fontSize: 12, color: Colors.text },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modalContent: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: Spacing.lg, width: '100%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: '600', color: Colors.text },
  dateInputContainer: { marginBottom: Spacing.md },
  dateInputLabel: { fontSize: 14, color: Colors.text, marginBottom: 8 },
  dateInput: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, paddingVertical: 14, paddingHorizontal: 16, fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  presetsContainer: { marginTop: Spacing.md, marginBottom: Spacing.lg },
  presetsTitle: { fontSize: 14, color: Colors.textMuted, marginBottom: Spacing.sm },
  presetsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  presetBtn: { flex: 1, backgroundColor: '#00BFA520', paddingVertical: 10, paddingHorizontal: 12, borderRadius: BorderRadius.sm, alignItems: 'center' },
  presetBtnText: { fontSize: 12, color: '#00BFA5', fontWeight: '500' },
  modalActions: { flexDirection: 'row', gap: Spacing.md },
  clearBtn: { flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md, backgroundColor: Colors.border, alignItems: 'center' },
  clearBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  applyBtn: { flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md, backgroundColor: '#00BFA5', alignItems: 'center' },
  applyBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
