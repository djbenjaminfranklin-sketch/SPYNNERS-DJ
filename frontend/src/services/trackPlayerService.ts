/**
 * Track Player Service
 * 
 * This service handles background audio playback events
 * Required by react-native-track-player
 */

import TrackPlayer, { Event, RepeatMode, Capability } from 'react-native-track-player';
import { playerEventEmitter } from './playerEventEmitter';

export async function PlaybackService() {
  // Remote Play - only triggered by user action on lock screen / Control Center
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    playerEventEmitter.emit('play');
    console.log('[TrackPlayer] Remote Play - user pressed play');
    TrackPlayer.play();
  });

  // Remote Pause - only triggered by user action
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    playerEventEmitter.emit('pause');
    console.log('[TrackPlayer] Remote Pause - user pressed pause');
    TrackPlayer.pause();
  });

  // Remote Stop
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    playerEventEmitter.emit('stop');
    console.log('[TrackPlayer] Remote Stop');
    TrackPlayer.stop();
  });

  // Remote Next
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    playerEventEmitter.emit('next');
    console.log('[TrackPlayer] Remote Next');
    TrackPlayer.skipToNext();
  });

  // Remote Previous
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    playerEventEmitter.emit('previous');
    console.log('[TrackPlayer] Remote Previous');
    TrackPlayer.skipToPrevious();
  });

  // Remote Seek
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    console.log('[TrackPlayer] Remote Seek to:', event.position);
    TrackPlayer.seekTo(event.position);
  });

  // DO NOT auto-play on these events - they can cause the "won't pause" bug
  // Event.PlaybackState - removed
  // Event.PlaybackTrackChanged - removed
}

export async function setupPlayer() {
  let isSetup = false;
  
  try {
    // Check if player is already initialized
    await TrackPlayer.getActiveTrack();
    isSetup = true;
    console.log('[TrackPlayer] Player already initialized');
  } catch {
    // Player not initialized, set it up
    try {
      await TrackPlayer.setupPlayer({
        // iOS specific options
        autoHandleInterruptions: true,
      });
      
      await TrackPlayer.updateOptions({
        // Capabilities for lock screen / notification
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
        ],
        // Compact notification capabilities (Android)
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
        ],
        // Progress updates
        progressUpdateEventInterval: 1,
      });
      
      await TrackPlayer.setRepeatMode(RepeatMode.Off);
      
      isSetup = true;
      console.log('[TrackPlayer] ✅ Player setup complete');
    } catch (error) {
      console.error('[TrackPlayer] Setup error:', error);
    }
  }
  
  return isSetup;
}

export async function updateNowPlaying(track: {
  id: string;
  title: string;
  artist: string;
  artwork?: string;
  duration?: number;
  audioUrl?: string;
}) {
  try {
    await TrackPlayer.reset();
    
    const silenceDataUrl = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    
    await TrackPlayer.add({
      id: track.id,
      url: track.audioUrl || silenceDataUrl,
      title: track.title,
      artist: track.artist,
      artwork: track.artwork,
      duration: track.duration,
    });
    
    console.log('[TrackPlayer] Now playing updated:', track.title);
  } catch (error) {
    console.error('[TrackPlayer] Error updating now playing:', error);
  }
}

export async function updatePlaybackState(isPlaying: boolean, position?: number) {
  try {
    if (isPlaying) {
      await TrackPlayer.setRate(0);
      await TrackPlayer.play();
    } else {
      await TrackPlayer.pause();
    }
    
    if (position !== undefined) {
      await TrackPlayer.seekTo(position / 1000);
    }
  } catch (error) {
    console.log('[TrackPlayer] State sync error (non-fatal):', error);
  }
}

export async function clearNowPlaying() {
  try {
    await TrackPlayer.reset();
    console.log('[TrackPlayer] Now playing cleared');
  } catch (error) {
    console.log('[TrackPlayer] Error clearing now playing:', error);
  }
}
