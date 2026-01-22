---
name: track-player-advanced
description: Configuration avancee react-native-track-player
globs: ["**/services/trackPlayer**", "**/hooks/usePlayer**", "**/contexts/Player**"]
---

# React Native Track Player - SPYNNERS

## Setup Initial

### Installation et Configuration
```typescript
// src/services/trackPlayerService.ts
import TrackPlayer, {
  Capability,
  AppKilledPlaybackBehavior,
  Event,
  RepeatMode,
  State,
} from 'react-native-track-player';

export async function setupPlayer(): Promise<boolean> {
  let isSetup = false;

  try {
    await TrackPlayer.getActiveTrack();
    isSetup = true;
  } catch {
    await TrackPlayer.setupPlayer({
      maxCacheSize: 1024 * 100, // 100 MB
      autoHandleInterruptions: true,
    });

    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
        Capability.Stop,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
      progressUpdateEventInterval: 1,
    });

    isSetup = true;
  }

  return isSetup;
}
```

### Service Handler (index.js)
```javascript
// index.js
import { AppRegistry } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
TrackPlayer.registerPlaybackService(() => require('./src/services/playbackService'));
```

### Playback Service
```typescript
// src/services/playbackService.ts
import TrackPlayer, { Event } from 'react-native-track-player';

module.exports = async function() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));

  // Gestion de la fin de piste
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    if (event.position > 0) {
      // Queue terminee, peut-etre recommencer ou proposer suggestions
      const repeatMode = await TrackPlayer.getRepeatMode();
      if (repeatMode === RepeatMode.Queue) {
        await TrackPlayer.seekTo(0);
        await TrackPlayer.skip(0);
        await TrackPlayer.play();
      }
    }
  });

  // Gestion des erreurs
  TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
    console.error('Playback error:', event);
  });
};
```

## Queue Management

### Gestion de la Queue
```typescript
interface QueueManager {
  currentQueue: Track[];
  shuffledIndices: number[] | null;
}

export const queueManager = {
  async add(tracks: Track[], insertBeforeIndex?: number): Promise<void> {
    const trackObjects = tracks.map(t => ({
      id: t.id,
      url: t.audioUrl,
      title: t.title,
      artist: t.artist,
      artwork: t.artworkUrl || undefined,
      duration: t.duration,
    }));

    if (insertBeforeIndex !== undefined) {
      await TrackPlayer.add(trackObjects, insertBeforeIndex);
    } else {
      await TrackPlayer.add(trackObjects);
    }
  },

  async remove(indices: number[]): Promise<void> {
    // Remove in reverse order to maintain indices
    const sorted = [...indices].sort((a, b) => b - a);
    for (const index of sorted) {
      await TrackPlayer.remove(index);
    }
  },

  async move(fromIndex: number, toIndex: number): Promise<void> {
    await TrackPlayer.move(fromIndex, toIndex);
  },

  async clear(): Promise<void> {
    await TrackPlayer.reset();
  },

  async getQueue(): Promise<Track[]> {
    const queue = await TrackPlayer.getQueue();
    return queue.map(t => ({
      id: t.id as string,
      title: t.title || '',
      artist: t.artist || '',
      audioUrl: t.url as string,
      artworkUrl: t.artwork as string | undefined,
      duration: t.duration || 0,
    })) as Track[];
  },
};
```

### Shuffle Implementation
```typescript
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function toggleShuffle(isShuffleOn: boolean): Promise<void> {
  const queue = await TrackPlayer.getQueue();
  const currentTrack = await TrackPlayer.getActiveTrack();

  if (isShuffleOn) {
    // Desactiver shuffle - restaurer ordre original
    // (necessite de stocker l'ordre original quelque part)
  } else {
    // Activer shuffle
    const currentIndex = queue.findIndex(t => t.id === currentTrack?.id);

    // Garder la piste actuelle en premier
    const remaining = queue.filter((_, i) => i !== currentIndex);
    const shuffled = shuffleArray(remaining);

    await TrackPlayer.reset();
    if (currentTrack) {
      await TrackPlayer.add(currentTrack);
    }
    await TrackPlayer.add(shuffled);
  }
}
```

## Repeat Modes

### Configuration Repeat
```typescript
import { RepeatMode } from 'react-native-track-player';

export async function cycleRepeatMode(): Promise<RepeatMode> {
  const currentMode = await TrackPlayer.getRepeatMode();

  let nextMode: RepeatMode;
  switch (currentMode) {
    case RepeatMode.Off:
      nextMode = RepeatMode.Queue;
      break;
    case RepeatMode.Queue:
      nextMode = RepeatMode.Track;
      break;
    case RepeatMode.Track:
      nextMode = RepeatMode.Off;
      break;
    default:
      nextMode = RepeatMode.Off;
  }

  await TrackPlayer.setRepeatMode(nextMode);
  return nextMode;
}

export function getRepeatIcon(mode: RepeatMode): string {
  switch (mode) {
    case RepeatMode.Off:
      return 'repeat';
    case RepeatMode.Queue:
      return 'repeat';
    case RepeatMode.Track:
      return 'repeat-once'; // ou 'repeat' avec badge "1"
    default:
      return 'repeat';
  }
}
```

