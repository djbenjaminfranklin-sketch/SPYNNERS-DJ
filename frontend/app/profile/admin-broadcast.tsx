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
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { isUserAdmin } from '../../src/components/AdminBadge';
import { base44Users, base44Tracks, base44Admin } from '../../src/services/base44Api';

type UserItem = {
  id: string;
  email: string;
  full_name?: string;
  artist_name?: string;
  avatar_url?: string;
};

type BroadcastHistory = {
  id: string;
  subject: string;
  message?: string;
  recipient_type: string;
  recipient_count: number;
  sent_at: string;
  sent_by?: string;
  category?: string;
};

export default function AdminBroadcast() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [recentTracks, setRecentTracks] = useState<any[]>([]);
  const [broadcastHistory, setBroadcastHistory] = useState<BroadcastHistory[]>([]);
  const [recipientType, setRecipientType] = useState<'all' | 'category' | 'individual'>('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);  // Multiple categories
  const [individualEmail, setIndividualEmail] = useState('');
  const [emailSuggestions, setEmailSuggestions] = useState<UserItem[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<UserItem | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');
  
  // Email detail modal
  const [showEmailDetail, setShowEmailDetail] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<BroadcastHistory | null>(null);

  const isAdmin = isUserAdmin(user);

  const CATEGORIES = [
    { id: 'dj', name: 'DJ', color: '#2196F3' },
    { id: 'producer', name: 'Producer', color: '#4CAF50' },
    { id: 'both', name: 'DJ & Producer', color: '#00BCD4' },
    { id: 'music_lover', name: 'Music Lover', color: '#E91E63' },
    { id: 'label', name: 'Label', color: '#FF9800' },
  ];

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  // Update email suggestions when typing
  useEffect(() => {
    if (individualEmail.trim().length >= 2 && !selectedRecipient) {
      const query = individualEmail.toLowerCase();
      const suggestions = allUsers.filter(u => 
        u.email?.toLowerCase().includes(query) ||
        u.full_name?.toLowerCase().includes(query) ||
        u.artist_name?.toLowerCase().includes(query)
      ).slice(0, 8);
      setEmailSuggestions(suggestions);
    } else {
      setEmailSuggestions([]);
    }
  }, [individualEmail, allUsers, selectedRecipient]);

  const loadData = async () => {
    try {
      // Fetch users and tracks from Base44 directly
      const [users, tracks] = await Promise.all([
        base44Users.list({ limit: 1000 }).catch(() => []),
        base44Tracks.list({ limit: 10 }).catch(() => []),
      ]);
      
      // Get user count and store users for autocomplete
      setUserCount(users.length);
      setAllUsers(users.map((u: any) => ({
        id: u.id || u._id,
        email: u.email,
        full_name: u.full_name,
        artist_name: u.artist_name || u.data?.artist_name,
        avatar_url: u.avatar_url || u.data?.avatar_url || u.generated_avatar_url,
      })));
      setRecentTracks(tracks.slice(0, 10));
      // Broadcast history not available without backend - show empty
      setBroadcastHistory([]);
      
      console.log('[AdminBroadcast] Loaded - Users:', users.length, 'Tracks:', tracks.length);
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

  // Toggle category selection (cumulative)
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(c => c !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  // Select recipient from suggestions
  const selectRecipient = (u: UserItem) => {
    setSelectedRecipient(u);
    setIndividualEmail(u.email);
    setEmailSuggestions([]);
  };

  // Clear selected recipient
  const clearRecipient = () => {
    setSelectedRecipient(null);
    setIndividualEmail('');
  };

  // View email detail
  const viewEmailDetail = (email: BroadcastHistory) => {
    setSelectedEmail(email);
    setShowEmailDetail(true);
  };

  const insertRecentTracks = () => {
    if (recentTracks.length === 0) {
      Alert.alert(t('offline.info'), t('admin.noRecentTracks'));
      return;
    }
    
    const trackList = recentTracks.slice(0, 5).map((t, i) => 
      `${i + 1}. ${t.title} - ${t.producer_name || t.artist_name || 'Unknown'}`
    ).join('\n');
    
    setMessage(prev => prev + `\n\n🎵 ${t('broadcast.recentTracks')}:\n${trackList}`);
  };

  const sendEmail = async () => {
    if (!subject.trim()) {
      Alert.alert(t('common.error'), t('admin.enterSubject'));
      return;
    }
    if (!message.trim()) {
      Alert.alert(t('common.error'), t('broadcast.enterMessage'));
      return;
    }
    if (recipientType === 'category' && selectedCategories.length === 0) {
      Alert.alert(t('common.error'), t('admin.selectCategory'));
      return;
    }
    if (recipientType === 'individual' && !selectedRecipient) {
      Alert.alert(t('common.error'), t('admin.selectRecipient'));
      return;
    }

    // Without backend, show info message
    Alert.alert(
      t('common.info') || 'Information',
      t('broadcast.notAvailableOffline') || "L'envoi d'emails groupés nécessite un serveur. Utilisez Base44 Console ou un service email externe pour les broadcasts.",
      [{ text: 'OK' }]
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
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
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
          <Text style={styles.headerTitle}>{t('broadcast.groupEmail')}</Text>
          <Text style={styles.headerSubtitle}>{t('broadcast.sendToUsers')}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'compose' && styles.tabActive]}
          onPress={() => setActiveTab('compose')}
        >
          <Ionicons name="create-outline" size={18} color={activeTab === 'compose' ? '#4CAF50' : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'compose' && styles.tabTextActive]}>{t('broadcast.compose')}</Text>
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

            {/* Category Selector - Multiple selection */}
            {recipientType === 'category' && (
              <View style={styles.categorySection}>
                <Text style={styles.inputLabel}>Sélectionner une ou plusieurs catégories</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategories.includes(cat.id);
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryChip,
                          isSelected && { backgroundColor: cat.color + '30', borderColor: cat.color }
                        ]}
                        onPress={() => toggleCategory(cat.id)}
                      >
                        <Ionicons 
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'} 
                          size={16} 
                          color={isSelected ? cat.color : Colors.textMuted} 
                        />
                        <Text style={[styles.categoryChipText, isSelected && { color: cat.color, fontWeight: '600' }]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {selectedCategories.length > 0 && (
                  <Text style={styles.selectedCategoriesText}>
                    {selectedCategories.length} catégorie{selectedCategories.length > 1 ? 's' : ''} sélectionnée{selectedCategories.length > 1 ? 's' : ''}
                  </Text>
                )}
              </View>
            )}

            {/* Individual Email with Autocomplete */}
            {recipientType === 'individual' && (
              <View style={styles.individualSection}>
                <Text style={styles.inputLabel}>Rechercher un utilisateur</Text>
                <TextInput
                  style={styles.emailInput}
                  placeholder="Tapez un email ou un nom..."
                  placeholderTextColor={Colors.textMuted}
                  value={individualEmail}
                  onChangeText={(text) => {
                    setIndividualEmail(text);
                    setSelectedRecipient(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                
                {/* Autocomplete suggestions */}
                {emailSuggestions.length > 0 && !selectedRecipient && (
                  <View style={styles.suggestionsContainer}>
                    {emailSuggestions.map((u) => (
                      <TouchableOpacity key={u.id} style={styles.suggestionItem} onPress={() => selectRecipient(u)}>
                        {u.avatar_url ? (
                          <Image source={{ uri: u.avatar_url }} style={styles.suggestionAvatar} />
                        ) : (
                          <View style={[styles.suggestionAvatar, { backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ color: Colors.primary, fontWeight: 'bold', fontSize: 12 }}>
                              {u.full_name?.charAt(0).toUpperCase() || 'U'}
                            </Text>
                          </View>
                        )}
                        <View style={styles.suggestionInfo}>
                          <Text style={styles.suggestionName}>{u.artist_name || u.full_name}</Text>
                          <Text style={styles.suggestionEmail}>{u.email}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Selected recipient badge */}
                {selectedRecipient && (
                  <View style={styles.selectedRecipientBadge}>
                    <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                    <Text style={styles.selectedRecipientText}>
                      {selectedRecipient.artist_name || selectedRecipient.full_name} ({selectedRecipient.email})
                    </Text>
                    <TouchableOpacity onPress={clearRecipient}>
                      <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                )}
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
                <TouchableOpacity 
                  key={item.id || index} 
                  style={styles.historyCard}
                  onPress={() => viewEmailDetail(item)}
                >
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
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Email Detail Modal */}
      <Modal visible={showEmailDetail} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.emailDetailModal}>
            <View style={styles.emailDetailHeader}>
              <Ionicons name="mail" size={24} color="#4CAF50" />
              <Text style={styles.emailDetailTitle}>Détail de l'email</Text>
              <TouchableOpacity onPress={() => setShowEmailDetail(false)}>
                <Ionicons name="close" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            {selectedEmail && (
              <ScrollView style={styles.emailDetailContent}>
                <Text style={styles.emailDetailLabel}>Sujet</Text>
                <Text style={styles.emailDetailSubject}>{selectedEmail.subject}</Text>
                
                <Text style={styles.emailDetailLabel}>Destinataires</Text>
                <Text style={styles.emailDetailInfo}>
                  {selectedEmail.recipient_type === 'all' ? 'Tous les utilisateurs' : 
                   selectedEmail.recipient_type === 'category' ? `Catégorie: ${selectedEmail.category || 'N/A'}` :
                   selectedEmail.recipient_type}
                  {selectedEmail.recipient_count ? ` (${selectedEmail.recipient_count})` : ''}
                </Text>
                
                <Text style={styles.emailDetailLabel}>Date d'envoi</Text>
                <Text style={styles.emailDetailInfo}>
                  {selectedEmail.sent_at ? new Date(selectedEmail.sent_at).toLocaleDateString('fr-FR', { 
                    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                  }) : 'Date inconnue'}
                </Text>
                
                <Text style={styles.emailDetailLabel}>Message</Text>
                <View style={styles.emailDetailMessageContainer}>
                  <Text style={styles.emailDetailMessage}>
                    {selectedEmail.message || 'Contenu non disponible'}
                  </Text>
                </View>
              </ScrollView>
            )}
            
            <TouchableOpacity 
              style={styles.closeDetailBtn} 
              onPress={() => setShowEmailDetail(false)}
            >
              <Text style={styles.closeDetailBtnText}>Fermer</Text>
            </TouchableOpacity>
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
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.backgroundCard, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border },
  categoryChipActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  categoryChipText: { fontSize: 13, color: Colors.textMuted },
  categoryChipTextActive: { color: '#fff', fontWeight: '600' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  selectedCategoriesText: { fontSize: 12, color: '#4CAF50', marginTop: Spacing.sm, fontWeight: '500' },

  individualSection: { marginBottom: Spacing.lg },
  emailInput: { backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  
  // Autocomplete suggestions
  suggestionsContainer: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, marginTop: 4, maxHeight: 200 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggestionAvatar: { width: 36, height: 36, borderRadius: 18 },
  suggestionInfo: { flex: 1, marginLeft: Spacing.sm },
  suggestionName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  suggestionEmail: { fontSize: 11, color: Colors.textMuted },
  
  // Selected recipient
  selectedRecipientBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#4CAF5015', paddingHorizontal: 12, paddingVertical: 10, borderRadius: BorderRadius.md, marginTop: Spacing.sm, borderWidth: 1, borderColor: '#4CAF5030' },
  selectedRecipientText: { flex: 1, fontSize: 13, color: Colors.text },

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
  
  // Email Detail Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  emailDetailModal: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: Spacing.lg, width: '90%', maxHeight: '80%' },
  emailDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.lg },
  emailDetailTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', color: Colors.text },
  emailDetailContent: { flex: 1 },
  emailDetailLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginTop: Spacing.md, textTransform: 'uppercase' },
  emailDetailSubject: { fontSize: 16, fontWeight: '600', color: Colors.text, marginTop: 4 },
  emailDetailInfo: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  emailDetailMessageContainer: { backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.sm },
  emailDetailMessage: { fontSize: 13, color: Colors.text, lineHeight: 20 },
  closeDetailBtn: { backgroundColor: Colors.border, paddingVertical: 12, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.lg },
  closeDetailBtnText: { fontSize: 14, fontWeight: '600', color: Colors.text },
});
