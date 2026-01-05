import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { useLanguage, LANGUAGES, Language } from '../contexts/LanguageContext';
import { Colors, Spacing, BorderRadius } from '../theme/colors';

/**
 * Floating Language Button - A persistent language selector that appears on all screens
 * Position: Top right corner of the screen
 */
export default function FloatingLanguageButton() {
  const { language, setLanguage, getCurrentFlag, t } = useLanguage();
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelectLanguage = (langCode: Language) => {
    setLanguage(langCode);
    setModalVisible(false);
  };

  return (
    <>
      {/* Floating Button */}
      <TouchableOpacity 
        style={styles.floatingButton} 
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.flag}>{getCurrentFlag()}</Text>
        <Text style={styles.langCode}>{language.toUpperCase()}</Text>
      </TouchableOpacity>

      {/* Language Selection Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('common.selectLanguage') || 'Select Language'}</Text>
            <ScrollView style={styles.languageList} showsVerticalScrollIndicator={true}>
              {LANGUAGES.map((item) => (
                <TouchableOpacity
                  key={item.code}
                  style={[
                    styles.languageItem,
                    language === item.code && styles.languageItemSelected
                  ]}
                  onPress={() => handleSelectLanguage(item.code)}
                >
                  <Text style={styles.languageFlag}>{item.flag}</Text>
                  <Text style={[
                    styles.languageName,
                    language === item.code && styles.languageNameSelected
                  ]}>
                    {item.name}
                  </Text>
                  {language === item.code && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  flag: {
    fontSize: 18,
  },
  langCode: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 320,
    maxHeight: 450,
  },
  languageList: {
    maxHeight: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sm,
    marginBottom: 4,
    gap: 12,
  },
  languageItemSelected: {
    backgroundColor: Colors.primary + '20',
  },
  languageFlag: {
    fontSize: 24,
  },
  languageName: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  languageNameSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: 'bold',
  },
});
