/**
 * Player Event Emitter
 * 
 * This module provides a global event emitter to synchronize
 * react-native-track-player (lock screen controls) with expo-av (actual playback)
 * 
 * The TrackPlayer only serves as a remote control - it doesn't play audio itself.
 * When the user interacts with the lock screen, events are emitted here,
 * and PlayerContext listens to them to control expo-av.
 */

type PlayerEventCallback = () => void;
type SeekEventCallback = (position: number) => void;

interface PlayerEvents {
  play: PlayerEventCallback[];
  pause: PlayerEventCallback[];
  stop: PlayerEventCallback[];
  next: PlayerEventCallback[];
  previous: PlayerEventCallback[];
  seek: SeekEventCallback[];
}

class PlayerEventEmitter {
  private listeners: PlayerEvents = {
    play: [],
    pause: [],
    stop: [],
    next: [],
    previous: [],
    seek: [],
  };

  on(event: 'play' | 'pause' | 'stop' | 'next' | 'previous', callback: PlayerEventCallback): void;
  on(event: 'seek', callback: SeekEventCallback): void;
  on(event: keyof PlayerEvents, callback: any): void {
    this.listeners[event].push(callback);
    console.log(`[PlayerEventEmitter] Listener added for '${event}', total: ${this.listeners[event].length}`);
  }

  off(event: keyof PlayerEvents, callback: any): void {
    const index = this.listeners[event].indexOf(callback);
    if (index > -1) {
      this.listeners[event].splice(index, 1);
      console.log(`[PlayerEventEmitter] Listener removed for '${event}'`);
    }
  }

  emit(event: 'play' | 'pause' | 'stop' | 'next' | 'previous'): void;
  emit(event: 'seek', position: number): void;
  emit(event: keyof PlayerEvents, data?: any): void {
    console.log(`[PlayerEventEmitter] Emitting '${event}'${data !== undefined ? ` with data: ${data}` : ''}`);
    
    if (event === 'seek') {
      this.listeners.seek.forEach(callback => callback(data));
    } else {
      (this.listeners[event] as PlayerEventCallback[]).forEach(callback => callback());
    }
  }

  // Clear all listeners (useful for cleanup)
  clear(): void {
    this.listeners = {
      play: [],
      pause: [],
      stop: [],
      next: [],
      previous: [],
      seek: [],
    };
    console.log('[PlayerEventEmitter] All listeners cleared');
  }
}

// Export a singleton instance
export const playerEventEmitter = new PlayerEventEmitter();
