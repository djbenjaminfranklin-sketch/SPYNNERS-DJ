import { Stack } from 'expo-router';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/contexts/AuthContext';
import { LanguageProvider, useLanguage } from '../src/contexts/LanguageContext';
import { PlayerProvider } from '../src/contexts/PlayerContext';
import GlobalPlayer from '../src/components/GlobalPlayer';

// Inner component that uses language context to force re-render
function AppContent() {
  const { language } = useLanguage();
  
  return (
    <AuthProvider>
      <PlayerProvider>
        <Stack 
          key={`stack-${language}`} 
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        <GlobalPlayer />
      </PlayerProvider>
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