/**
 * Push Notifications Hook
 * Handles registration and management of Expo Push Notifications
 */

import { useState, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { base44PushNotifications } from '../services/base44Api';

// NOTE: Notification handler is set up inside the hook to prevent iOS crashes

export interface PushNotificationState {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  isRegistering: boolean;
  error: string | null;
}

export function usePushNotifications(userId?: string) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Register for push notifications when userId is available
  useEffect(() => {
    if (userId) {
      registerForPushNotifications();
    }
    
    return () => {
      // Cleanup listeners on unmount
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [userId]);

  // Set up notification listeners
  useEffect(() => {
    // Listener for when notification is received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[Push] Notification received in foreground:', notification);
      setNotification(notification);
    });

    // Listener for when user taps on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[Push] Notification tapped:', response);
      // Handle navigation based on notification data
      const data = response.notification.request.content.data;
      handleNotificationTap(data);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  const handleNotificationTap = (data: any) => {
    console.log('[Push] Handling notification tap with data:', data);
    // Navigation logic can be added here
    // For example, navigate to chat when message notification is tapped
  };

  const registerForPushNotifications = async () => {
    if (isRegistering) return;
    
    try {
      setIsRegistering(true);
      setError(null);
      
      console.log('[Push] Starting push notification registration...');
      console.log('[Push] Platform:', Platform.OS);
      console.log('[Push] Is device:', Device.isDevice);
      
      // Check if running on a real device
      if (!Device.isDevice) {
        console.log('[Push] Must use physical device for Push Notifications');
        // Don't set error - just skip registration silently for simulator
        setIsRegistering(false);
        return;
      }

      // Get existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('[Push] Existing permission status:', existingStatus);
      
      let finalStatus = existingStatus;
      
      // Request permissions if not already granted
      if (existingStatus !== 'granted') {
        console.log('[Push] Requesting notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('[Push] Permission request result:', status);
      }
      
      if (finalStatus !== 'granted') {
        console.log('[Push] Permission not granted');
        setError('Permission non accordée pour les notifications');
        setIsRegistering(false);
        return;
      }

      // Get the Expo push token
      console.log('[Push] Getting Expo push token...');
      
      // Get project ID for token registration
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || 
                       Constants.easConfig?.projectId ||
                       'ca33b30d-63f4-4a7e-a33a-9dee12dab85c'; // SPYNNERS project ID
      
      console.log('[Push] Project ID:', projectId);
      
      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      
      const token = tokenResponse.data;
      console.log('[Push] Got push token:', token);
      
      setExpoPushToken(token);
      
      // Register the token with Base44
      if (userId && token) {
        console.log('[Push] Registering token with Base44 for user:', userId);
        const success = await base44PushNotifications.registerPushToken(userId, token);
        if (success) {
          console.log('[Push] Token registered successfully with backend');
        } else {
          console.log('[Push] Failed to register token with backend');
        }
      }

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        console.log('[Push] Setting up Android notification channel...');
        await Notifications.setNotificationChannelAsync('messages', {
          name: 'Messages',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#9C27B0',
          sound: 'default',
          enableVibrate: true,
          enableLights: true,
        });
        
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#9C27B0',
          sound: 'default',
        });
        
        console.log('[Push] Android notification channels configured');
      }
      
      console.log('[Push] Push notification registration complete');
      
    } catch (err: any) {
      console.error('[Push] Error during registration:', err);
      setError(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setIsRegistering(false);
    }
  };

  // Function to schedule a local notification (for testing)
  const scheduleLocalNotification = async (title: string, body: string, data?: any) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
          data: data || {},
        },
        trigger: null, // Immediate
      });
      console.log('[Push] Local notification scheduled');
    } catch (err) {
      console.error('[Push] Error scheduling local notification:', err);
    }
  };

  // Unregister push token (call on logout)
  const unregisterPushToken = async () => {
    if (userId && expoPushToken) {
      console.log('[Push] Unregistering push token...');
      await base44PushNotifications.removePushToken(userId);
      setExpoPushToken(null);
    }
  };

  return {
    expoPushToken,
    notification,
    isRegistering,
    error,
    registerForPushNotifications,
    unregisterPushToken,
    scheduleLocalNotification,
  };
}

export default usePushNotifications;
