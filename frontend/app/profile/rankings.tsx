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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import { base44Tracks, Track, base44Auth } from '../../src/services/base44Api';
import AdminBadge, { isUserAdmin } from '../../src/components/AdminBadge';
import axios from 'axios';

// Backend URL
const BACKEND_URL = 'https://admin-dashboard-fix-32.preview.emergentagent.com';

export default function RankingsScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState('plays');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showGenreFilter, setShowGenreFilter] = useState(false);

  // Translated genre filters
  const GENRES: Record<string, { value: string; label: string }[]> = {
    en: [
      { value: 'all', label: 'All Genres' },
      { value: 'Afro House', label: 'Afro House' },
      { value: 'Tech House', label: 'Tech House' },
      { value: 'Deep House', label: 'Deep House' },
      { value: 'Melodic House & Techno', label: 'Melodic House & Techno' },
      { value: 'Progressive House', label: 'Progressive House' },
      { value: 'Minimal / Deep Tech', label: 'Minimal / Deep Tech' },
      { value: 'Bass House', label: 'Bass House' },
      { value: 'Hard Techno', label: 'Hard Techno' },
      { value: 'Techno (Peak Time)', label: 'Techno (Peak Time)' },
      { value: 'Funky House', label: 'Funky House' },
    ],
    fr: [
      { value: 'all', label: 'Tous les Genres' },
      { value: 'Afro House', label: 'Afro House' },
      { value: 'Tech House', label: 'Tech House' },
      { value: 'Deep House', label: 'Deep House' },
      { value: 'Melodic House & Techno', label: 'Melodic House & Techno' },
      { value: 'Progressive House', label: 'Progressive House' },
      { value: 'Minimal / Deep Tech', label: 'Minimal / Deep Tech' },
      { value: 'Bass House', label: 'Bass House' },
      { value: 'Hard Techno', label: 'Hard Techno' },
      { value: 'Techno (Peak Time)', label: 'Techno (Peak Time)' },
      { value: 'Funky House', label: 'Funky House' },
    ],
    es: [
      { value: 'all', label: 'Todos los Géneros' },
      { value: 'Afro House', label: 'Afro House' },
      { value: 'Tech House', label: 'Tech House' },
      { value: 'Deep House', label: 'Deep House' },
      { value: 'Melodic House & Techno', label: 'Melodic House & Techno' },
      { value: 'Progressive House', label: 'Progressive House' },
      { value: 'Minimal / Deep Tech', label: 'Minimal / Deep Tech' },
      { value: 'Bass House', label: 'Bass House' },
      { value: 'Hard Techno', label: 'Hard Techno' },
      { value: 'Techno (Peak Time)', label: 'Techno (Peak Time)' },
      { value: 'Funky House', label: 'Funky House' },
    ],
    it: [
      { value: 'all', label: 'Tutti i Generi' },
      { value: 'Afro House', label: 'Afro House' },
      { value: 'Tech House', label: 'Tech House' },
      { value: 'Deep House', label: 'Deep House' },
      { value: 'Melodic House & Techno', label: 'Melodic House & Techno' },
      { value: 'Progressive House', label: 'Progressive House' },
      { value: 'Minimal / Deep Tech', label: 'Minimal / Deep Tech' },
      { value: 'Bass House', label: 'Bass House' },
      { value: 'Hard Techno', label: 'Hard Techno' },
      { value: 'Techno (Peak Time)', label: 'Techno (Peak Time)' },
      { value: 'Funky House', label: 'Funky House' },
    ],
    de: [
      { value: 'all', label: 'Alle Genres' },
      { value: 'Afro House', label: 'Afro House' },
      { value: 'Tech House', label: 'Tech House' },
      { value: 'Deep House', label: 'Deep House' },
      { value: 'Melodic House & Techno', label: 'Melodic House & Techno' },
      { value: 'Progressive House', label: 'Progressive House' },
      { value: 'Minimal / Deep Tech', label: 'Minimal / Deep Tech' },
      { value: 'Bass House', label: 'Bass House' },
      { value: 'Hard Techno', label: 'Hard Techno' },
      { value: 'Techno (Peak Time)', label: 'Techno (Peak Time)' },
      { value: 'Funky House', label: 'Funky House' },
    ],
    zh: [
      { value: 'all', label: '所有流派' },
      { value: 'Afro House', label: 'Afro House' },
      { value: 'Tech House', label: 'Tech House' },
      { value: 'Deep House', label: 'Deep House' },
      { value: 'Melodic House & Techno', label: 'Melodic House & Techno' },
      { value: 'Progressive House', label: 'Progressive House' },
      { value: 'Minimal / Deep Tech', label: 'Minimal / Deep Tech' },
      { value: 'Bass House', label: 'Bass House' },
      { value: 'Hard Techno', label: 'Hard Techno' },
      { value: 'Techno (Peak Time)', label: 'Techno (Peak Time)' },
      { value: 'Funky House', label: 'Funky House' },
    ],
  };

  const currentGenres = GENRES[language] || GENRES['en'];
  const selectedGenreLabel = currentGenres.find(g => g.value === selectedGenre)?.label || t('filter.allGenres');

  useEffect(() => {
    loadTracks();
  }, [activeTab, selectedGenre]);

  const loadTracks = async () => {
    try {
      setLoading(true);
      console.log('[Rankings] Loading tracks for:', activeTab, selectedGenre);
      
      // Get auth token
      const token = await base44Auth.getStoredToken();
      if (!token) {
        console.log('[Rankings] No auth token, using base44Tracks.list()');
        // Fallback to standard method
        const result = await base44Tracks.list({ limit: 50 });
        setTracks(result || []);
        return;
      }
      
      // Determine sort field based on tab
      let sortBy = 'download_count';
      switch (activeTab) {
        case 'plays':
          sortBy = 'play_count';
          break;
        case 'downloads':
          sortBy = 'download_count';
          break;
        case 'recent':
          sortBy = 'created_date';
          break;
      }
      
      // Call new rankings API endpoint
      const response = await axios.post(
        `${BACKEND_URL}/api/tracks/rankings`,
        {
          sort_by: sortBy,
          genre: selectedGenre !== 'all' ? selectedGenre : null,
          limit: 50,
          offset: 0,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.data?.tracks) {
        console.log('[Rankings] Got', response.data.tracks.length, 'tracks from native API');
        setTracks(response.data.tracks);
      } else if (Array.isArray(response.data)) {
        console.log('[Rankings] Got', response.data.length, 'tracks from native API');
        setTracks(response.data);
      } else {
        console.log('[Rankings] Unexpected response format:', response.data);
        // Fallback to base44Tracks
        const result = await base44Tracks.list({ limit: 50 });
        setTracks(result || []);
      }
    } catch (error) {
      console.error('[Rankings] Error loading tracks:', error);
      // Fallback to standard method on error
      try {
        const result = await base44Tracks.list({ limit: 50 });
        setTracks(result || []);
      } catch (e) {
        setTracks([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTracks();
    setRefreshing(false);
  };

  // Get cover image URL
  const getCoverImageUrl = (track: Track): string | null => {
    const url = track.artwork_url || track.cover_image;
    if (url) {
      if (url.startsWith('http')) return url;
      return `https://base44.app/api/apps/691a4d96d819355b52c063f3/files/public/691a4d96d819355b52c063f3/${url}`;
    }
    return null;
  };

  // Get artist name
  const getArtistName = (track: Track): string => {
    return track.producer_name || track.artist_name || 'Unknown Artist';
  };

  // Render medal for top 3
  const renderMedal = (rank: number) => {
    const colors: Record<number, { bg: string, icon: string }> = {
      1: { bg: '#FFD700', icon: '#FFF' },
      2: { bg: '#C0C0C0', icon: '#FFF' },
      3: { bg: '#CD7F32', icon: '#FFF' },
    };
    
    if (rank <= 3) {
      return (
        <View style={[styles.medalBadge, { backgroundColor: colors[rank].bg }]}>
          <Text style={styles.medalText}>{rank}</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.rankBadge}>
        <Text style={styles.rankNumber}>{rank}</Text>
      </View>
    );
  };

  // Render stat based on active tab
  const renderStat = (track: Track) => {
    switch (activeTab) {
      case 'plays':
        return (
          <View style={styles.statContainer}>
            <Ionicons name="play-circle" size={14} color={Colors.primary} />
            <Text style={styles.statText}>{track.play_count || 0}</Text>
          </View>
        );
      case 'downloads':
        return (
          <View style={styles.statContainer}>
            <Ionicons name="download" size={14} color={Colors.primary} />
            <Text style={styles.statText}>{track.download_count || 0}</Text>
          </View>
        );
      case 'recent':
        return (
          <View style={styles.statContainer}>
            <Ionicons name="time" size={14} color={Colors.textMuted} />
            <Text style={styles.statText}>
              {track.created_date ? new Date(track.created_date).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('rankings.title')}</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'plays' && styles.tabActive]}
          onPress={() => setActiveTab('plays')}
        >
          <Ionicons name="play-circle" size={18} color={activeTab === 'plays' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'plays' && styles.tabTextActive]}>
            {t('rankings.mostPlayed')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'downloads' && styles.tabActive]}
          onPress={() => setActiveTab('downloads')}
        >
          <Ionicons name="download" size={18} color={activeTab === 'downloads' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'downloads' && styles.tabTextActive]}>
            {t('rankings.topDownloads')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'recent' && styles.tabActive]}
          onPress={() => setActiveTab('recent')}
        >
          <Ionicons name="time" size={18} color={activeTab === 'recent' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'recent' && styles.tabTextActive]}>
            {t('rankings.newReleases')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Genre Filter */}
      <TouchableOpacity 
        style={styles.genreFilterButton}
        onPress={() => setShowGenreFilter(!showGenreFilter)}
      >
        <Ionicons name="funnel" size={18} color={Colors.primary} />
        <Text style={styles.genreFilterText}>{selectedGenreLabel}</Text>
        <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      {/* Genre Dropdown */}
      {showGenreFilter && (
        <View style={styles.genreDropdown}>
          <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
            {currentGenres.map((genre) => (
              <TouchableOpacity
                key={genre.value}
                style={[styles.genreOption, selectedGenre === genre.value && styles.genreOptionActive]}
                onPress={() => {
                  setSelectedGenre(genre.value);
                  setShowGenreFilter(false);
                }}
              >
                <Text style={[
                  styles.genreOptionText, 
                  selectedGenre === genre.value && styles.genreOptionTextActive
                ]}>
                  {genre.label}
                </Text>
                {selectedGenre === genre.value && (
                  <Ionicons name="checkmark" size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Track List */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>{t('rankings.loading')}</Text>
          </View>
        ) : tracks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{t('rankings.noTracks')}</Text>
            <Text style={styles.emptySubtext}>{t('rankings.tryDifferentGenre')}</Text>
          </View>
        ) : (
          tracks.map((track, index) => {
            const rank = index + 1;
            const coverUrl = getCoverImageUrl(track);
            
            return (
              <View key={track.id || track._id} style={[
                styles.rankCard,
                rank <= 3 && styles.rankCardTop3,
              ]}>
                {renderMedal(rank)}
                
                <View style={styles.trackCover}>
                  {coverUrl ? (
                    <Image source={{ uri: coverUrl }} style={styles.coverImage} />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Ionicons name="musical-notes" size={20} color={Colors.textMuted} />
                    </View>
                  )}
                </View>
                
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>{getArtistName(track)}</Text>
                  <Text style={styles.trackGenre}>{track.genre}</Text>
                </View>
                
                {renderStat(track)}
                
                {track.is_vip && (
                  <View style={styles.vipBadge}>
                    <Ionicons name="diamond" size={14} color="#FFD700" />
                  </View>
                )}
              </View>
            );
          })
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  
  // Tabs
  tabContainer: { 
    flexDirection: 'row', 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    gap: 8 
  },
  tab: { 
    flex: 1, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10, 
    paddingHorizontal: 8,
    borderRadius: 10, 
    backgroundColor: Colors.backgroundCard,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { 
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  tabText: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },
  
  // Genre Filter
  genreFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  genreFilterText: { flex: 1, color: Colors.text, fontSize: 14, fontWeight: '500' },
  genreDropdown: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    overflow: 'hidden',
  },
  genreOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  genreOptionActive: { backgroundColor: Colors.primary + '10' },
  genreOptionText: { color: Colors.text, fontSize: 14 },
  genreOptionTextActive: { color: Colors.primary, fontWeight: '600' },
  
  // Content
  content: { flex: 1, paddingHorizontal: 12 },
  loadingContainer: { padding: 60, alignItems: 'center' },
  loadingText: { color: Colors.textMuted, marginTop: 12 },
  emptyContainer: { padding: 60, alignItems: 'center' },
  emptyText: { color: Colors.text, fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { color: Colors.textMuted, fontSize: 14, marginTop: 4 },
  
  // Rank Card
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  rankCardTop3: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  
  // Medal/Rank Badge
  medalBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medalText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.backgroundInput,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNumber: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  
  // Track Cover
  trackCover: { width: 50, height: 50, borderRadius: 8, overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { 
    width: '100%', 
    height: '100%', 
    backgroundColor: Colors.border, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  
  // Track Info
  trackInfo: { flex: 1, minWidth: 0 },
  trackTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  trackArtist: { fontSize: 12, color: Colors.primary, marginTop: 2 },
  trackGenre: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  
  // Stats
  statContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  statText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  
  // VIP Badge
  vipBadge: { 
    position: 'absolute', 
    top: 8, 
    right: 8,
    backgroundColor: Colors.backgroundCard,
    padding: 4,
    borderRadius: 4,
  },
});
