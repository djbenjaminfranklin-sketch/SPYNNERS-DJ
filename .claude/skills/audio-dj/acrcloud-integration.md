---
name: acrcloud-integration
description: Integration ACRCloud pour reconnaissance audio
globs: ["**/services/acrcloud**", "**/spyn/**/*"]
---

# ACRCloud Integration - SPYNNERS

## Configuration

### Credentials
```typescript
// src/config/acrcloud.ts
export const ACR_CONFIG = {
  host: 'identify-eu-west-1.acrcloud.com',
  accessKey: process.env.EXPO_PUBLIC_ACR_ACCESS_KEY || '',
  accessSecret: process.env.EXPO_PUBLIC_ACR_ACCESS_SECRET || '',
  timeout: 10000, // 10 seconds
};
```

### Types ACRCloud
```typescript
interface ACRCloudResponse {
  status: {
    code: number;
    msg: string;
    version: string;
  };
  metadata?: {
    music?: ACRCloudTrack[];
    humming?: ACRCloudTrack[];
    custom_files?: ACRCloudCustomFile[];
  };
  cost_time?: number;
  result_type?: number;
}

interface ACRCloudTrack {
  acrid: string;
  title: string;
  artists: Array<{ name: string }>;
  album?: { name: string };
  label?: string;
  genres?: Array<{ name: string }>;
  release_date?: string;
  duration_ms: number;
  score: number;
  play_offset_ms?: number;
  external_ids?: {
    isrc?: string;
    upc?: string;
  };
  external_metadata?: {
    spotify?: { track?: { id: string } };
    deezer?: { track?: { id: string } };
    youtube?: { vid?: string };
  };
}

interface ACRCloudCustomFile {
  acrid: string;
  title: string;
  audio_id: string;
  bucket_id: string;
  score: number;
  play_offset_ms: number;
}
```

## Service ACRCloud

### Implementation Complete
```typescript
import * as FileSystem from 'expo-file-system';
import CryptoJS from 'crypto-js';
import { ACR_CONFIG } from '@/src/config/acrcloud';

class ACRCloudService {
  private signRequest(
    method: string,
    uri: string,
    timestamp: number
  ): string {
    const stringToSign = [
      method,
      uri,
      ACR_CONFIG.accessKey,
      'audio',
      '1',
      timestamp.toString(),
    ].join('\n');

    return CryptoJS.HmacSHA1(stringToSign, ACR_CONFIG.accessSecret)
      .toString(CryptoJS.enc.Base64);
  }

  async identify(audioUri: string): Promise<ACRCloudResponse> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.signRequest('POST', '/v1/identify', timestamp);

    // Read audio file
    const fileInfo = await FileSystem.getInfoAsync(audioUri, { size: true });
    if (!fileInfo.exists) {
      throw new Error('Audio file not found');
    }

    const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Build form data
    const formData = new FormData();
    formData.append('access_key', ACR_CONFIG.accessKey);
    formData.append('sample_bytes', fileInfo.size?.toString() || '0');
    formData.append('sample', audioBase64);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('data_type', 'audio');
    formData.append('signature_version', '1');

    // Make request
    const response = await fetch(
      `https://${ACR_CONFIG.host}/v1/identify`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`ACRCloud request failed: ${response.status}`);
    }

    return response.json();
  }

  async identifyFromBuffer(
    audioBuffer: ArrayBuffer,
    sampleSize: number
  ): Promise<ACRCloudResponse> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.signRequest('POST', '/v1/identify', timestamp);

    // Convert buffer to base64
    const bytes = new Uint8Array(audioBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const audioBase64 = btoa(binary);

    const formData = new FormData();
    formData.append('access_key', ACR_CONFIG.accessKey);
    formData.append('sample_bytes', sampleSize.toString());
    formData.append('sample', audioBase64);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('data_type', 'audio');
    formData.append('signature_version', '1');

    const response = await fetch(
      `https://${ACR_CONFIG.host}/v1/identify`,
      {
        method: 'POST',
        body: formData,
      }
    );

    return response.json();
  }

  parseResponse(response: ACRCloudResponse): DetectedTrack | null {
    if (response.status.code !== 0) {
      // Error codes:
      // 0 = Success
      // 1001 = No result
      // 2000 = Recording error
      // 3000 = Limit exceeded
      // 3001 = Invalid API key
      console.log('ACRCloud status:', response.status.msg);
      return null;
    }

    const music = response.metadata?.music;
    if (!music || music.length === 0) {
      return null;
    }

    const track = music[0]; // Best match

    return {
      title: track.title,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album?.name,
      duration: track.duration_ms,
      confidence: track.score / 100, // Score is 0-100
      playOffset: track.play_offset_ms || 0,
      externalIds: {
        acrid: track.acrid,
        isrc: track.external_ids?.isrc,
        spotifyId: track.external_metadata?.spotify?.track?.id,
        deezerId: track.external_metadata?.deezer?.track?.id,
      },
    };
  }

  isSuccess(response: ACRCloudResponse): boolean {
    return response.status.code === 0 && !!response.metadata?.music?.length;
  }

  getErrorMessage(response: ACRCloudResponse): string {
    switch (response.status.code) {
      case 0:
        return 'Success';
      case 1001:
        return 'No match found';
      case 2000:
        return 'Recording error';
      case 2001:
        return 'Audio too short';
      case 2002:
        return 'Audio too long';
      case 2004:
        return 'Unable to generate fingerprint';
      case 2005:
        return 'Timeout';
      case 3000:
        return 'Rate limit exceeded';
      case 3001:
        return 'Invalid API key';
      case 3002:
        return 'Invalid signature';
      case 3003:
        return 'Access denied';
      case 3014:
        return 'Invalid audio';
      default:
        return response.status.msg || 'Unknown error';
    }
  }
}

