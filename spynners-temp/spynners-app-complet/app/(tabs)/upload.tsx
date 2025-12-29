import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import LanguageSelector from '../../src/components/LanguageSelector';

// Genres from spynners.com
const GENRES = [
  'Afro House', 'Tech House', 'Deep House', 'Melodic House & Techno',
  'Progressive House', 'Minimal / Deep Tech', 'Bass House', 'Organic House',
  'Hard Techno', 'Techno (Peak Time)', 'Trance', 'Drum & Bass',
  'Breakbeat', 'Funky House', 'Jackin House', 'Soulful House',
  'Electro House', 'Future House', 'Tribal House', 'Latin House',
  'Disco House', 'Nu Disco', 'Indie Dance', 'Downtempo',
  'Ambient', 'Chill House', 'Lounge', 'Other'
];

const ENERGY_LEVELS = ['Low', 'Medium', 'High', 'Peak'];
const MOODS = ['Dark', 'Groovy', 'Uplifting', 'Euphoric', 'Melancholic', 'Energetic', 'Chill', 'Hypnotic'];
const KEYS = [
  '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B',
  '7A', '7B', '8A', '8B', '9A', '9B', '10A', '10B', '11A', '11B', '12A', '12B'
];

// Known SPYNNERS members (will be fetched from API)
const DEFAULT_MEMBERS = [
  'Benjamin Franklin', 'JR From Dallas', 'McLovin', 'Nicolas SPIGA',
  'Orkun Bozdemir', 'SABLE NØIR', 'dj Konik', 'Öde'
];

