import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { base44Auth, base44Users, base44PushNotifications, User } from '../services/base44Api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string, userType?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Configure notification handler - MUST be inside component, not at module level
  useEffect(() => {
    // Set how notifications should be handled when received while app is foregrounded
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }, []);

  // Register push notifications when user changes - with delay to not block app startup
  useEffect(() => {
    if (user) {
      const userId = user.id || user._id || '';
      if (userId) {
        // Delay push notification registration to not block app startup
        const timer = setTimeout(() => {
          registerForPushNotifications(userId);
        }, 3000); // Wait 3 seconds after login
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  // Register for push notifications - with full error handling to prevent crashes
  const registerForPushNotifications = async (userId: string) => {
    try {
      console.log('[AuthContext] Registering push notifications for user:', userId);
      
      // Check if running on a real device (required for push)
      if (!Device.isDevice) {
        console.log('[AuthContext] Push notifications require a physical device - skipping');
        return;
      }

      // Wrap everything in try-catch to prevent any crash
      try {
        // Get existing permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        // Request permissions if not already granted
        if (existingStatus !== 'granted') {
          console.log('[AuthContext] Requesting notification permissions...');
          const { status } = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          console.log('[AuthContext] Notification permission denied - skipping');
          return;
        }

        // Get project ID for token registration - be very careful here
        let projectId: string | undefined;
        try {
          projectId = Constants.expoConfig?.extra?.eas?.projectId || 
                     Constants.easConfig?.projectId;
        } catch (e) {
          console.log('[AuthContext] Could not get project ID from config');
        }
        
        // Skip if no project ID available
        if (!projectId) {
          console.log('[AuthContext] No project ID available - skipping push registration');
          return;
        }
        
        console.log('[AuthContext] Getting push token with projectId:', projectId);
        
        const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
        const pushToken = tokenResponse.data;
        
        if (!pushToken) {
          console.log('[AuthContext] No push token received - skipping');
          return;
        }
        
        console.log('[AuthContext] Got push token:', pushToken.substring(0, 30) + '...');
        setExpoPushToken(pushToken);
        
        // Register the token with Base44 - don't await to not block
        base44PushNotifications.registerPushToken(userId, pushToken)
          .then(success => {
            if (success) {
              console.log('[AuthContext] Push token registered with backend');
            }
          })
          .catch(err => {
            console.log('[AuthContext] Failed to register token with backend:', err);
          });

        // Configure Android notification channels
        if (Platform.OS === 'android') {
          try {
            await Notifications.setNotificationChannelAsync('messages', {
              name: 'Messages',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#9C27B0',
              sound: 'default',
              enableVibrate: true,
              enableLights: true,
            });
            
            await Notifications.setNotificationChannelAsync('default', {
              name: 'Default',
              importance: Notifications.AndroidImportance.HIGH,
              sound: 'default',
            });
            
            console.log('[AuthContext] Android notification channels configured');
          } catch (channelError) {
            console.log('[AuthContext] Failed to set notification channels:', channelError);
          }
        }
      } catch (innerError) {
        console.log('[AuthContext] Push notification setup error (non-fatal):', innerError);
      }
      
    } catch (error) {
      // Catch ALL errors to prevent crash
      console.log('[AuthContext] Push notification registration failed (non-fatal):', error);
    }
  };

  // Fetch complete user data from Base44 Users collection
  const fetchCompleteUserData = async (basicUser: User): Promise<User> => {
    try {
      console.log('[AuthContext] ========== FETCH COMPLETE USER DATA ==========');
      console.log('[AuthContext] basicUser.id:', basicUser.id);
      console.log('[AuthContext] basicUser._id:', basicUser._id);
      console.log('[AuthContext] basicUser.email:', basicUser.email);
      
      // Preserve black_diamonds from the login response (important!)
      const loginBlackDiamonds = basicUser.black_diamonds || basicUser.data?.black_diamonds || 0;
      console.log('[AuthContext] Login black_diamonds:', loginBlackDiamonds);
      
      // Try to find the user in the Users collection by email
      const users = await base44Users.list({ limit: 500 });
      console.log('[AuthContext] Total users fetched:', users.length);
      
      const fullUser = users.find((u: User) => u.email === basicUser.email);
      
      if (fullUser) {
        console.log('[AuthContext] Found full user in Users collection:');
        console.log('[AuthContext]   fullUser.id:', fullUser.id);
        console.log('[AuthContext]   fullUser._id:', fullUser._id);
        console.log('[AuthContext]   fullUser.full_name:', fullUser.full_name);
        
        // CRITICAL: Use the ID from the Users collection (fullUser) as primary
        // because that's what's used in tracks created_by_id
        const finalId = fullUser._id || fullUser.id || basicUser.id || basicUser._id;
        console.log('[AuthContext] FINAL USER ID:', finalId);
        
        return {
          ...basicUser,
          ...fullUser,
          id: finalId,
          _id: finalId,
          // Always preserve black_diamonds from login response
          black_diamonds: loginBlackDiamonds || fullUser.black_diamonds || fullUser.data?.black_diamonds || 0,
        };
      }
      
      // Return basicUser but make sure black_diamonds is preserved
      const fallbackId = basicUser.id || basicUser._id;
      console.log('[AuthContext] No fullUser found, using basicUser ID:', fallbackId);
      
      return {
        ...basicUser,
        id: fallbackId,
        _id: fallbackId,
        black_diamonds: loginBlackDiamonds,
      };
    } catch (error) {
      console.error('[AuthContext] Error fetching complete user data:', error);
      // Preserve black_diamonds even on error
      return {
        ...basicUser,
        black_diamonds: basicUser.black_diamonds || basicUser.data?.black_diamonds || 0,
      };
    }
  };

  const loadStoredAuth = async () => {
    try {
      console.log('[AuthContext] Loading stored auth...');
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        console.log('[AuthContext] Found stored auth, restoring session');
        setToken(storedToken);
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        // Try to get updated user data
        try {
          const currentUser = await base44Auth.me();
          if (currentUser) {
            console.log('[AuthContext] Token verified, fetching complete data');
            const fullUser = await fetchCompleteUserData(currentUser);
            setUser(fullUser);
            await AsyncStorage.setItem('user', JSON.stringify(fullUser));
          }
        } catch (verifyError) {
          console.log('[AuthContext] Token verification skipped/failed');
        }
      } else {
        console.log('[AuthContext] No stored auth found');
      }
    } catch (error) {
      console.error('[AuthContext] Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const currentUser = await base44Auth.me();
      if (currentUser) {
        const fullUser = await fetchCompleteUserData(currentUser);
        setUser(fullUser);
        await AsyncStorage.setItem('user', JSON.stringify(fullUser));
      }
    } catch (error) {
      console.error('[AuthContext] Error refreshing user:', error);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('[AuthContext] Attempting login for:', email);
      
      const result = await base44Auth.login(email, password);
      
      console.log('[AuthContext] Login successful, fetching complete user data');
      
      // Get complete user data with avatar, diamonds, etc.
      const fullUser = await fetchCompleteUserData(result.user);
      
      setToken(result.token);
      setUser(fullUser);
      
      // Store both token and user data
      await AsyncStorage.setItem('auth_token', result.token);
      await AsyncStorage.setItem('user', JSON.stringify(fullUser));
      
      console.log('[AuthContext] Token and user data saved to storage');
    } catch (error: any) {
      console.error('[AuthContext] Login error:', error?.message || error);
      throw error;
    }
  };

  const signup = async (email: string, password: string, fullName: string, userType?: string) => {
    try {
      console.log('[AuthContext] Attempting signup for:', email);
      
      const result = await base44Auth.signup(email, password, fullName, userType);
      
      console.log('[AuthContext] Signup successful');
      
      setToken(result.token);
      setUser({ ...result.user, user_type: userType });
    } catch (error: any) {
      console.error('[AuthContext] Signup error:', error?.message || error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('[AuthContext] Logging out...');
      
      await base44Auth.logout();
      
      setToken(null);
      setUser(null);
      
      console.log('[AuthContext] Logged out successfully');
    } catch (error) {
      console.error('[AuthContext] Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
