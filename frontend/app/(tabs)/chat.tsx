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
import { base44Tracks, Track } from '../../src/services/base44Api';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

interface Member {
  id: string;
  name: string;
  type: string;
  isOnline: boolean;
  trackCount: number;
}

export default function ChatScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      console.log('[Chat] Loading members from tracks...');
      
      // Get ALL tracks to extract unique producers
      const allTracks = await base44Tracks.list({ limit: 500 });
      
      // Extract unique producers from tracks
      const producerMap = new Map<string, Member>();
      
      allTracks.forEach((track: Track) => {
        const producerId = track.producer_id || track.created_by_id || '';
        const producerName = track.producer_name || track.artist_name || 'Unknown';
        
        if (producerId && !producerMap.has(producerId)) {
          producerMap.set(producerId, {
            id: producerId,
            name: producerName,
            type: 'Producer',
            isOnline: Math.random() > 0.7, // 30% online for demo
            trackCount: 1,
          });
        } else if (producerId) {
          const existing = producerMap.get(producerId)!;
          existing.trackCount++;
        }
      });
      
      // Convert to array and sort by online status then by track count
      const membersList = Array.from(producerMap.values())
        .sort((a, b) => {
          if (a.isOnline && !b.isOnline) return -1;
          if (!a.isOnline && b.isOnline) return 1;
          return b.trackCount - a.trackCount;
        });
      
      console.log('[Chat] Found', membersList.length, 'unique producers');
      setMembers(membersList);
    } catch (error) {
      console.error('[Chat] Error loading members:', error);
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
    return m.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const onlineCount = members.filter((m: Member) => m.isOnline).length;

  const startChat = (member: Member) => {
    Alert.alert(
      `Chat with ${member.name}`,
      `${member.trackCount} tracks uploaded\n\nDirect messaging coming soon!`,
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
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        {item.isOnline && <View style={styles.onlineDot} />}
      </View>
      
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.name}</Text>
        <Text style={styles.memberType}>{item.type} • {item.trackCount} tracks</Text>
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
        <Text style={styles.headerSubtitle}>{members.length} producers</Text>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search producers..."
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
          <Text style={styles.emptyText}>No producers found</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadMembers}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredMembers}
          keyExtractor={(item) => item.id}
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
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: Colors.primary, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
});
