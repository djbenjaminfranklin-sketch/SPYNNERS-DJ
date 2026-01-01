/**
 * Base44 API Service for SPYNNERS
 * Using official @base44/sdk for all API calls
 */

import { createClient } from '@base44/sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_ID = '691a4d96d819355b52c063f3';

// Create Base44 client instance
export const base44 = createClient({
  appId: APP_ID,
});

// Storage keys
const AUTH_TOKEN_KEY = 'auth_token';
const USER_KEY = 'user';

// Initialize auth from storage (called explicitly, not on module load)
export const initializeAuth = async () => {
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      console.log('[Base44] Restoring auth token from storage');
      base44.auth.setToken(token);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Base44] Error initializing auth:', error);
    return false;
  }
};

// Don't call initializeAuth on module load - it will be called by AuthContext

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
      
      // Build filter options for SDK
      const options: any = {
        limit: filters?.limit || 50,
        sort: filters?.sort || '-created_date',
      };
      
      // Build filter object
      const filterObj: any = {};
      if (filters?.genre && filters.genre !== 'All Genres') {
        filterObj.genre = filters.genre;
      }
      if (filters?.energy_level && filters.energy_level !== 'All Energy Levels') {
        filterObj.energy_level = filters.energy_level.toLowerCase().replace(' ', '_');
      }
      if (filters?.is_vip !== undefined) {
        filterObj.is_vip = filters.is_vip;
      }
      
      if (Object.keys(filterObj).length > 0) {
        options.filter = filterObj;
      }

      console.log('[Tracks] SDK options:', JSON.stringify(options));
      
      // Use Base44 SDK to fetch tracks
      const tracks = await base44.entities.Track.list(options);
      
      console.log('[Tracks] Fetched tracks count:', tracks?.length || 0);
      if (tracks?.length > 0) {
        console.log('[Tracks] First track:', JSON.stringify(tracks[0]).substring(0, 300));
      }
      
      return Array.isArray(tracks) ? tracks : [];
    } catch (error: any) {
      console.error('[Tracks] Error fetching tracks:', error?.message || error);
      // Return empty array, the UI will show demo tracks
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
      const track = await base44.entities.Track.get(trackId);
      return track;
    } catch (error) {
      console.error('[Tracks] Error getting track:', error);
      return null;
    }
  },

  // Create new track
  async create(track: Partial<Track>): Promise<Track | null> {
    try {
      const newTrack = await base44.entities.Track.create(track);
      return newTrack;
    } catch (error) {
      console.error('[Tracks] Error creating track:', error);
      throw error;
    }
  },

  // Update track
  async update(trackId: string, updates: Partial<Track>): Promise<Track | null> {
    try {
      const updatedTrack = await base44.entities.Track.update(trackId, updates);
      return updatedTrack;
    } catch (error) {
      console.error('[Tracks] Error updating track:', error);
      throw error;
    }
  },

  // Delete track
  async delete(trackId: string): Promise<boolean> {
    try {
      await base44.entities.Track.delete(trackId);
      return true;
    } catch (error) {
      console.error('[Tracks] Error deleting track:', error);
      return false;
    }
  },

  // Search tracks
  async search(query: string): Promise<Track[]> {
    try {
      const tracks = await base44.entities.Track.list({
        filter: { $text: { $search: query } },
        limit: 50,
      });
      return Array.isArray(tracks) ? tracks : [];
    } catch (error) {
      console.error('[Tracks] Search error:', error);
      return [];
    }
  },

  // Get my uploads
  async myUploads(userId: string): Promise<Track[]> {
    try {
      const tracks = await base44.entities.Track.list({
        filter: { uploaded_by: userId },
        sort: '-created_date',
      });
      return Array.isArray(tracks) ? tracks : [];
    } catch (error) {
      console.error('[Tracks] Error getting my uploads:', error);
      return [];
    }
  },

  // Rate a track (via function invoke)
  async rate(trackId: string, rating: number): Promise<any> {
    try {
      const result = await base44.functions.invoke('rate_track', {
        track_id: trackId,
        rating,
      });
      return result;
    } catch (error) {
      console.error('[Tracks] Error rating track:', error);
    }
  },

  // Increment download count (via function invoke)
  async download(trackId: string): Promise<any> {
    try {
      const result = await base44.functions.invoke('download_track', {
        track_id: trackId,
      });
      return result;
    } catch (error) {
      console.error('[Tracks] Error recording download:', error);
    }
  },

  // Increment play count (via function invoke)
  async play(trackId: string): Promise<any> {
    try {
      const result = await base44.functions.invoke('play_track', {
        track_id: trackId,
      });
      return result;
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

// ==================== USERS SERVICE ====================

export const base44Users = {
  async list(filters?: { user_type?: string; search?: string }): Promise<User[]> {
    try {
      const options: any = { limit: 50 };
      const filterObj: any = {};
      
      if (filters?.user_type) {
        filterObj.user_type = filters.user_type;
      }
      if (filters?.search) {
        filterObj.$text = { $search: filters.search };
      }
      
      if (Object.keys(filterObj).length > 0) {
        options.filter = filterObj;
      }
      
      const users = await base44.entities.User.list(options);
      return Array.isArray(users) ? users : [];
    } catch (error) {
      console.error('[Users] Error listing users:', error);
      return [];
    }
  },

  async get(userId: string): Promise<User | null> {
    try {
      const user = await base44.entities.User.get(userId);
      return user;
    } catch (error) {
      console.error('[Users] Error getting user:', error);
      return null;
    }
  },

  async searchProducersAndLabels(query: string): Promise<User[]> {
    try {
      const users = await base44.entities.User.list({
        filter: {
          $text: { $search: query },
          user_type: { $in: ['producer', 'label', 'dj_producer'] },
        },
        limit: 20,
      });
      return Array.isArray(users) ? users : [];
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
      const playlists = await base44.entities.Playlist.list({
        filter: { user_id: userId },
      });
      return Array.isArray(playlists) ? playlists : [];
    } catch (error) {
      console.error('[Playlists] Error listing playlists:', error);
      return [];
    }
  },

  async create(playlist: Partial<Playlist>): Promise<Playlist | null> {
    try {
      const newPlaylist = await base44.entities.Playlist.create(playlist);
      return newPlaylist;
    } catch (error) {
      console.error('[Playlists] Error creating playlist:', error);
      throw error;
    }
  },

  async addTrack(playlistId: string, trackId: string): Promise<any> {
    try {
      const result = await base44.functions.invoke('add_to_playlist', {
        playlist_id: playlistId,
        track_id: trackId,
      });
      return result;
    } catch (error) {
      console.error('[Playlists] Error adding track to playlist:', error);
      throw error;
    }
  },

  async removeTrack(playlistId: string, trackId: string): Promise<any> {
    try {
      const result = await base44.functions.invoke('remove_from_playlist', {
        playlist_id: playlistId,
        track_id: trackId,
      });
      return result;
    } catch (error) {
      console.error('[Playlists] Error removing track from playlist:', error);
      throw error;
    }
  },
};

// ==================== FILES SERVICE ====================

export const base44Files = {
  // Upload file to Base44 storage
  async upload(fileUri: string, fileName: string, _mimeType: string): Promise<any> {
    try {
      // Note: File upload via SDK may need special handling for React Native
      // This is a placeholder - actual implementation may vary
      const result = await base44.storage.upload(fileUri, { filename: fileName });
      return result;
    } catch (error) {
      console.error('[Files] Error uploading file:', error);
      throw error;
    }
  },

  // Get file URL
  getUrl(fileId: string): string {
    return `https://api.base44.com/v1/apps/${APP_ID}/storage/files/${fileId}`;
  },
};

// ==================== ADMIN SERVICE ====================

export const base44Admin = {
  // Get pending tracks for approval
  async getPendingTracks(): Promise<Track[]> {
    try {
      const tracks = await base44.entities.Track.list({
        filter: { status: 'pending' },
      });
      return Array.isArray(tracks) ? tracks : [];
    } catch (error) {
      console.error('[Admin] Error getting pending tracks:', error);
      return [];
    }
  },

  // Approve track
  async approveTrack(trackId: string): Promise<Track | null> {
    try {
      const track = await base44.entities.Track.update(trackId, {
        status: 'approved',
        is_approved: true,
      });
      return track;
    } catch (error) {
      console.error('[Admin] Error approving track:', error);
      throw error;
    }
  },

  // Reject track
  async rejectTrack(trackId: string, reason?: string): Promise<Track | null> {
    try {
      const track = await base44.entities.Track.update(trackId, {
        status: 'rejected',
        rejection_reason: reason,
      });
      return track;
    } catch (error) {
      console.error('[Admin] Error rejecting track:', error);
      throw error;
    }
  },

  // Get all users (admin only)
  async getAllUsers(): Promise<User[]> {
    try {
      const users = await base44.entities.User.list({ limit: 100 });
      return Array.isArray(users) ? users : [];
    } catch (error) {
      console.error('[Admin] Error getting all users:', error);
      return [];
    }
  },

  // Get analytics (via function invoke)
  async getAnalytics(): Promise<any> {
    try {
      const result = await base44.functions.invoke('get_analytics');
      return result;
    } catch (error) {
      console.error('[Admin] Error getting analytics:', error);
      return null;
    }
  },

  // Get download stats (via function invoke)
  async getDownloadStats(): Promise<any> {
    try {
      const result = await base44.functions.invoke('get_download_stats');
      return result;
    } catch (error) {
      console.error('[Admin] Error getting download stats:', error);
      return null;
    }
  },
};

// ==================== SPYN NOTIFICATION ====================

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
      const result = await base44.functions.invoke('sendTrackPlayedEmail', params);
      console.log('[Notifications] Email sent successfully:', result);
      return result;
    } catch (error) {
      console.error('[Notifications] Error sending track played email:', error);
      throw error;
    }
  },
};

// ==================== AUTH HELPERS ====================

export const base44AuthHelpers = {
  // Save auth state to storage
  async saveAuth(token: string, user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      base44.auth.setToken(token);
    } catch (error) {
      console.error('[Auth] Error saving auth:', error);
    }
  },

  // Clear auth state
  async clearAuth(): Promise<void> {
    try {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      base44.auth.setToken(null);
    } catch (error) {
      console.error('[Auth] Error clearing auth:', error);
    }
  },

  // Get stored user
  async getStoredUser(): Promise<User | null> {
    try {
      const userJson = await AsyncStorage.getItem(USER_KEY);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error('[Auth] Error getting stored user:', error);
      return null;
    }
  },
};

// Export default api object
export default {
  client: base44,
  tracks: base44Tracks,
  users: base44Users,
  playlists: base44Playlists,
  files: base44Files,
  admin: base44Admin,
  notifications: base44Notifications,
  auth: base44AuthHelpers,
};
