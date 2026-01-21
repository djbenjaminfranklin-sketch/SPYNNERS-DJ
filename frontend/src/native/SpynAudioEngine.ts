/**
 * SPYNAudioEngine - Native module wrapper for real-time audio analysis
 * Provides VU meters (L/R) and waveform data at 60fps
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { SPYNAudioEngine } = NativeModules;

// Types
export interface AudioData {
  leftLevel: number;      // -60 to 0 dB
  rightLevel: number;     // -60 to 0 dB
  peakLeft: number;       // Peak hold for left channel
  peakRight: number;      // Peak hold for right channel
  waveform: number[];     // 128 samples, 0-1 range
  timestamp: number;
}

export interface AudioRouteChange {
  reason: number;
  inputName: string;
  isExternal: boolean;
  inputCount: number;
}

export interface AudioInput {
  name: string;
  type: string;
  uid: string;
  isExternal: boolean;
}

export interface EngineStartResult {
  success: boolean;
  sampleRate: number;
  channelCount: number;
  inputName: string;
  isExternal: boolean;
}

export interface USBStatus {
  isUSBConnected: boolean;
  deviceName: string;
}

// Event emitter
let eventEmitter: NativeEventEmitter | null = null;

const getEventEmitter = () => {
  if (!eventEmitter && SPYNAudioEngine) {
    eventEmitter = new NativeEventEmitter(SPYNAudioEngine);
  }
  return eventEmitter;
};

// Module API
export const SpynAudioEngine = {
  /**
   * Check if native module is available
   */
  isAvailable: (): boolean => {
    return Platform.OS === 'ios' && SPYNAudioEngine != null;
  },

  /**
   * Start the audio engine and begin receiving audio data
   */
  startEngine: async (): Promise<EngineStartResult> => {
    if (!SPYNAudioEngine) {
      throw new Error('SPYNAudioEngine native module not available');
    }
    return await SPYNAudioEngine.startEngine();
  },

  /**
   * Stop the audio engine
   */
  stopEngine: async (): Promise<{ success: boolean }> => {
    if (!SPYNAudioEngine) {
      return { success: false };
    }
    return await SPYNAudioEngine.stopEngine();
  },

  /**
   * Get list of available audio inputs
   */
  getAudioInputs: async (): Promise<AudioInput[]> => {
    if (!SPYNAudioEngine) {
      return [];
    }
    return await SPYNAudioEngine.getAudioInputs();
  },

  /**
   * Check if USB audio device is connected
   */
  checkUSBConnected: async (): Promise<USBStatus> => {
    if (!SPYNAudioEngine) {
      return { isUSBConnected: false, deviceName: 'Microphone interne' };
    }
    return await SPYNAudioEngine.checkUSBConnected();
  },

  /**
   * Subscribe to real-time audio data (VU meters + waveform)
   * @param callback Called ~60 times per second with audio data
   * @returns Unsubscribe function
   */
  onAudioData: (callback: (data: AudioData) => void): (() => void) => {
    const emitter = getEventEmitter();
    if (!emitter) {
      console.warn('[SpynAudioEngine] Event emitter not available');
      return () => {};
    }
    
    const subscription = emitter.addListener('onAudioData', callback);
    return () => subscription.remove();
  },

  /**
   * Subscribe to audio route changes (USB plug/unplug)
   * @param callback Called when audio route changes
   * @returns Unsubscribe function
   */
  onAudioRouteChange: (callback: (data: AudioRouteChange) => void): (() => void) => {
    const emitter = getEventEmitter();
    if (!emitter) {
      return () => {};
    }
    
    const subscription = emitter.addListener('onAudioRouteChange', callback);
    return () => subscription.remove();
  },

  /**
   * Subscribe to audio errors
   * @param callback Called when an error occurs
   * @returns Unsubscribe function
   */
  onAudioError: (callback: (error: { message: string }) => void): (() => void) => {
    const emitter = getEventEmitter();
    if (!emitter) {
      return () => {};
    }
    
    const subscription = emitter.addListener('onAudioError', callback);
    return () => subscription.remove();
  },

  /**
   * Convert dB level to percentage (0-100) for display
   * @param db Level in dB (-60 to 0)
   * @returns Percentage (0 to 100)
   */
  dbToPercent: (db: number): number => {
    // Map -60dB to 0% and 0dB to 100%
    const percent = ((db + 60) / 60) * 100;
    return Math.max(0, Math.min(100, percent));
  },

  /**
   * Get color for VU meter based on level
   * @param db Level in dB
   * @returns Color string
   */
  getLevelColor: (db: number): string => {
    if (db > -3) return '#FF0000';      // Red - clipping
    if (db > -6) return '#FF6600';      // Orange - hot
    if (db > -12) return '#FFCC00';     // Yellow - good
    if (db > -20) return '#00FF00';     // Green - normal
    return '#00AA00';                    // Dark green - low
  },
};

export default SpynAudioEngine;