export const acrCloudService = new ACRCloudService();
```

## Analyse en Temps Reel

### Real-time Recognition during Recording
```typescript
interface RealtimeRecognitionConfig {
  intervalMs: number;      // Intervalle entre analyses (defaut: 10s)
  minConfidence: number;   // Score minimum pour accepter (defaut: 0.7)
  maxConcurrent: number;   // Analyses simultanees max
}

export function useRealtimeRecognition(
  recordingUri: string | null,
  isRecording: boolean,
  config: RealtimeRecognitionConfig = {
    intervalMs: 10000,
    minConfidence: 0.7,
    maxConcurrent: 1,
  }
) {
  const [detectedTracks, setDetectedTracks] = useState<DetectedTrack[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null);

  const intervalRef = useRef<NodeJS.Timer | null>(null);
  const pendingRef = useRef(0);

  const analyze = useCallback(async () => {
    if (!recordingUri || pendingRef.current >= config.maxConcurrent) {
      return;
    }

    pendingRef.current++;
    setIsAnalyzing(true);

    try {
      const response = await acrCloudService.identify(recordingUri);
      const track = acrCloudService.parseResponse(response);

      if (track && track.confidence >= config.minConfidence) {
        // Eviter les doublons
        setDetectedTracks(prev => {
          const exists = prev.some(
            t => t.title === track.title && t.artist === track.artist
          );
          if (exists) return prev;
          return [...prev, { ...track, detectedAt: new Date().toISOString() }];
        });
      }

      setLastAnalysis(new Date());
    } catch (error) {
      console.error('ACRCloud analysis error:', error);
    } finally {
      pendingRef.current--;
      setIsAnalyzing(false);
    }
  }, [recordingUri, config.minConfidence, config.maxConcurrent]);

  useEffect(() => {
    if (isRecording && recordingUri) {
      // Premiere analyse apres 10 secondes
      const timeout = setTimeout(analyze, config.intervalMs);

      // Analyses suivantes a intervalles reguliers
      intervalRef.current = setInterval(analyze, config.intervalMs);

      return () => {
        clearTimeout(timeout);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isRecording, recordingUri, analyze, config.intervalMs]);

  return {
    detectedTracks,
    isAnalyzing,
    lastAnalysis,
    clearTracks: () => setDetectedTracks([]),
  };
}
```

## Optimisation

### Chunked Analysis
```typescript
// Pour les longs enregistrements, analyser par segments

async function analyzeRecordingByChunks(
  uri: string,
  chunkDurationSec: number = 30,
  overlapSec: number = 5
): Promise<DetectedTrack[]> {
  const detectedTracks: DetectedTrack[] = [];
  const seenTracks = new Set<string>();

  // Note: Cette implementation necessite la capacite de decouper l'audio
  // ce qui n'est pas nativement supporte par expo-av
  // En production, utiliser FFmpeg ou un service backend

  // Placeholder pour la logique de chunking
  const result = await acrCloudService.identify(uri);
  const track = acrCloudService.parseResponse(result);

  if (track) {
    const key = `${track.title}:${track.artist}`;
    if (!seenTracks.has(key)) {
      seenTracks.add(key);
      detectedTracks.push(track);
    }
  }

  return detectedTracks;
}
```

### Rate Limiting
```typescript
class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);
    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getWaitTime(): number {
    if (this.canMakeRequest()) return 0;
    const oldestRequest = this.requests[0];
    return this.windowMs - (Date.now() - oldestRequest);
  }
}

const acrRateLimiter = new RateLimiter(10, 60000); // 10 requests per minute

export async function identifyWithRateLimit(
  audioUri: string
): Promise<ACRCloudResponse> {
  if (!acrRateLimiter.canMakeRequest()) {
    const waitTime = acrRateLimiter.getWaitTime();
    throw new Error(`Rate limited. Wait ${Math.ceil(waitTime / 1000)} seconds.`);
  }

  acrRateLimiter.recordRequest();
  return acrCloudService.identify(audioUri);
}
```

## Types Resultats

### DetectedTrack Type
```typescript
interface DetectedTrack {
  title: string;
  artist: string;
  album?: string;
  duration: number; // ms
  confidence: number; // 0-1
  playOffset: number; // ms from start of track
  detectedAt?: string; // ISO timestamp
  externalIds?: {
    acrid?: string;
    isrc?: string;
    spotifyId?: string;
    deezerId?: string;
  };
}
```

## Error Handling

```typescript
export function handleACRCloudError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('Rate limited')) {
      return 'Trop de requetes. Veuillez patienter.';
    }
    if (error.message.includes('Invalid API key')) {
      return 'Erreur de configuration ACRCloud.';
    }
    if (error.message.includes('Network')) {
      return 'Erreur reseau. Verifiez votre connexion.';
    }
    return error.message;
  }
  return 'Erreur inconnue lors de l\'identification.';
}
```
