import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { base44Auth, base44Users, User } from '../services/base44Api';

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

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Fetch complete user data from Base44 Users collection
  const fetchCompleteUserData = async (basicUser: User): Promise<User> => {
    try {
      console.log('[AuthContext] Fetching complete user data for:', basicUser.email);
      
      // Try to find the user in the Users collection by email
      const users = await base44Users.list({ limit: 100 });
      const fullUser = users.find((u: User) => u.email === basicUser.email);
      
      if (fullUser) {
        console.log('[AuthContext] Found full user data:', fullUser.full_name, 'avatar:', !!fullUser.avatar);
        return {
          ...basicUser,
          ...fullUser,
          id: basicUser.id || fullUser.id || fullUser._id,
          _id: basicUser._id || fullUser._id || fullUser.id,
        };
      }
      
      return basicUser;
    } catch (error) {
      console.error('[AuthContext] Error fetching complete user data:', error);
      return basicUser;
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
