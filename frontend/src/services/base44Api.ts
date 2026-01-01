/**
 * Base44 API Service for SPYNNERS
 * Handles all API calls to Base44 backend
 */

import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://api.base44.com/v1';
const APP_ID = '691a4d96d819355b52c063f3';

// Create axios instance with Base44 configuration
const base44Api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-Base44-App-Id': APP_ID,
  },
});

// Add auth token to requests
base44Api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log('[Base44 API] Request:', config.method?.toUpperCase(), config.url);
  return config;
});

// Log responses and errors
base44Api.interceptors.response.use(
  (response) => {
    console.log('[Base44 API] Response:', response.status, response.config.url);
    return response;
  },
  (error: AxiosError) => {
    console.error('[Base44 API] Error:', error.response?.status, error.message, error.config?.url);
    return Promise.reject(error);
  }
);

// ==================== AUTH ====================

export const base44Auth = {
  async login(email: string, password: string) {
    const response = await base44Api.post(`/apps/${APP_ID}/auth/login`, {
      email,
      password,
    });
    return response.data;
  },

  async signup(email: string, password: string, fullName: string, userType?: string) {
    const response = await base44Api.post(`/apps/${APP_ID}/auth/signup`, {
      email,
      password,
      full_name: fullName,
      user_type: userType,
    });
    return response.data;
  },

  async me() {
    const response = await base44Api.get(`/apps/${APP_ID}/auth/me`);
    return response.data;
  },
};

