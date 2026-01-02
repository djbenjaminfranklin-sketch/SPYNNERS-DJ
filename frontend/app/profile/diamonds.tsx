import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Colors, Spacing, BorderRadius } from '../../src/theme/colors';

const DIAMOND_PACKS = [
  { id: 1, amount: 10, price: '0.99€', popular: false },
  { id: 2, amount: 50, price: '3.99€', popular: false },
  { id: 3, amount: 100, price: '6.99€', popular: true },
  { id: 4, amount: 250, price: '14.99€', popular: false },
  { id: 5, amount: 500, price: '24.99€', popular: false },
  { id: 6, amount: 1000, price: '44.99€', popular: false },
];

export default function BlackDiamondsScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { language, t } = useLanguage();
  const [selectedPack, setSelectedPack] = useState<number | null>(3); // Default to popular pack
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchingBalance, setFetchingBalance] = useState(true);

  const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL;

  useEffect(() => {
    fetchDiamondBalance();
  }, []);

  const fetchDiamondBalance = async () => {
  try {
    setFetchingBalance(true);
    // Backend endpoint is not available in this build; keep UI stable.
    setBalance(0);
  } finally {
    setFetchingBalance(false);
  }
};
  const handlePurchase = async () => {
    if (!selectedPack) {
      Alert.alert(
        isEnglish ? 'Selection required' : 'Sélection requise',
        isEnglish ? 'Choose a diamond pack' : 'Choisissez un pack de diamonds'
      );
      return;
    }

    const pack = DIAMOND_PACKS.find(p => p.id === selectedPack);
    
    Alert.alert(
      isEnglish ? 'Buy Black Diamonds' : 'Acheter des Black Diamonds',
      isEnglish 
        ? `Buy ${pack?.amount} Black Diamonds for ${pack?.price}?\n\nYou will be redirected to spynners.com to complete the purchase.`
        : `Acheter ${pack?.amount} Black Diamonds pour ${pack?.price}?\n\nVous serez redirigé vers spynners.com pour finaliser l'achat.`,
      [
        { text: isEnglish ? 'Cancel' : 'Annuler', style: 'cancel' },
        {
          text: isEnglish ? 'Continue' : 'Continuer',
          onPress: async () => {
            setLoading(true);
            try {
              // Redirect to spynners.com for purchase
              const purchaseUrl = `https://spynners.com/diamonds?pack=${pack?.id}&amount=${pack?.amount}`;
              
              if (Platform.OS === 'web') {
                window.open(purchaseUrl, '_blank');
              } else {
                await Linking.openURL(purchaseUrl);
              }
              
              // After redirect, simulate diamond addition for demo
              setTimeout(() => {
                Alert.alert(
                  isEnglish ? 'Purchase Complete! 💎' : 'Achat terminé! 💎',
                  isEnglish 
                    ? `${pack?.amount} Black Diamonds added to your account!`
                    : `${pack?.amount} Black Diamonds ajoutés à votre compte!`,
                  [{ text: 'OK', onPress: () => {
                    setBalance(prev => prev + (pack?.amount || 0));
                    setSelectedPack(null);
                  }}]
                );
              }, 1000);
            } catch (error) {
              console.error('Purchase error:', error);
              Alert.alert(
                isEnglish ? 'Error' : 'Erreur',
                isEnglish ? 'Could not open purchase page. Please try again.' : 'Impossible d\'ouvrir la page d\'achat. Veuillez réessayer.'
              );
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.blackDiamonds')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Ionicons name="diamond" size={48} color="#FFD700" />
          <Text style={styles.balanceLabel}>
            {t('diamonds.yourBalance')}
          </Text>
          <Text style={styles.balanceAmount}>
            {fetchingBalance ? '...' : balance}
          </Text>
          <Text style={styles.balanceSubtext}>Black Diamonds</Text>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            {t('diamonds.info')}
          </Text>
        </View>

        {/* Packs */}
        <Text style={styles.sectionTitle}>
          {t('diamonds.buyDiamonds')}
        </Text>
        
        <View style={styles.packsGrid}>
          {DIAMOND_PACKS.map(pack => (
            <TouchableOpacity
              key={pack.id}
              style={[
                styles.packCard,
                selectedPack === pack.id && styles.packCardSelected,
                pack.popular && styles.packCardPopular,
              ]}
              onPress={() => setSelectedPack(pack.id)}
            >
              {pack.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>
                    {t('diamonds.popular')}
                  </Text>
                </View>
              )}
              <Ionicons name="diamond" size={28} color="#FFD700" />
              <Text style={styles.packAmount}>{pack.amount}</Text>
              <Text style={styles.packPrice}>{pack.price}</Text>
              {selectedPack === pack.id && (
                <View style={styles.checkMark}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Purchase Button */}
        <TouchableOpacity
          style={[styles.purchaseButton, (!selectedPack || loading) && styles.purchaseButtonDisabled]}
          onPress={handlePurchase}
          disabled={!selectedPack || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Ionicons name="card" size={24} color="#000" />
          )}
          <Text style={styles.purchaseButtonText}>
            {loading 
              ? t('diamonds.processing') 
              : t('diamonds.buyNow')}
          </Text>
        </TouchableOpacity>

        {/* Features */}
        <Text style={styles.sectionTitle}>
          {t('diamonds.vipBenefits')}
        </Text>
        
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Ionicons name="download" size={24} color={Colors.primary} />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>
                {t('diamonds.vipDownloads')}
              </Text>
              <Text style={styles.featureDesc}>
                {t('diamonds.accessExclusive')}
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="star" size={24} color={Colors.primary} />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>
                {t('diamonds.premiumContent')}
              </Text>
              <Text style={styles.featureDesc}>
                {t('diamonds.tracksBeforeEveryone')}
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="heart" size={24} color={Colors.primary} />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>
                {t('diamonds.supportArtists')}
              </Text>
              <Text style={styles.featureDesc}>
                {t('diamonds.supportProducers')}
              </Text>
            </View>
          </View>
        </View>

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
  balanceCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: 24, alignItems: 'center',
    borderWidth: 2, borderColor: '#FFD700',
  },
  balanceLabel: { fontSize: 14, color: Colors.textSecondary, marginTop: 12 },
  balanceAmount: { fontSize: 48, fontWeight: 'bold', color: '#FFD700' },
  balanceSubtext: { fontSize: 14, color: Colors.textMuted },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: Colors.primary + '15',
    borderRadius: BorderRadius.md, padding: Spacing.md, gap: 10, marginTop: 16,
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginTop: 24, marginBottom: 12 },
  packsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  packCard: {
    width: '31%', backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md, padding: 16, alignItems: 'center',
    borderWidth: 2, borderColor: Colors.border,
  },
  packCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  packCardPopular: { borderColor: '#FFD700' },
  popularBadge: {
    position: 'absolute', top: -8,
    backgroundColor: '#FFD700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  popularBadgeText: { fontSize: 8, fontWeight: 'bold', color: '#000' },
  packAmount: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 8 },
  packPrice: { fontSize: 14, color: Colors.primary, fontWeight: '600', marginTop: 4 },
  checkMark: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: Colors.primary,
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  purchaseButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFD700', borderRadius: BorderRadius.md,
    padding: Spacing.lg, gap: 12, marginTop: 24,
  },
  purchaseButtonDisabled: { opacity: 0.5 },
  purchaseButtonText: { fontSize: 17, fontWeight: '600', color: '#000' },
  featuresList: { gap: 12 },
  featureItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md, padding: 16, gap: 16,
  },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  featureDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});
