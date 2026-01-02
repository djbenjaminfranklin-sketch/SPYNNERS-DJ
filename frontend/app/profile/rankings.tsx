import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

export default function RankingsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rankings</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.rankCard}>
          <View style={styles.rankBadge}><Text style={styles.rankNumber}>1</Text></View>
          <Text style={styles.rankName}>Top DJs</Text>
          <Text style={styles.rankDesc}>Coming soon...</Text>
        </View>
        <View style={styles.rankCard}>
          <View style={styles.rankBadge}><Text style={styles.rankNumber}>2</Text></View>
          <Text style={styles.rankName}>Top Producers</Text>
          <Text style={styles.rankDesc}>Coming soon...</Text>
        </View>
        <View style={styles.rankCard}>
          <View style={styles.rankBadge}><Text style={styles.rankNumber}>3</Text></View>
          <Text style={styles.rankName}>Top Tracks</Text>
          <Text style={styles.rankDesc}>Coming soon...</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  content: { flex: 1, padding: 16 },
  rankCard: { backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  rankBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  rankNumber: { fontSize: 18, fontWeight: '700', color: '#fff' },
  rankName: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.text },
  rankDesc: { fontSize: 12, color: Colors.textMuted },
});
