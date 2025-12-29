import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../src/theme/colors';

export default function TabLayout() {
  return (
    <Tabs
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
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="spyn"
        options={{
          title: 'SPYN',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.spynButton, focused && styles.spynButtonActive]}>
              <Ionicons name="radio" size={24} color={focused ? '#fff' : color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="playlist"
        options={{
          href: null, // Accessible from Library
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          href: null, // Accessible from Profile
        }}
      />
      <Tabs.Screen
        name="received"
        options={{
          href: null, // Hidden - accessible from Library
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  spynButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  spynButtonActive: {
    backgroundColor: '#C62828',
    transform: [{ scale: 1.05 }],
  },
});