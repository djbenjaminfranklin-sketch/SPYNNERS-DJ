import React from 'react';
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

const LEGAL_CONTENT: Record<string, {
  title: string;
  lastUpdate: string;
  sections: { title: string; content: string }[];
}> = {
  en: {
    title: 'Legal Notice',
    lastUpdate: 'Last updated: November 2025',
    sections: [
      {
        title: '1. Site Editor',
        content: 'The SPYNNERS site is edited by:\n\n• Legal form: Self-employed\n• Address: Calle logo de los cisnes\n• Email: contact@spynners.com'
      },
      {
        title: '2. Hosting',
        content: 'The site is hosted by: base44\n\nAddress: 44 Halstead Rd, Wanstead, London, E11 2AZ'
      },
      {
        title: '3. Intellectual Property',
        content: 'The content of the site (texts, images, logo, design, code…) is protected by copyright. Any unauthorized reproduction is prohibited.\n\nTracks uploaded by users remain the exclusive property of their authors, in accordance with the Terms of Use.'
      },
      {
        title: '4. Responsibility',
        content: 'The editor cannot be held responsible for content uploaded by users. Any claim must be addressed to: contact@spynners.com'
      },
      {
        title: '5. Contact',
        content: 'For any questions: contact@spynners.com'
      },
    ],
  },
  fr: {
    title: 'Mentions Légales',
    lastUpdate: 'Dernière mise à jour: Novembre 2025',
    sections: [
      {
        title: '1. Éditeur du site',
        content: 'Le site SPYNNERS est édité par:\n\n• Forme juridique: Auto-entrepreneur\n• Adresse: Calle logo de los cisnes\n• Email: contact@spynners.com'
      },
      {
        title: '2. Hébergement',
        content: 'Le site est hébergé par: base44\n\nAdresse: 44 Halstead Rd, Wanstead, London, E11 2AZ'
      },
      {
        title: '3. Propriété intellectuelle',
        content: 'Le contenu du site (textes, images, logo, design, code…) est protégé par le droit d\'auteur. Toute reproduction non autorisée est interdite.\n\nLes tracks uploadées par les utilisateurs restent la propriété exclusive de leurs auteurs, conformément aux Conditions d\'Utilisation.'
      },
      {
        title: '4. Responsabilité',
        content: 'L\'éditeur ne peut être tenu responsable du contenu uploadé par les utilisateurs. Toute réclamation doit être adressée à: contact@spynners.com'
      },
      {
        title: '5. Contact',
        content: 'Pour toute question: contact@spynners.com'
      },
    ],
  },
};

export default function LegalScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const content = LEGAL_CONTENT[language] || LEGAL_CONTENT.en;

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
        <Text style={styles.headerTitle}>{content.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdate}>{content.lastUpdate}</Text>

        {content.sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        {/* Contact Button */}
        <TouchableOpacity style={styles.contactButton} onPress={handleEmailPress}>
          <Ionicons name="mail" size={20} color="#fff" />
          <Text style={styles.contactButtonText}>contact@spynners.com</Text>
        </TouchableOpacity>

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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  lastUpdate: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  section: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  sectionContent: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: 8,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
