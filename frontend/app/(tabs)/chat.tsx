import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { base44Messages, base44Tracks, Message } from '../../src/services/base44Api';
import { useAuth } from '../../src/contexts/AuthContext';
import { invokeBase44Function } from '../../src/api/base44Client';

interface Member {
  id: string;
  name: string;
  type: 'DJ' | 'Producer' | 'Both';
  isOnline: boolean;
  trackCount: number;
  avatar?: string;
  lastMessage?: string;
  unreadCount?: number;
}

export default function ChatScreen() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Conversation modal
  const [showConversation, setShowConversation] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      console.log('[Chat] Loading all members...');
      
      const userId = user?.id || user?._id || '';
      
      // Try multiple approaches to get users
      let allUsers: any[] = [];
      
      // Approach 1: Try the Base44 SDK nativeGetAllUsers function
      try {
        console.log('[Chat] Trying SDK nativeGetAllUsers...');
        let offset = 0;
        const pageSize = 100;
        let hasMore = true;
        
        while (hasMore && offset < 2000) {
          const result = await invokeBase44Function('nativeGetAllUsers', {
            search: '',
            limit: pageSize,
            offset: offset,
          });
          
          // Handle different response formats
          let users: any[] = [];
          if (result?.data?.users) {
            users = result.data.users;
          } else if (result?.users) {
            users = result.users;
          } else if (Array.isArray(result)) {
            users = result;
          } else if (result?.data && Array.isArray(result.data)) {
            users = result.data;
          }
          
          console.log(`[Chat] SDK: Got ${users.length} users at offset ${offset}`);
          
          if (users.length > 0) {
            allUsers.push(...users);
            offset += pageSize;
            if (users.length < pageSize) hasMore = false;
          } else {
            hasMore = false;
          }
        }
      } catch (sdkError) {
        console.log('[Chat] SDK approach failed, will use fallback:', sdkError);
      }
      
      // Approach 2: If SDK didn't work well, try extracting from tracks
      if (allUsers.length < 50) {
        console.log('[Chat] Using tracks fallback to get more users...');
        try {
          const tracksResponse = await base44Tracks.list({ limit: 500 });
          const trackUsers = new Map<string, any>();
          
          tracksResponse.forEach((track: any) => {
            const producerId = track.producer_id || track.created_by_id || track.uploaded_by || '';
            const producerName = track.producer_name || track.artist_name || 'Unknown';
            
            if (producerId && !trackUsers.has(producerId)) {
              trackUsers.set(producerId, {
                id: producerId,
                _id: producerId,
                full_name: producerName,
                user_type: 'producer',
              });
            }
          });
          
          // Merge with SDK results
          trackUsers.forEach((user, id) => {
            if (!allUsers.find((u: any) => (u.id || u._id) === id)) {
              allUsers.push(user);
            }
          });
          
          console.log(`[Chat] After tracks fallback: ${allUsers.length} total users`);
        } catch (tracksError) {
          console.error('[Chat] Tracks fallback error:', tracksError);
        }
      }
      
      console.log('[Chat] Total users found:', allUsers.length);
      
      // Get user's messages to find recent conversations
      const userMessages = await base44Messages.list({ receiver_id: userId });
      const sentMessages = await base44Messages.list({ sender_id: userId });
      const allMessages = [...userMessages, ...sentMessages];
      
      // Create a map of last messages per user
      const lastMessageMap = new Map<string, { message: string; unread: number }>();
      allMessages.forEach((msg: Message) => {
        const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        if (!lastMessageMap.has(otherId)) {
          lastMessageMap.set(otherId, {
            message: msg.content || '',
            unread: msg.receiver_id === userId && !msg.read ? 1 : 0,
          });
        } else if (msg.receiver_id === userId && !msg.read) {
          const existing = lastMessageMap.get(otherId)!;
          existing.unread++;
        }
      });
      
      // Build member map from users
      const memberMap = new Map<string, Member>();
      
      // Add all users from nativeGetAllUsers
      allUsers.forEach((userData: any) => {
        const memberId = userData.id || userData._id || '';
        const memberName = userData.full_name || userData.name || userData.email?.split('@')[0] || 'Unknown';
        
        if (memberId && memberId !== userId && !memberMap.has(memberId)) {
          const msgInfo = lastMessageMap.get(memberId);
          const userType = (userData.user_type || '').toLowerCase();
          
          memberMap.set(memberId, {
            id: memberId,
            name: memberName,
            type: (userType === 'dj' ? 'DJ' : userType === 'producer' ? 'Producer' : 'Both') as any,
            isOnline: Math.random() > 0.7, // TODO: implement real online status
            trackCount: userData.track_count || 0,
            avatar: userData.avatar || userData.profile_image,
            lastMessage: msgInfo?.message,
            unreadCount: msgInfo?.unread || 0,
          });
        }
      });
      
      // Convert to array and sort
      const membersList = Array.from(memberMap.values())
        .sort((a, b) => {
          // Sort by unread first, then online, then by name
          if ((a.unreadCount || 0) > 0 && (b.unreadCount || 0) === 0) return -1;
          if ((b.unreadCount || 0) > 0 && (a.unreadCount || 0) === 0) return 1;
          if (a.isOnline && !b.isOnline) return -1;
          if (!a.isOnline && b.isOnline) return 1;
          return a.name.localeCompare(b.name);
        });
      
      console.log('[Chat] Final members list count:', membersList.length);
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

  // Open conversation with a member
  const openConversation = async (member: Member) => {
    setSelectedMember(member);
    setShowConversation(true);
    setLoadingMessages(true);
    
    try {
      const userId = user?.id || user?._id || '';
      const conversation = await base44Messages.getConversation(userId, member.id);
      setMessages(conversation);
      
      // Mark messages as read
      for (const msg of conversation) {
        if (msg.receiver_id === userId && !msg.read) {
          await base44Messages.markAsRead(msg.id || msg._id || '');
        }
      }
      
      // Update unread count
      setMembers(prev => prev.map(m => 
        m.id === member.id ? { ...m, unreadCount: 0 } : m
      ));
    } catch (error) {
      console.error('[Chat] Error loading conversation:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedMember) return;
    
    setSendingMessage(true);
    try {
      const userId = user?.id || user?._id || '';
      const userName = user?.full_name || user?.email || 'User';
      
      const message = await base44Messages.send({
        sender_id: userId,
        sender_name: userName,
        receiver_id: selectedMember.id,
        content: newMessage.trim(),
      });
      
      if (message) {
        setMessages(prev => [...prev, message]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('[Chat] Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  // Filter members by search
  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get total unread count
  const totalUnread = members.reduce((sum, m) => sum + (m.unreadCount || 0), 0);

  const renderMember = ({ item }: { item: Member }) => (
    <TouchableOpacity 
      style={styles.memberCard}
      onPress={() => openConversation(item)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>

      {/* Member Info */}
      <View style={styles.memberInfo}>
        <Text style={styles.memberName} numberOfLines={1}>{item.name}</Text>
        {item.lastMessage ? (
          <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
        ) : (
          <Text style={styles.memberStats}>
            {item.type} • {item.trackCount} tracks
          </Text>
        )}
      </View>

      {/* Unread Badge or Status */}
      {item.unreadCount && item.unreadCount > 0 ? (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unreadCount}</Text>
        </View>
      ) : (
        <View style={styles.memberMeta}>
          {item.isOnline ? (
            <Text style={styles.onlineText}>Online</Text>
          ) : (
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          )}
        </View>
      )}
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
        <Text style={styles.headerTitle}>Messages</Text>
        {totalUnread > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{totalUnread}</Text>
          </View>
        )}
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
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
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{members.length}</Text>
          <Text style={styles.statLabel}>Members</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{members.filter(m => m.isOnline).length}</Text>
          <Text style={[styles.statLabel, { color: '#4CAF50' }]}>Online</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalUnread}</Text>
          <Text style={[styles.statLabel, { color: Colors.primary }]}>Unread</Text>
        </View>
      </View>

      {/* Members List */}
      {filteredMembers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={60} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No members found</Text>
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

      {/* Conversation Modal */}
      <Modal visible={showConversation} animationType="slide">
        <KeyboardAvoidingView 
          style={styles.conversationContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Conversation Header */}
          <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.conversationHeader}>
            <TouchableOpacity onPress={() => setShowConversation(false)}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.conversationHeaderInfo}>
              <Text style={styles.conversationName}>{selectedMember?.name}</Text>
              {selectedMember?.isOnline && (
                <Text style={styles.conversationStatus}>Online</Text>
              )}
            </View>
            <View style={{ width: 24 }} />
          </LinearGradient>

          {/* Messages */}
          {loadingMessages ? (
            <View style={styles.messagesLoading}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.messagesEmpty}>
              <Ionicons name="chatbubbles-outline" size={60} color={Colors.textMuted} />
              <Text style={styles.messagesEmptyText}>No messages yet</Text>
              <Text style={styles.messagesEmptySubtext}>Say hello to start the conversation!</Text>
            </View>
          ) : (
            <ScrollView style={styles.messagesList} contentContainerStyle={styles.messagesContent}>
              {messages.map((msg, index) => {
                const isMine = msg.sender_id === (user?.id || user?._id);
                return (
                  <View 
                    key={msg.id || msg._id || index} 
                    style={[styles.messageBubble, isMine ? styles.myMessage : styles.theirMessage]}
                  >
                    <Text style={[styles.messageText, isMine && styles.myMessageText]}>
                      {msg.content}
                    </Text>
                    <Text style={[styles.messageTime, isMine && styles.myMessageTime]}>
                      {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Message Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Type a message..."
              placeholderTextColor={Colors.textMuted}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
            />
            <TouchableOpacity 
              style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!newMessage.trim() || sendingMessage}
            >
              {sendingMessage ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { color: Colors.textMuted, marginTop: 12 },
  
  // Header
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingTop: 50, 
    paddingBottom: 16, 
    paddingHorizontal: 16,
    gap: 8,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: Colors.text },
  headerBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  
  // Search
  searchContainer: { paddingHorizontal: 12, paddingVertical: 10 },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: Colors.backgroundCard, 
    borderRadius: 10, 
    paddingHorizontal: 12, 
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, marginLeft: 8 },
  
  // Stats
  statsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginHorizontal: 12,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  
  // List
  listContent: { padding: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 60 },
  emptyText: { color: Colors.text, fontSize: 18, fontWeight: '600', marginTop: 16 },
  
  // Member Card
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  avatarContainer: { position: 'relative' },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  onlineIndicator: {
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
  memberInfo: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  memberStats: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  lastMessage: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  memberMeta: { alignItems: 'flex-end' },
  onlineText: { fontSize: 11, color: '#4CAF50', fontWeight: '500' },
  unreadBadge: {
    backgroundColor: Colors.primary,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  
  // Conversation
  conversationContainer: { flex: 1, backgroundColor: Colors.background },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  conversationHeaderInfo: { alignItems: 'center' },
  conversationName: { fontSize: 18, fontWeight: '700', color: Colors.text },
  conversationStatus: { fontSize: 12, color: '#4CAF50', marginTop: 2 },
  messagesLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesEmptyText: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 16 },
  messagesEmptySubtext: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
  messagesList: { flex: 1 },
  messagesContent: { padding: 16 },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.backgroundCard,
    borderBottomLeftRadius: 4,
  },
  messageText: { fontSize: 14, color: Colors.text },
  myMessageText: { color: '#fff' },
  messageTime: { fontSize: 10, color: Colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  myMessageTime: { color: 'rgba(255,255,255,0.7)' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  messageInput: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
});
