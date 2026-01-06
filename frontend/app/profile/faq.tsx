import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { useLanguage } from '../../src/contexts/LanguageContext';

const FAQ_CONTENT: Record<string, {
  title: string;
  subtitle: string;
  questions: { icon: string; question: string; answer: string }[];
  contactTitle: string;
  contactText: string;
}> = {
  en: {
    title: 'FAQ',
    subtitle: 'Frequently Asked Questions',
    questions: [
      {
        icon: '🔊',
        question: 'What is SPYNNERS?',
        answer: 'SPYNNERS is a free music promotion platform that connects DJs and producers. It allows producers to share their tracks and DJs to discover new music for their sets. When a DJ plays a track, the producer is notified in real-time!'
      },
      {
        icon: '🎵',
        question: 'Is it free?',
        answer: 'Yes! SPYNNERS is completely free for both DJs and producers. Upload your tracks, download music, and connect with the community without any subscription or hidden fees.'
      },
      {
        icon: '🛡️',
        question: 'Is it legal?',
        answer: 'Absolutely. SPYNNERS only hosts content uploaded by rights holders. By uploading a track, you certify that you own the rights or have authorization to share it. We comply with DMCA regulations and remove any infringing content upon valid request.'
      },
      {
        icon: '👨‍🎤',
        question: 'Can I upload any track?',
        answer: 'You can only upload tracks for which you hold the rights (original productions, authorized remixes). Pirated content, unauthorized remixes, or tracks with undeclared samples are strictly prohibited.'
      },
      {
        icon: '⬇️',
        question: 'Can DJs download the tracks?',
        answer: 'Yes, if the producer enables the download option for their track. Producers have full control over whether their music can be downloaded or only streamed.'
      },
      {
        icon: '⭐',
        question: 'How does the rating system work?',
        answer: 'DJs can rate tracks they listen to. High-rated tracks get more visibility and can be featured in playlists. It helps quality music rise to the top!'
      },
      {
        icon: '🚫',
        question: 'What to do if someone stole my track?',
        answer: 'Contact us immediately at contact@spynners.com with:\n• The link to the infringing content\n• Proof that you own the rights\n• Your contact information\n\nWe will remove the content as soon as possible.'
      },
      {
        icon: '💾',
        question: 'Can I delete my track?',
        answer: 'Yes, you can delete your tracks at any time from your profile. Once deleted, the track will no longer be available for streaming or download.'
      },
      {
        icon: '🔐',
        question: 'Is my data protected?',
        answer: 'Yes! We comply with GDPR regulations. Your data is encrypted, stored securely, and never sold to third parties. You can request deletion of your data at any time.'
      },
      {
        icon: '📱',
        question: 'Is there a mobile app?',
        answer: 'Yes! You\'re using it right now! The SPYNNERS app is available on iOS and Android, with features like track recognition, offline mode, and real-time DJ notifications.'
      },
      {
        icon: '💎',
        question: 'What are Black Diamonds?',
        answer: 'Black Diamonds are virtual rewards earned when DJs play your tracks in verified clubs. They can be used to access exclusive VIP content and premium features.'
      },
    ],
    contactTitle: 'Can\'t find your answer?',
    contactText: 'Feel free to contact us directly!',
  },
  fr: {
    title: 'FAQ',
    subtitle: 'Questions Fréquentes',
    questions: [
      {
        icon: '🔊',
        question: 'Qu\'est-ce que SPYNNERS ?',
        answer: 'SPYNNERS est une plateforme gratuite de promotion musicale qui connecte DJs et producteurs. Elle permet aux producteurs de partager leurs tracks et aux DJs de découvrir de nouvelles musiques pour leurs sets. Quand un DJ joue une track, le producteur est notifié en temps réel !'
      },
      {
        icon: '🎵',
        question: 'Est-ce gratuit ?',
        answer: 'Oui ! SPYNNERS est entièrement gratuit pour les DJs comme pour les producteurs. Uploadez vos tracks, téléchargez de la musique et connectez-vous avec la communauté sans abonnement ni frais cachés.'
      },
      {
        icon: '🛡️',
        question: 'Est-ce légal ?',
        answer: 'Absolument. SPYNNERS n\'héberge que du contenu uploadé par les titulaires de droits. En uploadant une track, vous certifiez que vous détenez les droits ou avez l\'autorisation de la partager. Nous respectons les réglementations DMCA et retirons tout contenu illicite sur demande valide.'
      },
      {
        icon: '👨‍🎤',
        question: 'Puis-je uploader n\'importe quelle track ?',
        answer: 'Vous ne pouvez uploader que des tracks dont vous détenez les droits (productions originales, remixes autorisés). Le contenu piraté, les remixes non autorisés ou les tracks avec des samples non déclarés sont strictement interdits.'
      },
      {
        icon: '⬇️',
        question: 'Les DJs peuvent-ils télécharger les tracks ?',
        answer: 'Oui, si le producteur active l\'option de téléchargement pour sa track. Les producteurs ont un contrôle total sur le fait que leur musique puisse être téléchargée ou seulement streamée.'
      },
      {
        icon: '⭐',
        question: 'Comment fonctionne le système de notation ?',
        answer: 'Les DJs peuvent noter les tracks qu\'ils écoutent. Les tracks bien notées gagnent en visibilité et peuvent être mises en avant dans des playlists. Cela aide la musique de qualité à émerger !'
      },
      {
        icon: '🚫',
        question: 'Que faire si quelqu\'un a volé ma track ?',
        answer: 'Contactez-nous immédiatement à contact@spynners.com avec:\n• Le lien vers le contenu illicite\n• La preuve que vous détenez les droits\n• Vos coordonnées\n\nNous retirerons le contenu dans les plus brefs délais.'
      },
      {
        icon: '💾',
        question: 'Puis-je supprimer ma track ?',
        answer: 'Oui, vous pouvez supprimer vos tracks à tout moment depuis votre profil. Une fois supprimée, la track ne sera plus disponible en streaming ou téléchargement.'
      },
      {
        icon: '🔐',
        question: 'Mes données sont-elles protégées ?',
        answer: 'Oui ! Nous respectons les réglementations RGPD. Vos données sont cryptées, stockées de manière sécurisée et jamais vendues à des tiers. Vous pouvez demander la suppression de vos données à tout moment.'
      },
      {
        icon: '📱',
        question: 'Y a-t-il une application mobile ?',
        answer: 'Oui ! Vous l\'utilisez en ce moment ! L\'application SPYNNERS est disponible sur iOS et Android, avec des fonctionnalités comme la reconnaissance de tracks, le mode hors-ligne et les notifications DJ en temps réel.'
      },
      {
        icon: '💎',
        question: 'Que sont les Black Diamonds ?',
        answer: 'Les Black Diamonds sont des récompenses virtuelles gagnées quand des DJs jouent vos tracks dans des clubs vérifiés. Ils peuvent être utilisés pour accéder à du contenu VIP exclusif et des fonctionnalités premium.'
      },
    ],
    contactTitle: 'Vous n\'avez pas trouvé votre réponse ?',
    contactText: 'N\'hésitez pas à nous contacter directement !',
  },
};

