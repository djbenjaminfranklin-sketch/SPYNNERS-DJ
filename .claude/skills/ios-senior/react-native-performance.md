---
name: react-native-performance
description: Optimisation performance React Native pour SPYNNERS
globs: ["**/*.tsx", "**/*.ts"]
---

# Performance React Native - SPYNNERS

## Regles d'Optimisation

### 1. Memo et Callbacks

```typescript
import { memo, useCallback, useMemo } from 'react';

// Composant memo pour eviter re-renders
export const TrackCard = memo<TrackCardProps>(({ track, onPress }) => {
  return (
    <TouchableOpacity onPress={() => onPress(track)}>
      {/* ... */}
    </TouchableOpacity>
  );
});

// useCallback pour fonctions stables
const handlePress = useCallback((track: Track) => {
  playTrack(track);
}, [playTrack]);

// useMemo pour calculs couteux
const sortedTracks = useMemo(() => {
  return tracks.slice().sort((a, b) => b.rating - a.rating);
}, [tracks]);
```

### 2. FlatList Optimisee

```typescript
<FlatList
  data={tracks}
  renderItem={renderTrackItem}
  keyExtractor={(item) => item.id}
  // Performance critical
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={5}
  initialNumToRender={10}
  updateCellsBatchingPeriod={50}
  // Optimisation memoire
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

### 3. Images Optimisees

```typescript
import { Image } from 'expo-image';

// Utiliser expo-image au lieu de react-native Image
<Image
  source={{ uri: track.artworkUrl }}
  style={styles.artwork}
  contentFit="cover"
  placeholder={blurhash}
  transition={200}
  cachePolicy="memory-disk"
/>

// Precharger images critiques
Image.prefetch([
  track1.artworkUrl,
  track2.artworkUrl,
]);
```

### 4. Animations Performantes

```typescript
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';

// Tout sur le UI thread
const scale = useSharedValue(1);

const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: scale.value }],
}));

// Eviter: style={{ opacity: animatedValue }}
// Utiliser: animatedStyle avec useAnimatedStyle
```

### 5. Eviter les Re-renders

```typescript
// MAUVAIS: Objet inline recree a chaque render
<View style={{ marginTop: 10 }} />

// BON: Style stable
const styles = StyleSheet.create({
  container: { marginTop: 10 },
});
<View style={styles.container} />

// MAUVAIS: Fonction inline
<Button onPress={() => handlePress(item)} />

// BON: Callback memoise ou ref
const handlePress = useCallback(() => {
  doSomething(item);
}, [item]);
```

### 6. Context Optimization

```typescript
// Diviser les contexts par frequence de mise a jour
const PlayerStateContext = createContext<PlayerState>(null);
const PlayerActionsContext = createContext<PlayerActions>(null);

// Les actions changent rarement, l'etat souvent
export function usePlayerActions() {
  return useContext(PlayerActionsContext);
}

export function usePlayerState() {
  return useContext(PlayerStateContext);
}

// Composants qui n'ont besoin que des actions ne re-render pas
```

### 7. Lazy Loading Components

```typescript
import { lazy, Suspense } from 'react';

// Charger les composants lourds a la demande
const HeavyWaveform = lazy(() => import('./HeavyWaveform'));

function Player() {
  return (
    <Suspense fallback={<WaveformSkeleton />}>
      <HeavyWaveform />
    </Suspense>
  );
}
```

### 8. Debounce et Throttle

```typescript
import { useDebouncedCallback } from 'use-debounce';

// Pour les recherches
const debouncedSearch = useDebouncedCallback(
  (query: string) => {
    searchTracks(query);
  },
  300
);

// Pour les events frequents (scroll, resize)
const throttledUpdate = useThrottledCallback(
  (position: number) => {
    updateProgress(position);
  },
  100
);
```

## Checklist Performance

- [ ] Composants avec `memo` si props stables
- [ ] `useCallback` pour fonctions passees en props
- [ ] `useMemo` pour calculs > O(n)
- [ ] FlatList avec `getItemLayout` si taille fixe
- [ ] Pas de fonctions/objets inline dans JSX
- [ ] Images avec expo-image et cache
- [ ] Animations sur UI thread (Reanimated)
- [ ] Profiler React DevTools en dev
