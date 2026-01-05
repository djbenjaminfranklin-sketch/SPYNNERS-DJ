import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface AdminBadgeProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

/**
 * Admin Badge Component
 * Displays a crown 👑 with "ADMIN" text
 * Used throughout the app to identify admin users
 */
export default function AdminBadge({ size = 'medium', showText = true }: AdminBadgeProps) {
  const getStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: styles.containerSmall,
          crown: styles.crownSmall,
          text: styles.textSmall,
        };
      case 'large':
        return {
          container: styles.containerLarge,
          crown: styles.crownLarge,
          text: styles.textLarge,
        };
      default:
        return {
          container: styles.containerMedium,
          crown: styles.crownMedium,
          text: styles.textMedium,
        };
    }
  };

  const sizeStyles = getStyles();

  return (
    <View style={[styles.container, sizeStyles.container]}>
      <Text style={sizeStyles.crown}>👑</Text>
      {showText && <Text style={[styles.text, sizeStyles.text]}>ADMIN</Text>}
    </View>
  );
}

/**
 * Helper function to check if a user is an admin
 * Checks both role field and email list for backwards compatibility
 */
export function isUserAdmin(user: any): boolean {
  if (!user) return false;
  
  // Check role field (new Base44 way)
  if (user.role === 'admin' || user.role === 'admin_readonly') {
    return true;
  }
  
  // Check is_admin flag
  if (user.is_admin === true) {
    return true;
  }
  
  // Fallback: Check email list (legacy way)
  const ADMIN_EMAILS = [
    'admin@spynners.com', 
    'contact@spynners.com', 
    'djbenjaminfranklin@gmail.com'
  ];
  
  if (user.email && ADMIN_EMAILS.includes(user.email)) {
    return true;
  }
  
  return false;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  
  // Small size
  containerSmall: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  crownSmall: {
    fontSize: 10,
  },
  textSmall: {
    fontSize: 8,
  },
  
  // Medium size
  containerMedium: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  crownMedium: {
    fontSize: 12,
  },
  textMedium: {
    fontSize: 10,
  },
  
  // Large size
  containerLarge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  crownLarge: {
    fontSize: 16,
  },
  textLarge: {
    fontSize: 12,
  },
  
  text: {
    fontWeight: '800',
    color: '#1a1a2e',
    letterSpacing: 0.5,
  },
});
