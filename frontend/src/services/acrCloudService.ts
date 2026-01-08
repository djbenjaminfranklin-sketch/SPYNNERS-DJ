/**
 * ACRCloud Direct Recognition Service
 * 
 * NOTE: Due to React Native limitations with FormData and Blob,
 * we use the local backend as proxy for ACRCloud on mobile.
 * On web, we can call ACRCloud directly.
 * 
 * Both OFFLINE and ONLINE modes use the Spynners catalog.
 * OFFLINE = Primary key
 * ONLINE = Fallback key (same Spynners catalog)
 */

import CryptoJS from 'crypto-js';
import { Platform } from 'react-native';

// ACRCloud Credentials - Both point to Spynners catalog
const OFFLINE_CONFIG = {
  accessKey: 'dec6f0f58197fbc70adf09d41f7451f3',
  accessSecret: 'qW762evL3yc6MtfPijAZ0xFDcl1ilj81mEzsEr4W',
  bucketId: '20849',
  host: 'identify-eu-west-1.acrcloud.com',
  name: 'Spynners Primary',
};

const ONLINE_CONFIG = {
  accessKey: 'c1781c9b84de62679ca8b1f11796e31a',
  accessSecret: 'ik9dGvBZBCTaY7n15ThmfH5IXW9OXjO8A1Qpbv8J',
  host: 'identify-eu-west-1.acrcloud.com',
  name: 'Spynners Fallback',
};

export interface ACRCloudResult {
  success: boolean;
  found: boolean;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  cover_image?: string;
  score?: number;
  mode: 'offline' | 'online' | 'none';
  acr_id?: string;
  external_ids?: {
    isrc?: string;
    upc?: string;
  };
  error?: string;
}

/**
 * Create HMAC-SHA1 signature for ACRCloud API
 */
function createSignature(stringToSign: string, accessSecret: string): string {
  const hmac = CryptoJS.HmacSHA1(stringToSign, accessSecret);
  return CryptoJS.enc.Base64.stringify(hmac);
}

/**
 * Call ACRCloud identify API (Web only)
 */
async function identifyAudioWeb(
  audioBase64: string,
  config: typeof OFFLINE_CONFIG | typeof ONLINE_CONFIG,
  mode: 'offline' | 'online'
): Promise<ACRCloudResult> {
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const httpMethod = 'POST';
    const httpUri = '/v1/identify';
    const dataType = 'audio';
    const signatureVersion = '1';
    
    const stringToSign = [
      httpMethod,
      httpUri,
      config.accessKey,
      dataType,
      signatureVersion,
      timestamp,
    ].join('\n');
    
    console.log(`[ACRCloud] Creating signature for ${mode} mode...`);
    const signature = createSignature(stringToSign, config.accessSecret);
    
    const formData = new FormData();
    
    // Web: Convert base64 to blob
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBlob = new Blob([bytes], { type: 'audio/mp4' });
    
    formData.append('sample', audioBlob, 'audio.m4a');
    formData.append('sample_bytes', bytes.length.toString());
    formData.append('access_key', config.accessKey);
    formData.append('data_type', dataType);
    formData.append('signature_version', signatureVersion);
    formData.append('signature', signature);
    formData.append('timestamp', timestamp);
    
    const url = `https://${config.host}${httpUri}`;
    console.log(`[ACRCloud] Sending request to ${mode} API: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`[ACRCloud] ${mode} response code:`, result.status?.code, result.status?.msg);
    
    if (result.status?.code === 0 && result.metadata?.music?.length > 0) {
      const music = result.metadata.music[0];
      
      return {
        success: true,
        found: true,
        title: music.title,
        artist: music.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
        album: music.album?.name,
        genre: music.genres?.map((g: any) => g.name).join(', '),
        cover_image: music.external_metadata?.spotify?.album?.images?.[0]?.url || 
                     music.external_metadata?.deezer?.album?.cover_xl,
        score: music.score,
        mode: mode,
        acr_id: music.acrid,
        external_ids: {
          isrc: music.external_ids?.isrc,
          upc: music.external_ids?.upc,
        },
      };
    }
    
    return {
      success: true,
      found: false,
      mode: mode,
      error: result.status?.msg || 'No match found',
    };
    
  } catch (error: any) {
    console.error(`[ACRCloud] ${mode} error:`, error?.message || error);
    return {
      success: false,
      found: false,
      mode: mode,
      error: error?.message || 'Recognition failed',
    };
  }
}

/**
 * Call local backend for ACRCloud recognition (React Native)
 * The backend handles the FormData/file upload complexity
 */
async function identifyAudioNative(audioBase64: string): Promise<ACRCloudResult> {
  try {
    console.log('[ACRCloud] Using local backend proxy for React Native...');
    
    // Get the backend URL from environment or use default
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://stable-app-deploy.preview.emergentagent.com';
    
    const response = await fetch(`${backendUrl}/api/recognize-audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_base64: audioBase64,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ACRCloud] Backend error:', response.status, errorText);
      throw new Error(`Backend error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('[ACRCloud] Backend response:', JSON.stringify(result).substring(0, 200));
    
    if (result.success && result.title) {
      return {
        success: true,
        found: true,
        title: result.title,
        artist: result.artist || 'Unknown Artist',
        album: result.album,
        genre: result.genre,
        cover_image: result.cover_image,
        score: result.score,
        mode: 'offline', // Backend uses the Spynners catalog
        acr_id: result.acr_id,
        external_ids: result.external_ids,
      };
    }
    
    return {
      success: true,
      found: false,
      mode: 'none',
      error: result.message || 'No match found',
    };
    
  } catch (error: any) {
    console.error('[ACRCloud] Native recognition error:', error?.message || error);
    return {
      success: false,
      found: false,
      mode: 'none',
      error: error?.message || 'Recognition failed',
    };
  }
}

/**
 * Hybrid recognition: 
 * - Web: Try OFFLINE first (Spynners), then ONLINE (global)
 * - Native: Use backend proxy (which has the hybrid logic)
 */
export async function recognizeAudioHybrid(audioBase64: string): Promise<ACRCloudResult> {
  console.log('[ACRCloud] Starting hybrid recognition...');
  console.log('[ACRCloud] Audio data length:', audioBase64.length, 'Platform:', Platform.OS);
  
  // On React Native, use the backend proxy
  if (Platform.OS !== 'web') {
    console.log('[ACRCloud] Using backend proxy for React Native...');
    return await identifyAudioNative(audioBase64);
  }
  
  // On Web, call ACRCloud directly
  console.log('[ACRCloud] Step 1: Trying OFFLINE mode (Spynners catalog)...');
  const offlineResult = await identifyAudioWeb(audioBase64, OFFLINE_CONFIG, 'offline');
  
  if (offlineResult.found) {
    console.log('[ACRCloud] ✅ Track found in OFFLINE catalog:', offlineResult.title);
    return offlineResult;
  }
  
  console.log('[ACRCloud] No match in OFFLINE catalog, trying ONLINE...');
  
  console.log('[ACRCloud] Step 2: Trying ONLINE mode (global catalog)...');
  const onlineResult = await identifyAudioWeb(audioBase64, ONLINE_CONFIG, 'online');
  
  if (onlineResult.found) {
    console.log('[ACRCloud] ✅ Track found in ONLINE catalog:', onlineResult.title);
    return onlineResult;
  }
  
  console.log('[ACRCloud] ❌ No track found in either catalog');
  return {
    success: true,
    found: false,
    mode: 'none',
    error: 'No track found in any catalog',
  };
}

export default {
  recognizeAudioHybrid,
};
