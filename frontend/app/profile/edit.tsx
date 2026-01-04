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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';

// Genres from spynners.com
const GENRES = [
  // House
  'House', 'Afro House', 'Tech House', 'Deep House', 'Melodic House & Techno',
  'Progressive House', 'Minimal / Deep Tech', 'Bass House', 'Organic House',
  'Funky House', 'Jackin House', 'Soulful House', 'Electro House', 'Future House',
  'Tribal House', 'Latin House', 'Disco House', 'UK Garage',
  // Techno
  'Techno', 'Hard Techno', 'Techno (Peak Time)', 'Industrial Techno', 'Acid Techno',
  'Detroit Techno', 'Dub Techno', 'EBM',
  // Trance
  'Trance', 'Psy Trance', 'Progressive Trance', 'Uplifting Trance', 'Vocal Trance',
  // Bass Music
  'Drum & Bass', 'Jungle', 'Breakbeat', 'Dubstep', 'UK Bass',
  // Disco & Funk
  'Nu Disco', 'Disco', 'Indie Dance', 'Funk',
  // Electronic
  'Electronica', 'Downtempo', 'Ambient', 'Chillout', 'Lo-Fi',
  // Hip-Hop & R&B
  'Hip-Hop', 'R&B', 'Trap', 'Rap',
  // Pop & Dance
  'Pop', 'Dance Pop', 'EDM', 'Big Room',
  // Other
  'Reggaeton', 'Dancehall', 'Afrobeats', 'Amapiano', 'Zouk',
  'World Music', 'Jazz', 'Soul', 'Experimental',
];

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Profile Picture
  const [avatar, setAvatar] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  
  // Basic Info
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [djName, setDjName] = useState('');
  const [producerName, setProducerName] = useState('');
  const [labelName, setLabelName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  
  // Profile Type - DJ / Producer / Both / Label / Music Lover
  const [profileTypes, setProfileTypes] = useState<string[]>(['both']);
  
  // Toggle profile type (multi-select)
  const toggleProfileType = (type: string) => {
    setProfileTypes(prev => {
      if (prev.includes(type)) {
        // Remove if already selected (but keep at least one)
        const newTypes = prev.filter(t => t !== type);
        return newTypes.length > 0 ? newTypes : prev;
      } else {
        // Add the type
        return [...prev, type];
      }
    });
  };
  
  // Bio & Description
  const [bio, setBio] = useState('');
  const [tagline, setTagline] = useState('');
  
  // Location
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  
  // Genres - Multiple selection
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [showGenreSelector, setShowGenreSelector] = useState(false);
  
  // Producer-specific fields
  const [sacemNumber, setSacemNumber] = useState('');
  
  // Social Links
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [soundcloud, setSoundcloud] = useState('');
  const [mixcloud, setMixcloud] = useState('');
  const [spotify, setSpotify] = useState('');
  const [beatport, setBeatport] = useState('');
  const [youtube, setYoutube] = useState('');
  const [facebook, setFacebook] = useState('');
  const [twitter, setTwitter] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [bandcamp, setBandcamp] = useState('');
  const [residentAdvisor, setResidentAdvisor] = useState('');
  
  // Notification Preferences
  const [notifyNewTracks, setNotifyNewTracks] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyPlays, setNotifyPlays] = useState(true);
  const [notifyDownloads, setNotifyDownloads] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);

  const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL;

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      // Try to fetch profile from API
      const response = await axios.get(
        `${BACKEND_URL}/api/profile`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      ).catch(() => null);
      
      if (response?.data?.profile) {
        const p = response.data.profile;
        setFullName(p.full_name || user?.full_name || '');
        setDjName(p.dj_name || '');
        setProducerName(p.producer_name || '');
        setBio(p.bio || '');
        setTagline(p.tagline || '');
        setCity(p.city || '');
        setCountry(p.country || '');
        setSelectedGenres(p.genres || []);
        setIsDJ(p.is_dj ?? true);
        setIsProducer(p.is_producer ?? true);
        setWebsite(p.website || '');
        setInstagram(p.instagram || '');
        setSoundcloud(p.soundcloud || '');
        setMixcloud(p.mixcloud || '');
        setSpotify(p.spotify || '');
        setBeatport(p.beatport || '');
        setYoutube(p.youtube || '');
        setFacebook(p.facebook || '');
        setTwitter(p.twitter || '');
        setTiktok(p.tiktok || '');
        setBandcamp(p.bandcamp || '');
        setResidentAdvisor(p.resident_advisor || '');
        setAvatar(p.avatar || null);
        setCoverImage(p.cover_image || null);
      }
    } catch (error) {
      console.log('Could not load profile');
    } finally {
      setLoading(false);
    }
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatar(result.assets[0].uri);
    }
  };

  const pickCoverImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCoverImage(result.assets[0].uri);
    }
  };

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else {
      if (selectedGenres.length < 5) {
        setSelectedGenres([...selectedGenres, genre]);
      } else {
        Alert.alert('Limit', 'You can select up to 5 genres');
      }
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Full name is required');
      return;
    }

    setSaving(true);
    try {
      // Build profile data in the format expected by Spynners native API
      const profileData: any = {};
      
      // Map fields to the Spynners API format
      if (djName.trim() || producerName.trim() || fullName.trim()) {
        profileData.artist_name = djName.trim() || producerName.trim() || fullName.trim();
      }
      if (bio.trim()) {
        profileData.bio = bio.trim();
      }
      if (country.trim()) {
        profileData.nationality = country.trim();
      }
      if (instagram.trim()) {
        profileData.instagram = instagram.trim();
      }
      if (soundcloud.trim()) {
        profileData.soundcloud = soundcloud.trim();
      }
      if (sacemNumber.trim()) {
        profileData.sacem_number = sacemNumber.trim();
      }
      
      // Map profile type
      if (profileType === 'dj') {
        profileData.user_type = 'dj';
      } else if (profileType === 'producer') {
        profileData.user_type = 'producer';
      } else if (profileType === 'both') {
        profileData.user_type = 'both';
      } else if (profileType === 'label') {
        profileData.user_type = 'label';
      } else {
        profileData.user_type = 'music_lover';
      }

      console.log('[Profile] Saving with data:', profileData);

      const response = await axios.post(
        `${BACKEND_URL}/api/profile/update`,
        profileData,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (response.data.success) {
        Alert.alert('Success', 'Profile updated!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        throw new Error(response.data.message || 'Update failed');
      }
    } catch (error: any) {
      console.error('Save profile error:', error);
      Alert.alert('Error', error.response?.data?.detail || error.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('edit.title')}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <Text style={styles.saveButton}>{t('edit.saveChanges')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {fullName.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            <View style={styles.editAvatarButton}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Profile Type - Multi-select (DJ + Label, etc.) */}
        <Text style={styles.sectionTitle}>{t('edit.iAmA')} (multi-select)</Text>
        <View style={styles.profileTypeGrid}>
          <TouchableOpacity 
            style={[styles.profileTypeButton, profileTypes.includes('dj') && styles.profileTypeActive]}
            onPress={() => toggleProfileType('dj')}
          >
            <Ionicons name="headset" size={24} color={profileTypes.includes('dj') ? '#fff' : Colors.textMuted} />
            <Text style={[styles.profileTypeText, profileTypes.includes('dj') && styles.profileTypeTextActive]}>{t('edit.dj')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.profileTypeButton, profileTypes.includes('producer') && styles.profileTypeActive]}
            onPress={() => toggleProfileType('producer')}
          >
            <Ionicons name="musical-notes" size={24} color={profileTypes.includes('producer') ? '#fff' : Colors.textMuted} />
            <Text style={[styles.profileTypeText, profileTypes.includes('producer') && styles.profileTypeTextActive]}>{t('edit.producer')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.profileTypeButton, profileTypes.includes('both') && styles.profileTypeActive]}
            onPress={() => toggleProfileType('both')}
          >
            <Ionicons name="disc" size={24} color={profileTypes.includes('both') ? '#fff' : Colors.textMuted} />
            <Text style={[styles.profileTypeText, profileTypes.includes('both') && styles.profileTypeTextActive]}>{t('edit.both')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.profileTypeButton, profileTypes.includes('label') && styles.profileTypeActive]}
            onPress={() => toggleProfileType('label')}
          >
            <Ionicons name="business" size={24} color={profileTypes.includes('label') ? '#fff' : Colors.textMuted} />
            <Text style={[styles.profileTypeText, profileTypes.includes('label') && styles.profileTypeTextActive]}>{t('edit.label')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.profileTypeButton, profileTypes.includes('music_lover') && styles.profileTypeActive]}
            onPress={() => toggleProfileType('music_lover')}
          >
            <Ionicons name="heart" size={24} color={profileType === 'music_lover' ? '#fff' : Colors.textMuted} />
            <Text style={[styles.profileTypeText, profileType === 'music_lover' && styles.profileTypeTextActive]}>{t('edit.musicLover')}</Text>
          </TouchableOpacity>
        </View>

        {/* Basic Info */}
        <Text style={styles.sectionTitle}>{t('edit.basicInfo')}</Text>
        
        <Text style={styles.label}>{t('edit.fullName')} *</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder={t('edit.fullName')}
          placeholderTextColor={Colors.textMuted}
        />

        {/* Show DJ Name only for DJ or Both */}
        {(profileType === 'dj' || profileType === 'both') && (
          <>
            <Text style={styles.label}>{t('edit.djName')}</Text>
        <TextInput
          style={styles.input}
          value={djName}
          onChangeText={setDjName}
          placeholder={t('edit.djName')}
          placeholderTextColor={Colors.textMuted}
        />
          </>
        )}

        {/* Show Producer Name only for Producer or Both */}
        {(profileType === 'producer' || profileType === 'both') && (
          <>
            <Text style={styles.label}>{t('edit.producerName')}</Text>
            <TextInput
              style={styles.input}
              value={producerName}
              onChangeText={setProducerName}
              placeholder="Producer alias (if different)"
              placeholderTextColor={Colors.textMuted}
            />

            {/* SACEM Number for producers */}
            <Text style={styles.label}>N° Sociétaire SACEM (optionnel)</Text>
            <TextInput
              style={styles.input}
              value={sacemNumber}
              onChangeText={setSacemNumber}
              placeholder="Ex: 123456789"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />
          </>
        )}

        {/* Show Label Name only for Label */}
        {profileType === 'label' && (
          <>
            <Text style={styles.label}>Label Name *</Text>
            <TextInput
              style={styles.input}
              value={labelName}
              onChangeText={setLabelName}
              placeholder="Your label name"
              placeholderTextColor={Colors.textMuted}
            />
          </>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={Colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Phone (optional)</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+33 6 12 34 56 78"
          placeholderTextColor={Colors.textMuted}
          keyboardType="phone-pad"
        />

        {/* Tagline & Bio */}
        <Text style={styles.sectionTitle}>About You</Text>

        <Text style={styles.label}>Tagline</Text>
        <TextInput
          style={styles.input}
          value={tagline}
          onChangeText={setTagline}
          placeholder="Short tagline (e.g., 'Tech House DJ from Paris')"
          placeholderTextColor={Colors.textMuted}
          maxLength={80}
        />
        <Text style={styles.charCount}>{tagline.length}/80</Text>

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={bio}
          onChangeText={setBio}
          placeholder="Tell us about yourself, your music journey, influences..."
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={5}
          maxLength={500}
        />
        <Text style={styles.charCount}>{bio.length}/500</Text>

        {/* Location */}
        <Text style={styles.sectionTitle}>Location</Text>
        
        <View style={styles.rowInputs}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Paris"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Country</Text>
            <TextInput
              style={styles.input}
              value={country}
              onChangeText={setCountry}
              placeholder="France"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>

        {/* Genres */}
        <Text style={styles.sectionTitle}>Favorite Genres</Text>
        <Text style={styles.sectionSubtitle}>Select up to 5 genres</Text>
        
        <TouchableOpacity 
          style={styles.genreSelector}
          onPress={() => setShowGenreSelector(!showGenreSelector)}
        >
          <Text style={styles.genreSelectorText}>
            {selectedGenres.length > 0 
              ? `${selectedGenres.length} genres selected` 
              : 'Select your genres'}
          </Text>
          <Ionicons name={showGenreSelector ? "chevron-up" : "chevron-down"} size={20} color={Colors.textMuted} />
        </TouchableOpacity>

        {selectedGenres.length > 0 && (
          <View style={styles.selectedGenres}>
            {selectedGenres.map((genre, i) => (
              <View key={i} style={styles.genreTag}>
                <Text style={styles.genreTagText}>{genre}</Text>
                <TouchableOpacity onPress={() => toggleGenre(genre)}>
                  <Ionicons name="close-circle" size={18} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {showGenreSelector && (
          <View style={styles.genreList}>
            {GENRES.map((genre, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.genreOption, selectedGenres.includes(genre) && styles.genreOptionSelected]}
                onPress={() => toggleGenre(genre)}
              >
                <Text style={[styles.genreOptionText, selectedGenres.includes(genre) && styles.genreOptionTextSelected]}>
                  {genre}
                </Text>
                {selectedGenres.includes(genre) && (
                  <Ionicons name="checkmark" size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Social Links */}
        <Text style={styles.sectionTitle}>Social Links</Text>
        <Text style={styles.sectionSubtitle}>Connect your profiles</Text>

        <View style={styles.socialInput}>
          <Ionicons name="globe-outline" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.socialInputText}
            value={website}
            onChangeText={setWebsite}
            placeholder="Website URL"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.socialInput}>
          <Ionicons name="logo-instagram" size={20} color="#E4405F" />
          <TextInput
            style={styles.socialInputText}
            value={instagram}
            onChangeText={setInstagram}
            placeholder="Instagram username"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.socialInput}>
          <Ionicons name="logo-soundcloud" size={20} color="#FF5500" />
          <TextInput
            style={styles.socialInputText}
            value={soundcloud}
            onChangeText={setSoundcloud}
            placeholder="SoundCloud URL"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.socialInput}>
          <Ionicons name="musical-notes" size={20} color="#52AAD8" />
          <TextInput
            style={styles.socialInputText}
            value={mixcloud}
            onChangeText={setMixcloud}
            placeholder="Mixcloud URL"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.socialInput}>
          <Ionicons name="logo-spotify" size={20} color="#1DB954" />
          <TextInput
            style={styles.socialInputText}
            value={spotify}
            onChangeText={setSpotify}
            placeholder="Spotify artist URL"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.socialInput}>
          <Ionicons name="disc" size={20} color="#94D500" />
          <TextInput
            style={styles.socialInputText}
            value={beatport}
            onChangeText={setBeatport}
            placeholder="Beatport artist URL"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.socialInput}>
          <Ionicons name="logo-youtube" size={20} color="#FF0000" />
          <TextInput
            style={styles.socialInputText}
            value={youtube}
            onChangeText={setYoutube}
            placeholder="YouTube channel URL"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.socialInput}>
          <Ionicons name="logo-facebook" size={20} color="#1877F2" />
          <TextInput
            style={styles.socialInputText}
            value={facebook}
            onChangeText={setFacebook}
            placeholder="Facebook page URL"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.socialInput}>
          <Ionicons name="logo-twitter" size={20} color="#1DA1F2" />
          <TextInput
            style={styles.socialInputText}
            value={twitter}
            onChangeText={setTwitter}
            placeholder="Twitter/X username"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.socialInput}>
          <Ionicons name="logo-tiktok" size={20} color={Colors.text} />
          <TextInput
            style={styles.socialInputText}
            value={tiktok}
            onChangeText={setTiktok}
            placeholder="TikTok username"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.socialInput}>
          <Ionicons name="disc-outline" size={20} color="#629AA9" />
          <TextInput
            style={styles.socialInputText}
            value={bandcamp}
            onChangeText={setBandcamp}
            placeholder="Bandcamp URL"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.socialInput}>
          <Ionicons name="radio" size={20} color={Colors.primary} />
          <TextInput
            style={styles.socialInputText}
            value={residentAdvisor}
            onChangeText={setResidentAdvisor}
            placeholder="Resident Advisor URL"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />
        </View>

        {/* Notifications */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        
        <View style={styles.notificationRow}>
          <View style={styles.notificationInfo}>
            <Text style={styles.notificationLabel}>New tracks in my genres</Text>
            <Text style={styles.notificationDesc}>Get notified when new tracks are uploaded</Text>
          </View>
          <Switch
            value={notifyNewTracks}
            onValueChange={setNotifyNewTracks}
            trackColor={{ false: Colors.border, true: Colors.primary + '60' }}
            thumbColor={notifyNewTracks ? Colors.primary : Colors.textMuted}
          />
        </View>

        <View style={styles.notificationRow}>
          <View style={styles.notificationInfo}>
            <Text style={styles.notificationLabel}>Messages</Text>
            <Text style={styles.notificationDesc}>Receive chat message notifications</Text>
          </View>
          <Switch
            value={notifyMessages}
            onValueChange={setNotifyMessages}
            trackColor={{ false: Colors.border, true: Colors.primary + '60' }}
            thumbColor={notifyMessages ? Colors.primary : Colors.textMuted}
          />
        </View>

        <View style={styles.notificationRow}>
          <View style={styles.notificationInfo}>
            <Text style={styles.notificationLabel}>Track plays</Text>
            <Text style={styles.notificationDesc}>When DJs play your tracks</Text>
          </View>
          <Switch
            value={notifyPlays}
            onValueChange={setNotifyPlays}
            trackColor={{ false: Colors.border, true: Colors.primary + '60' }}
            thumbColor={notifyPlays ? Colors.primary : Colors.textMuted}
          />
        </View>

        <View style={styles.notificationRow}>
          <View style={styles.notificationInfo}>
            <Text style={styles.notificationLabel}>Downloads</Text>
            <Text style={styles.notificationDesc}>When DJs download your tracks</Text>
          </View>
          <Switch
            value={notifyDownloads}
            onValueChange={setNotifyDownloads}
            trackColor={{ false: Colors.border, true: Colors.primary + '60' }}
            thumbColor={notifyDownloads ? Colors.primary : Colors.textMuted}
          />
        </View>

        <View style={styles.notificationRow}>
          <View style={styles.notificationInfo}>
            <Text style={styles.notificationLabel}>Weekly email digest</Text>
            <Text style={styles.notificationDesc}>Summary of your activity</Text>
          </View>
          <Switch
            value={emailDigest}
            onValueChange={setEmailDigest}
            trackColor={{ false: Colors.border, true: Colors.primary + '60' }}
            thumbColor={emailDigest ? Colors.primary : Colors.textMuted}
          />
        </View>

        {/* Sync indicator */}
        <View style={styles.syncInfo}>
          <Ionicons name="sync" size={16} color={Colors.primary} />
          <Text style={styles.syncInfoText}>Changes sync with spynners.com</Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: Spacing.md, color: Colors.textSecondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md, paddingTop: 50,
    backgroundColor: Colors.backgroundCard,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: Colors.text },
  saveButton: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  content: { flex: 1 },
  
  // Cover
  coverSection: { height: 120, backgroundColor: Colors.backgroundCard, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.backgroundInput },
  coverText: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  coverEditButton: { position: 'absolute', bottom: 10, right: 10, backgroundColor: Colors.primary, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  
  // Avatar
  avatarSection: { alignItems: 'center', marginTop: -40, marginBottom: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: Colors.background },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: Colors.background },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  editAvatarButton: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.primary, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.background },
  
  // Profile Type
  profileTypeRow: { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  profileTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  profileTypeButton: { minWidth: '30%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border },
  profileTypeActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  profileTypeText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, textAlign: 'center' },
  profileTypeTextActive: { color: '#fff' },
  
  // Sections
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.primary, marginTop: 24, marginBottom: 8, paddingHorizontal: Spacing.lg },
  sectionSubtitle: { fontSize: 13, color: Colors.textMuted, paddingHorizontal: Spacing.lg, marginBottom: 12 },
  
  // Inputs
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8, marginTop: 12, paddingHorizontal: Spacing.lg },
  input: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 16, color: Colors.text, marginHorizontal: Spacing.lg },
  inputDisabled: { backgroundColor: Colors.border, color: Colors.textMuted },
  textArea: { height: 120, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: Colors.textMuted, textAlign: 'right', marginRight: Spacing.lg, marginTop: 4 },
  
  rowInputs: { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.lg },
  halfInput: { flex: 1 },
  
  // Genres
  genreSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, marginHorizontal: Spacing.lg },
  genreSelectorText: { fontSize: 15, color: Colors.textMuted },
  selectedGenres: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingHorizontal: Spacing.lg },
  genreTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary + '20', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 6 },
  genreTagText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  genreList: { marginTop: 12, marginHorizontal: Spacing.lg, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, maxHeight: 300 },
  genreOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  genreOptionSelected: { backgroundColor: Colors.primary + '10' },
  genreOptionText: { fontSize: 14, color: Colors.text },
  genreOptionTextSelected: { color: Colors.primary, fontWeight: '600' },
  
  // Social
  socialInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, gap: 10 },
  socialInputText: { flex: 1, height: 48, fontSize: 15, color: Colors.text },
  
  // Notifications
  notificationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  notificationInfo: { flex: 1, marginRight: Spacing.md },
  notificationLabel: { fontSize: 15, fontWeight: '500', color: Colors.text },
  notificationDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  
  // Sync
  syncInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, paddingVertical: Spacing.md, backgroundColor: Colors.primary + '10', marginHorizontal: Spacing.lg, borderRadius: BorderRadius.md },
  syncInfoText: { fontSize: 13, color: Colors.primary },
});
