import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

export default function VIPScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#7C4DFF', '#651FFF']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>V.I.P. Access</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.vipCard}>
          <Ionicons name="diamond" size={60} color="#FFD700" />
          <Text style={styles.vipTitle}>Become V.I.P.</Text>
          <Text style={styles.vipDesc}>Get exclusive access to premium tracks and features</Text>
        </View>

        <View style={styles.benefitCard}>
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          <Text style={styles.benefitText}>Access to V.I.P. only tracks</Text>
        </View>
        <View style={styles.benefitCard}>
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          <Text style={styles.benefitText}>Priority support</Text>
        </View>
        <View style={styles.benefitCard}>
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          <Text style={styles.benefitText}>Early access to new features</Text>
        </View>
        <View style={styles.benefitCard}>
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          <Text style={styles.benefitText}>V.I.P. badge on your profile</Text>
        </View>

        <TouchableOpacity style={styles.upgradeButton}>
          <LinearGradient colors={['#FFD700', '#FFA000']} style={styles.upgradeGradient}>
            <Ionicons name="diamond" size={20} color="#fff" />
            <Text style={styles.upgradeText}>Upgrade to V.I.P.</Text>
          </LinearGradient>
        </TouchableOpacity>
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
  vipCard: { backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 30, alignItems: 'center', marginBottom: 20 },
  vipTitle: { fontSize: 24, fontWeight: '700', color: Colors.text, marginTop: 16 },
  vipDesc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },
  benefitCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: 10, padding: 16, marginBottom: 10, gap: 12 },
  benefitText: { fontSize: 14, color: Colors.text },
  upgradeButton: { marginTop: 20, borderRadius: 12, overflow: 'hidden' },
  upgradeGradient: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, gap: 10 },
  upgradeText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
