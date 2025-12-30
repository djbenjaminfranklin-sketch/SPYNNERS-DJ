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
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { base44Tracks, Track } from '../../src/services/base44Api';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MENU_ITEM_SIZE = 64;

// Menu items with colors matching spynners.com
const USER_MENU_ITEMS = [
  { id: 'my-uploads', label: 'My Uploads', icon: 'cloud-upload', colors: ['#9C27B0', '#7B1FA2'], route: '/(tabs)/library' },
  { id: 'profile', label: 'Profile', icon: 'person', colors: ['#9C27B0', '#7B1FA2'], route: '/(tabs)/profile' },
  { id: 'chat', label: 'Chat', icon: 'chatbubbles', colors: ['#673AB7', '#512DA8'], route: '/(tabs)/chat' },
  { id: 'received', label: 'Received', icon: 'mail', colors: ['#2196F3', '#1976D2'], route: '/(tabs)/received' },
  { id: 'playlists', label: 'Playlists', icon: 'list', colors: ['#4CAF50', '#388E3C'], route: '/(tabs)/playlist' },
  { id: 'analytics', label: 'Analytics', icon: 'bar-chart', colors: ['#FF9800', '#F57C00'], route: '/profile/analytics' },
  { id: 'rankings', label: 'Rankings', icon: 'trending-up', colors: ['#E91E63', '#C2185B'], route: '/profile/rankings' },
  { id: 'live-radar', label: 'Live Radar', icon: 'radio', colors: ['#3F51B5', '#303F9F'], route: '/profile/radar' },
  { id: 'forum', label: 'Forum', icon: 'people', colors: ['#9C27B0', '#7B1FA2'], route: '/profile/forum' },
  { id: 'vip', label: 'V.I.P.', icon: 'diamond', colors: ['#7C4DFF', '#651FFF'], route: '/profile/vip', highlight: true },
  { id: 'clubs', label: 'Clubs', icon: 'location', colors: ['#E040FB', '#AA00FF'], route: '/profile/clubs' },
];

