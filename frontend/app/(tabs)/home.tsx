import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { base44Tracks, Track } from '../../src/services/base44Api';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Genres for filter
const GENRES = [
  'All Genres', 'Afro House', 'Tech House', 'Deep House', 'Melodic House & Techno',
  'Progressive House', 'Minimal / Deep Tech', 'Bass House', 'Organic House',
  'Hard Techno', 'Techno (Peak Time)', 'Funky House', 'Other'
];

const ENERGY_LEVELS = ['All Energy', 'Low', 'Medium', 'High', 'Very High'];
const SORT_OPTIONS = ['Recently Added', 'Most Downloaded', 'Top Rated', 'Oldest'];

export default function HomeScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  
  // State
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [selectedGenre, setSelectedGenre] = useState('All Genres');
  const [selectedEnergy, setSelectedEnergy] = useState('All Energy');
  const [selectedSort, setSelectedSort] = useState('Recently Added');
  const [showVIPOnly, setShowVIPOnly] = useState(false);
  
  // Dropdowns
  const [showGenreFilter, setShowGenreFilter] = useState(false);
  const [showEnergyFilter, setShowEnergyFilter] = useState(false);
  const [showSortFilter, setShowSortFilter] = useState(false);
  
  // Audio player
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    loadTracks();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const loadTracks = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      
      if (selectedGenre !== 'All Genres') filters.genre = selectedGenre;
      if (selectedEnergy !== 'All Energy') filters.energy_level = selectedEnergy.toLowerCase();
      if (showVIPOnly) filters.is_vip = true;
      
      // Sort mapping
      const sortMap: Record<string, string> = {
        'Recently Added': '-created_at',
        'Most Downloaded': '-download_count',
        'Top Rated': '-rating',
        'Oldest': 'created_at',
      };
      filters.sort = sortMap[selectedSort] || '-created_at';
      filters.limit = 50;

      const result = await base44Tracks.list(filters);
      setTracks(result || []);
    } catch (error) {
      console.error('Error loading tracks:', error);
      // Fallback to demo data if Base44 fails
      setTracks(getDemoTracks());
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTracks();
    setRefreshing(false);
  };

  // Search tracks
  const searchTracks = async () => {
    if (!searchQuery.trim()) {
      loadTracks();
      return;
    }
    
    try {
      setLoading(true);
      const result = await base44Tracks.search(searchQuery);
      setTracks(result || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Play/Pause track
  const togglePlay = async (track: Track) => {
    const trackId = track.id || track._id || '';
    
    try {
      if (playingTrackId === trackId) {
        // Stop playing
        if (sound) {
          await sound.stopAsync();
          await sound.unloadAsync();
          setSound(null);
        }
        setPlayingTrackId(null);
      } else {
        // Stop current and play new
        if (sound) {
          await sound.stopAsync();
          await sound.unloadAsync();
        }
        
        if (track.audio_url || track.audio_file) {
          await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: track.audio_url || track.audio_file || '' },
            { shouldPlay: true }
          );
          setSound(newSound);
          setPlayingTrackId(trackId);
          
          // Track play count
          try {
            await base44Tracks.play(trackId);
          } catch {}
          
          // Handle playback finished
          newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              setPlayingTrackId(null);
            }
          });
        } else {
          Alert.alert('No Audio', 'This track does not have an audio file');
        }
      }
    } catch (error) {
      console.error('Playback error:', error);
      Alert.alert('Error', 'Could not play this track');
    }
  };

  // Render star rating
  const renderRating = (rating: number = 0) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={12}
          color={i <= rating ? '#FFD700' : Colors.textMuted}
        />
      );
    }
    return <View style={styles.ratingContainer}>{stars}</View>;
  };

  // Filter dropdown component
  const FilterDropdown = ({ 
    label, 
    value, 
    options, 
    show, 
    setShow, 
    onSelect 
  }: {
    label: string;
    value: string;
    options: string[];
    show: boolean;
    setShow: (show: boolean) => void;
    onSelect: (value: string) => void;
  }) => (
    <View style={styles.filterDropdown}>
      <TouchableOpacity style={styles.filterButton} onPress={() => setShow(!show)}>
        <Text style={styles.filterButtonText} numberOfLines={1}>{value}</Text>
        <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
      </TouchableOpacity>
      {show && (
        <View style={styles.filterDropdownList}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.filterOption, value === option && styles.filterOptionSelected]}
                onPress={() => { onSelect(option); setShow(false); }}
              >
                <Text style={[styles.filterOptionText, value === option && styles.filterOptionTextSelected]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with search */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tracks or producers..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={searchTracks}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); loadTracks(); }}>
              <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* VIP Toggle */}
        <TouchableOpacity 
          style={[styles.vipButton, showVIPOnly && styles.vipButtonActive]}
          onPress={() => { setShowVIPOnly(!showVIPOnly); setTimeout(loadTracks, 100); }}
        >
          <Text style={styles.vipButtonText}>💎 V.I.P.</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersRow}>
        <FilterDropdown
          label="Genre"
          value={selectedGenre}
          options={GENRES}
          show={showGenreFilter}
          setShow={(s) => { setShowGenreFilter(s); setShowEnergyFilter(false); setShowSortFilter(false); }}
          onSelect={(v) => { setSelectedGenre(v); setTimeout(loadTracks, 100); }}
        />
        <FilterDropdown
          label="Energy"
          value={selectedEnergy}
          options={ENERGY_LEVELS}
          show={showEnergyFilter}
          setShow={(s) => { setShowEnergyFilter(s); setShowGenreFilter(false); setShowSortFilter(false); }}
          onSelect={(v) => { setSelectedEnergy(v); setTimeout(loadTracks, 100); }}
        />
        <FilterDropdown
          label="Sort"
          value={selectedSort}
          options={SORT_OPTIONS}
          show={showSortFilter}
          setShow={(s) => { setShowSortFilter(s); setShowGenreFilter(false); setShowEnergyFilter(false); }}
          onSelect={(v) => { setSelectedSort(v); setTimeout(loadTracks, 100); }}
        />
      </View>

      {/* Track List */}
      <ScrollView
        style={styles.trackList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading tracks...</Text>
          </View>
        ) : tracks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No tracks found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
          </View>
        ) : (
          tracks.map((track) => {
            const trackId = track.id || track._id || '';
            const isPlaying = playingTrackId === trackId;
            
            return (
              <View key={trackId} style={styles.trackCard}>
                {/* Cover & Play Button */}
                <TouchableOpacity style={styles.trackCover} onPress={() => togglePlay(track)}>
                  {track.cover_image ? (
                    <Image source={{ uri: track.cover_image }} style={styles.coverImage} />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Ionicons name="musical-notes" size={24} color={Colors.textMuted} />
                    </View>
                  )}
                  <View style={[styles.playOverlay, isPlaying && styles.playOverlayActive]}>
                    <Ionicons 
                      name={isPlaying ? 'pause' : 'play'} 
                      size={20} 
                      color="#fff" 
                    />
                  </View>
                  {track.is_vip && (
                    <View style={styles.vipBadge}>
                      <Text style={styles.vipBadgeText}>💎</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Track Info */}
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>{track.artist_name}</Text>
                  <View style={styles.trackMeta}>
                    {track.bpm && <Text style={styles.trackBpm}>{track.bpm} BPM</Text>}
                    {renderRating(track.rating)}
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.trackActions}>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="download-outline" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="share-outline" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="add-circle-outline" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// Demo tracks for fallback
function getDemoTracks(): Track[] {
  return [
    {
      id: '1',
      title: 'Sunset Groove',
      artist_name: 'DJ Solar',
      genre: 'Afro House',
      bpm: 122,
      rating: 4,
      is_vip: true,
    },
    {
      id: '2',
      title: 'Deep Connection',
      artist_name: 'House Masters',
      genre: 'Deep House',
      bpm: 118,
      rating: 5,
    },
    {
      id: '3',
      title: 'Tech Warrior',
      artist_name: 'Techno Force',
      genre: 'Tech House',
      bpm: 128,
      rating: 4,
    },
    {
      id: '4',
      title: 'Tribal Dance',
      artist_name: 'Rhythm Collective',
      genre: 'Tribal House',
      bpm: 124,
      rating: 3,
      is_vip: true,
    },
    {
      id: '5',
      title: 'Midnight Express',
      artist_name: 'Night Owl',
      genre: 'Melodic Techno',
      bpm: 126,
      rating: 5,
    },
  ];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: 50,
    paddingBottom: Spacing.sm,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15 },
  vipButton: {
    backgroundColor: Colors.backgroundCard,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  vipButtonActive: { backgroundColor: '#FFD70020', borderColor: '#FFD700' },
  vipButtonText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  filterDropdown: { flex: 1, position: 'relative', zIndex: 100 },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterButtonText: { color: Colors.text, fontSize: 12, flex: 1 },
  filterDropdownList: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
    zIndex: 1000,
    elevation: 10,
  },
  filterOption: { padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterOptionSelected: { backgroundColor: Colors.primary + '20' },
  filterOptionText: { color: Colors.text, fontSize: 13 },
  filterOptionTextSelected: { color: Colors.primary, fontWeight: '600' },
  trackList: { flex: 1 },
  loadingContainer: { padding: 60, alignItems: 'center' },
  loadingText: { color: Colors.textMuted, marginTop: 12 },
  emptyContainer: { padding: 60, alignItems: 'center' },
  emptyText: { color: Colors.text, fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { color: Colors.textMuted, marginTop: 4 },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  trackCover: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playOverlayActive: { backgroundColor: Colors.primary + '80' },
  vipBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#000',
    borderRadius: 4,
    padding: 2,
  },
  vipBadgeText: { fontSize: 10 },
  trackInfo: { flex: 1 },
  trackTitle: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  trackArtist: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  trackMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  trackBpm: { color: Colors.primary, fontSize: 11, fontWeight: '500' },
  ratingContainer: { flexDirection: 'row', gap: 1 },
  trackActions: { flexDirection: 'row', gap: 4 },
  actionButton: { padding: 8 },
});
