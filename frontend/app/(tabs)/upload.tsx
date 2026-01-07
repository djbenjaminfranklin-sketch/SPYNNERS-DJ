import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import base44Api, { base44Tracks, base44Users, base44Files, Track, User } from '../../src/services/base44Api';

// Genre options - same as spynners.com
const GENRES = [
  'Afro House', 'Tech House', 'Deep House', 'Melodic House & Techno',
  'Progressive House', 'Minimal / Deep Tech', 'Bass House', 'Organic House',
  'Hard Techno', 'Techno (Peak Time)', 'Trance', 'Drum & Bass', 'Breakbeat',
  'Funky House', 'Jackin House', 'Soulful House', 'Disco House', 'Nu Disco',
  'Electronica', 'Downtempo', 'Ambient', 'UK Garage', 'Future House',
  'Big Room', 'Electro House', 'Tribal House', 'Latin House', 'Indie Dance',
  'Melodic Techno', 'Industrial Techno', 'Other'
];

// Energy levels
const ENERGY_LEVELS = [
  { value: 'low', labelKey: 'upload.energyLow', icon: '🌅' },
  { value: 'medium', labelKey: 'upload.energyMedium', icon: '🌊' },
  { value: 'high', labelKey: 'upload.energyHigh', icon: '🔥' },
  { value: 'very_high', labelKey: 'upload.energyVery', icon: '💥' },
];

// Mood keys for translation
const MOOD_KEYS = [
  { value: 'Energetic', labelKey: 'upload.moodEnergetic' },
  { value: 'Groovy', labelKey: 'upload.moodGroovy' },
  { value: 'Dark', labelKey: 'upload.moodDark' },
  { value: 'Uplifting', labelKey: 'upload.moodUplifting' },
  { value: 'Melodic', labelKey: 'upload.moodMelodic' },
  { value: 'Hypnotic', labelKey: 'upload.moodHypnotic' },
  { value: 'Funky', labelKey: 'upload.moodFunky' },
  { value: 'Deep', labelKey: 'upload.moodDeep' },
  { value: 'Atmospheric', labelKey: 'upload.moodAtmospheric' },
  { value: 'Driving', labelKey: 'upload.moodDriving' },
];

// Keys (Camelot)
const KEYS = [
  '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B',
  '7A', '7B', '8A', '8B', '9A', '9B', '10A', '10B', '11A', '11B', '12A', '12B'
];

