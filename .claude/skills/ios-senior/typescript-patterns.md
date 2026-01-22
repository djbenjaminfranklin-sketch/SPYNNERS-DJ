---
name: typescript-patterns
description: Patterns TypeScript avances pour React Native
globs: ["**/*.ts", "**/*.tsx"]
---

# TypeScript Patterns - SPYNNERS

## Configuration Stricte

### tsconfig.json
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

## Patterns de Typage

### 1. Props de Composants

```typescript
// Interface explicite
interface TrackCardProps {
  track: Track;
  onPress: (track: Track) => void;
  isPlaying?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Avec children
interface ContainerProps {
  children: React.ReactNode;
  padding?: keyof typeof Spacing;
}

// Props polymorphiques
interface ButtonProps<T extends ElementType = 'button'> {
  as?: T;
  variant: 'primary' | 'secondary' | 'ghost';
}
type PolymorphicButtonProps<T extends ElementType> = ButtonProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof ButtonProps>;
```

### 2. Hooks Personnalises

```typescript
// Hook avec retour type
function useTrack(trackId: string): {
  track: Track | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Implementation...

  return { track, loading, error, refetch };
}

// Hook generique
function useFetch<T>(url: string): {
  data: T | null;
  loading: boolean;
  error: Error | null;
} {
  // Implementation...
}
```

### 3. Context Type-Safe

```typescript
// Types du context
interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  playTrack: (track: Track, trackList?: Track[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
}

// Context avec valeur par defaut null
const PlayerContext = createContext<PlayerContextType | null>(null);

// Hook avec guard
function usePlayer(): PlayerContextType {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return context;
}
```

### 4. API Types

```typescript
// Response types
interface APIResponse<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    perPage: number;
  };
}

// Error type
interface APIError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

// Service functions
async function fetchTracks(
  filters?: TrackFilters
): Promise<APIResponse<Track[]>> {
  const response = await fetch(/* ... */);
  if (!response.ok) {
    const error: APIError = await response.json();
    throw new Error(error.message);
  }
  return response.json();
}
```

### 5. Discriminated Unions

```typescript
// Etats de chargement
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

// Usage
function TrackList() {
  const [state, setState] = useState<AsyncState<Track[]>>({ status: 'idle' });

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <Error message={state.error.message} />;
  if (state.status === 'success') return <List data={state.data} />;
  return null;
}
```

### 6. Utility Types

```typescript
// Partial pour updates
type TrackUpdate = Partial<Omit<Track, 'id' | 'createdAt'>>;

// Required pour creation
type CreateTrack = Required<Pick<Track, 'title' | 'artist' | 'audioUrl'>>;

// Record pour maps
type GenreColorMap = Record<Genre, string>;

// Extract pour enums
type TrackStatus = Track['status']; // 'approved' | 'pending' | 'rejected'
```

### 7. Type Guards

```typescript
// Type guard function
function isTrack(item: unknown): item is Track {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    'title' in item &&
    'audioUrl' in item
  );
}

// Usage
const data = await fetchData();
if (isTrack(data)) {
  playTrack(data); // TypeScript sait que c'est un Track
}

// Assertion function
function assertTrack(item: unknown): asserts item is Track {
  if (!isTrack(item)) {
    throw new Error('Invalid track data');
  }
}
```

### 8. Generic Components

```typescript
// Liste generique
interface ListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  onItemPress?: (item: T) => void;
}

function List<T>({ items, renderItem, keyExtractor, onItemPress }: ListProps<T>) {
  return (
    <FlatList
      data={items}
      renderItem={({ item, index }) => (
        <TouchableOpacity onPress={() => onItemPress?.(item)}>
          {renderItem(item, index)}
        </TouchableOpacity>
      )}
      keyExtractor={keyExtractor}
    />
  );
}

// Usage
<List<Track>
  items={tracks}
  renderItem={(track) => <TrackCard track={track} />}
  keyExtractor={(track) => track.id}
  onItemPress={playTrack}
/>
```

## Anti-Patterns a Eviter

```typescript
// MAUVAIS: any
const data: any = await fetch();

// BON: Type explicite ou unknown
const data: unknown = await fetch();
if (isTrack(data)) { /* ... */ }

// MAUVAIS: as casting abusif
const track = data as Track;

// BON: Validation avant usage
const track = validateTrack(data);

// MAUVAIS: ! non-null assertion
const user = context.user!;

// BON: Guard ou optional chaining
const user = context.user;
if (!user) return null;
```
