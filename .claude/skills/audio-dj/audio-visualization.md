---
name: audio-visualization
description: Visualisation audio (waveforms, VU meters, spectres)
globs: ["**/components/audio/**/*", "**/visualization/**/*"]
---

# Audio Visualization - SPYNNERS

## Waveform Statique

### Composant Waveform
```typescript
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Colors } from '@/src/theme';

interface WaveformProps {
  samples: number[];      // Amplitudes normalisees 0-1
  width: number;
  height: number;
  progress?: number;      // 0-1 position de lecture
  color?: string;
  progressColor?: string;
  backgroundColor?: string;
}

export function Waveform({
  samples,
  width,
  height,
  progress = 0,
  color = Colors.textMuted,
  progressColor = Colors.primary,
  backgroundColor = 'transparent',
}: WaveformProps) {
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    const barWidth = width / samples.length;
    const maxHeight = height * 0.8;

    samples.forEach((amplitude, index) => {
      const x = index * barWidth;
      const barHeight = Math.max(2, amplitude * maxHeight);
      const y = (height - barHeight) / 2;

      p.addRect(Skia.XYWHRect(x, y, Math.max(1, barWidth - 1), barHeight));
    });

    return p;
  }, [samples, width, height]);

  const progressWidth = width * progress;

  return (
    <View style={[styles.container, { width, height, backgroundColor }]}>
      <Canvas style={{ width, height }}>
        {/* Waveform complete (gris) */}
        <Path path={path} color={color} />

        {/* Waveform jouee (couleur) */}
        <Group clip={Skia.XYWHRect(0, 0, progressWidth, height)}>
          <Path path={path} color={progressColor} />
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
```

### Generation de Samples depuis Audio
```typescript
// Note: La generation de waveform depuis l'audio necessite
// soit un traitement backend, soit une librairie native

// Placeholder avec donnees aleatoires pour preview
export function generatePlaceholderSamples(count: number): number[] {
  const samples: number[] = [];
  let value = 0.5;

  for (let i = 0; i < count; i++) {
    // Random walk pour un aspect plus naturel
    value += (Math.random() - 0.5) * 0.3;
    value = Math.max(0.1, Math.min(1, value));
    samples.push(value);
  }

  return samples;
}
```

## Waveform Animee (Live)

### Composant LiveWaveform
```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { Colors } from '@/src/theme';

interface LiveWaveformProps {
  metering: number;       // dB value from recording
  barCount?: number;
  width: number;
  height: number;
}

export function LiveWaveform({
  metering,
  barCount = 5,
  width,
  height,
}: LiveWaveformProps) {
  const barWidth = width / barCount - 4;

  return (
    <View style={[styles.container, { width, height }]}>
      {Array.from({ length: barCount }).map((_, index) => (
        <AnimatedBar
          key={index}
          index={index}
          metering={metering}
          width={barWidth}
          maxHeight={height}
        />
      ))}
    </View>
  );
}

interface AnimatedBarProps {
  index: number;
  metering: number;
  width: number;
  maxHeight: number;
}

function AnimatedBar({ index, metering, width, maxHeight }: AnimatedBarProps) {
  const baseLevel = dbToLinear(metering);

  // Varier la hauteur par barre pour un effet plus dynamique
  const variation = Math.sin(index * 1.5) * 0.3;
  const level = Math.max(0.1, Math.min(1, baseLevel + variation));

  const animatedStyle = useAnimatedStyle(() => ({
    height: withSpring(level * maxHeight, {
      damping: 15,
      stiffness: 300,
    }),
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        { width },
        animatedStyle,
      ]}
    />
  );
}

function dbToLinear(db: number): number {
  const clampedDb = Math.max(-60, Math.min(0, db));
  return Math.pow(10, clampedDb / 20);
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bar: {
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
});
```

## VU Meter Stereo

### Composant StereoVUMeter
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { Colors } from '@/src/theme';

interface StereoVUMeterProps {
  leftLevel: number;   // 0-1
  rightLevel: number;  // 0-1
  showPeaks?: boolean;
  orientation?: 'horizontal' | 'vertical';
  width?: number;
  height?: number;
}

export function StereoVUMeter({
  leftLevel,
  rightLevel,
  showPeaks = true,
  orientation = 'vertical',
  width = 60,
  height = 150,
}: StereoVUMeterProps) {
  const isVertical = orientation === 'vertical';
  const meterWidth = isVertical ? (width - 12) / 2 : width;
  const meterHeight = isVertical ? height : (height - 12) / 2;

  return (
    <View
      style={[
        styles.container,
        isVertical
          ? { flexDirection: 'row', width, height }
          : { flexDirection: 'column', width, height },
      ]}
    >
      <MeterBar
        level={leftLevel}
        width={meterWidth}
        height={meterHeight}
        orientation={orientation}
        label="L"
        showPeak={showPeaks}
      />
      <MeterBar
        level={rightLevel}
        width={meterWidth}
        height={meterHeight}
        orientation={orientation}
        label="R"
        showPeak={showPeaks}
      />
    </View>
  );
}

interface MeterBarProps {
  level: number;
  width: number;
  height: number;
  orientation: 'horizontal' | 'vertical';
  label: string;
  showPeak: boolean;
}

