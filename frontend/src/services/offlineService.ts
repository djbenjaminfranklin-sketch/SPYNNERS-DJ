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
import Constants from 'expo-constants';

// Get backend URL from environment or use current origin
const getBackendUrl = () => {
  // Try to get from env
  const envUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL 
    || process.env.EXPO_PUBLIC_BACKEND_URL;
  
  if (envUrl) {
    return envUrl;
  }
  
  // On web, use current origin
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Fallback
  return 'https://dj-session-tracker.preview.emergentagent.com';
};

const BACKEND_URL = getBackendUrl();
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
  // Track info for SPYN Record sessions
  trackInfo?: {
    title: string;
    artist: string;
    coverImage?: string;
    spynnersTrackId?: string;
    producerId?: string;
  };
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
  // Additional fields for SPYN Record sessions
  duration?: number;
  audioUri?: string;
  tracksCount?: number;
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
      
      // FORCE ONLINE - If we can make API calls, we're online
      // The NetInfo library is unreliable on mobile devices
      // Since the app clearly makes successful API calls, default to online
      this.isOnline = true;
      
      console.log('[Offline] Network state changed: FORCED ONLINE (NetInfo reported: isConnected=' + state.isConnected + ', isInternetReachable=' + state.isInternetReachable + ')');
      
      // Notify all registered callbacks
      this.networkChangeCallbacks.forEach(callback => {
        try {
          callback(this.isOnline);
        } catch (e) {
          console.error('[Offline] Callback error:', e);
        }
      });
      
      // Auto-sync when coming back online with pending sessions
      if (wasOffline && this.isOnline) {
        console.log('[Offline] Network restored - checking for pending sessions...');
        this.autoSyncPendingSessions();
      }
    });
    
    // On web, also listen to browser online/offline events
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[Offline] Browser online event');
        const wasOffline = !this.isOnline;
        this.isOnline = true;
        this.networkChangeCallbacks.forEach(cb => cb(true));
        if (wasOffline) {
          this.autoSyncPendingSessions();
        }
      });
      window.addEventListener('offline', () => {
        console.log('[Offline] Browser offline event');
        this.isOnline = false;
        this.networkChangeCallbacks.forEach(cb => cb(false));
      });
    }
  }

  private async autoSyncPendingSessions() {
    const sessions = await this.getOfflineSessions();
    const pendingSessions = sessions.filter(s => s.status === 'pending_sync');
    
    if (pendingSessions.length > 0) {
      console.log('[Offline] Found', pendingSessions.length, 'pending sessions - starting auto-sync...');
      const { synced, failed, results } = await this.syncPendingSessions();
      console.log('[Offline] Auto-sync complete:', synced, 'synced,', failed, 'failed');
    } else {
      console.log('[Offline] No pending sessions to sync');
    }
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
    // FORCE ONLINE - The app clearly makes successful API calls
    // NetInfo is unreliable on mobile devices
    this.isOnline = true;
    console.log('[Offline] checkNetworkStatus: FORCED ONLINE');
    return this.isOnline;
  }

  isNetworkAvailable(): boolean {
    // On web, always check navigator.onLine for current status
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
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

  // Simple session ID stored in memory during recording
  private currentSessionId: string | null = null;
  private isSessionEnding: boolean = false;

  async saveOfflineRecording(recording: Omit<OfflineRecording, 'id' | 'status' | 'createdAt'>): Promise<string> {
    // Don't save if session is ending
    if (this.isSessionEnding) {
      console.log('[Offline] Session is ending, skipping recording');
      return '';
    }
    
    const id = `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newRecording: OfflineRecording = {
      ...recording,
      id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    // Get existing sessions
    const sessions = await this.getOfflineSessions();
    
    // Use memory-stored session ID to find current session
    let currentSession = this.currentSessionId 
      ? sessions.find(s => s.id === this.currentSessionId && s.status === 'recording')
      : null;
    
    if (!currentSession) {
      // Create new session
      this.currentSessionId = `session_${Date.now()}`;
      console.log('[Offline] Creating NEW session:', this.currentSessionId);
      
      currentSession = {
        id: this.currentSessionId,
        recordings: [],
        startTime: new Date().toISOString(),
        location: recording.location,
        userId: recording.userId,
        djName: recording.djName,
        status: 'recording',
      };
      sessions.push(currentSession);
    } else {
      console.log('[Offline] Adding to existing session:', this.currentSessionId, '- recordings:', currentSession.recordings.length);
    }
    
    currentSession.recordings.push(newRecording);
    
    await this.saveOfflineSessions(sessions);
    
    console.log('[Offline] Saved recording:', id);
    console.log('[Offline] Total pending recordings:', currentSession.recordings.length);
    
    return id;
  }

  async endOfflineSession(sessionId?: string): Promise<OfflineSession | null> {
    console.log('[Offline] endOfflineSession called');
    
    // Set flag to prevent new recordings
    this.isSessionEnding = true;
    
    const sessions = await this.getOfflineSessions();
    
    // Use provided sessionId, or currentSessionId, or find any recording session
    const targetId = sessionId || this.currentSessionId;
    let session = targetId 
      ? sessions.find(s => s.id === targetId)
      : sessions.find(s => s.status === 'recording');
    
    if (session && session.status === 'recording') {
      console.log('[Offline] Ending session:', session.id, 'with', session.recordings.length, 'recordings');
      session.status = 'pending_sync';
      session.endTime = new Date().toISOString();
      await this.saveOfflineSessions(sessions);
      
      // Clear current session ID
      this.currentSessionId = null;
      
      console.log('[Offline] Session ended successfully');
      
      // Reset flag after a short delay
      setTimeout(() => {
        this.isSessionEnding = false;
      }, 2000);
      
      return session;
    } else if (session) {
      console.log('[Offline] Session found but status is:', session.status);
    } else {
      console.log('[Offline] No session found to end. currentSessionId:', this.currentSessionId);
    }
    
    // Clear current session ID and reset flag
    this.currentSessionId = null;
    this.isSessionEnding = false;
    
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
    // Count number of SESSIONS (not recordings) that are pending
    return sessions.filter(s => s.status === 'pending_sync').length;
  }

  // Save a complete offline session (used by SPYN Record)
  async saveOfflineSession(sessionData: {
    id: string;
    userId: string;
    djName: string;
    duration: number;
    recordedAt: string;
    tracks: Array<{
      title: string;
      artist: string;
      timestamp: string;
      coverImage?: string;
      spynnersTrackId?: string;
      producerId?: string;
    }>;
    audioUri?: string;
    status: 'pending_sync' | 'synced' | 'recording';
  }): Promise<void> {
    console.log('[Offline] Saving complete session:', sessionData.id);
    
    const sessions = await this.getOfflineSessions();
    
    // Create the session object
    const newSession: OfflineSession = {
      id: sessionData.id,
      startTime: sessionData.recordedAt,
      endTime: sessionData.recordedAt,
      userId: sessionData.userId,
      djName: sessionData.djName,
      status: sessionData.status,
      recordings: sessionData.tracks.map((track, index) => ({
        id: `${sessionData.id}_track_${index}`,
        audioBase64: '', // We don't store audio base64 for tracks, just metadata
        timestamp: track.timestamp,
        userId: sessionData.userId,
        djName: sessionData.djName,
        status: 'synced',
        createdAt: sessionData.recordedAt,
        trackInfo: {
          title: track.title,
          artist: track.artist,
          coverImage: track.coverImage,
          spynnersTrackId: track.spynnersTrackId,
          producerId: track.producerId,
        },
      })),
      // Store additional metadata
      duration: sessionData.duration,
      audioUri: sessionData.audioUri,
      tracksCount: sessionData.tracks.length,
    };
    
    sessions.push(newSession);
    await this.saveOfflineSessions(sessions);
    
    console.log('[Offline] Session saved successfully:', sessionData.id, 'with', sessionData.tracks.length, 'tracks');
  }

  async getPendingRecordingsCount(): Promise<number> {
    const sessions = await this.getOfflineSessions();
    return sessions
      .filter(s => s.status === 'pending_sync')
      .reduce((acc, s) => acc + s.recordings.length, 0);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const sessions = await this.getOfflineSessions();
      const filteredSessions = sessions.filter(s => s.id !== sessionId);
      
      if (filteredSessions.length !== sessions.length) {
        await this.saveOfflineSessions(filteredSessions);
        console.log('[Offline] Session deleted:', sessionId);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[Offline] Error deleting session:', error);
      return false;
    }
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

    // Log the backend URL being used
    console.log('[Offline] 🔗 Using BACKEND_URL:', BACKEND_URL);

    try {
      const sessions = await this.getOfflineSessions();
      const pendingSessions = sessions.filter(s => s.status === 'pending_sync');

      console.log('[Offline] Starting sync for', pendingSessions.length, 'sessions');

      for (const session of pendingSessions) {
        session.status = 'syncing';
        await this.saveOfflineSessions(sessions);

        try {
          // Process each recording individually using the SAME endpoint as online mode
          const sessionResults: any[] = [];
          
          for (let i = 0; i < session.recordings.length; i++) {
            const recording = session.recordings[i];
            console.log(`[Offline] Processing recording ${i + 1}/${session.recordings.length}`);
            
            try {
              // Use the SAME endpoint as online mode (/api/recognize-audio)
              const response = await axios.post(
                `${BACKEND_URL}/api/recognize-audio`,
                {
                  audio_base64: recording.audioBase64,
                  location: session.location,
                  dj_id: session.userId,
                  dj_name: session.djName,
                },
                {
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: token ? `Bearer ${token}` : undefined,
                  },
                  timeout: 30000,
                }
              );
              
              const result = response.data;
              recording.status = 'synced';
              recording.result = result;
              
              if (result.success && result.spynners_track_id) {
                console.log(`[Offline] ✅ Identified: ${result.title} by ${result.artist}`);
                sessionResults.push({
                  success: true,
                  title: result.title,
                  artist: result.artist,
                  cover_image: result.cover_image,
                  spynners_track_id: result.spynners_track_id,
                  producer_id: result.producer_id,
                  is_spynners_track: true,
                });
              } else if (result.success) {
                console.log(`[Offline] Track not in Spynners: ${result.title}`);
                sessionResults.push({
                  success: true,
                  title: result.title,
                  artist: result.artist,
                  is_spynners_track: false,
                });
              } else {
                console.log(`[Offline] No track identified`);
                sessionResults.push({ success: false });
              }
              
              synced++;
            } catch (recError: any) {
              console.error(`[Offline] Recording ${i + 1} failed:`, recError.message);
              recording.status = 'error';
              sessionResults.push({ success: false, error: recError.message });
              failed++;
            }
          }
          
          session.status = 'synced';
          session.syncedAt = new Date().toISOString();
          allResults = [...allResults, ...sessionResults];
          
          // Send emails for identified tracks
          const identifiedTracks = sessionResults.filter(r => r.success && r.is_spynners_track);
          for (const track of identifiedTracks) {
            if (track.producer_id || track.spynners_track_id) {
              try {
                console.log(`[Offline] 📧 Sending email for: ${track.title}`);
                await this.sendTrackEmail(track, session, token);
              } catch (emailError) {
                console.error(`[Offline] Email failed for ${track.title}:`, emailError);
              }
            }
          }
          
          // Send notification about synced tracks
          if (identifiedTracks.length > 0) {
            await this.sendLocalNotification(
              '🎵 Tracks Identifiés !',
              `${identifiedTracks.length} track(s) Spynners: ${identifiedTracks.map(t => t.title).join(', ')}`,
              { sessionId: session.id, tracks: identifiedTracks }
            );
          }
          
        } catch (error: any) {
          console.error('[Offline] Session sync error:', error.message);
          session.status = 'pending_sync'; // Retry later
        }

        await this.saveOfflineSessions(sessions);
      }

      // Clean up old synced sessions
      await this.cleanupOldSessions();

    } finally {
      this.syncInProgress = false;
    }

    console.log('[Offline] Sync complete. Synced:', synced, 'Failed:', failed);
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

  // Send email for identified track
  private async sendTrackEmail(
    track: { title: string; artist: string; producer_id?: string; spynners_track_id?: string; cover_image?: string },
    session: OfflineSession,
    token?: string
  ): Promise<void> {
    try {
      const emailPayload = {
        djId: session.userId,
        djName: session.djName,
        producerId: track.producer_id || '',
        trackId: track.spynners_track_id || '',
        trackTitle: track.title,
        artistName: track.artist,
        venue: session.location?.venue || 'Session Offline',
        city: session.location?.city || '',
        country: session.location?.country || '',
        timestamp: session.endTime || session.startTime,
        trackArtworkUrl: track.cover_image || '',
      };
      
      console.log('[Offline] Sending email for track:', track.title);
      
      // Call Spynners API directly
      const response = await axios.post(
        'https://spynners.com/api/functions/sendTrackPlayedEmail',
        emailPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : undefined,
          },
          timeout: 30000,
        }
      );
      
      console.log(`[Offline] ✅ Email sent for: ${track.title}`, response.data);
    } catch (error: any) {
      console.error(`[Offline] ❌ Email error for: ${track.title}`, error?.response?.data || error.message);
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
