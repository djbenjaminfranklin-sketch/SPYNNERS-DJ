/**
 * Base44 API Service for SPYNNERS
 * Uses backend proxy to avoid CORS issues in web preview
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Backend URL - hardcoded for reliability in production builds
const BACKEND_URL = 'https://spyn-rebuild.preview.emergentagent.com';

console.log('[API] Using backend URL:', BACKEND_URL);

// Storage keys
const AUTH_TOKEN_KEY = 'auth_token';
const USER_KEY = 'user';

// Create axios instance
const createApi = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: BACKEND_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add auth token to requests
  instance.interceptors.request.use(async (config) => {
    try {
      let token = null;
      
      // Try AsyncStorage first
      try {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      } catch (e) {
        // AsyncStorage might not work on web SSR
      }
      
      // Fallback to localStorage for web
      if (!token && typeof window !== 'undefined' && window.localStorage) {
        token = window.localStorage.getItem(AUTH_TOKEN_KEY);
      }
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('[API] Token attached to request');
      } else {
        console.log('[API] No token found');
      }
    } catch (e) {
      console.error('[API] Error getting token:', e);
    }
    console.log('[API] Request:', config.method?.toUpperCase(), config.url);
    return config;
  });

  // Log responses and errors
  instance.interceptors.response.use(
    (response) => {
      console.log('[API] Response:', response.status, response.config.url);
      return response;
    },
    (error: AxiosError) => {
      console.error('[API] Error:', error.response?.status, error.message);
      return Promise.reject(error);
    }
  );

  return instance;
};

const api = createApi();

// ==================== TRACK TYPE ====================

export interface Track {
  id?: string;
  _id?: string;
  title: string;
  // Old fields (for compatibility)
  artist_name?: string;
  cover_image?: string;
  audio_file?: string;
  // New Base44 fields
  producer_id?: string;
  producer_name?: string;
  collaborators?: string[];
  genre: string;
  bpm?: number;
  key?: string;
  energy_level?: string;
  mood?: string;
  description?: string;
  artwork_url?: string;
  email_artwork_url?: string;
  audio_url?: string;
  duration?: number;
  isrc?: string;
  iswc?: string;
  status?: string; // 'approved', 'pending', 'rejected'
  play_count?: number;
  download_count?: number;
  average_rating?: number;
  rating_count?: number;
  release_date?: string;
  free_download_agreement?: boolean;
  acrcloud_id?: string;
  needs_label?: boolean;
  is_vip?: boolean;
  vip_requested?: boolean;
  vip_preview_start?: number;
  vip_preview_end?: number;
  created_date?: string;
  updated_date?: string;
  created_by_id?: string;
  is_sample?: boolean;
  // Legacy fields
  label_name?: string;
  isrc_code?: string;
  iswc_code?: string;
  is_unreleased?: boolean;
  is_approved?: boolean;
  rights_confirmed?: boolean;
  free_download_authorized?: boolean;
  uploaded_by?: string;
  uploaded_for?: string;
  rating?: number;
  created_at?: string;
}

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

// ==================== PUBLIC PROFILE TYPE ====================

export interface PublicProfile {
  id: string;
  full_name: string;
  artist_name?: string;
  email?: string;
  avatar_url?: string;
  generated_avatar_url?: string;
  bio?: string;
  location?: string;
  country?: string;
  genres?: string[];
  social_links?: {
    instagram?: string;
    soundcloud?: string;
    spotify?: string;
    beatport?: string;
    youtube?: string;
    facebook?: string;
    twitter?: string;
    website?: string;
  };
  black_diamonds?: number;
  sacem_number?: string;
  user_type?: string;
  stats?: {
    tracks_count?: number;
    total_plays?: number;
    total_downloads?: number;
    followers_count?: number;
  };
}

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

// ==================== AUTH SERVICE ====================

export const base44Auth = {
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    try {
      console.log('[Auth] Logging in via proxy:', email);
      const response = await api.post('/api/base44/auth/login', {
        email,
        password,
      });
      
      // Base44 returns access_token, not token
      const token = response.data.access_token || response.data.token;
      const user = response.data.user;
      
      console.log('[Auth] Token received:', token ? 'Yes' : 'No');
      
      // Save to storage
      if (token) {
        console.log('[Auth] Saving token...');
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
        
        // Also save to localStorage for web compatibility
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(AUTH_TOKEN_KEY, token);
          window.localStorage.setItem(USER_KEY, JSON.stringify(user));
          console.log('[Auth] Token saved to localStorage');
        }
      } else {
        console.error('[Auth] No token received from login!');
      }
      
      console.log('[Auth] Login successful, token saved');
      return { token, user };
    } catch (error: any) {
      console.error('[Auth] Login error:', error?.response?.data || error?.message);
      throw new Error(error?.response?.data?.detail || error?.response?.data?.message || 'Login failed');
    }
  },

  async signup(email: string, password: string, fullName: string, userType?: string): Promise<{ token: string; user: User }> {
    try {
      console.log('[Auth] Signing up via proxy:', email);
      const response = await api.post('/api/base44/auth/signup', {
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
      throw new Error(error?.response?.data?.detail || error?.response?.data?.message || 'Signup failed');
    }
  },

  async me(): Promise<User | null> {
    try {
      const response = await api.get('/api/base44/auth/me');
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

// ==================== TRACKS SERVICE ====================

export const base44Tracks = {
  async list(filters?: {
    genre?: string;
    energy_level?: string;
    sort?: string;
    limit?: number;
    is_vip?: boolean;
  }): Promise<Track[]> {
    try {
      console.log('[Tracks] Fetching tracks via native API with filters:', filters);
      
      // Try native API first
      try {
        const nativeResponse = await api.post('/api/tracks/all', {
          genre: filters?.genre,
          limit: filters?.limit || 100,
          offset: 0
        });
        
        if (nativeResponse.data?.success && nativeResponse.data?.tracks) {
          console.log('[Tracks] Native API returned:', nativeResponse.data.tracks.length, 'tracks');
          return nativeResponse.data.tracks;
        }
        if (Array.isArray(nativeResponse.data)) {
          console.log('[Tracks] Native API returned array:', nativeResponse.data.length, 'tracks');
          return nativeResponse.data;
        }
      } catch (nativeError) {
        console.log('[Tracks] Native API failed, falling back to Base44...');
      }
      
      // Fallback to Base44 entities
      const params = new URLSearchParams();
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.sort) params.append('sort', filters.sort);
      if (filters?.genre) params.append('genre', filters.genre);
      if (filters?.energy_level) params.append('energy_level', filters.energy_level);
      if (filters?.is_vip !== undefined) params.append('is_vip', filters.is_vip.toString());

      const url = `/api/base44/entities/Track${params.toString() ? `?${params.toString()}` : ''}`;
      console.log('[Tracks] Fallback API URL:', url);
      
      const response = await api.get(url);
      
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

  async listVIP(): Promise<Track[]> {
    return this.list({ is_vip: true });
  },

  async get(trackId: string): Promise<Track | null> {
    try {
      const response = await api.get(`/api/base44/entities/Track/${trackId}`);
      return response.data;
    } catch (error) {
      console.error('[Tracks] Error getting track:', error);
      return null;
    }
  },

  async create(track: Partial<Track>): Promise<Track | null> {
    try {
      const response = await api.post('/api/base44/entities/Track', track);
      return response.data;
    } catch (error) {
      console.error('[Tracks] Error creating track:', error);
      throw error;
    }
  },

  async update(trackId: string, updates: Partial<Track>): Promise<Track | null> {
    try {
      const response = await api.put(`/api/base44/entities/Track/${trackId}`, updates);
      return response.data;
    } catch (error) {
      console.error('[Tracks] Error updating track:', error);
      throw error;
    }
  },

  async delete(trackId: string): Promise<boolean> {
    try {
      await api.delete(`/api/base44/entities/Track/${trackId}`);
      return true;
    } catch (error) {
      console.error('[Tracks] Error deleting track:', error);
      return false;
    }
  },

  async search(query: string): Promise<Track[]> {
    try {
      console.log('[Tracks] Searching for:', query);
      // Base44 doesn't have a global search, so we fetch all tracks and filter client-side
      const response = await api.get(`/api/base44/entities/Track?limit=500`);
      const data = response.data;
      let tracks: Track[] = [];
      
      if (Array.isArray(data)) {
        tracks = data;
      } else if (data?.items) {
        tracks = data.items;
      }
      
      // Filter tracks by query (title, artist, genre, producer)
      const queryLower = query.toLowerCase();
      const filtered = tracks.filter((track: Track) => {
        const title = (track.title || '').toLowerCase();
        const artist = (track.artist_name || track.producer_name || '').toLowerCase();
        const genre = (track.genre || '').toLowerCase();
        const producer = (track.producer_name || '').toLowerCase();
        
        return title.includes(queryLower) || 
               artist.includes(queryLower) || 
               genre.includes(queryLower) ||
               producer.includes(queryLower);
      });
      
      console.log('[Tracks] Search results:', filtered.length, 'tracks found');
      return filtered;
    } catch (error) {
      console.error('[Tracks] Search error:', error);
      return [];
    }
  },

  async myUploads(userId: string): Promise<Track[]> {
    try {
      const response = await api.get(`/api/base44/entities/Track?uploaded_by=${userId}`);
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[Tracks] Error getting my uploads:', error);
      return [];
    }
  },

  async rate(trackId: string, rating: number): Promise<any> {
    try {
      const response = await api.post('/api/base44/functions/invoke/rate_track', {
        track_id: trackId,
        rating,
      });
      return response.data;
    } catch (error) {
      console.error('[Tracks] Error rating track:', error);
    }
  },

  async download(trackId: string): Promise<any> {
    try {
      const response = await api.post('/api/base44/functions/invoke/download_track', {
        track_id: trackId,
      });
      return response.data;
    } catch (error) {
      console.error('[Tracks] Error recording download:', error);
    }
  },

  async play(trackId: string): Promise<any> {
    try {
      const response = await api.post('/api/base44/functions/invoke/play_track', {
        track_id: trackId,
      });
      return response.data;
    } catch (error) {
      console.error('[Tracks] Error recording play:', error);
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

      const response = await api.get(`/api/base44/entities/User?${params.toString()}`);
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[Users] Error listing users:', error);
      return [];
    }
  },

  // Native function to get all users with pagination (for chat/members list)
  async nativeGetAllUsers(params?: { search?: string; limit?: number; offset?: number }): Promise<User[]> {
    try {
      console.log('[Users] Fetching all users via nativeGetAllUsers:', params);
      const response = await api.post('/api/base44/functions/invoke/nativeGetAllUsers', {
        search: params?.search || '',
        limit: params?.limit || 100,
        offset: params?.offset || 0,
      });
      
      const data = response.data;
      console.log('[Users] nativeGetAllUsers response:', data);
      
      // Handle different response formats
      if (Array.isArray(data)) return data;
      if (data?.users) return data.users;
      if (data?.items) return data.items;
      if (data?.data) return data.data;
      return [];
    } catch (error) {
      console.error('[Users] Error in nativeGetAllUsers:', error);
      return [];
    }
  },

  // Fetch all users by extracting unique producers from all tracks
  async fetchAllUsersFromTracks(): Promise<User[]> {
    try {
      console.log('[Users] Fetching all users from tracks with pagination...');
      const allUsers = new Map<string, User>();
      const pageSize = 200;
      let offset = 0;
      let hasMore = true;
      let totalTracksProcessed = 0;
      
      while (hasMore) {
        const params = new URLSearchParams();
        params.append('limit', pageSize.toString());
        params.append('offset', offset.toString());
        
        const response = await api.get(`/api/base44/entities/Track?${params.toString()}`);
        const data = response.data;
        
        let tracks: any[] = [];
        if (Array.isArray(data)) {
          tracks = data;
        } else if (data?.items) {
          tracks = data.items;
        } else if (data?.data) {
          tracks = data.data;
        }
        
        console.log(`[Users] Fetched ${tracks.length} tracks at offset ${offset}`);
        
        if (tracks.length > 0) {
          tracks.forEach((track: any) => {
            // Extract producer info
            const producerId = track.producer_id || track.created_by_id || track.uploaded_by || '';
            const producerName = track.producer_name || track.artist_name || 'Unknown';
            
            if (producerId && !allUsers.has(producerId)) {
              allUsers.set(producerId, {
                id: producerId,
                _id: producerId,
                email: '',
                full_name: producerName,
                user_type: 'producer',
              });
            }
            
            // Also check collaborators
            if (track.collaborators && Array.isArray(track.collaborators)) {
              track.collaborators.forEach((collab: any) => {
                const collabId = typeof collab === 'string' ? collab : collab.id || collab._id;
                const collabName = typeof collab === 'string' ? collab : collab.name || collab.full_name;
                if (collabId && !allUsers.has(collabId)) {
                  allUsers.set(collabId, {
                    id: collabId,
                    _id: collabId,
                    email: '',
                    full_name: collabName || 'Unknown',
                    user_type: 'producer',
                  });
                }
              });
            }
          });
          
          totalTracksProcessed += tracks.length;
          offset += pageSize;
          
          // If we got less than the page size, we're done
          if (tracks.length < pageSize) {
            hasMore = false;
          }
          
          // Safety limit to prevent infinite loops (max 5000 tracks = ~25 requests)
          if (offset >= 5000) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
      
      console.log(`[Users] Total tracks processed: ${totalTracksProcessed}, Unique users found: ${allUsers.size}`);
      return Array.from(allUsers.values());
    } catch (error) {
      console.error('[Users] Error fetching users from tracks:', error);
      return [];
    }
  },

  // Fetch all users with pagination (fetches multiple pages)
  async fetchAllUsersWithPagination(searchQuery?: string): Promise<User[]> {
    try {
      console.log('[Users] Fetching all users with pagination...');
      
      // First try the native function
      const nativeUsers = await this.nativeGetAllUsers({
        search: searchQuery || '',
        limit: 100,
        offset: 0,
      });
      
      if (nativeUsers.length > 0) {
        console.log('[Users] Got users from nativeGetAllUsers:', nativeUsers.length);
        
        // If we got some users, try to paginate to get more
        if (nativeUsers.length >= 100) {
          let allUsers = [...nativeUsers];
          let offset = 100;
          let hasMore = true;
          
          while (hasMore && offset < 2000) {
            const moreUsers = await this.nativeGetAllUsers({
              search: searchQuery || '',
              limit: 100,
              offset,
            });
            
            if (moreUsers.length > 0) {
              allUsers.push(...moreUsers);
              offset += 100;
              if (moreUsers.length < 100) hasMore = false;
            } else {
              hasMore = false;
            }
          }
          
          return allUsers;
        }
        
        return nativeUsers;
      }
      
      // If native function failed, fallback to extracting from tracks
      console.log('[Users] Falling back to extracting users from tracks...');
      return await this.fetchAllUsersFromTracks();
    } catch (error) {
      console.error('[Users] Error fetching all users with pagination:', error);
      // Fallback to tracks
      return await this.fetchAllUsersFromTracks();
    }
  },

  async get(userId: string): Promise<User | null> {
    try {
      const response = await api.get(`/api/base44/entities/User/${userId}`);
      return response.data;
    } catch (error) {
      console.error('[Users] Error getting user:', error);
      return null;
    }
  },

  async searchProducersAndLabels(query: string): Promise<User[]> {
    try {
      const response = await api.get(
        `/api/base44/entities/User?search=${encodeURIComponent(query)}&user_type_in=producer,label,dj_producer`
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

// ==================== PLAYLISTS SERVICE ====================

export const base44Playlists = {
  async list(userId?: string): Promise<Playlist[]> {
    try {
      console.log('[Playlists] Fetching playlists via native API...');
      // Try native API first
      const response = await api.post('/api/playlists', {
        limit: 100,
        offset: 0
      });
      
      // Handle different response formats
      if (response.data?.success && response.data?.playlists) {
        return response.data.playlists;
      }
      if (Array.isArray(response.data)) return response.data;
      if (response.data?.items) return response.data.items;
      
      // Fallback to Base44 entities
      console.log('[Playlists] Native API failed, trying Base44 entities...');
      const fallbackResponse = await api.get('/api/base44/entities/Playlist?limit=100');
      const data = fallbackResponse.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[Playlists] Error listing playlists:', error);
      // Fallback to Base44 entities
      try {
        const fallbackResponse = await api.get('/api/base44/entities/Playlist?limit=100');
        const data = fallbackResponse.data;
        if (Array.isArray(data)) return data;
        if (data?.items) return data.items;
      } catch (e) {
        console.error('[Playlists] Fallback also failed:', e);
      }
      return [];
    }
  },

  async create(playlist: Partial<Playlist>): Promise<Playlist | null> {
    try {
      // Try native create first, fallback to Base44
      const response = await api.post('/api/base44/entities/Playlist', playlist);
      return response.data;
    } catch (error) {
      console.error('[Playlists] Error creating playlist:', error);
      throw error;
    }
  },

  async update(playlistId: string, updates: Partial<Playlist>): Promise<Playlist | null> {
    try {
      const response = await api.put(`/api/base44/entities/Playlist/${playlistId}`, updates);
      return response.data;
    } catch (error) {
      console.error('[Playlists] Error updating playlist:', error);
      throw error;
    }
  },

  async addTrack(playlistId: string, trackId: string): Promise<any> {
    try {
      const response = await api.post('/api/base44/functions/invoke/add_to_playlist', {
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
      const response = await api.post('/api/base44/functions/invoke/remove_from_playlist', {
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
  async upload(fileUri: string, fileName: string, mimeType: string): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: mimeType,
      } as any);

      const response = await api.post('/api/tracks/upload', formData, {
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

  getUrl(fileId: string): string {
    return `https://api.base44.com/v1/apps/691a4d96d819355b52c063f3/storage/files/${fileId}`;
  },
};

// ==================== ADMIN SERVICE ====================

export const base44Admin = {
  async getPendingTracks(): Promise<Track[]> {
    try {
      const response = await api.get('/api/base44/entities/Track?status=pending');
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[Admin] Error getting pending tracks:', error);
      return [];
    }
  },

  async approveTrack(trackId: string): Promise<Track | null> {
    try {
      const response = await api.put(`/api/base44/entities/Track/${trackId}`, {
        status: 'approved',
        is_approved: true,
      });
      return response.data;
    } catch (error) {
      console.error('[Admin] Error approving track:', error);
      throw error;
    }
  },

  async rejectTrack(trackId: string, reason?: string): Promise<Track | null> {
    try {
      const response = await api.put(`/api/base44/entities/Track/${trackId}`, {
        status: 'rejected',
        rejection_reason: reason,
      });
      return response.data;
    } catch (error) {
      console.error('[Admin] Error rejecting track:', error);
      throw error;
    }
  },

  async getAllUsers(): Promise<User[]> {
    try {
      const response = await api.get('/api/base44/entities/User');
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[Admin] Error getting all users:', error);
      return [];
    }
  },

  async getAnalytics(): Promise<any> {
    try {
      const response = await api.post('/api/base44/functions/invoke/get_analytics', {});
      return response.data;
    } catch (error) {
      console.error('[Admin] Error getting analytics:', error);
      return null;
    }
  },

  async getDownloadStats(): Promise<any> {
    try {
      const response = await api.post('/api/base44/functions/invoke/get_download_stats', {});
      return response.data;
    } catch (error) {
      console.error('[Admin] Error getting download stats:', error);
      return null;
    }
  },

  // ==================== NEW ADMIN API - getAdminData ====================
  
  /**
   * Get complete admin dashboard data
   * Requires admin role ("admin" or "admin_readonly")
   */
  async getDashboard(): Promise<any> {
    try {
      console.log('[Admin] Fetching dashboard data...');
      const response = await api.post('/api/base44/functions/invoke/getAdminData', {});
      console.log('[Admin] Dashboard data fetched:', response.data);
      return response.data;
    } catch (error) {
      console.error('[Admin] Error getting dashboard:', error);
      return null;
    }
  },

  /**
   * Get specific section of admin data
   * @param section - One of: pending_tracks, vip_requests, approved_tracks, users, sessions, downloads, vip_promos, broadcasts, dj_categories, forum_posts
   */
  async getSection(section: string): Promise<any> {
    try {
      console.log('[Admin] Fetching section:', section);
      const response = await api.post('/api/base44/functions/invoke/getAdminData', {
        section,
      });
      console.log('[Admin] Section data fetched:', response.data);
      return response.data;
    } catch (error) {
      console.error('[Admin] Error getting section:', section, error);
      return null;
    }
  },

  /**
   * Get pending tracks for approval
   */
  async getPendingTracksNew(): Promise<any> {
    return this.getSection('pending_tracks');
  },

  /**
   * Get VIP requests
   */
  async getVipRequests(): Promise<any> {
    return this.getSection('vip_requests');
  },

  /**
   * Get all users
   */
  async getAllUsersNew(): Promise<any> {
    return this.getSection('users');
  },

  /**
   * Get SPYN sessions
   */
  async getSessions(): Promise<any> {
    return this.getSection('sessions');
  },

  /**
   * Get downloads data
   */
  async getDownloads(): Promise<any> {
    return this.getSection('downloads');
  },

  /**
   * Get VIP promos
   */
  async getVipPromos(): Promise<any> {
    return this.getSection('vip_promos');
  },

  /**
   * Get broadcast emails
   */
  async getBroadcasts(): Promise<any> {
    return this.getSection('broadcasts');
  },

  /**
   * Get DJ categories
   */
  async getDjCategories(): Promise<any> {
    return this.getSection('dj_categories');
  },

  /**
   * Get pending forum posts
   */
  async getForumPosts(): Promise<any> {
    return this.getSection('forum_posts');
  },
};

