---
name: base44-api
description: Integration API Base44 pour SPYNNERS
globs: ["**/services/**/*", "**/api/**/*"]
---

# API Base44 - SPYNNERS

## Configuration

### Endpoints
```typescript
const BASE44_CONFIG = {
  baseUrl: 'https://spynners.base44.app/api/apps/691a4d96d819355b52c063f3',
  proxyUrl: 'https://trackmix-6.preview.emergentagent.com',
  timeout: 30000,
};

// Headers standards
const getHeaders = (token?: string) => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  ...(token && { 'Authorization': `Bearer ${token}` }),
});
```

## Client HTTP

### Fetch Wrapper Type-Safe
```typescript
interface RequestConfig<T = unknown> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  body?: T;
  params?: Record<string, string | number | boolean>;
  signal?: AbortSignal;
  skipAuth?: boolean;
}

async function apiRequest<TResponse, TBody = unknown>(
  config: RequestConfig<TBody>
): Promise<TResponse> {
  const { method, endpoint, body, params, signal, skipAuth } = config;

  // Build URL with params
  const url = new URL(`${BASE44_CONFIG.baseUrl}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  // Get token
  const token = skipAuth ? null : await getStoredToken();

  const response = await fetch(url.toString(), {
    method,
    headers: getHeaders(token ?? undefined),
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new APIError(
      error.message || `HTTP ${response.status}`,
      response.status,
      error.code
    );
  }

  return response.json();
}
```

### Error Handling
```typescript
class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }

  get isNetworkError(): boolean {
    return this.statusCode === 0;
  }

  get isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  get isServerError(): boolean {
    return this.statusCode >= 500;
  }
}

// Retry logic
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0 || (error instanceof APIError && error.isAuthError)) {
      throw error;
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}
```

## Services API

### Authentication Service
```typescript
interface LoginResponse {
  token: string;
  user: User;
}

interface SignupInput {
  email: string;
  password: string;
  fullName: string;
  userType: 'dj' | 'producer' | 'listener';
}

export const base44Auth = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiRequest<LoginResponse>({
      method: 'POST',
      endpoint: '/auth/login',
      body: { email, password },
      skipAuth: true,
    });

    // Store credentials
    await AsyncStorage.setItem('auth_token', response.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.user));

    return response;
  },

  async signup(input: SignupInput): Promise<LoginResponse> {
    const response = await apiRequest<LoginResponse>({
      method: 'POST',
      endpoint: '/auth/signup',
      body: input,
      skipAuth: true,
    });

    await AsyncStorage.setItem('auth_token', response.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.user));

    return response;
  },

  async me(): Promise<User | null> {
    try {
      return await apiRequest<User>({
        method: 'GET',
        endpoint: '/auth/me',
      });
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    await AsyncStorage.multiRemove(['auth_token', 'user']);
    cache.clear();
  },

  async getStoredToken(): Promise<string | null> {
    return AsyncStorage.getItem('auth_token');
  },

  async getStoredUser(): Promise<User | null> {
    const data = await AsyncStorage.getItem('user');
    return data ? JSON.parse(data) : null;
  },
};
```

### Tracks Service
```typescript
interface TrackFilters {
  genre?: string;
  energy?: string;
  status?: 'approved' | 'pending' | 'rejected';
  uploadedBy?: string;
  search?: string;
  isVIP?: boolean;
}

interface CreateTrackInput {
  title: string;
  artist: string;
  genre: string;
  energy: string;
  audioUrl: string;
  artworkUrl?: string;
  bpm?: number;
  duration: number;
  isVIP?: boolean;
}

