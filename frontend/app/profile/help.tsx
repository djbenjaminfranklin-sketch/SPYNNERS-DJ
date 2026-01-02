import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { useLanguage } from '../../src/contexts/LanguageContext';

const FAQ_ITEMS_EN = [
  {
    question: 'How to download a track?',
    answer: 'Press the "Download" button on any track. For VIP tracks, you will need Black Diamonds.',
  },
  {
    question: 'What are Black Diamonds?',
    answer: 'Black Diamonds are SPYNNERS virtual currency. They allow access to exclusive VIP tracks and premium content.',
  },
  {
    question: 'How to upload a track?',
    answer: 'Go to the "Upload" tab, fill in your track information (title, artist, genre, etc.) and select your audio file.',
  },
  {
    question: 'How does SPYN work?',
    answer: 'SPYN uses audio recognition to identify tracks. Press the SPYN button and let your phone listen to the music for 10 seconds.',
  },
  {
    question: 'Can I create multiple playlists?',
    answer: 'Yes! Go to the Playlist tab and press the + button to create a new playlist. You can create as many as you want.',
  },
  {
    question: 'How to become a producer on SPYNNERS?',
    answer: 'Create an account, upload your tracks and they will be validated by our team within 24-48h. Once approved, they will be available to all DJs.',
  },
  {
    question: 'Are tracks free?',
    answer: 'Most tracks are free. Only VIP tracks (marked with a gold badge) require Black Diamonds.',
  },
];

const FAQ_ITEMS_FR = [
  {
    question: 'Comment télécharger une track?',
    answer: 'Appuyez sur le bouton "Download" sur n\'importe quelle track. Pour les tracks VIP, vous aurez besoin de Black Diamonds.',
  },
  {
    question: 'Qu\'est-ce que les Black Diamonds?',
    answer: 'Les Black Diamonds sont la monnaie virtuelle de SPYNNERS. Ils permettent d\'accéder aux tracks VIP exclusives et au contenu premium.',
  },
  {
    question: 'Comment uploader une track?',
    answer: 'Allez dans l\'onglet "Upload", remplissez les informations de votre track (titre, artiste, genre, etc.) et sélectionnez votre fichier audio.',
  },
  {
    question: 'Comment fonctionne SPYN?',
    answer: 'SPYN utilise la reconnaissance audio pour identifier les tracks. Appuyez sur le bouton SPYN et laissez votre téléphone écouter la musique pendant 10 secondes.',
  },
  {
    question: 'Puis-je créer plusieurs playlists?',
    answer: 'Oui! Allez dans l\'onglet Playlist et appuyez sur le bouton + pour créer une nouvelle playlist. Vous pouvez en créer autant que vous voulez.',
  },
  {
    question: 'Comment devenir producteur sur SPYNNERS?',
    answer: 'Créez un compte, uploadez vos tracks et elles seront validées par notre équipe sous 24-48h. Une fois approuvées, elles seront disponibles pour tous les DJs.',
  },
  {
    question: 'Les tracks sont-elles gratuites?',
    answer: 'La plupart des tracks sont gratuites. Seules les tracks VIP (marquées d\'un badge doré) nécessitent des Black Diamonds.',
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [contactMessage, setContactMessage] = useState('');

  const FAQ_ITEMS = language === 'fr' ? FAQ_ITEMS_FR : FAQ_ITEMS_EN;

  const toggleFAQ = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleContact = () => {
    if (!contactMessage.trim()) {
      Alert.alert(
        language === 'fr' ? 'Message requis' : 'Message required',
        language === 'fr' ? 'Veuillez écrire votre message' : 'Please write your message'
      );
      return;
    }

    Alert.alert(
      language === 'fr' ? 'Message envoyé! ✉️' : 'Message sent! ✉️',
      language === 'fr' ? 'Notre équipe vous répondra sous 24-48h.' : 'Our team will respond within 24-48h.',
      [{ text: 'OK', onPress: () => setContactMessage('') }]
    );
  };

  const openEmail = () => {
    Linking.openURL('mailto:support@spynners.com');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('help.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* FAQ Section */}
        <Text style={styles.sectionTitle}>{t('help.frequentQuestions')}</Text>
        
        {FAQ_ITEMS.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.faqItem}
            onPress={() => toggleFAQ(index)}
            activeOpacity={0.7}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>{item.question}</Text>
              <Ionicons
                name={expandedIndex === index ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.textMuted}
              />
            </View>
            {expandedIndex === index && (
              <Text style={styles.faqAnswer}>{item.answer}</Text>
            )}
          </TouchableOpacity>
        ))}

        {/* Contact Section */}
        <Text style={styles.sectionTitle}>{t('help.contactUs')}</Text>
        
        <View style={styles.contactCard}>
          <Text style={styles.contactLabel}>{t('help.haveQuestion')}</Text>
          
          <TextInput
            style={styles.contactInput}
            value={contactMessage}
            onChangeText={setContactMessage}
            placeholder={t('help.writeMessage')}
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={4}
          />
          
          <TouchableOpacity style={styles.sendButton} onPress={handleContact}>
            <Ionicons name="send" size={20} color="#fff" />
            <Text style={styles.sendButtonText}>{t('help.send')}</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Contact */}
        <TouchableOpacity style={styles.emailButton} onPress={openEmail}>
          <Ionicons name="mail" size={24} color={Colors.primary} />
          <View style={styles.emailButtonText}>
            <Text style={styles.emailLabel}>
              {language === 'fr' ? 'Email direct' : 'Direct email'}
            </Text>
            <Text style={styles.emailAddress}>support@spynners.com</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md, paddingTop: 60,
    backgroundColor: Colors.backgroundCard,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: Colors.text },
  content: { flex: 1, padding: Spacing.lg },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginTop: 16, marginBottom: 12 },
  faqItem: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQuestion: { fontSize: 15, fontWeight: '600', color: Colors.text, flex: 1, marginRight: 10 },
  faqAnswer: { fontSize: 14, color: Colors.textSecondary, marginTop: 12, lineHeight: 20 },
  contactCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  contactLabel: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  contactInput: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    padding: Spacing.md, fontSize: 15, color: Colors.text,
    height: 100, textAlignVertical: 'top',
    borderWidth: 1, borderColor: Colors.border,
  },
  sendButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    padding: Spacing.md, gap: 8, marginTop: 12,
  },
  sendButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  emailButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg, gap: 12, marginTop: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  emailButtonText: { flex: 1 },
  emailLabel: { fontSize: 14, color: Colors.textMuted },
  emailAddress: { fontSize: 15, fontWeight: '600', color: Colors.primary },
});
