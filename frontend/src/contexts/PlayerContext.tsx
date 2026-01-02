import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';
import { Track } from '../services/base44Api';

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  playbackPosition: number;
  playbackDuration: number;
  isLoading: boolean;
  playTrack: (track: Track) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  closePlayer: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPlaybackPosition(status.positionMillis || 0);
      setPlaybackDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);
      
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPlaybackPosition(0);
      }
    }
  };

  const playTrack = async (track: Track) => {
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
        setIsLoading(false);
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      // Create and play new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          shouldPlay: true,
          progressUpdateIntervalMillis: 500,
        },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setCurrentTrack(track);
      setIsPlaying(true);
      setPlaybackPosition(0);
      
      console.log('[Player] Playing:', track.title);
    } catch (error) {
      console.error('[Player] Error playing track:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayPause = async () => {
    if (!soundRef.current) return;
    
    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch (error) {
      console.error('[Player] Error toggling play/pause:', error);
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
      setIsPlaying(false);
      setPlaybackPosition(0);
      setPlaybackDuration(0);
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
        playTrack,
        togglePlayPause,
        seekTo,
        closePlayer,
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
