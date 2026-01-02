import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/contexts/AuthContext';
import { LanguageProvider } from '../src/contexts/LanguageContext';
import { PlayerProvider } from '../src/contexts/PlayerContext';
import GlobalPlayer from '../src/components/GlobalPlayer';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LanguageProvider>
        <AuthProvider>
          <PlayerProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
            <GlobalPlayer />
          </PlayerProvider>
        </AuthProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );
}