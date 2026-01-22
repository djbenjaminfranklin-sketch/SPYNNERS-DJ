---
name: design-system-spynners
description: Design System complet de SPYNNERS Live
globs: ["**/theme/**/*", "**/components/**/*"]
---

# Design System SPYNNERS Live

## Identite Visuelle

### Philosophie
- **Dark-first**: Interface sombre pour usage DJ/club
- **Accent Cyan**: Couleur signature #5CB3CC
- **Premium**: Finitions soignees, animations fluides
- **Accessible**: Contrastes suffisants malgre le theme sombre

## Tokens de Design

### Couleurs (Colors.ts)
```typescript
export const Colors = {
  // Backgrounds
  background: '#0a0a0a',        // Fond principal
  backgroundCard: '#1a1a1a',    // Cartes et surfaces
  backgroundSecondary: '#2a2a2a', // Elements secondaires
  backgroundTertiary: '#3a3a3a',  // Hover states

  // Texte
  text: '#FFFFFF',              // Texte principal
  textSecondary: '#999999',     // Texte secondaire
  textMuted: '#666666',         // Labels, placeholders
  textDisabled: '#444444',      // Etats desactives

  // Couleurs Primaires
  primary: '#5CB3CC',           // Accent principal (Cyan)
  primaryDark: '#4A9AAF',       // Hover/press du primary
  primaryLight: '#7CC4D9',      // Highlight du primary

  // Etats Semantiques
  success: '#4CAF50',
  successBackground: 'rgba(76, 175, 80, 0.15)',
  error: '#F44336',
  errorBackground: 'rgba(244, 67, 54, 0.15)',
  warning: '#FF9800',
  warningBackground: 'rgba(255, 152, 0, 0.15)',
  info: '#2196F3',

  // Accents Speciaux
  gold: '#FFD700',              // Black Diamonds, achievements
  vip: '#9C27B0',               // Contenu VIP
  vipBackground: 'rgba(156, 39, 176, 0.15)',
  live: '#F44336',              // Indicateur live/enregistrement

  // Bordures
  border: '#333333',
  borderFocus: '#5CB3CC',
  borderError: '#F44336',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
};
```

### Typographie
```typescript
export const Typography = {
  // Display - Titres principaux
  display: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
    letterSpacing: -0.5,
  },

  // Headings
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  h2: { fontSize: 24, fontWeight: '600' as const, lineHeight: 30 },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  h4: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },

  // Body
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  bodyMedium: { fontSize: 16, fontWeight: '500' as const, lineHeight: 22 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },

  // Labels & Captions
  label: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  labelUpper: {
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  caption: { fontSize: 10, fontWeight: '400' as const, lineHeight: 14 },

  // Mono (durees, BPM)
  mono: { fontSize: 14, fontFamily: 'monospace', fontWeight: '500' as const },
};
```

### Espacements
```typescript
export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;
```

### Rayons
```typescript
export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;
```

### Ombres
```typescript
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  glow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
};
```

## Composants Standards

### Boutons
```typescript
// Primary Button
<TouchableOpacity
  style={{
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48, // Touch target minimum
  }}
  activeOpacity={0.8}
>
  <Text style={{ color: '#000', fontWeight: '600', fontSize: 16 }}>
    Action Principale
  </Text>
</TouchableOpacity>

// Secondary Button
<TouchableOpacity
  style={{
    backgroundColor: 'transparent',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
  }}
  activeOpacity={0.8}
>
  <Text style={{ color: Colors.primary, fontWeight: '600' }}>
    Action Secondaire
  </Text>
</TouchableOpacity>

// Ghost Button
<TouchableOpacity
  style={{
    backgroundColor: Colors.backgroundSecondary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  }}
  activeOpacity={0.7}
>
  <Text style={{ color: Colors.text }}>Ghost</Text>
</TouchableOpacity>
```

### Cartes
```typescript
// Track Card
<View style={{
  backgroundColor: Colors.backgroundCard,
  borderRadius: BorderRadius.lg,
  padding: Spacing.md,
  flexDirection: 'row',
  alignItems: 'center',
  gap: Spacing.md,
}}>
  <Image
    source={{ uri: artwork }}
    style={{
      width: 60,
      height: 60,
      borderRadius: BorderRadius.md,
    }}
  />
  <View style={{ flex: 1 }}>
    <Text style={{ color: Colors.text, ...Typography.bodyMedium }}>
      {title}
    </Text>
    <Text style={{ color: Colors.textSecondary, ...Typography.bodySmall }}>
      {artist}
    </Text>
  </View>
  <Ionicons name="play" size={24} color={Colors.primary} />
</View>
```

### Inputs
```typescript
<TextInput
  style={{
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: isFocused ? Colors.borderFocus : Colors.border,
  }}
  placeholderTextColor={Colors.textMuted}
  placeholder="Rechercher..."
/>
```

## Iconographie

### Ionicons Standards
```typescript
// Navigation
home, library, radio, person

// Actions
play, pause, stop, skip-forward, skip-back
heart, heart-outline
add, remove, close
share-outline, download-outline

// UI
chevron-forward, chevron-back
settings-outline, notifications-outline
search, filter

// Audio
mic, mic-outline, volume-high, volume-mute
musical-notes, disc
```

### Tailles Standards
```typescript
// Tab bar: 24
// Action buttons: 28
// Player controls: 32-48
// Headers: 24
// List items: 20
```
