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

interface LanguageSelectorProps {
  compact?: boolean;
}

export default function LanguageSelector({ compact = false }: LanguageSelectorProps) {
  const { language, setLanguage, getCurrentFlag } = useLanguage();
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelectLanguage = (langCode: Language) => {
    setLanguage(langCode);
    setModalVisible(false);
  };

  if (compact) {
    // Compact version - just a flag button
    return (
      <>
        <TouchableOpacity 
          style={styles.flagButton} 
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.flag}>{getCurrentFlag()}</Text>
        </TouchableOpacity>

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
              <Text style={styles.modalTitle}>Select Language</Text>
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

  // Full version - shows current language with dropdown
  return (
    <>
      <TouchableOpacity 
        style={styles.selector} 
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.flag}>{getCurrentFlag()}</Text>
        <Text style={styles.currentLang}>
          {LANGUAGES.find(l => l.code === language)?.name}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Language</Text>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
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
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flagButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  flag: {
    fontSize: 22,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  currentLang: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  arrow: {
    color: Colors.textMuted,
    fontSize: 10,
    marginLeft: 4,
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
    maxHeight: 400,
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
