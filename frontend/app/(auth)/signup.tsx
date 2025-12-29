import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Linking,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// User types
const USER_TYPES = [
  { id: 'dj', label: 'DJ', icon: 'headset', description: 'Je joue de la musique en club/événements' },
  { id: 'producer', label: 'Producer', icon: 'musical-notes', description: 'Je produis de la musique' },
  { id: 'dj_producer', label: 'DJ & Producer', icon: 'disc', description: 'Je joue et je produis' },
  { id: 'label', label: 'Label', icon: 'business', description: 'Je représente un label musical' },
];

export default function SignupScreen() {
  const [step, setStep] = useState(1); // 1 = user type, 2 = form
  const [userType, setUserType] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const router = useRouter();
  const { signup } = useAuth();

  const handleSelectType = (typeId: string) => {
    setUserType(typeId);
  };

  const handleContinue = () => {
    if (!userType) {
      Alert.alert('Sélection requise', 'Veuillez choisir votre profil');
      return;
    }
    setStep(2);
  };

  const handleSignup = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (!acceptedTerms) {
      Alert.alert('Erreur', 'Veuillez accepter les conditions d\'utilisation');
      return;
    }

    setLoading(true);
    try {
      await signup(email, password, fullName, userType);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Inscription échouée', error.response?.data?.message || 'Impossible de créer le compte');
    } finally {
      setLoading(false);
    }
  };

  const openTerms = () => {
    Linking.openURL('https://spynners.com/terms');
  };

  const openPrivacy = () => {
    Linking.openURL('https://spynners.com/privacy');
  };

  // Step 1: User Type Selection
  if (step === 1) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Image
              source={require('../../assets/images/spynners-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Welcome Text */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Bienvenue sur SPYNNERS!</Text>
            <Text style={styles.welcomeSubtitle}>
              Rejoignez la plus grande communauté de DJs et producteurs House Music
            </Text>
          </View>

          {/* User Type Selection */}
          <Text style={styles.questionText}>Vous êtes...</Text>
          
          <View style={styles.typeContainer}>
            {USER_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  userType === type.id && styles.typeCardSelected
                ]}
                onPress={() => handleSelectType(type.id)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.typeIconContainer,
                  userType === type.id && styles.typeIconContainerSelected
                ]}>
                  <Ionicons 
                    name={type.icon as any} 
                    size={28} 
                    color={userType === type.id ? '#fff' : Colors.primary} 
                  />
                </View>
                <View style={styles.typeInfo}>
                  <Text style={[
                    styles.typeLabel,
                    userType === type.id && styles.typeLabelSelected
                  ]}>
                    {type.label}
                  </Text>
                  <Text style={styles.typeDescription}>{type.description}</Text>
                </View>
                {userType === type.id && (
                  <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={[styles.continueButton, !userType && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!userType}
          >
            <Text style={styles.continueButtonText}>Continuer</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Login Link */}
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.back()}
          >
            <Text style={styles.linkText}>
              Déjà un compte ? <Text style={styles.linkTextBold}>Se connecter</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Step 2: Registration Form
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Image
            source={require('../../assets/images/spynners-logo.png')}
            style={styles.logoSmall}
            resizeMode="contain"
          />
        </View>

        {/* Selected Type Badge */}
        <View style={styles.selectedTypeBadge}>
          <Ionicons 
            name={USER_TYPES.find(t => t.id === userType)?.icon as any || 'person'} 
            size={16} 
            color={Colors.primary} 
          />
          <Text style={styles.selectedTypeText}>
            {USER_TYPES.find(t => t.id === userType)?.label}
          </Text>
          <TouchableOpacity onPress={() => setStep(1)}>
            <Text style={styles.changeTypeText}>Modifier</Text>
          </TouchableOpacity>
        </View>

        {/* Form Title */}
        <Text style={styles.formTitle}>Créer votre compte</Text>
        <Text style={styles.formSubtitle}>Remplissez vos informations pour rejoindre SPYNNERS</Text>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={userType === 'label' ? 'Nom du label' : 'Nom complet / Nom d\'artiste'}
              placeholderTextColor={Colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Mot de passe (min. 6 caractères)"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirmer le mot de passe"
              placeholderTextColor={Colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          {/* Terms Checkbox */}
          <TouchableOpacity 
            style={styles.termsContainer} 
            onPress={() => setAcceptedTerms(!acceptedTerms)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
              {acceptedTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.termsText}>
              J'accepte les{' '}
              <Text style={styles.termsLink} onPress={openTerms}>
                conditions d'utilisation
              </Text>
              {' '}et la{' '}
              <Text style={styles.termsLink} onPress={openPrivacy}>
                politique de confidentialité
              </Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signupButton, (loading || !acceptedTerms) && styles.signupButtonDisabled]}
            onPress={handleSignup}
            disabled={loading || !acceptedTerms}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="person-add" size={20} color="#fff" />
                <Text style={styles.signupButtonText}>Créer mon compte</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.back()}
          >
            <Text style={styles.linkText}>
              Déjà un compte ? <Text style={styles.linkTextBold}>Se connecter</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingTop: 50,
  },
  header: {
    marginBottom: 16,
  },
  backButton: {
    marginBottom: 16,
    width: 40,
  },
  logo: {
    width: Math.min(SCREEN_WIDTH * 0.6, 240),
    height: 70,
    alignSelf: 'center',
  },
  logoSmall: {
    width: Math.min(SCREEN_WIDTH * 0.4, 160),
    height: 50,
    alignSelf: 'center',
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  typeContainer: {
    gap: 12,
    marginBottom: 24,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 14,
  },
  typeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  typeIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeIconContainerSelected: {
    backgroundColor: Colors.primary,
  },
  typeInfo: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  typeLabelSelected: {
    color: Colors.primary,
  },
  typeDescription: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: 8,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  selectedTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 20,
  },
  selectedTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  changeTypeText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 4,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  form: {
    gap: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    color: Colors.text,
    fontSize: 16,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 8,
    paddingRight: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '500',
  },
  signupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: BorderRadius.md,
    marginTop: 8,
    gap: 10,
  },
  signupButtonDisabled: {
    opacity: 0.5,
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  linkText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  linkTextBold: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