export const base44Tracks = {
  async list(filters?: TrackFilters): Promise<Track[]> {
    const cacheKey = `tracks:${JSON.stringify(filters || {})}`;
    const cached = getCached<Track[]>(cacheKey);
    if (cached) return cached;

    const tracks = await apiRequest<Track[]>({
      method: 'GET',
      endpoint: '/tracks/all',
      params: filters as Record<string, string>,
    });

    setCache(cacheKey, tracks, CACHE_DURATIONS.tracks);
    return tracks;
  },

  async listVIP(): Promise<Track[]> {
    const cacheKey = 'tracks:vip';
    const cached = getCached<Track[]>(cacheKey);
    if (cached) return cached;

    const tracks = await apiRequest<Track[]>({
      method: 'GET',
      endpoint: '/tracks/vip',
    });

    setCache(cacheKey, tracks, CACHE_DURATIONS.tracks);
    return tracks;
  },

  async getById(trackId: string): Promise<Track | null> {
    try {
      return await apiRequest<Track>({
        method: 'GET',
        endpoint: `/tracks/${trackId}`,
      });
    } catch {
      return null;
    }
  },

  async create(input: CreateTrackInput): Promise<Track> {
    const track = await apiRequest<Track>({
      method: 'POST',
      endpoint: '/tracks',
      body: input,
    });

    // Invalidate cache
    invalidateCachePattern('tracks:');

    return track;
  },

  async update(trackId: string, updates: Partial<Track>): Promise<Track> {
    const track = await apiRequest<Track>({
      method: 'PATCH',
      endpoint: `/tracks/${trackId}`,
      body: updates,
    });

    invalidateCachePattern('tracks:');
    return track;
  },

  async delete(trackId: string): Promise<boolean> {
    await apiRequest<void>({
      method: 'DELETE',
      endpoint: `/tracks/${trackId}`,
    });

    invalidateCachePattern('tracks:');
    return true;
  },

  async search(query: string): Promise<Track[]> {
    return apiRequest<Track[]>({
      method: 'GET',
      endpoint: '/tracks/search',
      params: { q: query },
    });
  },
};
```

### Playlists Service
```typescript
export const base44Playlists = {
  async list(userId?: string): Promise<Playlist[]> {
    const params = userId ? { userId } : undefined;
    return apiRequest<Playlist[]>({
      method: 'GET',
      endpoint: '/playlists',
      params,
    });
  },

  async getById(playlistId: string): Promise<Playlist | null> {
    try {
      return await apiRequest<Playlist>({
        method: 'GET',
        endpoint: `/playlists/${playlistId}`,
      });
    } catch {
      return null;
    }
  },

  async create(input: CreatePlaylistInput): Promise<Playlist> {
    return apiRequest<Playlist>({
      method: 'POST',
      endpoint: '/playlists',
      body: input,
    });
  },

  async addTrack(playlistId: string, trackId: string): Promise<Playlist> {
    return apiRequest<Playlist>({
      method: 'POST',
      endpoint: `/playlists/${playlistId}/tracks`,
      body: { trackId },
    });
  },

  async removeTrack(playlistId: string, trackId: string): Promise<Playlist> {
    return apiRequest<Playlist>({
      method: 'DELETE',
      endpoint: `/playlists/${playlistId}/tracks/${trackId}`,
    });
  },
};
```

## Best Practices

### Request Cancellation
```typescript
function useApiRequest<T>(fetcher: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle' });

  useEffect(() => {
    const controller = new AbortController();

    setState({ status: 'loading' });

    fetcher(controller.signal)
      .then(data => setState({ status: 'success', data }))
      .catch(error => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', error });
        }
      });

    return () => controller.abort();
  }, [fetcher]);

  return state;
}
```

### Optimistic Updates
```typescript
async function toggleLike(trackId: string, currentlyLiked: boolean) {
  // Optimistic update
  setLikedTracks(prev =>
    currentlyLiked
      ? prev.filter(id => id !== trackId)
      : [...prev, trackId]
  );

  try {
    await base44Tracks.toggleLike(trackId);
  } catch (error) {
    // Rollback
    setLikedTracks(prev =>
      currentlyLiked
        ? [...prev, trackId]
        : prev.filter(id => id !== trackId)
    );
    throw error;
  }
}
```
