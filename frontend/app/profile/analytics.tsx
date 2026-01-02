import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

export default function AnalyticsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.statCard}>
          <Ionicons name="play" size={32} color={Colors.primary} />
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Total Plays</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="download" size={32} color={Colors.primary} />
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Total Downloads</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="star" size={32} color="#FFD700" />
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Average Rating</Text>
        </View>
        <Text style={styles.comingSoon}>More analytics coming soon...</Text>
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
  statCard: { backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 20, marginBottom: 12, alignItems: 'center' },
  statValue: { fontSize: 36, fontWeight: '700', color: Colors.text, marginTop: 8 },
  statLabel: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
  comingSoon: { textAlign: 'center', color: Colors.textMuted, marginTop: 20, fontSize: 14 },
});