// Genres and filters
const GENRES = ['All Genres', 'Afro House', 'Tech House', 'Deep House', 'Melodic House & Techno', 'Progressive House', 'Minimal / Deep Tech', 'Bass House', 'Hard Techno', 'Techno (Peak Time)', 'Funky House'];
const ENERGY_LEVELS = ['All Energy Levels', 'Low', 'Medium', 'High', 'Very High'];
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
  const [selectedEnergy, setSelectedEnergy] = useState('All Energy Levels');
  const [selectedSort, setSelectedSort] = useState('Recently Added');
  const [showVIPOnly, setShowVIPOnly] = useState(false);
  
  // Dropdowns
  const [showGenreFilter, setShowGenreFilter] = useState(false);
  const [showEnergyFilter, setShowEnergyFilter] = useState(false);
  const [showSortFilter, setShowSortFilter] = useState(false);
  
  // Audio player
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  
  // Modals
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState<Track | null>(null);
  
  // Animation for player
  const playerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadTracks();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    // Animate player appearance
    Animated.timing(playerAnim, {
      toValue: currentTrack ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [currentTrack]);

  const loadTracks = async () => {
    try {
      setLoading(true);
      const filters: any = { limit: 50 };
      if (selectedGenre !== 'All Genres') filters.genre = selectedGenre;
      if (selectedEnergy !== 'All Energy Levels') filters.energy_level = selectedEnergy.toLowerCase().replace(' ', '_');
      if (showVIPOnly) filters.is_vip = true;
      
      const sortMap: Record<string, string> = {
        'Recently Added': '-created_at',
        'Most Downloaded': '-download_count',
        'Top Rated': '-rating',
        'Oldest': 'created_at',
      };
      filters.sort = sortMap[selectedSort] || '-created_at';

      const result = await base44Tracks.list(filters);
      setTracks(result || getDemoTracks());
    } catch (error) {
      console.error('Error loading tracks:', error);
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

  const searchTracks = async () => {
    if (!searchQuery.trim()) { loadTracks(); return; }
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

  // Play track
  const playTrack = async (track: Track) => {
    try {
      // Stop current
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }
      
      if (track.audio_url || track.audio_file) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: track.audio_url || track.audio_file || '' },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
        setCurrentTrack(track);
        setIsPlaying(true);
        
        // Track play count
        try { await base44Tracks.play(track.id || track._id || ''); } catch {}
      } else {
        Alert.alert('No Audio', 'This track does not have an audio file');
      }
    } catch (error) {
      console.error('Playback error:', error);
      Alert.alert('Error', 'Could not play this track');
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPlaybackPosition(status.positionMillis || 0);
      setPlaybackDuration(status.durationMillis || 0);
      if (status.didJustFinish) {
        setIsPlaying(false);
      }
    }
  };

  const togglePlayPause = async () => {
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    } else {
      await sound.playAsync();
      setIsPlaying(true);
    }
  };

  const closePlayer = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
    setCurrentTrack(null);
    setIsPlaying(false);
  };

  // Actions
  const handleDownload = (track: Track) => {
    Alert.alert('Download', `Downloading "${track.title}"...`, [{ text: 'OK' }]);
    try { base44Tracks.download(track.id || track._id || ''); } catch {}
  };

  const handleShare = (track: Track) => {
    Alert.alert('Share', `Share "${track.title}" via...`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Copy Link', onPress: () => Alert.alert('Copied!') },
    ]);
  };

  const handleAddToPlaylist = (track: Track) => {
    setSelectedTrackForPlaylist(track);
    setShowPlaylistModal(true);
  };

  const handleSendTrack = (track: Track) => {
    Alert.alert('Send Track', `Send "${track.title}" to a member`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose Member', onPress: () => router.push('/(tabs)/chat') },
    ]);
  };

  // Render star rating
  const renderRating = (rating: number = 0) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons key={i} name={i <= rating ? 'star' : 'star-outline'} size={12} color={i <= rating ? '#FFD700' : Colors.textMuted} />
      );
    }
    return <View style={styles.ratingContainer}>{stars}</View>;
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Filter dropdown
  const FilterDropdown = ({ value, options, show, setShow, onSelect }: any) => (
    <View style={styles.filterDropdown}>
      <TouchableOpacity style={styles.filterButton} onPress={() => { setShow(!show); setShowGenreFilter(false); setShowEnergyFilter(false); setShowSortFilter(false); setShow(!show); }}>
        <Text style={styles.filterButtonText} numberOfLines={1}>{value}</Text>
        <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
      </TouchableOpacity>
      {show && (
        <View style={styles.filterDropdownList}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {options.map((option: string) => (
              <TouchableOpacity
                key={option}
                style={[styles.filterOption, value === option && styles.filterOptionSelected]}
                onPress={() => { onSelect(option); setShow(false); setTimeout(loadTracks, 100); }}
              >
                <Text style={[styles.filterOptionText, value === option && styles.filterOptionTextSelected]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: currentTrack ? 120 : 20 }}
      >
        {/* User Menu - Horizontal Scroll */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.menuScroll}
          contentContainerStyle={styles.menuContent}
        >
          {USER_MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, item.highlight && styles.menuItemHighlight]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.8}
            >
              <LinearGradient colors={item.colors} style={styles.menuItemGradient}>
                <Ionicons name={item.icon as any} size={20} color="#fff" />
                <Text style={styles.menuItemLabel}>{item.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search & Filters */}
        <View style={styles.searchSection}>
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
          
          <TouchableOpacity 
            style={[styles.vipButton, showVIPOnly && styles.vipButtonActive]}
            onPress={() => { setShowVIPOnly(!showVIPOnly); setTimeout(loadTracks, 100); }}
          >
            <LinearGradient colors={['#FF9800', '#F57C00']} style={styles.vipButtonGradient}>
              <Ionicons name="diamond" size={14} color="#fff" />
              <Text style={styles.vipButtonText}>TRACK V.I.P.</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Filters Row */}
        <View style={styles.filtersRow}>
          <FilterDropdown value={selectedGenre} options={GENRES} show={showGenreFilter} setShow={setShowGenreFilter} onSelect={setSelectedGenre} />
          <FilterDropdown value={selectedEnergy} options={ENERGY_LEVELS} show={showEnergyFilter} setShow={setShowEnergyFilter} onSelect={setSelectedEnergy} />
          <FilterDropdown value={selectedSort} options={SORT_OPTIONS} show={showSortFilter} setShow={setShowSortFilter} onSelect={setSelectedSort} />
          <TouchableOpacity style={styles.rankingsButton}>
            <Ionicons name="trophy" size={16} color={Colors.primary} />
            <Text style={styles.rankingsText}>Rankings</Text>
          </TouchableOpacity>
        </View>

        {/* Track List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading tracks...</Text>
          </View>
        ) : tracks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No tracks found</Text>
          </View>
        ) : (
          tracks.map((track) => {
            const trackId = track.id || track._id || '';
            const isCurrentTrack = currentTrack && (currentTrack.id || currentTrack._id) === trackId;
            
            return (
              <View key={trackId} style={[styles.trackCard, isCurrentTrack && styles.trackCardActive]}>
                {/* Left: Play Button & Cover */}
                <TouchableOpacity style={styles.playButton} onPress={() => playTrack(track)}>
                  <Ionicons name={isCurrentTrack && isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
                </TouchableOpacity>
                
                <View style={styles.trackCover}>
                  {track.cover_image ? (
                    <Image source={{ uri: track.cover_image }} style={styles.coverImage} />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Ionicons name="musical-notes" size={20} color={Colors.textMuted} />
                    </View>
                  )}
                </View>

                {/* Track Info */}
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>{track.artist_name} • {track.bpm || '—'} BPM</Text>
                  {renderRating(track.rating)}
                </View>

                {/* VIP Badge */}
                {track.is_vip && (
                  <View style={styles.vipBadge}>
                    <Ionicons name="diamond" size={14} color="#FFD700" />
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.trackActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleDownload(track)}>
                    <Ionicons name="download-outline" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(track)}>
                    <Ionicons name="share-social-outline" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleAddToPlaylist(track)}>
                    <Ionicons name="list-outline" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleSendTrack(track)}>
                    <Ionicons name="send-outline" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Bottom Player */}
      {currentTrack && (
        <Animated.View style={[styles.bottomPlayer, { transform: [{ translateY: playerAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }] }]}>
          <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.playerGradient}>
            {/* Track Info */}
            <View style={styles.playerLeft}>
              {currentTrack.cover_image ? (
                <Image source={{ uri: currentTrack.cover_image }} style={styles.playerCover} />
              ) : (
                <View style={[styles.playerCover, styles.playerCoverPlaceholder]}>
                  <Ionicons name="musical-notes" size={20} color={Colors.textMuted} />
                </View>
              )}
              <View style={styles.playerInfo}>
                <Text style={styles.playerTitle} numberOfLines={1}>{currentTrack.title}</Text>
                <Text style={styles.playerArtist} numberOfLines={1}>{currentTrack.artist_name}</Text>
              </View>
            </View>

            {/* Controls */}
            <View style={styles.playerControls}>
              <TouchableOpacity style={styles.playerControlBtn}>
                <Ionicons name="play-skip-back" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.playerPlayBtn} onPress={togglePlayPause}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.playerControlBtn}>
                <Ionicons name="play-skip-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Progress & Time */}
            <View style={styles.playerRight}>
              <Text style={styles.playerTime}>{formatTime(playbackPosition)}</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${playbackDuration > 0 ? (playbackPosition / playbackDuration) * 100 : 0}%` }]} />
              </View>
              <TouchableOpacity onPress={closePlayer}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      )}

      {/* Add to Playlist Modal */}
      <Modal visible={showPlaylistModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add to Playlist</Text>
            <Text style={styles.modalSubtitle}>"{selectedTrackForPlaylist?.title}"</Text>
            <TouchableOpacity style={styles.modalOption}>
              <Ionicons name="add-circle" size={20} color={Colors.primary} />
              <Text style={styles.modalOptionText}>Create New Playlist</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption}>
              <Ionicons name="heart" size={20} color="#E91E63" />
              <Text style={styles.modalOptionText}>Favorites</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption}>
              <Ionicons name="musical-notes" size={20} color={Colors.primary} />
              <Text style={styles.modalOptionText}>DJ Sets</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPlaylistModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Demo tracks
function getDemoTracks(): Track[] {
  return [
    { id: '1', title: '80', artist_name: 'dj Konik', genre: 'Techno (Peak Time)', bpm: 128, rating: 3.5, is_vip: false },
    { id: '2', title: 'PRAY FOR TOMORROW', artist_name: 'Benjamin Franklin', genre: 'Deep House', bpm: 124, rating: 5, is_vip: true },
    { id: '3', title: 'Sunset Groove', artist_name: 'DJ Solar', genre: 'Afro House', bpm: 122, rating: 4, is_vip: true },
    { id: '4', title: 'Deep Connection', artist_name: 'House Masters', genre: 'Deep House', bpm: 118, rating: 5 },
    { id: '5', title: 'Tech Warrior', artist_name: 'Techno Force', genre: 'Tech House', bpm: 128, rating: 4 },
  ];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  
  // Menu Horizontal
  menuScroll: { marginTop: 50 },
  menuContent: { paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
  menuItem: { width: MENU_ITEM_SIZE, height: MENU_ITEM_SIZE, borderRadius: 10, overflow: 'hidden' },
  menuItemHighlight: { borderWidth: 2, borderColor: Colors.primary },
  menuItemGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 4 },
  menuItemLabel: { color: '#fff', fontSize: 9, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  
  // Search
  searchSection: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: 8, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: Colors.primary },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, marginLeft: 8 },
  vipButton: { borderRadius: 8, overflow: 'hidden' },
  vipButtonActive: { opacity: 0.8 },
  vipButtonGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 6 },
  vipButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  
  // Filters
  filtersRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  filterDropdown: { flex: 1, position: 'relative', zIndex: 100 },
  filterButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.backgroundCard, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: Colors.primary },
  filterButtonText: { color: Colors.text, fontSize: 11, flex: 1 },
  filterDropdownList: { position: 'absolute', top: 42, left: 0, right: 0, backgroundColor: Colors.backgroundCard, borderRadius: 6, borderWidth: 1, borderColor: Colors.primary, zIndex: 1000, elevation: 10 },
  filterOption: { padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterOptionSelected: { backgroundColor: Colors.primary + '20' },
  filterOptionText: { color: Colors.text, fontSize: 12 },
  filterOptionTextSelected: { color: Colors.primary, fontWeight: '600' },
  rankingsButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 10, gap: 4, borderWidth: 1, borderColor: Colors.primary },
  rankingsText: { color: Colors.text, fontSize: 11 },
  
  // Loading/Empty
  loadingContainer: { padding: 60, alignItems: 'center' },
  loadingText: { color: Colors.textMuted, marginTop: 12 },
  emptyContainer: { padding: 60, alignItems: 'center' },
  emptyText: { color: Colors.text, fontSize: 18, fontWeight: '600', marginTop: 16 },
  
  // Track Card
  trackCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 10, padding: 10, backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary + '40', gap: 10 },
  trackCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  playButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  trackCover: { width: 50, height: 50, borderRadius: 8, overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%', backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  trackInfo: { flex: 1, minWidth: 0 },
  trackTitle: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  trackArtist: { color: Colors.primary, fontSize: 12, marginTop: 2 },
  ratingContainer: { flexDirection: 'row', marginTop: 4, gap: 1 },
  vipBadge: { position: 'absolute', top: 10, right: 10 },
  trackActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { width: 32, height: 32, borderRadius: 6, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  
  // Bottom Player
  bottomPlayer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70 },
  playerGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 12 },
  playerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  playerCover: { width: 50, height: 50, borderRadius: 8 },
  playerCoverPlaceholder: { backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  playerInfo: { flex: 1, minWidth: 0 },
  playerTitle: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  playerArtist: { color: Colors.primary, fontSize: 11 },
  playerControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerControlBtn: { padding: 4 },
  playerPlayBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  playerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerTime: { color: Colors.textMuted, fontSize: 11 },
  progressBar: { width: 60, height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 20, width: '100%', maxWidth: 320 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  modalOption: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: Colors.background, borderRadius: 10, marginBottom: 8, gap: 12 },
  modalOptionText: { color: Colors.text, fontSize: 14 },
  modalCancel: { padding: 14, alignItems: 'center', marginTop: 8 },
  modalCancelText: { color: Colors.textMuted, fontSize: 14 },
});
