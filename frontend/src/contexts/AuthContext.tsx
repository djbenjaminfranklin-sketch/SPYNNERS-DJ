import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { base44, base44AuthHelpers } from '../services/base44Api';

interface User {
  id: string;
  email: string;
  full_name: string;
  user_type?: string; // dj, producer, dj_producer, label
  avatar?: string;
  is_admin?: boolean;
  is_vip?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string, userType?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      console.log('[Auth] Loading stored auth...');
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        console.log('[Auth] Found stored auth, restoring session');
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        // Set token in Base44 SDK
        base44.auth.setToken(storedToken);
        
        // Verify token is still valid by fetching current user
        try {
          const currentUser = await base44.auth.me();
          if (currentUser) {
            console.log('[Auth] Token verified, user:', currentUser.email);
            setUser(currentUser);
            await AsyncStorage.setItem('user', JSON.stringify(currentUser));
          }
        } catch (verifyError) {
          console.log('[Auth] Token verification failed, keeping stored user');
        }
      } else {
        console.log('[Auth] No stored auth found');
      }
    } catch (error) {
      console.error('[Auth] Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('[Auth] Attempting login for:', email);
      
      // Use Base44 SDK for login
      const result = await base44.auth.loginViaEmailPassword(email, password);
      
      console.log('[Auth] Login successful');
      
      const authToken = result.token || result.access_token;
      const userData = result.user || result;
      
      if (!authToken) {
        throw new Error('No token received from login');
      }
      
      // Save auth state
      await AsyncStorage.setItem('auth_token', authToken);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      // Set token in SDK for subsequent requests
      base44.auth.setToken(authToken);
      
      setToken(authToken);
      setUser(userData);
      
      console.log('[Auth] Auth state saved, user:', userData.email);
    } catch (error: any) {
      console.error('[Auth] Login error:', error?.message || error);
      throw new Error(error?.message || 'Login failed. Please check your credentials.');
    }
  };

  const signup = async (email: string, password: string, fullName: string, userType?: string) => {
    try {
      console.log('[Auth] Attempting signup for:', email);
      
      // Use Base44 SDK for registration
      const result = await base44.auth.register({
        email,
        password,
        full_name: fullName,
        user_type: userType,
      });
      
      console.log('[Auth] Signup successful');
      
      const authToken = result.token || result.access_token;
      const userData = { ...result.user, user_type: userType } || { ...result, user_type: userType };
      
      if (!authToken) {
        throw new Error('No token received from signup');
      }
      
      // Save auth state
      await AsyncStorage.setItem('auth_token', authToken);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      // Set token in SDK for subsequent requests
      base44.auth.setToken(authToken);
      
      setToken(authToken);
      setUser(userData);
      
      console.log('[Auth] Auth state saved for new user:', userData.email);
    } catch (error: any) {
      console.error('[Auth] Signup error:', error?.message || error);
      throw new Error(error?.message || 'Signup failed. Please try again.');
    }
  };

  const logout = async () => {
    try {
      console.log('[Auth] Logging out...');
      
      // Clear stored auth
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('user');
      
      // Clear SDK token
      base44.auth.setToken(null);
      
      setToken(null);
      setUser(null);
      
      console.log('[Auth] Logged out successfully');
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
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