export default function UploadScreen() {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [audioFile, setAudioFile] = useState<any>(null);
  const [artworkFile, setArtworkFile] = useState<any>(null);
  const [spynnersMembers, setSpynnersMembers] = useState<string[]>(DEFAULT_MEMBERS);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [collaboratorInput, setCollaboratorInput] = useState('');
  const [label, setLabel] = useState('');
  const [genre, setGenre] = useState('');
  const [bpm, setBpm] = useState('');
  const [key, setKey] = useState('');
  const [energyLevel, setEnergyLevel] = useState('');
  const [mood, setMood] = useState('');
  const [description, setDescription] = useState('');
  const [isVip, setIsVip] = useState(false);
  const [isrcCode, setIsrcCode] = useState('');
  const [iswcCode, setIswcCode] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [copyright, setCopyright] = useState('');
  
  // Dropdown and suggestion states
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [showKeyDropdown, setShowKeyDropdown] = useState(false);
  const [showEnergyDropdown, setShowEnergyDropdown] = useState(false);
  const [showMoodDropdown, setShowMoodDropdown] = useState(false);
  const [showArtistSuggestions, setShowArtistSuggestions] = useState(false);
  const [showCollabSuggestions, setShowCollabSuggestions] = useState(false);
  const [filteredArtists, setFilteredArtists] = useState<string[]>([]);
  const [filteredCollabs, setFilteredCollabs] = useState<string[]>([]);

  const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL;

  useEffect(() => {
    fetchSpynnersMembers();
  }, []);

  const fetchSpynnersMembers = async () => {
  try {
    const extra = Constants.expoConfig?.extra as any;
    const appId: string | undefined = extra?.base44AppId;
    const apiKey: string | undefined = extra?.base44ApiKey;
    const configuredBase: string | undefined = extra?.base44ApiUrl;

    const bases = [
      configuredBase,
      'https://app.base44.com/api/apps',
      'https://api.base44.com/v1/apps',
    ].filter(Boolean) as string[];

    if (!appId || !apiKey) return;

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'x-api-key': apiKey,
      Accept: 'application/json',
    } as any;

    let responseData: any = null;

    for (const base of bases) {
      try {
        const url = `${base}/${appId}/entities/Track?limit=500`;
        const resp = await axios.get(url, { headers, timeout: 15000 });
        responseData = resp.data;
        break;
      } catch {
        // try next base
      }
    }

    const data = responseData?.data?.data || responseData?.data || responseData?.items || responseData || [];
    const tracks = Array.isArray(data) ? data : [];

    const members = new Set<string>();
    tracks.forEach((track: any) => {
      const a = track.artist || track.main_artist || track.author;
      if (a && typeof a === 'string') members.add(a);
    });

    if (members.size > 0) {
      setSpynnersMembers(Array.from(members).sort());
    }
  } catch {
    // keep UI stable
  }
};
  const handleArtistChange = (text: string) => {
    setArtist(text);
    if (text.length > 0) {
      const filtered = spynnersMembers.filter(m => 
        m.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredArtists(filtered);
      setShowArtistSuggestions(filtered.length > 0);
    } else {
      setShowArtistSuggestions(false);
    }
  };

  const selectArtist = (name: string) => {
    setArtist(name);
    setShowArtistSuggestions(false);
  };

  const handleCollabChange = (text: string) => {
    setCollaboratorInput(text);
    if (text.length > 0) {
      const filtered = spynnersMembers.filter(m => 
        m.toLowerCase().includes(text.toLowerCase()) &&
        !collaborators.includes(m)
      );
      setFilteredCollabs(filtered);
      setShowCollabSuggestions(filtered.length > 0 || text.length > 2);
    } else {
      setShowCollabSuggestions(false);
    }
  };

  const addCollaborator = (name: string) => {
    if (!collaborators.includes(name)) {
      setCollaborators([...collaborators, name]);
    }
    setCollaboratorInput('');
    setShowCollabSuggestions(false);
  };

  const handleCollabSubmit = () => {
    if (collaboratorInput.trim()) {
      const isMember = spynnersMembers.some(m => 
        m.toLowerCase() === collaboratorInput.toLowerCase()
      );
      
      if (isMember) {
        const member = spynnersMembers.find(m => 
          m.toLowerCase() === collaboratorInput.toLowerCase()
        );
        if (member) addCollaborator(member);
      } else {
        addCollaborator(`#${collaboratorInput.trim()}`);
      }
    }
  };

  const removeCollaborator = (name: string) => {
    setCollaborators(collaborators.filter(c => c !== name));
  };

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'audio/mpeg', 'audio/wav', 'audio/mp3'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        if (file.size && file.size > 120 * 1024 * 1024) {
          Alert.alert(t('fileTooLarge'), 'Maximum 120MB');
          return;
        }
        setAudioFile(file);
      }
    } catch (error) {
      Alert.alert(t('error'), 'Could not select file');
    }
  };

  const pickArtwork = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setArtworkFile(result.assets[0]);
      }
    } catch (error) {
      Alert.alert(t('error'), 'Could not select image');
    }
  };

  const validateForm = () => {
    if (!title.trim()) { Alert.alert(t('required'), t('enterTitle')); return false; }
    if (!artist.trim()) { Alert.alert(t('required'), t('enterArtist')); return false; }
    if (!genre) { Alert.alert(t('required'), t('selectAGenre')); return false; }
    if (!audioFile) { Alert.alert(t('required'), t('selectAudioFile')); return false; }
    return true;
  };

  const handleUpload = async () => {
    if (!validateForm()) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('artist', artist.trim());
      formData.append('genre', genre);
      formData.append('producer_name', user?.full_name || artist);
      
      if (collaborators.length > 0) formData.append('collaborators', JSON.stringify(collaborators));
      if (label) formData.append('label', label.trim());
      if (bpm) formData.append('bpm', bpm);
      if (key) formData.append('key', key);
      if (energyLevel) formData.append('energy_level', energyLevel);
      if (mood) formData.append('mood', mood);
      if (description) formData.append('description', description);
      if (isrcCode) formData.append('isrc_code', isrcCode.trim());
      if (iswcCode) formData.append('iswc_code', iswcCode.trim());
      if (releaseDate) formData.append('release_date', releaseDate);
      if (copyright) formData.append('copyright', copyright.trim());
      formData.append('is_vip', isVip.toString());

      // Handle file upload differently for web vs native
      if (audioFile) {
        if (Platform.OS === 'web') {
          // On web, fetch the file and convert to blob
          try {
            const audioResponse = await fetch(audioFile.uri);
            const audioBlob = await audioResponse.blob();
            formData.append('audio', audioBlob, audioFile.name || 'track.mp3');
          } catch (e) {
            console.log('Web audio blob creation failed, using uri:', e);
            formData.append('audio_url', audioFile.uri);
            formData.append('audio_name', audioFile.name || 'track.mp3');
          }
        } else {
          formData.append('audio', {
            uri: audioFile.uri,
            name: audioFile.name || 'track.mp3',
            type: audioFile.mimeType || 'audio/mpeg',
          } as any);
        }
      }

      if (artworkFile) {
        if (Platform.OS === 'web') {
          try {
            const artworkResponse = await fetch(artworkFile.uri);
            const artworkBlob = await artworkResponse.blob();
            formData.append('artwork', artworkBlob, 'artwork.jpg');
          } catch (e) {
            console.log('Web artwork blob creation failed:', e);
            formData.append('artwork_url', artworkFile.uri);
          }
        } else {
          formData.append('artwork', {
            uri: artworkFile.uri,
            name: 'artwork.jpg',
            type: 'image/jpeg',
          } as any);
        }
      }

      console.log('[Upload] Sending upload request...');
      const response = await axios.post(
        `${BACKEND_URL}/api/tracks/upload`,
        formData,
        {
          headers: { 
            'Content-Type': 'multipart/form-data', 
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          timeout: 120000,
        }
      );

      console.log('[Upload] Response:', response.data);
      if (response.data.success || response.status === 200 || response.status === 201) {
        const syncMessage = response.data.synced 
          ? 'Your track has been synced with spynners.com!' 
          : t('trackValidation');
        Alert.alert(t('uploadSuccess'), syncMessage, [{ text: t('ok'), onPress: resetForm }]);
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (error: any) {
      console.error('[Upload] Error:', error);
      Alert.alert(t('uploadFailed'), error.response?.data?.message || error.message || 'Try again later');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setTitle(''); setArtist(''); setCollaborators([]); setLabel('');
    setGenre(''); setBpm(''); setKey(''); setEnergyLevel('');
    setMood(''); setDescription(''); setIsVip(false);
    setIsrcCode(''); setIswcCode(''); setReleaseDate(''); setCopyright('');
    setAudioFile(null); setArtworkFile(null);
  };

  const renderDropdown = (
    items: string[], value: string, setValue: (v: string) => void,
    show: boolean, setShow: (v: boolean) => void, placeholder: string
  ) => (
    <View style={styles.dropdownContainer}>
      <TouchableOpacity style={styles.dropdownButton} onPress={() => setShow(!show)}>
        <Text style={[styles.dropdownButtonText, !value && styles.placeholder]}>{value || placeholder}</Text>
        <Ionicons name={show ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
      </TouchableOpacity>
      
      {show && (
        <View style={styles.dropdownList}>
          <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
            {items.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.dropdownItem, value === item && styles.dropdownItemSelected]}
                onPress={() => { setValue(item); setShow(false); }}
              >
                <Text style={[styles.dropdownItemText, value === item && styles.dropdownItemTextSelected]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>{t('uploadTrack')}</Text>
            <Text style={styles.headerSubtitle}>{t('shareWithDjs')}</Text>
          </View>
          <LanguageSelector />
        </View>
      </View>

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Audio File */}
        <Text style={styles.label}>{t('audioFile')} *</Text>
        <TouchableOpacity style={styles.fileButton} onPress={pickAudioFile}>
          <Ionicons name="musical-notes" size={24} color={Colors.primary} />
          <View style={styles.fileInfo}>
            {audioFile ? (
              <>
                <Text style={styles.fileName}>{audioFile.name}</Text>
                <Text style={styles.fileSize}>{audioFile.size ? `${(audioFile.size / 1024 / 1024).toFixed(2)} MB` : ''}</Text>
              </>
            ) : (
              <Text style={styles.filePlaceholder}>{t('mp3OrWav')}</Text>
            )}
          </View>
          <Ionicons name="cloud-upload" size={24} color={Colors.primary} />
        </TouchableOpacity>

        {/* Artwork */}
        <Text style={styles.label}>{t('artwork')}</Text>
        <TouchableOpacity style={styles.artworkButton} onPress={pickArtwork}>
          {artworkFile ? (
            <Image source={{ uri: artworkFile.uri }} style={styles.artworkPreview} />
          ) : (
            <View style={styles.artworkPlaceholder}>
              <Ionicons name="image" size={40} color={Colors.border} />
              <Text style={styles.artworkText}>{t('selectImage')}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.label}>{t('title')} *</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder={t('trackTitle')} placeholderTextColor={Colors.textMuted} />

        {/* Artist */}
        <Text style={styles.label}>{t('artist')} *</Text>
        <View style={styles.autocompleteContainer}>
          <TextInput
            style={styles.input}
            value={artist}
            onChangeText={handleArtistChange}
            placeholder={t('artistName')}
            placeholderTextColor={Colors.textMuted}
            onFocus={() => artist.length > 0 && setShowArtistSuggestions(filteredArtists.length > 0)}
          />
          {showArtistSuggestions && filteredArtists.length > 0 && (
            <View style={styles.suggestionsBox}>
              {filteredArtists.slice(0, 5).map((name, i) => (
                <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => selectArtist(name)}>
                  <Ionicons name="person" size={16} color={Colors.primary} />
                  <Text style={styles.suggestionText}>{name}</Text>
                  <Text style={styles.memberBadge}>SPYNNER</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Collaborators */}
        <Text style={styles.label}>{t('collaborators')}</Text>
        <View style={styles.autocompleteContainer}>
          <View style={styles.collabInputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={collaboratorInput}
              onChangeText={handleCollabChange}
              placeholder={t('addCollaborator')}
              placeholderTextColor={Colors.textMuted}
              onSubmitEditing={handleCollabSubmit}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addCollabButton} onPress={handleCollabSubmit}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {showCollabSuggestions && (
            <View style={styles.suggestionsBox}>
              {filteredCollabs.slice(0, 5).map((name, i) => (
                <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => addCollaborator(name)}>
                  <Ionicons name="person" size={16} color={Colors.primary} />
                  <Text style={styles.suggestionText}>{name}</Text>
                  <Text style={styles.memberBadge}>SPYNNER</Text>
                </TouchableOpacity>
              ))}
              {collaboratorInput.length > 2 && !filteredCollabs.some(c => c.toLowerCase() === collaboratorInput.toLowerCase()) && (
                <TouchableOpacity style={styles.suggestionItem} onPress={() => addCollaborator(`#${collaboratorInput}`)}>
                  <Ionicons name="pricetag" size={16} color={Colors.textMuted} />
                  <Text style={styles.suggestionText}>Add #{collaboratorInput}</Text>
                  <Text style={styles.hashtagBadge}>HASHTAG</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          
          {collaborators.length > 0 && (
            <View style={styles.collabTags}>
              {collaborators.map((collab, i) => (
                <View key={i} style={[styles.collabTag, collab.startsWith('#') && styles.hashtagTag]}>
                  <Text style={styles.collabTagText}>{collab}</Text>
                  <TouchableOpacity onPress={() => removeCollaborator(collab)}>
                    <Ionicons name="close-circle" size={18} color={collab.startsWith('#') ? Colors.textMuted : Colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Label */}
        <Text style={styles.label}>{t('label')}</Text>
        <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder={t('labelName')} placeholderTextColor={Colors.textMuted} />

        {/* Genre */}
        <Text style={styles.label}>{t('genre')} *</Text>
        {renderDropdown(GENRES, genre, setGenre, showGenreDropdown, setShowGenreDropdown, t('selectGenre'))}

        {/* BPM */}
        <Text style={styles.label}>{t('bpm')}</Text>
        <TextInput style={styles.input} value={bpm} onChangeText={setBpm} placeholder="ex: 128" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />

        {/* Key */}
        <Text style={styles.label}>{t('key')}</Text>
        {renderDropdown(KEYS, key, setKey, showKeyDropdown, setShowKeyDropdown, t('selectKey'))}

        {/* Energy Level */}
        <Text style={styles.label}>{t('energyLevel')}</Text>
        {renderDropdown(ENERGY_LEVELS, energyLevel, setEnergyLevel, showEnergyDropdown, setShowEnergyDropdown, t('select'))}

        {/* Mood */}
        <Text style={styles.label}>{t('mood')}</Text>
        {renderDropdown(MOODS, mood, setMood, showMoodDropdown, setShowMoodDropdown, t('select'))}

        {/* Description */}
        <Text style={styles.label}>{t('description')}</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder={t('trackDescription')} placeholderTextColor={Colors.textMuted} multiline numberOfLines={4} />

        {/* ISRC Code */}
        <Text style={styles.label}>Code ISRC</Text>
        <TextInput 
          style={styles.input} 
          value={isrcCode} 
          onChangeText={setIsrcCode} 
          placeholder="Ex: FR-AB1-23-45678" 
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="characters"
        />

        {/* ISWC Code */}
        <Text style={styles.label}>Code ISWC</Text>
        <TextInput 
          style={styles.input} 
          value={iswcCode} 
          onChangeText={setIswcCode} 
          placeholder="Ex: T-123456789-0" 
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="characters"
        />

        {/* Release Date */}
        <Text style={styles.label}>Date de sortie</Text>
        <TextInput 
          style={styles.input} 
          value={releaseDate} 
          onChangeText={setReleaseDate} 
          placeholder="YYYY-MM-DD" 
          placeholderTextColor={Colors.textMuted}
        />

        {/* Copyright */}
        <Text style={styles.label}>Copyright</Text>
        <TextInput 
          style={styles.input} 
          value={copyright} 
          onChangeText={setCopyright} 
          placeholder="Ex: © 2025 MonLabel" 
          placeholderTextColor={Colors.textMuted}
        />

        {/* VIP Toggle */}
        <TouchableOpacity style={styles.vipToggle} onPress={() => setIsVip(!isVip)}>
          <View style={styles.vipToggleLeft}>
            <Ionicons name="diamond" size={24} color={isVip ? '#FFD700' : Colors.textMuted} />
            <View>
              <Text style={styles.vipToggleTitle}>{t('vipToggleTitle')}</Text>
              <Text style={styles.vipToggleSubtitle}>{t('vipToggleSubtitle')}</Text>
            </View>
          </View>
          <View style={[styles.toggleSwitch, isVip && styles.toggleSwitchActive]}>
            <View style={[styles.toggleKnob, isVip && styles.toggleKnobActive]} />
          </View>
        </TouchableOpacity>

        {/* Sync Info */}
        <View style={styles.syncBox}>
          <Ionicons name="sync" size={20} color={Colors.primary} />
          <Text style={styles.syncText}>Tracks uploaded here will sync with spynners.com</Text>
        </View>

        {/* Upload Button */}
        <TouchableOpacity style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]} onPress={handleUpload} disabled={uploading}>
          {uploading ? (
            <><ActivityIndicator color="#fff" /><Text style={styles.uploadButtonText}>{t('uploading')}</Text></>
          ) : (
            <><Ionicons name="cloud-upload" size={24} color="#fff" /><Text style={styles.uploadButtonText}>{t('uploadTrack')}</Text></>
          )}
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>{t('validationInfo')}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, paddingTop: 60, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.borderAccent },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: Colors.primary },
  headerSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  form: { flex: 1, padding: Spacing.lg },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8, marginTop: 14 },
  input: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 15, color: Colors.text },
  textArea: { height: 90, textAlignVertical: 'top' },
  placeholder: { color: Colors.textMuted },
  fileButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderWidth: 2, borderColor: Colors.primary, borderStyle: 'dashed', borderRadius: BorderRadius.md, padding: Spacing.md, gap: 12 },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  fileSize: { fontSize: 12, color: Colors.textMuted },
  filePlaceholder: { fontSize: 14, color: Colors.textMuted },
  artworkButton: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, overflow: 'hidden', height: 140, justifyContent: 'center', alignItems: 'center' },
  artworkPreview: { width: '100%', height: '100%' },
  artworkPlaceholder: { alignItems: 'center', gap: 8 },
  artworkText: { fontSize: 13, color: Colors.textSecondary },
  autocompleteContainer: { position: 'relative', zIndex: 100 },
  collabInputRow: { flexDirection: 'row', gap: 8 },
  addCollabButton: { backgroundColor: Colors.primary, width: 48, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  suggestionsBox: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, marginTop: 4, zIndex: 1000, maxHeight: 200 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggestionText: { flex: 1, fontSize: 14, color: Colors.text },
  memberBadge: { fontSize: 9, color: Colors.primary, backgroundColor: Colors.primary + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: '600' },
  hashtagBadge: { fontSize: 9, color: Colors.textMuted, backgroundColor: Colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  collabTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  collabTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary + '20', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 6 },
  hashtagTag: { backgroundColor: Colors.border },
  collabTagText: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  dropdownContainer: { position: 'relative', zIndex: 50 },
  dropdownButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md },
  dropdownButtonText: { fontSize: 15, color: Colors.text },
  dropdownList: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, marginTop: 4, maxHeight: 180, zIndex: 1000 },
  dropdownScroll: { maxHeight: 180 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownItemSelected: { backgroundColor: Colors.primary + '20' },
  dropdownItemText: { fontSize: 14, color: Colors.text },
  dropdownItemTextSelected: { color: Colors.primary, fontWeight: '600' },
  vipToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: 14 },
  vipToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vipToggleTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  vipToggleSubtitle: { fontSize: 11, color: Colors.textMuted },
  toggleSwitch: { width: 48, height: 26, borderRadius: 13, backgroundColor: Colors.border, padding: 2 },
  toggleSwitchActive: { backgroundColor: '#FFD700' },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleKnobActive: { marginLeft: 22 },
  syncBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00C85320', borderRadius: BorderRadius.md, padding: Spacing.md, gap: 10, marginTop: 14 },
  syncText: { flex: 1, fontSize: 12, color: '#00C853', lineHeight: 18 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.lg, gap: 12, marginTop: 20 },
  uploadButtonDisabled: { opacity: 0.6 },
  uploadButtonText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.primary + '15', borderRadius: BorderRadius.md, padding: Spacing.md, gap: 10, marginTop: 14 },
  infoText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
});
