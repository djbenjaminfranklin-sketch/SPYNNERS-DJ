import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { isUserAdmin } from '../../src/components/AdminBadge';
import AdminBadge from '../../src/components/AdminBadge';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';

const CATEGORIES = [
  { id: 'dj_star', name: 'DJ Star', icon: 'star', color: '#FFD700', count: 0 },
  { id: 'dj_resident', name: 'DJ Resident', icon: 'home', color: '#1a237e', count: 0 },
  { id: 'dj_guest', name: 'DJ Guest', icon: 'globe', color: '#9C27B0', count: 0 },
  { id: 'producer_star', name: 'Producer Star', icon: 'star', color: '#FF9800', count: 0 },
  { id: 'producer', name: 'Producer', icon: 'musical-note', color: '#4CAF50', count: 0 },
  { id: 'music_lover', name: 'Music Lover', icon: 'people', color: '#E91E63', count: 0 },
  { id: 'dj', name: 'DJ', icon: 'headset', color: '#2196F3', count: 0 },
  { id: 'dj_producer', name: 'DJ/Producer', icon: 'disc', color: '#00BCD4', count: 0 },
];

type UserItem = {
  id: string;
  full_name: string;
  artist_name?: string;
  email: string;
  avatar_url?: string;
  user_type?: string;
  nationality?: string;
  role?: string;
};

// Helper to convert SVG avatar URLs to PNG for better display
const getDisplayAvatarUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  // Convert Dicebear SVG to PNG for better React Native compatibility
  if (url.includes('api.dicebear.com') && url.includes('/svg')) {
    return url.replace('/svg', '/png');
  }
  if (url.includes('api.dicebear.com') && !url.includes('/png') && !url.endsWith('.png')) {
    // Add png format if not specified
    const urlParts = url.split('?');
    if (urlParts.length > 1) {
      return url.replace('/7.x/', '/7.x/adventurer/png?') || url;
    }
  }
  return url;
};

