/**
 * SpynAudioEngine - Native module wrapper - OPTIMIZED
 */
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { SPYNAudioEngine } = NativeModules;

let eventEmitter: NativeEventEmitter | null = null;

const getEmitter = () => {
  if (!eventEmitter && SPYNAudioEngine) {
    eventEmitter = new NativeEventEmitter(SPYNAudioEngine);
  }
  return eventEmitter;
};

export const SpynAudioEngine = {
  isAvailable: () => Platform.OS === 'ios' && SPYNAudioEngine != null,

  startEngine: async () => {
    if (!SPYNAudioEngine) throw new Error('Not available');
    return SPYNAudioEngine.startEngine();
  },

  stopEngine: async () => {
    if (!SPYNAudioEngine) return { success: false };
    return SPYNAudioEngine.stopEngine();
  },

  checkUSBConnected: async () => {
    if (!SPYNAudioEngine) return { isUSBConnected: false, deviceName: 'Mic' };
    return SPYNAudioEngine.checkUSBConnected();
  },

  onAudioData: (callback: (data: any) => void) => {
    const emitter = getEmitter();
    if (!emitter) return () => {};
    const sub = emitter.addListener('onAudioData', callback);
    return () => sub.remove();
  },

  onAudioRouteChange: (callback: (data: any) => void) => {
    const emitter = getEmitter();
    if (!emitter) return () => {};
    const sub = emitter.addListener('onAudioRouteChange', callback);
    return () => sub.remove();
  },
};

export default SpynAudioEngine;
