---
name: accessibility-mobile
description: Accessibilite mobile pour React Native
globs: ["**/*.tsx", "**/components/**/*"]
---

# Accessibilite Mobile - SPYNNERS

## Principes Fondamentaux

### WCAG 2.1 Mobile
- **Perceivable**: Contenu perceptible par tous
- **Operable**: Interface utilisable
- **Understandable**: Comprehensible
- **Robust**: Compatible assistive tech

## Labels et Roles

### Boutons et Actions
```typescript
<TouchableOpacity
  onPress={playTrack}
  accessibilityLabel="Jouer la piste"
  accessibilityHint="Double-tap pour lancer la lecture de la piste"
  accessibilityRole="button"
  accessibilityState={{ disabled: isLoading }}
>
  <Ionicons name="play" size={24} />
</TouchableOpacity>
```

### Images et Artwork
```typescript
<Image
  source={{ uri: track.artworkUrl }}
  accessibilityLabel={`Pochette de ${track.title} par ${track.artist}`}
  accessibilityRole="image"
/>

// Image decorative (ignorer)
<Image
  source={{ uri: decorativeBackground }}
  accessibilityElementsHidden={true}
  importantForAccessibility="no"
/>
```

### Texte Informatif
```typescript
<View
  accessibilityRole="text"
  accessibilityLabel={`${track.title}, par ${track.artist}, duree ${formatDuration(track.duration)}`}
>
  <Text style={styles.title}>{track.title}</Text>
  <Text style={styles.artist}>{track.artist}</Text>
  <Text style={styles.duration}>{formatDuration(track.duration)}</Text>
</View>
```

### Sliders et Progress
```typescript
<Slider
  value={progress}
  onValueChange={onSeek}
  accessibilityRole="adjustable"
  accessibilityLabel="Position de lecture"
  accessibilityValue={{
    min: 0,
    max: duration,
    now: progress,
    text: `${formatTime(progress)} sur ${formatTime(duration)}`,
  }}
  accessibilityActions={[
    { name: 'increment', label: 'Avancer de 10 secondes' },
    { name: 'decrement', label: 'Reculer de 10 secondes' },
  ]}
  onAccessibilityAction={(event) => {
    if (event.nativeEvent.actionName === 'increment') {
      onSeek(Math.min(progress + 10, duration));
    } else if (event.nativeEvent.actionName === 'decrement') {
      onSeek(Math.max(progress - 10, 0));
    }
  }}
/>
```

## Navigation

### Focus Order
```typescript
<View style={styles.playerControls}>
  {/* 1. Skip previous */}
  <TouchableOpacity accessibilityLabel="Piste precedente">
    <Ionicons name="play-skip-back" />
  </TouchableOpacity>

  {/* 2. Play/Pause (focus principal) */}
  <TouchableOpacity
    accessibilityLabel={isPlaying ? 'Pause' : 'Lecture'}
    accessible={true}
    // Focus initial sur ce bouton
  >
    <Ionicons name={isPlaying ? 'pause' : 'play'} />
  </TouchableOpacity>

  {/* 3. Skip next */}
  <TouchableOpacity accessibilityLabel="Piste suivante">
    <Ionicons name="play-skip-forward" />
  </TouchableOpacity>
</View>
```

### Groupes Accessibles
```typescript
// Grouper des elements comme une seule unite
<View
  accessible={true}
  accessibilityRole="button"
  accessibilityLabel={`${track.title} par ${track.artist}. Double-tap pour jouer.`}
>
  <Image source={{ uri: track.artworkUrl }} />
  <Text>{track.title}</Text>
  <Text>{track.artist}</Text>
</View>
```

## Contrastes et Lisibilite

### Ratios de Contraste
```typescript
// WCAG AA Minimum
const ContrastRatios = {
  // Texte normal (< 18pt): 4.5:1 minimum
  textOnBackground: '#FFFFFF on #0a0a0a', // 19.4:1 ✓

  // Texte large (>= 18pt bold ou 24pt): 3:1 minimum
  largeTextOnBackground: '#999999 on #0a0a0a', // 5.3:1 ✓

  // Composants UI et graphiques: 3:1 minimum
  primaryOnBackground: '#5CB3CC on #0a0a0a', // 7.4:1 ✓

  // Texte sur primary: inverser
  textOnPrimary: '#0a0a0a on #5CB3CC', // 7.4:1 ✓
};

// Verifier vos couleurs: https://webaim.org/resources/contrastchecker/
```

### Tailles Minimales
```typescript
const AccessibleSizes = {
  // Taille minimale texte lisible
  minFontSize: 12,

  // Taille recommandee corps de texte
  bodyFontSize: 16,

  // Touch target minimum (WCAG 2.5.5)
  minTouchTarget: 44, // points

  // Espacement entre touch targets
  minTouchSpacing: 8,
};
```

## Annonces Screen Reader

### Live Regions
```typescript
<View
  accessibilityLiveRegion="polite" // ou "assertive" pour urgent
  accessibilityRole="status"
>
  <Text>{isPlaying ? 'Lecture en cours' : 'En pause'}</Text>
</View>

// Annonce programmatique
import { AccessibilityInfo } from 'react-native';

function onTrackChange(track: Track) {
  AccessibilityInfo.announceForAccessibility(
    `Lecture de ${track.title} par ${track.artist}`
  );
}

function onRecordingStart() {
  AccessibilityInfo.announceForAccessibility(
    'Enregistrement demarre'
  );
}
```

### Etats Dynamiques
```typescript
<TouchableOpacity
  accessibilityState={{
    checked: isLiked,        // Pour toggles
    selected: isSelected,    // Pour selections
    disabled: isLoading,     // Pour etats desactives
    busy: isLoading,         // Pour chargements
    expanded: isExpanded,    // Pour accordeons
  }}
/>
```

## Mouvements et Animations

### Respect des Preferences
```typescript
import { AccessibilityInfo } from 'react-native';
import { useEffect, useState } from 'react';

function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);

    const listener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );

    return () => listener.remove();
  }, []);

  return reduceMotion;
}

// Usage
const reduceMotion = useReducedMotion();
const animationDuration = reduceMotion ? 0 : 300;
```

### Animations Accessibles
```typescript
const AnimatedComponent: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1; // Pas d'animation
    } else {
      opacity.value = withTiming(1, { duration: 300 });
    }
  }, [reduceMotion]);

  // ...
};
```

## Checklist Accessibilite

### Composants
- [ ] Tous les boutons ont `accessibilityLabel`
- [ ] Images informatives ont des descriptions
- [ ] Images decoratives sont cachees
- [ ] Touch targets >= 44pt
- [ ] Espacement entre cibles >= 8pt

### Navigation
- [ ] Ordre de focus logique
- [ ] Pas de pieges de focus
- [ ] Retour possible depuis modales

### Contenu
- [ ] Contraste texte >= 4.5:1
- [ ] Contraste UI >= 3:1
- [ ] Taille texte minimum 12pt
- [ ] Texte redimensionnable sans perte

### Dynamique
- [ ] Changements d'etat annonces
- [ ] Animations respectent reduceMotion
- [ ] Pas de contenu clignotant > 3x/sec

### Tests
- [ ] Teste avec VoiceOver (iOS)
- [ ] Teste avec TalkBack (Android)
- [ ] Teste sans couleurs (daltonisme)
- [ ] Teste avec zoom texte
