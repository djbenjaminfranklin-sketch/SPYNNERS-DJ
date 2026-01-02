import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

interface Member {
  id?: string;
  _id?: string;
  email: string;
  full_name?: string;
  user_type?: string;
  avatar?: string;
  isOnline?: boolean;
}

const getBackendUrl = () => {
  if (typeof window !== 'undefined') return '';
  return 'https://trackhub-20.preview.emergentagent.com';
};

export default function ChatScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMembers();
  }, [token]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      console.log('[Chat] Loading all members...');
      
      // Get auth token from storage
      const authToken = token || await AsyncStorage.getItem('auth_token');
      
      if (!authToken) {
        console.log('[Chat] No auth token, cannot load members');
        setLoading(false);
        return;
      }
      
      // Make authenticated request to get users
      const response = await axios.get(
        `${getBackendUrl()}/api/base44/entities/User`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          params: { limit: 100 }
        }
      );
      
      const allUsers = response.data || [];
      console.log('[Chat] Members loaded:', allUsers.length);
      
      if (allUsers.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }
      
      // Sort: online users first (simulated - in real app would use presence system)
      const membersWithStatus = allUsers.map((u: Member) => ({
        ...u,
        isOnline: Math.random() > 0.7, // 30% chance of being "online" for demo
      }));
      
      // Sort online first
      membersWithStatus.sort((a: Member, b: Member) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return 0;
      });
      
      setMembers(membersWithStatus);
    } catch (error: any) {
      console.error('[Chat] Error loading members:', error?.response?.data || error?.message);
      // Show error message if auth failed
      if (error?.response?.status === 401) {
        Alert.alert('Authentication Required', 'Please log in to view members');
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMembers();
    setRefreshing(false);
  };

  const filteredMembers = members.filter((m: Member) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      m.full_name?.toLowerCase().includes(query) ||
      m.email?.toLowerCase().includes(query) ||
      m.user_type?.toLowerCase().includes(query)
    );
  });

  const onlineCount = members.filter((m: Member) => m.isOnline).length;

  const getUserTypeLabel = (type?: string) => {
    switch (type) {
      case 'dj': return 'DJ';
      case 'producer': return 'Producer';
      case 'dj_producer': return 'DJ / Producer';
      case 'label': return 'Label';
      default: return 'Member';
    }
  };

  const startChat = (member: Member) => {
    Alert.alert(
      `Chat with ${member.full_name || 'User'}`,
      'Direct messaging coming soon!',
      [{ text: 'OK' }]
    );
  };

  const renderMember = ({ item }: { item: Member }) => (
    <TouchableOpacity 
      style={styles.memberCard}
      onPress={() => startChat(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {(item.full_name || item.email || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {item.isOnline && <View style={styles.onlineDot} />}
      </View>
      
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.full_name || item.email?.split('@')[0] || 'Unknown'}</Text>
        <Text style={styles.memberType}>{getUserTypeLabel(item.user_type)}</Text>
      </View>

      <TouchableOpacity style={styles.messageButton} onPress={() => startChat(item)}>
        <Ionicons name="chatbubble" size={20} color={Colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading members...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <Text style={styles.headerTitle}>Chat</Text>
        <Text style={styles.headerSubtitle}>{members.length} members</Text>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search members..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Online indicator */}
      <View style={styles.onlineInfo}>
        <View style={styles.onlineDotSmall} />
        <Text style={styles.onlineText}>
          {onlineCount} online
        </Text>
      </View>

      {/* Members List */}
      {members.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={60} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No members found</Text>
          <Text style={styles.emptySubtext}>
            Members will appear here once available
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadMembers}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredMembers}
          keyExtractor={(item) => item.id || item._id || item.email || Math.random().toString()}
          renderItem={renderMember}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { color: Colors.textMuted, marginTop: 12 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: Colors.text },
  headerSubtitle: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.text, marginLeft: 8, fontSize: 14 },
  onlineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  onlineDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  onlineText: { color: Colors.textMuted, fontSize: 12 },
  listContent: { padding: 12 },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarContainer: { position: 'relative' },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: Colors.backgroundCard,
  },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  memberType: { fontSize: 12, color: Colors.primary, marginTop: 2 },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: Colors.text, fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { color: Colors.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: Colors.primary, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
});
