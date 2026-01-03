// Internationalization (i18n) context and translations
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Translation keys
export const translations = {
  en: {
    // Common
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    add: 'Add',
    share: 'Share',
    download: 'Download',
    playlist: 'Playlist',
    ok: 'OK',
    error: 'Error',
    success: 'Success',
    loading: 'Loading...',
    required: 'Required',
    
    // Home
    welcomeBack: 'Welcome back,',
    latestTracks: 'Latest Tracks',
    noTracksYet: 'No tracks yet',
    listening: 'Listening...',
    analyzing: 'Analyzing...',
    recognizing: 'Recognizing...',
    spyn: 'SPYN',
    recordSet: 'Record Set',
    stop: 'Stop',
    
    // SPYN Recognition
    trackIdentified: 'Track Identified!',
    couldNotRecognize: 'Could not recognize the track. Try again with a clearer sample.',
    addToPlaylist: 'Add to Playlist',
    confidence: 'Confidence',
    listeningForTrack: 'Bring your phone close to the audio source',
    permissionRequired: 'Permission Required',
    microphoneAccess: 'Microphone access is needed to identify tracks.',
    
    // DJ Set
    endSession: 'End Session',
    recordingDuration: 'Recording duration',
    eventName: 'Event Name',
    venue: 'Venue / Club',
    city: 'City',
    country: 'Country',
    date: 'Date',
    notes: 'Notes (optional)',
    saveSession: 'Save Session',
    discardRecording: 'Discard recording?',
    irreversibleAction: 'This action cannot be undone.',
    sessionSaved: 'Session saved!',
    djSetSaved: 'Your DJ set has been saved to your phone.',
    
    // VIP
    vipTrack: 'VIP Track',
    vipPreview: 'VIP Track - Preview',
    previewSeconds: 'seconds preview.',
    fullVersionInfo: 'For the full version, purchase with Black Diamonds on spynners.com',
    vipOnlyDownload: 'This track is VIP only.\n\nPurchase with Black Diamonds on spynners.com to download.',
    endOfPreview: 'End of preview',
    buyToListen: 'Buy this VIP track to listen in full!',
    
    // Download
    downloaded: 'Downloaded!',
    trackSavedTo: 'has been saved to your music library.',
    folder: 'Folder',
    audioNotAvailable: 'Audio file not available for this track.',
    downloadError: 'Could not download this track. Try again later.',
    
    // Playlist
    addedToPlaylist: 'Added to playlist',
    alreadyInPlaylist: 'This track is already in',
    selectPlaylist: 'Select a playlist',
    myPlaylist: 'My Playlist',
    createPlaylist: 'Create Playlist',
    playlistName: 'Playlist name',
    emptyPlaylist: 'This playlist is empty',
    
    // Upload
    uploadTrack: 'Upload Track',
    shareWithDjs: 'Share your music with 1000+ DJs',
    audioFile: 'Audio File',
    mp3OrWav: 'MP3 or WAV (max 50MB)',
    artwork: 'Artwork',
    selectImage: 'Select an image',
    title: 'Title',
    trackTitle: 'Track title',
    artist: 'Artist',
    artistName: 'Artist name',
    collaborators: 'Collaborators',
    addCollaborator: 'Add a collaborator',
    label: 'Label',
    labelName: 'Label name',
    genre: 'Genre',
    selectGenre: 'Select a genre',
    bpm: 'BPM',
    key: 'Key',
    selectKey: 'Select (Camelot)',
    energyLevel: 'Energy Level',
    mood: 'Mood',
    select: 'Select',
    description: 'Description',
    trackDescription: 'Track description...',
    vipToggleTitle: 'VIP Track',
    vipToggleSubtitle: 'Requires Black Diamonds',
    uploading: 'Uploading...',
    uploadSuccess: 'Upload successful! 🎉',
    trackValidation: 'Your track will be available after validation.',
    uploadFailed: 'Upload failed',
    fileTooLarge: 'File too large',
    maxSize: 'Maximum 50MB',
    validationInfo: 'Your track will be reviewed within 24-48 hours before publication.',
    enterTitle: 'Enter the track title',
    enterArtist: 'Enter the artist name',
    selectAGenre: 'Select a genre',
    selectAudioFile: 'Select an audio file',
    
    // Profile
    editProfile: 'Edit Profile',
    updateInfo: 'Update your information',
    blackDiamonds: 'Black Diamonds',
    buyDiamonds: 'Buy Black Diamonds',
    myUploads: 'My Uploads',
    manageTracks: 'Manage my tracks',
    myPlaylists: 'My Playlists',
    viewPlaylists: 'View my playlists',
    website: 'Website',
    visitWebsite: 'Visit spynners.com',
    helpFaq: 'Help & FAQ',
    frequentQuestions: 'Frequently asked questions',
    terms: 'Terms',
    termsOfUse: 'Terms of use',
    logout: 'Logout',
    logoutConfirm: 'Do you really want to logout?',
    uploads: 'Uploads',
    diamonds: 'Diamonds',
    favorites: 'Favorites',
    
    // Profile
    uploads: 'Uploads',
    diamonds: 'Diamonds',
    user: 'User',
    administrator: 'Administrator',
    
    // Auth
    login: 'Login',
    signup: 'Sign Up',
    email: 'Email',
    password: 'Password',
    fullName: 'Full Name',
    forgotPassword: 'Forgot Password?',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
    continueWithGoogle: 'Continue with Google',
    continueWithApple: 'Continue with Apple',
    
    // Library
    library: 'Library',
    allTracks: 'All Tracks',
    searchTracks: 'Search tracks...',
    
    // Language
    language: 'Language',
    english: 'English',
    french: 'French',
  },
  
  fr: {
    // Common
    cancel: 'Annuler',
    save: 'Sauvegarder',
    delete: 'Supprimer',
    add: 'Ajouter',
    share: 'Partager',
    download: 'Télécharger',
    playlist: 'Playlist',
    ok: 'OK',
    error: 'Erreur',
    success: 'Succès',
    loading: 'Chargement...',
    required: 'Requis',
    
    // Home
    welcomeBack: 'Bon retour,',
    latestTracks: 'Dernières Tracks',
    noTracksYet: 'Aucune track pour le moment',
    listening: 'Écoute en cours...',
    analyzing: 'Analyse en cours...',
    recognizing: 'Reconnaissance...',
    spyn: 'SPYN',
    recordSet: 'Enregistrer Set',
    stop: 'Stop',
    
    // SPYN Recognition
    trackIdentified: 'Track Identifiée !',
    couldNotRecognize: 'Impossible d\'identifier cette track. Essayez de nouveau avec un extrait plus clair.',
    addToPlaylist: 'Ajouter à Playlist',
    confidence: 'Confiance',
    listeningForTrack: 'Approchez le téléphone de la source audio',
    permissionRequired: 'Permission requise',
    microphoneAccess: 'L\'accès au microphone est nécessaire pour identifier les tracks.',
    
    // DJ Set
    endSession: 'Fin de Session',
    recordingDuration: 'Durée de l\'enregistrement',
    eventName: 'Nom de l\'événement',
    venue: 'Venue / Club',
    city: 'Ville',
    country: 'Pays',
    date: 'Date',
    notes: 'Notes (optionnel)',
    saveSession: 'Sauvegarder la Session',
    discardRecording: 'Supprimer l\'enregistrement ?',
    irreversibleAction: 'Cette action est irréversible.',
    sessionSaved: 'Session sauvegardée !',
    djSetSaved: 'Votre DJ set a été enregistré dans votre téléphone.',
    
    // VIP
    vipTrack: 'Track VIP',
    vipPreview: 'Track VIP - Preview',
    previewSeconds: 'secondes d\'extrait.',
    fullVersionInfo: 'Pour la version complète, achetez avec des Black Diamonds sur spynners.com',
    vipOnlyDownload: 'Cette track est réservée aux membres VIP.\n\nAchetez-la avec des Black Diamonds sur spynners.com pour la télécharger.',
    endOfPreview: 'Fin du preview',
    buyToListen: 'Achetez cette track VIP pour l\'écouter en entier !',
    
    // Download
    downloaded: 'Téléchargé !',
    trackSavedTo: 'a été sauvegardé dans votre bibliothèque musicale.',
    folder: 'Dossier',
    audioNotAvailable: 'Fichier audio non disponible pour cette track.',
    downloadError: 'Impossible de télécharger cette track. Réessayez plus tard.',
    
    // Playlist
    addedToPlaylist: 'Ajouté à la playlist',
    alreadyInPlaylist: 'Cette track est déjà dans',
    selectPlaylist: 'Choisir une playlist',
    myPlaylist: 'Ma Playlist',
    createPlaylist: 'Créer une Playlist',
    playlistName: 'Nom de la playlist',
    emptyPlaylist: 'Cette playlist est vide',
    
    // Upload
    uploadTrack: 'Upload Track',
    shareWithDjs: 'Partagez votre musique avec 1000+ DJs',
    audioFile: 'Fichier Audio',
    mp3OrWav: 'MP3 ou WAV (max 50MB)',
    artwork: 'Pochette',
    selectImage: 'Sélectionner une image',
    title: 'Titre',
    trackTitle: 'Titre de la track',
    artist: 'Artiste',
    artistName: 'Nom de l\'artiste',
    collaborators: 'Collaborateurs',
    addCollaborator: 'Ajouter un collaborateur',
    label: 'Label',
    labelName: 'Nom du label',
    genre: 'Genre',
    selectGenre: 'Sélectionner un genre',
    bpm: 'BPM',
    key: 'Tonalité',
    selectKey: 'Sélectionner (Camelot)',
    energyLevel: 'Niveau d\'énergie',
    mood: 'Ambiance',
    select: 'Sélectionner',
    description: 'Description',
    trackDescription: 'Description de la track...',
    vipToggleTitle: 'Track VIP',
    vipToggleSubtitle: 'Nécessite des Black Diamonds',
    uploading: 'Upload en cours...',
    uploadSuccess: 'Upload réussi ! 🎉',
    trackValidation: 'Votre track sera disponible après validation.',
    uploadFailed: 'Échec de l\'upload',
    fileTooLarge: 'Fichier trop volumineux',
    maxSize: 'Maximum 50MB',
    validationInfo: 'Votre track sera validée sous 24-48h avant publication.',
    enterTitle: 'Entrez le titre de la track',
    enterArtist: 'Entrez le nom de l\'artiste',
    selectAGenre: 'Sélectionnez un genre',
    selectAudioFile: 'Sélectionnez un fichier audio',
    
    // Profile
    editProfile: 'Modifier le profil',
    updateInfo: 'Mettre à jour vos informations',
    blackDiamonds: 'Black Diamonds',
    buyDiamonds: 'Acheter des Black Diamonds',
    myUploads: 'Mes Uploads',
    manageTracks: 'Gérer mes tracks',
    myPlaylists: 'Mes Playlists',
    viewPlaylists: 'Voir mes playlists',
    website: 'Site Web',
    visitWebsite: 'Visiter spynners.com',
    helpFaq: 'Aide & FAQ',
    frequentQuestions: 'Questions fréquentes',
    terms: 'Conditions',
    termsOfUse: 'Conditions d\'utilisation',
    logout: 'Déconnexion',
    logoutConfirm: 'Voulez-vous vraiment vous déconnecter ?',
    uploads: 'Uploads',
    diamonds: 'Diamonds',
    favorites: 'Favoris',
    
    // Profile
    uploads: 'Uploads',
    diamonds: 'Diamonds',
    user: 'Utilisateur',
    administrator: 'Administrateur',
    
    // Auth
    login: 'Connexion',
    signup: 'Inscription',
    email: 'Email',
    password: 'Mot de passe',
    fullName: 'Nom complet',
    forgotPassword: 'Mot de passe oublié ?',
    noAccount: 'Pas encore de compte ?',
    haveAccount: 'Déjà un compte ?',
    continueWithGoogle: 'Continuer avec Google',
    continueWithApple: 'Continuer avec Apple',
    
    // Library
    library: 'Bibliothèque',
    allTracks: 'Toutes les Tracks',
    searchTracks: 'Rechercher des tracks...',
    
    // Language
    language: 'Langue',
    english: 'Anglais',
    french: 'Français',
  },
};

type Language = 'en' | 'fr';
type TranslationKey = keyof typeof translations.en;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'spynners_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved && (saved === 'en' || saved === 'fr')) {
        setLanguageState(saved);
      }
    } catch (e) {
      console.log('Failed to load language preference');
    }
  };

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (e) {
      console.log('Failed to save language preference');
    }
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export default LanguageContext;