## Crossfade

### Implementation Crossfade
```typescript
const CROSSFADE_DURATION = 3000; // 3 secondes

export async function playWithCrossfade(
  newTrack: Track,
  crossfadeDuration: number = CROSSFADE_DURATION
): Promise<void> {
  const currentVolume = await TrackPlayer.getVolume();
  const steps = 30;
  const stepDuration = crossfadeDuration / steps;
  const volumeStep = currentVolume / steps;

  // Fade out current track
  for (let i = steps; i > 0; i--) {
    await TrackPlayer.setVolume(volumeStep * i);
    await new Promise(resolve => setTimeout(resolve, stepDuration));
  }

  // Switch track
  await TrackPlayer.reset();
  await TrackPlayer.add({
    id: newTrack.id,
    url: newTrack.audioUrl,
    title: newTrack.title,
    artist: newTrack.artist,
    artwork: newTrack.artworkUrl,
    duration: newTrack.duration,
  });
  await TrackPlayer.play();

  // Fade in new track
  for (let i = 0; i <= steps; i++) {
    await TrackPlayer.setVolume(volumeStep * i);
    await new Promise(resolve => setTimeout(resolve, stepDuration));
  }

  await TrackPlayer.setVolume(currentVolume);
}
```

### Auto-Crossfade Hook
```typescript
export function useAutoCrossfade(enabled: boolean, duration: number = 3000) {
  const { position, duration: trackDuration } = useProgress();

  useEffect(() => {
    if (!enabled) return;

    const timeToEnd = trackDuration - position;

    if (timeToEnd > 0 && timeToEnd <= duration / 1000) {
      // Commencer le crossfade
      startCrossfadeToNext(duration);
    }
  }, [enabled, position, trackDuration, duration]);
}
```

## Equalizer et Effects

### Volume et Equalizer
```typescript
export const audioEffects = {
  async setVolume(level: number): Promise<void> {
    // level: 0-1
    await TrackPlayer.setVolume(Math.max(0, Math.min(1, level)));
  },

  async getVolume(): Promise<number> {
    return TrackPlayer.getVolume();
  },

  async setRate(rate: number): Promise<void> {
    // rate: 0.25-2.0 (vitesse de lecture)
    await TrackPlayer.setRate(rate);
  },

  // Note: L'equalizer natif n'est pas supporte par track-player
  // Pour un EQ avance, utiliser react-native-audio-api
};
```

## Hooks Utilitaires

### useProgress Hook
```typescript
import { useProgress } from 'react-native-track-player';

export function useFormattedProgress() {
  const { position, duration, buffered } = useProgress(250);

  return {
    position: Math.floor(position * 1000), // en ms
    duration: Math.floor(duration * 1000), // en ms
    buffered: Math.floor(buffered * 1000), // en ms
    progress: duration > 0 ? position / duration : 0,
    formattedPosition: formatTime(position),
    formattedDuration: formatTime(duration),
    formattedRemaining: formatTime(duration - position),
  };
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
```

### usePlaybackState Hook
```typescript
import { usePlaybackState, State } from 'react-native-track-player';

export function usePlayerStatus() {
  const { state } = usePlaybackState();

  return {
    isPlaying: state === State.Playing,
    isPaused: state === State.Paused,
    isBuffering: state === State.Buffering || state === State.Loading,
    isStopped: state === State.Stopped || state === State.None,
    isReady: state === State.Ready,
    state,
  };
}
```

## Gestion des Interruptions

### Audio Interruptions
```typescript
// Gere automatiquement par autoHandleInterruptions: true dans setup

// Pour un controle manuel:
TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
  if (event.paused) {
    // Autre app a pris le focus audio
    await TrackPlayer.pause();
  } else if (event.permanent) {
    // Focus audio perdu definitivement
    await TrackPlayer.stop();
  } else {
    // Ducking - baisser le volume temporairement
    await TrackPlayer.setVolume(0.3);
  }
});
```

## Best Practices

1. **Setup unique**: Appeler setupPlayer() une seule fois au demarrage
2. **Reset avant add**: Toujours reset() avant de charger une nouvelle queue
3. **Error handling**: Toujours catch les erreurs des operations async
4. **Memory**: Limiter la taille du cache (maxCacheSize)
5. **Background**: Le service handler doit etre enregistre au boot
