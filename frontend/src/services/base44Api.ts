/**
 * Base44 API Service for SPYNNERS
 * Uses backend proxy to avoid CORS issues
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Get backend URL from environment
const getBackendUrl = () => {
  // For web preview, use relative URL
  if (typeof window !== 'undefined') {
    return '';  // Use relative URLs which will go through the proxy
  }
  // For mobile, use the configured backend URL
  return Constants.expoConfig?.extra?.backendUrl || 
         process.env.EXPO_PUBLIC_BACKEND_URL || 
         'https://trackhub-20.preview.emergentagent.com';
};

const BACKEND_URL = getBackendUrl();
const BASE44_APP_ID = '691a4d96d819355b52c063f3';

// Storage keys
const AUTH_TOKEN_KEY = 'auth_token';
const USER_KEY = 'user';

// Create axios instance
const createApi = (): AxiosInstance => {
  const api = axios.create({
    baseURL: BACKEND_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add auth token to requests
  api.interceptors.request.use(async (config) => {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // Ignore storage errors (SSR)
    }
    console.log('[API] Request:', config.method?.toUpperCase(), config.url);
    return config;
  });

  // Log responses and errors
  api.interceptors.response.use(
    (response) => {
      console.log('[API] Response:', response.status, response.config.url);
      return response;
    },
    (error: AxiosError) => {
      console.error('[API] Error:', error.response?.status, error.message);
      return Promise.reject(error);
    }
  );

  return api;
};

const api = createApi();

// ==================== TRACK TYPE ====================

export interface Track {
  id?: string;
  _id?: string;
  title: string;
  artist_name: string;
  label_name?: string;
  collaborators?: string[];
  genre: string;
  bpm?: number;
  key?: string;
  energy_level?: string;
  mood?: string;
  release_date?: string;
  isrc_code?: string;
  iswc_code?: string;
  description?: string;
  cover_image?: string;
  audio_file?: string;
  audio_url?: string;
  is_unreleased?: boolean;
  is_vip?: boolean;
  is_approved?: boolean;
  rights_confirmed?: boolean;
  free_download_authorized?: boolean;
  uploaded_by?: string;
  uploaded_for?: string;
  rating?: number;
  download_count?: number;
  play_count?: number;
  created_at?: string;
  status?: string;
}

// ==================== TRACKS SERVICE ====================

export const base44Tracks = {
  // Get all tracks with optional filters
  async list(filters?: {
    genre?: string;
    energy_level?: string;
    sort?: string;
    limit?: number;
    is_vip?: boolean;
  }): Promise<Track[]> {
    try {
      console.log('[Tracks] Fetching tracks with filters:', filters);
      
      // Build query parameters
      const params = new URLSearchParams();
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.sort) params.append('sort', filters.sort);
      if (filters?.genre) params.append('genre', filters.genre);
      if (filters?.energy_level) params.append('energy_level', filters.energy_level);
      if (filters?.is_vip !== undefined) params.append('is_vip', filters.is_vip.toString());

      const url = `/apps/${APP_ID}/entities/Track${params.toString() ? `?${params.toString()}` : ''}`;
      console.log('[Tracks] API URL:', url);
      
      const response = await base44Api.get(url);
      console.log('[Tracks] Response data type:', typeof response.data);
      
      // Handle different response formats
      const data = response.data;
      let tracks: Track[] = [];
      
      if (Array.isArray(data)) {
        tracks = data;
      } else if (data?.items && Array.isArray(data.items)) {
        tracks = data.items;
      } else if (data?.data && Array.isArray(data.data)) {
        tracks = data.data;
      }
      
      console.log('[Tracks] Parsed tracks count:', tracks.length);
      return tracks;
    } catch (error: any) {
      console.error('[Tracks] Error fetching tracks:', error?.response?.status, error?.message);
      return [];
    }
  },

  // Get VIP tracks only
  async listVIP(): Promise<Track[]> {
    return this.list({ is_vip: true });
  },

  // Get single track
  async get(trackId: string): Promise<Track | null> {
    try {
      const response = await base44Api.get(`/apps/${APP_ID}/entities/Track/${trackId}`);
      return response.data;
    } catch (error) {
      console.error('[Tracks] Error getting track:', error);
      return null;
    }
  },

  // Create new track
  async create(track: Partial<Track>): Promise<Track | null> {
    try {
      const response = await base44Api.post(`/apps/${APP_ID}/entities/Track`, track);
      return response.data;
    } catch (error) {
      console.error('[Tracks] Error creating track:', error);
      throw error;
    }
  },

  // Update track
  async update(trackId: string, updates: Partial<Track>): Promise<Track | null> {
    try {
      const response = await base44Api.put(`/apps/${APP_ID}/entities/Track/${trackId}`, updates);
      return response.data;
    } catch (error) {
      console.error('[Tracks] Error updating track:', error);
      throw error;
    }
  },

  // Delete track
  async delete(trackId: string): Promise<boolean> {
    try {
      await base44Api.delete(`/apps/${APP_ID}/entities/Track/${trackId}`);
      return true;
    } catch (error) {
      console.error('[Tracks] Error deleting track:', error);
      return false;
    }
  },

  // Search tracks
  async search(query: string): Promise<Track[]> {
    try {
      const response = await base44Api.get(`/apps/${APP_ID}/entities/Track?search=${encodeURIComponent(query)}`);
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[Tracks] Search error:', error);
      return [];
    }
  },

  // Get my uploads
  async myUploads(userId: string): Promise<Track[]> {
    try {
      const response = await base44Api.get(`/apps/${APP_ID}/entities/Track?uploaded_by=${userId}`);
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[Tracks] Error getting my uploads:', error);
      return [];
    }
  },

  // Rate a track (via function invoke)
  async rate(trackId: string, rating: number): Promise<any> {
    try {
      const response = await base44Api.post(`/apps/${APP_ID}/functions/invoke/rate_track`, {
        track_id: trackId,
        rating,
      });
      return response.data;
    } catch (error) {
      console.error('[Tracks] Error rating track:', error);
    }
  },

  // Increment download count (via function invoke)
  async download(trackId: string): Promise<any> {
    try {
      const response = await base44Api.post(`/apps/${APP_ID}/functions/invoke/download_track`, {
        track_id: trackId,
      });
      return response.data;
    } catch (error) {
      console.error('[Tracks] Error recording download:', error);
    }
  },

  // Increment play count (via function invoke)
  async play(trackId: string): Promise<any> {
    try {
      const response = await base44Api.post(`/apps/${APP_ID}/functions/invoke/play_track`, {
        track_id: trackId,
      });
      return response.data;
    } catch (error) {
      console.error('[Tracks] Error recording play:', error);
    }
  },
};

// ==================== USER TYPE ====================

export interface User {
  id?: string;
  _id?: string;
  email: string;
  full_name: string;
  user_type?: string;
  avatar?: string;
  is_admin?: boolean;
  diamonds?: number;
  is_vip?: boolean;
}

// ==================== AUTH SERVICE ====================

export const base44Auth = {
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    try {
      console.log('[Auth] Logging in:', email);
      const response = await base44Api.post(`/apps/${APP_ID}/auth/login`, {
        email,
        password,
      });
      
      const { token, user } = response.data;
      
      // Save to storage
      if (token) {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      }
      
      console.log('[Auth] Login successful');
      return response.data;
    } catch (error: any) {
      console.error('[Auth] Login error:', error?.response?.data || error?.message);
      throw new Error(error?.response?.data?.message || 'Login failed');
    }
  },

  async signup(email: string, password: string, fullName: string, userType?: string): Promise<{ token: string; user: User }> {
    try {
      console.log('[Auth] Signing up:', email);
      const response = await base44Api.post(`/apps/${APP_ID}/auth/signup`, {
        email,
        password,
        full_name: fullName,
        user_type: userType,
      });
      
      const { token, user } = response.data;
      
      // Save to storage
      if (token) {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify({ ...user, user_type: userType }));
      }
      
      console.log('[Auth] Signup successful');
      return response.data;
    } catch (error: any) {
      console.error('[Auth] Signup error:', error?.response?.data || error?.message);
      throw new Error(error?.response?.data?.message || 'Signup failed');
    }
  },

  async me(): Promise<User | null> {
    try {
      const response = await base44Api.get(`/apps/${APP_ID}/auth/me`);
      return response.data;
    } catch (error) {
      console.error('[Auth] Error getting current user:', error);
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      console.log('[Auth] Logged out');
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    }
  },

  async getStoredUser(): Promise<User | null> {
    try {
      const userJson = await AsyncStorage.getItem(USER_KEY);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error('[Auth] Error getting stored user:', error);
      return null;
    }
  },

  async getStoredToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    } catch (error) {
      console.error('[Auth] Error getting stored token:', error);
      return null;
    }
  },
};

// ==================== USERS SERVICE ====================

export const base44Users = {
  async list(filters?: { user_type?: string; search?: string }): Promise<User[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.user_type) params.append('user_type', filters.user_type);
      if (filters?.search) params.append('search', filters.search);

      const response = await base44Api.get(`/apps/${APP_ID}/entities/User?${params.toString()}`);
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[Users] Error listing users:', error);
      return [];
    }
  },

  async get(userId: string): Promise<User | null> {
    try {
      const response = await base44Api.get(`/apps/${APP_ID}/entities/User/${userId}`);
      return response.data;
    } catch (error) {
      console.error('[Users] Error getting user:', error);
      return null;
    }
  },

  async searchProducersAndLabels(query: string): Promise<User[]> {
    try {
      const response = await base44Api.get(
        `/apps/${APP_ID}/entities/User?search=${encodeURIComponent(query)}&user_type_in=producer,label,dj_producer`
      );
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[Users] Error searching producers/labels:', error);
      return [];
    }
  },
};

// ==================== PLAYLIST TYPE ====================

export interface Playlist {
  id?: string;
  _id?: string;
  name: string;
  user_id: string;
  tracks: string[];
  is_public?: boolean;
  created_at?: string;
}

// ==================== PLAYLISTS SERVICE ====================

export const base44Playlists = {
  async list(userId: string): Promise<Playlist[]> {
    try {
      const response = await base44Api.get(`/apps/${APP_ID}/entities/Playlist?user_id=${userId}`);
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[Playlists] Error listing playlists:', error);
      return [];
    }
  },

  async create(playlist: Partial<Playlist>): Promise<Playlist | null> {
    try {
      const response = await base44Api.post(`/apps/${APP_ID}/entities/Playlist`, playlist);
      return response.data;
    } catch (error) {
      console.error('[Playlists] Error creating playlist:', error);
      throw error;
    }
  },

  async addTrack(playlistId: string, trackId: string): Promise<any> {
    try {
      const response = await base44Api.post(`/apps/${APP_ID}/functions/invoke/add_to_playlist`, {
        playlist_id: playlistId,
        track_id: trackId,
      });
      return response.data;
    } catch (error) {
      console.error('[Playlists] Error adding track to playlist:', error);
      throw error;
    }
  },

  async removeTrack(playlistId: string, trackId: string): Promise<any> {
    try {
      const response = await base44Api.post(`/apps/${APP_ID}/functions/invoke/remove_from_playlist`, {
        playlist_id: playlistId,
        track_id: trackId,
      });
      return response.data;
    } catch (error) {
      console.error('[Playlists] Error removing track from playlist:', error);
      throw error;
    }
  },
};

// ==================== FILES SERVICE ====================

export const base44Files = {
  // Upload file to Base44 storage
  async upload(fileUri: string, fileName: string, mimeType: string): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: mimeType,
      } as any);

      const response = await base44Api.post(`/apps/${APP_ID}/storage/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('[Files] Error uploading file:', error);
      throw error;
    }
  },

  // Get file URL
  getUrl(fileId: string): string {
    return `${BASE_URL}/apps/${APP_ID}/storage/files/${fileId}`;
  },
};

// ==================== ADMIN SERVICE ====================

export const base44Admin = {
  // Get pending tracks for approval
  async getPendingTracks(): Promise<Track[]> {
    try {
      const response = await base44Api.get(`/apps/${APP_ID}/entities/Track?status=pending`);
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[Admin] Error getting pending tracks:', error);
      return [];
    }
  },

  // Approve track
  async approveTrack(trackId: string): Promise<Track | null> {
    try {
      const response = await base44Api.put(`/apps/${APP_ID}/entities/Track/${trackId}`, {
        status: 'approved',
        is_approved: true,
      });
      return response.data;
    } catch (error) {
      console.error('[Admin] Error approving track:', error);
      throw error;
    }
  },

  // Reject track
  async rejectTrack(trackId: string, reason?: string): Promise<Track | null> {
    try {
      const response = await base44Api.put(`/apps/${APP_ID}/entities/Track/${trackId}`, {
        status: 'rejected',
        rejection_reason: reason,
      });
      return response.data;
    } catch (error) {
      console.error('[Admin] Error rejecting track:', error);
      throw error;
    }
  },

  // Get all users (admin only)
  async getAllUsers(): Promise<User[]> {
    try {
      const response = await base44Api.get(`/apps/${APP_ID}/entities/User`);
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[Admin] Error getting all users:', error);
      return [];
    }
  },

  // Get analytics (via function invoke)
  async getAnalytics(): Promise<any> {
    try {
      const response = await base44Api.post(`/apps/${APP_ID}/functions/invoke/get_analytics`);
      return response.data;
    } catch (error) {
      console.error('[Admin] Error getting analytics:', error);
      return null;
    }
  },

  // Get download stats (via function invoke)
  async getDownloadStats(): Promise<any> {
    try {
      const response = await base44Api.post(`/apps/${APP_ID}/functions/invoke/get_download_stats`);
      return response.data;
    } catch (error) {
      console.error('[Admin] Error getting download stats:', error);
      return null;
    }
  },
};

// ==================== SPYN NOTIFICATION SERVICE ====================

export const base44Notifications = {
  // Send track played notification email to producer
  async sendTrackPlayedEmail(params: {
    track_id: string;
    track_title: string;
    artist_name: string;
    dj_name: string;
    club_name?: string;
    location?: string;
    played_at?: string;
  }): Promise<any> {
    try {
      console.log('[Notifications] Sending track played email:', params);
      const response = await base44Api.post(`/apps/${APP_ID}/functions/invoke/sendTrackPlayedEmail`, params);
      console.log('[Notifications] Email sent successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('[Notifications] Error sending track played email:', error);
      throw error;
    }
  },
};

// Export default api object
export default {
  auth: base44Auth,
  tracks: base44Tracks,
  users: base44Users,
  playlists: base44Playlists,
  files: base44Files,
  admin: base44Admin,
  notifications: base44Notifications,
};
