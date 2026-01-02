import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../../src/contexts/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 36) / 2;

// Club data - In production, this would come from the API
interface Club {
  id: string;
  name: string;
  location: string;
  country: string;
  country_flag: string;
  genres: string[];
  image_url: string;
  is_partner: boolean;
  plays_this_week: number;
  website?: string;
}

const CLUBS_DATA: Club[] = [
  {
    id: '1',
    name: 'Berghain',
    location: 'Berlin',
    country: 'Germany',
    country_flag: '🇩🇪',
    genres: ['Techno', 'Hard Techno'],
    image_url: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=400',
    is_partner: true,
    plays_this_week: 156,
    website: 'https://berghain.berlin',
  },
  {
    id: '2',
    name: 'Fabric',
    location: 'London',
    country: 'United Kingdom',
    country_flag: '🇬🇧',
    genres: ['Tech House', 'Deep House'],
    image_url: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=400',
    is_partner: true,
    plays_this_week: 132,
    website: 'https://fabriclondon.com',
  },
  {
    id: '3',
    name: 'Amnesia',
    location: 'Ibiza',
    country: 'Spain',
    country_flag: '🇪🇸',
    genres: ['Tech House', 'Progressive House'],
    image_url: 'https://images.unsplash.com/photo-1598387181032-a3103a2db5b3?w=400',
    is_partner: true,
    plays_this_week: 201,
    website: 'https://amnesia.es',
  },
  {
    id: '4',
    name: 'Rex Club',
    location: 'Paris',
    country: 'France',
    country_flag: '🇫🇷',
    genres: ['Tech House', 'Minimal'],
    image_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400',
    is_partner: true,
    plays_this_week: 89,
    website: 'https://rexclub.com',
  },
  {
    id: '5',
    name: 'Watergate',
    location: 'Berlin',
    country: 'Germany',
    country_flag: '🇩🇪',
    genres: ['Deep House', 'Melodic Techno'],
    image_url: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400',
    is_partner: false,
    plays_this_week: 78,
    website: 'https://water-gate.de',
  },
  {
    id: '6',
    name: 'DC-10',
    location: 'Ibiza',
    country: 'Spain',
    country_flag: '🇪🇸',
    genres: ['Afro House', 'Tech House'],
    image_url: 'https://images.unsplash.com/photo-1545128485-c400e7702796?w=400',
    is_partner: true,
    plays_this_week: 167,
  },
  {
    id: '7',
    name: 'Tresor',
    location: 'Berlin',
    country: 'Germany',
    country_flag: '🇩🇪',
    genres: ['Techno', 'Hard Techno'],
    image_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
    is_partner: false,
    plays_this_week: 93,
  },
  {
    id: '8',
    name: 'Shelter',
    location: 'Amsterdam',
    country: 'Netherlands',
    country_flag: '🇳🇱',
    genres: ['Deep House', 'Minimal'],
    image_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400',
    is_partner: true,
    plays_this_week: 64,
  },
];