// ==================== SPYN NOTIFICATION SERVICE ====================

export const base44Notifications = {
  /**
   * Send email to producer when their track is played
   * Uses Base44 integrations.Core.SendEmail
   */
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
      
      // First, try to call the sendTrackPlayedEmail cloud function
      // This function should handle finding the producer's email and sending
      const response = await api.post('/api/base44/functions/invoke/sendTrackPlayedEmail', {
        trackTitle: params.track_title,
        artistName: params.artist_name,
        djName: params.dj_name,
        clubName: params.club_name || 'Unknown Venue',
        location: params.location || 'Unknown Location',
        playedAt: params.played_at || new Date().toISOString(),
      });
      
      console.log('[Notifications] Email sent successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('[Notifications] Error sending track played email:', error);
      
      // Fallback: Create a notification record in the database
      try {
        await api.post('/api/base44/entities/Notification', {
          type: 'track_played',
          message: `Your track "${params.track_title}" was played by ${params.dj_name} at ${params.club_name || 'a venue'}`,
          track_title: params.track_title,
          dj_name: params.dj_name,
          read: false,
          created_at: new Date().toISOString(),
        });
        console.log('[Notifications] Created notification record as fallback');
      } catch (e) {
        console.log('[Notifications] Could not create fallback notification');
      }
      
      throw error;
    }
  },

  async getLiveTrackPlays(producerId?: string): Promise<any[]> {
    try {
      console.log('[LiveRadar] Fetching live track plays for producer:', producerId || 'all');
      
      // Try native API first
      try {
        const response = await api.post('/api/live-plays', {
          producer_id: producerId || null,
          limit: 100
        });
        console.log('[LiveRadar] Native API response:', response.data);
        
        if (response.data?.plays) {
          return response.data.plays;
        }
        if (Array.isArray(response.data)) {
          return response.data;
        }
      } catch (nativeError) {
        console.log('[LiveRadar] Native API failed, trying Base44...');
      }
      
      // Fallback to Base44 function
      const response = await api.post('/api/base44/functions/invoke/getLiveTrackPlays', {
        producerId: producerId || null,
      });
      console.log('[LiveRadar] Live plays fetched:', response.data);
      
      // Handle different response formats
      if (Array.isArray(response.data)) {
        return response.data;
      }
      if (response.data?.plays) {
        return response.data.plays;
      }
      if (response.data?.data) {
        return response.data.data;
      }
      return [];
    } catch (error) {
      console.error('[LiveRadar] Error fetching live track plays:', error);
      return [];
    }
  },
};

