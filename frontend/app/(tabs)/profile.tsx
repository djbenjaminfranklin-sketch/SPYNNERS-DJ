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
import { base44Profiles, PublicProfile } from '../../src/services/base44Api';

// Admin emails
const ADMIN_EMAILS = ['admin@spynners.com', 'contact@spynners.com', 'djbenjaminfranklin@gmail.com'];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  
  // Profile state
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if current user is admin
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  // Load profile data
  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const userId = user.id || user._id || '';
      
      // Use the new getPublicProfiles API
      const fetchedProfile = await base44Profiles.getProfile(userId);
      
      if (fetchedProfile) {
        setProfile(fetchedProfile);
      } else {
        // Fallback - create basic profile from user data
        setProfile({
          id: userId,
          full_name: user.full_name,
          email: user.email,
          avatar_url: user.avatar,
          user_type: user.user_type,
          black_diamonds: user.diamonds || 0,
          stats: {
            tracks_count: 0,
            total_plays: 0,
            total_downloads: 0,
            followers_count: 0,
          },
        });
      }
    } catch (error) {
      console.error('[Profile] Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get avatar URL
  const avatarUrl = profile?.avatar_url || profile?.generated_avatar_url || null;

  // Menu items
  const menuItems = [
    {
      icon: 'person-outline',
      title: t('profile.editProfile'),
      subtitle: t('profile.updateInfo'),
      onPress: () => router.push('/profile/edit'),
    },
    {
      icon: 'radio-outline',
      title: t('profile.radar'),
      subtitle: t('profile.trackYourPlays'),
      onPress: () => router.push('/profile/radar'),
    },
    {
      icon: 'musical-notes-outline',
      title: t('profile.manageTracks'),
      subtitle: t('profile.editDeleteTracks'),
      onPress: () => router.push('/profile/tracks'),
    },
    {
      icon: 'cloud-offline-outline',
      title: t('profile.offlineSessions'),
      subtitle: t('profile.offlineSessionsDesc'),
      onPress: () => router.push('/profile/offline-sessions'),
    },
    ...(isAdmin ? [{
      icon: 'shield-checkmark',
      title: t('profile.adminPanel'),
      subtitle: t('profile.adminDesc'),
      onPress: () => router.push('/profile/admin'),
    }] : []),
    {
      icon: 'log-out-outline',
      title: t('profile.logout'),
      subtitle: t('profile.logoutDesc'),
      onPress: () => {
        Alert.alert(
          t('profile.logout'),
          t('profile.logoutConfirm'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { 
              text: t('profile.logout'), 
              style: 'destructive',
              onPress: () => {
                logout();
                router.replace('/(auth)/login');
              },
            },
          ]
        );
      },
    },
  ];

  // Social link icons mapping
  const getSocialIcon = (key: string): any => {
    const icons: Record<string, any> = {
      instagram: 'logo-instagram',
      soundcloud: 'cloud-outline',
      spotify: 'musical-note',
      beatport: 'cart-outline',
      youtube: 'logo-youtube',
      facebook: 'logo-facebook',
      twitter: 'logo-twitter',
      website: 'globe-outline',
    };
    return icons[key] || 'link-outline';
  };

  const openSocialLink = (url: string) => {
    if (url) {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      Linking.openURL(fullUrl);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // If no user, show login prompt
  if (!user) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Ionicons name="person-circle" size={80} color={Colors.primary} />
        <Text style={{ color: Colors.text, fontSize: 18, marginTop: 20, textAlign: 'center' }}>
          {t('profile.loginRequired') || 'Please log in to view your profile'}
        </Text>
        <TouchableOpacity 
          style={{ marginTop: 20, backgroundColor: Colors.primary, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 }}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            {t('login.signIn') || 'Sign In'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.languageSelectorContainer}>
          <LanguageSelector />
        </View>
        <View style={styles.profileSection}>
          <View style={[styles.avatar, isAdmin && styles.adminAvatar]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            )}
            {isAdmin && (
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.name}>
            {profile?.artist_name || profile?.full_name || t('profile.user')}
          </Text>
          {profile?.bio && (
            <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>
          )}
          {profile?.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={Colors.primary} />
              <Text style={styles.locationText}>
                {profile.location}{profile.country ? `, ${profile.country}` : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* ========== EMAIL SECTION ========== */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>{t('profile.email')}</Text>
          <View style={styles.emailRow}>
            <Ionicons name="mail" size={18} color={Colors.primary} />
            <Text style={styles.emailText}>{profile?.email || user?.email || ''}</Text>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>{t('profile.verified')}</Text>
            </View>
          </View>
        </View>

        {/* ========== ROLE SECTION ========== */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>{t('profile.role')}</Text>
          <View style={styles.roleRow}>
            <Ionicons name="person" size={18} color="#888" />
            {isAdmin ? (
              <View style={styles.adminRoleBadge}>
                <Text style={styles.adminRoleText}>Admin</Text>
              </View>
            ) : (
              <Text style={styles.roleText}>
                {profile?.user_type || user?.user_type || 'DJ'}
              </Text>
            )}
          </View>
        </View>

        {/* ========== BLACK DIAMONDS SECTION ========== */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>{t('profile.blackDiamonds')}</Text>
          <View style={styles.diamondRow}>
            <View style={styles.diamondIcon}>
              <Ionicons name="diamond" size={28} color="#1a1a2e" />
            </View>
            <Text style={styles.diamondCount}>{profile?.black_diamonds || 0}</Text>
          </View>
        </View>

        {/* ========== SACEM NUMBER ========== */}
        {profile?.sacem_number && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>{t('profile.sacemNumber')}</Text>
            <View style={styles.roleRow}>
              <Ionicons name="document-text" size={18} color={Colors.primary} />
              <Text style={styles.sacemText}>{profile.sacem_number}</Text>
            </View>
          </View>
        )}

        {/* ========== STATS SECTION ========== */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Ionicons name="musical-notes" size={24} color={Colors.primary} />
            <Text style={styles.statNumber}>{profile?.stats?.tracks_count || 0}</Text>
            <Text style={styles.statLabel}>{t('profile.uploads')}</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="play-circle" size={24} color="#4CAF50" />
            <Text style={styles.statNumber}>{profile?.stats?.total_plays || 0}</Text>
            <Text style={styles.statLabel}>{t('analytics.plays')}</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="download" size={24} color="#2196F3" />
            <Text style={styles.statNumber}>{profile?.stats?.total_downloads || 0}</Text>
            <Text style={styles.statLabel}>{t('analytics.downloads')}</Text>
          </View>
        </View>

        {/* ========== GENRES SECTION ========== */}
        {profile?.genres && profile.genres.length > 0 && (
          <View style={styles.genresCard}>
            <View style={styles.genresHeader}>
              <Ionicons name="musical-note" size={18} color={Colors.text} />
              <Text style={styles.genresTitle}>{t('profile.favoriteGenres')}</Text>
            </View>
            <View style={styles.genresList}>
              {profile.genres.map((genre, index) => (
                <View key={index} style={styles.genreTag}>
                  <Text style={styles.genreTagText}>{genre}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ========== SOCIAL LINKS SECTION ========== */}
        {profile?.social_links && Object.keys(profile.social_links).length > 0 && (
          <View style={styles.socialCard}>
            <View style={styles.socialHeader}>
              <Ionicons name="share-social" size={18} color={Colors.text} />
              <Text style={styles.socialTitle}>{t('profile.socialLinks')}</Text>
            </View>
            <View style={styles.socialGrid}>
              {Object.entries(profile.social_links).map(([key, value]) => {
                if (!value) return null;
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.socialButton}
                    onPress={() => openSocialLink(value)}
                  >
                    <Ionicons name={getSocialIcon(key)} size={22} color={Colors.primary} />
                    <Text style={styles.socialButtonText}>{key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ========== MENU ITEMS ========== */}
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
                  ]}>
                    {item.title}
                  </Text>
                  <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ========== DANGER ZONE ========== */}
        <View style={styles.dangerCard}>
          <View style={styles.dangerHeader}>
            <Ionicons name="warning" size={18} color="#ff6b6b" />
            <Text style={styles.dangerTitle}>{t('profile.dangerZone')}</Text>
          </View>
          <Text style={styles.dangerText}>
            {t('profile.deleteAccountWarning')}
          </Text>
          <TouchableOpacity style={styles.deleteAccountButton}>
            <Ionicons name="trash" size={18} color="#fff" />
            <Text style={styles.deleteAccountText}>{t('profile.deleteAccount')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
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
  profileSection: { alignItems: 'center', paddingTop: 20, paddingHorizontal: 20 },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
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
  avatarText: { fontSize: 40, fontWeight: 'bold', color: '#fff' },
  avatarImage: { width: 94, height: 94, borderRadius: 47 },
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
  name: { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginBottom: 4, textAlign: 'center' },
  bio: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  locationText: { fontSize: 14, color: Colors.primary },
  content: { flex: 1 },

  // Info Cards
  infoCard: {
    backgroundColor: '#1a2a3a',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 10,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emailText: {
    fontSize: 15,
    color: Colors.primary,
    flex: 1,
  },
  verifiedBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roleText: {
    fontSize: 15,
    color: Colors.text,
    textTransform: 'capitalize',
  },
  adminRoleBadge: {
    backgroundColor: '#E8A87C',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  adminRoleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  diamondRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  diamondIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  diamondCount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
  },
  sacemText: {
    fontSize: 15,
    color: Colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // Stats
  statsContainer: { flexDirection: 'row', padding: 16, gap: 12 },
  statBox: {
    flex: 1, backgroundColor: Colors.backgroundCard, padding: 16, borderRadius: BorderRadius.md,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border, gap: 6,
  },
  statNumber: { fontSize: 22, fontWeight: 'bold', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textSecondary },

  // Genres
  genresCard: {
    backgroundColor: '#1a2a3a',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  genresHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  genresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  genresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreTag: {
    backgroundColor: Colors.primary + '30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  genreTagText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },

  // Social Links
  socialCard: {
    backgroundColor: '#1a2a3a',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  socialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  socialTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#253545',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  socialButtonText: {
    fontSize: 13,
    color: Colors.text,
    textTransform: 'capitalize',
  },

  // Menu
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

  // Danger Zone
  dangerCard: {
    backgroundColor: '#2a1a1a',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff6b6b30',
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff6b6b',
  },
  dangerText: {
    fontSize: 13,
    color: '#ff9999',
    lineHeight: 20,
    marginBottom: 16,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ff4444',
    padding: 12,
    borderRadius: 8,
  },
  deleteAccountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  version: { textAlign: 'center', color: Colors.textMuted, fontSize: 12, paddingBottom: 32, marginTop: 16 },
});
