import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { isUserAdmin } from '../../src/components/AdminBadge';
import { LinearGradient } from 'expo-linear-gradient';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';

type UserItem = {
  id: string;
  full_name: string;
  artist_name?: string;
  email: string;
  avatar_url?: string;
  black_diamonds?: number;
};

export default function AdminDiamonds() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [diamondAmount, setDiamondAmount] = useState('');
  const [sending, setSending] = useState(false);

  const isAdmin = isUserAdmin(user);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(users.filter(u => 
        u.full_name?.toLowerCase().includes(query) ||
        u.artist_name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query)
      ));
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    try {
      // Use the admin endpoint that works correctly
      const response = await axios.get(`${BACKEND_URL}/api/admin/users?limit=10000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data?.success && response.data?.users) {
        const userList = response.data.users.map((u: any) => ({
          id: u.id || u._id,
          full_name: u.full_name || '',
          artist_name: u.artist_name || '',
          email: u.email || '',
          avatar_url: u.avatar_url || '',
          black_diamonds: u.black_diamonds || 0,
        }));
        setUsers(userList);
        setFilteredUsers(userList);
      }
    } catch (error) {
      console.error('[AdminDiamonds] Error:', error);
      Alert.alert('Erreur', 'Impossible de charger les utilisateurs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const sendDiamondsToAll = () => {
    Alert.alert(
      'Envoyer à tous',
      'Combien de Black Diamonds voulez-vous envoyer à tous les utilisateurs?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Envoyer 10 💎', 
          onPress: async () => {
            // TODO: Implement bulk send via API
            Alert.alert('Info', 'Cette fonctionnalité nécessite un endpoint API spécifique.');
          }
        },
      ]
    );
  };

  const openSendModal = (u: UserItem) => {
    setSelectedUser(u);
    setDiamondAmount('');
    setShowSendModal(true);
  };

  const sendDiamonds = async () => {
    if (!diamondAmount || parseInt(diamondAmount) <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un montant valide');
      return;
    }
    
    if (!selectedUser) return;
    
    setSending(true);
    try {
      console.log(`[AdminDiamonds] Sending ${diamondAmount} diamonds to user ${selectedUser.id} (${selectedUser.email})`);
      
      // Send diamonds to user via API with token - include email as required by giveBlackDiamonds
      const response = await axios.post(`${BACKEND_URL}/api/base44/add-diamonds`, {
        user_id: selectedUser.id,
        email: selectedUser.email,  // Required by giveBlackDiamonds
        amount: parseInt(diamondAmount),
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000  // 30 second timeout
      });
      
      console.log('[AdminDiamonds] Response:', response.data);
      
      if (response.data?.success) {
        const prevBalance = response.data?.previous_balance || 0;
        const newBalance = response.data?.new_balance || parseInt(diamondAmount);
        Alert.alert(
          '✅ Succès', 
          `${diamondAmount} Black Diamonds envoyés à ${selectedUser?.full_name || selectedUser?.artist_name}!\n\nAncien solde: ${prevBalance}\nNouveau solde: ${newBalance}`
        );
        setShowSendModal(false);
        loadUsers(); // Refresh the list
      } else {
        Alert.alert('Erreur', response.data?.error || response.data?.message || 'Impossible d\'envoyer les diamonds.');
      }
    } catch (error: any) {
      console.error('[AdminDiamonds] Send error:', error);
      console.error('[AdminDiamonds] Error response:', error.response?.data);
      
      // More detailed error message
      let errorMsg = 'Impossible d\'envoyer les diamonds.';
      if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      Alert.alert('Erreur', errorMsg);
    } finally {
      setSending(false);
    }
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
        <ActivityIndicator size="large" color="#FFD700" />
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
          <Ionicons name="diamond" size={24} color="#FFD700" />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Black Diamonds Manager</Text>
          <Text style={styles.headerSubtitle}>Gérer les diamonds des utilisateurs</Text>
        </View>
      </View>

      {/* Search & Actions */}
      <View style={styles.actionsRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un utilisateur..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity style={styles.sendAllBtn} onPress={sendDiamondsToAll}>
          <LinearGradient
            colors={['#9C27B0', '#7B1FA2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sendAllGradient}
          >
            <Ionicons name="diamond" size={16} color="#fff" />
            <Text style={styles.sendAllText}>Envoyer à tous</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* User List */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
      >
        {filteredUsers.map((u) => {
          // Convert DiceBear SVG URLs to PNG for React Native compatibility
          let avatarUrl = u.avatar_url;
          if (avatarUrl && avatarUrl.includes('dicebear.com') && avatarUrl.includes('/svg?')) {
            avatarUrl = avatarUrl.replace('/svg?', '/png?') + '&size=200';
          }
          
          return (
          <TouchableOpacity key={u.id} style={styles.userCard} onPress={() => openSendModal(u)}>
            <View style={styles.userAvatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{u.full_name?.charAt(0).toUpperCase() || u.artist_name?.charAt(0).toUpperCase() || 'U'}</Text>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{u.artist_name || u.full_name || 'Sans nom'}</Text>
              <Text style={styles.userEmail}>{u.email}</Text>
            </View>
            <View style={styles.diamondBadge}>
              <Ionicons name="diamond" size={16} color="#FFD700" />
              <Text style={styles.diamondCount}>{u.black_diamonds || 0}</Text>
            </View>
          </TouchableOpacity>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Send Diamonds Modal */}
      <Modal visible={showSendModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="diamond" size={32} color="#FFD700" />
              <Text style={styles.modalTitle}>Envoyer des Black Diamonds</Text>
            </View>
            <Text style={styles.modalSubtitle}>À: {selectedUser?.full_name}</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="Montant"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              value={diamondAmount}
              onChangeText={setDiamondAmount}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSendModal(false)}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={sendDiamonds}>
                <Text style={styles.sendBtnText}>Envoyer</Text>
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
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFD70020', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  headerContent: { marginLeft: 12, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textMuted },

  actionsRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 14, color: Colors.text },
  sendAllBtn: { overflow: 'hidden', borderRadius: BorderRadius.md },
  sendAllGradient: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  sendAllText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  content: { flex: 1, paddingHorizontal: Spacing.md },

  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  userAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: 50, height: 50, borderRadius: 25 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: Colors.primary },
  userInfo: { flex: 1, marginLeft: Spacing.md },
  userName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  userEmail: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  diamondBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a1a2e', paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md, borderWidth: 2, borderColor: '#FFD700' },
  diamondCount: { fontSize: 16, fontWeight: 'bold', color: '#FFD700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: Spacing.lg, width: '85%', alignItems: 'center' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  modalSubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: Spacing.md },
  amountInput: { backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 18, color: Colors.text, width: '100%', textAlign: 'center', marginTop: Spacing.md, borderWidth: 1, borderColor: '#FFD700' },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg, width: '100%' },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { fontSize: 14, color: Colors.textMuted },
  sendBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: BorderRadius.md, backgroundColor: '#FFD700' },
  sendBtnText: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
});
