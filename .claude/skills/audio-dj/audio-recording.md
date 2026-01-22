---
name: audio-recording
description: Enregistrement audio haute qualite avec Expo AV
globs: ["**/spyn/**/*", "**/recording/**/*", "**/audio/**/*"]
---

# Audio Recording - SPYNNERS SPYN

## Configuration Enregistrement

### Options Haute Qualite
```typescript
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

export const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 320000, // 320 kbps
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MAX,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 320000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 320000,
  },
};

// Options pour qualite standard (fichiers plus petits)
export const RECORDING_OPTIONS_STANDARD: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000, // 128 kbps
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};
```

## Service d'Enregistrement

### SpynRecordingService
```typescript
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

interface RecordingState {
  recording: Audio.Recording | null;
  uri: string | null;
  duration: number;
  isRecording: boolean;
  isPaused: boolean;
  metering: number;
}

class SpynRecordingService {
  private recording: Audio.Recording | null = null;
  private meteringInterval: NodeJS.Timer | null = null;
  private listeners: Set<(state: RecordingState) => void> = new Set();

  async requestPermissions(): Promise<boolean> {
    const { granted } = await Audio.requestPermissionsAsync();
    return granted;
  }

  async prepareRecording(): Promise<void> {
    // Configure audio mode pour enregistrement
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
  }

  async start(options: Audio.RecordingOptions = RECORDING_OPTIONS): Promise<string> {
    if (this.recording) {
      throw new Error('Recording already in progress');
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Microphone permission not granted');
    }

    await this.prepareRecording();

    const { recording } = await Audio.Recording.createAsync(
      options,
      this.onRecordingStatusUpdate.bind(this),
      100 // Update every 100ms
    );

    this.recording = recording;
    this.startMetering();

    return recording.getURI() || '';
  }

  async pause(): Promise<void> {
    if (!this.recording) return;
    await this.recording.pauseAsync();
  }

  async resume(): Promise<void> {
    if (!this.recording) return;
    await this.recording.startAsync();
  }

  async stop(): Promise<{ uri: string; duration: number }> {
    if (!this.recording) {
      throw new Error('No recording in progress');
    }

    this.stopMetering();

    const status = await this.recording.stopAndUnloadAsync();
    const uri = this.recording.getURI();

    // Reset audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    this.recording = null;

    if (!uri) {
      throw new Error('No recording URI');
    }

    return {
      uri,
      duration: status.durationMillis,
    };
  }

  async cancel(): Promise<void> {
    if (!this.recording) return;

    this.stopMetering();

    const uri = this.recording.getURI();
    await this.recording.stopAndUnloadAsync();

    // Delete the file
    if (uri) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });

    this.recording = null;
  }

  private onRecordingStatusUpdate(status: Audio.RecordingStatus): void {
    this.notifyListeners({
      recording: this.recording,
      uri: this.recording?.getURI() || null,
      duration: status.durationMillis,
      isRecording: status.isRecording,
      isPaused: !status.isRecording && status.isDoneRecording === false,
      metering: status.metering ?? -160,
    });
  }

  private startMetering(): void {
    // Le metering est gere par onRecordingStatusUpdate
  }

  private stopMetering(): void {
    if (this.meteringInterval) {
      clearInterval(this.meteringInterval);
      this.meteringInterval = null;
    }
  }

  subscribe(listener: (state: RecordingState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(state: RecordingState): void {
    this.listeners.forEach(listener => listener(state));
  }
}

export const spynRecording = new SpynRecordingService();
```

## Hook useRecording

### Implementation
```typescript
import { useState, useEffect, useCallback } from 'react';

interface UseRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  metering: number;
  uri: string | null;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<{ uri: string; duration: number }>;
  cancel: () => Promise<void>;
}

export function useRecording(): UseRecordingReturn {
  const [state, setState] = useState({
    isRecording: false,
    isPaused: false,
    duration: 0,
    metering: -160,
    uri: null as string | null,
  });

  useEffect(() => {
    const unsubscribe = spynRecording.subscribe((recordingState) => {
      setState({
        isRecording: recordingState.isRecording,
        isPaused: recordingState.isPaused,
        duration: recordingState.duration,
        metering: recordingState.metering,
        uri: recordingState.uri,
      });
    });

    return unsubscribe;
  }, []);

  const start = useCallback(async () => {
    await spynRecording.start();
  }, []);

  const pause = useCallback(async () => {
    await spynRecording.pause();
  }, []);

  const resume = useCallback(async () => {
    await spynRecording.resume();
  }, []);

  const stop = useCallback(async () => {
    return spynRecording.stop();
  }, []);

  const cancel = useCallback(async () => {
    await spynRecording.cancel();
  }, []);

  return {
    ...state,
    start,
    pause,
    resume,
    stop,
    cancel,
  };
}
```