// ==================== TRACKS ====================

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
      
      // Build query object for Base44 API
      const queryParams: Record<string, string> = {};
      if (filters?.genre) queryParams.genre = filters.genre;
      if (filters?.energy_level) queryParams.energy_level = filters.energy_level;
      if (filters?.sort) queryParams.sort = filters.sort;
      if (filters?.limit) queryParams.limit = filters.limit.toString();
      if (filters?.is_vip !== undefined) queryParams.is_vip = filters.is_vip.toString();

      const queryString = new URLSearchParams(queryParams).toString();
      const url = `/apps/${APP_ID}/entities/Track${queryString ? `?${queryString}` : ''}`;
      
      console.log('[Tracks] API URL:', url);
      
      const response = await base44Api.get(url);
      console.log('[Tracks] Response data:', JSON.stringify(response.data).substring(0, 500));
      
      // Base44 returns either { items: [...] } or directly [...]
      const tracks = response.data?.items || response.data || [];
      console.log('[Tracks] Parsed tracks count:', tracks.length);
      
      return Array.isArray(tracks) ? tracks : [];
    } catch (error: any) {
      console.error('[Tracks] Error fetching tracks:', error?.response?.status, error?.message);
      console.error('[Tracks] Error details:', error?.response?.data);
      // Return empty array on error, let the UI show demo tracks
      return [];
    }
  },

  // Get VIP tracks only
  async listVIP() {
    return this.list({ is_vip: true });
  },

  // Get single track
  async get(trackId: string) {
    try {
      const response = await base44Api.get(`/apps/${APP_ID}/entities/Track/${trackId}`);
      return response.data;
    } catch (error) {
      console.error('[Tracks] Error getting track:', error);
      throw error;
    }
  },

  // Create new track
  async create(track: Track) {
    const response = await base44Api.post(`/apps/${APP_ID}/entities/Track`, track);
    return response.data;
  },

  // Update track
  async update(trackId: string, updates: Partial<Track>) {
    const response = await base44Api.put(`/apps/${APP_ID}/entities/Track/${trackId}`, updates);
    return response.data;
  },

  // Delete track
  async delete(trackId: string) {
    const response = await base44Api.delete(`/apps/${APP_ID}/entities/Track/${trackId}`);
    return response.data;
  },

  // Search tracks
  async search(query: string) {
    try {
      const response = await base44Api.get(`/apps/${APP_ID}/entities/Track?search=${encodeURIComponent(query)}`);
      const tracks = response.data?.items || response.data || [];
      return Array.isArray(tracks) ? tracks : [];
    } catch (error) {
      console.error('[Tracks] Search error:', error);
      return [];
    }
  },

  // Get my uploads
  async myUploads(userId: string) {
    try {
      const response = await base44Api.get(`/apps/${APP_ID}/entities/Track?uploaded_by=${userId}`);
      const tracks = response.data?.items || response.data || [];
      return Array.isArray(tracks) ? tracks : [];
    } catch (error) {
      console.error('[Tracks] Error getting my uploads:', error);
      return [];
    }
  },

  // Rate a track
  async rate(trackId: string, rating: number) {
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

  // Increment download count
  async download(trackId: string) {
    try {
      const response = await base44Api.post(`/apps/${APP_ID}/functions/invoke/download_track`, {
        track_id: trackId,
      });
      return response.data;
    } catch (error) {
      console.error('[Tracks] Error recording download:', error);
    }
  },

  // Increment play count
  async play(trackId: string) {
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

// ==================== USERS ====================

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

export const base44Users = {
  async list(filters?: { user_type?: string; search?: string }) {
    const params = new URLSearchParams();
    if (filters?.user_type) params.append('user_type', filters.user_type);
    if (filters?.search) params.append('search', filters.search);

    const response = await base44Api.get(`/apps/${APP_ID}/entities/users?${params.toString()}`);
    return response.data;
  },

  async get(userId: string) {
    const response = await base44Api.get(`/apps/${APP_ID}/entities/users/${userId}`);
    return response.data;
  },

  async searchProducersAndLabels(query: string) {
    const response = await base44Api.get(
      `/apps/${APP_ID}/entities/users?search=${encodeURIComponent(query)}&user_type_in=producer,label,dj_producer`
    );
    return response.data;
  },
};

// ==================== PLAYLISTS ====================

export interface Playlist {
  id?: string;
  _id?: string;
  name: string;
  user_id: string;
  tracks: string[];
  is_public?: boolean;
  created_at?: string;
}

export const base44Playlists = {
  async list(userId: string) {
    const response = await base44Api.get(`/apps/${APP_ID}/entities/playlists?user_id=${userId}`);
    return response.data;
  },

  async create(playlist: Playlist) {
    const response = await base44Api.post(`/apps/${APP_ID}/entities/playlists`, playlist);
    return response.data;
  },

  async addTrack(playlistId: string, trackId: string) {
    const response = await base44Api.post(`/apps/${APP_ID}/functions/invoke/add_to_playlist`, {
      playlist_id: playlistId,
      track_id: trackId,
    });
    return response.data;
  },

  async removeTrack(playlistId: string, trackId: string) {
    const response = await base44Api.post(`/apps/${APP_ID}/functions/invoke/remove_from_playlist`, {
      playlist_id: playlistId,
      track_id: trackId,
    });
    return response.data;
  },
};

// ==================== FILE UPLOAD ====================

export const base44Files = {
  // Upload file to Base44 storage
  async upload(fileUri: string, fileName: string, mimeType: string) {
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
  },

  // Get file URL
  getUrl(fileId: string) {
    return `${BASE_URL}/apps/${APP_ID}/storage/files/${fileId}`;
  },
};

// ==================== ADMIN FUNCTIONS ====================

export const base44Admin = {
  // Get pending tracks for approval
  async getPendingTracks() {
    const response = await base44Api.get(`/apps/${APP_ID}/entities/tracks?status=pending`);
    return response.data;
  },

  // Approve track
  async approveTrack(trackId: string) {
    const response = await base44Api.put(`/apps/${APP_ID}/entities/tracks/${trackId}`, {
      status: 'approved',
      is_approved: true,
    });
    return response.data;
  },

  // Reject track
  async rejectTrack(trackId: string, reason?: string) {
    const response = await base44Api.put(`/apps/${APP_ID}/entities/tracks/${trackId}`, {
      status: 'rejected',
      rejection_reason: reason,
    });
    return response.data;
  },

  // Get all users (admin only)
  async getAllUsers() {
    const response = await base44Api.get(`/apps/${APP_ID}/entities/users`);
    return response.data;
  },

  // Get analytics
  async getAnalytics() {
    const response = await base44Api.post(`/apps/${APP_ID}/functions/invoke/get_analytics`);
    return response.data;
  },

  // Get download stats
  async getDownloadStats() {
    const response = await base44Api.post(`/apps/${APP_ID}/functions/invoke/get_download_stats`);
    return response.data;
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
};