export default function FAQScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const content = FAQ_CONTENT[language] || FAQ_CONTENT.en;
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  const handleEmailPress = () => {
    Linking.openURL('mailto:contact@spynners.com');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{content.title}</Text>
          <Text style={styles.headerSubtitle}>{content.subtitle}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {content.questions.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.questionCard,
              expandedQuestion === index && styles.questionCardExpanded
            ]}
            onPress={() => setExpandedQuestion(expandedQuestion === index ? null : index)}
            activeOpacity={0.7}
          >
            <View style={styles.questionHeader}>
              <Text style={styles.questionIcon}>{item.icon}</Text>
              <Text style={styles.questionText}>{item.question}</Text>
              <Ionicons
                name={expandedQuestion === index ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.primary}
              />
            </View>
            {expandedQuestion === index && (
              <Text style={styles.answerText}>{item.answer}</Text>
            )}
          </TouchableOpacity>
        ))}

        {/* Contact Section */}
        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>{content.contactTitle}</Text>
          <Text style={styles.contactText}>{content.contactText}</Text>
          <TouchableOpacity style={styles.contactButton} onPress={handleEmailPress}>
            <Ionicons name="mail" size={20} color="#fff" />
            <Text style={styles.contactButtonText}>contact@spynners.com</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  questionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  questionCardExpanded: {
    borderColor: Colors.primary,
    borderWidth: 1,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  questionIcon: {
    fontSize: 20,
    marginRight: Spacing.sm,
  },
  questionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  answerText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  contactSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  contactText: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    gap: 8,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
