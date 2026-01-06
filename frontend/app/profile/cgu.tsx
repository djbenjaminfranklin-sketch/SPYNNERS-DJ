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

const CGU_CONTENT: Record<string, {
  title: string;
  lastUpdate: string;
  intro: string;
  sections: { title: string; content: string }[];
}> = {
  en: {
    title: 'Terms of Use',
    lastUpdate: 'Last updated: November 2025',
    intro: 'By using the Platform, the user accepts these Terms of Use without reservation.',
    sections: [
      {
        title: '1. Purpose',
        content: 'These Terms of Use define the terms of access and use of the platform (hereinafter the "Platform"), allowing users to upload, share and promote their music productions ("Content").'
      },
      {
        title: '2. Access to the Service',
        content: 'The Platform allows:\n\n• Uploading music productions\n• Making them accessible to the DJ and producer community\n• Authorizing their listening, downloading or use for artist promotion\n• Commenting, rating and sharing Content\n\nSome features may be reserved for registered members.'
      },
      {
        title: '3. User Responsibility',
        content: 'The user declares and guarantees:\n\n• Being the author of the uploaded Content or holding all necessary rights for its distribution\n• Not violating the rights of any third party (label, distributor, publisher, co-author, etc.)\n• That their Content is free of any legal claim preventing its upload\n\nThe user is solely responsible for the Content they upload.'
      },
      {
        title: '4. License Granted',
        content: 'By uploading Content, the user grants the Platform a free, non-exclusive, worldwide license to:\n\n• Host their Content\n• Distribute their Content on the site and application\n• Allow streaming\n• Authorize downloading (if the user enables this option)\n• Promote it as part of the Platform\'s operation\n\nThis license is granted without time limit, as long as the Content remains online. The user can delete their Content at any time, which terminates the license.'
      },
      {
        title: '5. Free Download Authorization',
        content: 'If the user checks the option "I make this track available for free download", they explicitly declare:\n\n"I authorize the Platform and its users to download my Content for free."\n\nWithout this checkbox, no download should be offered.'
      },
      {
        title: '6. Prohibited Content',
        content: 'It is strictly forbidden to upload:\n\n• Works for which the user does not hold the rights\n• Unauthorized remixes\n• Undeclared samples\n• Defamatory, violent, hateful or illegal content\n• Content violating intellectual property rules or privacy\n\nAny Content in violation may be removed without notice.'
      },
      {
        title: '7. Removal Procedure (DMCA)',
        content: 'Any rights holder can report disputed Content by contacting: contact@spynners.com\n\nThe request must include:\n• The Content link\n• Proof of rights ownership\n• A statement that the information provided is accurate\n\nUpon receipt of a valid request, the Platform commits to removing the Content as soon as possible.'
      },
      {
        title: '8. Platform Responsibility',
        content: 'The Platform:\n\n• Is not responsible for uploaded Content\n• Does not perform systematic prior verification of rights\n• Only intervenes upon valid notification\n\nThe Platform implements the necessary means to ensure service availability, without guaranteeing total absence of errors or interruptions.'
      },
      {
        title: '9. Account Deletion',
        content: 'The Platform reserves the right to:\n\n• Suspend or delete an account\n• Remove any Content\n• Block a user\n\n...if they violate the TOU or in case of suspicion of fraud, plagiarism or copyright infringement.'
      },
      {
        title: '10. Personal Data (GDPR)',
        content: 'Under GDPR, the Platform collects only data strictly necessary for service operation. The user can request deletion of their data at any time via contact@spynners.com.'
      },
      {
        title: '11. Cookies',
        content: 'The Platform uses cookies for:\n\n• Navigation and performance\n• Security\n• Track analysis and recognition\n• Real-time data (DJ online status, active session)\n• Preferences (language, display settings)\n\nThese cookies are essential for Spynners to function properly.'
      },
      {
        title: '12. Modifications',
        content: 'The Platform may modify the TOU at any time. The user will be informed of important modifications by email or notification.'
      },
      {
        title: '13. Applicable Law',
        content: 'These TOU are governed by French law. Any dispute relating to the use of the Platform will be submitted to the competent courts.'
      },
    ],
  },
  fr: {
    title: 'Conditions Générales d\'Utilisation',
    lastUpdate: 'Dernière mise à jour: Novembre 2025',
    intro: 'En utilisant la Plateforme, l\'utilisateur accepte ces Conditions Générales d\'Utilisation sans réserve.',
    sections: [
      {
        title: '1. Objet',
        content: 'Ces Conditions Générales d\'Utilisation définissent les modalités d\'accès et d\'utilisation de la plateforme (ci-après la "Plateforme"), permettant aux utilisateurs d\'uploader, partager et promouvoir leurs productions musicales ("Contenu").'
      },
      {
        title: '2. Accès au Service',
        content: 'La Plateforme permet:\n\n• D\'uploader des productions musicales\n• De les rendre accessibles à la communauté DJ et producteurs\n• D\'autoriser leur écoute, téléchargement ou utilisation pour la promotion des artistes\n• De commenter, noter et partager du Contenu\n\nCertaines fonctionnalités peuvent être réservées aux membres inscrits.'
      },
      {
        title: '3. Responsabilité de l\'Utilisateur',
        content: 'L\'utilisateur déclare et garantit:\n\n• Être l\'auteur du Contenu uploadé ou détenir tous les droits nécessaires à sa distribution\n• Ne pas violer les droits de tiers (label, distributeur, éditeur, co-auteur, etc.)\n• Que son Contenu est libre de toute réclamation juridique empêchant son upload\n\nL\'utilisateur est seul responsable du Contenu qu\'il uploade.'
      },
      {
        title: '4. Licence Accordée',
        content: 'En uploadant du Contenu, l\'utilisateur accorde à la Plateforme une licence gratuite, non exclusive et mondiale pour:\n\n• Héberger son Contenu\n• Distribuer son Contenu sur le site et l\'application\n• Permettre le streaming\n• Autoriser le téléchargement (si l\'utilisateur active cette option)\n• Le promouvoir dans le cadre du fonctionnement de la Plateforme\n\nCette licence est accordée sans limite de temps, tant que le Contenu reste en ligne. L\'utilisateur peut supprimer son Contenu à tout moment, ce qui met fin à la licence.'
      },
      {
        title: '5. Autorisation de Téléchargement Gratuit',
        content: 'Si l\'utilisateur coche l\'option "Je rends cette track disponible en téléchargement gratuit", il déclare explicitement:\n\n"J\'autorise la Plateforme et ses utilisateurs à télécharger mon Contenu gratuitement."\n\nSans cette case cochée, aucun téléchargement ne doit être proposé.'
      },
      {
        title: '6. Contenu Interdit',
        content: 'Il est strictement interdit d\'uploader:\n\n• Des œuvres dont l\'utilisateur ne détient pas les droits\n• Des remixes non autorisés\n• Des samples non déclarés\n• Du contenu diffamatoire, violent, haineux ou illégal\n• Du contenu violant les règles de propriété intellectuelle ou la vie privée\n\nTout Contenu en violation peut être supprimé sans préavis.'
      },
      {
        title: '7. Procédure de Retrait (DMCA)',
        content: 'Tout titulaire de droits peut signaler un Contenu litigieux en contactant: contact@spynners.com\n\nLa demande doit inclure:\n• Le lien du Contenu\n• La preuve de propriété des droits\n• Une déclaration que les informations fournies sont exactes\n\nSur réception d\'une demande valide, la Plateforme s\'engage à retirer le Contenu dans les plus brefs délais.'
      },
      {
        title: '8. Responsabilité de la Plateforme',
        content: 'La Plateforme:\n\n• N\'est pas responsable du Contenu uploadé\n• N\'effectue pas de vérification préalable systématique des droits\n• N\'intervient que sur notification valide\n\nLa Plateforme met en œuvre les moyens nécessaires pour assurer la disponibilité du service, sans garantir l\'absence totale d\'erreurs ou d\'interruptions.'
      },
      {
        title: '9. Suppression de Compte',
        content: 'La Plateforme se réserve le droit de:\n\n• Suspendre ou supprimer un compte\n• Retirer tout Contenu\n• Bloquer un utilisateur\n\n...s\'ils violent les CGU ou en cas de suspicion de fraude, plagiat ou violation de droits d\'auteur.'
      },
      {
        title: '10. Données Personnelles (RGPD)',
        content: 'En vertu du RGPD, la Plateforme ne collecte que les données strictement nécessaires au fonctionnement du service. L\'utilisateur peut demander la suppression de ses données à tout moment via contact@spynners.com.'
      },
      {
        title: '11. Cookies',
        content: 'La Plateforme utilise des cookies pour:\n\n• Navigation et performance\n• Sécurité\n• Analyse et reconnaissance des tracks\n• Données en temps réel (statut DJ en ligne, session active)\n• Préférences (langue, paramètres d\'affichage)\n\nCes cookies sont essentiels au bon fonctionnement de Spynners.'
      },
      {
        title: '12. Modifications',
        content: 'La Plateforme peut modifier les CGU à tout moment. L\'utilisateur sera informé des modifications importantes par email ou notification.'
      },
      {
        title: '13. Loi Applicable',
        content: 'Ces CGU sont régies par le droit français. Tout litige relatif à l\'utilisation de la Plateforme sera soumis aux tribunaux compétents.'
      },
    ],
  },
};

export default function CGUScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const content = CGU_CONTENT[language] || CGU_CONTENT.en;
  const [expandedSection, setExpandedSection] = useState<number | null>(null);

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
        <Text style={styles.intro}>{content.intro}</Text>

        {content.sections.map((section, index) => (
          <TouchableOpacity
            key={index}
            style={styles.section}
            onPress={() => setExpandedSection(expandedSection === index ? null : index)}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Ionicons
                name={expandedSection === index ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.primary}
              />
            </View>
            {expandedSection === index && (
              <Text style={styles.sectionContent}>{section.content}</Text>
            )}
          </TouchableOpacity>
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
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  intro: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  section: {
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  sectionContent: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    gap: 8,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
