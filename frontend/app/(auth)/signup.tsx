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
import { useLanguage } from '../../src/contexts/LanguageContext';
import LanguageSelector from '../../src/components/LanguageSelector';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// User types
const USER_TYPES = [
  { id: 'dj', labelKey: 'userType.dj', descKey: 'userType.djDesc', icon: 'headset' },
  { id: 'producer', labelKey: 'userType.producer', descKey: 'userType.producerDesc', icon: 'musical-notes' },
  { id: 'dj_producer', labelKey: 'userType.djProducer', descKey: 'userType.djProducerDesc', icon: 'disc' },
  { id: 'label', labelKey: 'userType.label', descKey: 'userType.labelDesc', icon: 'business' },
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
  const { t } = useLanguage();

  const handleSelectType = (typeId: string) => {
    setUserType(typeId);
  };

  const handleContinue = () => {
    if (!userType) {
      Alert.alert(t('common.error'), 'Please select your profile type');
      return;
    }
    setStep(2);
  };

  const handleSignup = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert(t('common.error'), 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('common.error'), 'Password must be at least 6 characters');
      return;
    }

    if (!acceptedTerms) {
      Alert.alert(t('common.error'), 'Please accept the terms of use');
      return;
    }

    setLoading(true);
    try {
      await signup(email, password, fullName, userType);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.message || 'Could not create account');
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
        {/* Language Selector */}
        <View style={styles.languageContainer}>
          <LanguageSelector compact />
        </View>

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
            <Text style={styles.welcomeTitle}>{t('signup.welcome')}</Text>
            <Text style={styles.welcomeSubtitle}>{t('signup.joinCommunity')}</Text>
          </View>

          {/* User Type Selection */}
          <Text style={styles.questionText}>{t('signup.youAre')}</Text>
          
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
                    {t(type.labelKey)}
                  </Text>
                  <Text style={styles.typeDescription}>{t(type.descKey)}</Text>
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
            <Text style={styles.continueButtonText}>{t('signup.continue')}</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Login Link */}
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.back()}
          >
            <Text style={styles.linkText}>
              {t('signup.alreadyAccount')} <Text style={styles.linkTextBold}>{t('login.signIn')}</Text>
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
      {/* Language Selector */}
      <View style={styles.languageContainer}>
        <LanguageSelector compact />
      </View>

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
            {t(USER_TYPES.find(ty => ty.id === userType)?.labelKey || '')}
          </Text>
          <TouchableOpacity onPress={() => setStep(1)}>
            <Text style={styles.changeTypeText}>{t('signup.change')}</Text>
          </TouchableOpacity>
        </View>

        {/* Form Title */}
        <Text style={styles.formTitle}>{t('signup.createAccount')}</Text>
        <Text style={styles.formSubtitle}>{t('signup.fillInfo')}</Text>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={userType === 'label' ? t('signup.labelName') : t('signup.fullName')}
              placeholderTextColor={Colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('login.email')}
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
              placeholder={t('login.password')}
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
              placeholder={t('signup.confirmPassword')}
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
              {t('signup.acceptTerms')}{' '}
              <Text style={styles.termsLink} onPress={openTerms}>
                {t('signup.termsOfUse')}
              </Text>
              {' '}{t('signup.and')}{' '}
              <Text style={styles.termsLink} onPress={openPrivacy}>
                {t('signup.privacyPolicy')}
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
                <Text style={styles.signupButtonText}>{t('signup.createMyAccount')}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.back()}
          >
            <Text style={styles.linkText}>
              {t('signup.alreadyAccount')} <Text style={styles.linkTextBold}>{t('login.signIn')}</Text>
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
  languageContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 100,
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
