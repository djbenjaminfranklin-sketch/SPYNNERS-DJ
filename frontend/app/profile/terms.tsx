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

// Terms content for all languages
const TERMS_CONTENT: Record<string, {
  lastUpdate: string;
  sections: { title: string; content: string }[];
  privacyTitle: string;
  privacySections: { title: string; content: string }[];
}> = {
  en: {
    lastUpdate: 'Last updated: December 2024',
    sections: [
      { title: '1. Acceptance of Terms', content: 'By using the SPYNNERS application, you agree to be bound by these terms of use. If you do not accept these terms, please do not use the application.' },
      { title: '2. Service Description', content: 'SPYNNERS is a free music promotion platform for DJs and producers. It allows downloading tracks, uploading music and discovering new artists.' },
      { title: '3. User Account', content: '• You must be at least 13 years old to create an account.\n• You are responsible for the confidentiality of your credentials.\n• You agree to provide accurate information.\n• Only one account per person is allowed.' },
      { title: '4. User Content', content: 'By uploading content to SPYNNERS, you certify:\n• Being the owner or having the necessary rights.\n• That the content does not violate any copyright.\n• That the content is appropriate and legal.\n• Granting us a license to distribute the content.' },
      { title: '5. Black Diamonds', content: '• Black Diamonds are non-refundable virtual currency.\n• They allow access to VIP content.\n• Prices are displayed including taxes.\n• No refunds after purchase.' },
      { title: '6. Intellectual Property', content: 'All application content (logo, design, code) is the property of SPYNNERS. Uploaded tracks remain the property of their respective authors.' },
      { title: '7. Prohibited Behavior', content: 'It is prohibited to:\n• Upload illegal or pirated content.\n• Use the application for unauthorized commercial purposes.\n• Attempt to bypass security measures.\n• Harass or harm other users.' },
      { title: '8. Limitation of Liability', content: 'SPYNNERS cannot be held responsible for direct or indirect damages resulting from the use of the application. The service is provided "as is".' },
      { title: '9. Modifications', content: 'We reserve the right to modify these terms at any time. Users will be informed of important changes.' },
      { title: '10. Contact', content: 'For any questions regarding these terms, contact us at:\nsupport@spynners.com' },
    ],
    privacyTitle: 'Privacy Policy',
    privacySections: [
      { title: 'Data Collected', content: '• Account information (name, email)\n• Usage data (tracks listened, downloads)\n• Technical data (device, IP)' },
      { title: 'Data Usage', content: 'Your data is used to:\n• Provide and improve the service\n• Personalize your experience\n• Communicate with you\n• Ensure platform security' },
      { title: 'Your Rights', content: 'In accordance with GDPR, you have the right to:\n• Access your data\n• Modify or delete them\n• Object to their processing\n• Request their portability' },
    ],
  },
  fr: {
    lastUpdate: 'Dernière mise à jour: Décembre 2024',
    sections: [
      { title: '1. Acceptation des conditions', content: 'En utilisant l\'application SPYNNERS, vous acceptez d\'être lié par ces conditions d\'utilisation. Si vous n\'acceptez pas ces conditions, veuillez ne pas utiliser l\'application.' },
      { title: '2. Description du service', content: 'SPYNNERS est une plateforme de promotion musicale gratuite pour les DJs et les producteurs. Elle permet de télécharger des tracks, d\'uploader de la musique et de découvrir de nouveaux artistes.' },
      { title: '3. Compte utilisateur', content: '• Vous devez avoir au moins 13 ans pour créer un compte.\n• Vous êtes responsable de la confidentialité de vos identifiants.\n• Vous vous engagez à fournir des informations exactes.\n• Un seul compte par personne est autorisé.' },
      { title: '4. Contenu utilisateur', content: 'En uploadant du contenu sur SPYNNERS, vous certifiez:\n• Être le propriétaire ou avoir les droits nécessaires.\n• Que le contenu ne viole aucun droit d\'auteur.\n• Que le contenu est approprié et légal.\n• Nous accorder une licence pour distribuer le contenu.' },
      { title: '5. Black Diamonds', content: '• Les Black Diamonds sont une monnaie virtuelle non remboursable.\n• Ils permettent d\'accéder au contenu VIP.\n• Les prix sont affichés TTC.\n• Aucun remboursement après achat.' },
      { title: '6. Propriété intellectuelle', content: 'Tout le contenu de l\'application (logo, design, code) est la propriété de SPYNNERS. Les tracks uploadées restent la propriété de leurs auteurs respectifs.' },
      { title: '7. Comportement interdit', content: 'Il est interdit de:\n• Uploader du contenu illégal ou piraté.\n• Utiliser l\'application à des fins commerciales non autorisées.\n• Tenter de contourner les mesures de sécurité.\n• Harceler ou nuire aux autres utilisateurs.' },
      { title: '8. Limitation de responsabilité', content: 'SPYNNERS ne peut être tenu responsable des dommages directs ou indirects résultant de l\'utilisation de l\'application. Le service est fourni "tel quel".' },
      { title: '9. Modifications', content: 'Nous nous réservons le droit de modifier ces conditions à tout moment. Les utilisateurs seront informés des changements importants.' },
      { title: '10. Contact', content: 'Pour toute question concernant ces conditions, contactez-nous à:\nsupport@spynners.com' },
    ],
    privacyTitle: 'Politique de confidentialité',
    privacySections: [
      { title: 'Données collectées', content: '• Informations de compte (nom, email)\n• Données d\'utilisation (tracks écoutées, téléchargements)\n• Données techniques (appareil, IP)' },
      { title: 'Utilisation des données', content: 'Vos données sont utilisées pour:\n• Fournir et améliorer le service\n• Personnaliser votre expérience\n• Communiquer avec vous\n• Assurer la sécurité de la plateforme' },
      { title: 'Vos droits', content: 'Conformément au RGPD, vous avez le droit de:\n• Accéder à vos données\n• Les modifier ou les supprimer\n• Vous opposer à leur traitement\n• Demander leur portabilité' },
    ],
  },
  es: {
    lastUpdate: 'Última actualización: Diciembre 2024',
    sections: [
      { title: '1. Aceptación de términos', content: 'Al usar la aplicación SPYNNERS, aceptas estar sujeto a estos términos de uso. Si no aceptas estos términos, por favor no uses la aplicación.' },
      { title: '2. Descripción del servicio', content: 'SPYNNERS es una plataforma gratuita de promoción musical para DJs y productores. Permite descargar tracks, subir música y descubrir nuevos artistas.' },
      { title: '3. Cuenta de usuario', content: '• Debes tener al menos 13 años para crear una cuenta.\n• Eres responsable de la confidencialidad de tus credenciales.\n• Te comprometes a proporcionar información precisa.\n• Solo se permite una cuenta por persona.' },
      { title: '4. Contenido del usuario', content: 'Al subir contenido a SPYNNERS, certificas:\n• Ser el propietario o tener los derechos necesarios.\n• Que el contenido no viola ningún derecho de autor.\n• Que el contenido es apropiado y legal.\n• Otorgarnos una licencia para distribuir el contenido.' },
      { title: '5. Black Diamonds', content: '• Los Black Diamonds son moneda virtual no reembolsable.\n• Permiten acceso a contenido VIP.\n• Los precios incluyen impuestos.\n• No hay reembolsos después de la compra.' },
      { title: '6. Propiedad intelectual', content: 'Todo el contenido de la aplicación (logo, diseño, código) es propiedad de SPYNNERS. Los tracks subidos siguen siendo propiedad de sus respectivos autores.' },
      { title: '7. Comportamiento prohibido', content: 'Está prohibido:\n• Subir contenido ilegal o pirateado.\n• Usar la aplicación para fines comerciales no autorizados.\n• Intentar evadir medidas de seguridad.\n• Acosar o dañar a otros usuarios.' },
      { title: '8. Limitación de responsabilidad', content: 'SPYNNERS no puede ser responsable por daños directos o indirectos resultantes del uso de la aplicación. El servicio se proporciona "tal cual".' },
      { title: '9. Modificaciones', content: 'Nos reservamos el derecho de modificar estos términos en cualquier momento. Los usuarios serán informados de cambios importantes.' },
      { title: '10. Contacto', content: 'Para cualquier pregunta sobre estos términos, contáctanos en:\nsupport@spynners.com' },
    ],
    privacyTitle: 'Política de Privacidad',
    privacySections: [
      { title: 'Datos recopilados', content: '• Información de cuenta (nombre, email)\n• Datos de uso (tracks escuchados, descargas)\n• Datos técnicos (dispositivo, IP)' },
      { title: 'Uso de datos', content: 'Tus datos se utilizan para:\n• Proporcionar y mejorar el servicio\n• Personalizar tu experiencia\n• Comunicarnos contigo\n• Garantizar la seguridad de la plataforma' },
      { title: 'Tus derechos', content: 'De acuerdo con GDPR, tienes derecho a:\n• Acceder a tus datos\n• Modificarlos o eliminarlos\n• Oponerte a su procesamiento\n• Solicitar su portabilidad' },
    ],
  },
  it: {
    lastUpdate: 'Ultimo aggiornamento: Dicembre 2024',
    sections: [
      { title: '1. Accettazione dei termini', content: 'Utilizzando l\'applicazione SPYNNERS, accetti di essere vincolato da questi termini di utilizzo. Se non accetti questi termini, non utilizzare l\'applicazione.' },
      { title: '2. Descrizione del servizio', content: 'SPYNNERS è una piattaforma gratuita di promozione musicale per DJ e produttori. Permette di scaricare tracce, caricare musica e scoprire nuovi artisti.' },
      { title: '3. Account utente', content: '• Devi avere almeno 13 anni per creare un account.\n• Sei responsabile della riservatezza delle tue credenziali.\n• Ti impegni a fornire informazioni accurate.\n• È consentito un solo account per persona.' },
      { title: '4. Contenuto utente', content: 'Caricando contenuti su SPYNNERS, certifichi:\n• Di essere il proprietario o di avere i diritti necessari.\n• Che il contenuto non viola alcun diritto d\'autore.\n• Che il contenuto è appropriato e legale.\n• Di concederci una licenza per distribuire il contenuto.' },
      { title: '5. Black Diamonds', content: '• I Black Diamonds sono valuta virtuale non rimborsabile.\n• Permettono l\'accesso a contenuti VIP.\n• I prezzi sono comprensivi di tasse.\n• Nessun rimborso dopo l\'acquisto.' },
      { title: '6. Proprietà intellettuale', content: 'Tutto il contenuto dell\'applicazione (logo, design, codice) è proprietà di SPYNNERS. Le tracce caricate rimangono proprietà dei rispettivi autori.' },
      { title: '7. Comportamento vietato', content: 'È vietato:\n• Caricare contenuti illegali o piratati.\n• Utilizzare l\'applicazione per scopi commerciali non autorizzati.\n• Tentare di aggirare le misure di sicurezza.\n• Molestare o danneggiare altri utenti.' },
      { title: '8. Limitazione di responsabilità', content: 'SPYNNERS non può essere ritenuto responsabile per danni diretti o indiretti derivanti dall\'uso dell\'applicazione. Il servizio è fornito "così com\'è".' },
      { title: '9. Modifiche', content: 'Ci riserviamo il diritto di modificare questi termini in qualsiasi momento. Gli utenti saranno informati delle modifiche importanti.' },
      { title: '10. Contatto', content: 'Per qualsiasi domanda riguardo questi termini, contattaci a:\nsupport@spynners.com' },
    ],
    privacyTitle: 'Informativa sulla Privacy',
    privacySections: [
      { title: 'Dati raccolti', content: '• Informazioni account (nome, email)\n• Dati di utilizzo (tracce ascoltate, download)\n• Dati tecnici (dispositivo, IP)' },
      { title: 'Utilizzo dei dati', content: 'I tuoi dati vengono utilizzati per:\n• Fornire e migliorare il servizio\n• Personalizzare la tua esperienza\n• Comunicare con te\n• Garantire la sicurezza della piattaforma' },
      { title: 'I tuoi diritti', content: 'In conformità con il GDPR, hai il diritto di:\n• Accedere ai tuoi dati\n• Modificarli o eliminarli\n• Opporti al loro trattamento\n• Richiedere la loro portabilità' },
    ],
  },
  de: {
    lastUpdate: 'Letzte Aktualisierung: Dezember 2024',
    sections: [
      { title: '1. Annahme der Bedingungen', content: 'Durch die Nutzung der SPYNNERS-Anwendung erklären Sie sich mit diesen Nutzungsbedingungen einverstanden. Wenn Sie diese Bedingungen nicht akzeptieren, nutzen Sie die Anwendung bitte nicht.' },
      { title: '2. Beschreibung des Dienstes', content: 'SPYNNERS ist eine kostenlose Musikpromotion-Plattform für DJs und Produzenten. Sie ermöglicht das Herunterladen von Tracks, das Hochladen von Musik und das Entdecken neuer Künstler.' },
      { title: '3. Benutzerkonto', content: '• Sie müssen mindestens 13 Jahre alt sein, um ein Konto zu erstellen.\n• Sie sind für die Vertraulichkeit Ihrer Zugangsdaten verantwortlich.\n• Sie verpflichten sich, genaue Informationen anzugeben.\n• Pro Person ist nur ein Konto erlaubt.' },
      { title: '4. Benutzerinhalte', content: 'Beim Hochladen von Inhalten auf SPYNNERS bestätigen Sie:\n• Eigentümer zu sein oder die erforderlichen Rechte zu haben.\n• Dass der Inhalt keine Urheberrechte verletzt.\n• Dass der Inhalt angemessen und legal ist.\n• Uns eine Lizenz zur Verteilung des Inhalts zu erteilen.' },
      { title: '5. Black Diamonds', content: '• Black Diamonds sind nicht erstattungsfähige virtuelle Währung.\n• Sie ermöglichen den Zugang zu VIP-Inhalten.\n• Die Preise verstehen sich inklusive Steuern.\n• Keine Erstattung nach dem Kauf.' },
      { title: '6. Geistiges Eigentum', content: 'Alle Anwendungsinhalte (Logo, Design, Code) sind Eigentum von SPYNNERS. Hochgeladene Tracks bleiben Eigentum ihrer jeweiligen Autoren.' },
      { title: '7. Verbotenes Verhalten', content: 'Es ist verboten:\n• Illegale oder raubkopierte Inhalte hochzuladen.\n• Die Anwendung für nicht autorisierte kommerzielle Zwecke zu nutzen.\n• Zu versuchen, Sicherheitsmaßnahmen zu umgehen.\n• Andere Benutzer zu belästigen oder zu schädigen.' },
      { title: '8. Haftungsbeschränkung', content: 'SPYNNERS kann nicht für direkte oder indirekte Schäden haftbar gemacht werden, die aus der Nutzung der Anwendung resultieren. Der Dienst wird "wie besehen" bereitgestellt.' },
      { title: '9. Änderungen', content: 'Wir behalten uns das Recht vor, diese Bedingungen jederzeit zu ändern. Benutzer werden über wichtige Änderungen informiert.' },
      { title: '10. Kontakt', content: 'Bei Fragen zu diesen Bedingungen kontaktieren Sie uns unter:\nsupport@spynners.com' },
    ],
    privacyTitle: 'Datenschutzrichtlinie',
    privacySections: [
      { title: 'Erhobene Daten', content: '• Kontoinformationen (Name, E-Mail)\n• Nutzungsdaten (gehörte Tracks, Downloads)\n• Technische Daten (Gerät, IP)' },
      { title: 'Verwendung der Daten', content: 'Ihre Daten werden verwendet um:\n• Den Dienst bereitzustellen und zu verbessern\n• Ihre Erfahrung zu personalisieren\n• Mit Ihnen zu kommunizieren\n• Die Plattformsicherheit zu gewährleisten' },
      { title: 'Ihre Rechte', content: 'Gemäß DSGVO haben Sie das Recht:\n• Auf Ihre Daten zuzugreifen\n• Sie zu ändern oder zu löschen\n• Ihrer Verarbeitung zu widersprechen\n• Ihre Übertragbarkeit zu verlangen' },
    ],
  },
  zh: {
    lastUpdate: '最后更新：2024年12月',
    sections: [
      { title: '1. 接受条款', content: '使用SPYNNERS应用程序，即表示您同意受这些使用条款的约束。如果您不接受这些条款，请不要使用该应用程序。' },
      { title: '2. 服务描述', content: 'SPYNNERS是一个免费的DJ和制作人音乐推广平台。它允许下载曲目、上传音乐和发现新艺术家。' },
      { title: '3. 用户账户', content: '• 您必须年满13岁才能创建账户。\n• 您对凭据的保密性负责。\n• 您同意提供准确的信息。\n• 每人只允许一个账户。' },
      { title: '4. 用户内容', content: '上传内容到SPYNNERS时，您确认：\n• 是所有者或拥有必要的权利。\n• 内容不侵犯任何版权。\n• 内容是适当且合法的。\n• 授予我们分发内容的许可。' },
      { title: '5. Black Diamonds', content: '• Black Diamonds是不可退款的虚拟货币。\n• 它们允许访问VIP内容。\n• 价格已含税。\n• 购买后不退款。' },
      { title: '6. 知识产权', content: '所有应用程序内容（标志、设计、代码）均为SPYNNERS的财产。上传的曲目仍归其各自作者所有。' },
      { title: '7. 禁止行为', content: '禁止：\n• 上传非法或盗版内容。\n• 将应用程序用于未经授权的商业目的。\n• 试图绕过安全措施。\n• 骚扰或伤害其他用户。' },
      { title: '8. 责任限制', content: 'SPYNNERS不对使用应用程序造成的直接或间接损害负责。服务"按原样"提供。' },
      { title: '9. 修改', content: '我们保留随时修改这些条款的权利。用户将被告知重要更改。' },
      { title: '10. 联系方式', content: '如对这些条款有任何疑问，请联系我们：\nsupport@spynners.com' },
    ],
    privacyTitle: '隐私政策',
    privacySections: [
      { title: '收集的数据', content: '• 账户信息（姓名、电子邮件）\n• 使用数据（收听的曲目、下载）\n• 技术数据（设备、IP）' },
      { title: '数据使用', content: '您的数据用于：\n• 提供和改进服务\n• 个性化您的体验\n• 与您沟通\n• 确保平台安全' },
      { title: '您的权利', content: '根据GDPR，您有权：\n• 访问您的数据\n• 修改或删除它们\n• 反对其处理\n• 要求其可移植性' },
    ],
  },
};

export default function TermsScreen() {
  const router = useRouter();
  const { language, t } = useLanguage();

  const content = TERMS_CONTENT[language] || TERMS_CONTENT['en'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('terms.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.lastUpdate}>{content.lastUpdate}</Text>

        {content.sections.map((section, index) => (
          <View key={index}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.paragraph}>{section.content}</Text>
          </View>
        ))}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>{content.privacyTitle}</Text>
        
        {content.privacySections.map((section, index) => (
          <View key={index}>
            <Text style={styles.subTitle}>{section.title}</Text>
            <Text style={styles.paragraph}>{section.content}</Text>
          </View>
        ))}

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
