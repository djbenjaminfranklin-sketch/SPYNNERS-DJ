import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import LanguageSelector from '../../src/components/LanguageSelector';
import { base44Tracks, base44Users, Track } from '../../src/services/base44Api';

// Admin emails - add your admin emails here
const ADMIN_EMAILS = ['admin@spynners.com', 'contact@spynners.com'];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  
  // Stats state
  const [uploadsCount, setUploadsCount] = useState(0);
  const [diamondsCount, setDiamondsCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // Check if current user is admin
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  // Load user stats and avatar
  useEffect(() => {
    loadUserData();
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;
    
    try {
      setLoadingStats(true);
      const userId = user.id || user._id || '';
      
      // Get user's uploads count
      const allTracks = await base44Tracks.list({ limit: 500 });
      const myTracks = allTracks.filter((track: Track) => 
        track.created_by_id === userId || 
        track.producer_id === userId ||
        track.uploaded_by === userId
      );
      setUploadsCount(myTracks.length);
      
      // Get diamonds from user object
      setDiamondsCount(user.diamonds || 0);
      
      // Get favorites (placeholder - would need a favorites API)
      setFavoritesCount(0);
      
      // Get avatar
      if (user.avatar) {
        if (user.avatar.startsWith('http')) {
          setUserAvatar(user.avatar);
        } else {
          // Base44 file format
          setUserAvatar(`https://app.base44.com/api/v1/files/${user.avatar}/content`);
        }
      }
      
    } catch (error) {
      console.error('[Profile] Error loading user data:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      // For web, use confirm dialog
      const confirmed = window.confirm(t('profile.logoutConfirm'));
      if (confirmed) {
        logout();
        router.replace('/(auth)/login');
      }
    } else {
      Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.logout'),
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]);
    }
  };

  const openWebsite = () => {
    Linking.openURL('https://spynners.com');
  };

  const menuItems = [
    {
      icon: 'person-outline',
      title: t('profile.editProfile'),
      subtitle: t('profile.updateInfo'),
      onPress: () => router.push('/profile/edit'),
    },
    {
      icon: 'diamond-outline',
      title: t('profile.blackDiamonds'),
      subtitle: t('profile.buyDiamonds'),
      onPress: () => router.push('/profile/diamonds'),
    },
    {
      icon: 'musical-notes-outline',
      title: t('menu.myUploads'),
      subtitle: t('profile.manageTracks'),
      onPress: () => router.push('/(tabs)/library'),
    },
    {
      icon: 'list-outline',
      title: t('menu.playlists'),
      subtitle: t('profile.viewPlaylists'),
      onPress: () => router.push('/(tabs)/playlist'),
    },
    {
      icon: 'cloud-upload-outline',
      title: t('menu.uploadTrack'),
      subtitle: t('page.uploadTrack'),
      onPress: () => router.push('/(tabs)/upload'),
    },
    {
      icon: 'globe-outline',
      title: t('menu.website'),
      subtitle: t('profile.visitWebsite'),
      onPress: openWebsite,
    },
    {
      icon: 'help-circle-outline',
      title: t('profile.help'),
      subtitle: t('profile.frequentQuestions'),
      onPress: () => router.push('/profile/help'),
    },
    {
      icon: 'document-text-outline',
      title: t('profile.terms'),
      subtitle: t('profile.termsOfUse'),
      onPress: () => router.push('/profile/terms'),
    },
  ];

  // Add admin menu item if user is admin
  if (isAdmin) {
    menuItems.splice(0, 0, {
      icon: 'shield-checkmark',
      title: 'Admin Panel',
      subtitle: 'Manage track uploads',
      onPress: () => router.push('/profile/admin'),
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.languageSelectorContainer}>
          <LanguageSelector />
        </View>
        <View style={styles.profileSection}>
          <View style={[styles.avatar, isAdmin && styles.adminAvatar]}>
            {userAvatar ? (
              <Image source={{ uri: userAvatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {user?.full_name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            )}
            {isAdmin && (
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.name}>{user?.full_name || t('profile.user')}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
          {user?.user_type && <Text style={styles.userType}>{user.user_type}</Text>}
          {isAdmin && <Text style={styles.adminLabel}>Administrator</Text>}
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Ionicons name="musical-notes" size={24} color={Colors.primary} />
            {loadingStats ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={styles.statNumber}>{uploadsCount}</Text>
            )}
            <Text style={styles.statLabel}>{t('profile.uploads')}</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="diamond" size={24} color="#FFD700" />
            {loadingStats ? (
              <ActivityIndicator size="small" color="#FFD700" />
            ) : (
              <Text style={styles.statNumber}>{diamondsCount}</Text>
            )}
            <Text style={styles.statLabel}>{t('profile.diamonds')}</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="heart" size={24} color={Colors.error} />
            {loadingStats ? (
              <ActivityIndicator size="small" color={Colors.error} />
            ) : (
              <Text style={styles.statNumber}>{favoritesCount}</Text>
            )}
            <Text style={styles.statLabel}>{t('profile.favorites')}</Text>
          </View>
        </View>

        <View style={styles.menu}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem,
                item.icon === 'shield-checkmark' && styles.adminMenuItem
              ]}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <View style={[
                  styles.menuIconContainer,
                  item.icon === 'shield-checkmark' && styles.adminIconContainer
                ]}>
                  <Ionicons 
                    name={item.icon as any} 
                    size={22} 
                    color={item.icon === 'shield-checkmark' ? '#F44336' : Colors.primary} 
                  />
                </View>
                <View style={styles.menuItemText}>
                  <Text style={[
                    styles.menuItemTitle,
                    item.icon === 'shield-checkmark' && styles.adminMenuTitle
                  ]}>{item.title}</Text>
                  <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
          <Text style={styles.logoutButtonText}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0 • SPYNNERS</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.backgroundCard,
    paddingTop: 40, paddingBottom: 32,
    borderBottomWidth: 1, borderBottomColor: Colors.borderAccent,
    position: 'relative',
  },
  languageSelectorContainer: {
    position: 'absolute',
    top: 40,
    right: 16,
    zIndex: 10,
  },
  profileSection: { alignItems: 'center', paddingTop: 20 },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3, borderColor: Colors.primaryDark,
    position: 'relative',
  },
  adminAvatar: {
    borderColor: '#F44336',
    borderWidth: 3,
  },
  avatarText: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
  avatarImage: { width: 84, height: 84, borderRadius: 42 },
  adminBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#F44336',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.backgroundCard,
  },
  name: { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  email: { fontSize: 14, color: Colors.textSecondary },
  userType: { fontSize: 12, color: Colors.primary, marginTop: 4, textTransform: 'capitalize' },
  adminLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#F44336',
    backgroundColor: '#F4433620',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  content: { flex: 1 },
  statsContainer: { flexDirection: 'row', padding: 16, gap: 12 },
  statBox: {
    flex: 1, backgroundColor: Colors.backgroundCard, padding: 16, borderRadius: BorderRadius.md,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border, gap: 6,
  },
  statNumber: { fontSize: 22, fontWeight: 'bold', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textSecondary },
  menu: { padding: 16, gap: 4 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.backgroundCard, padding: 14, borderRadius: BorderRadius.md,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  adminMenuItem: {
    borderColor: '#F44336',
    backgroundColor: '#F4433610',
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  menuIconContainer: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.backgroundInput,
    justifyContent: 'center', alignItems: 'center',
  },
  adminIconContainer: {
    backgroundColor: '#F4433620',
  },
  menuItemText: { flex: 1 },
  menuItemTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  adminMenuTitle: { color: '#F44336' },
  menuItemSubtitle: { fontSize: 12, color: Colors.textSecondary },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2196F3',
    margin: 16, padding: 16, borderRadius: BorderRadius.md, gap: 12,
  },
  logoutButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  version: { textAlign: 'center', color: Colors.textMuted, fontSize: 12, paddingBottom: 32 },
});