// ==================== VIP SERVICE ====================

export interface VIPPromo {
  id?: string;
  _id?: string;
  name: string;
  description?: string;
  track_ids?: string[];
  price?: number;
  duration_days?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface VIPPurchase {
  id?: string;
  _id?: string;
  user_id: string;
  promo_id: string;
  purchased_at: string;
  expires_at?: string;
  amount?: number;
}

export interface VIPDownload {
  id?: string;
  _id?: string;
  user_id: string;
  track_id: string;
  downloaded_at: string;
}

export const base44VIP = {
  // VIP Promos
  async listPromos(): Promise<VIPPromo[]> {
    try {
      const response = await api.get('/api/base44/entities/VIPPromo?limit=100');
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[VIP] Error listing promos:', error);
      return [];
    }
  },

  async getPromo(promoId: string): Promise<VIPPromo | null> {
    try {
      const response = await api.get(`/api/base44/entities/VIPPromo/${promoId}`);
      return response.data;
    } catch (error) {
      console.error('[VIP] Error getting promo:', error);
      return null;
    }
  },

  // VIP Purchases
  async listMyPurchases(userId: string): Promise<VIPPurchase[]> {
    try {
      const response = await api.get(`/api/base44/entities/VIPPurchase?user_id=${userId}`);
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[VIP] Error listing purchases:', error);
      return [];
    }
  },

  async createPurchase(purchase: Partial<VIPPurchase>): Promise<VIPPurchase | null> {
    try {
      const response = await api.post('/api/base44/entities/VIPPurchase', purchase);
      return response.data;
    } catch (error) {
      console.error('[VIP] Error creating purchase:', error);
      throw error;
    }
  },

  // VIP Downloads
  async recordDownload(download: Partial<VIPDownload>): Promise<VIPDownload | null> {
    try {
      const response = await api.post('/api/base44/entities/VIPDownload', download);
      return response.data;
    } catch (error) {
      console.error('[VIP] Error recording download:', error);
      throw error;
    }
  },

  async listMyDownloads(userId: string): Promise<VIPDownload[]> {
    try {
      const response = await api.get(`/api/base44/entities/VIPDownload?user_id=${userId}`);
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[VIP] Error listing downloads:', error);
      return [];
    }
  },
};

// ==================== MESSAGE SERVICE ====================

export interface Message {
  id?: string;
  _id?: string;
  sender_id: string;
  sender_name?: string;
  receiver_id: string;
  content?: string;
  audio_url?: string;
  attachment_urls?: string[];
  read?: boolean;
  created_at?: string;
}

export const base44Messages = {
  async list(filters?: { receiver_id?: string; sender_id?: string; read?: boolean }): Promise<Message[]> {
    try {
      const params = new URLSearchParams();
      params.append('limit', '200');
      if (filters?.receiver_id) params.append('receiver_id', filters.receiver_id);
      if (filters?.sender_id) params.append('sender_id', filters.sender_id);
      if (filters?.read !== undefined) params.append('read', filters.read.toString());

      const response = await api.get(`/api/base44/entities/Message?${params.toString()}`);
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[Messages] Error listing messages:', error);
      return [];
    }
  },

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const messages = await this.list({ receiver_id: userId, read: false });
      return messages.length;
    } catch (error) {
      console.error('[Messages] Error getting unread count:', error);
      return 0;
    }
  },

  async send(message: Partial<Message>): Promise<Message | null> {
    try {
      const response = await api.post('/api/base44/entities/Message', {
        ...message,
        read: false,
        created_at: new Date().toISOString(),
      });
      return response.data;
    } catch (error) {
      console.error('[Messages] Error sending message:', error);
      throw error;
    }
  },

  async markAsRead(messageId: string): Promise<Message | null> {
    try {
      const response = await api.put(`/api/base44/entities/Message/${messageId}`, {
        read: true,
      });
      return response.data;
    } catch (error) {
      console.error('[Messages] Error marking message as read:', error);
      throw error;
    }
  },

  async getConversation(userId1: string, userId2: string): Promise<Message[]> {
    try {
      // Get all messages between two users
      const allMessages = await this.list();
      return allMessages.filter((msg: Message) => 
        (msg.sender_id === userId1 && msg.receiver_id === userId2) ||
        (msg.sender_id === userId2 && msg.receiver_id === userId1)
      ).sort((a, b) => 
        new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
      );
    } catch (error) {
      console.error('[Messages] Error getting conversation:', error);
      return [];
    }
  },
};

