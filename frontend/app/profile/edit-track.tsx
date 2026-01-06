/**
 * Edit Track Screen
 * Allows users to edit their track metadata
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import axios from 'axios';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || 'https://dj-session-tracker.preview.emergentagent.com';

// Colors
const CYAN_COLOR = '#5CB3CC';
const DARK_BG = '#0a0a0a';
const CARD_BG = '#1a1a2e';
const GREEN_COLOR = '#4CAF50';

// Available genres
const GENRES = [
  'Afro House', 'Tech House', 'Deep House', 'Melodic House & Techno',
  'Progressive House', 'Minimal / Deep Tech', 'Bass House', 'Hard Techno',
  'Techno (Peak Time)', 'Funky House', 'Organic House', 'Tribal House',
  'Electro House', 'Future House', 'Disco House', 'Nu Disco',
  'Drum & Bass', 'Dubstep', 'Trance', 'Psy Trance',
];

// Energy levels
const ENERGY_LEVELS = ['Low', 'Medium', 'High', 'Very High'];

interface TrackData {
  id: string;
  title: string;
  genre?: string;
  bpm?: number;
  key?: string;
  energy_level?: string;
  description?: string;
  artwork_url?: string;
  isrc?: string;
  is_vip?: boolean;
}

export default function EditTrackScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user, token } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [track, setTrack] = useState<TrackData | null>(null);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [bpm, setBpm] = useState('');
  const [musicalKey, setMusicalKey] = useState('');
  const [energyLevel, setEnergyLevel] = useState('');
  const [description, setDescription] = useState('');
  const [isrc, setIsrc] = useState('');
  const [isVip, setIsVip] = useState(false);
  
  // Dropdowns
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [showEnergyDropdown, setShowEnergyDropdown] = useState(false);

  useEffect(() => {
    if (id) {
      loadTrack(id as string);
    }
  }, [id]);

  const loadTrack = async (trackId: string) => {
    try {
      setLoading(true);
      console.log('[EditTrack] Loading track:', trackId);
      
      // Use the new endpoint
      const response = await axios.get(
        `${BACKEND_URL}/api/tracks/${trackId}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      
      if (response.data) {
        const trackData = response.data;
        setTrack(trackData);
        
        // Populate form fields
        setTitle(trackData.title || '');
        setGenre(trackData.genre || '');
        setBpm(trackData.bpm?.toString() || '');
        setMusicalKey(trackData.key || '');
        setEnergyLevel(trackData.energy_level || '');
        setDescription(trackData.description || '');
        setIsrc(trackData.isrc || '');
        setIsVip(trackData.is_vip || false);
        
        console.log('[EditTrack] Track loaded:', trackData.title);
      }
    } catch (error: any) {
      console.error('[EditTrack] Error loading track:', error);
      Alert.alert('Error', 'Could not load track');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Track title is required');
      return;
    }

    setSaving(true);
    try {
      const updateData: any = {
        title: title.trim(),
      };
      
      if (genre) updateData.genre = genre;
      if (bpm) updateData.bpm = parseInt(bpm, 10);
      if (musicalKey) updateData.key = musicalKey;
      if (energyLevel) updateData.energy_level = energyLevel;
      if (description.trim()) updateData.description = description.trim();
      if (isrc.trim()) updateData.isrc = isrc.trim();
      updateData.is_vip = isVip;
      
      console.log('[EditTrack] Saving track:', updateData);
      
      // Use the new endpoint
      const response = await axios.put(
        `${BACKEND_URL}/api/tracks/${id}`,
        updateData,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      
      if (response.data) {
        Alert.alert('Success', 'Track updated successfully!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error: any) {
      console.error('[EditTrack] Save error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Could not save track');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={CYAN_COLOR} />
        <Text style={styles.loadingText}>Loading track...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Track</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
          {saving ? (
            <ActivityIndicator size="small" color={CYAN_COLOR} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Artwork Preview */}
        {track?.artwork_url && (
          <View style={styles.artworkContainer}>
            <Image source={{ uri: track.artwork_url }} style={styles.artwork} />
          </View>
        )}

        {/* Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Track Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Track title"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {/* Genre */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Genre</Text>
          <TouchableOpacity 
            style={styles.dropdown}
            onPress={() => setShowGenreDropdown(!showGenreDropdown)}
          >
            <Text style={genre ? styles.dropdownText : styles.dropdownPlaceholder}>
              {genre || 'Select genre'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          
          {showGenreDropdown && (
            <View style={styles.dropdownList}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {GENRES.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.dropdownItem, genre === g && styles.dropdownItemActive]}
                    onPress={() => {
                      setGenre(g);
                      setShowGenreDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, genre === g && styles.dropdownItemTextActive]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* BPM */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>BPM</Text>
          <TextInput
            style={styles.input}
            value={bpm}
            onChangeText={setBpm}
            placeholder="e.g., 128"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
          />
        </View>

        {/* Musical Key */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Musical Key</Text>
          <TextInput
            style={styles.input}
            value={musicalKey}
            onChangeText={setMusicalKey}
            placeholder="e.g., A minor"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {/* Energy Level */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Energy Level</Text>
          <TouchableOpacity 
            style={styles.dropdown}
            onPress={() => setShowEnergyDropdown(!showEnergyDropdown)}
          >
            <Text style={energyLevel ? styles.dropdownText : styles.dropdownPlaceholder}>
              {energyLevel || 'Select energy level'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          
          {showEnergyDropdown && (
            <View style={styles.dropdownList}>
              {ENERGY_LEVELS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[styles.dropdownItem, energyLevel === e && styles.dropdownItemActive]}
                  onPress={() => {
                    setEnergyLevel(e);
                    setShowEnergyDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, energyLevel === e && styles.dropdownItemTextActive]}>
                    {e}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Track description..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* ISRC */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>ISRC Code (optional)</Text>
          <TextInput
            style={styles.input}
            value={isrc}
            onChangeText={setIsrc}
            placeholder="e.g., USRC12345678"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
          />
        </View>

        {/* VIP Toggle */}
        <TouchableOpacity 
          style={styles.vipToggle}
          onPress={() => setIsVip(!isVip)}
        >
          <View style={styles.vipToggleLeft}>
            <Ionicons name="diamond" size={24} color={isVip ? '#FFD700' : Colors.textMuted} />
            <View>
              <Text style={styles.vipToggleLabel}>VIP Track</Text>
              <Text style={styles.vipToggleDesc}>Request VIP status for this track</Text>
            </View>
          </View>
          <View style={[styles.vipToggleSwitch, isVip && styles.vipToggleSwitchActive]}>
            <View style={[styles.vipToggleKnob, isVip && styles.vipToggleKnobActive]} />
          </View>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textMuted,
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: CARD_BG,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    color: CYAN_COLOR,
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  artworkContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  artwork: {
    width: 150,
    height: 150,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
  },
  dropdownText: {
    color: '#fff',
    fontSize: 16,
  },
  dropdownPlaceholder: {
    color: Colors.textMuted,
    fontSize: 16,
  },
  dropdownList: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CYAN_COLOR,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dropdownItemActive: {
    backgroundColor: CYAN_COLOR + '20',
  },
  dropdownItemText: {
    color: '#fff',
    fontSize: 14,
  },
  dropdownItemTextActive: {
    color: CYAN_COLOR,
    fontWeight: '600',
  },
  vipToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
  },
  vipToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vipToggleLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  vipToggleDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  vipToggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#333',
    justifyContent: 'center',
    padding: 3,
  },
  vipToggleSwitchActive: {
    backgroundColor: GREEN_COLOR,
  },
  vipToggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  vipToggleKnobActive: {
    alignSelf: 'flex-end',
  },
});
