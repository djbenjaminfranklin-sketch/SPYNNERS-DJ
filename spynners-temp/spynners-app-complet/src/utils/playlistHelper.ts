import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PlaylistTrack {
  id: string;
  title: string;
  artist: string;
  genre?: string;
  artwork?: string;
  bpm?: number;
  key?: string;
}

export const addToPlaylist = async (
  playlistName: 'favorites' | 'myMix',
  track: PlaylistTrack
): Promise<boolean> => {
  try {
    const key = `playlist_${playlistName}`;
    const existing = await AsyncStorage.getItem(key);
    const tracks: PlaylistTrack[] = existing ? JSON.parse(existing) : [];
    
    // Check if already exists
    if (tracks.find(t => t.id === track.id)) {
      return false; // Already in playlist
    }
    
    tracks.push(track);
    await AsyncStorage.setItem(key, JSON.stringify(tracks));
    return true;
  } catch (error) {
    console.error('Error adding to playlist:', error);
    return false;
  }
};