import axios from 'axios';
import Constants from 'expo-constants';

const APP_ID =
  Constants.expoConfig?.extra?.base44AppId ||
  process.env.EXPO_PUBLIC_BASE44_APP_ID;

const API_KEY =
  Constants.expoConfig?.extra?.base44ApiKey ||
  process.env.EXPO_PUBLIC_BASE44_API_KEY;

const BASE_URL = 'https://app.base44.com/api/apps';

if (__DEV__) {
  console.log('[Base44] appId:', APP_ID);
  console.log('[Base44] apiKey present:', !!API_KEY);
}

const client = axios.create({
  baseURL: `${BASE_URL}/${APP_ID}`,
  headers: {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json',
  },
});

export async function fetchTracks(limit = 500) {
  const url = `/entities/Track?limit=${limit}`;
  console.log('[Base44] GET', client.defaults.baseURL + url);

  const res = await client.get(url);

  const data = Array.isArray(res.data) ? res.data : [];

  console.log('[Base44] OK Track count=', data.length);

  return data.map((t: any) => ({
    id: t.id,
    title: t.title,
    artist: t.producer_name || 'Unknown',
    genre: t.genre || 'House',
    bpm: t.bpm,
    key: t.key,
    artwork: t.artwork_url,
    audio: t.audio_url,
    isVip: t.is_vip,
  }));
}
