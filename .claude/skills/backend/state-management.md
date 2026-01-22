---
name: state-management
description: Gestion d'etat avec React Context pour SPYNNERS
globs: ["**/contexts/**/*", "**/providers/**/*"]
---

# State Management - SPYNNERS

## Architecture Context

### Structure des Contexts
```
src/contexts/
├── AuthContext.tsx      # Authentification et user
├── PlayerContext.tsx    # Lecteur audio global
├── LanguageContext.tsx  # i18n
├── ThemeContext.tsx     # Theme (dark only pour l'instant)
└── index.ts             # Re-exports
```

## AuthContext

### Implementation Complete
```typescript
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { base44Auth } from '@/src/services/base44Api';

interface User {
  id: string;
  email: string;
  fullName: string;
  avatar?: string;
  userType: 'dj' | 'producer' | 'listener';
  blackDiamonds: number;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string, userType: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize from storage
  useEffect(() => {
    async function init() {
      try {
        const [storedToken, storedUser] = await Promise.all([
          base44Auth.getStoredToken(),
          base44Auth.getStoredUser(),
        ]);

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);

          // Validate token
          const freshUser = await base44Auth.me();
          if (freshUser) {
            setUser(freshUser);
          } else {
            // Token invalid
            await base44Auth.logout();
            setToken(null);
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await base44Auth.login(email, password);
      setToken(response.token);
      setUser(response.user);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Login failed'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    userType: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await base44Auth.signup({
        email,
        password,
        fullName,
        userType: userType as 'dj' | 'producer' | 'listener',
      });
      setToken(response.token);
      setUser(response.user);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Signup failed'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await base44Auth.logout();
    setUser(null);
    setToken(null);
    setError(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const freshUser = await base44Auth.me();
    if (freshUser) {
      setUser(freshUser);
    }
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      error,
      login,
      signup,
      logout,
      refreshUser,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

## PlayerContext

### Implementation Complete
```typescript
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import TrackPlayer, { State, Event, usePlaybackState, useProgress } from 'react-native-track-player';

interface Track {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  artworkUrl?: string;
  duration: number;
}

interface PlayerContextType {
  // State
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  isLoading: boolean;

  // Progress
  position: number;
  duration: number;
  buffered: number;

  // Actions
  playTrack: (track: Track, trackList?: Track[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  setQueue: (tracks: Track[]) => Promise<void>;
  clearQueue: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueueState] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const playbackState = usePlaybackState();
  const { position, duration, buffered } = useProgress();

  const isPlaying = playbackState.state === State.Playing;

  // Track change listener
  useEffect(() => {
    const trackChangeSub = TrackPlayer.addEventListener(
      Event.PlaybackActiveTrackChanged,
      async (event) => {
        if (event.track) {
          setCurrentTrack({
            id: event.track.id as string,
            title: event.track.title || '',
            artist: event.track.artist || '',
            audioUrl: event.track.url as string,
            artworkUrl: event.track.artwork as string,
            duration: event.track.duration || 0,
          });
        } else {
          setCurrentTrack(null);
        }
      }
    );

    return () => trackChangeSub.remove();
  }, []);

  const playTrack = useCallback(async (track: Track, trackList?: Track[]) => {
    setIsLoading(true);

    try {
      await TrackPlayer.reset();

      // Add all tracks if provided
      const tracksToAdd = trackList || [track];
      const trackObjects = tracksToAdd.map(t => ({
        id: t.id,
        url: t.audioUrl,
        title: t.title,
        artist: t.artist,
        artwork: t.artworkUrl,
        duration: t.duration,
      }));

      await TrackPlayer.add(trackObjects);

      // Skip to selected track
      if (trackList) {
        const index = trackList.findIndex(t => t.id === track.id);
        if (index > 0) {
          await TrackPlayer.skip(index);
        }
      }

      await TrackPlayer.play();
      setQueueState(tracksToAdd);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (isPlaying) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  }, [isPlaying]);

  const seekTo = useCallback(async (positionMs: number) => {
    await TrackPlayer.seekTo(positionMs / 1000);
  }, []);

  const skipToNext = useCallback(async () => {
    await TrackPlayer.skipToNext();
  }, []);

  const skipToPrevious = useCallback(async () => {
    const currentPosition = await TrackPlayer.getPosition();

    // Si > 3 secondes, revenir au debut
    if (currentPosition > 3) {
      await TrackPlayer.seekTo(0);
    } else {
      await TrackPlayer.skipToPrevious();
    }
  }, []);

  const setQueue = useCallback(async (tracks: Track[]) => {
    await TrackPlayer.reset();
    await TrackPlayer.add(tracks.map(t => ({
      id: t.id,
      url: t.audioUrl,
      title: t.title,
      artist: t.artist,
      artwork: t.artworkUrl,
      duration: t.duration,
    })));
    setQueueState(tracks);
  }, []);

  const clearQueue = useCallback(async () => {
    await TrackPlayer.reset();
    setQueueState([]);
    setCurrentTrack(null);
  }, []);

  return (
    <PlayerContext.Provider value={{
      currentTrack,
      queue,
      isPlaying,
      isLoading,
      position: position * 1000, // Convert to ms
      duration: duration * 1000,
      buffered: buffered * 1000,
      playTrack,
      togglePlayPause,
      seekTo,
      skipToNext,
      skipToPrevious,
      setQueue,
      clearQueue,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextType {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return context;
}
```

## Context Optimization

### Split State and Actions
```typescript
// Pour les contexts frequemment mis a jour
const PlayerStateContext = createContext<PlayerState | null>(null);
const PlayerActionsContext = createContext<PlayerActions | null>(null);

// Les composants qui n'ont besoin que des actions ne re-render pas
export function usePlayerActions() {
  const context = useContext(PlayerActionsContext);
  if (!context) throw new Error('...');
  return context;
}

// Selecteur pour etat specifique
export function usePlayerState<T>(selector: (state: PlayerState) => T): T {
  const state = useContext(PlayerStateContext);
  if (!state) throw new Error('...');
  return selector(state);
}
```

### Memoization
```typescript
// Provider avec memoization
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  // State...

  // Memoize actions pour eviter re-renders enfants
  const actions = useMemo(() => ({
    playTrack,
    togglePlayPause,
    seekTo,
    skipToNext,
    skipToPrevious,
  }), [playTrack, togglePlayPause, seekTo, skipToNext, skipToPrevious]);

  const state = useMemo(() => ({
    currentTrack,
    isPlaying,
    position,
    duration,
  }), [currentTrack, isPlaying, position, duration]);

  return (
    <PlayerActionsContext.Provider value={actions}>
      <PlayerStateContext.Provider value={state}>
        {children}
      </PlayerStateContext.Provider>
    </PlayerActionsContext.Provider>
  );
}
```

## Provider Composition

### Root Providers
```typescript
// app/_layout.tsx
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <LanguageProvider>
            <PlayerProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </PlayerProvider>
          </LanguageProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```
