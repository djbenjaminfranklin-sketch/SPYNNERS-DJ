/**
 * Notification Context for SPYNNERS
 * Manages push notifications state and provides hooks for components
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  registerForPushNotificationsAsync,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  removeNotificationSubscription,
  setBadgeCount,
  clearBadge,
} from '../services/notificationService';
import { base44PushNotifications, base44Notifications2 } from '../services/base44Api';

interface NotificationContextType {
  pushToken: string | null;
  unreadCount: number;
  isRegistered: boolean;
  registerNotifications: (userId: string) => Promise<boolean>;
  refreshUnreadCount: (userId: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
  lastNotification: Notifications.Notification | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRegistered, setIsRegistered] = useState(false);
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null);
  
  // Refs for listeners
  const notificationReceivedListener = useRef<Notifications.Subscription | null>(null);
  const notificationResponseListener = useRef<Notifications.Subscription | null>(null);
  const appStateListener = useRef<any>(null);
  const currentUserId = useRef<string | null>(null);

  // Register for push notifications
  const registerNotifications = useCallback(async (userId: string): Promise<boolean> => {
    try {
      console.log('[NotificationContext] Registering notifications for user:', userId);
      currentUserId.current = userId;
      
      // Get push token
      const token = await registerForPushNotificationsAsync();
      
      if (token) {
        setPushToken(token);
        
        // Register token with backend
        const success = await base44PushNotifications.registerPushToken(userId, token);
        
        if (success) {
          setIsRegistered(true);
          console.log('[NotificationContext] ✅ Push notifications registered successfully');
          
          // Initial fetch of unread count
          await refreshUnreadCount(userId);
          
          return true;
        }
      }
      
      console.log('[NotificationContext] ⚠️ Could not register push notifications');
      return false;
    } catch (error) {
      console.error('[NotificationContext] Registration error:', error);
      return false;
    }
  }, []);

  // Refresh unread notification count
  const refreshUnreadCount = useCallback(async (userId: string): Promise<void> => {
    try {
      if (!userId) return;
      
      const count = await base44Notifications2.getUnreadCount(userId);
      setUnreadCount(count);
      
      // Update app badge
      if (Platform.OS !== 'web') {
        await setBadgeCount(count);
      }
      
      console.log('[NotificationContext] Unread count:', count);
    } catch (error) {
      console.log('[NotificationContext] Could not refresh unread count');
    }
  }, []);

  // Clear all notifications
  const clearNotifications = useCallback(async (): Promise<void> => {
    try {
      setUnreadCount(0);
      await clearBadge();
      
      if (currentUserId.current) {
        await base44Notifications2.markAllAsRead(currentUserId.current);
      }
      
      console.log('[NotificationContext] Notifications cleared');
    } catch (error) {
      console.error('[NotificationContext] Error clearing notifications:', error);
    }
  }, []);

  // Handle received notification (app in foreground)
  const handleNotificationReceived = useCallback((notification: Notifications.Notification) => {
    console.log('[NotificationContext] 🔔 Notification received:', notification.request.content.title);
    setLastNotification(notification);
    
    // Increment unread count
    setUnreadCount(prev => prev + 1);
    
    // Update badge
    if (Platform.OS !== 'web') {
      setBadgeCount(unreadCount + 1);
    }
  }, [unreadCount]);

  // Handle notification tap (user interaction)
  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    console.log('[NotificationContext] 📱 Notification tapped');
    
    const data = response.notification.request.content.data;
    
    // Navigate based on notification type
    if (data?.type === 'message') {
      router.push('/(tabs)/chat');
    } else if (data?.type === 'track' || data?.type === 'track_send') {
      router.push('/(tabs)/received');
    } else if (data?.type === 'diamond') {
      router.push('/profile/diamonds');
    } else {
      // Default: go to home
      router.push('/(tabs)/home');
    }
  }, [router]);

  // Set up notification listeners
  useEffect(() => {
    // Notification received listener (foreground)
    notificationReceivedListener.current = addNotificationReceivedListener(handleNotificationReceived);
    
    // Notification response listener (tap)
    notificationResponseListener.current = addNotificationResponseReceivedListener(handleNotificationResponse);
    
    // App state listener - refresh when app comes to foreground
    appStateListener.current = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && currentUserId.current) {
        console.log('[NotificationContext] App became active, refreshing notifications');
        refreshUnreadCount(currentUserId.current);
      }
    });

    return () => {
      if (notificationReceivedListener.current) {
        removeNotificationSubscription(notificationReceivedListener.current);
      }
      if (notificationResponseListener.current) {
        removeNotificationSubscription(notificationResponseListener.current);
      }
      if (appStateListener.current) {
        appStateListener.current.remove();
      }
    };
  }, [handleNotificationReceived, handleNotificationResponse, refreshUnreadCount]);

  // Set up periodic refresh of unread count
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentUserId.current) {
        refreshUnreadCount(currentUserId.current);
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  const value: NotificationContextType = {
    pushToken,
    unreadCount,
    isRegistered,
    registerNotifications,
    refreshUnreadCount,
    clearNotifications,
    lastNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export default NotificationContext;