// ==================== NOTIFICATION SERVICE ====================

export interface Notification {
  id?: string;
  _id?: string;
  user_id: string;
  type: 'track_played' | 'message' | 'follow' | 'download' | 'vip' | 'system' | string;
  message: string;
  read: boolean;
  track_id?: string;
  track_title?: string;
  dj_id?: string;
  dj_name?: string;
  sender_id?: string;
  sender_name?: string;
  created_at?: string;
}

export const base44Notifications2 = {
  async list(userId: string): Promise<Notification[]> {
    try {
      const response = await api.get(`/api/base44/entities/Notification?user_id=${userId}&limit=50`);
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[Notifications] Error listing notifications:', error);
      return [];
    }
  },

  async getUnread(userId: string): Promise<Notification[]> {
    try {
      const response = await api.get(`/api/base44/entities/Notification?user_id=${userId}&read=false&limit=50`);
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data?.items) return data.items;
      return [];
    } catch (error) {
      console.error('[Notifications] Error getting unread notifications:', error);
      return [];
    }
  },

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const notifications = await this.getUnread(userId);
      return notifications.length;
    } catch (error) {
      console.error('[Notifications] Error getting unread count:', error);
      return 0;
    }
  },

  async markAsRead(notificationId: string): Promise<Notification | null> {
    try {
      const response = await api.put(`/api/base44/entities/Notification/${notificationId}`, {
        read: true,
      });
      return response.data;
    } catch (error) {
      console.error('[Notifications] Error marking notification as read:', error);
      return null;
    }
  },

  async markAllAsRead(userId: string): Promise<void> {
    try {
      const unread = await this.getUnread(userId);
      await Promise.all(unread.map(n => this.markAsRead(n.id || n._id || '')));
    } catch (error) {
      console.error('[Notifications] Error marking all as read:', error);
    }
  },

  async delete(notificationId: string): Promise<boolean> {
    try {
      await api.delete(`/api/base44/entities/Notification/${notificationId}`);
      return true;
    } catch (error) {
      console.error('[Notifications] Error deleting notification:', error);
      return false;
    }
  },

  async create(notification: Partial<Notification>): Promise<Notification | null> {
    try {
      const response = await api.post('/api/base44/entities/Notification', {
        ...notification,
        read: false,
        created_at: new Date().toISOString(),
      });
      return response.data;
    } catch (error) {
      console.error('[Notifications] Error creating notification:', error);
      return null;
    }
  },
};

