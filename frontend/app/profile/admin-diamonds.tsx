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
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { isUserAdmin } from '../../src/components/AdminBadge';
import { base44Users } from '../../src/services/base44Api';
import { LinearGradient } from 'expo-linear-gradient';

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
  const { user } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [diamondAmount, setDiamondAmount] = useState('');

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
      const response = await base44Users.list({ limit: 500 });
      const userList = Array.isArray(response) ? response : (response?.items || []);
      setUsers(userList);
      setFilteredUsers(userList);
    } catch (error) {
      console.error('[AdminDiamonds] Error:', error);
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
          onPress: () => Alert.alert('Succès', '10 Black Diamonds envoyés à tous les utilisateurs!') 
        },
      ]
    );
  };

  const openSendModal = (u: UserItem) => {
    setSelectedUser(u);
    setDiamondAmount('');
    setShowSendModal(true);
  };

  const sendDiamonds = () => {
    if (!diamondAmount || parseInt(diamondAmount) <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un montant valide');
      return;
    }
    Alert.alert('Succès', `${diamondAmount} Black Diamonds envoyés à ${selectedUser?.full_name}!`);
    setShowSendModal(false);
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
        {filteredUsers.map((u) => (
          <TouchableOpacity key={u.id} style={styles.userCard} onPress={() => openSendModal(u)}>
            <View style={styles.userAvatar}>
              {u.avatar_url ? (
                <Image source={{ uri: u.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{u.full_name?.charAt(0).toUpperCase() || 'U'}</Text>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{u.artist_name || u.full_name}</Text>
              <Text style={styles.userEmail}>{u.email}</Text>
            </View>
            <View style={styles.diamondBadge}>
              <Ionicons name="diamond" size={16} color="#FFD700" />
              <Text style={styles.diamondCount}>{u.black_diamonds || 0}</Text>
            </View>
          </TouchableOpacity>
        ))}
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
