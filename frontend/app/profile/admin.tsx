import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { isUserAdmin } from '../../src/components/AdminBadge';
import { LinearGradient } from 'expo-linear-gradient';
import { base44Admin } from '../../src/services/base44Api';

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - 48) / 2;

type AdminStats = {
  total_tracks: number;
  total_users: number;
  pending_tracks: number;
  vip_tracks: number;
  approved_tracks: number;
  total_downloads: number;
  total_sessions: number;
  active_sessions: number;
};

// Menu items with colors matching the screenshots
const ADMIN_MENUS = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    subtitle: 'Gérer les tracks',
    icon: 'shield-checkmark',
    colors: ['#00BCD4', '#0097A7'],
    route: '/profile/admin-dashboard',
  },
  {
    id: 'users',
    title: 'Utilisateurs',
    subtitle: 'Gérer les membres',
    icon: 'people',
    colors: ['#9C27B0', '#7B1FA2'],
    route: '/profile/admin-users',
  },
  {
    id: 'diamonds',
    title: 'Black Diamonds',
    subtitle: 'Gérer les diamonds',
    icon: 'diamond',
    colors: ['#FFD700', '#FFA000'],
    route: '/profile/admin-diamonds',
  },
  {
    id: 'vip',
    title: 'V.I.P. Management',
    subtitle: 'Tracks & Promos V.I.P.',
    icon: 'star',
    colors: ['#E040FB', '#9C27B0'],
    route: '/profile/admin-vip',
  },
  {
    id: 'categories',
    title: 'DJ Categories',
    subtitle: 'Catégories & rôles',
    icon: 'headset',
    colors: ['#FF5722', '#E64A19'],
    route: '/profile/admin-categories',
  },
  {
    id: 'broadcast',
    title: 'Email Groupé',
    subtitle: 'Envoyer des messages',
    icon: 'mail',
    colors: ['#4CAF50', '#388E3C'],
    route: '/profile/admin-broadcast',
  },
  {
    id: 'sessions',
    title: 'SPYN Sessions',
    subtitle: 'Monitoring DJ',
    icon: 'radio',
    colors: ['#2196F3', '#1976D2'],
    route: '/profile/admin-sessions',
  },
  {
    id: 'downloads',
    title: 'Downloads',
    subtitle: 'Historique téléchargements',
    icon: 'download',
    colors: ['#00BFA5', '#00897B'],
    route: '/profile/admin-downloads',
  },
];

export default function AdminScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = isUserAdmin(user);

  useEffect(() => {
    if (isAdmin) {
      loadStats();
    }
  }, [isAdmin]);

  const loadStats = async () => {
    try {
      const data = await base44Admin.getDashboard();
      if (data?.stats) {
        setStats({
          total_tracks: data.stats.total_tracks || 0,
          total_users: data.stats.total_users || 0,
          pending_tracks: data.stats.pending_tracks || 0,
          vip_tracks: data.stats.vip_tracks || 0,
          approved_tracks: data.stats.approved_tracks || 0,
          total_downloads: data.stats.total_downloads || 0,
          total_sessions: data.stats.total_sessions || 0,
          active_sessions: data.stats.active_sessions || 0,
        });
      }
    } catch (error) {
      console.error('[Admin] Error loading stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="lock-closed" size={64} color={Colors.textMuted} />
        <Text style={styles.accessDeniedTitle}>{t('admin.accessDenied')}</Text>
        <Text style={styles.accessDeniedText}>{t('admin.noPermission')}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{t('admin.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('admin.loadingAdmin')}</Text>
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
        <View style={styles.headerContent}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="shield-checkmark" size={28} color={Colors.primary} />
            <Text style={styles.headerTitle}>Admin Panel</Text>
          </View>
          <Text style={styles.headerSubtitle}>Gérer votre plateforme Spynners</Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.quickStats}>
        <View style={styles.quickStatItem}>
          <Text style={styles.quickStatNumber}>{stats?.pending_tracks || 0}</Text>
          <Text style={styles.quickStatLabel}>En attente</Text>
        </View>
        <View style={styles.quickStatDivider} />
        <View style={styles.quickStatItem}>
          <Text style={[styles.quickStatNumber, { color: '#4CAF50' }]}>{stats?.total_users || 0}</Text>
          <Text style={styles.quickStatLabel}>Utilisateurs</Text>
        </View>
        <View style={styles.quickStatDivider} />
        <View style={styles.quickStatItem}>
          <Text style={[styles.quickStatNumber, { color: '#E040FB' }]}>{stats?.vip_tracks || 0}</Text>
          <Text style={styles.quickStatLabel}>V.I.P.</Text>
        </View>
        <View style={styles.quickStatDivider} />
        <View style={styles.quickStatItem}>
          <Text style={[styles.quickStatNumber, { color: '#FFD700' }]}>{stats?.approved_tracks || 0}</Text>
          <Text style={styles.quickStatLabel}>Tracks</Text>
        </View>
      </View>

      {/* Menu Grid */}
      <ScrollView
        style={styles.menuContainer}
        contentContainerStyle={styles.menuContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.menuGrid}>
          {ADMIN_MENUS.map((menu, index) => (
            <TouchableOpacity
              key={menu.id}
              style={[
                styles.menuCard,
                { backgroundColor: menu.colors[0] },
                index % 2 === 0 ? { marginRight: 8 } : { marginLeft: 8 },
              ]}
              onPress={() => router.push(menu.route as any)}
              activeOpacity={0.8}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name={menu.icon as any} size={32} color="#fff" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>{menu.title}</Text>
                <Text style={styles.menuSubtitle}>{menu.subtitle}</Text>
              </View>
              
              {/* Badge for pending items */}
              {menu.id === 'dashboard' && (stats?.pending_tracks || 0) > 0 && (
                <View style={styles.menuBadge}>
                  <Text style={styles.menuBadgeText}>{stats?.pending_tracks}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Spynners Admin v2.0</Text>
          <Text style={styles.footerSubtext}>Connecté en tant qu'admin</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 16,
  },
  accessDeniedText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingTop: 50,
    backgroundColor: Colors.backgroundCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBack: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // Quick Stats
  quickStats: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  quickStatLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },

  // Menu Grid
  menuContainer: {
    flex: 1,
  },
  menuContent: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  menuCard: {
    width: '47%',
    aspectRatio: 1,
    marginBottom: 16,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    justifyContent: 'space-between',
  },
  menuIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextContainer: {
    marginTop: 'auto',
  },
  menuIconContainer: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  menuBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: '#F44336',
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  menuBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.md,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  footerSubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
