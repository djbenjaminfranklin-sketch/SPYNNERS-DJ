---
name: react-native-patterns
description: Patterns et bonnes pratiques React Native pour SPYNNERS. Invoque automatiquement pour tout code React Native.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# React Native Patterns - SPYNNERS

## Patterns de Composants

### Composant avec Props Typees
```typescript
import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface ComponentProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  disabled?: boolean;
}

export const Component = memo<ComponentProps>(({
  title,
  subtitle,
  onPress,
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: '#999999',
    fontSize: 14,
    marginTop: 4,
  },
});
```

### Hook Personnalise avec Cleanup
```typescript
import { useState, useEffect, useCallback, useRef } from 'react';

export function useAsyncData<T>(
  fetchFn: () => Promise<T>,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  return { data, loading, error, refetch };
}
```

### FlatList Optimisee
```typescript
import React, { useCallback } from 'react';
import { FlatList, ListRenderItem } from 'react-native';

interface OptimizedListProps<T> {
  data: T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T) => string;
}

export function OptimizedList<T>({
  data,
  renderItem,
  keyExtractor,
}: OptimizedListProps<T>) {
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: 80, // Hauteur fixe
      offset: 80 * index,
      index,
    }),
    []
  );

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={10}
      showsVerticalScrollIndicator={false}
    />
  );
}
```

## Patterns de Navigation (Expo Router)

### Layout avec Tabs
```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#5CB3CC',
        tabBarInactiveTintColor: '#666666',
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#1a1a1a',
        },
        headerShown: false,
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
    </Tabs>
  );
}
```

### Navigation Programmatique
```typescript
import { useRouter, useLocalSearchParams } from 'expo-router';

export function useNavigation() {
  const router = useRouter();

  const navigateTo = (route: string, params?: Record<string, string>) => {
    router.push({ pathname: route, params });
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return { navigateTo, goBack, router };
}
```

## Patterns de State

### Context avec Reducer
```typescript
import React, { createContext, useContext, useReducer, ReactNode } from 'react';

type State = { count: number };
type Action = { type: 'INCREMENT' } | { type: 'DECREMENT' } | { type: 'SET'; payload: number };

const initialState: State = { count: 0 };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INCREMENT':
      return { ...state, count: state.count + 1 };
    case 'DECREMENT':
      return { ...state, count: state.count - 1 };
    case 'SET':
      return { ...state, count: action.payload };
    default:
      return state;
  }
}

const Context = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function Provider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <Context.Provider value={{ state, dispatch }}>
      {children}
    </Context.Provider>
  );
}

export function useAppContext() {
  const context = useContext(Context);
  if (!context) throw new Error('useAppContext must be used within Provider');
  return context;
}
```

## Anti-Patterns a Eviter

### Ne PAS faire
```typescript
// ❌ Inline styles dans le render
<View style={{ backgroundColor: 'red', padding: 10 }}>

// ❌ Fonctions anonymes dans les props
<Button onPress={() => handlePress(item.id)} />

// ❌ Index comme key
{items.map((item, index) => <Item key={index} />)}

// ❌ Async dans useEffect sans cleanup
useEffect(() => {
  fetchData();
}, []);
```

### FAIRE
```typescript
// ✅ StyleSheet
const styles = StyleSheet.create({ container: { backgroundColor: 'red', padding: 10 } });

// ✅ useCallback
const handlePress = useCallback((id: string) => {}, []);

// ✅ ID unique comme key
{items.map((item) => <Item key={item.id} />)}

// ✅ Cleanup dans useEffect
useEffect(() => {
  let mounted = true;
  fetchData().then(data => { if (mounted) setData(data); });
  return () => { mounted = false; };
}, []);
```
