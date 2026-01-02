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
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage, LANGUAGES, Language } from '../../src/contexts/LanguageContext';
import { usePlayer } from '../../src/contexts/PlayerContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { base44Tracks, base44Playlists, base44Notifications2, Track, Notification } from '../../src/services/base44Api';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import NotificationModal from '../../src/components/NotificationModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MENU_ITEM_SIZE = (SCREEN_WIDTH - 24 - 40) / 5; // 5 items per row with spacing

// Menu items with colors matching spynners.com - 2 rows
// Labels use translation keys
const USER_MENU_ITEMS_ROW1 = [
  { id: 'my-uploads', labelKey: 'menu.myUploads', icon: 'cloud-upload', colors: ['#9C27B0', '#7B1FA2'], route: '/(tabs)/library' },
  { id: 'profile', labelKey: 'menu.profile', icon: 'person', colors: ['#9C27B0', '#7B1FA2'], route: '/(tabs)/profile' },
  { id: 'chat', labelKey: 'menu.chat', icon: 'chatbubbles', colors: ['#673AB7', '#512DA8'], route: '/(tabs)/chat' },
  { id: 'received', labelKey: 'menu.received', icon: 'mail', colors: ['#2196F3', '#1976D2'], route: '/(tabs)/received' },
  { id: 'playlists', labelKey: 'menu.playlists', icon: 'list', colors: ['#4CAF50', '#388E3C'], route: '/(tabs)/playlist' },
];

const USER_MENU_ITEMS_ROW2 = [
  { id: 'analytics', labelKey: 'menu.analytics', icon: 'bar-chart', colors: ['#FF9800', '#F57C00'], route: '/profile/analytics' },
  { id: 'rankings', labelKey: 'menu.rankings', icon: 'trending-up', colors: ['#E91E63', '#C2185B'], route: '/profile/rankings' },
  { id: 'live-radar', labelKey: 'menu.liveRadar', icon: 'radio', colors: ['#3F51B5', '#303F9F'], route: '/profile/radar' },
  { id: 'vip', labelKey: 'menu.vip', icon: 'diamond', colors: ['#7C4DFF', '#651FFF'], route: '/profile/vip', highlight: true },
];

// Genres and filters
const GENRES = ['All Genres', 'Afro House', 'Tech House', 'Deep House', 'Melodic House & Techno', 'Progressive House', 'Minimal / Deep Tech', 'Bass House', 'Hard Techno', 'Techno (Peak Time)', 'Funky House'];
const ENERGY_LEVELS = ['All Energy Levels', 'Low', 'Medium', 'High', 'Very High'];
const SORT_OPTIONS = ['Recently Added', 'Most Downloaded', 'Top Rated', 'Oldest'];