export default function ClubsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [showPartnerOnly, setShowPartnerOnly] = useState(false);

  // Get unique countries
  const countries = [t('clubs.all'), ...new Set(CLUBS_DATA.map(c => c.country))];

  useEffect(() => {
    loadClubs();
  }, []);

  const loadClubs = async () => {
    try {
      setLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setClubs(CLUBS_DATA);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadClubs();
    setRefreshing(false);
  };

  // Filter clubs
  const filteredClubs = clubs.filter(club => {
    if (selectedCountry !== t('clubs.all') && club.country !== selectedCountry) return false;
    if (showPartnerOnly && !club.is_partner) return false;
    return true;
  });

  // Open club website
  const openWebsite = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="location" size={24} color={Colors.primary} />
          <Text style={styles.headerTitle}>{t('clubs.title')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Stats Summary */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Ionicons name="business" size={20} color={Colors.primary} />
          <Text style={styles.statValue}>{clubs.length}</Text>
          <Text style={styles.statLabel}>{t('clubs.totalClubs')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="star" size={20} color="#FFD700" />
          <Text style={styles.statValue}>{clubs.filter(c => c.is_partner).length}</Text>
          <Text style={styles.statLabel}>{t('clubs.partners')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="globe" size={20} color="#4CAF50" />
          <Text style={styles.statValue}>{countries.length - 1}</Text>
          <Text style={styles.statLabel}>{t('clubs.countries')}</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.countryFilter}>
          {countries.map((country) => (
            <TouchableOpacity
              key={country}
              style={[styles.countryChip, selectedCountry === country && styles.countryChipActive]}
              onPress={() => setSelectedCountry(country)}
            >
              <Text style={[
                styles.countryChipText, 
                selectedCountry === country && styles.countryChipTextActive
              ]}>
                {country}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <TouchableOpacity 
          style={[styles.partnerFilter, showPartnerOnly && styles.partnerFilterActive]}
          onPress={() => setShowPartnerOnly(!showPartnerOnly)}
        >
          <Ionicons 
            name="star" 
            size={16} 
            color={showPartnerOnly ? '#FFD700' : Colors.textMuted} 
          />
          <Text style={[
            styles.partnerFilterText,
            showPartnerOnly && styles.partnerFilterTextActive
          ]}>
            {t('clubs.partnersOnly')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Clubs Grid */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading clubs...</Text>
          </View>
        ) : filteredClubs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No clubs found</Text>
            <Text style={styles.emptySubtext}>Try changing your filters</Text>
          </View>
        ) : (
          <View style={styles.clubsGrid}>
            {filteredClubs.map((club) => (
              <TouchableOpacity 
                key={club.id} 
                style={styles.clubCard}
                onPress={() => club.website && openWebsite(club.website)}
                activeOpacity={0.8}
              >
                {/* Club Image */}
                <Image 
                  source={{ uri: club.image_url }} 
                  style={styles.clubImage}
                  defaultSource={{ uri: 'https://via.placeholder.com/200x150/1a1a2e/9c27b0?text=Club' }}
                />
                
                {/* Partner Badge */}
                {club.is_partner && (
                  <View style={styles.partnerBadge}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <Text style={styles.partnerBadgeText}>Partner</Text>
                  </View>
                )}
                
                {/* Club Info */}
                <View style={styles.clubInfo}>
                  <Text style={styles.clubName} numberOfLines={1}>{club.name}</Text>
                  
                  <View style={styles.clubLocation}>
                    <Text style={styles.clubFlag}>{club.country_flag}</Text>
                    <Text style={styles.clubCity}>{club.location}</Text>
                  </View>
                  
                  <View style={styles.clubGenres}>
                    {club.genres.slice(0, 2).map((genre, index) => (
                      <View key={index} style={styles.genreTag}>
                        <Text style={styles.genreTagText}>{genre}</Text>
                      </View>
                    ))}
                  </View>
                  
                  <View style={styles.clubStats}>
                    <Ionicons name="play-circle" size={14} color={Colors.primary} />
                    <Text style={styles.clubPlays}>{club.plays_this_week} plays this week</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingTop: 50, 
    paddingBottom: 16, 
    paddingHorizontal: 16 
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  
  // Stats Bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 10, color: Colors.textMuted },
  statDivider: { width: 1, backgroundColor: Colors.border },
  
  // Filters
  filtersContainer: { paddingVertical: 12, gap: 10 },
  countryFilter: { paddingHorizontal: 12 },
  countryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundCard,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countryChipActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  countryChipText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  countryChipTextActive: { color: Colors.primary, fontWeight: '600' },
  partnerFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  partnerFilterActive: { backgroundColor: '#FFD70020', borderColor: '#FFD700' },
  partnerFilterText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  partnerFilterTextActive: { color: '#FFD700', fontWeight: '600' },
  
  // Content
  content: { flex: 1, paddingHorizontal: 12 },
  loadingContainer: { padding: 60, alignItems: 'center' },
  loadingText: { color: Colors.textMuted, marginTop: 12 },
  emptyContainer: { padding: 60, alignItems: 'center' },
  emptyText: { color: Colors.text, fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { color: Colors.textMuted, fontSize: 14, marginTop: 4 },
  
  // Clubs Grid
  clubsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  clubCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clubImage: {
    width: '100%',
    height: 100,
    backgroundColor: Colors.border,
  },
  partnerBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  partnerBadgeText: { fontSize: 10, fontWeight: '600', color: '#FFD700' },
  clubInfo: { padding: 10 },
  clubName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  clubLocation: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  clubFlag: { fontSize: 14 },
  clubCity: { fontSize: 12, color: Colors.textMuted },
  clubGenres: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 4 },
  genreTag: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  genreTagText: { fontSize: 10, color: Colors.primary, fontWeight: '500' },
  clubStats: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  clubPlays: { fontSize: 11, color: Colors.textMuted },
});
