import { StyleSheet, Text, View } from 'react-native';
import { MINE_SHAFT_X, MINE_TILE_SIZE } from './MineMapLayout';

export type MineSceneProps = {
  miners: number;
  depth: number;
  coal: number;
};

export default function MineSceneReadout({ miners, depth, coal }: MineSceneProps) {
  return (
    <View style={styles.readouts}>
      <View style={styles.readout}>
        <Text style={styles.readoutLabel}>SHAFT {String(depth).padStart(2, '0')}</Text>
        <Text style={styles.readoutValue}>{String(miners)} MINERS ON SHIFT</Text>
      </View>
      <View style={styles.readout}>
        <Text style={styles.readoutLabel}>MINE STOCKPILES</Text>
        <Text style={styles.readoutValue}>{String(coal)} COAL</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readouts: {
    position: 'absolute',
    top: 10,
    left: MINE_SHAFT_X - MINE_TILE_SIZE * 2,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
  },
  readout: { minWidth: 92, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: 'rgba(25, 31, 27, 0.9)' },
  readoutLabel: { color: '#aeb49e', fontFamily: 'monospace', fontSize: 7 },
  readoutValue: { color: '#e8dfc5', fontFamily: 'monospace', fontSize: 8, fontWeight: '700', marginTop: 3 },
});