export default function HomeScreen() {
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  
  // Use global player context
  const { 
    currentTrack, 
    isPlaying, 
    playbackPosition, 
    playbackDuration, 
    playTrack: globalPlayTrack, 
    togglePlayPause, 
    seekTo,
    closePlayer,
    isLoading: playerLoading 
  } = usePlayer();
  
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
  
  // Modals
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState<Track | null>(null);
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  
  // Animation for player
  const playerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadTracks();
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
      console.log('[Home] Loading tracks...');
      
      const filters: any = { limit: 100 }; // Get more tracks to have better selection
      if (selectedGenre !== 'All Genres') filters.genre = selectedGenre;
      if (selectedEnergy !== 'All Energy Levels') filters.energy_level = selectedEnergy.toLowerCase().replace(' ', '_');
      if (showVIPOnly) filters.is_vip = true;
      
      const sortMap: Record<string, string> = {
        'Recently Added': '-created_date',
        'Most Downloaded': '-download_count',
        'Top Rated': '-average_rating',
        'Oldest': 'created_date',
      };
      filters.sort = sortMap[selectedSort] || '-created_date';

      const result = await base44Tracks.list(filters);
      console.log('[Home] Tracks loaded:', result?.length || 0);
      
      // Filter ONLY approved tracks
      if (result && result.length > 0) {
        const approvedTracks = result.filter((track: Track) => 
          track.status === 'approved'
        );
        console.log('[Home] Approved tracks:', approvedTracks.length);
        
        setTracks(approvedTracks);
      } else {
        console.log('[Home] No tracks from API, showing demo tracks');
        setTracks(getDemoTracks());
      }
    } catch (error) {
      console.error('[Home] Error loading tracks:', error);
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
      // Filter approved tracks only
      const approvedTracks = (result || []).filter((track: Track) => 
        track.is_approved === true || track.status === 'approved'
      );
      setTracks(approvedTracks.length > 0 ? approvedTracks : result || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Use the global player function
  const handlePlayTrack = async (track: Track) => {
    await globalPlayTrack(track);
    // Try to record play count
    try { await base44Tracks.play(track.id || track._id || ''); } catch {}
  };

  // Actions
  const handleDownload = async (track: Track) => {
    try {
      Alert.alert('Download', `Downloading "${track.title}"...`);
      
      // Get the audio URL
      const audioUrl = track.audio_url || track.audio_file;
      if (audioUrl) {
        // Open in browser to download
        const { Linking } = require('react-native');
        await Linking.openURL(audioUrl);
      }
      
      // Try to record the download
      try { 
        await base44Tracks.download(track.id || track._id || ''); 
      } catch (e) {
        console.log('[Download] Could not record download:', e);
      }
    } catch (error) {
      console.error('[Download] Error:', error);
      Alert.alert('Error', 'Could not download track');
    }
  };

  const handleShare = async (track: Track) => {
    try {
      const { Share } = require('react-native');
      const trackUrl = `https://spynners.com/track/${track.id || track._id}`;
      
      await Share.share({
        message: `Check out "${track.title}" by ${track.producer_name || 'Unknown'} on SPYNNERS! ${trackUrl}`,
        url: trackUrl,
        title: track.title,
      });
    } catch (error) {
      console.error('[Share] Error:', error);
    }
  };

  const handleAddToPlaylist = async (track: Track) => {
    setSelectedTrackForPlaylist(track);
    setShowPlaylistModal(true);
    
    // Load user's playlists
    setLoadingPlaylists(true);
    try {
      const userId = user?.id || user?._id || '';
      const allPlaylists = await base44Playlists.list();
      const myPlaylists = allPlaylists.filter((p: any) => {
        const playlistUserId = p.user_id || p.created_by_id || '';
        return playlistUserId === userId;
      });
      setUserPlaylists(myPlaylists);
    } catch (error) {
      console.error('[Playlist] Error loading playlists:', error);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const addToPlaylist = async (playlistId: string) => {
    if (!selectedTrackForPlaylist) return;
    
    try {
      const trackId = selectedTrackForPlaylist.id || selectedTrackForPlaylist._id || '';
      
      // Find the playlist
      const playlist = userPlaylists.find((p: any) => (p.id || p._id) === playlistId);
      if (!playlist) return;
      
      // Get current track IDs
      const currentTrackIds = playlist.track_ids || playlist.tracks || [];
      
      // Add the new track ID if not already present
      if (!currentTrackIds.includes(trackId)) {
        await base44Playlists.update(playlistId, {
          track_ids: [...currentTrackIds, trackId],
        });
        Alert.alert('Success', `Added "${selectedTrackForPlaylist.title}" to "${playlist.name}"`);
      } else {
        Alert.alert('Info', 'Track is already in this playlist');
      }
      
      setShowPlaylistModal(false);
    } catch (error) {
      console.error('[Playlist] Error adding to playlist:', error);
      Alert.alert('Error', 'Could not add track to playlist');
    }
  };

  const handleSendTrack = (track: Track) => {
    Alert.alert('Send Track', `Send "${track.title}" to a member`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose Member', onPress: () => router.push('/(tabs)/chat') },
    ]);
  };

  // Navigate to SPYN Detection
  const handleSpynDetection = () => {
    router.push('/(tabs)/spyn');
  };

  // Navigate to SPYN Record
  const handleSpynRecord = () => {
    router.push('/(tabs)/spyn');
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

  // Render menu item with translation
  const renderMenuItem = (item: any) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.menuItem, item.highlight && styles.menuItemHighlight]}
      onPress={() => router.push(item.route as any)}
      activeOpacity={0.8}
    >
      <LinearGradient colors={item.colors} style={styles.menuItemGradient}>
        <Ionicons name={item.icon as any} size={18} color="#fff" />
        <Text style={styles.menuItemLabel} numberOfLines={1}>{t(item.labelKey)}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  // Get cover image URL - use artwork_url from Base44
  const getCoverImageUrl = (track: Track): string | null => {
    // Use artwork_url (Base44 field) or cover_image (legacy field)
    const url = track.artwork_url || track.cover_image;
    if (url) {
      // If it's already a full URL, use it
      if (url.startsWith('http')) {
        return url;
      }
      // If it's a Base44 file reference, construct the URL
      return `https://base44.app/api/apps/691a4d96d819355b52c063f3/files/public/691a4d96d819355b52c063f3/${url}`;
    }
    return null;
  };

  // Get artist name - use producer_name from Base44 or artist_name (legacy)
  const getArtistName = (track: Track): string => {
    return track.producer_name || track.artist_name || 'Unknown Artist';
  };

  // Get rating value
  const getRating = (track: Track): number => {
    return track.average_rating || track.rating || 0;
  };

  // Notification state
  const [notificationCount, setNotificationCount] = useState(0);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  
  // Load notifications count
  useEffect(() => {
    loadNotifications();
  }, [user]);

  const loadNotifications = async () => {
    try {
      const userId = user?.id || user?._id || '';
      if (userId) {
        const count = await base44Notifications2.getUnreadCount(userId);
        setNotificationCount(count);
      }
    } catch (error) {
      console.error('[Home] Error loading notifications:', error);
    }
  };

  // Get current language info
  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];
  
  // Notification modal state
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  return (
    <View style={styles.container}>
      {/* Top Header with Language & Notifications */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.logoText}>SPYNNERS</Text>
        </View>
        
        <View style={styles.headerRight}>
          {/* Language Selector */}
          <TouchableOpacity 
            style={styles.langButton}
            onPress={() => setShowLanguageModal(true)}
          >
            <Text style={styles.langFlag}>{currentLang.flag}</Text>
            <Text style={styles.langText}>{currentLang.code.toUpperCase()}</Text>
            <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
          
          {/* Notification Bell - Opens Modal */}
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => setShowNotificationModal(true)}
          >
            <Ionicons name="notifications-outline" size={24} color={Colors.text} />
            {notificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: currentTrack ? 120 : 20 }}
      >
        {/* User Menu - Two Rows Grid (FIRST) */}
        <View style={styles.menuContainer}>
          <View style={styles.menuRow}>
            {USER_MENU_ITEMS_ROW1.map(renderMenuItem)}
          </View>
          <View style={styles.menuRow}>
            {USER_MENU_ITEMS_ROW2.map(renderMenuItem)}
          </View>
        </View>

        {/* SPYN Buttons - Two round buttons (AFTER menus) */}
        <View style={styles.spynButtonsContainer}>
          <TouchableOpacity style={styles.spynButton} onPress={handleSpynDetection} activeOpacity={0.8}>
            <LinearGradient colors={['#9C27B0', '#7B1FA2']} style={styles.spynButtonGradient}>
              <Ionicons name="radio" size={28} color="#fff" />
              <Text style={styles.spynButtonText}>SPYN</Text>
              <Text style={styles.spynButtonSubtext}>Détection</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.spynButton} onPress={handleSpynRecord} activeOpacity={0.8}>
            <LinearGradient colors={['#E91E63', '#C2185B']} style={styles.spynButtonGradient}>
              <Ionicons name="mic" size={28} color="#fff" />
              <Text style={styles.spynButtonText}>SPYN</Text>
              <Text style={styles.spynButtonSubtext}>Record</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Upload Track Button */}
        <TouchableOpacity 
          style={styles.uploadTrackButton} 
          onPress={() => router.push('/(tabs)/upload')}
          activeOpacity={0.8}
        >
          <LinearGradient colors={['#4CAF50', '#388E3C']} style={styles.uploadTrackGradient}>
            <Ionicons name="cloud-upload" size={22} color="#fff" />
            <Text style={styles.uploadTrackText}>{t('menu.uploadTrack')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Search & Filters */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('common.search') + '...'}
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
              <Text style={styles.vipButtonText}>V.I.P.</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Filters Row */}
        <View style={styles.filtersRow}>
          <FilterDropdown value={selectedGenre} options={GENRES} show={showGenreFilter} setShow={setShowGenreFilter} onSelect={setSelectedGenre} />
          <FilterDropdown value={selectedEnergy} options={ENERGY_LEVELS} show={showEnergyFilter} setShow={setShowEnergyFilter} onSelect={setSelectedEnergy} />
          <FilterDropdown value={selectedSort} options={SORT_OPTIONS} show={showSortFilter} setShow={setShowSortFilter} onSelect={setSelectedSort} />
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
            const coverUrl = getCoverImageUrl(track);
            const artistName = getArtistName(track);
            const rating = getRating(track);
            
            return (
              <View key={trackId} style={[styles.trackCard, isCurrentTrack && styles.trackCardActive]}>
                {/* Left: Play Button & Cover */}
                <TouchableOpacity style={styles.playButton} onPress={() => handlePlayTrack(track)}>
                  <Ionicons name={isCurrentTrack && isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
                </TouchableOpacity>
                
                <View style={styles.trackCover}>
                  {coverUrl ? (
                    <Image 
                      source={{ uri: coverUrl }} 
                      style={styles.coverImage}
                      onError={(e) => console.log('[Cover] Error loading:', coverUrl)}
                    />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Ionicons name="musical-notes" size={20} color={Colors.textMuted} />
                    </View>
                  )}
                </View>

                {/* Track Info */}
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>{artistName} • {track.bpm || '—'} BPM</Text>
                  {renderRating(rating)}
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

      {/* Add to Playlist Modal */}
      <Modal visible={showPlaylistModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add to Playlist</Text>
            <Text style={styles.modalSubtitle}>"{selectedTrackForPlaylist?.title}"</Text>
            
            {loadingPlaylists ? (
              <View style={styles.playlistLoading}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.playlistLoadingText}>Loading playlists...</Text>
              </View>
            ) : userPlaylists.length === 0 ? (
              <View style={styles.playlistEmpty}>
                <Ionicons name="list-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.playlistEmptyText}>No playlists yet</Text>
                <TouchableOpacity 
                  style={styles.createPlaylistBtn}
                  onPress={() => {
                    setShowPlaylistModal(false);
                    router.push('/(tabs)/playlist');
                  }}
                >
                  <Text style={styles.createPlaylistText}>Create Playlist</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={styles.playlistList}>
                {userPlaylists.map((playlist: any) => (
                  <TouchableOpacity 
                    key={playlist.id || playlist._id}
                    style={styles.modalOption}
                    onPress={() => addToPlaylist(playlist.id || playlist._id)}
                  >
                    <Ionicons name="musical-notes" size={20} color={Colors.primary} />
                    <View style={styles.playlistOptionInfo}>
                      <Text style={styles.modalOptionText}>{playlist.name}</Text>
                      <Text style={styles.playlistTrackCount}>
                        {(playlist.track_ids || playlist.tracks || []).length} tracks
                      </Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPlaylistModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Language Selection Modal */}
      <Modal visible={showLanguageModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('language')}</Text>
            <Text style={styles.modalSubtitle}>Select your language</Text>
            
            {LANGUAGES.map((lang) => (
              <TouchableOpacity 
                key={lang.code}
                style={[
                  styles.langOption,
                  language === lang.code && styles.langOptionActive
                ]}
                onPress={() => {
                  setLanguage(lang.code);
                  setShowLanguageModal(false);
                }}
              >
                <Text style={styles.langOptionFlag}>{lang.flag}</Text>
                <Text style={[
                  styles.langOptionText,
                  language === lang.code && styles.langOptionTextActive
                ]}>
                  {lang.name}
                </Text>
                {language === lang.code && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowLanguageModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Notification Modal */}
      <NotificationModal 
        visible={showNotificationModal} 
        onClose={() => {
          setShowNotificationModal(false);
          loadNotifications(); // Refresh count after closing
        }} 
      />
    </View>
  );
}

// Demo tracks with cover images for testing
function getDemoTracks(): Track[] {
  return [
    { 
      id: '1', 
      title: '80', 
      artist_name: 'dj Konik', 
      genre: 'Techno (Peak Time)', 
      bpm: 128, 
      rating: 3.5, 
      is_vip: false,
      is_approved: true,
      cover_image: 'https://picsum.photos/seed/track1/200/200',
    },
    { 
      id: '2', 
      title: 'PRAY FOR TOMORROW', 
      artist_name: 'Benjamin Franklin', 
      genre: 'Deep House', 
      bpm: 124, 
      rating: 5, 
      is_vip: true,
      is_approved: true,
      cover_image: 'https://picsum.photos/seed/track2/200/200',
    },
    { 
      id: '3', 
      title: 'Sunset Groove', 
      artist_name: 'DJ Solar', 
      genre: 'Afro House', 
      bpm: 122, 
      rating: 4, 
      is_vip: true,
      is_approved: true,
      cover_image: 'https://picsum.photos/seed/track3/200/200',
    },
    { 
      id: '4', 
      title: 'Deep Connection', 
      artist_name: 'House Masters', 
      genre: 'Deep House', 
      bpm: 118, 
      rating: 5,
      is_approved: true,
      cover_image: 'https://picsum.photos/seed/track4/200/200',
    },
    { 
      id: '5', 
      title: 'Tech Warrior', 
      artist_name: 'Techno Force', 
      genre: 'Tech House', 
      bpm: 128, 
      rating: 4,
      is_approved: true,
      cover_image: 'https://picsum.photos/seed/track5/200/200',
    },
    { 
      id: '6', 
      title: 'Night Drive', 
      artist_name: 'Midnight Club', 
      genre: 'Melodic House & Techno', 
      bpm: 122, 
      rating: 4.5,
      is_vip: true,
      is_approved: true,
      cover_image: 'https://picsum.photos/seed/track6/200/200',
    },
  ];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  
  // Top Header
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    backgroundColor: '#F44336',
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  
  // SPYN Buttons
  spynButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  spynButton: {
    width: 130,
    height: 130,
    borderRadius: 65,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  spynButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  spynButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  spynButtonSubtext: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Menu Grid - Two Rows
  menuContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  menuItem: { 
    flex: 1,
    aspectRatio: 1,
    maxWidth: MENU_ITEM_SIZE, 
    borderRadius: 10, 
    overflow: 'hidden' 
  },
  menuItemHighlight: { borderWidth: 2, borderColor: Colors.primary },
  menuItemGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 4 },
  menuItemLabel: { color: '#fff', fontSize: 8, fontWeight: '600', marginTop: 3, textAlign: 'center' },
  
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
  
  // Loading/Empty
  loadingContainer: { padding: 60, alignItems: 'center' },
  loadingText: { color: Colors.textMuted, marginTop: 12 },
  emptyContainer: { padding: 60, alignItems: 'center' },
  emptyText: { color: Colors.text, fontSize: 18, fontWeight: '600', marginTop: 16 },
  
  // Track Card
  trackCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 10, padding: 10, backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary + '40', gap: 10 },
  trackCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  playButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  trackCover: { width: 50, height: 50, borderRadius: 8, overflow: 'hidden', backgroundColor: Colors.border },
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
  progressBar: { width: 80, height: 20, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden', justifyContent: 'center' },
  progressFill: { height: 6, backgroundColor: Colors.primary, borderRadius: 3, position: 'absolute', left: 0, top: 7 },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 20, width: '100%', maxWidth: 320, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  modalOption: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: Colors.background, borderRadius: 10, marginBottom: 8, gap: 12 },
  modalOptionText: { color: Colors.text, fontSize: 14, flex: 1 },
  modalCancel: { padding: 14, alignItems: 'center', marginTop: 8 },
  modalCancelText: { color: Colors.textMuted, fontSize: 14 },
  // Playlist modal additions
  playlistLoading: { alignItems: 'center', paddingVertical: 30 },
  playlistLoadingText: { color: Colors.textMuted, marginTop: 8, fontSize: 14 },
  playlistEmpty: { alignItems: 'center', paddingVertical: 20 },
  playlistEmptyText: { color: Colors.textMuted, marginTop: 8, fontSize: 14 },
  createPlaylistBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 8 },
  createPlaylistText: { color: '#fff', fontWeight: '600' },
  playlistList: { maxHeight: 250 },
  playlistOptionInfo: { flex: 1 },
  playlistTrackCount: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  // Language modal
  langFlag: { fontSize: 18 },
  langOption: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 14, 
    backgroundColor: Colors.background, 
    borderRadius: 10, 
    marginBottom: 8, 
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langOptionActive: { 
    backgroundColor: Colors.primary + '20', 
    borderColor: Colors.primary 
  },
  langOptionFlag: { fontSize: 24 },
  langOptionText: { color: Colors.text, fontSize: 15, flex: 1 },
  langOptionTextActive: { color: Colors.primary, fontWeight: '600' },
});
