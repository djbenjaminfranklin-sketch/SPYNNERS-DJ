/**
 * Base44 SDK Client for SPYNNERS
 * Used for direct SDK calls like functions.invoke
 */

import { createClient } from '@base44/sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Base44 App ID for SPYNNERS
const BASE44_APP_ID = '691a4d96d819355b52c063f3';

// Direct Base44 Functions URL
const BASE44_FUNCTIONS_URL = `https://${BASE44_APP_ID}.app.base44.com/functions`;

// Storage key for auth token
const AUTH_TOKEN_KEY = 'auth_token';

// Get stored token
const getStoredToken = async (): Promise<string | undefined> => {
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    return token || undefined;
  } catch (e) {
    console.error('[Base44Client] Error getting stored token:', e);
    return undefined;
  }
};

// Create Base44 client (will be initialized with token when available)
let base44Client: ReturnType<typeof createClient> | null = null;

// Initialize or get the Base44 client
export const getBase44Client = async () => {
  const token = await getStoredToken();
  
  // Always create a fresh client with current token
  base44Client = createClient({
    appId: BASE44_APP_ID,
    token: token,
    autoInitAuth: false,
  });
  
  return base44Client;
};

// Get client synchronously (may not have token)
export const getBase44ClientSync = () => {
  if (!base44Client) {
    base44Client = createClient({
      appId: BASE44_APP_ID,
      autoInitAuth: false,
    });
  }
  return base44Client;
};

// Wrapper for functions.invoke using direct HTTP call
export const invokeBase44Function = async <T = any>(
  functionName: string,
  params: Record<string, any> = {}
): Promise<T> => {
  try {
    const token = await getStoredToken();
    console.log(`[Base44Client] Invoking function: ${functionName}`, params);
    console.log(`[Base44Client] Token available: ${!!token}`);
    
    // Use direct HTTP call to Base44 functions endpoint
    const url = `${BASE44_FUNCTIONS_URL}/${functionName}`;
    console.log(`[Base44Client] Calling URL: ${url}`);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await axios.post(url, params, { 
      headers,
      timeout: 30000 
    });
    
    console.log(`[Base44Client] Function ${functionName} response status:`, response.status);
    console.log(`[Base44Client] Function ${functionName} result:`, response.data);
    
    return response.data;
  } catch (error: any) {
    console.error(`[Base44Client] Error invoking ${functionName}:`, error?.response?.data || error?.message || error);
    throw error;
  }
};

// Export the base44 client getter
export { base44Client };
export default getBase44Client;
