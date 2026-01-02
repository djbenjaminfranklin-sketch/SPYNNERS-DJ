import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { base44Notifications2, base44Messages, Notification, Message } from '../services/base44Api';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

interface NotificationCategory {
  type: string;
  label: string;
  icon: string;
  color: string;
  count: number;
  route?: string;
}

export default function NotificationModal({ visible, onClose }: NotificationModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [categories, setCategories] = useState<NotificationCategory[]>([]);

  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible, user]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const userId = user?.id || user?._id || '';
      
      if (!userId) {
        setLoading(false);
        return;
      }

      // Load notifications from Base44
      const notifs = await base44Notifications2.getUnread(userId);
      setNotifications(notifs);
      
      // Load unread messages count
      const messages = await base44Messages.list({ receiver_id: userId, read: false });
      setUnreadMessages(messages.length);
      
      // Categorize notifications
      const categoryCounts: Record<string, number> = {
        track_received: 0,
        message: messages.length,
        track_played: 0,
        download: 0,
        follow: 0,
        vip: 0,
        system: 0,
      };
      
      notifs.forEach((n: Notification) => {
        const type = n.type || 'system';
        if (categoryCounts[type] !== undefined) {
          categoryCounts[type]++;
        } else {
          categoryCounts['system']++;
        }
      });
      
      // Build categories array
      const cats: NotificationCategory[] = [
        {
          type: 'track_received',
          label: 'Tracks Received',
          icon: 'mail',
          color: '#2196F3',
          count: categoryCounts.track_received,
          route: '/(tabs)/received',
        },
        {
          type: 'message',
          label: 'Chat Messages',
          icon: 'chatbubbles',
          color: '#673AB7',
          count: categoryCounts.message,
          route: '/(tabs)/chat',
        },
        {
          type: 'track_played',
          label: 'Track Plays',
          icon: 'play-circle',
          color: '#4CAF50',
          count: categoryCounts.track_played,
          route: '/profile/radar',
        },
        {
          type: 'download',
          label: 'Downloads',
          icon: 'download',
          color: '#FF9800',
          count: categoryCounts.download,
          route: '/profile/analytics',
        },
        {
          type: 'vip',
          label: 'VIP Alerts',
          icon: 'diamond',
          color: '#7C4DFF',
          count: categoryCounts.vip,
          route: '/profile/vip',
        },
        {
          type: 'system',
          label: 'System',
          icon: 'notifications',
          color: Colors.textMuted,
          count: categoryCounts.system,
        },
      ];
      
      setCategories(cats);
    } catch (error) {
      console.error('[Notifications] Error loading:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleCategoryPress = (category: NotificationCategory) => {
    if (category.route) {
      onClose();
      router.push(category.route as any);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const userId = user?.id || user?._id || '';
      if (userId) {
        await base44Notifications2.markAllAsRead(userId);
        loadNotifications();
      }
    } catch (error) {
      console.error('[Notifications] Error marking all as read:', error);
    }
  };

  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="notifications" size={24} color={Colors.primary} />
              <Text style={styles.headerTitle}>Notifications</Text>
              {totalCount > 0 && (
                <View style={styles.totalBadge}>
                  <Text style={styles.totalBadgeText}>{totalCount}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Mark All Read Button */}
          {totalCount > 0 && (
            <TouchableOpacity style={styles.markAllButton} onPress={handleMarkAllRead}>
              <Ionicons name="checkmark-done" size={18} color={Colors.primary} />
              <Text style={styles.markAllText}>Mark all as read</Text>
            </TouchableOpacity>
          )}

          {/* Categories */}
          <ScrollView
            style={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
            }
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Loading notifications...</Text>
              </View>
            ) : (
              <>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.type}
                    style={[
                      styles.categoryCard,
                      category.count > 0 && styles.categoryCardActive,
                    ]}
                    onPress={() => handleCategoryPress(category)}
                    disabled={!category.route}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                      <Ionicons name={category.icon as any} size={24} color={category.color} />
                    </View>
                    
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryLabel}>{category.label}</Text>
                      <Text style={styles.categoryCount}>
                        {category.count} {category.count === 1 ? 'notification' : 'notifications'}
                      </Text>
                    </View>
                    
                    {category.count > 0 && (
                      <View style={[styles.countBadge, { backgroundColor: category.color }]}>
                        <Text style={styles.countBadgeText}>{category.count}</Text>
                      </View>
                    )}
                    
                    {category.route && (
                      <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                    )}
                  </TouchableOpacity>
                ))}

                {/* Recent Notifications */}
                {notifications.length > 0 && (
                  <View style={styles.recentSection}>
                    <Text style={styles.recentTitle}>Recent</Text>
                    {notifications.slice(0, 5).map((notif, index) => (
                      <View key={notif.id || notif._id || index} style={styles.notifItem}>
                        <View style={styles.notifDot} />
                        <View style={styles.notifContent}>
                          <Text style={styles.notifMessage} numberOfLines={2}>
                            {notif.message}
                          </Text>
                          <Text style={styles.notifTime}>
                            {notif.created_at 
                              ? new Date(notif.created_at).toLocaleDateString() 
                              : 'Recently'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {totalCount === 0 && !loading && (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="notifications-off-outline" size={60} color={Colors.textMuted} />
                    <Text style={styles.emptyText}>No new notifications</Text>
                    <Text style={styles.emptySubtext}>You're all caught up!</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  totalBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  totalBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  markAllText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textMuted,
    marginTop: 12,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  categoryCardActive: {
    borderColor: Colors.primary,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryCount: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  countBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  recentSection: {
    marginTop: 20,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 6,
  },
  notifContent: {
    flex: 1,
  },
  notifMessage: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  notifTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
