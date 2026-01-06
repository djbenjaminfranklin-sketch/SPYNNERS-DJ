import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { isUserAdmin } from '../../src/components/AdminBadge';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Available genres
const GENRES = [
  'Tech House', 'Deep House', 'Progressive House', 'Melodic Techno', 
  'Techno', 'Minimal', 'Afro House', 'Organic House', 'House',
  'Electronic', 'Dance', 'EDM', 'Trance', 'Drum & Bass', 'Dubstep'
];

type VIPTrack = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  bpm?: number;
  artwork_url?: string;
  download_count?: number;
  is_vip: boolean;
  price?: number;
};

export default function AdminVIP() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [vipTracks, setVipTracks] = useState<VIPTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Upload VIP Track Modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  
  // Form fields for new VIP track
  const [trackTitle, setTrackTitle] = useState('');
  const [trackArtist, setTrackArtist] = useState('');
  const [trackDescription, setTrackDescription] = useState('');
  const [trackGenre, setTrackGenre] = useState('');
  const [trackBpm, setTrackBpm] = useState('');
  const [trackPrice, setTrackPrice] = useState('2');
  const [trackStock, setTrackStock] = useState('-1');
  const [previewStart, setPreviewStart] = useState('0');
  const [previewEnd, setPreviewEnd] = useState('30');
  const [showGenrePicker, setShowGenrePicker] = useState(false);
  
  // File selections
  const [audioFile, setAudioFile] = useState<any>(null);
  const [imageFile, setImageFile] = useState<any>(null);

  const isAdmin = isUserAdmin(user);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    try {
      const tracksRes = await axios.get(`${BACKEND_URL}/api/admin/tracks?limit=500`, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => ({ data: { tracks: [] } }));
      
      // Filter VIP tracks
      if (tracksRes.data?.success && tracksRes.data?.tracks) {
        const allTracks = tracksRes.data.tracks;
        const vip = allTracks.filter((t: any) => t.is_vip === true).map((t: any) => ({
          id: t.id || t._id,
          title: t.title,
          artist: t.artist_name || t.producer_name,
          genre: t.genre || 'Unknown',
          bpm: t.bpm,
          artwork_url: t.artwork_url,
          download_count: t.download_count || 0,
          is_vip: true,
          price: t.vip_price || 2,
        }));
        setVipTracks(vip);
        console.log('[AdminVIP] Loaded', vip.length, 'VIP tracks');
      }
    } catch (error) {
      console.error('[AdminVIP] Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a'],
        copyToCacheDirectory: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setAudioFile(file);
        console.log('[AdminVIP] Audio file selected:', file.name);
      }
    } catch (error) {
      console.error('[AdminVIP] Audio pick error:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner le fichier audio');
    }
  };

  const pickImageFile = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setImageFile(file);
        console.log('[AdminVIP] Image selected:', file.uri);
      }
    } catch (error) {
      console.error('[AdminVIP] Image pick error:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
    }
  };

  const resetForm = () => {
    setTrackTitle('');
    setTrackArtist('');
    setTrackDescription('');
    setTrackGenre('');
    setTrackBpm('');
    setTrackPrice('2');
    setTrackStock('-1');
    setPreviewStart('0');
    setPreviewEnd('30');
    setAudioFile(null);
    setImageFile(null);
  };

  const uploadVIPTrack = async () => {
    // Validation
    if (!trackTitle.trim()) {
      Alert.alert('Erreur', 'Le titre est requis');
      return;
    }
    if (!audioFile) {
      Alert.alert('Erreur', 'Veuillez sélectionner un fichier audio');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus('Préparation...');
    
    try {
      // Create FormData for upload
      const formData = new FormData();
      formData.append('title', trackTitle.trim());
      formData.append('artist', trackArtist.trim() || user?.full_name || 'Unknown Artist');
      formData.append('description', trackDescription.trim());
      formData.append('genre', trackGenre || 'Electronic');
      formData.append('bpm', trackBpm || '0');
      formData.append('is_vip', 'true');
      formData.append('vip_price', trackPrice || '2');
      formData.append('vip_stock', trackStock || '-1');
      formData.append('preview_start', previewStart || '0');
      formData.append('preview_end', previewEnd || '30');
      
      setUploadProgress(10);
      setUploadStatus('Préparation audio...');
      
      // Add audio file
      if (Platform.OS === 'web') {
        // Web: fetch the file and create blob
        const audioResponse = await fetch(audioFile.uri);
        const audioBlob = await audioResponse.blob();
        formData.append('audio', audioBlob, audioFile.name || 'track.mp3');
      } else {
        // Native: use uri directly
        formData.append('audio', {
          uri: audioFile.uri,
          type: audioFile.mimeType || 'audio/mpeg',
          name: audioFile.name || 'track.mp3',
        } as any);
      }
      
      setUploadProgress(20);
      
      // Add image file if selected
      if (imageFile) {
        setUploadStatus('Préparation image...');
        if (Platform.OS === 'web') {
          const imageResponse = await fetch(imageFile.uri);
          const imageBlob = await imageResponse.blob();
          formData.append('image', imageBlob, 'artwork.jpg');
        } else {
          formData.append('image', {
            uri: imageFile.uri,
            type: 'image/jpeg',
            name: 'artwork.jpg',
          } as any);
        }
      }

      setUploadProgress(30);
      setUploadStatus('Upload en cours...');
      console.log('[AdminVIP] Uploading VIP track:', trackTitle);
      
      // Simulate progress during upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev < 90) return prev + 10;
          return prev;
        });
      }, 500);
      
      const response = await axios.post(
        `${BACKEND_URL}/api/admin/upload-vip-track`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          timeout: 120000, // 2 minutes timeout for upload
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 70) / progressEvent.total) + 30;
              setUploadProgress(percentCompleted);
              if (percentCompleted < 50) {
                setUploadStatus('Upload audio...');
              } else if (percentCompleted < 80) {
                setUploadStatus('Upload image...');
              } else {
                setUploadStatus('Création du track...');
              }
            }
          },
        }
      );
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus('Terminé !');

      if (response.data?.success) {
        Alert.alert('Succès ✅', 'Track V.I.P. uploadé avec succès!\n\nIl apparaîtra dans les tracks à valider.');
        setShowUploadModal(false);
        resetForm();
        loadData();
      } else {
        Alert.alert('Erreur', response.data?.message || 'Échec de l\'upload');
      }
    } catch (error: any) {
      console.error('[AdminVIP] Upload error:', error);
      Alert.alert('Erreur', error?.response?.data?.detail || 'Échec de l\'upload du track');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="lock-closed" size={64} color={Colors.textMuted} />
        <Text style={styles.accessDeniedTitle}>Accès Refusé</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#E040FB" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerIcon}>
          <Ionicons name="diamond" size={24} color="#E040FB" />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>V.I.P. Management</Text>
          <Text style={styles.headerSubtitle}>{vipTracks.length} tracks V.I.P.</Text>
        </View>
        <TouchableOpacity 
          style={styles.addTrackBtn}
          onPress={() => setShowUploadModal(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addTrackBtnText}>Track V.I.P.</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E040FB" />}
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="diamond" size={24} color="#E040FB" />
            <Text style={styles.statValue}>{vipTracks.length}</Text>
            <Text style={styles.statLabel}>Tracks V.I.P.</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="download" size={24} color="#4CAF50" />
            <Text style={styles.statValue}>{vipTracks.reduce((sum, t) => sum + (t.download_count || 0), 0)}</Text>
            <Text style={styles.statLabel}>Téléchargements</Text>
          </View>
        </View>

        {/* VIP Tracks Grid */}
        {vipTracks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="diamond-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Aucun track V.I.P.</Text>
            <Text style={styles.emptySubtitle}>Cliquez sur "+ Track V.I.P." pour ajouter votre premier track</Text>
          </View>
        ) : (
          <View style={styles.trackGrid}>
            {vipTracks.map((track) => (
              <View key={track.id} style={styles.trackCard}>
                <View style={styles.vipBadge}>
                  <Ionicons name="diamond" size={10} color="#fff" />
                  <Text style={styles.vipBadgeText}>V.I.P.</Text>
                </View>
                {track.artwork_url ? (
                  <Image source={{ uri: track.artwork_url }} style={styles.trackImage} />
                ) : (
                  <View style={styles.trackImagePlaceholder}>
                    <Ionicons name="musical-notes" size={40} color={Colors.textMuted} />
                  </View>
                )}
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                  <Text style={styles.trackGenre}>{track.genre}</Text>
                  <View style={styles.trackMeta}>
                    {track.bpm && <Text style={styles.trackBpm}>{track.bpm} BPM</Text>}
                    <View style={styles.trackPriceTag}>
                      <Ionicons name="diamond" size={10} color="#E040FB" />
                      <Text style={styles.trackPrice}>{track.price || 2}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Upload VIP Track Modal */}
      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Ionicons name="diamond" size={24} color="#E040FB" />
                  <Text style={styles.modalTitle}>Ajouter un Track V.I.P.</Text>
                </View>
                <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>

              {/* Title */}
              <Text style={styles.modalLabel}>Titre *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nom du track"
                placeholderTextColor={Colors.textMuted}
                value={trackTitle}
                onChangeText={setTrackTitle}
              />

              {/* Artist */}
              <Text style={styles.modalLabel}>Artiste / Producteur</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={user?.full_name || "Nom de l'artiste"}
                placeholderTextColor={Colors.textMuted}
                value={trackArtist}
                onChangeText={setTrackArtist}
              />

              {/* Description */}
              <Text style={styles.modalLabel}>Description</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextarea]}
                placeholder="Description du track..."
                placeholderTextColor={Colors.textMuted}
                value={trackDescription}
                onChangeText={setTrackDescription}
                multiline
                textAlignVertical="top"
              />

              {/* Genre */}
              <Text style={styles.modalLabel}>Genre</Text>
              <TouchableOpacity 
                style={styles.genreSelector}
                onPress={() => setShowGenrePicker(!showGenrePicker)}
              >
                <Text style={[styles.genreSelectorText, !trackGenre && { color: Colors.textMuted }]}>
                  {trackGenre || 'Sélectionner un genre'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
              
              {showGenrePicker && (
                <View style={styles.genrePickerContainer}>
                  {GENRES.map((genre) => (
                    <TouchableOpacity
                      key={genre}
                      style={[styles.genreOption, trackGenre === genre && styles.genreOptionSelected]}
                      onPress={() => {
                        setTrackGenre(genre);
                        setShowGenrePicker(false);
                      }}
                    >
                      <Text style={[styles.genreOptionText, trackGenre === genre && styles.genreOptionTextSelected]}>
                        {genre}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* BPM */}
              <Text style={styles.modalLabel}>BPM</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="128"
                placeholderTextColor={Colors.textMuted}
                value={trackBpm}
                onChangeText={setTrackBpm}
                keyboardType="numeric"
              />

              {/* Price & Stock Row */}
              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.modalLabel}>Prix (Black Diamonds)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="2"
                    placeholderTextColor={Colors.textMuted}
                    value={trackPrice}
                    onChangeText={setTrackPrice}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.modalLabel}>Stock (-1 = illimité)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="-1"
                    placeholderTextColor={Colors.textMuted}
                    value={trackStock}
                    onChangeText={setTrackStock}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Audio File */}
              <Text style={styles.modalLabel}>Fichier Audio *</Text>
              <TouchableOpacity style={styles.filePicker} onPress={pickAudioFile}>
                <Ionicons name="musical-notes" size={24} color={audioFile ? '#4CAF50' : Colors.textMuted} />
                <Text style={[styles.filePickerText, audioFile && { color: '#4CAF50' }]}>
                  {audioFile ? audioFile.name : 'Sélectionner un fichier audio'}
                </Text>
              </TouchableOpacity>

              {/* Image File */}
              <Text style={styles.modalLabel}>Image / Artwork</Text>
              <TouchableOpacity style={styles.filePicker} onPress={pickImageFile}>
                {imageFile ? (
                  <Image source={{ uri: imageFile.uri }} style={styles.imagePreview} />
                ) : (
                  <Ionicons name="image" size={24} color={Colors.textMuted} />
                )}
                <Text style={[styles.filePickerText, imageFile && { color: '#4CAF50' }]}>
                  {imageFile ? 'Image sélectionnée' : 'Sélectionner une image'}
                </Text>
              </TouchableOpacity>

              {/* Preview Times Row */}
              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.modalLabel}>Preview Start (sec)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                    value={previewStart}
                    onChangeText={setPreviewStart}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.modalLabel}>Preview End (sec)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="30"
                    placeholderTextColor={Colors.textMuted}
                    value={previewEnd}
                    onChangeText={setPreviewEnd}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Upload Button */}
              <TouchableOpacity
                style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
                onPress={uploadVIPTrack}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={20} color="#fff" />
                    <Text style={styles.uploadBtnText}>Uploader le Track V.I.P.</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContent: { justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: Spacing.md, color: Colors.textSecondary },
  accessDeniedTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 16 },
  backButton: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.primary, borderRadius: BorderRadius.md },
  backButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, paddingTop: 50, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border, flexWrap: 'wrap' },
  headerBack: { padding: 8 },
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E040FB20', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  headerContent: { marginLeft: 12, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textMuted },
  addTrackBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E040FB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md },
  addTrackBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  content: { flex: 1 },
  contentContainer: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },

  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: 'bold', color: Colors.text, marginTop: 8 },
  statLabel: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted, marginTop: 8, textAlign: 'center' },

  trackGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  trackCard: { width: '48%', backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.md, marginBottom: Spacing.md, overflow: 'hidden', borderWidth: 2, borderColor: '#E040FB40' },
  vipBadge: { position: 'absolute', top: 8, left: 8, zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E040FB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  vipBadgeText: { fontSize: 10, fontWeight: '600', color: '#fff' },
  trackImage: { width: '100%', aspectRatio: 1, backgroundColor: Colors.backgroundInput },
  trackImagePlaceholder: { width: '100%', aspectRatio: 1, backgroundColor: Colors.backgroundInput, justifyContent: 'center', alignItems: 'center' },
  trackInfo: { padding: Spacing.sm },
  trackTitle: { fontSize: 13, fontWeight: '600', color: Colors.text },
  trackArtist: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  trackGenre: { fontSize: 10, color: '#E040FB', marginTop: 4 },
  trackMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  trackBpm: { fontSize: 10, color: Colors.textMuted },
  trackPriceTag: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#E040FB20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  trackPrice: { fontSize: 10, fontWeight: '600', color: '#E040FB' },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  modalScroll: { flex: 1 },
  modalScrollContent: { padding: Spacing.lg, paddingTop: 60 },
  modalContent: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  modalLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginTop: Spacing.md, marginBottom: 6 },
  modalInput: { backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: 14, color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border },
  modalTextarea: { height: 100, textAlignVertical: 'top' },
  
  rowInputs: { flexDirection: 'row', gap: Spacing.md },
  halfInput: { flex: 1 },
  
  genreSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: 14, borderWidth: 1, borderColor: Colors.border },
  genreSelectorText: { fontSize: 15, color: Colors.text },
  genrePickerContainer: { backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, marginTop: 8, maxHeight: 200, overflow: 'hidden' },
  genreOption: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  genreOptionSelected: { backgroundColor: '#E040FB20' },
  genreOptionText: { fontSize: 14, color: Colors.text },
  genreOptionTextSelected: { color: '#E040FB', fontWeight: '600' },
  
  filePicker: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.md, padding: 14, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
  filePickerText: { fontSize: 14, color: Colors.textMuted, flex: 1 },
  imagePreview: { width: 40, height: 40, borderRadius: 8 },

  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#E040FB', borderRadius: BorderRadius.md, padding: 16, marginTop: Spacing.xl },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