// ==================== PUBLIC PROFILES SERVICE ====================

export const base44Profiles = {
  /**
   * Get a single user's public profile by ID
   */
  async getProfile(userId: string): Promise<PublicProfile | null> {
    try {
      console.log('[Profiles] Fetching profile for user:', userId);
      const response = await api.post('/api/base44/functions/invoke/getPublicProfiles', {
        userId,
      });
      
      if (response.data?.success && response.data?.profile) {
        console.log('[Profiles] Profile fetched successfully');
        return response.data.profile;
      }
      
      console.log('[Profiles] No profile found');
      return null;
    } catch (error) {
      console.error('[Profiles] Error fetching profile:', error);
      return null;
    }
  },

  /**
   * List all public profiles with optional filters
   */
  async listProfiles(filters?: { userType?: string; limit?: number }): Promise<PublicProfile[]> {
    try {
      console.log('[Profiles] Fetching profiles with filters:', filters);
      const response = await api.post('/api/base44/functions/invoke/getPublicProfiles', {
        userType: filters?.userType,
        limit: filters?.limit || 50,
      });
      
      if (response.data?.success && response.data?.profiles) {
        console.log('[Profiles] Profiles fetched:', response.data.profiles.length);
        return response.data.profiles;
      }
      
      return [];
    } catch (error) {
      console.error('[Profiles] Error listing profiles:', error);
      return [];
    }
  },

  /**
   * Get avatar URL - returns the best available avatar
   */
  getAvatarUrl(profile: PublicProfile): string | null {
    if (profile.avatar_url) return profile.avatar_url;
    if (profile.generated_avatar_url) return profile.generated_avatar_url;
    return null;
  },

  /**
   * Get display name - returns artist_name or full_name
   */
  getDisplayName(profile: PublicProfile): string {
    return profile.artist_name || profile.full_name || 'Unknown';
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
  notifications2: base44Notifications2,
  profiles: base44Profiles,
};
