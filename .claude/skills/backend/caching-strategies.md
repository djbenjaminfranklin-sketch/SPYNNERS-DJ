---
name: caching-strategies
description: Strategies de cache pour SPYNNERS
globs: ["**/services/**/*", "**/cache/**/*"]
---

# Caching Strategies - SPYNNERS

## Architecture Cache

### Niveaux de Cache
```
┌─────────────────────────────────────────┐
│          Memory Cache (Map)             │  ← Plus rapide
│      TTL court, donnees frequentes      │
├─────────────────────────────────────────┤
│        AsyncStorage Cache               │  ← Persistant
│    TTL moyen, survit aux restarts       │
├─────────────────────────────────────────┤
│          File System Cache              │  ← Fichiers lourds
│     Audio, images haute resolution      │
├─────────────────────────────────────────┤
│             HTTP Cache                  │  ← Reseau
│         Headers Cache-Control           │
└─────────────────────────────────────────┘
```

## Memory Cache

### Implementation
```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize = 100;

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access count (for LRU)
    entry.accessCount++;

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs,
      accessCount: 1,
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern) || key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruCount = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < lruCount) {
        lruCount = entry.accessCount;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }
}

export const memoryCache = new MemoryCache();
```

### TTL par Type de Donnees
```typescript
export const CACHE_DURATIONS = {
  // Donnees frequemment mises a jour
  playerState: 0,               // Pas de cache
  notifications: 30 * 1000,     // 30 secondes

  // Donnees moderement dynamiques
  tracks: 5 * 60 * 1000,        // 5 minutes
  playlists: 5 * 60 * 1000,     // 5 minutes
  search: 2 * 60 * 1000,        // 2 minutes

  // Donnees stables
  userProfile: 15 * 60 * 1000,  // 15 minutes
  genres: 60 * 60 * 1000,       // 1 heure
  config: 24 * 60 * 60 * 1000,  // 24 heures
} as const;
```

## Persistent Cache (AsyncStorage)

### Implementation
```typescript
interface PersistentCacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: number;
}

const CACHE_VERSION = 1;
const CACHE_PREFIX = '@cache:';

export const persistentCache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;

      const entry: PersistentCacheEntry<T> = JSON.parse(raw);

      // Version check
      if (entry.version !== CACHE_VERSION) {
        await this.invalidate(key);
        return null;
      }

      // Expiration check
      if (Date.now() > entry.expiresAt) {
        await this.invalidate(key);
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    const entry: PersistentCacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs,
      version: CACHE_VERSION,
    };

    await AsyncStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify(entry)
    );
  },

  async invalidate(key: string): Promise<void> {
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
  },

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const matchingKeys = keys.filter(
      key => key.startsWith(CACHE_PREFIX) && key.includes(pattern)
    );
    await AsyncStorage.multiRemove(matchingKeys);
  },

  async clear(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  },

  async cleanup(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));

    for (const key of cacheKeys) {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        try {
          const entry = JSON.parse(raw);
          if (Date.now() > entry.expiresAt) {
            await AsyncStorage.removeItem(key);
          }
        } catch {
          await AsyncStorage.removeItem(key);
        }
      }
    }
  },
};
```

## Cache Images (expo-image)

### Configuration
```typescript
import { Image } from 'expo-image';

// Configuration globale
Image.prefetch([
  'https://example.com/default-artwork.jpg',
]);

// Usage dans composant
<Image
  source={{ uri: track.artworkUrl }}
  cachePolicy="memory-disk"  // Cache en memoire ET disque
  placeholder={require('@/assets/placeholder.png')}
  contentFit="cover"
  transition={200}
/>

// Precharger des images
async function prefetchArtworks(tracks: Track[]): Promise<void> {
  const urls = tracks
    .filter(t => t.artworkUrl)
    .map(t => t.artworkUrl!);

  await Image.prefetch(urls);
}
```

## Cache Audio Files

