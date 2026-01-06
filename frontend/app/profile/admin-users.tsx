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
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { isUserAdmin } from '../../src/components/AdminBadge';
import AdminBadge from '../../src/components/AdminBadge';
import { Picker } from '@react-native-picker/picker';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';

type UserItem = {
  id: string;
  full_name: string;
  artist_name?: string;
  email: string;
  avatar_url?: string;
  role?: string;
  user_type?: string;
  nationality?: string;
  residence_club?: string;
  instagram_url?: string;
  bio?: string;
  black_diamonds?: number;
  is_admin?: boolean;
  read_only?: boolean;
};

type EditFormData = {
  full_name: string;
  artist_name: string;
  user_type: string;
  role: string;
  nationality: string;
  residence_club: string;
  instagram_url: string;
  bio: string;
  read_only: boolean;
};

export default function AdminUsers() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({
    full_name: '',
    artist_name: '',
    user_type: 'user',
    role: 'user',
    nationality: '',
    residence_club: '',
    instagram_url: '',
    bio: '',
    read_only: false,
  });
  const [saving, setSaving] = useState(false);

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
      // Use new backend endpoint for real user data
      const response = await axios.get(`${BACKEND_URL}/api/admin/users?limit=10000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data?.success && response.data?.users) {
        const userList = response.data.users.map((u: any) => ({
          id: u.id || u._id,
          full_name: u.full_name || u.name,
          artist_name: u.artist_name,
          email: u.email,
          avatar_url: u.avatar_url || u.avatar,
          role: u.role,
          user_type: u.user_type,
          nationality: u.nationality,
          black_diamonds: u.black_diamonds || u.data?.black_diamonds || 0,
          is_admin: u.is_admin || u.role === 'admin',
        }));
        setUsers(userList);
        setFilteredUsers(userList);
      }
    } catch (error) {
      console.error('[AdminUsers] Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const generateMissingAvatars = async () => {
    try {
      Alert.alert('Generate Avatars', 'Génération des avatars manquants en cours...');
      
      const response = await axios.post(`${BACKEND_URL}/api/admin/generate-avatars`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data?.success) {
        Alert.alert('✅ Avatars générés', response.data.message || 'Les avatars ont été générés avec succès');
        loadUsers(); // Refresh the list
      } else {
        Alert.alert('Avatars', response.data?.message || 'Opération terminée');
      }
    } catch (error: any) {
      console.error('[AdminUsers] Generate avatars error:', error);
      Alert.alert('Erreur', error.response?.data?.detail || 'Erreur lors de la génération des avatars');
    }
  };

  const editUser = (userId: string) => {
    const userToEdit = users.find(u => u.id === userId);
    if (userToEdit) {
      setSelectedUser(userToEdit);
      setEditForm({
        full_name: userToEdit.full_name || '',
        artist_name: userToEdit.artist_name || '',
        user_type: userToEdit.user_type || 'user',
        role: userToEdit.role || 'user',
        nationality: userToEdit.nationality || '',
        residence_club: userToEdit.residence_club || '',
        instagram_url: userToEdit.instagram_url || '',
        bio: userToEdit.bio || '',
        read_only: userToEdit.read_only || false,
      });
      setShowEditModal(true);
    }
  };

  const saveUserChanges = async () => {
    if (!selectedUser) return;
    
    setSaving(true);
    try {
      const response = await axios.put(
        `${BACKEND_URL}/api/admin/users/${selectedUser.id}`,
        editForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data?.success) {
        Alert.alert('✅ Succès', 'Les modifications ont été enregistrées');
        setShowEditModal(false);
        loadUsers(); // Refresh
      } else {
        Alert.alert('Erreur', response.data?.message || 'Échec de la mise à jour');
      }
    } catch (error: any) {
      console.error('[AdminUsers] Save error:', error);
      Alert.alert('Erreur', error.response?.data?.detail || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = (userId: string, userName: string) => {
    Alert.alert(
      'Supprimer l\'utilisateur',
      `Êtes-vous sûr de vouloir supprimer ${userName}?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => console.log('Delete', userId) },
      ]
    );
  };

  const getUserTypeColor = (userType?: string) => {
    switch (userType?.toLowerCase()) {
      case 'dj': return '#4CAF50';
      case 'producer': return '#2196F3';
      case 'label': return '#9C27B0';
      default: return '#757575';
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
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Chargement des utilisateurs...</Text>
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
          <Ionicons name="people" size={24} color="#9C27B0" />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>User Management</Text>
          <Text style={styles.headerSubtitle}>{users.length} utilisateurs</Text>
        </View>
        <TouchableOpacity style={styles.generateBtn} onPress={generateMissingAvatars}>
          <Ionicons name="person-add" size={18} color="#fff" />
          <Text style={styles.generateBtnText}>Generate Missing Avatars</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, artist name or email..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* User List */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {filteredUsers.map((u) => {
          // Convert DiceBear SVG URLs to PNG for React Native compatibility
          let avatarUrl = u.avatar_url;
          if (avatarUrl && avatarUrl.includes('dicebear.com') && avatarUrl.includes('/svg?')) {
            avatarUrl = avatarUrl.replace('/svg?', '/png?') + '&size=200';
          }
          
          return (
          <View key={u.id} style={styles.userCard}>
            <View style={styles.userAvatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{u.full_name?.charAt(0).toUpperCase() || 'U'}</Text>
              )}
            </View>
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>{u.artist_name || u.full_name}</Text>
                {isUserAdmin(u) && <AdminBadge size="small" />}
              </View>
              <Text style={styles.userEmail}>{u.email}</Text>
              <View style={styles.userTags}>
                {u.user_type && (
                  <View style={[styles.userTag, { backgroundColor: getUserTypeColor(u.user_type) }]}>
                    <Text style={styles.userTagText}>{u.user_type.toUpperCase()}</Text>
                  </View>
                )}
                {u.nationality && (
                  <View style={[styles.userTag, { backgroundColor: '#9C27B0' }]}>
                    <Text style={styles.userTagText}>{u.nationality}</Text>
                  </View>
                )}
                {(u.black_diamonds || 0) > 0 && (
                  <View style={styles.diamondBadge}>
                    <Ionicons name="diamond" size={12} color="#FFD700" />
                    <Text style={styles.diamondText}>{u.black_diamonds}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.userActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => editUser(u.id)}>
                <Ionicons name="pencil" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteUser(u.id, u.full_name)}>
                <Ionicons name="trash" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit User Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Éditer l'utilisateur</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            {selectedUser && (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.editForm}>
                {/* Email - Read Only */}
                <Text style={styles.editLabel}>Email</Text>
                <View style={[styles.editInput, styles.editInputReadOnly]}>
                  <Text style={styles.editInputText}>{selectedUser.email}</Text>
                </View>

                {/* Full Name */}
                <Text style={styles.editLabel}>Full Name</Text>
                <TextInput
                  style={styles.editInput}
                  value={editForm.full_name}
                  onChangeText={(text) => setEditForm({...editForm, full_name: text})}
                  placeholder="Nom complet"
                  placeholderTextColor={Colors.textMuted}
                />

                {/* Artist Name */}
                <Text style={styles.editLabel}>Artist Name</Text>
                <TextInput
                  style={styles.editInput}
                  value={editForm.artist_name}
                  onChangeText={(text) => setEditForm({...editForm, artist_name: text})}
                  placeholder="Nom d'artiste"
                  placeholderTextColor={Colors.textMuted}
                />

                {/* User Type */}
                <Text style={styles.editLabel}>User Type</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={[styles.pickerOption, editForm.user_type === 'user' && styles.pickerOptionActive]}
                    onPress={() => setEditForm({...editForm, user_type: 'user'})}
                  >
                    <Text style={[styles.pickerOptionText, editForm.user_type === 'user' && styles.pickerOptionTextActive]}>User</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.pickerOption, editForm.user_type === 'dj' && styles.pickerOptionActive]}
                    onPress={() => setEditForm({...editForm, user_type: 'dj'})}
                  >
                    <Text style={[styles.pickerOptionText, editForm.user_type === 'dj' && styles.pickerOptionTextActive]}>DJ</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.pickerOption, editForm.user_type === 'producer' && styles.pickerOptionActive]}
                    onPress={() => setEditForm({...editForm, user_type: 'producer'})}
                  >
                    <Text style={[styles.pickerOptionText, editForm.user_type === 'producer' && styles.pickerOptionTextActive]}>Producer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.pickerOption, editForm.user_type === 'dj_producer' && styles.pickerOptionActive]}
                    onPress={() => setEditForm({...editForm, user_type: 'dj_producer'})}
                  >
                    <Text style={[styles.pickerOptionText, editForm.user_type === 'dj_producer' && styles.pickerOptionTextActive]}>DJ & Producer</Text>
                  </TouchableOpacity>
                </View>

                {/* Role */}
                <Text style={styles.editLabel}>Role</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={[styles.pickerOption, editForm.role === 'user' && styles.pickerOptionActive]}
                    onPress={() => setEditForm({...editForm, role: 'user'})}
                  >
                    <Text style={[styles.pickerOptionText, editForm.role === 'user' && styles.pickerOptionTextActive]}>User</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.pickerOption, editForm.role === 'admin' && styles.pickerOptionActive]}
                    onPress={() => setEditForm({...editForm, role: 'admin'})}
                  >
                    <Text style={[styles.pickerOptionText, editForm.role === 'admin' && styles.pickerOptionTextActive]}>Admin</Text>
                  </TouchableOpacity>
                </View>

                {/* Nationality */}
                <Text style={styles.editLabel}>Nationality</Text>
                <TextInput
                  style={styles.editInput}
                  value={editForm.nationality}
                  onChangeText={(text) => setEditForm({...editForm, nationality: text})}
                  placeholder="Nationalité"
                  placeholderTextColor={Colors.textMuted}
                />

                {/* Residence Club */}
                <Text style={styles.editLabel}>Residence Club</Text>
                <TextInput
                  style={styles.editInput}
                  value={editForm.residence_club}
                  onChangeText={(text) => setEditForm({...editForm, residence_club: text})}
                  placeholder="Club de résidence"
                  placeholderTextColor={Colors.textMuted}
                />

                {/* Instagram URL */}
                <Text style={styles.editLabel}>Instagram URL</Text>
                <TextInput
                  style={styles.editInput}
                  value={editForm.instagram_url}
                  onChangeText={(text) => setEditForm({...editForm, instagram_url: text})}
                  placeholder="https://instagram.com/..."
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                />

                {/* Bio */}
                <Text style={styles.editLabel}>Bio</Text>
                <TextInput
                  style={[styles.editInput, styles.editInputMultiline]}
                  value={editForm.bio}
                  onChangeText={(text) => setEditForm({...editForm, bio: text})}
                  placeholder="Biographie..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={4}
                />

                {/* Read Only Checkbox */}
                <TouchableOpacity 
                  style={styles.checkboxRow}
                  onPress={() => setEditForm({...editForm, read_only: !editForm.read_only})}
                >
                  <View style={[styles.checkbox, editForm.read_only && styles.checkboxChecked]}>
                    {editForm.read_only && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                  <Text style={styles.checkboxLabel}>Read-only access</Text>
                </TouchableOpacity>

                {/* Save Button */}
                <TouchableOpacity 
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={saveUserChanges}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="save" size={20} color="#fff" />
                      <Text style={styles.saveBtnText}>Enregistrer</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
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

  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, paddingTop: 50, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border, flexWrap: 'wrap' },
  headerBack: { padding: 8 },
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#9C27B020', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  headerContent: { marginLeft: 12, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textMuted },
  generateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF9800', paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md, marginTop: 8 },
  generateBtnText: { fontSize: 11, fontWeight: '600', color: '#fff' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, margin: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 14, color: Colors.text },

  content: { flex: 1, paddingHorizontal: Spacing.md },

  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  userAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: 50, height: 50, borderRadius: 25 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: Colors.primary },
  userInfo: { flex: 1, marginLeft: Spacing.md },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  userEmail: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  userTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  userTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  userTagText: { fontSize: 10, fontWeight: '600', color: '#fff' },
  diamondBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1a1a2e', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: '#FFD700' },
  diamondText: { fontSize: 11, fontWeight: '600', color: '#FFD700' },
  userActions: { flexDirection: 'row', gap: 8 },
  editBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#2196F3', justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#F44336', justifyContent: 'center', alignItems: 'center' },

  // Edit Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  editModalContent: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingBottom: 20 },
  editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  editModalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  editForm: { padding: Spacing.md },
  editLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginTop: Spacing.md, marginBottom: 8 },
  editInput: { backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: 14, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  editInputReadOnly: { backgroundColor: Colors.border + '40' },
  editInputText: { fontSize: 15, color: Colors.textMuted },
  editInputMultiline: { minHeight: 100, textAlignVertical: 'top' },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.md, backgroundColor: Colors.backgroundInput, borderWidth: 1, borderColor: Colors.border },
  pickerOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pickerOptionText: { fontSize: 13, fontWeight: '500', color: Colors.textMuted },
  pickerOptionTextActive: { color: '#fff' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg, gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxLabel: { fontSize: 14, color: Colors.text },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#4CAF50', paddingVertical: 16, borderRadius: BorderRadius.md, marginTop: Spacing.xl },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
