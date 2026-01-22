---
name: reanimated-animations
description: Animations avancees avec React Native Reanimated
globs: ["**/*.tsx", "**/animations/**/*"]
---

# Animations Reanimated - SPYNNERS

## Setup

```typescript
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  interpolate,
  Extrapolation,
  runOnJS,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
```

## Animations de Base

### Fade In/Out
```typescript
const FadeInView: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
};
```

### Scale Press
```typescript
const ScalePressable: React.FC<Props> = ({ onPress, children }) => {
  const scale = useSharedValue(1);

  const gesture = Gesture.Tap()
    .onBegin(() => {
      scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
    })
    .onFinalize(() => {
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      if (onPress) runOnJS(onPress)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animatedStyle}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
};
```

### Slide In
```typescript
const SlideInView: React.FC<{
  direction?: 'left' | 'right' | 'up' | 'down';
  delay?: number;
}> = ({ children, direction = 'up', delay = 0 }) => {
  const translateValue = useSharedValue(
    direction === 'up' ? 50 :
    direction === 'down' ? -50 :
    direction === 'left' ? 50 : -50
  );
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateValue.value = withDelay(delay, withSpring(0, { damping: 20 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const transform = direction === 'up' || direction === 'down'
      ? [{ translateY: translateValue.value }]
      : [{ translateX: translateValue.value }];

    return {
      transform,
      opacity: opacity.value,
    };
  });

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};
```

## Animations Audio Specifiques

### Pulsing Play Button
```typescript
const PulsingPlayButton: React.FC<{ isPlaying: boolean }> = ({ isPlaying }) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isPlaying) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // Infini
        false
      );
    } else {
      cancelAnimation(scale);
      scale.value = withSpring(1);
    }
  }, [isPlaying]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons
        name={isPlaying ? 'pause' : 'play'}
        size={48}
        color={Colors.primary}
      />
    </Animated.View>
  );
};
```

### Waveform Animation
```typescript
const AnimatedBar: React.FC<{ index: number }> = ({ index }) => {
  const height = useSharedValue(0.3);

  useEffect(() => {
    height.value = withRepeat(
      withDelay(
        index * 100,
        withSequence(
          withTiming(Math.random() * 0.7 + 0.3, { duration: 300 }),
          withTiming(0.3, { duration: 300 })
        )
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    height: `${height.value * 100}%`,
  }));

  return (
    <Animated.View style={[styles.bar, animatedStyle]} />
  );
};

const AudioWaveform: React.FC = () => (
  <View style={styles.waveformContainer}>
    {Array.from({ length: 5 }).map((_, i) => (
      <AnimatedBar key={i} index={i} />
    ))}
  </View>
);
```

### Recording Indicator
```typescript
const RecordingIndicator: React.FC<{ isRecording: boolean }> = ({ isRecording }) => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (isRecording) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(opacity);
      opacity.value = 1;
    }
  }, [isRecording]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.recordingDot, animatedStyle]}>
      <View style={{
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.live,
      }} />
    </Animated.View>
  );
};
```

## Gestures Avancees

### Swipe to Delete
```typescript
const SwipeableTrackCard: React.FC<Props> = ({ track, onDelete }) => {
  const translateX = useSharedValue(0);
  const deleteOpacity = useSharedValue(0);
  const DELETE_THRESHOLD = -100;

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = Math.min(0, event.translationX);
      deleteOpacity.value = interpolate(
        translateX.value,
        [0, DELETE_THRESHOLD],
        [0, 1],
        Extrapolation.CLAMP
      );
    })
    .onEnd(() => {
      if (translateX.value < DELETE_THRESHOLD) {
        translateX.value = withTiming(-300, {}, () => {
          runOnJS(onDelete)(track.id);
        });
      } else {
        translateX.value = withSpring(0);
        deleteOpacity.value = withTiming(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteStyle = useAnimatedStyle(() => ({
    opacity: deleteOpacity.value,
  }));

  return (
    <View>
      <Animated.View style={[styles.deleteBackground, deleteStyle]}>
        <Ionicons name="trash" size={24} color="#FFF" />
      </Animated.View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardStyle}>
          <TrackCard track={track} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};
```

### Progress Seek Bar
```typescript
const SeekBar: React.FC<{
  progress: number;
  duration: number;
  onSeek: (position: number) => void;
}> = ({ progress, duration, onSeek }) => {
  const position = useSharedValue(progress);
  const isSliding = useSharedValue(false);

  useEffect(() => {
    if (!isSliding.value) {
      position.value = progress;
    }
  }, [progress]);

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      isSliding.value = true;
    })
    .onUpdate((event) => {
      const newPosition = Math.max(0, Math.min(1, event.x / TRACK_WIDTH));
      position.value = newPosition;
    })
    .onEnd(() => {
      isSliding.value = false;
      runOnJS(onSeek)(position.value * duration);
    });

  const progressStyle = useAnimatedStyle(() => ({
    width: `${position.value * 100}%`,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    left: `${position.value * 100}%`,
    transform: [{ scale: isSliding.value ? 1.2 : 1 }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.trackContainer}>
        <View style={styles.track} />
        <Animated.View style={[styles.progress, progressStyle]} />
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </View>
    </GestureDetector>
  );
};
```

## Spring Configurations

```typescript
// Pour les retours rapides (boutons)
const FAST_SPRING = { damping: 20, stiffness: 400 };

// Pour les mouvements naturels
const NATURAL_SPRING = { damping: 15, stiffness: 150 };

// Pour les mouvements doux
const SOFT_SPRING = { damping: 25, stiffness: 80 };

// Pour les rebonds
const BOUNCY_SPRING = { damping: 8, stiffness: 200 };
```

## Bonnes Pratiques

1. **UI Thread**: Toutes les animations doivent tourner sur le UI thread
2. **cancelAnimation**: Toujours annuler les animations en boucle au unmount
3. **runOnJS**: Utiliser pour les callbacks JavaScript depuis le worklet
4. **Interpolation**: Utiliser `Extrapolation.CLAMP` pour eviter les depassements
5. **Performance**: Eviter les re-renders pendant les animations
