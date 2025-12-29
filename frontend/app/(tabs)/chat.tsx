import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import LanguageSelector from '../../src/components/LanguageSelector';

type Message = {
  id: string;
  sender_id: string;
  sender_name: string;
  type: 'text' | 'image' | 'voice' | 'track';
  content: string;
  timestamp: string;
  synced?: boolean;
  sent_from?: string;
};

type Contact = {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  unread: number;
  online?: boolean;
  dj_name?: string;
  producer_name?: string;
  city?: string;
  country?: string;
  last_seen?: string;
};

export default function ChatScreen() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [members, setMembers] = useState<Contact[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const membersPollingRef = useRef<NodeJS.Timeout | null>(null);

  const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL;

  useEffect(() => {
    fetchAllMembers();
    // Poll for member status updates every 30 seconds
    membersPollingRef.current = setInterval(() => {
      fetchAllMembers(true);
    }, 30000);
    
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (membersPollingRef.current) clearInterval(membersPollingRef.current);
      if (sound) sound.unloadAsync();
    };
  }, []);

  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact.id);
      // Poll for new messages every 5 seconds
      pollingRef.current = setInterval(() => {
        fetchMessages(selectedContact.id, true);
      }, 5000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedContact]);

  const fetchAllMembers = async (silent: boolean = false) => {
  try {
    if (!silent) setLoading(true);

    const extra = Constants.expoConfig?.extra as any;
    const appId: string | undefined = extra?.base44AppId;
    const apiKey: string | undefined = extra?.base44ApiKey;
    const configuredBase: string | undefined = extra?.base44ApiUrl;

    const bases = [
      configuredBase,
      'https://app.base44.com/api/apps',
      'https://api.base44.com/v1/apps',
    ].filter(Boolean) as string[];

    if (!appId || !apiKey) {
      console.warn('[Chat] Missing Base44 appId/apiKey');
      setMembers([]);
      setContacts([]);
      return;
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'x-api-key': apiKey,
      Accept: 'application/json',
    } as any;

    let responseData: any = null;
    let lastErr: any = null;

    for (const base of bases) {
      try {
        const url = `${base}/${appId}/entities/User?limit=500`;
        const resp = await axios.get(url, { headers, timeout: 15000 });
        responseData = resp.data;
        lastErr = null;
        break;
      } catch (e: any) {
        lastErr = e;
      }
    }

    if (lastErr || !responseData) {
      // Don't block the app if members can't load (common during auth setup)
      console.warn('[Chat] Could not load members:', lastErr?.message || lastErr);
      setMembers([]);
      setContacts([]);
      return;
    }

    const data = responseData?.data?.data || responseData?.data || responseData?.items || responseData || [];
    const list = Array.isArray(data) ? data : [];

    const allMembers: Contact[] = list.map((m: any) => ({
      id: m.id || m.user_id || m._id,
      name: m.name || m.username || m.displayName || 'Member',
      avatar: m.avatar || m.avatar_url || m.image_url || '',
      online: !!m.online,
      unread: 0,
    })).filter((m: any) => m.id && m.id !== user?.id);

    // Sort: online first, then by name
    allMembers.sort((a, b) => {
      if (a.online && !b.online) return -1;
      if (!a.online && b.online) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    setMembers(allMembers);
    setContacts(allMembers);
  } catch (error: any) {
    console.warn('[Chat] Error fetching members:', error?.message || error);
    setMembers([]);
    setContacts([]);
  } finally {
    if (!silent) setLoading(false);
  }
};
  // Filter members based on search
  const filteredMembers = searchQuery
    ? members.filter(m => 
        (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.dj_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.producer_name || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : members;

  // Count online members
  const onlineCount = members.filter(m => m.online).length;

  const fetchMessages = async (contactId: string, silent: boolean = false) => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/chat/messages`,
        {
          params: { 
            user_id: user?.id || 'me',
            contact_id: contactId,
            limit: 100
          },
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
      
      if (response.data.success) {
        setMessages(response.data.messages || []);
        if (!silent) {
          setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || sending) return;
    
    setSending(true);
    const tempId = Date.now().toString();
    const tempMessage: Message = {
      id: tempId,
      sender_id: user?.id || 'me',
      sender_name: user?.full_name || 'Me',
      type: 'text',
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
      synced: false
    };
    
    // Optimistic update
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    flatListRef.current?.scrollToEnd();
    
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/chat/send`,
        {
          sender_id: user?.id || 'me',
          sender_name: user?.full_name || 'Me',
          recipient_id: selectedContact.id,
          type: 'text',
          content: tempMessage.content
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      
      if (response.data.success) {
        // Update with real message
        setMessages(prev => 
          prev.map(m => m.id === tempId ? { ...response.data.message, synced: response.data.synced } : m)
        );
      }
    } catch (error) {
      console.error('Send message error:', error);
      Alert.alert('Error', 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0] && selectedContact) {
      setSending(true);
      
      const tempMessage: Message = {
        id: Date.now().toString(),
        sender_id: user?.id || 'me',
        sender_name: user?.full_name || 'Me',
        type: 'image',
        content: result.assets[0].uri,
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, tempMessage]);
      
      try {
        await axios.post(
          `${BACKEND_URL}/api/chat/send`,
          {
            sender_id: user?.id || 'me',
            sender_name: user?.full_name || 'Me',
            recipient_id: selectedContact.id,
            type: 'image',
            content: result.assets[0].base64 ? `data:image/jpeg;base64,${result.assets[0].base64}` : result.assets[0].uri
          },
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
      } catch (error) {
        console.error('Send image error:', error);
      } finally {
        setSending(false);
      }
    }
  };

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone access is needed for voice notes');
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(newRecording);
      setIsRecording(true);
    } catch (e) {
      console.error('Failed to start recording', e);
    }
  };

  const stopRecording = async () => {
    if (!recording || !selectedContact) return;
    
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);
      
      if (uri) {
        setSending(true);
        
        const tempMessage: Message = {
          id: Date.now().toString(),
          sender_id: user?.id || 'me',
          sender_name: user?.full_name || 'Me',
          type: 'voice',
          content: uri,
          timestamp: new Date().toISOString(),
        };
        
        setMessages(prev => [...prev, tempMessage]);
        
        // Upload voice note
        const formData = new FormData();
        formData.append('audio', {
          uri: uri,
          name: 'voice.m4a',
          type: 'audio/m4a',
        } as any);
        formData.append('sender_id', user?.id || 'me');
        formData.append('recipient_id', selectedContact.id);
        
        try {
          const uploadResponse = await axios.post(
            `${BACKEND_URL}/api/chat/upload-voice`,
            formData,
            { 
              headers: { 
                'Content-Type': 'multipart/form-data',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              }
            }
          );
          
          if (uploadResponse.data.success) {
            // Send the voice message
            await axios.post(
              `${BACKEND_URL}/api/chat/send`,
              {
                sender_id: user?.id || 'me',
                sender_name: user?.full_name || 'Me',
                recipient_id: selectedContact.id,
                type: 'voice',
                content: uploadResponse.data.url
              },
              { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );
          }
        } catch (error) {
          console.error('Upload voice error:', error);
        } finally {
          setSending(false);
        }
      }
    } catch (e) {
      console.error('Failed to stop recording', e);
      setIsRecording(false);
    }
  };

  const playVoiceMessage = async (voiceUrl: string, messageId: string) => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }
      
      if (playingVoice === messageId) {
        setPlayingVoice(null);
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: voiceUrl },
        { shouldPlay: true }
      );
      setSound(newSound);
      setPlayingVoice(messageId);
      
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingVoice(null);
        }
      });
    } catch (error) {
      console.error('Play voice error:', error);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === (user?.id || 'me');
    
    return (
      <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
        <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
          {item.type === 'text' && (
            <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{item.content}</Text>
          )}
          {item.type === 'image' && (
            <Image source={{ uri: item.content }} style={styles.messageImage} />
          )}
          {item.type === 'voice' && (
            <TouchableOpacity 
              style={styles.voiceMessage} 
              onPress={() => playVoiceMessage(item.content, item.id)}
            >
              <Ionicons name="mic" size={20} color={isMe ? '#fff' : Colors.primary} />
              <View style={styles.voiceWave}>
                {[...Array(12)].map((_, i) => (
                  <View key={i} style={[styles.voiceBar, { height: Math.random() * 16 + 4 }]} />
                ))}
              </View>
              <Ionicons 
                name={playingVoice === item.id ? "pause" : "play"} 
                size={20} 
                color={isMe ? '#fff' : Colors.primary} 
              />
            </TouchableOpacity>
          )}
          {item.type === 'track' && (
            <View style={styles.trackMessage}>
              <Ionicons name="musical-note" size={20} color={isMe ? '#fff' : Colors.primary} />
              <Text style={[styles.voiceText, isMe && styles.voiceTextMe]}>Shared a track</Text>
            </View>
          )}
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMe && item.synced !== undefined && (
              <Ionicons 
                name={item.synced ? "checkmark-done" : "checkmark"} 
                size={14} 
                color={item.synced ? '#00C853' : 'rgba(255,255,255,0.5)'} 
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderContact = (contact: Contact) => (
    <TouchableOpacity
      key={contact.id}
      style={[styles.contactItem, selectedContact?.id === contact.id && styles.contactItemActive]}
      onPress={() => setSelectedContact(contact)}
    >
      <View style={styles.contactAvatar}>
        <Text style={styles.contactInitial}>{contact.name.charAt(0)}</Text>
        {contact.online && <View style={styles.onlineIndicator} />}
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{contact.name}</Text>
        <Text style={styles.contactLastMsg} numberOfLines={1}>{contact.lastMessage}</Text>
      </View>
      {contact.unread > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{contact.unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  if (!selectedContact) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Messages</Text>
              <Text style={styles.headerSubtitle}>
                {members.length} membres • {onlineCount} en ligne
              </Text>
            </View>
            <LanguageSelector />
          </View>
          <View style={styles.syncIndicator}>
            <Ionicons name="sync" size={14} color={Colors.primary} />
            <Text style={styles.syncText}>Synced with spynners.com</Text>
          </View>
          
          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search members..."
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView style={styles.contactsList}>
          {filteredMembers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={64} color={Colors.border} />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No members found' : 'No members available'}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery 
                  ? 'Try a different search term'
                  : 'Members will appear here once they join SPYNNERS'}
              </Text>
            </View>
          ) : (
            <>
              {/* Online Members Section */}
              {onlineCount > 0 && !searchQuery && (
                <View style={styles.sectionHeader}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.sectionTitle}>Online ({onlineCount})</Text>
                </View>
              )}
              {filteredMembers.filter(m => m.online).map(renderContact)}
              
              {/* Offline Members Section */}
              {!searchQuery && filteredMembers.some(m => !m.online) && (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>All Members ({filteredMembers.filter(m => !m.online).length})</Text>
                </View>
              )}
              {filteredMembers.filter(m => !m.online).map(renderContact)}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={() => setSelectedContact(null)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderName}>{selectedContact.name}</Text>
          <View style={styles.chatHeaderStatus}>
            <Ionicons name="sync" size={10} color="#00C853" />
            <Text style={styles.chatHeaderStatusText}>Synced</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerAction}>
          <Ionicons name="musical-note" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.inputAction} onPress={pickImage}>
          <Ionicons name="image" size={24} color={Colors.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.inputAction, isRecording && styles.inputActionRecording]}
          onPressIn={startRecording}
          onPressOut={stopRecording}
        >
          <Ionicons name="mic" size={24} color={isRecording ? '#fff' : Colors.primary} />
        </TouchableOpacity>
        
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor={Colors.textMuted}
          multiline
        />
        
        <TouchableOpacity 
          style={[styles.sendButton, sending && styles.sendButtonDisabled]} 
          onPress={sendMessage}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={22} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: Spacing.md, color: Colors.textSecondary },
  header: { padding: Spacing.lg, paddingTop: 30, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.borderAccent },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: Colors.primary },
  headerSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  syncIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  syncText: { fontSize: 11, color: Colors.primary },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: Colors.backgroundInput, 
    borderRadius: BorderRadius.md, 
    paddingHorizontal: Spacing.md, 
    marginTop: Spacing.md,
    height: 44,
  },
  searchInput: { 
    flex: 1, 
    fontSize: 15, 
    color: Colors.text, 
    marginLeft: Spacing.sm,
    paddingVertical: 10,
  },
  sectionHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: Spacing.md, 
    paddingVertical: Spacing.sm, 
    backgroundColor: Colors.backgroundCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  sectionTitle: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: Colors.textSecondary, 
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  onlineDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#00C853',
  },
  contactsList: { flex: 1 },
  contactItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  contactItemActive: { backgroundColor: Colors.primary + '15' },
  contactAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  contactInitial: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  onlineIndicator: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#00C853', borderWidth: 2, borderColor: Colors.backgroundCard },
  contactInfo: { flex: 1, marginLeft: Spacing.md },
  contactName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  contactLastMsg: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  unreadBadge: { backgroundColor: Colors.primary, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  unreadText: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, paddingTop: 30, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backButton: { padding: 8 },
  chatHeaderInfo: { flex: 1, marginLeft: Spacing.sm },
  chatHeaderName: { fontSize: 18, fontWeight: '600', color: Colors.text },
  chatHeaderStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  chatHeaderStatusText: { fontSize: 11, color: '#00C853' },
  headerAction: { padding: 8 },
  messagesList: { flex: 1 },
  messagesContent: { padding: Spacing.md },
  messageRow: { marginBottom: Spacing.sm },
  messageRowMe: { alignItems: 'flex-end' },
  messageBubble: { maxWidth: '80%', padding: Spacing.md, borderRadius: BorderRadius.md },
  messageBubbleMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  messageBubbleOther: { backgroundColor: Colors.backgroundCard, borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, color: Colors.text },
  messageTextMe: { color: '#fff' },
  messageImage: { width: 200, height: 150, borderRadius: BorderRadius.sm },
  voiceMessage: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 150 },
  voiceWave: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  voiceBar: { width: 3, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 2 },
  voiceText: { fontSize: 14, color: Colors.text },
  voiceTextMe: { color: '#fff' },
  trackMessage: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  messageTime: { fontSize: 10, color: Colors.textMuted },
  messageTimeMe: { color: 'rgba(255,255,255,0.7)' },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: Spacing.sm, backgroundColor: Colors.backgroundCard, borderTopWidth: 1, borderTopColor: Colors.border, gap: 8 },
  inputAction: { padding: 10, borderRadius: 20, backgroundColor: Colors.backgroundInput },
  inputActionRecording: { backgroundColor: '#E53935' },
  textInput: { flex: 1, backgroundColor: Colors.backgroundInput, borderRadius: 20, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 15, color: Colors.text, maxHeight: 100 },
  sendButton: { backgroundColor: Colors.primary, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.6 },
  emptyState: { alignItems: 'center', padding: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: Spacing.md },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
});
