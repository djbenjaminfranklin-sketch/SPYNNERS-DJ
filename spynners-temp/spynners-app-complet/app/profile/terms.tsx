import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';
import { useLanguage } from '../../src/contexts/LanguageContext';

export default function TermsScreen() {
  const router = useRouter();
  const { language, t } = useLanguage();

  const isEnglish = language === 'en';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('termsOfUse')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.lastUpdate}>
          {isEnglish ? 'Last updated: December 2024' : 'Dernière mise à jour: Décembre 2024'}
        </Text>

        <Text style={styles.sectionTitle}>
          {isEnglish ? '1. Acceptance of Terms' : '1. Acceptation des conditions'}
        </Text>
        <Text style={styles.paragraph}>
          {isEnglish 
            ? 'By using the SPYNNERS application, you agree to be bound by these terms of use. If you do not accept these terms, please do not use the application.'
            : 'En utilisant l\'application SPYNNERS, vous acceptez d\'être lié par ces conditions d\'utilisation. Si vous n\'acceptez pas ces conditions, veuillez ne pas utiliser l\'application.'}
        </Text>

        <Text style={styles.sectionTitle}>
          {isEnglish ? '2. Service Description' : '2. Description du service'}
        </Text>
        <Text style={styles.paragraph}>
          {isEnglish
            ? 'SPYNNERS is a free music promotion platform for DJs and producers. It allows downloading tracks, uploading music and discovering new artists.'
            : 'SPYNNERS est une plateforme de promotion musicale gratuite pour les DJs et les producteurs. Elle permet de télécharger des tracks, d\'uploader de la musique et de découvrir de nouveaux artistes.'}
        </Text>

        <Text style={styles.sectionTitle}>
          {isEnglish ? '3. User Account' : '3. Compte utilisateur'}
        </Text>
        <Text style={styles.paragraph}>
          {isEnglish
            ? '• You must be at least 13 years old to create an account.\n• You are responsible for the confidentiality of your credentials.\n• You agree to provide accurate information.\n• Only one account per person is allowed.'
            : '• Vous devez avoir au moins 13 ans pour créer un compte.\n• Vous êtes responsable de la confidentialité de vos identifiants.\n• Vous vous engagez à fournir des informations exactes.\n• Un seul compte par personne est autorisé.'}
        </Text>

        <Text style={styles.sectionTitle}>
          {isEnglish ? '4. User Content' : '4. Contenu utilisateur'}
        </Text>
        <Text style={styles.paragraph}>
          {isEnglish
            ? 'By uploading content to SPYNNERS, you certify:\n• Being the owner or having the necessary rights.\n• That the content does not violate any copyright.\n• That the content is appropriate and legal.\n• Granting us a license to distribute the content.'
            : 'En uploadant du contenu sur SPYNNERS, vous certifiez:\n• Être le propriétaire ou avoir les droits nécessaires.\n• Que le contenu ne viole aucun droit d\'auteur.\n• Que le contenu est approprié et légal.\n• Nous accorder une licence pour distribuer le contenu.'}
        </Text>

        <Text style={styles.sectionTitle}>
          {isEnglish ? '5. Black Diamonds' : '5. Black Diamonds'}
        </Text>
        <Text style={styles.paragraph}>
          {isEnglish
            ? '• Black Diamonds are non-refundable virtual currency.\n• They allow access to VIP content.\n• Prices are displayed including taxes.\n• No refunds after purchase.'
            : '• Les Black Diamonds sont une monnaie virtuelle non remboursable.\n• Ils permettent d\'accéder au contenu VIP.\n• Les prix sont affichés TTC.\n• Aucun remboursement après achat.'}
        </Text>

        <Text style={styles.sectionTitle}>
          {isEnglish ? '6. Intellectual Property' : '6. Propriété intellectuelle'}
        </Text>
        <Text style={styles.paragraph}>
          {isEnglish
            ? 'All application content (logo, design, code) is the property of SPYNNERS. Uploaded tracks remain the property of their respective authors.'
            : 'Tout le contenu de l\'application (logo, design, code) est la propriété de SPYNNERS. Les tracks uploadées restent la propriété de leurs auteurs respectifs.'}
        </Text>

        <Text style={styles.sectionTitle}>
          {isEnglish ? '7. Prohibited Behavior' : '7. Comportement interdit'}
        </Text>
        <Text style={styles.paragraph}>
          {isEnglish
            ? 'It is prohibited to:\n• Upload illegal or pirated content.\n• Use the application for unauthorized commercial purposes.\n• Attempt to bypass security measures.\n• Harass or harm other users.'
            : 'Il est interdit de:\n• Uploader du contenu illégal ou piraté.\n• Utiliser l\'application à des fins commerciales non autorisées.\n• Tenter de contourner les mesures de sécurité.\n• Harceler ou nuire aux autres utilisateurs.'}
        </Text>

        <Text style={styles.sectionTitle}>
          {isEnglish ? '8. Limitation of Liability' : '8. Limitation de responsabilité'}
        </Text>
        <Text style={styles.paragraph}>
          {isEnglish
            ? 'SPYNNERS cannot be held responsible for direct or indirect damages resulting from the use of the application. The service is provided "as is".'
            : 'SPYNNERS ne peut être tenu responsable des dommages directs ou indirects résultant de l\'utilisation de l\'application. Le service est fourni "tel quel".'}
        </Text>

        <Text style={styles.sectionTitle}>
          {isEnglish ? '9. Modifications' : '9. Modifications'}
        </Text>
        <Text style={styles.paragraph}>
          {isEnglish
            ? 'We reserve the right to modify these terms at any time. Users will be informed of important changes.'
            : 'Nous nous réservons le droit de modifier ces conditions à tout moment. Les utilisateurs seront informés des changements importants.'}
        </Text>

        <Text style={styles.sectionTitle}>
          {isEnglish ? '10. Contact' : '10. Contact'}
        </Text>
        <Text style={styles.paragraph}>
          {isEnglish
            ? 'For any questions regarding these terms, contact us at:\nsupport@spynners.com'
            : 'Pour toute question concernant ces conditions, contactez-nous à:\nsupport@spynners.com'}
        </Text>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>
          {isEnglish ? 'Privacy Policy' : 'Politique de confidentialité'}
        </Text>
        
        <Text style={styles.subTitle}>
          {isEnglish ? 'Data Collected' : 'Données collectées'}
        </Text>
        <Text style={styles.paragraph}>
          {isEnglish
            ? '• Account information (name, email)\n• Usage data (tracks listened, downloads)\n• Technical data (device, IP)'
            : '• Informations de compte (nom, email)\n• Données d\'utilisation (tracks écoutées, téléchargements)\n• Données techniques (appareil, IP)'}
        </Text>

        <Text style={styles.subTitle}>
          {isEnglish ? 'Data Usage' : 'Utilisation des données'}
        </Text>
        <Text style={styles.paragraph}>
          {isEnglish
            ? 'Your data is used to:\n• Provide and improve the service\n• Personalize your experience\n• Communicate with you\n• Ensure platform security'
            : 'Vos données sont utilisées pour:\n• Fournir et améliorer le service\n• Personnaliser votre expérience\n• Communiquer avec vous\n• Assurer la sécurité de la plateforme'}
        </Text>

        <Text style={styles.subTitle}>
          {isEnglish ? 'Your Rights' : 'Vos droits'}
        </Text>
        <Text style={styles.paragraph}>
          {isEnglish
            ? 'In accordance with GDPR, you have the right to:\n• Access your data\n• Modify or delete them\n• Object to their processing\n• Request their portability'
            : 'Conformément au RGPD, vous avez le droit de:\n• Accéder à vos données\n• Les modifier ou les supprimer\n• Vous opposer à leur traitement\n• Demander leur portabilité'}
        </Text>

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
  headerTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
  content: { flex: 1, padding: Spacing.lg },
  lastUpdate: { fontSize: 12, color: Colors.textMuted, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: Colors.primary, marginTop: 20, marginBottom: 10 },
  subTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginTop: 16, marginBottom: 8 },
  paragraph: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 24 },
});