## Visualisation Metering

### Conversion dB vers Lineaire
```typescript
// Le metering d'expo-av est en dB (decibels)
// -160 dB = silence, 0 dB = maximum

export function dbToLinear(db: number): number {
  // Clamp entre -60 et 0 pour une meilleure visualisation
  const clampedDb = Math.max(-60, Math.min(0, db));
  // Convertir en lineaire (0-1)
  return Math.pow(10, clampedDb / 20);
}

export function dbToPercentage(db: number): number {
  return dbToLinear(db) * 100;
}
```

### Composant VU Meter
```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface VUMeterProps {
  metering: number; // en dB
  width?: number;
  height?: number;
}

export function VUMeter({ metering, width = 200, height = 20 }: VUMeterProps) {
  const level = dbToLinear(metering);

  const animatedStyle = useAnimatedStyle(() => ({
    width: withSpring(`${level * 100}%`, { damping: 15, stiffness: 200 }),
  }));

  const getColor = (level: number): string => {
    if (level > 0.9) return '#F44336'; // Red - clipping
    if (level > 0.7) return '#FF9800'; // Orange - loud
    return '#5CB3CC'; // Cyan - normal
  };

  return (
    <View style={[styles.container, { width, height }]}>
      <Animated.View
        style={[
          styles.level,
          { backgroundColor: getColor(level) },
          animatedStyle,
        ]}
      />
      {/* Peak indicator */}
      <View style={[styles.peak, { left: '90%' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  level: {
    height: '100%',
    borderRadius: 4,
  },
  peak: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#FF9800',
  },
});
```

## Gestion des Fichiers

### Sauvegarde et Nommage
```typescript
import * as FileSystem from 'expo-file-system';

const RECORDINGS_DIR = `${FileSystem.documentDirectory}recordings/`;

export async function ensureRecordingsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
  }
}

export async function saveRecording(
  tempUri: string,
  sessionName: string
): Promise<string> {
  await ensureRecordingsDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${sessionName}_${timestamp}.m4a`;
  const destinationUri = `${RECORDINGS_DIR}${filename}`;

  await FileSystem.moveAsync({
    from: tempUri,
    to: destinationUri,
  });

  return destinationUri;
}

export async function deleteRecording(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function getRecordingInfo(uri: string): Promise<{
  size: number;
  exists: boolean;
}> {
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  return {
    size: info.exists ? (info.size || 0) : 0,
    exists: info.exists,
  };
}

export async function listRecordings(): Promise<string[]> {
  await ensureRecordingsDir();
  const files = await FileSystem.readDirectoryAsync(RECORDINGS_DIR);
  return files
    .filter(f => f.endsWith('.m4a'))
    .map(f => `${RECORDINGS_DIR}${f}`);
}
```

## Extraction de Segments

### Pour ACRCloud Analysis
```typescript
import { Audio } from 'expo-av';

// Extraire un segment audio pour l'analyse
// Note: expo-av ne supporte pas nativement l'extraction de segments
// On doit envoyer le fichier complet ou utiliser FFmpeg

export async function getAudioForAnalysis(
  uri: string
): Promise<string> {
  // Pour l'analyse ACRCloud, on peut envoyer le fichier complet
  // ou les X premieres secondes

  // Lire le fichier en base64
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return base64;
}
```

## Best Practices

1. **Permissions**: Toujours verifier les permissions avant d'enregistrer
2. **Audio Mode**: Configurer le mode audio correctement (allowsRecordingIOS)
3. **Background**: Activer staysActiveInBackground pour les sessions longues
4. **Cleanup**: Supprimer les fichiers temporaires apres upload
5. **Storage**: Surveiller l'espace disque disponible
6. **Error Handling**: Gerer les cas ou le micro n'est pas disponible
