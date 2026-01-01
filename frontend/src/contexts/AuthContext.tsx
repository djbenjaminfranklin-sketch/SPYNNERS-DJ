import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { base44Auth, User } from '../services/base44Api';

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
      console.log('[AuthContext] Loading stored auth...');
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        console.log('[AuthContext] Found stored auth, restoring session');
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        // Optionally verify token by fetching current user
        try {
          const currentUser = await base44Auth.me();
          if (currentUser) {
            console.log('[AuthContext] Token verified, user:', currentUser.email);
            setUser(currentUser);
            await AsyncStorage.setItem('user', JSON.stringify(currentUser));
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

  const login = async (email: string, password: string) => {
    try {
      console.log('[AuthContext] Attempting login for:', email);
      
      const result = await base44Auth.login(email, password);
      
      console.log('[AuthContext] Login successful');
      
      setToken(result.token);
      setUser(result.user);
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
