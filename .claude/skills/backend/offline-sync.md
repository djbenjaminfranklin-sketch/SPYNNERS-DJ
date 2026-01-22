---
name: offline-sync
description: Mode offline et synchronisation pour SPYNNERS
globs: ["**/services/**/*", "**/offline/**/*"]
---

# Mode Offline & Sync - SPYNNERS

## Architecture Offline

### Principes
1. **Offline-First**: L'app doit fonctionner sans connexion
2. **Eventual Consistency**: Sync quand la connexion revient
3. **Conflict Resolution**: Strategie "last write wins" ou merge manuel
4. **Data Priority**: Certaines donnees sont plus critiques

## Detection Reseau

### Hook useNetworkStatus
```typescript
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: null,
    type: 'unknown',
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setStatus({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
    });

    return () => unsubscribe();
  }, []);

  return status;
}
```

### Context Offline
```typescript
interface OfflineContextType {
  isOnline: boolean;
  pendingOperations: number;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncAt: Date | null;
  forceSync: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const [pendingOperations, setPendingOperations] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const isOnline = isConnected && isInternetReachable !== false;

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingOperations > 0) {
      forceSync();
    }
  }, [isOnline]);

  const forceSync = useCallback(async () => {
    if (!isOnline || syncStatus === 'syncing') return;

    setSyncStatus('syncing');
    try {
      await syncPendingOperations();
      setLastSyncAt(new Date());
      setSyncStatus('idle');
    } catch (error) {
      setSyncStatus('error');
      throw error;
    }
  }, [isOnline, syncStatus]);

  // ...
}
```

## Stockage Offline

### AsyncStorage Wrapper
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  OFFLINE_QUEUE: 'offline_queue',
  CACHED_TRACKS: 'cached_tracks',
  OFFLINE_SESSIONS: 'offline_spyn_sessions',
  PENDING_UPLOADS: 'pending_uploads',
} as const;

interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'track' | 'playlist' | 'session';
  data: unknown;
  createdAt: string;
  retryCount: number;
}

export const offlineStorage = {
  // Queue d'operations
  async getQueue(): Promise<OfflineOperation[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return data ? JSON.parse(data) : [];
  },

  async addToQueue(operation: Omit<OfflineOperation, 'id' | 'createdAt' | 'retryCount'>): Promise<void> {
    const queue = await this.getQueue();
    queue.push({
      ...operation,
      id: generateUUID(),
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  },

  async removeFromQueue(operationId: string): Promise<void> {
    const queue = await this.getQueue();
    const filtered = queue.filter(op => op.id !== operationId);
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(filtered));
  },

  async updateRetryCount(operationId: string): Promise<void> {
    const queue = await this.getQueue();
    const updated = queue.map(op =>
      op.id === operationId
        ? { ...op, retryCount: op.retryCount + 1 }
        : op
    );
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(updated));
  },

  // Cache de tracks
  async cacheTracks(tracks: Track[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.CACHED_TRACKS, JSON.stringify(tracks));
  },

  async getCachedTracks(): Promise<Track[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_TRACKS);
    return data ? JSON.parse(data) : [];
  },
};
```

## SPYN Sessions Offline

### Service SpynSession Offline
```typescript
interface SpynSession {
  id: string;
  name: string;
  recordingUri: string;
  duration: number;
  detectedTracks: DetectedTrack[];
  createdAt: string;
  uploadedAt?: string;
}

