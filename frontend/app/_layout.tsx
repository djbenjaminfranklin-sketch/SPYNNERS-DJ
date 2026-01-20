// IMPORTANT: Polyfill for crypto must be first import
import 'react-native-get-random-values';

// IMPORTANT: Register TrackPlayer service for iOS lock screen controls
// This MUST be done before any React code runs
import TrackPlayer from 'react-native-track-player';
import { PlaybackService, setupPlayer } from '../src/services/trackPlayerService';

// Register the playback service (handles remote control events)
TrackPlayer.registerPlaybackService(() => PlaybackService);

import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { View, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { LanguageProvider, useLanguage } from '../src/contexts/LanguageContext';
import { PlayerProvider } from '../src/contexts/PlayerContext';
import { NotificationProvider, useNotifications } from '../src/contexts/NotificationContext';
import GlobalPlayer from '../src/components/GlobalPlayer';
import FloatingLanguageButton from '../src/components/FloatingLanguageButton';

// Component that registers notifications when user logs in
function NotificationRegistrar() {
  const { user, token } = useAuth();
  const { registerNotifications, refreshUnreadCount } = useNotifications();

  useEffect(() => {
    // Register for push notifications when user logs in
    const setupNotifications = async () => {
      if (user && token) {
        const userId = user.id || user._id;
        if (userId) {
          console.log('[App] User logged in, registering notifications...');
          await registerNotifications(userId);
        }
      }
    };

    setupNotifications();
  }, [user, token, registerNotifications]);

  // Refresh unread count periodically
  useEffect(() => {
    if (user) {
      const userId = user.id || user._id;
      if (userId) {
        // Initial refresh
        refreshUnreadCount(userId);
        
        // Set up interval
        const interval = setInterval(() => {
          refreshUnreadCount(userId);
        }, 30000); // Every 30 seconds

        return () => clearInterval(interval);
      }
    }
  }, [user, refreshUnreadCount]);

  return null; // This component doesn't render anything
}

// Inner component that uses language context to force re-render
function AppContent() {
  const { language } = useLanguage();
  
  // Initialize TrackPlayer on iOS
  useEffect(() => {
    if (Platform.OS === 'ios') {
      setupPlayer().then(success => {
        if (success) {
          console.log('[App] TrackPlayer initialized for lock screen controls');
        }
      }).catch(err => {
        console.log('[App] TrackPlayer setup failed (non-fatal):', err);
      });
    }
  }, []);
  
  return (
    <AuthProvider>
      <NotificationProvider>
        <PlayerProvider>
          <View style={{ flex: 1 }}>
            {/* Register notifications when user is available */}
            <NotificationRegistrar />
            
            <Stack 
              key={`stack-${language}`} 
              screenOptions={{ headerShown: false }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
            <FloatingLanguageButton />
            <GlobalPlayer />
          </View>
        </PlayerProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </GestureHandlerRootView>
  );
}
