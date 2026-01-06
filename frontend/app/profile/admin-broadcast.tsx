import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { isUserAdmin } from '../../src/components/AdminBadge';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';

type BroadcastHistory = {
  id: string;
  subject: string;
  recipient_type: string;
  recipient_count: number;
  sent_at: string;
  sent_by?: string;
};

export default function AdminBroadcast() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [recentTracks, setRecentTracks] = useState<any[]>([]);
  const [broadcastHistory, setBroadcastHistory] = useState<BroadcastHistory[]>([]);
  const [recipientType, setRecipientType] = useState<'all' | 'category' | 'individual'>('all');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [individualEmail, setIndividualEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');

  const isAdmin = isUserAdmin(user);

  const CATEGORIES = [
    { id: 'dj_star', name: 'DJ Star' },
    { id: 'dj_resident', name: 'DJ Resident' },
    { id: 'producer', name: 'Producer' },
    { id: 'dj', name: 'DJ' },
    { id: 'music_lover', name: 'Music Lover' },
  ];

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    try {
      // Fetch stats - use higher limit to get accurate user count
      const [usersRes, tracksRes, historyRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/users?limit=10000`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { total: 0 } })),
        axios.get(`${BACKEND_URL}/api/admin/tracks?limit=10`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { tracks: [] } })),
        axios.get(`${BACKEND_URL}/api/admin/broadcast/history?limit=20`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { broadcasts: [] } })),
      ]);
      
      // Get user count from total field or array length
      const userTotal = usersRes.data?.total || usersRes.data?.users?.length || 0;
      setUserCount(userTotal);
      setRecentTracks(tracksRes.data?.tracks || []);
      setBroadcastHistory(historyRes.data?.broadcasts || []);
      
      console.log('[AdminBroadcast] Loaded - Users:', userTotal, 'Tracks:', tracksRes.data?.tracks?.length || 0);
    } catch (error) {
      console.error('[AdminBroadcast] Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const insertRecentTracks = () => {
    if (recentTracks.length === 0) {
      Alert.alert('Info', 'Aucune track récente disponible');
      return;
    }
    
    const trackList = recentTracks.slice(0, 5).map((t, i) => 
      `${i + 1}. ${t.title} - ${t.producer_name || t.artist_name || 'Unknown'}`
    ).join('\n');
    
    setMessage(prev => prev + `\n\n🎵 TRACKS RÉCENTES:\n${trackList}`);
  };

  const sendEmail = async () => {
    if (!subject.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un sujet');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un message');
      return;
    }
    if (recipientType === 'category' && !selectedCategory) {
      Alert.alert('Erreur', 'Veuillez sélectionner une catégorie');
      return;
    }
    if (recipientType === 'individual' && !individualEmail.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email');
      return;
    }

    Alert.alert(
      'Confirmer l\'envoi',
      `Envoyer cet email à ${recipientType === 'all' ? 'tous les utilisateurs' : recipientType === 'category' ? `la catégorie "${selectedCategory}"` : individualEmail} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Envoyer', 
          onPress: async () => {
            setSending(true);
            try {
              const response = await axios.post(
                `${BACKEND_URL}/api/admin/broadcast`,
                {
                  subject: subject.trim(),
                  message: message.trim(),
                  recipient_type: recipientType,
                  category: recipientType === 'category' ? selectedCategory : null,
                  individual_email: recipientType === 'individual' ? individualEmail.trim() : null,
                  include_tracks: message.includes('TRACKS RÉCENTES'),
                },
                { headers: { Authorization: `Bearer ${token}` } }
              );

              if (response.data?.success) {
                Alert.alert('Succès ✅', `Email envoyé à ${response.data.sent_count || 'tous les'} destinataires!`);
                setSubject('');
                setMessage('');
                setIndividualEmail('');
                loadData(); // Refresh history
              } else {
                Alert.alert('Erreur', response.data?.message || 'Échec de l\'envoi');
              }
            } catch (error: any) {
              console.error('[AdminBroadcast] Send error:', error);
              Alert.alert('Erreur', error?.response?.data?.detail || 'Échec de l\'envoi de l\'email');
            } finally {
              setSending(false);
            }
          }
        },
      ]
    );
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
        <ActivityIndicator size="large" color="#4CAF50" />
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
          <Ionicons name="mail" size={24} color="#4CAF50" />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Email Groupé</Text>
          <Text style={styles.headerSubtitle}>Envoyer un message aux utilisateurs</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'compose' && styles.tabActive]}
          onPress={() => setActiveTab('compose')}
        >
          <Ionicons name="create-outline" size={18} color={activeTab === 'compose' ? '#4CAF50' : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'compose' && styles.tabTextActive]}>Composer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons name="time-outline" size={18} color={activeTab === 'history' ? '#4CAF50' : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>Historique ({broadcastHistory.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />}
      >
        {activeTab === 'compose' ? (
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Ionicons name="people" size={24} color="#2196F3" />
                <Text style={styles.statNumber}>{userCount}</Text>
                <Text style={styles.statLabel}>Utilisateurs</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="musical-note" size={24} color="#FF9800" />
                <Text style={styles.statNumber}>{recentTracks.length}</Text>
                <Text style={styles.statLabel}>Tracks récentes</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="mail" size={24} color="#4CAF50" />
                <Text style={styles.statNumber}>{broadcastHistory.length}</Text>
                <Text style={styles.statLabel}>Emails envoyés</Text>
              </View>
            </View>

            {/* Recipient Type */}
            <Text style={styles.sectionTitle}>Destinataires</Text>
            <View style={styles.recipientRow}>
              {[
                { id: 'all', label: 'Tous', icon: 'people' },
                { id: 'category', label: 'Catégorie', icon: 'star' },
                { id: 'individual', label: 'Individuel', icon: 'person' },
              ].map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.recipientBtn, recipientType === type.id && styles.recipientBtnActive]}
                  onPress={() => setRecipientType(type.id as any)}
                >
                  <Ionicons name={type.icon as any} size={18} color={recipientType === type.id ? '#fff' : Colors.textMuted} />
                  <Text style={[styles.recipientBtnText, recipientType === type.id && styles.recipientBtnTextActive]}>{type.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Category Selector */}
            {recipientType === 'category' && (
              <View style={styles.categorySection}>
                <Text style={styles.inputLabel}>Sélectionner une catégorie</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.categoryRow}>
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
                        onPress={() => setSelectedCategory(cat.id)}
                      >
                        <Text style={[styles.categoryChipText, selectedCategory === cat.id && styles.categoryChipTextActive]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Individual Email */}
            {recipientType === 'individual' && (
              <View style={styles.individualSection}>
                <Text style={styles.inputLabel}>Adresse email</Text>
                <TextInput
                  style={styles.emailInput}
                  placeholder="example@email.com"
                  placeholderTextColor={Colors.textMuted}
                  value={individualEmail}
                  onChangeText={setIndividualEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            )}

            {/* Compose Message */}
            <View style={styles.composeSection}>
              <View style={styles.composeTitleRow}>
                <Ionicons name="mail-outline" size={20} color={Colors.primary} />
                <Text style={styles.composeTitle}>Composer le message</Text>
              </View>

              <Text style={styles.inputLabel}>Sujet *</Text>
              <TextInput
                style={styles.subjectInput}
                placeholder="Ex: Nouvelles tracks house disponibles !"
                placeholderTextColor={Colors.textMuted}
                value={subject}
                onChangeText={setSubject}
              />

              <Text style={styles.inputLabel}>Message *</Text>
              <TextInput
                style={styles.messageInput}
                placeholder="Votre message ici..."
                placeholderTextColor={Colors.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity style={styles.insertTracksBtn} onPress={insertRecentTracks}>
                <Ionicons name="musical-note" size={16} color="#FF9800" />
                <Text style={styles.insertTracksText}>Insérer les tracks récentes</Text>
              </TouchableOpacity>
            </View>

            {/* Send Button */}
            <TouchableOpacity
              style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
              onPress={sendEmail}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.sendBtnText}>Envoyer l'email</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          /* History Tab */
          <View style={styles.historySection}>
            {broadcastHistory.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="mail-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>Aucun email envoyé</Text>
                <Text style={styles.emptyText}>L'historique des emails apparaîtra ici</Text>
              </View>
            ) : (
              broadcastHistory.map((item, index) => (
                <View key={item.id || index} style={styles.historyCard}>
                  <View style={styles.historyIcon}>
                    <Ionicons name="mail" size={20} color="#4CAF50" />
                  </View>
                  <View style={styles.historyContent}>
                    <Text style={styles.historySubject} numberOfLines={1}>{item.subject}</Text>
                    <Text style={styles.historyMeta}>
                      {item.recipient_type === 'all' ? 'Tous les utilisateurs' : item.recipient_type} • {item.recipient_count || 0} destinataires
                    </Text>
                    <Text style={styles.historyDate}>
                      {item.sent_at ? new Date(item.sent_at).toLocaleDateString('fr-FR', { 
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                      }) : 'Date inconnue'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

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
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4CAF5020', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  headerContent: { marginLeft: 12, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textMuted },

  tabsRow: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  tabActive: { borderColor: '#4CAF50', backgroundColor: '#4CAF5015' },
  tabText: { fontSize: 13, color: Colors.textMuted },
  tabTextActive: { color: '#4CAF50', fontWeight: '600' },

  content: { flex: 1, padding: Spacing.md },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginTop: 6 },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  sectionTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },

  recipientRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  recipientBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  recipientBtnActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  recipientBtnText: { fontSize: 12, color: Colors.textMuted },
  recipientBtnTextActive: { color: '#fff', fontWeight: '600' },

  categorySection: { marginBottom: Spacing.lg },
  categoryRow: { flexDirection: 'row', gap: Spacing.xs },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.backgroundCard, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  categoryChipActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  categoryChipText: { fontSize: 12, color: Colors.textMuted },
  categoryChipTextActive: { color: '#fff', fontWeight: '600' },

  individualSection: { marginBottom: Spacing.lg },
  emailInput: { backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border },

  composeSection: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  composeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  composeTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },

  inputLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 6 },
  subjectInput: { backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 14, color: Colors.text, marginBottom: Spacing.md },
  messageInput: { backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 14, color: Colors.text, height: 150, marginBottom: Spacing.md },

  insertTracksBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  insertTracksText: { fontSize: 13, color: '#FF9800' },

  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4CAF50', paddingVertical: 16, borderRadius: BorderRadius.md, marginTop: Spacing.lg },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  historySection: { marginTop: Spacing.sm },
  historyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  historyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4CAF5015', justifyContent: 'center', alignItems: 'center' },
  historyContent: { flex: 1, marginLeft: Spacing.md },
  historySubject: { fontSize: 14, fontWeight: '600', color: Colors.text },
  historyMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  historyDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  emptyState: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginTop: Spacing.md },
  emptyText: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
});
