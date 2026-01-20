import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Colors, BorderRadius } from '../../src/theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Audio } from 'expo-av';

// Storage key for local mixes
const MIXES_STORAGE_KEY = 'spyn_local_mixes';

interface LocalMix {
  id: string;
  user_id: string;
  user_name?: string;
  audio_url?: string;
  duration?: number;
  session_id?: string;
  city?: string;
  country?: string;
  venue?: string;
  tracks_count?: number;
  expires_at?: string;
  created_date?: string;
}

export default function MyMixesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useLanguage();
  
  const [mixes, setMixes] = useState<LocalMix[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  // Load mixes on mount
  useEffect(() => {
    loadMixes();
    return () => {
      // Cleanup sound on unmount
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const loadMixes = async () => {
    try {
      setLoading(true);
      
      // Load from local storage
      const storedMixes = await AsyncStorage.getItem(MIXES_STORAGE_KEY);
      let allMixes: LocalMix[] = storedMixes ? JSON.parse(storedMixes) : [];
      
      console.log('[MyMixes] Loaded', allMixes.length, 'mixes from storage');
      
      // Filter for current user and not expired
      const userId = user?.id || user?._id || '';
      const now = new Date();
      
      // Validate each mix - check if file exists
      const validMixes: LocalMix[] = [];
      const invalidMixIds: string[] = [];
      
      for (const mix of allMixes) {
        // Check ownership
        const isOwner = mix.user_id === userId || !mix.user_id; // Also include mixes without user_id
        
        // Check expiration (24 hours)
        let isExpired = false;
        if (mix.expires_at) {
          const expiresAt = new Date(mix.expires_at);
          if (expiresAt < now) {
            isExpired = true;
          }
        }
        
        // Check if file exists
        let fileExists = false;
        if (mix.audio_url) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(mix.audio_url);
            fileExists = fileInfo.exists;
            console.log('[MyMixes] File check:', mix.audio_url, 'exists:', fileExists);
          } catch (e) {
            console.log('[MyMixes] File check error for:', mix.audio_url, e);
          }
        }
        
        if (isOwner && !isExpired && fileExists) {
          validMixes.push(mix);
        } else {
          invalidMixIds.push(mix.id);
          console.log('[MyMixes] Removing invalid mix:', mix.id, 
            'isOwner:', isOwner, 'isExpired:', isExpired, 'fileExists:', fileExists);
        }
      }
      
      // Clean up invalid mixes from storage
      if (invalidMixIds.length > 0) {
        const cleanedMixes = allMixes.filter(m => !invalidMixIds.includes(m.id));
        await AsyncStorage.setItem(MIXES_STORAGE_KEY, JSON.stringify(cleanedMixes));
        console.log('[MyMixes] Cleaned up', invalidMixIds.length, 'invalid mixes');
      }
      
      // Sort by date (newest first)
      validMixes.sort((a, b) => {
        const dateA = new Date(a.created_date || 0);
        const dateB = new Date(b.created_date || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      console.log('[MyMixes] Valid mixes:', validMixes.length);
      setMixes(validMixes);
    } catch (error) {
      console.log('[MyMixes] Error loading mixes:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMixes();
    setRefreshing(false);
  }, []);

  // Format duration as HH:MM:SS
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate time remaining until expiration
  const getTimeRemaining = (expiresAt?: string): string => {
    if (!expiresAt) return '';
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return language === 'fr' ? 'Expiré' : 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return language === 'fr' ? `${hours}h ${minutes}min restant` : `${hours}h ${minutes}min remaining`;
    }
    return language === 'fr' ? `${minutes} min restant` : `${minutes} min remaining`;
  };

  // Check if file exists
  const checkFileExists = async (uri?: string): Promise<boolean> => {
    if (!uri) return false;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists;
    } catch {
      return false;
    }
  };

  // Play mix
  const handlePlay = async (mix: LocalMix) => {
    if (!mix.audio_url) {
      Alert.alert(
        language === 'fr' ? 'Erreur' : 'Error',
        language === 'fr' ? 'Fichier audio non disponible' : 'Audio file not available'
      );
      return;
    }

    try {
      // If already playing this mix, stop it
      if (playingId === mix.id && sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
        setPlayingId(null);
        return;
      }

      // Stop any currently playing sound
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }

      // Check if file exists
      const exists = await checkFileExists(mix.audio_url);
      
      if (!exists) {
        Alert.alert(
          language === 'fr' ? 'Fichier introuvable' : 'File not found',
          language === 'fr' 
            ? 'Le fichier audio a été supprimé ou déplacé' 
            : 'The audio file has been deleted or moved'
        );
        return;
      }

      // Configure audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      // Load and play the audio
      console.log('[MyMixes] Playing:', mix.audio_url);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: mix.audio_url },
        { shouldPlay: true }
      );
      
      setSound(newSound);
      setPlayingId(mix.id);

      // Handle playback status updates
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingId(null);
          newSound.unloadAsync();
          setSound(null);
        }
      });
    } catch (error) {
      console.error('[MyMixes] Play error:', error);
      Alert.alert(
        language === 'fr' ? 'Erreur' : 'Error',
        language === 'fr' ? 'Impossible de lire le fichier' : 'Unable to play file'
      );
    }
  };

  // Share/Download mix
  const handleShare = async (mix: LocalMix) => {
    if (!mix.audio_url) {
      Alert.alert(
        language === 'fr' ? 'Erreur' : 'Error',
        language === 'fr' ? 'Fichier audio non disponible' : 'Audio file not available'
      );
      return;
    }

    try {
      setDownloadingId(mix.id);
      
      // Check if file exists
      const exists = await checkFileExists(mix.audio_url);
      
      if (!exists) {
        Alert.alert(
          language === 'fr' ? 'Fichier introuvable' : 'File not found',
          language === 'fr' 
            ? 'Le fichier audio a été supprimé ou déplacé' 
            : 'The audio file has been deleted or moved'
        );
        return;
      }
      
      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(mix.audio_url, {
          mimeType: 'audio/mp4',
          dialogTitle: language === 'fr' ? 'Partager le mix' : 'Share mix',
        });
      } else {
        Alert.alert(
          language === 'fr' ? 'Non disponible' : 'Not available',
          language === 'fr' ? 'Le partage n\'est pas disponible sur cet appareil' : 'Sharing is not available on this device'
        );
      }
    } catch (error) {
      console.error('[MyMixes] Share error:', error);
      Alert.alert(
        language === 'fr' ? 'Erreur' : 'Error',
        language === 'fr' ? 'Impossible de partager le fichier' : 'Unable to share file'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  // Delete mix
  const handleDelete = async (mix: LocalMix) => {
    Alert.alert(
      language === 'fr' ? 'Supprimer le mix ?' : 'Delete mix?',
      language === 'fr' 
        ? 'Cette action est irréversible' 
        : 'This action cannot be undone',
      [
        { text: language === 'fr' ? 'Annuler' : 'Cancel', style: 'cancel' },
        {
          text: language === 'fr' ? 'Supprimer' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Stop if playing
              if (playingId === mix.id && sound) {
                await sound.stopAsync();
                await sound.unloadAsync();
                setSound(null);
                setPlayingId(null);
              }

              // Remove from storage
              const storedMixes = await AsyncStorage.getItem(MIXES_STORAGE_KEY);
              let allMixes: LocalMix[] = storedMixes ? JSON.parse(storedMixes) : [];
              allMixes = allMixes.filter((m) => m.id !== mix.id);
              await AsyncStorage.setItem(MIXES_STORAGE_KEY, JSON.stringify(allMixes));
              
              // Update state
              setMixes((prev) => prev.filter((m) => m.id !== mix.id));
              
              // Try to delete the audio file
              if (mix.audio_url) {
                try {
                  await FileSystem.deleteAsync(mix.audio_url, { idempotent: true });
                } catch {
                  // Ignore file deletion errors
                }
              }
            } catch (error) {
              console.error('[MyMixes] Delete error:', error);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Mixes</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="time-outline" size={20} color={Colors.primary} />
        <Text style={styles.infoText}>
          {language === 'fr' 
            ? 'Les mixes sont disponibles pendant 24h après l\'enregistrement'
            : 'Mixes are available for 24 hours after recording'}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {mixes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="musical-notes-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {language === 'fr' ? 'Aucun mix' : 'No mixes'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {language === 'fr' 
                ? 'Vos enregistrements SPYN Record apparaîtront ici'
                : 'Your SPYN Record recordings will appear here'}
            </Text>
            <TouchableOpacity
              style={styles.recordButton}
              onPress={() => router.push('/(tabs)/spyn-record')}
            >
              <Ionicons name="mic" size={20} color="#fff" />
              <Text style={styles.recordButtonText}>
                {language === 'fr' ? 'Commencer un enregistrement' : 'Start Recording'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.mixList}>
            {mixes.map((mix) => {
              const isProcessing = downloadingId === mix.id;
              const isPlaying = playingId === mix.id;
              
              return (
                <View key={mix.id} style={styles.mixCard}>
                  {/* Mix Header */}
                  <View style={styles.mixHeader}>
                    {/* Play Button */}
                    <TouchableOpacity 
                      style={[styles.mixIcon, isPlaying && styles.mixIconPlaying]}
                      onPress={() => handlePlay(mix)}
                    >
                      <Ionicons 
                        name={isPlaying ? "pause" : "play"} 
                        size={24} 
                        color={isPlaying ? "#fff" : Colors.primary} 
                      />
                    </TouchableOpacity>
                    <View style={styles.mixInfo}>
                      <Text style={styles.mixVenue} numberOfLines={1}>
                        {mix.venue || (language === 'fr' ? 'Session SPYN' : 'SPYN Session')}
                      </Text>
                      <Text style={styles.mixLocation}>
                        {[mix.city, mix.country].filter(Boolean).join(', ') || '-'}
                      </Text>
                    </View>
                    <View style={styles.mixMeta}>
                      <Text style={styles.mixDuration}>{formatDuration(mix.duration)}</Text>
                      {mix.tracks_count !== undefined && (
                        <Text style={styles.mixTracks}>
                          {mix.tracks_count} {language === 'fr' ? 'tracks' : 'tracks'}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Mix Details */}
                  <View style={styles.mixDetails}>
                    <Text style={styles.mixDate}>{formatDate(mix.created_date)}</Text>
                    <Text style={styles.mixExpires}>{getTimeRemaining(mix.expires_at)}</Text>
                  </View>

                  {/* Actions */}
                  <View style={styles.mixActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.shareButton]}
                      onPress={() => handleShare(mix)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <>
                          <Ionicons name="share-outline" size={18} color={Colors.primary} />
                          <Text style={[styles.actionButtonText, { color: Colors.primary }]}>
                            {language === 'fr' ? 'Partager' : 'Share'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDelete(mix)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
                      <Text style={[styles.actionButtonText, { color: '#ff6b6b' }]}>
                        {language === 'fr' ? 'Supprimer' : 'Delete'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// Helper function to save a mix to local storage (called from spyn-record.tsx)
// IMPORTANT: This function now copies the audio file to documentDirectory (permanent storage)
export async function saveLocalMix(mix: Omit<LocalMix, 'id' | 'expires_at' | 'created_date'>): Promise<void> {
  try {
    console.log('[MyMixes] saveLocalMix called with:', JSON.stringify(mix, null, 2));
    
    // CRITICAL: Copy audio file from cache to permanent storage
    let permanentAudioUrl = mix.audio_url;
    
    if (mix.audio_url && (
      mix.audio_url.includes('cache') || 
      mix.audio_url.includes('Cache') ||
      mix.audio_url.includes('tmp') ||
      mix.audio_url.includes('Caches')
    )) {
      console.log('[MyMixes] Audio is in cache/tmp, copying to permanent storage...');
      
      const fileName = `spyn_mix_${Date.now()}.m4a`;
      const permanentDir = FileSystem.documentDirectory;
      
      if (permanentDir) {
        const permanentPath = `${permanentDir}${fileName}`;
        
        try {
          // Copy file to permanent storage
          await FileSystem.copyAsync({
            from: mix.audio_url,
            to: permanentPath,
          });
          
          permanentAudioUrl = permanentPath;
          console.log('[MyMixes] ✅ Audio copied to permanent storage:', permanentPath);
          
          // Verify the copy
          const fileInfo = await FileSystem.getInfoAsync(permanentPath);
          console.log('[MyMixes] File info after copy:', fileInfo);
        } catch (copyError) {
          console.error('[MyMixes] ❌ Failed to copy audio to permanent storage:', copyError);
          // Continue with original URL, but it might not work later
        }
      }
    } else {
      console.log('[MyMixes] Audio already in permanent location:', mix.audio_url);
    }
    
    const storedMixes = await AsyncStorage.getItem(MIXES_STORAGE_KEY);
    const allMixes: LocalMix[] = storedMixes ? JSON.parse(storedMixes) : [];
    
    const newMix: LocalMix = {
      ...mix,
      audio_url: permanentAudioUrl, // Use the permanent URL
      id: `mix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_date: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };
    
    allMixes.push(newMix);
    await AsyncStorage.setItem(MIXES_STORAGE_KEY, JSON.stringify(allMixes));
    
    console.log('[MyMixes] ✅ Mix saved locally:', newMix.id, 'audio_url:', newMix.audio_url);
  } catch (error) {
    console.error('[MyMixes] ❌ Error saving mix:', error);
    throw error; // Re-throw so caller knows it failed
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: Colors.backgroundCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  placeholder: {
    width: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary + '40',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.primary,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 24,
  },
  recordButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  mixList: {
    padding: 16,
    gap: 12,
  },
  mixCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  mixHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mixIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mixIconPlaying: {
    backgroundColor: Colors.primary,
  },
  mixInfo: {
    flex: 1,
  },
  mixVenue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  mixLocation: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  mixMeta: {
    alignItems: 'flex-end',
  },
  mixDuration: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  mixTracks: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  mixDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  mixDate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  mixExpires: {
    fontSize: 12,
    color: '#E8A87C',
    fontWeight: '500',
  },
  mixActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  shareButton: {
    backgroundColor: Colors.primary + '20',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  deleteButton: {
    backgroundColor: '#ff6b6b20',
    borderWidth: 1,
    borderColor: '#ff6b6b40',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