export default function UploadScreen() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  
  // Form state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Upload for another user (producer/label)
  const [uploadForSearch, setUploadForSearch] = useState('');
  const [uploadForUser, setUploadForUser] = useState<User | null>(null);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Files
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<{ uri: string; name: string } | null>(null);
  
  // Track info
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [labelName, setLabelName] = useState('');
  const [collaborators, setCollaborators] = useState('');
  const [genres, setGenres] = useState<string[]>([]); // Multi-genre support
  const [bpm, setBpm] = useState('');
  const [trackKey, setTrackKey] = useState('');
  const [energyLevel, setEnergyLevel] = useState('');
  const [mood, setMood] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [isrcCode, setIsrcCode] = useState('');
  const [iswcCode, setIswcCode] = useState('');
  const [description, setDescription] = useState('');
  
  // Checkboxes
  const [isUnreleased, setIsUnreleased] = useState(false);
  const [isVipRequest, setIsVipRequest] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [freeDownloadAuthorized, setFreeDownloadAuthorized] = useState(false);
  
  // Dropdowns state
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [showKeyDropdown, setShowKeyDropdown] = useState(false);
  const [showEnergyDropdown, setShowEnergyDropdown] = useState(false);
  const [showMoodDropdown, setShowMoodDropdown] = useState(false);

  // Search for producers/labels
  const searchUsers = async (query: string) => {
    setUploadForSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    try {
      const results = await base44Users.searchProducersAndLabels(query);
      setSearchResults(results || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const selectUploadFor = (selectedUser: User) => {
    setUploadForUser(selectedUser);
    setUploadForSearch(selectedUser.full_name);
    setShowSearchResults(false);
  };

  // Pick cover image
  const pickCoverImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const base64 = result.assets[0].base64;
      setCoverImage(`data:image/jpeg;base64,${base64}`);
    }
  };

  // Pick audio file and extract metadata via backend
  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        // Check file size (max 40MB)
        if (file.size && file.size > 40 * 1024 * 1024) {
          Alert.alert('Error', 'File size must be less than 40MB');
          return;
        }
        setAudioFile({ uri: file.uri, name: file.name });
        
        // Try to extract title from filename as fallback
        if (!title && file.name) {
          const nameWithoutExt = file.name.replace(/\.(mp3|wav|m4a|aac)$/i, '');
          setTitle(nameWithoutExt);
        }
        
        // Try to extract metadata via backend API
        try {
          console.log('[Upload] Extracting metadata via backend...');
          
          // For web: fetch the file blob and send it
          if (Platform.OS === 'web') {
            const fileResponse = await fetch(file.uri);
            const blob = await fileResponse.blob();
            
            const formData = new FormData();
            formData.append('file', blob, file.name);
            
            const response = await fetch('/api/extract-mp3-metadata', {
              method: 'POST',
              body: formData,
            });
            
            if (response.ok) {
              const metadata = await response.json();
              console.log('[Upload] Extracted metadata:', metadata);
              
              // Auto-fill fields with extracted metadata
              if (metadata.title) {
                setTitle(metadata.title);
              }
              if (metadata.artist) {
                setArtistName(metadata.artist);
              }
              if (metadata.genre) {
                setGenre(metadata.genre);
              }
              if (metadata.bpm) {
                setBpm(metadata.bpm.toString());
              }
              if (metadata.cover_image) {
                setCoverImage(metadata.cover_image);
                Alert.alert('Info', t('upload.coverExtracted') || 'Cover art extracted from MP3 file');
              }
            } else {
              console.log('[Upload] Metadata extraction failed:', await response.text());
            }
          } else {
            // For native: use different approach
            const formData = new FormData();
            formData.append('file', {
              uri: file.uri,
              name: file.name,
              type: 'audio/mpeg',
            } as any);
            
            const response = await fetch('/api/extract-mp3-metadata', {
              method: 'POST',
              body: formData,
            });
            
            if (response.ok) {
              const metadata = await response.json();
              if (metadata.title) setTitle(metadata.title);
              if (metadata.artist) setArtistName(metadata.artist);
              if (metadata.genre) setGenre(metadata.genre);
              if (metadata.bpm) setBpm(metadata.bpm.toString());
              if (metadata.cover_image) {
                setCoverImage(metadata.cover_image);
                Alert.alert('Info', 'Cover art extracted from MP3 file');
              }
            }
          }
        } catch (metadataError) {
          console.log('[Upload] Metadata extraction failed:', metadataError);
          // Not critical, continue without metadata
        }
      }
    } catch (error) {
      console.error('Audio picker error:', error);
      Alert.alert('Error', 'Could not select audio file');
    }
  };

  // Submit track
  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a track title');
      return;
    }
    if (!artistName.trim()) {
      Alert.alert('Error', 'Please enter the artist name');
      return;
    }
    if (genres.length === 0) {
      Alert.alert('Error', 'Veuillez sélectionner au moins un genre');
      return;
    }
    if (!audioFile) {
      Alert.alert('Error', 'Please upload an audio file');
      return;
    }
    if (!rightsConfirmed) {
      Alert.alert('Error', 'Please confirm you have the rights to upload this track');
      return;
    }
    if (!freeDownloadAuthorized) {
      Alert.alert('Error', 'Please authorize free download for promotional purposes');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      let audioUrl = '';
      let artworkUrl = coverImage || '';
      
      // Step 1: Upload audio file to Base44
      setUploadProgress(10);
      console.log('[Upload] Uploading audio file:', audioFile.name);
      
      try {
        const audioUploadResult = await base44Files.upload(audioFile.uri, audioFile.name);
        audioUrl = audioUploadResult.file_url || audioUploadResult.url || '';
        console.log('[Upload] Audio uploaded, URL:', audioUrl);
      } catch (audioError) {
        console.error('[Upload] Audio upload error:', audioError);
        Alert.alert('Error', 'Failed to upload audio file. Please try again.');
        setUploading(false);
        return;
      }
      
      setUploadProgress(50);
      
      // Step 2: Upload cover image if provided (and not already a URL)
      if (coverImage && !coverImage.startsWith('http')) {
        try {
          console.log('[Upload] Uploading cover image...');
          const coverUploadResult = await base44Files.upload(coverImage, `cover_${Date.now()}.jpg`);
          artworkUrl = coverUploadResult.file_url || coverUploadResult.url || coverImage;
          console.log('[Upload] Cover uploaded, URL:', artworkUrl);
        } catch (coverError) {
          console.error('[Upload] Cover upload error:', coverError);
          // Continue without cover, not critical
        }
      }
      
      setUploadProgress(70);

      // Step 3: Prepare track data with audio URL
      const trackData: Track = {
        title: title.trim(),
        artist_name: artistName.trim(),
        producer_name: artistName.trim(),
        producer_id: uploadForUser?.id || user?.id,
        label_name: labelName.trim() || undefined,
        collaborators: collaborators ? collaborators.split(',').map(c => c.trim()) : [],
        genre: genres.join(', '), // Join multiple genres with comma
        genres: genres, // Also store as array for better querying
        bpm: bpm ? parseInt(bpm) : undefined,
        key: trackKey || undefined,
        energy_level: energyLevel || undefined,
        mood: mood || undefined,
        release_date: releaseDate || undefined,
        isrc_code: isrcCode.trim() || undefined,
        iswc_code: iswcCode.trim() || undefined,
        description: description.trim() || undefined,
        // IMPORTANT: Save audio and artwork URLs
        audio_url: audioUrl,
        artwork_url: artworkUrl,
        cover_image: artworkUrl,
        is_unreleased: isUnreleased,
        is_vip: isVipRequest,
        rights_confirmed: rightsConfirmed,
        free_download_authorized: freeDownloadAuthorized,
        uploaded_by: user?.id,
        uploaded_for: uploadForUser?.id || user?.id,
        status: 'pending',
        rating: 0,
        download_count: 0,
        play_count: 0,
      };

      console.log('[Upload] Creating track with data:', { 
        title: trackData.title, 
        audio_url: trackData.audio_url,
        artwork_url: trackData.artwork_url 
      });

      setUploadProgress(90);

      // Step 4: Create track in Base44
      const result = await base44Tracks.create(trackData);
      
      setUploadProgress(100);
      console.log('[Upload] Track created successfully:', result);

      Alert.alert(
        '✅ Track Uploaded!',
        'Your track has been submitted for review. You will be notified once it\'s approved.',
        [{ text: 'OK', onPress: resetForm }]
      );

    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert(
        'Upload Failed',
        error.response?.data?.message || 'Could not upload track. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setArtistName('');
    setLabelName('');
    setCollaborators('');
    setGenres([]);
    setBpm('');
    setTrackKey('');
    setEnergyLevel('');
    setMood('');
    setReleaseDate('');
    setIsrcCode('');
    setIswcCode('');
    setDescription('');
    setCoverImage(null);
    setAudioFile(null);
    setIsUnreleased(false);
    setIsVipRequest(false);
    setRightsConfirmed(false);
    setFreeDownloadAuthorized(false);
    setUploadForUser(null);
    setUploadForSearch('');
    setUploadProgress(0);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Ionicons name="cloud-upload" size={32} color={Colors.primary} />
            <Text style={styles.headerTitle}>{t('page.uploadTrack')}</Text>
            <Text style={styles.headerSubtitle}>{t('upload.shareMusic')}</Text>
          </View>
        </View>

        {/* Upload for another user */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('upload.uploadFor')}</Text>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('upload.searchProducer')}
              placeholderTextColor={Colors.textMuted}
              value={uploadForSearch}
              onChangeText={searchUsers}
            />
            {uploadForUser && (
              <TouchableOpacity onPress={() => { setUploadForUser(null); setUploadForSearch(''); }}>
                <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {showSearchResults && searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.slice(0, 5).map((u) => (
                <TouchableOpacity key={u.id || u._id} style={styles.searchResultItem} onPress={() => selectUploadFor(u)}>
                  <Ionicons name="person" size={16} color={Colors.primary} />
                  <Text style={styles.searchResultText}>{u.full_name}</Text>
                  <Text style={styles.searchResultType}>{u.user_type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Cover Image */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('upload.coverImage')}</Text>
          <TouchableOpacity style={styles.imageUpload} onPress={pickCoverImage}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.coverPreview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image" size={40} color={Colors.textMuted} />
                <Text style={styles.imagePlaceholderText}>{t('upload.selectCover')}</Text>
                <Text style={styles.imagePlaceholderHint}>{t('upload.squareFormat')}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Audio File */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('upload.audioFile')} *</Text>
          <TouchableOpacity style={styles.fileUpload} onPress={pickAudioFile}>
            <Ionicons name="musical-notes" size={24} color={audioFile ? Colors.primary : Colors.textMuted} />
            <View style={styles.fileInfo}>
              <Text style={[styles.fileName, audioFile && styles.fileNameSelected]}>
                {audioFile ? audioFile.name : t('upload.selectAudio')}
              </Text>
              <Text style={styles.fileHint}>Max 40MB</Text>
            </View>
            <Ionicons name="folder-open" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Track Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('upload.trackInfo')}</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('upload.title')} *</Text>
            <TextInput
              style={styles.input}
              placeholder={t('upload.title')}
              placeholderTextColor={Colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('upload.artistName')} *</Text>
            <TextInput
              style={styles.input}
              placeholder={t('upload.artistName')}
              placeholderTextColor={Colors.textMuted}
              value={artistName}
              onChangeText={setArtistName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('upload.labelName')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('upload.labelName')}
              placeholderTextColor={Colors.textMuted}
              value={labelName}
              onChangeText={setLabelName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('upload.collaborators')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('upload.collaborators')}
              placeholderTextColor={Colors.textMuted}
              value={collaborators}
              onChangeText={setCollaborators}
            />
          </View>
        </View>

        {/* Genre & Technical */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('upload.genreTech')}</Text>

          {/* Genre Dropdown - Multi-select */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('upload.genre')} * (max 3)</Text>
            <TouchableOpacity 
              style={styles.dropdown} 
              onPress={() => setShowGenreDropdown(!showGenreDropdown)}
            >
              <Text style={[styles.dropdownText, genres.length === 0 && styles.dropdownPlaceholder]}>
                {genres.length > 0 ? genres.join(', ') : t('upload.selectGenre')}
              </Text>
              <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
            
            {/* Selected genres as tags */}
            {genres.length > 0 && (
              <View style={styles.selectedGenresContainer}>
                {genres.map((g) => (
                  <TouchableOpacity 
                    key={g} 
                    style={styles.genreTag}
                    onPress={() => setGenres(genres.filter(genre => genre !== g))}
                  >
                    <Text style={styles.genreTagText}>{g}</Text>
                    <Ionicons name="close" size={14} color={Colors.text} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            
            {showGenreDropdown && (
              <View style={styles.dropdownList}>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  {GENRES.map((g) => {
                    const isSelected = genres.includes(g);
                    const isDisabled = !isSelected && genres.length >= 3;
                    return (
                      <TouchableOpacity 
                        key={g} 
                        style={[
                          styles.dropdownItem, 
                          isSelected && styles.dropdownItemSelected,
                          isDisabled && styles.dropdownItemDisabled
                        ]}
                        disabled={isDisabled}
                        onPress={() => {
                          if (isSelected) {
                            setGenres(genres.filter(genre => genre !== g));
                          } else if (genres.length < 3) {
                            setGenres([...genres, g]);
                          }
                        }}
                      >
                        <View style={styles.checkboxContainer}>
                          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                            {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                          </View>
                          <Text style={[
                            styles.dropdownItemText, 
                            isSelected && styles.dropdownItemTextSelected,
                            isDisabled && styles.dropdownItemTextDisabled
                          ]}>
                            {g}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity 
                  style={styles.closeDropdownButton}
                  onPress={() => setShowGenreDropdown(false)}
                >
                  <Text style={styles.closeDropdownText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* BPM & Key */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>{t('upload.bpm')}</Text>
              <TextInput
                style={styles.input}
                placeholder="125"
                placeholderTextColor={Colors.textMuted}
                value={bpm}
                onChangeText={setBpm}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.inputLabel}>{t('upload.key')}</Text>
              <TouchableOpacity 
                style={styles.dropdown} 
                onPress={() => setShowKeyDropdown(!showKeyDropdown)}
              >
                <Text style={[styles.dropdownText, !trackKey && styles.dropdownPlaceholder]}>
                  {trackKey || t('common.select')}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              {showKeyDropdown && (
                <View style={[styles.dropdownList, { maxHeight: 150 }]}>
                  <ScrollView nestedScrollEnabled>
                    {KEYS.map((k) => (
                      <TouchableOpacity 
                        key={k} 
                        style={[styles.dropdownItem, trackKey === k && styles.dropdownItemSelected]}
                        onPress={() => { setTrackKey(k); setShowKeyDropdown(false); }}
                      >
                        <Text style={styles.dropdownItemText}>{k}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          {/* Energy Level */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('upload.energyLevel')}</Text>
            <View style={styles.energyButtons}>
              {ENERGY_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.value}
                  style={[styles.energyButton, energyLevel === level.value && styles.energyButtonSelected]}
                  onPress={() => setEnergyLevel(level.value)}
                >
                  <Text style={styles.energyIcon}>{level.icon}</Text>
                  <Text style={[styles.energyLabel, energyLevel === level.value && styles.energyLabelSelected]}>
                    {t(level.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Mood */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('upload.mood')}</Text>
            <View style={styles.moodTags}>
              {MOOD_KEYS.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.moodTag, mood === m.value && styles.moodTagSelected]}
                  onPress={() => setMood(mood === m.value ? '' : m.value)}
                >
                  <Text style={[styles.moodTagText, mood === m.value && styles.moodTagTextSelected]}>{t(m.labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Additional Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('upload.additionalInfo')}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('upload.releaseDate')}</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              value={releaseDate}
              onChangeText={setReleaseDate}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>{t('upload.isrcCode')}</Text>
              <TextInput
                style={styles.input}
                placeholder="ISRC"
                placeholderTextColor={Colors.textMuted}
                value={isrcCode}
                onChangeText={setIsrcCode}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.inputLabel}>{t('upload.iswcCode')}</Text>
              <TextInput
                style={styles.input}
                placeholder="ISWC"
                placeholderTextColor={Colors.textMuted}
                value={iswcCode}
                onChangeText={setIswcCode}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('upload.description')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('upload.description')}
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('upload.options')}</Text>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>🆕 {t('upload.unreleased')}</Text>
              <Text style={styles.switchDescription}>{t('upload.unreleasedDesc')}</Text>
            </View>
            <Switch
              value={isUnreleased}
              onValueChange={setIsUnreleased}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>💎 {t('upload.vipRequest')}</Text>
              <Text style={styles.switchDescription}>{t('upload.vipRequestDesc')}</Text>
            </View>
            <Switch
              value={isVipRequest}
              onValueChange={setIsVipRequest}
              trackColor={{ false: Colors.border, true: '#FFD700' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('upload.legalAgreements')}</Text>

          <TouchableOpacity style={styles.checkboxRow} onPress={() => setRightsConfirmed(!rightsConfirmed)}>
            <View style={[styles.checkbox, rightsConfirmed && styles.checkboxChecked]}>
              {rightsConfirmed && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.checkboxLabel}>
              {t('upload.rightsConfirm')} *
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.checkboxRow} onPress={() => setFreeDownloadAuthorized(!freeDownloadAuthorized)}>
            <View style={[styles.checkbox, freeDownloadAuthorized && styles.checkboxChecked]}>
              {freeDownloadAuthorized && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.checkboxLabel}>
              {t('upload.freeDownload')} *
            </Text>
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={uploading}
        >
          {uploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.submitButtonText}>{t('upload.uploading')} {uploadProgress}%</Text>
            </View>
          ) : (
            <>
              <Ionicons name="cloud-upload" size={22} color="#fff" />
              <Text style={styles.submitButtonText}>{t('upload.submit')}</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  header: {
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { 
    position: 'absolute', 
    top: 50, 
    left: 16, 
    width: 40, 
    height: 40, 
    justifyContent: 'center', 
    alignItems: 'center',
    zIndex: 10,
  },
  headerContent: { alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginTop: 8 },
  headerSubtitle: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
  section: { padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: { flex: 1, height: 44, color: Colors.text, fontSize: 15 },
  searchResults: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchResultText: { flex: 1, color: Colors.text, fontSize: 14 },
  searchResultType: { color: Colors.textMuted, fontSize: 12 },
  imageUpload: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    aspectRatio: 1,
    maxHeight: 200,
  },
  coverPreview: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  imagePlaceholderText: { color: Colors.textMuted, marginTop: 8, fontSize: 14 },
  imagePlaceholderHint: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  fileUpload: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fileInfo: { flex: 1 },
  fileName: { color: Colors.textMuted, fontSize: 14 },
  fileNameSelected: { color: Colors.text, fontWeight: '500' },
  fileHint: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  inputGroup: { marginBottom: 14 },
  inputLabel: { color: Colors.textSecondary, fontSize: 13, marginBottom: 6, fontWeight: '500' },
  input: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dropdownText: { color: Colors.text, fontSize: 15 },
  dropdownPlaceholder: { color: Colors.textMuted },
  dropdownList: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
    overflow: 'hidden',
  },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownItemSelected: { backgroundColor: Colors.primary + '20' },
  dropdownItemText: { color: Colors.text, fontSize: 14 },
  dropdownItemTextSelected: { color: Colors.primary, fontWeight: '600' },
  energyButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  energyButton: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  energyButtonSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '20' },
  energyIcon: { fontSize: 20, marginBottom: 4 },
  energyLabel: { color: Colors.textMuted, fontSize: 11 },
  energyLabelSelected: { color: Colors.primary, fontWeight: '600' },
  moodTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  moodTagSelected: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  moodTagText: { color: Colors.textMuted, fontSize: 13 },
  moodTagTextSelected: { color: Colors.primary, fontWeight: '500' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  switchInfo: { flex: 1, marginRight: 12 },
  switchLabel: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  switchDescription: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 12 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxLabel: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 20 },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    gap: 10,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  uploadingContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  
  // Multi-genre styles
  selectedGenresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  genreTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  genreTagText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  dropdownItemDisabled: {
    opacity: 0.5,
  },
  dropdownItemTextDisabled: {
    color: Colors.textMuted,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  closeDropdownButton: {
    padding: 12,
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  closeDropdownText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
});
