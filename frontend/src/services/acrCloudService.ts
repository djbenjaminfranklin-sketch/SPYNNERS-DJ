/**
 * ACRCloud Direct Recognition Service
 * 
 * Hybrid mode:
 * 1. OFFLINE (priority) - Our Spynners catalog, fast, no limits
 * 2. ONLINE (fallback) - Global ACRCloud catalog
 */

import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

// ACRCloud Credentials
const OFFLINE_CONFIG = {
  accessKey: 'dec6f0f58197fbc70adf09d41f7451f3',
  accessSecret: 'qW762evL3yc6MtfPijAZ0xFDcl1ilj81mEzsEr4W',
  bucketId: '20849',
  host: 'identify-eu-west-1.acrcloud.com',
};

const ONLINE_CONFIG = {
  accessKey: 'c1781c9b84de62679ca8b1f11796e31a',
  accessSecret: 'ik9dGvBZBCTaY7n15ThmfH5IXW9OXjO8A1Qpbv8J',
  host: 'identify-eu-west-1.acrcloud.com',
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
async function createSignature(
  stringToSign: string,
  accessSecret: string
): Promise<string> {
  try {
    // For React Native, we need to use a different approach
    // expo-crypto doesn't support HMAC directly, so we'll use a web-compatible method
    
    if (Platform.OS === 'web') {
      // Web: Use SubtleCrypto
      const encoder = new TextEncoder();
      const keyData = encoder.encode(accessSecret);
      const messageData = encoder.encode(stringToSign);
      
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign('HMAC', key, messageData);
      const signatureArray = new Uint8Array(signature);
      const base64Signature = btoa(String.fromCharCode(...signatureArray));
      return base64Signature;
    } else {
      // Native: Use crypto-js style implementation
      // We'll use a simpler approach with fetch and let the server handle it
      // For now, use a basic implementation
      const hmacModule = await import('crypto-js/hmac-sha1');
      const Base64Module = await import('crypto-js/enc-base64');
      const hmac = hmacModule.default(stringToSign, accessSecret);
      return Base64Module.default.stringify(hmac);
    }
  } catch (error) {
    console.error('[ACRCloud] Signature creation error:', error);
    throw error;
  }
}

/**
 * Call ACRCloud identify API
 */
async function identifyAudio(
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
    
    // Create string to sign
    const stringToSign = [
      httpMethod,
      httpUri,
      config.accessKey,
      dataType,
      signatureVersion,
      timestamp,
    ].join('\n');
    
    console.log(`[ACRCloud] Creating signature for ${mode} mode...`);
    const signature = await createSignature(stringToSign, config.accessSecret);
    
    // Prepare form data
    const formData = new FormData();
    
    // Convert base64 to blob for the audio sample
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
    console.log(`[ACRCloud] ${mode} response:`, JSON.stringify(result, null, 2));
    
    // Parse ACRCloud response
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
    
    // No match found
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
 * Hybrid recognition: Try OFFLINE first, then ONLINE as fallback
 */
export async function recognizeAudioHybrid(audioBase64: string): Promise<ACRCloudResult> {
  console.log('[ACRCloud] Starting hybrid recognition...');
  console.log('[ACRCloud] Audio data length:', audioBase64.length);
  
  // Step 1: Try OFFLINE mode (Spynners catalog)
  console.log('[ACRCloud] Step 1: Trying OFFLINE mode (Spynners catalog)...');
  const offlineResult = await identifyAudio(audioBase64, OFFLINE_CONFIG, 'offline');
  
  if (offlineResult.found) {
    console.log('[ACRCloud] ✅ Track found in OFFLINE catalog:', offlineResult.title);
    return offlineResult;
  }
  
  console.log('[ACRCloud] No match in OFFLINE catalog, trying ONLINE...');
  
  // Step 2: Fallback to ONLINE mode (global catalog)
  console.log('[ACRCloud] Step 2: Trying ONLINE mode (global catalog)...');
  const onlineResult = await identifyAudio(audioBase64, ONLINE_CONFIG, 'online');
  
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
