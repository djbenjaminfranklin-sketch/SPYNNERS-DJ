import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';

interface User {
  id: string;
  email: string;
  full_name: string;
  user_type?: string; // dj, producer, dj_producer, label
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

  const BASE44_API_URL = Constants.expoConfig?.extra?.base44ApiUrl || '';
  const BASE44_APP_ID = Constants.expoConfig?.extra?.base44AppId || '';

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      // Use Base44 API directly
      const response = await axios.post(
        `https://api.base44.com/v1/apps/691a4d96d819355b52c063f3/auth/login`,
        { email, password }
      );

      const { token: authToken, user: userData } = response.data;
      
      await AsyncStorage.setItem('auth_token', authToken);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      setToken(authToken);
      setUser(userData);
    } catch (error: any) {
      console.error('Login error:', error);
      // Fallback to local auth if Base44 fails
      try {
        const localResponse = await axios.post(
          `${Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/local/login`,
          { email, password }
        );
        const { token: authToken, user: userData } = localResponse.data;
        await AsyncStorage.setItem('auth_token', authToken);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        setToken(authToken);
        setUser(userData);
      } catch (localError) {
        throw error; // Throw original error
      }
    }
  };

  const signup = async (email: string, password: string, fullName: string, userType?: string) => {
    try {
      // Use Base44 API directly
      const response = await axios.post(
        `https://api.base44.com/v1/apps/691a4d96d819355b52c063f3/auth/signup`,
        { email, password, full_name: fullName, user_type: userType }
      );

      const { token: authToken, user: userData } = response.data;
      
      await AsyncStorage.setItem('auth_token', authToken);
      await AsyncStorage.setItem('user', JSON.stringify({ ...userData, user_type: userType }));
      
      setToken(authToken);
      setUser({ ...userData, user_type: userType });
    } catch (error: any) {
      console.error('Signup error:', error);
      // Fallback to local auth if Base44 fails
      try {
        const localResponse = await axios.post(
          `${Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/local/signup`,
          { email, password, full_name: fullName, user_type: userType }
        );
        const { token: authToken, user: userData } = localResponse.data;
        await AsyncStorage.setItem('auth_token', authToken);
        await AsyncStorage.setItem('user', JSON.stringify({ ...userData, user_type: userType }));
        setToken(authToken);
        setUser({ ...userData, user_type: userType });
      } catch (localError) {
        throw error; // Throw original error
      }
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('user');
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
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