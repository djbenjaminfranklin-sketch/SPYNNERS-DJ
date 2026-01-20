import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { Track } from '../services/base44Api';
import { playerEventEmitter } from '../services/playerEventEmitter';
import { updateNowPlaying, updatePlaybackState, clearNowPlaying } from '../services/trackPlayerService';

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  playbackPosition: number;
  playbackDuration: number;
  isLoading: boolean;
  queue: Track[];
  currentIndex: number;
  playTrack: (track: Track, trackList?: Track[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  closePlayer: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Reference for VIP preview timeout
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Reference for current track (for use in callbacks)
  const currentTrackRef = useRef<Track | null>(null);
  
  // Reference for queue (for use in callbacks)
  const queueRef = useRef<Track[]>([]);
  const currentIndexRef = useRef<number>(0);
  
  // Keep refs in sync with state
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
      // Clear event listeners
      playerEventEmitter.clear();
    };
  }, []);

  // Flag to prevent immediate stop after loading
  const isSeekingRef = useRef(false);

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPlaybackPosition(status.positionMillis || 0);
      setPlaybackDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);
      
      // Skip VIP check while seeking/loading
      if (isSeekingRef.current) {
        return;
      }
      
      // Check if we've reached the VIP preview end (use ref for current value)
      // IMPORTANT: Only apply VIP logic if track is EXPLICITLY marked as VIP with valid preview times
      const track = currentTrackRef.current;
      const isVipTrack = track?.is_vip === true;
      const hasValidPreview = track?.vip_preview_start !== undefined && 
                              track?.vip_preview_start !== null &&
                              track?.vip_preview_start > 0 &&
                              track?.vip_preview_end !== undefined && 
                              track?.vip_preview_end !== null &&
                              track?.vip_preview_end > 0 &&
                              track?.vip_preview_end > track?.vip_preview_start;
      
      if (isVipTrack && hasValidPreview) {
        const previewEndMs = track.vip_preview_end * 1000;
        
        // Stop only when we reach the preview end
        if (status.positionMillis >= previewEndMs && status.isPlaying) {
          console.log('[Player] VIP preview ended at', status.positionMillis / 1000, 'seconds (end:', track.vip_preview_end, ')');
          soundRef.current?.pauseAsync();
          setIsPlaying(false);
        }
      }
      
      if (status.didJustFinish) {
        console.log('[Player] Track finished, auto-playing next...');
        setIsPlaying(false);
        setPlaybackPosition(0);
        
        // Auto-play next track if there's a queue
        if (queueRef.current.length > 1) {
          const nextIndex = (currentIndexRef.current + 1) % queueRef.current.length;
          console.log('[Player] Auto-playing next track, index:', nextIndex);
          currentIndexRef.current = nextIndex;
          setCurrentIndex(nextIndex);
          // Small delay before playing next track for smoother transition
          setTimeout(() => {
            playTrackInternal(queueRef.current[nextIndex]);
          }, 500);
        }
      }
    }
  };

  // ========== LOCK SCREEN REMOTE CONTROL HANDLERS ==========
  // These functions are called when the user interacts with the iOS lock screen
  // or Control Center. They control expo-av, NOT TrackPlayer.
  
  const handleRemotePlay = useCallback(async () => {
    console.log('[Player] Remote play command received');
    if (soundRef.current) {
      try {
        await soundRef.current.playAsync();
        setIsPlaying(true);
        // Update lock screen state
        if (Platform.OS === 'ios') {
          updatePlaybackState(true);
        }
      } catch (error) {
        console.error('[Player] Remote play error:', error);
      }
    }
  }, []);

  const handleRemotePause = useCallback(async () => {
    console.log('[Player] Remote pause command received');
    if (soundRef.current) {
      try {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        // Update lock screen state
        if (Platform.OS === 'ios') {
          updatePlaybackState(false);
        }
      } catch (error) {
        console.error('[Player] Remote pause error:', error);
      }
    }
  }, []);

  const handleRemoteStop = useCallback(async () => {
    console.log('[Player] Remote stop command received');
    await closePlayer();
  }, []);

  const handleRemoteSeek = useCallback(async (positionMs: number) => {
    console.log('[Player] Remote seek command received:', positionMs);
    await seekTo(positionMs);
  }, []);

  // Subscribe to lock screen events
  useEffect(() => {
    console.log('[Player] Setting up lock screen event listeners');
    
    playerEventEmitter.on('play', handleRemotePlay);
    playerEventEmitter.on('pause', handleRemotePause);
    playerEventEmitter.on('stop', handleRemoteStop);
    playerEventEmitter.on('seek', handleRemoteSeek);
    
    // For next/previous, we need to use refs since the queue state might not be current
    const handleRemoteNext = async () => {
      console.log('[Player] Remote next command received');
      if (queueRef.current.length <= 1) return;
      const nextIndex = (currentIndexRef.current + 1) % queueRef.current.length;
      setCurrentIndex(nextIndex);
      await playTrackInternal(queueRef.current[nextIndex]);
    };
    
    const handleRemotePrevious = async () => {
      console.log('[Player] Remote previous command received');
      if (queueRef.current.length <= 1) return;
      const prevIndex = currentIndexRef.current > 0 ? currentIndexRef.current - 1 : queueRef.current.length - 1;
      setCurrentIndex(prevIndex);
      await playTrackInternal(queueRef.current[prevIndex]);
    };
    
    playerEventEmitter.on('next', handleRemoteNext);
    playerEventEmitter.on('previous', handleRemotePrevious);
    
    return () => {
      playerEventEmitter.off('play', handleRemotePlay);
      playerEventEmitter.off('pause', handleRemotePause);
      playerEventEmitter.off('stop', handleRemoteStop);
      playerEventEmitter.off('seek', handleRemoteSeek);
      playerEventEmitter.off('next', handleRemoteNext);
      playerEventEmitter.off('previous', handleRemotePrevious);
    };
  }, [handleRemotePlay, handleRemotePause, handleRemoteStop, handleRemoteSeek]);

  // ========== END LOCK SCREEN HANDLERS ==========

  // Flag to prevent concurrent playTrack calls
  const isLoadingTrackRef = useRef(false);

  const playTrack = async (track: Track, trackList?: Track[]) => {
    // Prevent concurrent calls
    if (isLoadingTrackRef.current) {
      console.log('[Player] Already loading a track, ignoring...');
      return;
    }
    
    try {
      isLoadingTrackRef.current = true;
      setIsLoading(true);
      console.log('[Player] Attempting to play track:', track.title);
      console.log('[Player] Is VIP:', track.is_vip);
      console.log('[Player] VIP Preview Start:', track.vip_preview_start);
      console.log('[Player] VIP Preview End:', track.vip_preview_end);
      
      // Clear any existing preview timeout
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
      }
      
      // CRITICAL: Stop and unload current sound FIRST before anything else
      if (soundRef.current) {
        try {
          console.log('[Player] Stopping previous sound...');
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
          console.log('[Player] Previous sound stopped and unloaded');
        } catch (stopError) {
          console.log('[Player] Error stopping previous sound:', stopError);
        }
        soundRef.current = null;
      }
      
      // Update queue if trackList provided
      if (trackList && trackList.length > 0) {
        console.log('[Player] Setting queue with', trackList.length, 'tracks');
        setQueue(trackList);
        const index = trackList.findIndex(t => 
          (t.id || t._id) === (track.id || track._id)
        );
        setCurrentIndex(index >= 0 ? index : 0);
        console.log('[Player] Current index:', index);
      } else {
        // Single track - clear queue but keep current track
        setQueue([track]);
        setCurrentIndex(0);
      }

      const audioUrl = track.audio_url || track.audio_file;
      console.log('[Player] Audio URL:', audioUrl);
      
      if (!audioUrl) {
        console.warn('[Player] No audio URL for track:', track.title);
        // Still set the current track so the player appears
        setCurrentTrack(track);
        setIsPlaying(false);
        setIsLoading(false);
        return;
      }

      // Configure audio mode for iOS and Android
      // iOS requires specific settings for reliable playback
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        allowsRecordingIOS: false,
        interruptionModeIOS: 1, // Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX = 1
        interruptionModeAndroid: 1, // Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX = 1
      });
      console.log('[Player] Audio mode configured for iOS/Android');

      // Determine initial position for VIP tracks
      let initialPositionMs = 0;
      if (track.is_vip && track.vip_preview_start !== undefined) {
        initialPositionMs = track.vip_preview_start * 1000;
        console.log('[Player] Starting VIP preview at', track.vip_preview_start, 'seconds');
      }

      // Set seeking flag to prevent premature stop
      isSeekingRef.current = true;

      // Create and play new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          shouldPlay: true,
          positionMillis: initialPositionMs,
          progressUpdateIntervalMillis: 500,
        },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      currentTrackRef.current = track; // Update ref for callbacks
      setCurrentTrack(track);
      setIsPlaying(true);
      setPlaybackPosition(initialPositionMs);
      
      // Clear seeking flag after a short delay (allow position to settle)
      setTimeout(() => {
        isSeekingRef.current = false;
        console.log('[Player] Seeking complete, VIP check enabled');
      }, 1000);
      
      // Set timeout for VIP preview end - ONLY for valid VIP tracks
      const isVipTrack = track.is_vip === true;
      const hasValidPreview = track.vip_preview_start !== undefined && 
                              track.vip_preview_start !== null &&
                              track.vip_preview_start > 0 &&
                              track.vip_preview_end !== undefined && 
                              track.vip_preview_end !== null &&
                              track.vip_preview_end > 0 &&
                              track.vip_preview_end > track.vip_preview_start;
      
      if (isVipTrack && hasValidPreview) {
        const previewDurationMs = (track.vip_preview_end - track.vip_preview_start) * 1000;
        console.log('[Player] VIP track - preview duration:', previewDurationMs / 1000, 'seconds');
        
        previewTimeoutRef.current = setTimeout(async () => {
          console.log('[Player] VIP preview timeout reached');
          if (soundRef.current) {
            await soundRef.current.pauseAsync();
            setIsPlaying(false);
          }
        }, previewDurationMs);
      } else {
        console.log('[Player] Normal track (not VIP) - no preview limit');
      }
      
      console.log('[Player] Playing:', track.title);
      
      // Update iOS lock screen / Control Center with track info
      if (Platform.OS === 'ios') {
        const trackId = track.id || track._id || '';
        const artistName = track.producer_name || track.artist_name || 'Unknown Artist';
        const artworkUrl = track.artwork_url || track.cover_image;
        
        try {
          await updateNowPlaying({
            id: trackId,
            title: track.title,
            artist: artistName,
            artwork: artworkUrl,
            duration: playbackDuration / 1000, // Convert ms to seconds
          });
          await updatePlaybackState(true, initialPositionMs);
          console.log('[Player] Lock screen updated for:', track.title);
        } catch (lockScreenError) {
          console.log('[Player] Lock screen update failed (non-fatal):', lockScreenError);
        }
      }
    } catch (error) {
      console.error('[Player] Error playing track:', error);
    } finally {
      setIsLoading(false);
      isLoadingTrackRef.current = false; // Always release the lock
    }
  };
  
  // Internal function to play a track without modifying the queue
  const playTrackInternal = async (track: Track) => {
    try {
      setIsLoading(true);
      
      // Stop and unload current sound
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const audioUrl = track.audio_url || track.audio_file;
      
      if (!audioUrl) {
        console.warn('[Player] No audio URL for track:', track.title);
        setCurrentTrack(track);
        setIsPlaying(false);
        setIsLoading(false);
        return;
      }

      // Configure audio mode for iOS and Android
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        allowsRecordingIOS: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      currentTrackRef.current = track; // Update ref for callbacks
      setCurrentTrack(track);
      setIsPlaying(true);
      setPlaybackPosition(0);
      
      console.log('[Player] Playing (internal):', track.title);
      
      // Update iOS lock screen
      if (Platform.OS === 'ios') {
        const trackId = track.id || track._id || '';
        const artistName = track.producer_name || track.artist_name || 'Unknown Artist';
        const artworkUrl = track.artwork_url || track.cover_image;
        
        try {
          await updateNowPlaying({
            id: trackId,
            title: track.title,
            artist: artistName,
            artwork: artworkUrl,
          });
          await updatePlaybackState(true, 0);
        } catch (e) {
          console.log('[Player] Lock screen update failed (non-fatal)');
        }
      }
    } catch (error) {
      console.error('[Player] Error playing track:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const playNext = async () => {
    if (queue.length <= 1) return;
    const nextIndex = (currentIndex + 1) % queue.length;
    console.log('[Player] Playing next track, index:', nextIndex);
    setCurrentIndex(nextIndex);
    await playTrackInternal(queue[nextIndex]);
  };
  
  const playPrevious = async () => {
    if (queue.length <= 1) return;
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
    console.log('[Player] Playing previous track, index:', prevIndex);
    setCurrentIndex(prevIndex);
    await playTrackInternal(queue[prevIndex]);
  };

  const togglePlayPause = async () => {
    if (!soundRef.current) {
      console.log('[Player] togglePlayPause: No sound loaded');
      return;
    }
    
    try {
      // Get the actual status from the sound object (more reliable than state on iOS)
      const status = await soundRef.current.getStatusAsync();
      console.log('[Player] togglePlayPause - Current status:', status.isLoaded ? (status.isPlaying ? 'playing' : 'paused') : 'not loaded');
      
      if (!status.isLoaded) {
        console.log('[Player] Sound not loaded, cannot toggle');
        return;
      }
      
      if (status.isPlaying) {
        console.log('[Player] Pausing...');
        await soundRef.current.pauseAsync();
        // Immediately update state for responsive UI (don't wait for callback)
        setIsPlaying(false);
        // Update lock screen
        if (Platform.OS === 'ios') {
          updatePlaybackState(false, status.positionMillis);
        }
      } else {
        console.log('[Player] Playing...');
        await soundRef.current.playAsync();
        // Immediately update state for responsive UI (don't wait for callback)
        setIsPlaying(true);
        // Update lock screen
        if (Platform.OS === 'ios') {
          updatePlaybackState(true, status.positionMillis);
        }
      }
    } catch (error) {
      console.error('[Player] Error toggling play/pause:', error);
      // Try to recover by getting current status
      try {
        const status = await soundRef.current?.getStatusAsync();
        if (status?.isLoaded) {
          setIsPlaying(status.isPlaying);
        }
      } catch (e) {
        // Ignore recovery error
      }
    }
  };

  const seekTo = async (positionMs: number) => {
    if (!soundRef.current || playbackDuration === 0) return;
    
    try {
      // Clamp position to valid range
      const clampedPosition = Math.max(0, Math.min(positionMs, playbackDuration));
      console.log('[Player] Seeking to:', clampedPosition, 'ms');
      
      await soundRef.current.setPositionAsync(clampedPosition);
      setPlaybackPosition(clampedPosition);
    } catch (error) {
      console.error('[Player] Error seeking:', error);
    }
  };

  const closePlayer = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setCurrentTrack(null);
      currentTrackRef.current = null;
      setIsPlaying(false);
      setPlaybackPosition(0);
      setPlaybackDuration(0);
      
      // Clear iOS lock screen
      if (Platform.OS === 'ios') {
        try {
          await clearNowPlaying();
        } catch (e) {
          console.log('[Player] Clear lock screen failed (non-fatal)');
        }
      }
    } catch (error) {
      console.error('[Player] Error closing:', error);
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        playbackPosition,
        playbackDuration,
        isLoading,
        queue,
        currentIndex,
        playTrack,
        togglePlayPause,
        seekTo,
        closePlayer,
        playNext,
        playPrevious,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
