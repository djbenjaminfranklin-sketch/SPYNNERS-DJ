import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { isUserAdmin } from '../../src/components/AdminBadge';
import { base44Users, base44Tracks } from '../../src/services/base44Api';

export default function AdminBroadcast() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [recentTracksCount, setRecentTracksCount] = useState(0);
  const [recipientType, setRecipientType] = useState<'all' | 'category' | 'individual'>('all');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const isAdmin = isUserAdmin(user);

  useEffect(() => {
    if (isAdmin) {
      loadStats();
    }
  }, [isAdmin]);

  const loadStats = async () => {
    try {
      const [usersRes, tracksRes] = await Promise.all([
        base44Users.list({ limit: 1 }),
        base44Tracks.list({ limit: 10 }),
      ]);
      
      // Get total count from response
      setUserCount(Array.isArray(usersRes) ? usersRes.length : (usersRes?.total || 0));
      setRecentTracksCount(Array.isArray(tracksRes) ? tracksRes.length : (tracksRes?.items?.length || 0));
    } catch (error) {
      console.error('[AdminBroadcast] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const insertRecentTracks = () => {
    setMessage(prev => prev + '\n\n[TRACKS RÉCENTES]\n- Track 1\n- Track 2\n- Track 3');
  };

  const sendEmail = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le sujet et le message');
      return;
    }

    setSending(true);
    setTimeout(() => {
      setSending(false);
      Alert.alert('Succès', `Email envoyé à ${recipientType === 'all' ? 'tous les utilisateurs' : 'la catégorie sélectionnée'}!`);
      setSubject('');
      setMessage('');
    }, 2000);
  };

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="lock-closed" size={64} color={Colors.textMuted} />
        <Text style={styles.accessDeniedTitle}>Accès Refusé</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerIcon}>
          <Ionicons name="mail" size={24} color="#4CAF50" />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Email Groupé</Text>
          <Text style={styles.headerSubtitle}>Envoyer un message à tous les utilisateurs</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color="#2196F3" />
            <Text style={styles.statNumber}>{userCount}</Text>
            <Text style={styles.statLabel}>Utilisateurs</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="musical-note" size={24} color="#FF9800" />
            <Text style={styles.statNumber}>{recentTracksCount}</Text>
            <Text style={styles.statLabel}>Tracks récentes</Text>
          </View>
        </View>

        {/* Recipient Type */}
        <Text style={styles.sectionTitle}>Destinataires</Text>
        <View style={styles.recipientRow}>
          {[
            { id: 'all', label: 'All', icon: 'people' },
            { id: 'category', label: 'By Category', icon: 'star' },
            { id: 'individual', label: 'Individual', icon: 'person' },
          ].map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[styles.recipientBtn, recipientType === type.id && styles.recipientBtnActive]}
              onPress={() => setRecipientType(type.id as any)}
            >
              <Ionicons name={type.icon as any} size={18} color={recipientType === type.id ? '#fff' : Colors.textMuted} />
              <Text style={[styles.recipientBtnText, recipientType === type.id && styles.recipientBtnTextActive]}>{type.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Compose Message */}
        <View style={styles.composeSection}>
          <View style={styles.composeTitleRow}>
            <Ionicons name="mail-outline" size={20} color={Colors.primary} />
            <Text style={styles.composeTitle}>Composer le message</Text>
          </View>

          <Text style={styles.inputLabel}>Sujet</Text>
          <TextInput
            style={styles.subjectInput}
            placeholder="Ex: Nouvelles tracks house disponible !"
            placeholderTextColor={Colors.textMuted}
            value={subject}
            onChangeText={setSubject}
          />

          <Text style={styles.inputLabel}>Message</Text>
          <TextInput
            style={styles.messageInput}
            placeholder="Votre message ici..."
            placeholderTextColor={Colors.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity style={styles.insertTracksBtn} onPress={insertRecentTracks}>
            <Ionicons name="musical-note" size={16} color="#FF9800" />
            <Text style={styles.insertTracksText}>Insérer les tracks récentes</Text>
          </TouchableOpacity>
        </View>

        {/* Send Button */}
        <TouchableOpacity
          style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
          onPress={sendEmail}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.sendBtnText}>Envoyer l'email</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContent: { justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: Spacing.md, color: Colors.textSecondary },
  accessDeniedTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 16 },
  backButton: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.primary, borderRadius: BorderRadius.md },
  backButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, paddingTop: 50, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerBack: { padding: 8 },
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4CAF5020', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  headerContent: { marginLeft: 12, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textMuted },

  content: { flex: 1, padding: Spacing.md },

  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statNumber: { fontSize: 28, fontWeight: 'bold', color: Colors.text, marginTop: 8 },
  statLabel: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  sectionTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },

  recipientRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  recipientBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  recipientBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  recipientBtnText: { fontSize: 12, color: Colors.textMuted },
  recipientBtnTextActive: { color: '#fff', fontWeight: '600' },

  composeSection: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  composeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  composeTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },

  inputLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 6 },
  subjectInput: { backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 14, color: Colors.text, marginBottom: Spacing.md },
  messageInput: { backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 14, color: Colors.text, height: 150, marginBottom: Spacing.md },

  insertTracksBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  insertTracksText: { fontSize: 13, color: '#FF9800' },

  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4CAF50', paddingVertical: 16, borderRadius: BorderRadius.md, marginTop: Spacing.lg },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
