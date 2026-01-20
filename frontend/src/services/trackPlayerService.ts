/**
 * Track Player Service
 * 
 * This service handles background audio playback events
 * Required by react-native-track-player
 */

import TrackPlayer, { Event, RepeatMode, Capability } from 'react-native-track-player';

export async function PlaybackService() {
  // Remote Play - only triggered by user action on lock screen / Control Center
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    console.log('[TrackPlayer] Remote Play - user pressed play');
    TrackPlayer.play();
  });

  // Remote Pause - only triggered by user action
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    console.log('[TrackPlayer] Remote Pause - user pressed pause');
    TrackPlayer.pause();
  });

  // Remote Stop
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    console.log('[TrackPlayer] Remote Stop');
    TrackPlayer.stop();
  });

  // Remote Next
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    console.log('[TrackPlayer] Remote Next');
    TrackPlayer.skipToNext();
  });

  // Remote Previous
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
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
