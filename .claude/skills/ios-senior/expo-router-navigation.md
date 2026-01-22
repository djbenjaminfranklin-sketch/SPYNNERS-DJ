---
name: expo-router-navigation
description: Patterns avances de navigation avec Expo Router pour SPYNNERS
globs: ["**/app/**/*.tsx", "**/app/**/*.ts"]
---

# Navigation Expo Router - SPYNNERS

## Structure de Navigation

### Layout Principal
```
app/
├── _layout.tsx           # Root layout
├── (auth)/               # Stack auth (non connecte)
│   ├── _layout.tsx
│   ├── login.tsx
│   └── signup.tsx
├── (tabs)/               # Navigation principale
│   ├── _layout.tsx
│   ├── home.tsx
│   ├── library.tsx
│   ├── spyn.tsx
│   └── profile.tsx
├── profile/              # Stack profil
│   ├── edit.tsx
│   └── settings.tsx
└── track/[id].tsx        # Route dynamique
```

## Patterns de Navigation

### Typed Routes
```typescript
import { useRouter, useLocalSearchParams } from 'expo-router';

// Navigation typee
const router = useRouter();

// Naviguer vers une route
router.push('/track/123');
router.push({
  pathname: '/track/[id]',
  params: { id: '123' }
});

// Remplacer (pas de back)
router.replace('/(tabs)/home');

// Retour
router.back();
```

### Params Dynamiques
```typescript
// app/track/[id].tsx
export default function TrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // Utiliser l'ID pour charger le track
  const { track, loading } = useTrack(id);
}
```

### Deep Linking
```typescript
// app.json
{
  "expo": {
    "scheme": "spynners",
    "web": {
      "bundler": "metro"
    }
  }
}

// Liens supportes:
// spynners://track/123
// spynners://(tabs)/library
```

### Protected Routes
```typescript
// app/_layout.tsx
import { useAuth } from '@/src/contexts/AuthContext';
import { Redirect, Stack } from 'expo-router';

export default function RootLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="(auth)" />
      ) : (
        <Stack.Screen name="(tabs)" />
      )}
    </Stack>
  );
}
```

### Tab Navigator Customise
```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/src/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.backgroundCard,
          paddingTop: 8,
          height: 85,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="spyn"
        options={{
          title: 'SPYN',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="radio" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

### Modal et Stack
```typescript
// Presentation modale
<Stack.Screen
  name="track/[id]"
  options={{
    presentation: 'modal',
    animation: 'slide_from_bottom',
  }}
/>

// Presentation transparente
<Stack.Screen
  name="player"
  options={{
    presentation: 'transparentModal',
    animation: 'fade',
  }}
/>
```

### Navigation State Persistence
```typescript
import { useNavigationState } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Sauvegarder l'etat
const state = useNavigationState(state => state);
await AsyncStorage.setItem('NAV_STATE', JSON.stringify(state));

// Restaurer
const savedState = await AsyncStorage.getItem('NAV_STATE');
```

## Bonnes Pratiques

1. **Lazy Loading**: Expo Router charge les ecrans a la demande
2. **Type Safety**: Toujours typer les params avec `useLocalSearchParams<T>`
3. **Deep Links**: Tester tous les deep links avant release
4. **Gestures**: Respecter les gestures natives (swipe back iOS)
5. **State**: Ne pas stocker l'etat de navigation dans un context global
