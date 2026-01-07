import React, { useState, useEffect, useRef } from 'react';
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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { isUserAdmin } from '../../src/components/AdminBadge';
import { LinearGradient } from 'expo-linear-gradient';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';
const BASE44_APP_ID = '691a4d96d819355b52c063f3';
const BASE44_API_URL = `https://spynners.base44.app/api/apps/${BASE44_APP_ID}`;

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
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [showSendAllModal, setShowSendAllModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [diamondAmount, setDiamondAmount] = useState('');
  const [sendAllAmount, setSendAllAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendAllProgress, setSendAllProgress] = useState({ current: 0, total: 0 });

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
      console.log('[AdminDiamonds] Loading users, Platform:', Platform.OS);
      
      // On mobile, use Base44 API directly
      if (Platform.OS !== 'web') {
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        };
        
        const response = await axios.get(`${BASE44_API_URL}/entities/User?limit=10000`, { headers });
        const usersData = response.data || [];
        
        console.log('[AdminDiamonds] Got', usersData.length, 'users from Base44');
        
        const userList = usersData.map((u: any) => {
          const userData = u.data || {};
          return {
            id: u.id || u._id,
            full_name: u.full_name || userData.full_name || '',
            artist_name: userData.artist_name || u.artist_name || '',
            email: u.email || '',
            avatar_url: userData.avatar_url || u.avatar_url || u.generated_avatar_url || '',
            black_diamonds: userData.black_diamonds || u.black_diamonds || 0,
          };
        });
        
        setUsers(userList);
        setFilteredUsers(userList);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // On web, use backend proxy
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
      Alert.alert(t('common.error'), t('admin.loadUsersError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const [sendAllCancelled, setSendAllCancelled] = useState(false);
  const cancelledRef = useRef(false);

  const sendDiamondsToAll = () => {
    setSendAllAmount('');
    setSendAllCancelled(false);
    cancelledRef.current = false;
    setShowSendAllModal(true);
  };

  const cancelSendAll = () => {
    setSendAllCancelled(true);
    cancelledRef.current = true;
  };

  const executeSendToAll = async () => {
    const amount = parseInt(sendAllAmount);
    if (!sendAllAmount || amount <= 0) {
      Alert.alert(t('common.error'), t('admin.enterValidAmount'));
      return;
    }

    Alert.alert(
      t('admin.confirm'),
      t('admin.confirmSendAllDiamonds').replace('{amount}', amount.toString()).replace('{count}', users.length.toString()),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            setSendingAll(true);
            setSendAllCancelled(false);
            cancelledRef.current = false;
            setSendAllProgress({ current: 0, total: users.length });
            
            let successCount = 0;
            let errorCount = 0;
            let wasCancelled = false;
            
            for (let i = 0; i < users.length; i++) {
              // Check if cancelled using ref (works in async loop)
              if (cancelledRef.current) {
                wasCancelled = true;
                break;
              }
              
              const u = users[i];
              try {
                await axios.post(`${BACKEND_URL}/api/base44/add-diamonds`, {
                  user_id: u.id,
                  email: u.email,
                  amount: amount,
                }, {
                  headers: { Authorization: `Bearer ${token}` },
                  timeout: 10000
                });
                successCount++;
              } catch (error) {
                console.error(`[SendAll] Error for ${u.email}:`, error);
                errorCount++;
              }
              setSendAllProgress({ current: i + 1, total: users.length });
            }
            
            setSendingAll(false);
            setShowSendAllModal(false);
            
            if (wasCancelled) {
              Alert.alert(
                '⏹️ ' + t('common.cancel'),
                `${t('admin.sendInterrupted')}.\n\n✅ ${t('admin.sent')}: ${successCount}\n❌ ${t('admin.errors')}: ${errorCount}\n⏭️ ${t('admin.notProcessed')}: ${users.length - successCount - errorCount}`
              );
            } else {
              Alert.alert(
                '✅ ' + t('admin.done'),
                `${amount} Black Diamond${amount > 1 ? 's' : ''} ${t('admin.sent').toLowerCase()}!\n\n✅ ${t('common.success')}: ${successCount}\n❌ ${t('admin.errors')}: ${errorCount}`
              );
            }
            
            loadUsers(); // Refresh the list
          }
        }
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
      Alert.alert(t('common.error'), t('admin.enterValidAmount'));
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
          '✅ ' + t('common.success'), 
          `${diamondAmount} Black Diamonds ${t('admin.sent').toLowerCase()} ${selectedUser?.full_name || selectedUser?.artist_name}!\n\n${t('admin.previousBalance')}: ${prevBalance}\n${t('admin.newBalance')}: ${newBalance}`
        );
        setShowSendModal(false);
        loadUsers(); // Refresh the list
      } else {
        Alert.alert(t('common.error'), response.data?.error || response.data?.message || t('admin.sendDiamondsError'));
      }
    } catch (error: any) {
      console.error('[AdminDiamonds] Send error:', error);
      console.error('[AdminDiamonds] Error response:', error.response?.data);
      
      // More detailed error message
      let errorMsg = t('admin.sendDiamondsError');
      if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      Alert.alert(t('common.error'), errorMsg);
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
          <Ionicons name="diamond" size={24} color="#FFD700" />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Black Diamonds Manager</Text>
          <Text style={styles.headerSubtitle}>{t('admin.manageDiamonds')}</Text>
        </View>
      </View>

      {/* Search & Actions */}
      <View style={styles.actionsRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('admin.searchUser')}
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
            <Text style={styles.sendAllText}>{t('admin.sendToAll')}</Text>
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
              <Text style={styles.userName}>{u.artist_name || u.full_name || t('admin.noName')}</Text>
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
              <Text style={styles.modalTitle}>{t('admin.sendBlackDiamonds')}</Text>
            </View>
            <Text style={styles.modalSubtitle}>{t('admin.to')}: {selectedUser?.full_name}</Text>
            <TextInput
              style={styles.amountInput}
              placeholder={t('admin.amount')}
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              value={diamondAmount}
              onChangeText={setDiamondAmount}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSendModal(false)}>
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={sendDiamonds}>
                <Text style={styles.sendBtnText}>{t('admin.send')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Send to All Modal */}
      <Modal visible={showSendAllModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="diamond" size={32} color="#9C27B0" />
              <Text style={styles.modalTitle}>{t('admin.sendToAll')}</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              {sendingAll 
                ? `${t('admin.sendingInProgress')}... ${sendAllProgress.current}/${sendAllProgress.total}`
                : `${users.length} ${t('admin.usersWillReceive')}`
              }
            </Text>
            {sendingAll ? (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="large" color="#9C27B0" />
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${(sendAllProgress.current / sendAllProgress.total) * 100}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {Math.round((sendAllProgress.current / sendAllProgress.total) * 100)}%
                </Text>
                <TouchableOpacity 
                  style={[styles.cancelBtn, { marginTop: 20, width: '100%', backgroundColor: '#ff4444', borderColor: '#ff4444' }]} 
                  onPress={cancelSendAll}
                >
                  <Text style={[styles.cancelBtnText, { color: '#fff', fontWeight: '600' }]}>⏹️ {t('admin.cancelSend')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.amountInput}
                  placeholder={t('admin.amountToSend')}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  value={sendAllAmount}
                  onChangeText={setSendAllAmount}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSendAllModal(false)}>
                    <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.sendBtn, { backgroundColor: '#9C27B0' }]} onPress={executeSendToAll}>
                    <Text style={styles.sendBtnText}>{t('admin.sendToAll')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  modalSubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: Spacing.md, textAlign: 'center' },
  amountInput: { backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 18, color: Colors.text, width: '100%', textAlign: 'center', marginTop: Spacing.md, borderWidth: 1, borderColor: '#FFD700' },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg, width: '100%' },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { fontSize: 14, color: Colors.textMuted },
  sendBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: BorderRadius.md, backgroundColor: '#FFD700' },
  sendBtnText: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  
  // Progress styles for Send All
  progressContainer: { width: '100%', alignItems: 'center', marginTop: Spacing.lg },
  progressBar: { width: '100%', height: 8, backgroundColor: Colors.border, borderRadius: 4, marginTop: Spacing.md, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#9C27B0', borderRadius: 4 },
  progressText: { fontSize: 16, fontWeight: 'bold', color: '#9C27B0', marginTop: Spacing.sm },
});
