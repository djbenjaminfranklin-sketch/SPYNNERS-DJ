import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { useLanguage } from '../../src/contexts/LanguageContext';

export default function TabLayout() {
  const { t, language } = useLanguage();
  
  return (
    <Tabs
      key={`tabs-${language}`}
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.backgroundCard,
          borderTopColor: Colors.borderAccent,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 10,
          paddingTop: 5,
        },
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('nav.library'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cloud-upload" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('nav.chat'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden tabs - accessible via navigation */}
      <Tabs.Screen
        name="spyn"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="playlist"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="received"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}