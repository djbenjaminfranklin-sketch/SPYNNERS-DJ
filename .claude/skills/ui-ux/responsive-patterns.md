---
name: responsive-patterns
description: Patterns responsive pour React Native
globs: ["**/*.tsx", "**/components/**/*"]
---

# Responsive Patterns - SPYNNERS

## Dimensions et Breakpoints

### Hook useWindowDimensions
```typescript
import { useWindowDimensions } from 'react-native';

function useResponsive() {
  const { width, height } = useWindowDimensions();

  return {
    width,
    height,
    isSmallPhone: width < 375,     // iPhone SE, petits Android
    isPhone: width < 768,          // Tous les phones
    isTablet: width >= 768,        // iPad, tablets Android
    isLandscape: width > height,
    isPortrait: height > width,
  };
}
```

### Constantes Responsive
```typescript
import { Dimensions, Platform, StatusBar } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Safe areas
const STATUS_BAR_HEIGHT = Platform.select({
  ios: 44,
  android: StatusBar.currentHeight || 24,
  default: 0,
});

const BOTTOM_TAB_HEIGHT = Platform.select({
  ios: 83,  // Avec home indicator
  android: 56,
  default: 56,
});

// Breakpoints
const BREAKPOINTS = {
  xs: 0,
  sm: 375,
  md: 414,
  lg: 768,
  xl: 1024,
} as const;
```

## Grilles Adaptatives

### Calcul de Colonnes
```typescript
function useGridColumns(minItemWidth: number = 160, gap: number = 16): {
  columns: number;
  itemWidth: number;
} {
  const { width } = useWindowDimensions();
  const availableWidth = width - gap * 2; // Padding horizontal

  const columns = Math.max(1, Math.floor(availableWidth / minItemWidth));
  const itemWidth = (availableWidth - gap * (columns - 1)) / columns;

  return { columns, itemWidth };
}

// Usage
function TrackGrid() {
  const { columns, itemWidth } = useGridColumns(160, 16);

  return (
    <FlatList
      data={tracks}
      numColumns={columns}
      key={columns} // Force re-render quand columns change
      renderItem={({ item }) => (
        <TrackCard track={item} width={itemWidth} />
      )}
      columnWrapperStyle={{ gap: 16 }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    />
  );
}
```

### Grid avec FlexWrap
```typescript
function FlexGrid({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const itemWidth = width < 375 ? '100%' : width < 768 ? '48%' : '31%';

  return (
    <View style={{
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      padding: 16,
    }}>
      {React.Children.map(children, (child) => (
        <View style={{ width: itemWidth }}>
          {child}
        </View>
      ))}
    </View>
  );
}
```

## Composants Adaptatifs

### Orientation Aware Component
```typescript
function PlayerScreen() {
  const { isLandscape } = useResponsive();

  if (isLandscape) {
    return (
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1 }}>
          <AlbumArt size="large" />
        </View>
        <View style={{ flex: 1, padding: 24 }}>
          <TrackInfo />
          <PlayerControls />
          <ProgressBar />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <AlbumArt size="responsive" />
      <TrackInfo />
      <ProgressBar />
      <PlayerControls />
    </View>
  );
}
```

### Responsive Text
```typescript
function ResponsiveTitle({ children }: { children: string }) {
  const { width } = useWindowDimensions();

  const fontSize = width < 375 ? 24 : width < 768 ? 28 : 32;
  const lineHeight = fontSize * 1.2;

  return (
    <Text
      style={{ fontSize, lineHeight, fontWeight: '700' }}
      numberOfLines={2}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
    >
      {children}
    </Text>
  );
}
```

### Responsive Spacing
```typescript
function useResponsiveSpacing() {
  const { width } = useWindowDimensions();

  const scale = width < 375 ? 0.9 : width < 768 ? 1 : 1.2;

  return {
    xs: Math.round(4 * scale),
    sm: Math.round(8 * scale),
    md: Math.round(16 * scale),
    lg: Math.round(24 * scale),
    xl: Math.round(32 * scale),
  };
}
```

## Safe Areas

### SafeAreaView Usage
```typescript
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Methode 1: SafeAreaView
function Screen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <Content />
    </SafeAreaView>
  );
}

// Methode 2: useSafeAreaInsets (plus de controle)
function CustomScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{
      flex: 1,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }}>
      <Content />
    </View>
  );
}

// Methode 3: Partial safe area (ex: ignorer bottom pour player)
function ScreenWithPlayer() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Content />
      {/* Player gere son propre bottom inset */}
      <MiniPlayer />
    </View>
  );
}
```

## Platform-Specific Styles

### Platform.select
```typescript
const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  text: {
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
    }),
  },
});
```

### Fichiers Platform-Specific
```
components/
├── Button.tsx          # Commun
├── Button.ios.tsx      # iOS specific
└── Button.android.tsx  # Android specific
```

## Keyboard Handling

### KeyboardAvoidingView
```typescript
import { KeyboardAvoidingView, Platform } from 'react-native';

function FormScreen() {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.select({ ios: 88, android: 0 })}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <TextInput placeholder="Email" />
        <TextInput placeholder="Password" />
        <Button title="Submit" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

### useKeyboard Hook
```typescript
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardEvent } from 'react-native';

function useKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e: KeyboardEvent) => {
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
      }
    );

    const hideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  return { keyboardHeight, isKeyboardVisible };
}
```

## Checklist Responsive

- [ ] Teste sur iPhone SE (petit ecran)
- [ ] Teste sur iPhone Pro Max (grand ecran)
- [ ] Teste sur iPad
- [ ] Teste en mode paysage
- [ ] Safe areas respectees
- [ ] Touch targets >= 44pt sur tous les devices
- [ ] Texte lisible a toutes les tailles
- [ ] Grilles adaptatives fonctionnelles
