// Language Selector Component
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { Colors, BorderRadius, Spacing } from '../theme/colors';

export default function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  const [showModal, setShowModal] = useState(false);

  const languages = [
    { code: 'en' as const, name: 'English', flag: '🇬🇧' },
    { code: 'fr' as const, name: 'Français', flag: '🇫🇷' },
  ];

  const currentLang = languages.find(l => l.code === language) || languages[0];

  return (
    <>
      <TouchableOpacity 
        style={styles.selector} 
        onPress={() => setShowModal(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.flag}>{currentLang.flag}</Text>
        <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity 
          style={styles.overlay} 
          activeOpacity={1} 
          onPress={() => setShowModal(false)}
        >
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('language')}</Text>
            
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.langOption,
                  language === lang.code && styles.langOptionSelected
                ]}
                onPress={() => {
                  setLanguage(lang.code);
                  setShowModal(false);
                }}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={[
                  styles.langName,
                  language === lang.code && styles.langNameSelected
                ]}>
                  {lang.name}
                </Text>
                {language === lang.code && (
                  <Ionicons name="checkmark" size={20} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  flag: {
    fontSize: 18,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: 8,
    backgroundColor: Colors.backgroundInput,
    gap: 12,
  },
  langOptionSelected: {
    backgroundColor: Colors.primary + '20',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  langFlag: {
    fontSize: 24,
  },
  langName: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  langNameSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
});