function MeterBar({
  level,
  width,
  height,
  orientation,
  label,
  showPeak,
}: MeterBarProps) {
  const isVertical = orientation === 'vertical';
  const clampedLevel = Math.max(0, Math.min(1, level));

  const animatedStyle = useAnimatedStyle(() => {
    const size = withSpring(clampedLevel * (isVertical ? height : width), {
      damping: 20,
      stiffness: 300,
    });

    // Couleur basee sur le niveau
    const color = interpolateColor(
      clampedLevel,
      [0, 0.7, 0.9, 1],
      ['#4CAF50', '#8BC34A', '#FF9800', '#F44336']
    );

    return isVertical
      ? { height: size, backgroundColor: color }
      : { width: size, backgroundColor: color };
  });

  return (
    <View style={styles.meterWrapper}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.meterBackground,
          isVertical
            ? { width, height, flexDirection: 'column-reverse' }
            : { width, height, flexDirection: 'row' },
        ]}
      >
        <Animated.View
          style={[
            styles.meterFill,
            isVertical ? { width: '100%' } : { height: '100%' },
            animatedStyle,
          ]}
        />

        {/* Graduations */}
        <View style={styles.graduations}>
          {[0, 0.25, 0.5, 0.75, 1].map((mark, i) => (
            <View
              key={i}
              style={[
                styles.graduation,
                isVertical
                  ? { bottom: `${mark * 100}%` }
                  : { left: `${mark * 100}%` },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  meterWrapper: {
    alignItems: 'center',
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 10,
    marginBottom: 4,
  },
  meterBackground: {
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  meterFill: {
    borderRadius: 4,
  },
  graduations: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  graduation: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
```

## Progress Bar Audio

### Composant AudioProgressBar
```typescript
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { Colors } from '@/src/theme';

interface AudioProgressBarProps {
  position: number;    // ms
  duration: number;    // ms
  buffered?: number;   // ms
  onSeek: (positionMs: number) => void;
  width: number;
  height?: number;
}

export function AudioProgressBar({
  position,
  duration,
  buffered = 0,
  onSeek,
  width,
  height = 48,
}: AudioProgressBarProps) {
  const progress = duration > 0 ? position / duration : 0;
  const bufferedProgress = duration > 0 ? buffered / duration : 0;

  const isSeeking = useSharedValue(false);
  const seekPosition = useSharedValue(progress);

  const panGesture = Gesture.Pan()
    .onBegin((event) => {
      isSeeking.value = true;
      seekPosition.value = Math.max(0, Math.min(1, event.x / width));
    })
    .onUpdate((event) => {
      seekPosition.value = Math.max(0, Math.min(1, event.x / width));
    })
    .onEnd(() => {
      const newPosition = seekPosition.value * duration;
      runOnJS(onSeek)(newPosition);
      isSeeking.value = false;
    });

  const tapGesture = Gesture.Tap()
    .onEnd((event) => {
      const newProgress = Math.max(0, Math.min(1, event.x / width));
      const newPosition = newProgress * duration;
      runOnJS(onSeek)(newPosition);
    });

  const gesture = Gesture.Race(panGesture, tapGesture);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${(isSeeking.value ? seekPosition.value : progress) * 100}%`,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    left: `${(isSeeking.value ? seekPosition.value : progress) * 100}%`,
    transform: [{ scale: isSeeking.value ? 1.3 : 1 }],
  }));

  return (
    <View style={styles.wrapper}>
      <Text style={styles.time}>{formatTime(position / 1000)}</Text>

      <GestureDetector gesture={gesture}>
        <View style={[styles.container, { width, height }]}>
          {/* Track background */}
          <View style={styles.track}>
            {/* Buffered */}
            <View
              style={[
                styles.buffered,
                { width: `${bufferedProgress * 100}%` },
              ]}
            />

            {/* Progress */}
            <Animated.View style={[styles.progress, progressStyle]} />
          </View>

          {/* Thumb */}
          <Animated.View style={[styles.thumb, thumbStyle]} />
        </View>
      </GestureDetector>

      <Text style={styles.time}>{formatTime(duration / 1000)}</Text>
    </View>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  time: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    minWidth: 40,
  },
  container: {
    justifyContent: 'center',
  },
  track: {
    height: 4,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  buffered: {
    position: 'absolute',
    height: '100%',
    backgroundColor: 'rgba(92, 179, 204, 0.3)',
  },
  progress: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    marginLeft: -8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
```

## Circular Progress

### Composant CircularProgress
```typescript
import React from 'react';
import { View } from 'react-native';
import { Canvas, Path, Skia, useFont } from '@shopify/react-native-skia';
import { Colors } from '@/src/theme';

interface CircularProgressProps {
  progress: number;   // 0-1
  size: number;
  strokeWidth?: number;
  backgroundColor?: string;
  progressColor?: string;
  children?: React.ReactNode;
}

export function CircularProgress({
  progress,
  size,
  strokeWidth = 4,
  backgroundColor = Colors.backgroundSecondary,
  progressColor = Colors.primary,
  children,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  const backgroundPath = Skia.Path.Make();
  backgroundPath.addCircle(center, center, radius);

  const progressPath = Skia.Path.Make();
  const startAngle = -90; // Start from top
  const sweepAngle = 360 * Math.min(1, Math.max(0, progress));

  if (sweepAngle > 0) {
    progressPath.addArc(
      Skia.XYWHRect(
        strokeWidth / 2,
        strokeWidth / 2,
        size - strokeWidth,
        size - strokeWidth
      ),
      startAngle,
      sweepAngle
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        {/* Background circle */}
        <Path
          path={backgroundPath}
          color={backgroundColor}
          style="stroke"
          strokeWidth={strokeWidth}
        />

        {/* Progress arc */}
        <Path
          path={progressPath}
          color={progressColor}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
        />
      </Canvas>

      {/* Center content */}
      {children && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}
```

## Best Practices

1. **Performance**: Utiliser Skia pour les visualisations complexes
2. **60 FPS**: Limiter les updates a 60fps max
3. **Memory**: Recycler les paths Skia quand possible
4. **Accessibility**: Fournir des alternatives textuelles
5. **Battery**: Reduire les animations en arriere-plan
