/**
 * ACRCloud Recognition Service via Base44
 * 
 * Uses the Base44 cloud function 'recognizeAudio' which handles
 * ACRCloud integration server-side (same as the website).
 */

import { Platform } from 'react-native';

// Base44 API configuration - same as website
const BASE44_API_URL = 'https://spynners.base44.app';

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
  spynners_track_id?: string;
  producer_id?: string;
  external_ids?: {
    isrc?: string;
    upc?: string;
  };
  error?: string;
}

/**
 * Call Base44 recognizeAudio function (same as website)
 * This is the ONLY method - works on both web and mobile
 */
export async function recognizeAudioHybrid(audioBase64: string): Promise<ACRCloudResult> {
  console.log('[ACRCloud] Starting recognition via Base44...');
  console.log('[ACRCloud] Audio data length:', audioBase64.length, 'Platform:', Platform.OS);
  
  try {
    // Call Base44 function directly - EXACTLY like the website does
    // base44.functions.invoke('recognizeAudio', { audio_data, sample_rate, channels })
    const response = await fetch(`${BASE44_API_URL}/api/functions/recognizeAudio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_data: audioBase64,
        sample_rate: 48000,
        channels: 2,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ACRCloud] Base44 error:', response.status, errorText);
      throw new Error(`Base44 error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('[ACRCloud] Base44 response:', JSON.stringify(result).substring(0, 500));
    
    // Parse response - Base44 function may return data in 'data' field or directly
    const data = result.data || result;
    
    // Check for error in response
    if (data.error) {
      console.log('[ACRCloud] API returned error:', data.error);
      return {
        success: false,
        found: false,
        mode: 'none',
        error: data.error,
      };
    }
    
    // Check if track was found
    if (data.success && data.found) {
      console.log('[ACRCloud] ✅ Track found:', data.title, 'by', data.artist);
      return {
        success: true,
        found: true,
        title: data.title || data.external_metadata?.title || data.external_title,
        artist: data.artist || data.external_metadata?.artist || data.external_artist,
        album: data.album,
        genre: data.genre,
        cover_image: data.cover_image || data.artwork_url,
        score: data.score,
        mode: data.mode || 'offline',
        acr_id: data.acr_id,
        spynners_track_id: data.spynners_track_id,
        producer_id: data.producer_id,
        external_ids: data.external_ids,
      };
    }
    
    // Check if we found track info even without explicit 'found' flag
    if (data.title || data.external_title) {
      console.log('[ACRCloud] ✅ Track info found:', data.title || data.external_title);
      return {
        success: true,
        found: true,
        title: data.title || data.external_title,
        artist: data.artist || data.external_artist || 'Unknown Artist',
        album: data.album,
        genre: data.genre,
        cover_image: data.cover_image || data.artwork_url,
        score: data.score,
        mode: data.mode || 'offline',
        acr_id: data.acr_id,
        spynners_track_id: data.spynners_track_id,
        producer_id: data.producer_id,
        external_ids: data.external_ids,
      };
    }
    
    // No match found
    console.log('[ACRCloud] No track found in response');
    return {
      success: true,
      found: false,
      mode: 'none',
      error: data.message || 'No track found',
    };
    
  } catch (error: any) {
    console.error('[ACRCloud] Recognition error:', error?.message || error);
    return {
      success: false,
      found: false,
      mode: 'none',
      error: error?.message || 'Recognition failed',
    };
  }
}

export default {
  recognizeAudioHybrid,
};
