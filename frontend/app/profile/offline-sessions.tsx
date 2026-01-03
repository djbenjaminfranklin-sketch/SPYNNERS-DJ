import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import offlineService from '../../src/services/offlineService';

// Colors
const DARK_BG = '#0a0a1a';
const CARD_BG = '#1a1a2e';
const CYAN_COLOR = '#5CB3CC';
const GREEN_COLOR = '#4CAF50';
const ORANGE_COLOR = '#FFB74D';
const RED_COLOR = '#FF5252';

interface OfflineSession {
  id: string;
  recordings: any[];
  startTime: string;
  endTime?: string;
  location?: any;
  userId: string;
  djName: string;
  status: 'recording' | 'pending_sync' | 'syncing' | 'synced' | 'error';
  syncedAt?: string;
}

export default function OfflineSessionsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { t } = useLanguage();
  
  const [sessions, setSessions] = useState<OfflineSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingSessionId, setSyncingSessionId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const loadSessions = useCallback(async () => {
    try {
      const allSessions = await offlineService.getOfflineSessions();
      // Sort by date (newest first)
      allSessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      setSessions(allSessions);
      
      // Check network status
      const online = await offlineService.checkNetworkStatus();
      setIsOnline(online);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSessions();
  }, [loadSessions]);

  const syncSession = async (session: OfflineSession) => {
    if (!isOnline) {
      Alert.alert('Hors ligne', 'Vous devez être connecté à Internet pour synchroniser.');
      return;
    }

    setSyncingSessionId(session.id);

    try {
      const { synced, failed, results } = await offlineService.syncPendingSessions(token || undefined);
      
      // Reload sessions
      await loadSessions();

      // Show results
      const identifiedTracks = results.filter(r => r.success && r.is_spynners_track);
      
      if (identifiedTracks.length > 0) {
        Alert.alert(
          '🎵 Synchronisation réussie !',
          `${identifiedTracks.length} track(s) Spynners identifié(s) :\n\n${identifiedTracks.map(t => `• ${t.title}`).join('\n')}`,
          [{ text: 'OK' }]
        );
      } else if (synced > 0) {
        Alert.alert(
          '✅ Synchronisation terminée',
          `${synced} enregistrement(s) traité(s).\nAucun track Spynners identifié.`,
          [{ text: 'OK' }]
        );
      } else if (failed > 0) {
        Alert.alert(
          '❌ Erreur',
          `${failed} enregistrement(s) n'ont pas pu être synchronisés.`,
          [{ text: 'Réessayer', onPress: () => syncSession(session) }, { text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Erreur', 'La synchronisation a échoué. Réessayez.');
    } finally {
      setSyncingSessionId(null);
    }
  };

  const deleteSession = async (session: OfflineSession) => {
    // Direct delete without confirmation for now to debug
    console.log('[OfflineSessions] Deleting session:', session.id);
    
    try {
      const success = await offlineService.deleteSession(session.id);
      console.log('[OfflineSessions] Delete result:', success);
      
      if (success) {
        // Reload sessions immediately
        const allSessions = await offlineService.getOfflineSessions();
        allSessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        setSessions(allSessions);
        Alert.alert('✅ Supprimé', 'La session a été supprimée.');
      } else {
        Alert.alert('Erreur', 'Session non trouvée.');
      }
    } catch (error) {
      console.error('[OfflineSessions] Delete error:', error);
      Alert.alert('Erreur', 'Impossible de supprimer la session.');
    }
  };

  const syncAllSessions = async () => {
    if (!isOnline) {
      Alert.alert('Hors ligne', 'Vous devez être connecté à Internet pour synchroniser.');
      return;
    }

    const pendingSessions = sessions.filter(s => s.status === 'pending_sync');
    if (pendingSessions.length === 0) {
      Alert.alert('Info', 'Aucune session à synchroniser.');
      return;
    }

    setSyncingSessionId('all');

    try {
      const { synced, failed, results } = await offlineService.syncPendingSessions(token || undefined);
      
      await loadSessions();

      const identifiedTracks = results.filter(r => r.success && r.is_spynners_track);
      
      Alert.alert(
        '🔄 Synchronisation terminée',
        `${synced} enregistrement(s) traité(s)\n${identifiedTracks.length} track(s) Spynners identifié(s)${failed > 0 ? `\n${failed} échec(s)` : ''}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Sync all error:', error);
      Alert.alert('Erreur', 'La synchronisation a échoué.');
    } finally {
      setSyncingSessionId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'recording':
        return { name: 'radio-button-on', color: RED_COLOR };
      case 'pending_sync':
        return { name: 'cloud-upload-outline', color: ORANGE_COLOR };
      case 'syncing':
        return { name: 'sync', color: CYAN_COLOR };
      case 'synced':
        return { name: 'checkmark-circle', color: GREEN_COLOR };
      case 'error':
        return { name: 'alert-circle', color: RED_COLOR };
      default:
        return { name: 'help-circle', color: '#888' };
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'recording':
        return 'En cours...';
      case 'pending_sync':
        return 'En attente';
      case 'syncing':
        return 'Synchronisation...';
      case 'synced':
        return 'Synchronisé';
      case 'error':
        return 'Erreur';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getIdentifiedCount = (session: OfflineSession) => {
    return session.recordings.filter(r => r.result?.success && r.result?.is_spynners_track).length;
  };

  const pendingCount = sessions.filter(s => s.status === 'pending_sync').length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={CYAN_COLOR} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sessions Offline</Text>
        <View style={styles.headerRight}>
          {!isOnline && (
            <View style={styles.offlineBadge}>
              <Ionicons name="cloud-offline" size={16} color={ORANGE_COLOR} />
            </View>
          )}
        </View>
      </View>

      {/* Network Status Banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={18} color={ORANGE_COLOR} />
          <Text style={styles.offlineBannerText}>
            Mode hors ligne - Synchronisation impossible
          </Text>
        </View>
      )}

      {/* Sync All Button */}
      {pendingCount > 0 && isOnline && (
        <TouchableOpacity 
          style={styles.syncAllButton}
          onPress={syncAllSessions}
          disabled={syncingSessionId !== null}
        >
          {syncingSessionId === 'all' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="sync" size={20} color="#fff" />
              <Text style={styles.syncAllButtonText}>
                Synchroniser tout ({pendingCount})
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={CYAN_COLOR}
          />
        }
      >
        {sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-offline-outline" size={80} color="#333" />
            <Text style={styles.emptyTitle}>Aucune session offline</Text>
            <Text style={styles.emptySubtitle}>
              Vos sessions SPYN enregistrées hors ligne apparaîtront ici
            </Text>
          </View>
        ) : (
          sessions.map((session) => {
            const statusIcon = getStatusIcon(session.status);
            const isSyncing = syncingSessionId === session.id;
            const identifiedCount = getIdentifiedCount(session);

            return (
              <View key={session.id} style={styles.sessionCard}>
                {/* Header */}
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionInfo}>
                    <View style={styles.sessionTitleRow}>
                      <Ionicons 
                        name={statusIcon.name as any} 
                        size={20} 
                        color={statusIcon.color} 
                      />
                      <Text style={styles.sessionTitle}>
                        Session du {formatDate(session.startTime)}
                      </Text>
                    </View>
                    <Text style={[styles.sessionStatus, { color: statusIcon.color }]}>
                      {getStatusText(session.status)}
                    </Text>
                  </View>
                </View>

                {/* Stats */}
                <View style={styles.sessionStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="mic" size={16} color="#888" />
                    <Text style={styles.statText}>
                      {session.recordings.length} enregistrement(s)
                    </Text>
                  </View>
                  
                  {session.location?.venue && (
                    <View style={styles.statItem}>
                      <Ionicons name="location" size={16} color="#888" />
                      <Text style={styles.statText} numberOfLines={1}>
                        {session.location.venue}
                      </Text>
                    </View>
                  )}

                  {session.status === 'synced' && (
                    <View style={styles.statItem}>
                      <Ionicons name="musical-notes" size={16} color={GREEN_COLOR} />
                      <Text style={[styles.statText, { color: GREEN_COLOR }]}>
                        {identifiedCount} track(s) identifié(s)
                      </Text>
                    </View>
                  )}
                </View>

                {/* Identified Tracks */}
                {session.status === 'synced' && identifiedCount > 0 && (
                  <View style={styles.tracksContainer}>
                    <Text style={styles.tracksTitle}>Tracks identifiés :</Text>
                    {session.recordings
                      .filter(r => r.result?.success && r.result?.is_spynners_track)
                      .map((rec, idx) => (
                        <View key={idx} style={styles.trackItem}>
                          <Ionicons name="checkmark-circle" size={16} color={GREEN_COLOR} />
                          <Text style={styles.trackName} numberOfLines={1}>
                            {rec.result.title} - {rec.result.artist}
                          </Text>
                        </View>
                      ))}
                  </View>
                )}

                {/* Actions */}
                <View style={styles.sessionActions}>
                  {session.status === 'pending_sync' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.syncButton]}
                      onPress={() => syncSession(session)}
                      disabled={isSyncing || !isOnline}
                    >
                      {isSyncing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload" size={18} color="#fff" />
                          <Text style={styles.actionButtonText}>Synchroniser</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => deleteSession(session)}
                  >
                    <Ionicons name="trash-outline" size={18} color={RED_COLOR} />
                    <Text style={[styles.actionButtonText, { color: RED_COLOR }]}>
                      Supprimer
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  offlineBadge: {
    padding: 4,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORANGE_COLOR + '20',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  offlineBannerText: {
    color: ORANGE_COLOR,
    fontSize: 13,
    fontWeight: '500',
  },
  syncAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CYAN_COLOR,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  syncAllButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  sessionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  sessionStatus: {
    fontSize: 13,
    marginTop: 4,
    marginLeft: 28,
  },
  sessionStats: {
    marginTop: 12,
    gap: 6,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statText: {
    color: '#888',
    fontSize: 13,
    flex: 1,
  },
  tracksContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  tracksTitle: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  trackName: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
  },
  sessionActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
    flex: 1,
  },
  syncButton: {
    backgroundColor: CYAN_COLOR,
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: RED_COLOR + '50',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
