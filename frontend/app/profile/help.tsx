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

const FAQ_ITEMS: Record<string, { question: string; answer: string }[]> = {
  en: [
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
  ],
  fr: [
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
  ],
  es: [
    {
      question: '¿Cómo descargar un track?',
      answer: 'Presiona el botón "Descargar" en cualquier track. Para tracks VIP, necesitarás Black Diamonds.',
    },
    {
      question: '¿Qué son los Black Diamonds?',
      answer: 'Los Black Diamonds son la moneda virtual de SPYNNERS. Permiten acceder a tracks VIP exclusivos y contenido premium.',
    },
    {
      question: '¿Cómo subir un track?',
      answer: 'Ve a la pestaña "Subir", completa la información de tu track (título, artista, género, etc.) y selecciona tu archivo de audio.',
    },
    {
      question: '¿Cómo funciona SPYN?',
      answer: 'SPYN usa reconocimiento de audio para identificar tracks. Presiona el botón SPYN y deja que tu teléfono escuche la música durante 10 segundos.',
    },
    {
      question: '¿Puedo crear múltiples playlists?',
      answer: '¡Sí! Ve a la pestaña Playlist y presiona el botón + para crear una nueva playlist. Puedes crear tantas como quieras.',
    },
    {
      question: '¿Cómo ser productor en SPYNNERS?',
      answer: 'Crea una cuenta, sube tus tracks y serán validados por nuestro equipo en 24-48h. Una vez aprobados, estarán disponibles para todos los DJs.',
    },
    {
      question: '¿Los tracks son gratis?',
      answer: 'La mayoría de los tracks son gratis. Solo los tracks VIP (marcados con insignia dorada) requieren Black Diamonds.',
    },
  ],
  it: [
    {
      question: 'Come scaricare una traccia?',
      answer: 'Premi il pulsante "Download" su qualsiasi traccia. Per le tracce VIP, avrai bisogno di Black Diamonds.',
    },
    {
      question: 'Cosa sono i Black Diamonds?',
      answer: 'I Black Diamonds sono la valuta virtuale di SPYNNERS. Permettono di accedere a tracce VIP esclusive e contenuti premium.',
    },
    {
      question: 'Come caricare una traccia?',
      answer: 'Vai alla scheda "Upload", compila le informazioni della tua traccia (titolo, artista, genere, ecc.) e seleziona il tuo file audio.',
    },
    {
      question: 'Come funziona SPYN?',
      answer: 'SPYN utilizza il riconoscimento audio per identificare le tracce. Premi il pulsante SPYN e lascia che il tuo telefono ascolti la musica per 10 secondi.',
    },
    {
      question: 'Posso creare più playlist?',
      answer: 'Sì! Vai alla scheda Playlist e premi il pulsante + per creare una nuova playlist. Puoi crearne quante ne vuoi.',
    },
    {
      question: 'Come diventare produttore su SPYNNERS?',
      answer: 'Crea un account, carica le tue tracce e verranno convalidate dal nostro team entro 24-48h. Una volta approvate, saranno disponibili per tutti i DJ.',
    },
    {
      question: 'Le tracce sono gratuite?',
      answer: 'La maggior parte delle tracce sono gratuite. Solo le tracce VIP (contrassegnate con un badge dorato) richiedono Black Diamonds.',
    },
  ],
  de: [
    {
      question: 'Wie lade ich einen Track herunter?',
      answer: 'Drücke den "Download"-Button bei jedem Track. Für VIP-Tracks benötigst du Black Diamonds.',
    },
    {
      question: 'Was sind Black Diamonds?',
      answer: 'Black Diamonds sind die virtuelle Währung von SPYNNERS. Sie ermöglichen den Zugang zu exklusiven VIP-Tracks und Premium-Inhalten.',
    },
    {
      question: 'Wie lade ich einen Track hoch?',
      answer: 'Gehe zum "Upload"-Tab, fülle die Informationen deines Tracks aus (Titel, Künstler, Genre usw.) und wähle deine Audiodatei aus.',
    },
    {
      question: 'Wie funktioniert SPYN?',
      answer: 'SPYN verwendet Audioerkennung, um Tracks zu identifizieren. Drücke den SPYN-Button und lass dein Handy 10 Sekunden lang die Musik hören.',
    },
    {
      question: 'Kann ich mehrere Playlists erstellen?',
      answer: 'Ja! Gehe zum Playlist-Tab und drücke den +-Button, um eine neue Playlist zu erstellen. Du kannst so viele erstellen, wie du möchtest.',
    },
    {
      question: 'Wie werde ich Produzent bei SPYNNERS?',
      answer: 'Erstelle ein Konto, lade deine Tracks hoch und sie werden von unserem Team innerhalb von 24-48h validiert. Nach der Genehmigung sind sie für alle DJs verfügbar.',
    },
    {
      question: 'Sind Tracks kostenlos?',
      answer: 'Die meisten Tracks sind kostenlos. Nur VIP-Tracks (mit goldenem Abzeichen markiert) erfordern Black Diamonds.',
    },
  ],
  zh: [
    {
      question: '如何下载曲目？',
      answer: '点击任何曲目上的"下载"按钮。对于VIP曲目，您需要Black Diamonds。',
    },
    {
      question: '什么是Black Diamonds？',
      answer: 'Black Diamonds是SPYNNERS的虚拟货币。它们可以访问独家VIP曲目和高级内容。',
    },
    {
      question: '如何上传曲目？',
      answer: '转到"上传"标签，填写曲目信息（标题、艺术家、流派等）并选择您的音频文件。',
    },
    {
      question: 'SPYN如何工作？',
      answer: 'SPYN使用音频识别来识别曲目。按下SPYN按钮，让手机听10秒钟的音乐。',
    },
    {
      question: '我可以创建多个播放列表吗？',
      answer: '可以！转到播放列表标签，按+按钮创建新播放列表。您可以创建任意多个。',
    },
    {
      question: '如何成为SPYNNERS制作人？',
      answer: '创建账户，上传曲目，我们的团队将在24-48小时内验证。批准后，所有DJ都可以使用它们。',
    },
    {
      question: '曲目是免费的吗？',
      answer: '大多数曲目是免费的。只有VIP曲目（标有金色徽章）需要Black Diamonds。',
    },
  ],
};

export default function HelpScreen() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [contactMessage, setContactMessage] = useState('');

  // Get FAQ items for current language, fallback to English
  const currentFaqItems = FAQ_ITEMS[language] || FAQ_ITEMS['en'];

  const toggleFAQ = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleContact = () => {
    if (!contactMessage.trim()) {
      Alert.alert(
        t('common.error'),
        t('help.writeMessage')
      );
      return;
    }

    Alert.alert(
      t('common.success') + ' ✉️',
      language === 'fr' ? 'Notre équipe vous répondra sous 24-48h.' : 
      language === 'es' ? 'Nuestro equipo te responderá en 24-48h.' :
      'Our team will respond within 24-48h.',
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
        
        {currentFaqItems.map((item, index) => (
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
