/**
 * LiveWaveform - OPTIMIZED - Simple bars instead of SVG
 */
import React, { useEffect, useState, memo } from 'react';
import { View, StyleSheet } from 'react-native';
import SpynAudioEngine from '../../native/SpynAudioEngine';

interface Props {
  isActive?: boolean;
  height?: number;
  color?: string;
  style?: any;
}

const LiveWaveform = memo(({ isActive = true, height = 100, color = '#FF4466', style }: Props) => {
  const [wave, setWave] = useState<number[]>(new Array(32).fill(0.5));

  useEffect(() => {
    if (!isActive || !SpynAudioEngine.isAvailable()) return;

    const unsubscribe = SpynAudioEngine.onAudioData((data: any) => {
      if (data.wave && data.wave.length > 0) {
        setWave(data.wave);
      }
    });

    return unsubscribe;
  }, [isActive]);

  return (
    <View style={[styles.container, { height }, style]}>
      <View style={styles.waveContainer}>
        {wave.map((sample, i) => {
          const barHeight = Math.max(2, Math.abs(sample - 0.5) * 2 * height * 0.9);
          return (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: barHeight,
                  backgroundColor: color,
                  opacity: 0.6 + sample * 0.4,
                }
              ]}
            />
          );
        })}
      </View>
      <View style={[styles.centerLine, { top: height / 2 }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  waveContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 4,
  },
  bar: {
    width: 6,
    borderRadius: 3,
  },
  centerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});

export { LiveWaveform };
export default LiveWaveform;
