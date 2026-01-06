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
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { isUserAdmin } from '../../src/components/AdminBadge';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';

type Session = {
  id: string;
  dj_id: string;
  dj_name: string;
  location: string;
  venue: string;
  started_at: string;
  status: 'active' | 'ended' | 'validated';
  tracks_detected: number;
  diamonds_earned: number;
};

type DateFilter = {
  startDate: string;
  endDate: string;
};

export default function AdminSessions() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  
  // Date filter state
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
    validated: 0,
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
      // Fetch real sessions data from SessionMix entity
      const response = await axios.get(`${BACKEND_URL}/api/admin/sessions?limit=10000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data?.success && response.data?.sessions) {
        const sessionsData = response.data.sessions.map((s: any) => ({
          id: s.id || s._id || Math.random().toString(),
          dj_id: s.dj_id || s.user_id || '',
          dj_name: s.dj_name || s.user_name || 'Unknown DJ',
          location: s.city || s.location || 'Unknown location',
          venue: s.venue || '-',
          started_at: s.started_at || s.created_at || new Date().toISOString(),
          ended_at: s.ended_at || '',
          status: s.status || 'ended',
          tracks_detected: s.tracks_detected || s.track_count || 0,
          diamonds_earned: s.diamonds_earned || 0,
        }));
        
        setSessions(sessionsData);
        
        // Use stats from backend if available
        if (response.data.stats) {
          setStats({
            total: response.data.stats.total_sessions || sessionsData.length,
            validated: response.data.stats.total_sessions || sessionsData.length,
            tracks_detected: response.data.stats.tracks_detected || 0,
            unique_djs: response.data.stats.unique_djs || 0,
          });
        } else {
          // Calculate stats locally
          const uniqueDjs = new Set(sessionsData.map((s: Session) => s.dj_name));
          setStats({
            total: sessionsData.length,
            validated: sessionsData.filter((s: Session) => s.status === 'ended' || s.status === 'validated').length,
            tracks_detected: sessionsData.reduce((sum: number, s: Session) => sum + s.tracks_detected, 0),
            unique_djs: uniqueDjs.size,
          });
        }
      }
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

  // Filter sessions by date
  const getFilteredSessions = () => {
    let filtered = sessions;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.dj_name.toLowerCase().includes(query) ||
        s.location.toLowerCase().includes(query)
      );
    }
    
    // Apply date filter
    if (dateFilter.startDate) {
      const startDate = new Date(dateFilter.startDate);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(s => new Date(s.started_at) >= startDate);
    }
    
    if (dateFilter.endDate) {
      const endDate = new Date(dateFilter.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(s => new Date(s.started_at) <= endDate);
    }
    
    return filtered;
  };

  const filteredSessions = getFilteredSessions();

  // Export PDF of all validated sessions
  const exportPDF = async () => {
    setExporting(true);
    try {
      console.log('[AdminSessions] Exporting PDF...');
      
      const requestBody: any = {
        all_users: true, // Flag to export all users
      };
      
      // Add date filters if set
      if (dateFilter.startDate) {
        requestBody.start_date = dateFilter.startDate;
      }
      if (dateFilter.endDate) {
        requestBody.end_date = dateFilter.endDate;
      }
      
      const response = await axios.post(
        `${BACKEND_URL}/api/admin/sessions/pdf`,
        requestBody,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          responseType: 'blob',
          timeout: 120000, // 2 minutes timeout
        }
      );
      
      // Get the blob data
      const blob = response.data;
      
      // Convert blob to base64 for mobile
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64data = reader.result as string;
          const base64 = base64data.split(',')[1];
          
          // Generate filename with date range
          let filename = 'spynners_all_sessions';
          if (dateFilter.startDate) {
            filename += `_from_${dateFilter.startDate}`;
          }
          if (dateFilter.endDate) {
            filename += `_to_${dateFilter.endDate}`;
          }
          filename += '.pdf';
          
          const fileUri = `${FileSystem.documentDirectory}${filename}`;
          
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          // Share the file
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Télécharger le rapport PDF',
            });
          } else {
            Alert.alert('Succès', `PDF sauvegardé: ${filename}`);
          }
        } catch (err) {
          console.error('[AdminSessions] Error saving PDF:', err);
          Alert.alert('Erreur', 'Impossible de sauvegarder le PDF');
        }
      };
      reader.readAsDataURL(blob);
      
    } catch (error: any) {
      console.error('[AdminSessions] Export error:', error);
      Alert.alert('Erreur', error?.response?.data?.detail || 'Impossible d\'exporter le rapport');
    } finally {
      setExporting(false);
    }
  };

  // Apply date filter
  const applyDateFilter = () => {
    setDateFilter(tempDateFilter);
    setShowDateFilter(false);
  };

  // Clear date filter
  const clearDateFilter = () => {
    setTempDateFilter({ startDate: '', endDate: '' });
    setDateFilter({ startDate: '', endDate: '' });
    setShowDateFilter(false);
  };

  // Format date for display
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
          <Text style={styles.headerTitle}>SPYN SESSION</Text>
          <Text style={styles.headerSubtitle}>Toutes les sessions validées</Text>
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
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.validated}</Text>
            <Text style={styles.statLabel}>Validées</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#FF9800' }]}>
            <Ionicons name="musical-note" size={24} color="#FF9800" />
            <Text style={styles.statNumber}>{stats.tracks_detected}</Text>
            <Text style={styles.statLabel}>Tracks détectées</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#9C27B0' }]}>
            <Ionicons name="headset" size={24} color="#9C27B0" />
            <Text style={styles.statNumber}>{stats.unique_djs}</Text>
            <Text style={styles.statLabel}>DJs uniques</Text>
          </View>
        </View>

        {/* Date Filter Section */}
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Filtre par date</Text>
          <View style={styles.filterRow}>
            <TouchableOpacity 
              style={styles.dateFilterBtn}
              onPress={() => setShowDateFilter(true)}
            >
              <Ionicons name="calendar" size={18} color="#2196F3" />
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

        {/* Search & Export */}
        <View style={styles.actionRow}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher par DJ ou ville..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          
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
                  Télécharger PDF ({filteredSessions.length} sessions)
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Session History */}
        <Text style={styles.sectionTitle}>
          Historique des sessions ({filteredSessions.length})
        </Text>
        
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>DJ</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Lieu</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Date</Text>
          <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>Statut</Text>
          <Text style={[styles.tableHeaderText, { flex: 0.6 }]}>Tracks</Text>
        </View>

        {filteredSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="radio-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyStateText}>Aucune session trouvée</Text>
          </View>
        ) : (
          filteredSessions.map((session) => (
            <View key={session.id} style={styles.sessionRow}>
              <Text style={[styles.sessionText, { flex: 1.5, fontWeight: '500' }]} numberOfLines={1}>
                {session.dj_name}
              </Text>
              <View style={{ flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="location" size={12} color="#00BCD4" />
                <Text style={styles.sessionText} numberOfLines={1}>{session.location}</Text>
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="calendar" size={12} color={Colors.textMuted} />
                <Text style={styles.sessionText}>
                  {new Date(session.started_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </Text>
              </View>
              <View style={{ flex: 0.8 }}>
                <View style={[
                  styles.statusBadge, 
                  session.status === 'validated' && styles.statusBadgeValidated
                ]}>
                  <View style={[
                    styles.statusDot,
                    session.status === 'validated' && styles.statusDotValidated
                  ]} />
                  <Text style={[
                    styles.statusText,
                    session.status === 'validated' && styles.statusTextValidated
                  ]}>
                    {session.status === 'validated' ? 'Validé' : session.status === 'active' ? 'Active' : 'Terminé'}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 0.6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="musical-note" size={12} color="#FF9800" />
                <Text style={styles.sessionText}>{session.tracks_detected}</Text>
              </View>
            </View>
          ))
        )}

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
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                value={tempDateFilter.startDate}
                onChangeText={(text) => setTempDateFilter(prev => ({ ...prev, startDate: text }))}
              />
            </View>

            <View style={styles.dateInputContainer}>
              <Text style={styles.dateInputLabel}>Date de fin</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
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
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2196F320', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  headerContent: { marginLeft: 12, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textMuted },

  content: { flex: 1, padding: Spacing.md },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: { width: '48%', backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1 },
  statNumber: { fontSize: 28, fontWeight: 'bold', color: Colors.text, marginTop: 8 },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },

  filterSection: { marginBottom: Spacing.md, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md },
  filterTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dateFilterBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2196F320', paddingHorizontal: 16, paddingVertical: 12, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: '#2196F350' },
  dateFilterBtnText: { fontSize: 13, color: '#2196F3', fontWeight: '500' },
  clearFilterBtn: { padding: 8 },

  actionRow: { marginBottom: Spacing.md },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 14, color: Colors.text },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#E91E63', paddingHorizontal: 16, paddingVertical: 14, borderRadius: BorderRadius.md },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: Spacing.md },

  tableHeader: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tableHeaderText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },

  sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sessionText: { fontSize: 12, color: Colors.text },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F4433620', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start' },
  statusBadgeValidated: { backgroundColor: '#4CAF5020' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F44336' },
  statusDotValidated: { backgroundColor: '#4CAF50' },
  statusText: { fontSize: 10, color: '#F44336', fontWeight: '500' },
  statusTextValidated: { color: '#4CAF50' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyStateText: { marginTop: 12, fontSize: 14, color: Colors.textMuted },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: Spacing.lg, width: '100%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },

  dateInputContainer: { marginBottom: Spacing.md },
  dateInputLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  dateInput: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: 14, fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border },

  presetsContainer: { marginTop: Spacing.sm, marginBottom: Spacing.lg },
  presetsTitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  presetsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  presetBtn: { flex: 1, backgroundColor: '#2196F320', paddingVertical: 10, paddingHorizontal: 12, borderRadius: BorderRadius.sm, alignItems: 'center' },
  presetBtnText: { fontSize: 12, color: '#2196F3', fontWeight: '500' },

  modalActions: { flexDirection: 'row', gap: Spacing.sm },
  clearBtn: { flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  clearBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  applyBtn: { flex: 1, backgroundColor: '#2196F3', paddingVertical: 14, borderRadius: BorderRadius.md, alignItems: 'center' },
  applyBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
