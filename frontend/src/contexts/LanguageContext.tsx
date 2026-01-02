import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supported languages
export type Language = 'en' | 'fr' | 'es' | 'it' | 'de' | 'zh';

export const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

// Translations
const translations: Record<Language, Record<string, string>> = {
  en: {
    // Auth
    'login.title': 'Sign In',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.forgotPassword': 'Forgot password?',
    'login.signIn': 'Sign In',
    'login.noAccount': "Don't have an account?",
    'login.signUp': 'Sign Up',
    'login.subtitle': 'Free House Music Promo Pool',
    
    // Signup
    'signup.welcome': 'Welcome to SPYNNERS!',
    'signup.joinCommunity': 'Join the largest community of House Music DJs and producers',
    'signup.youAre': 'You are...',
    'signup.continue': 'Continue',
    'signup.createAccount': 'Create your account',
    'signup.fillInfo': 'Fill in your information to join SPYNNERS',
    'signup.fullName': 'Full name / Artist name',
    'signup.labelName': 'Label name',
    'signup.confirmPassword': 'Confirm password',
    'signup.acceptTerms': 'I accept the',
    'signup.termsOfUse': 'terms of use',
    'signup.and': 'and',
    'signup.privacyPolicy': 'privacy policy',
    'signup.createMyAccount': 'Create my account',
    'signup.alreadyAccount': 'Already have an account?',
    'signup.change': 'Change',
    
    // User types
    'userType.dj': 'DJ',
    'userType.djDesc': 'I play music at clubs/events',
    'userType.producer': 'Producer',
    'userType.producerDesc': 'I produce music',
    'userType.djProducer': 'DJ & Producer',
    'userType.djProducerDesc': 'I play and produce',
    'userType.label': 'Label',
    'userType.labelDesc': 'I represent a music label',
    
    // Navigation
    'nav.home': 'Home',
    'nav.library': 'Library',
    'nav.spyn': 'SPYN',
    'nav.chat': 'Chat',
    'nav.profile': 'Profile',
    
    // SPYN
    'spyn.detection': 'DETECTION',
    'spyn.recordSet': 'RECORD SET',
    'spyn.micro': 'Micro',
    'spyn.usbRec': 'USB + Rec',
    'spyn.analyzing': 'Analyzing with ACRCloud...',
    'spyn.listening': 'Listening... (10s)',
    'spyn.trackIdentified': 'Track Identified!',
    'spyn.newSearch': 'New Search',
    'spyn.djSetStarted': 'DJ Set Started',
    'spyn.djSetEnded': 'DJ Set Ended',
    'spyn.tracksIdentified': 'Tracks identified',
    'spyn.save': 'Save',
    'spyn.delete': 'Delete',
    'spyn.stop': 'Stop',
    
    // Profile
    'profile.editProfile': 'Edit Profile',
    'profile.blackDiamonds': 'Black Diamonds',
    'profile.settings': 'Settings',
    'profile.help': 'Help & Support',
    'profile.terms': 'Terms & Privacy',
    'profile.admin': 'Admin Panel',
    'profile.logout': 'Log Out',
    
    // Common
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.search': 'Search',
    'common.noResults': 'No results',
    'common.language': 'Language',
    'common.selectLanguage': 'Select your language',
    
    // Menu items
    'menu.myUploads': 'My Uploads',
    'menu.profile': 'Profile',
    'menu.chat': 'Chat',
    'menu.received': 'Received',
    'menu.playlists': 'Playlists',
    'menu.analytics': 'Analytics',
    'menu.rankings': 'Rankings',
    'menu.liveRadar': 'Live Radar',
    'menu.vip': 'V.I.P.',
    'menu.uploadTrack': 'Upload Track',
    
    // Actions
    'action.download': 'Download',
    'action.share': 'Share',
    'action.addToPlaylist': 'Add to Playlist',
    'action.sendTrack': 'Send Track',
    
    // Filters
    'filter.allGenres': 'All Genres',
    'filter.allEnergy': 'All Energy Levels',
    'filter.recentlyAdded': 'Recently Added',
    'filter.aToZ': 'A to Z',
    'filter.topRated': 'Top Rated',
    'filter.low': 'Low',
    'filter.medium': 'Medium',
    'filter.high': 'High',
    'filter.vipOnly': 'VIP Only',
    'filter.searchPlaceholder': 'Search tracks...',
  },
  
  fr: {
    // Auth
    'login.title': 'Connexion',
    'login.email': 'Email',
    'login.password': 'Mot de passe',
    'login.forgotPassword': 'Mot de passe oublié ?',
    'login.signIn': 'Se connecter',
    'login.noAccount': "Pas encore de compte ?",
    'login.signUp': "S'inscrire",
    'login.subtitle': 'Free House Music Promo Pool',
    
    // Signup
    'signup.welcome': 'Bienvenue sur SPYNNERS!',
    'signup.joinCommunity': 'Rejoignez la plus grande communauté de DJs et producteurs House Music',
    'signup.youAre': 'Vous êtes...',
    'signup.continue': 'Continuer',
    'signup.createAccount': 'Créer votre compte',
    'signup.fillInfo': 'Remplissez vos informations pour rejoindre SPYNNERS',
    'signup.fullName': 'Nom complet / Nom d\'artiste',
    'signup.labelName': 'Nom du label',
    'signup.confirmPassword': 'Confirmer le mot de passe',
    'signup.acceptTerms': 'J\'accepte les',
    'signup.termsOfUse': 'conditions d\'utilisation',
    'signup.and': 'et la',
    'signup.privacyPolicy': 'politique de confidentialité',
    'signup.createMyAccount': 'Créer mon compte',
    'signup.alreadyAccount': 'Déjà un compte ?',
    'signup.change': 'Modifier',
    
    // User types
    'userType.dj': 'DJ',
    'userType.djDesc': 'Je joue de la musique en club/événements',
    'userType.producer': 'Producteur',
    'userType.producerDesc': 'Je produis de la musique',
    'userType.djProducer': 'DJ & Producteur',
    'userType.djProducerDesc': 'Je joue et je produis',
    'userType.label': 'Label',
    'userType.labelDesc': 'Je représente un label musical',
    
    // Navigation
    'nav.home': 'Accueil',
    'nav.library': 'Bibliothèque',
    'nav.spyn': 'SPYN',
    'nav.chat': 'Chat',
    'nav.profile': 'Profil',
    
    // SPYN
    'spyn.detection': 'DETECTION',
    'spyn.recordSet': 'RECORD SET',
    'spyn.micro': 'Micro',
    'spyn.usbRec': 'USB + Rec',
    'spyn.analyzing': 'Analyse ACRCloud...',
    'spyn.listening': 'Écoute en cours... (10s)',
    'spyn.trackIdentified': 'Track Identifiée!',
    'spyn.newSearch': 'Nouvelle Recherche',
    'spyn.djSetStarted': 'DJ Set Démarré',
    'spyn.djSetEnded': 'DJ Set Terminé',
    'spyn.tracksIdentified': 'Tracks identifiées',
    'spyn.save': 'Sauvegarder',
    'spyn.delete': 'Supprimer',
    'spyn.stop': 'Arrêter',
    
    // Profile
    'profile.editProfile': 'Modifier le Profil',
    'profile.blackDiamonds': 'Black Diamonds',
    'profile.settings': 'Paramètres',
    'profile.help': 'Aide & Support',
    'profile.terms': 'CGU & Confidentialité',
    'profile.admin': 'Admin Panel',
    'profile.logout': 'Déconnexion',
    
    // Common
    'common.cancel': 'Annuler',
    'common.save': 'Enregistrer',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.success': 'Succès',
    'common.search': 'Rechercher',
    'common.noResults': 'Aucun résultat',
    'common.language': 'Langue',
    'common.selectLanguage': 'Sélectionnez votre langue',
    
    // Menu items
    'menu.myUploads': 'Mes Uploads',
    'menu.profile': 'Profil',
    'menu.chat': 'Chat',
    'menu.received': 'Reçus',
    'menu.playlists': 'Playlists',
    'menu.analytics': 'Statistiques',
    'menu.rankings': 'Classements',
    'menu.liveRadar': 'Live Radar',
    'menu.vip': 'V.I.P.',
    'menu.uploadTrack': 'Uploader un Track',
    
    // Actions
    'action.download': 'Télécharger',
    'action.share': 'Partager',
    'action.addToPlaylist': 'Ajouter à la Playlist',
    'action.sendTrack': 'Envoyer le Track',
    
    // Filters
    'filter.allGenres': 'Tous les Genres',
    'filter.allEnergy': 'Tous les Niveaux',
    'filter.recentlyAdded': 'Récemment Ajoutés',
    'filter.aToZ': 'A à Z',
    'filter.topRated': 'Mieux Notés',
    'filter.low': 'Bas',
    'filter.medium': 'Moyen',
    'filter.high': 'Haut',
    'filter.vipOnly': 'VIP Seulement',
    'filter.searchPlaceholder': 'Rechercher des tracks...',
  },
  
  es: {
    'login.title': 'Iniciar Sesión',
    'login.email': 'Correo',
    'login.password': 'Contraseña',
    'login.forgotPassword': '¿Olvidaste tu contraseña?',
    'login.signIn': 'Iniciar Sesión',
    'login.noAccount': '¿No tienes cuenta?',
    'login.signUp': 'Registrarse',
    'login.subtitle': 'Free House Music Promo Pool',
    'signup.welcome': '¡Bienvenido a SPYNNERS!',
    'signup.joinCommunity': 'Únete a la mayor comunidad de DJs y productores de House Music',
    'signup.youAre': 'Eres...',
    'signup.continue': 'Continuar',
    'signup.createAccount': 'Crear tu cuenta',
    'signup.fillInfo': 'Completa tu información para unirte a SPYNNERS',
    'signup.fullName': 'Nombre completo / Nombre artístico',
    'signup.labelName': 'Nombre del sello',
    'signup.confirmPassword': 'Confirmar contraseña',
    'signup.acceptTerms': 'Acepto los',
    'signup.termsOfUse': 'términos de uso',
    'signup.and': 'y la',
    'signup.privacyPolicy': 'política de privacidad',
    'signup.createMyAccount': 'Crear mi cuenta',
    'signup.alreadyAccount': '¿Ya tienes cuenta?',
    'signup.change': 'Cambiar',
    'userType.dj': 'DJ',
    'userType.djDesc': 'Toco música en clubs/eventos',
    'userType.producer': 'Productor',
    'userType.producerDesc': 'Produzco música',
    'userType.djProducer': 'DJ & Productor',
    'userType.djProducerDesc': 'Toco y produzco',
    'userType.label': 'Sello',
    'userType.labelDesc': 'Represento un sello musical',
    'nav.home': 'Inicio',
    'nav.library': 'Biblioteca',
    'nav.spyn': 'SPYN',
    'nav.chat': 'Chat',
    'nav.profile': 'Perfil',
    'spyn.detection': 'DETECCIÓN',
    'spyn.recordSet': 'GRABAR SET',
    'spyn.micro': 'Micro',
    'spyn.usbRec': 'USB + Rec',
    'spyn.analyzing': 'Analizando con ACRCloud...',
    'spyn.listening': 'Escuchando... (10s)',
    'spyn.trackIdentified': '¡Track Identificada!',
    'spyn.newSearch': 'Nueva Búsqueda',
    'profile.editProfile': 'Editar Perfil',
    'profile.blackDiamonds': 'Black Diamonds',
    'profile.settings': 'Configuración',
    'profile.help': 'Ayuda & Soporte',
    'profile.terms': 'Términos & Privacidad',
    'profile.admin': 'Panel Admin',
    'profile.logout': 'Cerrar Sesión',
    'common.cancel': 'Cancelar',
    'common.save': 'Guardar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.success': 'Éxito',
    'common.search': 'Buscar',
    'common.noResults': 'Sin resultados',
  },
  
  it: {
    'login.title': 'Accedi',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.forgotPassword': 'Password dimenticata?',
    'login.signIn': 'Accedi',
    'login.noAccount': 'Non hai un account?',
    'login.signUp': 'Registrati',
    'login.subtitle': 'Free House Music Promo Pool',
    'signup.welcome': 'Benvenuto su SPYNNERS!',
    'signup.joinCommunity': 'Unisciti alla più grande community di DJ e produttori House Music',
    'signup.youAre': 'Sei...',
    'signup.continue': 'Continua',
    'signup.createAccount': 'Crea il tuo account',
    'signup.fillInfo': 'Compila le tue informazioni per unirti a SPYNNERS',
    'signup.fullName': 'Nome completo / Nome artista',
    'signup.labelName': 'Nome etichetta',
    'signup.confirmPassword': 'Conferma password',
    'signup.acceptTerms': 'Accetto i',
    'signup.termsOfUse': 'termini di utilizzo',
    'signup.and': 'e la',
    'signup.privacyPolicy': 'politica sulla privacy',
    'signup.createMyAccount': 'Crea il mio account',
    'signup.alreadyAccount': 'Hai già un account?',
    'signup.change': 'Modifica',
    'userType.dj': 'DJ',
    'userType.djDesc': 'Suono musica nei club/eventi',
    'userType.producer': 'Produttore',
    'userType.producerDesc': 'Produco musica',
    'userType.djProducer': 'DJ & Produttore',
    'userType.djProducerDesc': 'Suono e produco',
    'userType.label': 'Etichetta',
    'userType.labelDesc': 'Rappresento un\'etichetta musicale',
    'nav.home': 'Home',
    'nav.library': 'Libreria',
    'nav.spyn': 'SPYN',
    'nav.chat': 'Chat',
    'nav.profile': 'Profilo',
    'spyn.detection': 'RILEVAMENTO',
    'spyn.recordSet': 'REGISTRA SET',
    'spyn.micro': 'Micro',
    'spyn.usbRec': 'USB + Rec',
    'spyn.analyzing': 'Analisi ACRCloud...',
    'spyn.listening': 'Ascolto... (10s)',
    'spyn.trackIdentified': 'Track Identificata!',
    'spyn.newSearch': 'Nuova Ricerca',
    'profile.editProfile': 'Modifica Profilo',
    'profile.blackDiamonds': 'Black Diamonds',
    'profile.settings': 'Impostazioni',
    'profile.help': 'Aiuto & Supporto',
    'profile.terms': 'Termini & Privacy',
    'profile.admin': 'Pannello Admin',
    'profile.logout': 'Esci',
    'common.cancel': 'Annulla',
    'common.save': 'Salva',
    'common.delete': 'Elimina',
    'common.edit': 'Modifica',
    'common.loading': 'Caricamento...',
    'common.error': 'Errore',
    'common.success': 'Successo',
    'common.search': 'Cerca',
    'common.noResults': 'Nessun risultato',
  },
  
  de: {
    'login.title': 'Anmelden',
    'login.email': 'E-Mail',
    'login.password': 'Passwort',
    'login.forgotPassword': 'Passwort vergessen?',
    'login.signIn': 'Anmelden',
    'login.noAccount': 'Noch kein Konto?',
    'login.signUp': 'Registrieren',
    'login.subtitle': 'Free House Music Promo Pool',
    'signup.welcome': 'Willkommen bei SPYNNERS!',
    'signup.joinCommunity': 'Tritt der größten Community von House Music DJs und Produzenten bei',
    'signup.youAre': 'Du bist...',
    'signup.continue': 'Weiter',
    'signup.createAccount': 'Konto erstellen',
    'signup.fillInfo': 'Fülle deine Daten aus, um SPYNNERS beizutreten',
    'signup.fullName': 'Vollständiger Name / Künstlername',
    'signup.labelName': 'Label-Name',
    'signup.confirmPassword': 'Passwort bestätigen',
    'signup.acceptTerms': 'Ich akzeptiere die',
    'signup.termsOfUse': 'Nutzungsbedingungen',
    'signup.and': 'und die',
    'signup.privacyPolicy': 'Datenschutzrichtlinie',
    'signup.createMyAccount': 'Mein Konto erstellen',
    'signup.alreadyAccount': 'Bereits ein Konto?',
    'signup.change': 'Ändern',
    'userType.dj': 'DJ',
    'userType.djDesc': 'Ich lege in Clubs/Events auf',
    'userType.producer': 'Produzent',
    'userType.producerDesc': 'Ich produziere Musik',
    'userType.djProducer': 'DJ & Produzent',
    'userType.djProducerDesc': 'Ich lege auf und produziere',
    'userType.label': 'Label',
    'userType.labelDesc': 'Ich vertrete ein Musiklabel',
    'nav.home': 'Start',
    'nav.library': 'Bibliothek',
    'nav.spyn': 'SPYN',
    'nav.chat': 'Chat',
    'nav.profile': 'Profil',
    'spyn.detection': 'ERKENNUNG',
    'spyn.recordSet': 'SET AUFNEHMEN',
    'spyn.micro': 'Mikro',
    'spyn.usbRec': 'USB + Rec',
    'spyn.analyzing': 'ACRCloud-Analyse...',
    'spyn.listening': 'Höre... (10s)',
    'spyn.trackIdentified': 'Track Identifiziert!',
    'spyn.newSearch': 'Neue Suche',
    'profile.editProfile': 'Profil bearbeiten',
    'profile.blackDiamonds': 'Black Diamonds',
    'profile.settings': 'Einstellungen',
    'profile.help': 'Hilfe & Support',
    'profile.terms': 'AGB & Datenschutz',
    'profile.admin': 'Admin-Panel',
    'profile.logout': 'Abmelden',
    'common.cancel': 'Abbrechen',
    'common.save': 'Speichern',
    'common.delete': 'Löschen',
    'common.edit': 'Bearbeiten',
    'common.loading': 'Laden...',
    'common.error': 'Fehler',
    'common.success': 'Erfolg',
    'common.search': 'Suchen',
    'common.noResults': 'Keine Ergebnisse',
  },
  
  zh: {
    'login.title': '登录',
    'login.email': '邮箱',
    'login.password': '密码',
    'login.forgotPassword': '忘记密码？',
    'login.signIn': '登录',
    'login.noAccount': '还没有账户？',
    'login.signUp': '注册',
    'login.subtitle': '免费House音乐推广池',
    'signup.welcome': '欢迎来到SPYNNERS！',
    'signup.joinCommunity': '加入最大的House音乐DJ和制作人社区',
    'signup.youAre': '你是...',
    'signup.continue': '继续',
    'signup.createAccount': '创建账户',
    'signup.fillInfo': '填写信息加入SPYNNERS',
    'signup.fullName': '全名/艺名',
    'signup.labelName': '厂牌名称',
    'signup.confirmPassword': '确认密码',
    'signup.acceptTerms': '我接受',
    'signup.termsOfUse': '使用条款',
    'signup.and': '和',
    'signup.privacyPolicy': '隐私政策',
    'signup.createMyAccount': '创建我的账户',
    'signup.alreadyAccount': '已有账户？',
    'signup.change': '更改',
    'userType.dj': 'DJ',
    'userType.djDesc': '我在俱乐部/活动中打碟',
    'userType.producer': '制作人',
    'userType.producerDesc': '我制作音乐',
    'userType.djProducer': 'DJ和制作人',
    'userType.djProducerDesc': '我打碟也制作',
    'userType.label': '厂牌',
    'userType.labelDesc': '我代表一个音乐厂牌',
    'nav.home': '首页',
    'nav.library': '音乐库',
    'nav.spyn': 'SPYN',
    'nav.chat': '聊天',
    'nav.profile': '个人资料',
    'spyn.detection': '识别',
    'spyn.recordSet': '录制SET',
    'spyn.micro': '麦克风',
    'spyn.usbRec': 'USB + 录制',
    'spyn.analyzing': 'ACRCloud分析中...',
    'spyn.listening': '聆听中... (10秒)',
    'spyn.trackIdentified': '曲目已识别！',
    'spyn.newSearch': '新搜索',
    'profile.editProfile': '编辑资料',
    'profile.blackDiamonds': '黑钻石',
    'profile.settings': '设置',
    'profile.help': '帮助与支持',
    'profile.terms': '条款与隐私',
    'profile.admin': '管理面板',
    'profile.logout': '退出',
    'common.cancel': '取消',
    'common.save': '保存',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.loading': '加载中...',
    'common.error': '错误',
    'common.success': '成功',
    'common.search': '搜索',
    'common.noResults': '无结果',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  getCurrentFlag: () => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en'); // Default to English

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLang = await AsyncStorage.getItem('app_language');
      if (savedLang && LANGUAGES.some(l => l.code === savedLang)) {
        setLanguageState(savedLang as Language);
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem('app_language', lang);
      setLanguageState(lang);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const t = (key: string): string => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  const getCurrentFlag = (): string => {
    return LANGUAGES.find(l => l.code === language)?.flag || '🇬🇧';
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, getCurrentFlag }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
