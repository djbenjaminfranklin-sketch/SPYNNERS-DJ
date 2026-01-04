import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
  PanResponder,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlayer } from '../contexts/PlayerContext';
import { Colors } from '../theme/colors';
import { Track } from '../services/base44Api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PROGRESS_BAR_WIDTH = 80;

export default function GlobalPlayer() {
  const {
    currentTrack,
    isPlaying,
    playbackPosition,
    playbackDuration,
    isLoading,
    togglePlayPause,
    seekTo,
    closePlayer,
  } = usePlayer();

  const [isDragging, setIsDragging] = React.useState(false);
  const [dragPosition, setDragPosition] = React.useState(0);
  const playerAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(playerAnim, {
      toValue: currentTrack ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [currentTrack]);

  // Pan responder for progress bar
  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          setIsDragging(true);
          const { locationX } = evt.nativeEvent;
          const percentage = Math.max(0, Math.min(1, locationX / PROGRESS_BAR_WIDTH));
          setDragPosition(percentage * playbackDuration);
        },
        onPanResponderMove: (evt) => {
          const { locationX } = evt.nativeEvent;
          const percentage = Math.max(0, Math.min(1, locationX / PROGRESS_BAR_WIDTH));
          setDragPosition(percentage * playbackDuration);
        },
        onPanResponderRelease: async (evt) => {
          const { locationX } = evt.nativeEvent;
          const percentage = Math.max(0, Math.min(1, locationX / PROGRESS_BAR_WIDTH));
          const newPosition = Math.floor(percentage * playbackDuration);
          await seekTo(newPosition);
          setIsDragging(false);
        },
        onPanResponderTerminate: () => {
          setIsDragging(false);
        },
      }),
    [playbackDuration, seekTo]
  );

  if (!currentTrack) return null;

  // Get cover image URL
  const getCoverImageUrl = (track: Track): string | null => {
    const url = track.artwork_url || track.cover_image;
    if (url && url.startsWith('http')) return url;
    return null;
  };

  // Get artist name
  const getArtistName = (track: Track): string => {
    return track.producer_name || track.artist_name || 'Unknown Artist';
  };

  // Format time
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const coverUrl = getCoverImageUrl(currentTrack);
  const displayPosition = isDragging ? dragPosition : playbackPosition;
  const progressPercentage = playbackDuration > 0 ? (displayPosition / playbackDuration) * 100 : 0;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            {
              translateY: playerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [100, 0],
              }),
            },
          ],
        },
      ]}
    >
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradient}>
        {/* Track Info */}
        <View style={styles.trackInfo}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]}>
              <Ionicons name="musical-notes" size={20} color={Colors.textMuted} />
            </View>
          )}
          <View style={styles.textInfo}>
            <Text style={styles.title} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {getArtistName(currentTrack)}
            </Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlBtn}>
            <Ionicons name="play-skip-back" size={20} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.playBtn} onPress={togglePlayPause} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlBtn}>
            <Ionicons name="play-skip-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <Text style={styles.time}>{formatTime(displayPosition)}</Text>
          
          <View style={styles.progressContainer} {...panResponder.panHandlers}>
            <View style={styles.progressTrack}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${progressPercentage}%` }
                ]} 
              />
              <View 
                style={[
                  styles.progressThumb,
                  { left: `${progressPercentage}%` }
                ]}
              />
            </View>
          </View>
          
          <Text style={styles.time}>{formatTime(playbackDuration)}</Text>
          
          <TouchableOpacity style={styles.closeBtn} onPress={closePlayer}>
            <Ionicons name="close" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 70, // Above tab bar
    left: 0,
    right: 0,
    height: 80,
    zIndex: 1000,
  },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  cover: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  coverPlaceholder: {
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInfo: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    color: Colors.primary,
    fontSize: 12,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    padding: 4,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  time: {
    color: Colors.textMuted,
    fontSize: 10,
    minWidth: 32,
    textAlign: 'center',
  },
  progressContainer: {
    width: PROGRESS_BAR_WIDTH,
    height: 30,
    justifyContent: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressThumb: {
    position: 'absolute',
    top: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    marginLeft: -7,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 4,
  },
});
