// Media Library wrapper that only loads on native platforms
import { Platform } from 'react-native';

// Type declarations
interface MediaLibraryAsset {
  id: string;
  filename: string;
  uri: string;
  mediaType: string;
  creationTime: number;
  modificationTime: number;
  duration: number;
  width: number;
  height: number;
}

interface MediaLibraryAlbum {
  id: string;
  title: string;
  assetCount?: number;
}

interface MediaLibraryModule {
  requestPermissionsAsync: () => Promise<{ status: string }>;
  createAssetAsync: (uri: string) => Promise<MediaLibraryAsset>;
  getAlbumsAsync: () => Promise<MediaLibraryAlbum[]>;
  createAlbumAsync: (title: string, asset: MediaLibraryAsset, copyAsset: boolean) => Promise<MediaLibraryAlbum>;
  addAssetsToAlbumAsync: (assets: MediaLibraryAsset[], album: MediaLibraryAlbum, copyAsset: boolean) => Promise<boolean>;
}

// Lazy load MediaLibrary only on native
let _mediaLibrary: MediaLibraryModule | null = null;

export const getMediaLibrary = (): MediaLibraryModule | null => {
  if (Platform.OS === 'web') {
    return null;
  }
  
  if (!_mediaLibrary) {
    try {
      _mediaLibrary = require('expo-media-library') as MediaLibraryModule;
    } catch (e) {
      console.warn('expo-media-library not available');
      return null;
    }
  }
  
  return _mediaLibrary;
};

export const isMediaLibraryAvailable = (): boolean => {
  return Platform.OS !== 'web' && getMediaLibrary() !== null;
};

// Helper functions
export const requestMediaPermissions = async (): Promise<boolean> => {
  const lib = getMediaLibrary();
  if (!lib) return false;
  
  try {
    const { status } = await lib.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
};

export const saveToMediaLibrary = async (
  uri: string,
  albumName: string = 'SPYNNERS'
): Promise<boolean> => {
  const lib = getMediaLibrary();
  if (!lib) return false;
  
  try {
    const hasPermission = await requestMediaPermissions();
    if (!hasPermission) return false;
    
    const asset = await lib.createAssetAsync(uri);
    const albums = await lib.getAlbumsAsync();
    let album = albums.find(a => a.title === albumName);
    
    if (!album) {
      album = await lib.createAlbumAsync(albumName, asset, false);
    } else {
      await lib.addAssetsToAlbumAsync([asset], album, false);
    }
    
    return true;
  } catch (e) {
    console.error('Save to media library failed:', e);
    return false;
  }
};