### Telechargement et Cache
```typescript
import * as FileSystem from 'expo-file-system';

const AUDIO_CACHE_DIR = `${FileSystem.cacheDirectory}audio/`;

export const audioCache = {
  async ensureDir(): Promise<void> {
    const info = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true });
    }
  },

  getCachePath(trackId: string): string {
    return `${AUDIO_CACHE_DIR}${trackId}.m4a`;
  },

  async isCached(trackId: string): Promise<boolean> {
    const path = this.getCachePath(trackId);
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
  },

  async cacheTrack(trackId: string, audioUrl: string): Promise<string> {
    await this.ensureDir();

    const cachePath = this.getCachePath(trackId);

    // Check if already cached
    if (await this.isCached(trackId)) {
      return cachePath;
    }

    // Download
    const downloadResult = await FileSystem.downloadAsync(
      audioUrl,
      cachePath
    );

    if (downloadResult.status !== 200) {
      throw new Error('Failed to cache audio');
    }

    return cachePath;
  },

  async getCachedUrl(trackId: string, originalUrl: string): Promise<string> {
    if (await this.isCached(trackId)) {
      return this.getCachePath(trackId);
    }
    return originalUrl;
  },

  async clearCache(): Promise<void> {
    await FileSystem.deleteAsync(AUDIO_CACHE_DIR, { idempotent: true });
    await this.ensureDir();
  },

  async getCacheSize(): Promise<number> {
    const info = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR, { size: true });
    return info.size || 0;
  },
};
```

## Stale-While-Revalidate

### Pattern SWR
```typescript
interface SWRResult<T> {
  data: T | null;
  isLoading: boolean;
  isStale: boolean;
  error: Error | null;
  mutate: () => Promise<void>;
}

function useSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = CACHE_DURATIONS.tracks
): SWRResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const fresh = await fetcher();
      setData(fresh);
      setError(null);

      // Update cache
      memoryCache.set(key, fresh, ttlMs);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fetch failed'));
    } finally {
      setIsLoading(false);
      setIsStale(false);
    }
  }, [key, fetcher, ttlMs]);

  useEffect(() => {
    // Try cache first
    const cached = memoryCache.get<T>(key);

    if (cached) {
      setData(cached);
      setIsLoading(false);
      setIsStale(true); // Cached data is potentially stale
    }

    // Always revalidate in background
    fetchData();
  }, [key, fetchData]);

  return {
    data,
    isLoading,
    isStale,
    error,
    mutate: fetchData,
  };
}

// Usage
function TrackList() {
  const { data: tracks, isLoading, isStale, error } = useSWR(
    'tracks:approved',
    () => base44Tracks.list({ status: 'approved' }),
    CACHE_DURATIONS.tracks
  );

  if (isLoading && !tracks) return <Loading />;

  return (
    <>
      {isStale && <RefreshIndicator />}
      <FlatList data={tracks} ... />
    </>
  );
}
```

## Cache Invalidation

### Strategies
```typescript
// 1. Invalidation explicite apres mutation
async function createTrack(input: CreateTrackInput): Promise<Track> {
  const track = await api.createTrack(input);

  // Invalider les listes concernees
  memoryCache.invalidatePattern('tracks:');
  await persistentCache.invalidatePattern('tracks:');

  return track;
}

// 2. Invalidation par tag
const trackTags = new Set<string>();

function setWithTags<T>(key: string, data: T, ttl: number, tags: string[]): void {
  memoryCache.set(key, data, ttl);
  tags.forEach(tag => trackTags.add(`${tag}:${key}`));
}

function invalidateByTag(tag: string): void {
  for (const entry of trackTags) {
    if (entry.startsWith(`${tag}:`)) {
      const key = entry.slice(tag.length + 1);
      memoryCache.invalidate(key);
    }
  }
}

// 3. Invalidation au focus (react-navigation)
useFocusEffect(
  useCallback(() => {
    // Refresh data when screen comes into focus
    refetchData();
  }, [])
);
```