export const offlineSpynService = {
  async saveSession(session: Omit<SpynSession, 'id' | 'createdAt'>): Promise<SpynSession> {
    const fullSession: SpynSession = {
      ...session,
      id: generateUUID(),
      createdAt: new Date().toISOString(),
    };

    const sessions = await this.getSessions();
    sessions.push(fullSession);
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_SESSIONS, JSON.stringify(sessions));

    return fullSession;
  },

  async getSessions(): Promise<SpynSession[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_SESSIONS);
    return data ? JSON.parse(data) : [];
  },

  async getPendingSessions(): Promise<SpynSession[]> {
    const sessions = await this.getSessions();
    return sessions.filter(s => !s.uploadedAt);
  },

  async markAsUploaded(sessionId: string): Promise<void> {
    const sessions = await this.getSessions();
    const updated = sessions.map(s =>
      s.id === sessionId
        ? { ...s, uploadedAt: new Date().toISOString() }
        : s
    );
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_SESSIONS, JSON.stringify(updated));
  },

  async deleteSession(sessionId: string): Promise<void> {
    const sessions = await this.getSessions();
    const session = sessions.find(s => s.id === sessionId);

    // Supprimer le fichier audio local
    if (session?.recordingUri) {
      await FileSystem.deleteAsync(session.recordingUri, { idempotent: true });
    }

    const filtered = sessions.filter(s => s.id !== sessionId);
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_SESSIONS, JSON.stringify(filtered));
  },
};
```

## Synchronisation

### Sync Engine
```typescript
const MAX_RETRIES = 3;

export async function syncPendingOperations(): Promise<void> {
  const queue = await offlineStorage.getQueue();

  for (const operation of queue) {
    if (operation.retryCount >= MAX_RETRIES) {
      console.warn(`Operation ${operation.id} exceeded max retries, skipping`);
      continue;
    }

    try {
      await processOperation(operation);
      await offlineStorage.removeFromQueue(operation.id);
    } catch (error) {
      console.error(`Failed to sync operation ${operation.id}:`, error);
      await offlineStorage.updateRetryCount(operation.id);
    }
  }
}

async function processOperation(operation: OfflineOperation): Promise<void> {
  switch (operation.entity) {
    case 'session':
      await syncSpynSession(operation);
      break;
    case 'track':
      await syncTrack(operation);
      break;
    case 'playlist':
      await syncPlaylist(operation);
      break;
  }
}

async function syncSpynSession(operation: OfflineOperation): Promise<void> {
  const session = operation.data as SpynSession;

  // Upload audio file first
  const uploadResult = await uploadAudioFile(session.recordingUri);

  // Create session on server
  await base44Spyn.createSession({
    name: session.name,
    audioUrl: uploadResult.url,
    duration: session.duration,
    detectedTracks: session.detectedTracks,
  });

  // Mark local session as uploaded
  await offlineSpynService.markAsUploaded(session.id);
}
```

### Background Sync
```typescript
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';

// Define task
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const pendingCount = (await offlineStorage.getQueue()).length;

    if (pendingCount === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    await syncPendingOperations();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Register task
export async function registerBackgroundSync(): Promise<void> {
  await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
    minimumInterval: 15 * 60, // 15 minutes
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
```

## UI Offline Indicators

### Composant OfflineBanner
```typescript
export function OfflineBanner() {
  const { isOnline, pendingOperations, syncStatus } = useOffline();

  if (isOnline && pendingOperations === 0) return null;

  return (
    <View style={styles.banner}>
      {!isOnline && (
        <View style={styles.row}>
          <Ionicons name="cloud-offline" size={16} color={Colors.warning} />
          <Text style={styles.text}>Mode hors ligne</Text>
        </View>
      )}
      {pendingOperations > 0 && (
        <View style={styles.row}>
          <Ionicons name="sync" size={16} color={Colors.primary} />
          <Text style={styles.text}>
            {syncStatus === 'syncing'
              ? `Synchronisation en cours...`
              : `${pendingOperations} operation(s) en attente`
            }
          </Text>
        </View>
      )}
    </View>
  );
}
```

## Bonnes Pratiques

1. **Validation**: Valider les donnees avant stockage offline
2. **Timestamps**: Toujours inclure createdAt/updatedAt pour conflits
3. **Idempotence**: Les operations doivent etre rejoables sans effet de bord
4. **Cleanup**: Nettoyer les vieilles donnees cached periodiquement
5. **Feedback**: Informer l'utilisateur du statut offline/sync