export default function AdminCategories() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [categories, setCategories] = useState(CATEGORIES);
  
  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSearch, setEmailSearch] = useState('');
  const [emailSuggestions, setEmailSuggestions] = useState<UserItem[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<UserItem | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const isAdmin = isUserAdmin(user);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, activeFilter, users]);

  // Update email suggestions when typing
  useEffect(() => {
    if (emailSearch.trim().length >= 2) {
      const query = emailSearch.toLowerCase();
      const suggestions = users.filter(u => 
        u.email?.toLowerCase().includes(query) ||
        u.full_name?.toLowerCase().includes(query) ||
        u.artist_name?.toLowerCase().includes(query)
      ).slice(0, 10);
      setEmailSuggestions(suggestions);
    } else {
      setEmailSuggestions([]);
    }
  }, [emailSearch, users]);

  const loadUsers = async () => {
    try {
      // Fetch from Spynners via admin endpoint with higher limit
      const response = await axios.get(`${BACKEND_URL}/api/admin/users?limit=10000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let userList: UserItem[] = [];
      if (response.data?.success && response.data?.users) {
        userList = response.data.users.map((u: any) => ({
          id: u.id || u._id,
          full_name: u.full_name || u.name,
          artist_name: u.artist_name,
          email: u.email,
          avatar_url: u.avatar_url,
          user_type: u.user_type,
          nationality: u.nationality,
          role: u.role,
        }));
      }
      
      setUsers(userList);
      
      // Update category counts based on exact user_type matching
      const updatedCategories = CATEGORIES.map(cat => ({
        ...cat,
        count: userList.filter((u: any) => {
          const userType = (u.user_type || '').toLowerCase().trim();
          const catId = cat.id.toLowerCase();
          
          // Exact match or normalized match
          if (userType === catId) return true;
          if (userType.replace(/[\s_-]/g, '') === catId.replace(/[\s_-]/g, '')) return true;
          
          // Handle special cases
          if (catId === 'dj' && userType === 'dj') return true;
          if (catId === 'dj_star' && (userType === 'dj_star' || userType === 'djstar' || userType === 'dj star')) return true;
          if (catId === 'dj_resident' && (userType === 'dj_resident' || userType === 'djresident' || userType === 'dj resident')) return true;
          if (catId === 'dj_guest' && (userType.includes('guest') || userType === 'dj_guest' || userType === 'djguest')) return true;
          if (catId === 'dj_producer' && (userType === 'dj_producer' || userType === 'djproducer' || userType === 'dj/producer')) return true;
          if (catId === 'producer' && userType === 'producer') return true;
          if (catId === 'producer_star' && (userType === 'producer_star' || userType === 'producerstar' || userType === 'producer star')) return true;
          if (catId === 'music_lover' && (userType === 'music_lover' || userType === 'musiclover' || userType === 'music lover' || userType === 'fan')) return true;
          
          return false;
        }).length,
      }));
      setCategories(updatedCategories);
      
      console.log('[AdminCategories] Loaded', userList.length, 'users');
      console.log('[AdminCategories] Category counts:', updatedCategories.map(c => `${c.name}: ${c.count}`).join(', '));
    } catch (error) {
      console.error('[AdminCategories] Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        u.full_name?.toLowerCase().includes(query) ||
        u.artist_name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query)
      );
    }
    
    if (activeFilter !== 'all') {
      filtered = filtered.filter(u => {
        const userType = (u.user_type || '').toLowerCase().trim();
        const filterId = activeFilter.toLowerCase();
        
        if (userType === filterId) return true;
        if (userType.replace(/[\s_-]/g, '') === filterId.replace(/[\s_-]/g, '')) return true;
        
        // Handle special cases
        if (filterId === 'dj' && userType === 'dj') return true;
        if (filterId === 'dj_star' && (userType === 'dj_star' || userType === 'djstar' || userType === 'dj star')) return true;
        if (filterId === 'dj_resident' && (userType === 'dj_resident' || userType === 'djresident' || userType === 'dj resident')) return true;
        if (filterId === 'dj_guest' && (userType.includes('guest') || userType === 'dj_guest' || userType === 'djguest')) return true;
        if (filterId === 'dj_producer' && (userType === 'dj_producer' || userType === 'djproducer' || userType === 'dj/producer')) return true;
        if (filterId === 'producer' && userType === 'producer') return true;
        if (filterId === 'producer_star' && (userType === 'producer_star' || userType === 'producerstar' || userType === 'producer star')) return true;
        if (filterId === 'music_lover' && (userType === 'music_lover' || userType === 'musiclover' || userType === 'music lover' || userType === 'fan')) return true;
        
        return false;
      });
    }
    
    setFilteredUsers(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const sendGroupEmail = () => {
    router.push('/profile/admin-broadcast');
  };

  const openIndividualEmail = () => {
    setEmailSearch('');
    setEmailSuggestions([]);
    setSelectedRecipient(null);
    setEmailSubject('');
    setEmailBody('');
    setShowEmailModal(true);
  };

  const selectRecipient = (u: UserItem) => {
    setSelectedRecipient(u);
    setEmailSearch(u.email);
    setEmailSuggestions([]);
  };

  const sendIndividualEmail = async () => {
    if (!selectedRecipient) {
      Alert.alert('Erreur', 'Veuillez sélectionner un destinataire');
      return;
    }
    if (!emailSubject.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un sujet');
      return;
    }
    if (!emailBody.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un message');
      return;
    }

    setSendingEmail(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/admin/send-email`, {
        to: selectedRecipient.email,
        subject: emailSubject,
        body: emailBody,
        user_id: selectedRecipient.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data?.success) {
        Alert.alert('✅ Succès', `Email envoyé à ${selectedRecipient.email}`);
        setShowEmailModal(false);
      } else {
        Alert.alert('Erreur', response.data?.error || 'Impossible d\'envoyer l\'email');
      }
    } catch (error: any) {
      console.error('[AdminCategories] Send email error:', error);
      Alert.alert('Erreur', error.response?.data?.detail || 'Impossible d\'envoyer l\'email');
    } finally {
      setSendingEmail(false);
    }
  };

  const autoAssignCategories = () => {
    Alert.alert('Auto-Assign', 'Attribution automatique des catégories en cours...');
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
        <ActivityIndicator size="large" color="#FF5722" />
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
          <Ionicons name="headset" size={24} color="#FF5722" />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>DJ Categories</Text>
          <Text style={styles.headerSubtitle}>Manage your DJs by category</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.sendEmailBtn} onPress={sendGroupEmail}>
          <Ionicons name="send" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Send Group Email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.autoAssignBtn} onPress={autoAssignCategories}>
          <Text style={styles.actionBtnText}>Auto-Assign Categories</Text>
        </TouchableOpacity>
      </View>

      {/* Category Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
        <View style={styles.categoriesRow}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryCard, { backgroundColor: cat.color }]}
              onPress={() => setActiveFilter(activeFilter === cat.id ? 'all' : cat.id)}
            >
              <Ionicons name={cat.icon as any} size={20} color="#fff" />
              <Text style={styles.categoryCount}>{cat.count}</Text>
              <Text style={styles.categoryName}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
        <View style={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'all' && styles.filterTabActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>Tous ({users.length})</Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.filterTab, activeFilter === cat.id && styles.filterTabActive]}
              onPress={() => setActiveFilter(cat.id)}
            >
              <Text style={[styles.filterText, activeFilter === cat.id && styles.filterTextActive]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* User List */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5722" />}
      >
        <Text style={styles.resultCount}>
          {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''} trouvé{filteredUsers.length > 1 ? 's' : ''}
        </Text>
        {filteredUsers.slice(0, 100).map((u) => (
          <View key={u.id} style={styles.userCard}>
            {u.avatar_url ? (
              <Image source={{ uri: u.avatar_url }} style={styles.userAvatarImg} />
            ) : (
              <View style={styles.userAvatar}>
                <Text style={styles.avatarText}>{u.full_name?.charAt(0).toUpperCase() || 'U'}</Text>
              </View>
            )}
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>{u.artist_name || u.full_name}</Text>
                {isUserAdmin(u) && <AdminBadge size="small" />}
              </View>
              <Text style={styles.userEmail}>{u.email}</Text>
              {u.nationality && (
                <Text style={styles.userNationality}>📍 {u.nationality}</Text>
              )}
            </View>
            <View style={[styles.userTypeBadge, { backgroundColor: getUserTypeColor(u.user_type) }]}>
              <Text style={styles.userTypeText}>{formatUserType(u.user_type)}</Text>
            </View>
          </View>
        ))}
        {filteredUsers.length > 100 && (
          <Text style={styles.moreText}>+{filteredUsers.length - 100} autres utilisateurs...</Text>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// Helper functions
const getUserTypeColor = (userType?: string): string => {
  const type = (userType || '').toLowerCase();
  if (type.includes('star')) return '#FFD700';
  if (type.includes('resident')) return '#1a237e';
  if (type.includes('guest')) return '#9C27B0';
  if (type === 'producer') return '#4CAF50';
  if (type === 'dj_producer' || type === 'djproducer') return '#00BCD4';
  if (type === 'dj') return '#2196F3';
  if (type.includes('music')) return '#E91E63';
  return '#757575';
};

const formatUserType = (userType?: string): string => {
  if (!userType) return 'N/A';
  return userType.replace(/_/g, ' ').toUpperCase();
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContent: { justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: Spacing.md, color: Colors.textSecondary },
  accessDeniedTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 16 },
  backButton: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.primary, borderRadius: BorderRadius.md },
  backButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, paddingTop: 50, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerBack: { padding: 8 },
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF572220', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  headerContent: { marginLeft: 12, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textMuted },

  actionsRow: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm },
  sendEmailBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00BCD4', paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.md },
  autoAssignBtn: { backgroundColor: '#FF9800', paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.md },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  categoriesScroll: { maxHeight: 100 },
  categoriesRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm },
  categoryCard: { width: 100, padding: Spacing.sm, borderRadius: BorderRadius.md, alignItems: 'center' },
  categoryCount: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 4 },
  categoryName: { fontSize: 10, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 2 },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, marginHorizontal: Spacing.md, marginTop: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, fontSize: 14, color: Colors.text },

  filtersScroll: { maxHeight: 50, marginTop: Spacing.sm },
  filtersRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.xs },
  filterTab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border },
  filterTabActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '20' },
  filterText: { fontSize: 12, color: Colors.textMuted },
  filterTextActive: { color: Colors.primary, fontWeight: '600' },

  content: { flex: 1, paddingHorizontal: Spacing.md, marginTop: Spacing.md },
  resultCount: { fontSize: 12, color: Colors.textMuted, marginBottom: Spacing.sm },

  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  userAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: Colors.primary },
  userInfo: { flex: 1, marginLeft: Spacing.md },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  userEmail: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  userNationality: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  userTypeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  userTypeText: { fontSize: 9, fontWeight: '600', color: '#fff' },
  moreText: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginVertical: Spacing.md },
});
