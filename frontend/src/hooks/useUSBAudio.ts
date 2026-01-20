/**
 * useUSBAudio Hook
 * 
 * React Native hook to detect USB audio interfaces on iOS
 * Uses native AVAudioSession.routeChangeNotification
 * 
 * Usage:
 * ```tsx
 * const { isUSBConnected, inputName, checkUSBStatus } = useUSBAudio();
 * 
 * // Listen to connection events
 * useUSBAudio({
 *   onUSBConnected: (route) => console.log('USB connected:', route),
 *   onUSBDisconnected: (route) => console.log('USB disconnected:', route),
 * });
 * ```
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// Type definitions
interface AudioRoute {
  isUSB: boolean;
  isBluetooth: boolean;
  isHeadphones: boolean;
  inputName: string;
  inputType: string;
  inputCount: number;
  outputCount: number;
}

interface UseUSBAudioOptions {
  onUSBConnected?: (route: AudioRoute) => void;
  onUSBDisconnected?: (route: AudioRoute) => void;
  onRouteChanged?: (route: AudioRoute) => void;
}

interface UseUSBAudioReturn {
  isUSBConnected: boolean;
  isBluetooth: boolean;
  isHeadphones: boolean;
  inputName: string;
  inputType: string;
  isLoading: boolean;
  error: string | null;
  checkUSBStatus: () => Promise<AudioRoute | null>;
  currentRoute: AudioRoute | null;
}

// Get native module (may be null on web or if not installed)
const USBAudioModule = NativeModules.USBAudioModule;

// Create event emitter only if module exists
let eventEmitter: NativeEventEmitter | null = null;
if (USBAudioModule && Platform.OS === 'ios') {
  try {
    eventEmitter = new NativeEventEmitter(USBAudioModule);
  } catch (e) {
    console.log('[useUSBAudio] Could not create event emitter:', e);
  }
}

// Default route when USB detection is not available
const DEFAULT_ROUTE: AudioRoute = {
  isUSB: false,
  isBluetooth: false,
  isHeadphones: false,
  inputName: 'Built-in Microphone',
  inputType: 'builtInMic',
  inputCount: 1,
  outputCount: 1,
};

export function useUSBAudio(options: UseUSBAudioOptions = {}): UseUSBAudioReturn {
  const [currentRoute, setCurrentRoute] = useState<AudioRoute | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Store callbacks in refs to avoid re-subscribing
  const onUSBConnectedRef = useRef(options.onUSBConnected);
  const onUSBDisconnectedRef = useRef(options.onUSBDisconnected);
  const onRouteChangedRef = useRef(options.onRouteChanged);
  
  // Update refs when options change
  useEffect(() => {
    onUSBConnectedRef.current = options.onUSBConnected;
    onUSBDisconnectedRef.current = options.onUSBDisconnected;
    onRouteChangedRef.current = options.onRouteChanged;
  }, [options.onUSBConnected, options.onUSBDisconnected, options.onRouteChanged]);
  
  // Check USB status manually
  const checkUSBStatus = useCallback(async (): Promise<AudioRoute | null> => {
    if (Platform.OS !== 'ios') {
      console.log('[useUSBAudio] USB detection only available on iOS');
      setCurrentRoute(DEFAULT_ROUTE);
      return DEFAULT_ROUTE;
    }
    
    if (!USBAudioModule) {
      console.log('[useUSBAudio] Native module not available');
      setError('Native module not installed');
      setCurrentRoute(DEFAULT_ROUTE);
      return DEFAULT_ROUTE;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const route = await USBAudioModule.getCurrentRoute();
      console.log('[useUSBAudio] Current route:', route);
      setCurrentRoute(route);
      return route;
    } catch (e: any) {
      console.error('[useUSBAudio] Error checking USB status:', e);
      setError(e.message || 'Unknown error');
      setCurrentRoute(DEFAULT_ROUTE);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Set up event listeners
  useEffect(() => {
    if (Platform.OS !== 'ios' || !eventEmitter) {
      // On non-iOS platforms, just set default route
      setCurrentRoute(DEFAULT_ROUTE);
      return;
    }
    
    console.log('[useUSBAudio] Setting up native event listeners');
    
    // Subscribe to USB connected events
    const connectedSubscription = eventEmitter.addListener(
      'onUSBAudioConnected',
      (route: AudioRoute) => {
        console.log('[useUSBAudio] 🔌 USB Connected:', route.inputName);
        setCurrentRoute(route);
        onUSBConnectedRef.current?.(route);
      }
    );
    
    // Subscribe to USB disconnected events
    const disconnectedSubscription = eventEmitter.addListener(
      'onUSBAudioDisconnected',
      (route: AudioRoute) => {
        console.log('[useUSBAudio] 🔌 USB Disconnected');
        setCurrentRoute(route);
        onUSBDisconnectedRef.current?.(route);
      }
    );
    
    // Subscribe to general route changes
    const routeChangedSubscription = eventEmitter.addListener(
      'onAudioRouteChanged',
      (route: AudioRoute) => {
        console.log('[useUSBAudio] Audio route changed:', route.inputName);
        setCurrentRoute(route);
        onRouteChangedRef.current?.(route);
      }
    );
    
    // Check initial status
    checkUSBStatus();
    
    // Cleanup
    return () => {
      console.log('[useUSBAudio] Removing event listeners');
      connectedSubscription.remove();
      disconnectedSubscription.remove();
      routeChangedSubscription.remove();
    };
  }, [checkUSBStatus]);
  
  return {
    isUSBConnected: currentRoute?.isUSB ?? false,
    isBluetooth: currentRoute?.isBluetooth ?? false,
    isHeadphones: currentRoute?.isHeadphones ?? false,
    inputName: currentRoute?.inputName ?? 'Built-in Microphone',
    inputType: currentRoute?.inputType ?? 'builtInMic',
    isLoading,
    error,
    checkUSBStatus,
    currentRoute,
  };
}

// Export module for direct access if needed
export { USBAudioModule };

export default useUSBAudio;
