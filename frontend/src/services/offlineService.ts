/**
 * Offline Service for SPYN
 * Manages offline audio recording, storage, and sync when network returns
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import axios from 'axios';

const BACKEND_URL = 'https://spynners-app-1.preview.emergentagent.com';
const OFFLINE_SESSIONS_KEY = 'offline_spyn_sessions';
const PUSH_TOKEN_KEY = 'expo_push_token';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

export interface OfflineRecording {
  id: string;
  audioBase64: string;
  timestamp: string;
  location?: {
    latitude?: number;
    longitude?: number;
    venue?: string;
    city?: string;
    country?: string;
    is_valid_venue?: boolean;
  };
  userId: string;
  djName: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  result?: any;
  createdAt: string;
}

export interface OfflineSession {
  id: string;
  recordings: OfflineRecording[];
  startTime: string;
  endTime?: string;
  location?: any;
  userId: string;
  djName: string;
  status: 'recording' | 'pending_sync' | 'syncing' | 'synced';
  syncedAt?: string;
}

class OfflineService {
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private networkUnsubscribe: (() => void) | null = null;
  private networkChangeCallbacks: ((isOnline: boolean) => void)[] = [];

  constructor() {
    this.initNetworkListener();
  }

  // ==================== NETWORK MONITORING ====================

  private initNetworkListener() {
    this.networkUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      console.log('[Offline] Network state changed:', this.isOnline ? 'ONLINE' : 'OFFLINE');
      
      // Notify all registered callbacks
      this.networkChangeCallbacks.forEach(callback => {
        try {
          callback(this.isOnline);
        } catch (e) {
          console.error('[Offline] Callback error:', e);
        }
      });
      
      // If we just came back online, sync pending sessions
      if (wasOffline && this.isOnline) {
        console.log('[Offline] Network restored - starting sync...');
        this.syncPendingSessions();
      }
    });
  }

  // Register a callback to be notified when network status changes
  onNetworkChange(callback: (isOnline: boolean) => void): () => void {
    this.networkChangeCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      this.networkChangeCallbacks = this.networkChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  async checkNetworkStatus(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      this.isOnline = state.isConnected ?? false;
      console.log('[Offline] checkNetworkStatus:', this.isOnline ? 'ONLINE' : 'OFFLINE', state);
      return this.isOnline;
    } catch (error) {
      console.error('[Offline] checkNetworkStatus error:', error);
      return this.isOnline;
    }
  }

  isNetworkAvailable(): boolean {
    return this.isOnline;
  }

  // ==================== PUSH NOTIFICATIONS ====================

  async registerForPushNotifications(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        console.log('[Notifications] Must use physical device for Push Notifications');
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Notifications] Permission not granted');
        return null;
      }

      // Get Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '691a4d96d819355b52c063f3', // Your project ID
      });
      
      const pushToken = tokenData.data;
      console.log('[Notifications] Push token:', pushToken);
      
      // Store token locally
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushToken);

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('spyn', {
          name: 'SPYN Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#5CB3CC',
        });
      }

      return pushToken;
    } catch (error) {
      console.error('[Notifications] Error registering:', error);
      return null;
    }
  }

  async getPushToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  // Send local notification (for testing)
  async sendLocalNotification(title: string, body: string, data?: any) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
      },
      trigger: null, // Immediate
    });
  }

  // ==================== OFFLINE SESSION STORAGE ====================

  async saveOfflineRecording(recording: Omit<OfflineRecording, 'id' | 'status' | 'createdAt'>): Promise<string> {
    const id = `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newRecording: OfflineRecording = {
      ...recording,
      id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    // Get existing sessions
    const sessions = await this.getOfflineSessions();
    
    // Find or create current session
    let currentSession = sessions.find(s => s.status === 'recording');
    
    if (!currentSession) {
      currentSession = {
        id: `session_${Date.now()}`,
        recordings: [],
        startTime: new Date().toISOString(),
        location: recording.location,
        userId: recording.userId,
        djName: recording.djName,
        status: 'recording',
      };
      sessions.push(currentSession);
    }
    
    currentSession.recordings.push(newRecording);
    
    await this.saveOfflineSessions(sessions);
    
    console.log('[Offline] Saved recording:', id);
    console.log('[Offline] Total pending recordings:', currentSession.recordings.length);
    
    return id;
  }

  async endOfflineSession(sessionId?: string): Promise<OfflineSession | null> {
    const sessions = await this.getOfflineSessions();
    
    const session = sessionId 
      ? sessions.find(s => s.id === sessionId)
      : sessions.find(s => s.status === 'recording');
    
    if (session) {
      session.status = 'pending_sync';
      session.endTime = new Date().toISOString();
      await this.saveOfflineSessions(sessions);
      
      console.log('[Offline] Session ended:', session.id);
      console.log('[Offline] Recordings to sync:', session.recordings.length);
      
      // Try to sync immediately if online
      if (this.isOnline) {
        this.syncPendingSessions();
      }
      
      return session;
    }
    
    return null;
  }

  async getOfflineSessions(): Promise<OfflineSession[]> {
    try {
      const data = await AsyncStorage.getItem(OFFLINE_SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[Offline] Error getting sessions:', error);
      return [];
    }
  }

  private async saveOfflineSessions(sessions: OfflineSession[]): Promise<void> {
    try {
      await AsyncStorage.setItem(OFFLINE_SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('[Offline] Error saving sessions:', error);
    }
  }

  async getPendingCount(): Promise<number> {
    const sessions = await this.getOfflineSessions();
    return sessions
      .filter(s => s.status === 'pending_sync')
      .reduce((acc, s) => acc + s.recordings.length, 0);
  }

  // ==================== SYNC WITH BACKEND ====================

  async syncPendingSessions(token?: string): Promise<{ synced: number; failed: number; results: any[] }> {
    if (this.syncInProgress) {
      console.log('[Offline] Sync already in progress');
      return { synced: 0, failed: 0, results: [] };
    }

    if (!this.isOnline) {
      console.log('[Offline] Cannot sync - offline');
      return { synced: 0, failed: 0, results: [] };
    }

    this.syncInProgress = true;
    let synced = 0;
    let failed = 0;
    let allResults: any[] = [];

    try {
      const sessions = await this.getOfflineSessions();
      const pendingSessions = sessions.filter(s => s.status === 'pending_sync');

      console.log('[Offline] Starting sync for', pendingSessions.length, 'sessions');

      for (const session of pendingSessions) {
        session.status = 'syncing';
        await this.saveOfflineSessions(sessions);

        try {
          // Send all recordings to backend for processing
          const response = await axios.post(
            `${BACKEND_URL}/api/process-offline-session`,
            {
              sessionId: session.id,
              recordings: session.recordings.map(r => ({
                audioBase64: r.audioBase64,
                timestamp: r.timestamp,
                location: r.location,
              })),
              userId: session.userId,
              djName: session.djName,
              startTime: session.startTime,
              endTime: session.endTime,
              location: session.location,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: token ? `Bearer ${token}` : undefined,
              },
              timeout: 120000, // 2 minutes for large sessions
            }
          );

          if (response.data.success) {
            session.status = 'synced';
            session.syncedAt = new Date().toISOString();
            
            // Update recordings with results
            if (response.data.results) {
              session.recordings.forEach((rec, idx) => {
                if (response.data.results[idx]) {
                  rec.status = 'synced';
                  rec.result = response.data.results[idx];
                }
              });
              
              // Add results to allResults
              allResults = [...allResults, ...response.data.results];
            }
            
            synced += session.recordings.length;
            console.log('[Offline] Session synced:', session.id);

            // Send notification about synced tracks
            const identifiedTracks = response.data.results?.filter((r: any) => r.success && r.is_spynners_track) || [];
            if (identifiedTracks.length > 0) {
              await this.sendLocalNotification(
                '🎵 SPYN Session Synced!',
                `${identifiedTracks.length} track(s) Spynners identifié(s)`,
                { sessionId: session.id, tracks: identifiedTracks }
              );
            }
          } else {
            session.status = 'pending_sync'; // Retry later
            failed += session.recordings.length;
          }
        } catch (error) {
          console.error('[Offline] Sync error for session:', session.id, error);
          session.status = 'pending_sync'; // Retry later
          failed += session.recordings.length;
        }

        await this.saveOfflineSessions(sessions);
      }

      // Clean up old synced sessions (keep for 7 days)
      await this.cleanupOldSessions();

    } finally {
      this.syncInProgress = false;
    }

    console.log('[Offline] Sync complete. Synced:', synced, 'Failed:', failed, 'Results:', allResults.length);
    return { synced, failed, results: allResults };
  }

  private async cleanupOldSessions(): Promise<void> {
    const sessions = await this.getOfflineSessions();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const filteredSessions = sessions.filter(s => 
      s.status !== 'synced' || (s.syncedAt && s.syncedAt > sevenDaysAgo)
    );
    
    if (filteredSessions.length !== sessions.length) {
      await this.saveOfflineSessions(filteredSessions);
      console.log('[Offline] Cleaned up', sessions.length - filteredSessions.length, 'old sessions');
    }
  }

  // ==================== CLEANUP ====================

  destroy() {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
    }
  }
}

// Export singleton instance
export const offlineService = new OfflineService();
export default offlineService;
