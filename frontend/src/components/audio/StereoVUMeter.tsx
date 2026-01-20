/**
 * StereoVUMeter - OPTIMIZED - No Animated API
 */
import React, { useEffect, useState, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SpynAudioEngine from '../../native/SpynAudioEngine';

interface Props {
  isActive?: boolean;
  style?: any;
}

const StereoVUMeter = memo(({ isActive = true, style }: Props) => {
  const [levels, setLevels] = useState({ left: 0, right: 0, peakL: 0, peakR: 0 });

  useEffect(() => {
    if (!isActive || !SpynAudioEngine.isAvailable()) return;

    const unsubscribe = SpynAudioEngine.onAudioData((data: any) => {
      const left = ((data.left || -60) + 60) / 60 * 100;
      const right = ((data.right || -60) + 60) / 60 * 100;
      const peakL = ((data.peakL || -60) + 60) / 60 * 100;
      const peakR = ((data.peakR || -60) + 60) / 60 * 100;
      setLevels({ left, right, peakL, peakR });
    });

    return unsubscribe;
  }, [isActive]);

  const renderBar = (level: number, peak: number, label: string) => (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <View style={styles.gradient}>
          <View style={[styles.seg, styles.green, { flex: 60 }]} />
          <View style={[styles.seg, styles.yellow, { flex: 20 }]} />
          <View style={[styles.seg, styles.red, { flex: 20 }]} />
        </View>
        <View style={[styles.mask, { left: `${Math.min(100, level)}%` }]} />
        <View style={[styles.peak, { left: `${Math.min(100, peak)}%` }]} />
      </View>
      <Text style={styles.db}>{level > 5 ? Math.round(level * 0.6 - 60) : '-∞'}</Text>
    </View>
  );

  return (
    <View style={[styles.container, style]}>
      {renderBar(levels.left, levels.peakL, 'L')}
      {renderBar(levels.right, levels.peakR, 'R')}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { padding: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  label: { color: '#fff', fontSize: 12, fontWeight: 'bold', width: 18 },
  track: { flex: 1, height: 16, backgroundColor: '#111', borderRadius: 2, overflow: 'hidden', marginHorizontal: 6, position: 'relative' },
  gradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  seg: { height: '100%' },
  green: { backgroundColor: '#00CC00' },
  yellow: { backgroundColor: '#CCCC00' },
  red: { backgroundColor: '#FF0000' },
  mask: { position: 'absolute', top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)' },
  peak: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#fff', marginLeft: -1 },
  db: { color: '#888', fontSize: 10, width: 28, textAlign: 'right' },
});

export { StereoVUMeter };
export default StereoVUMeter;
