import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, ActivityIndicator } from 'react-native';
import { fetchTracks } from '../../src/services/api';

export default function HomeScreen() {
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const data = await fetchTracks();
      setTracks(data);
    } catch (e) {
      console.error('[Home] fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={tracks}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={{ padding: 12, flexDirection: 'row' }}>
          <Image
            source={{ uri: item.artwork }}
            style={{ width: 60, height: 60, marginRight: 12 }}
          />
          <View>
            <Text style={{ fontWeight: '600' }}>{item.title}</Text>
            <Text>{item.artist}</Text>
            <Text>{item.genre} · {item.bpm} BPM</Text>
          </View>
        </View>
      )}
    />
  );
}
