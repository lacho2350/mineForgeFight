import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { MINE_RESOURCES, RESOURCE_INFO, type Resource, type Stock } from '../game/resources';

const TIP_WIDTH = 300;
const ROW_HEIGHT = 16;
const TIP_CHROME = 46;

// What the mine holds of every resource, shown by the mouse while it rests on a pile (a miner's bin or an
// exit bin): each resource in the miners' bins, at the mine exit and in the mine stockpile, and its total,
// with the pile's own resource picked out. Resources with none anywhere are left out.
export default function MinePileTip({
  resource,
  vein,
  mineExit,
  mineStock,
  x,
  y,
  width,
  height,
}: {
  resource: Resource;
  vein: Stock;
  mineExit: Stock;
  mineStock: Stock;
  /** The pointer, in screen pixels inside the map. */
  x: SharedValue<number>;
  y: SharedValue<number>;
  width: number;
  height: number;
}) {
  const rows = MINE_RESOURCES.map((id) => {
    const bins = Math.floor(vein[id]);
    const exit = Math.floor(mineExit[id]);
    const stock = Math.floor(mineStock[id]);
    return { id, bins, exit, stock, total: bins + exit + stock };
  }).filter((row) => row.total > 0 || row.id === resource);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const tipHeight = TIP_CHROME + ROW_HEIGHT * (rows.length + 1);
  // Beside the pointer, kept inside the map (above it near the bottom, left of it near the right edge).
  const place = useAnimatedStyle(() => {
    const px = x.get();
    const py = y.get();
    const left = px + 16 + TIP_WIDTH > width ? px - 16 - TIP_WIDTH : px + 16;
    const top = py + 16 + tipHeight > height ? py - 12 - tipHeight : py + 16;
    return { left: Math.max(4, left), top: Math.max(4, top) };
  });
  return (
    <Animated.View style={[styles.tip, place]}>
      <Text style={styles.title}>MINE STOCKPILES · {total.toLocaleString()} IN ALL</Text>
      <View style={styles.row}>
        <Text style={[styles.cell, styles.name, styles.head]}>RESOURCE</Text>
        <Text style={[styles.cell, styles.head]}>MINERS</Text>
        <Text style={[styles.cell, styles.head]}>EXIT</Text>
        <Text style={[styles.cell, styles.head]}>STOCK</Text>
        <Text style={[styles.cell, styles.head]}>TOTAL</Text>
      </View>
      {rows.map((row) => (
        <View key={row.id} style={[styles.row, row.id === resource && styles.picked]}>
          <View style={styles.name}>
            <View style={[styles.swatch, { backgroundColor: RESOURCE_INFO[row.id].tint, borderColor: RESOURCE_INFO[row.id].light }]} />
            <Text style={[styles.cell, styles.nameText]} numberOfLines={1}>{RESOURCE_INFO[row.id].name}</Text>
          </View>
          <Text style={styles.cell}>{row.bins.toLocaleString()}</Text>
          <Text style={styles.cell}>{row.exit.toLocaleString()}</Text>
          <Text style={styles.cell}>{row.stock.toLocaleString()}</Text>
          <Text style={[styles.cell, styles.total]}>{row.total.toLocaleString()}</Text>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tip: {
    position: 'absolute',
    width: TIP_WIDTH,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#5a6150',
    backgroundColor: 'rgba(17, 20, 16, 0.95)',
    pointerEvents: 'none',
  },
  title: { color: '#d2a45f', fontFamily: 'monospace', fontSize: 9, fontWeight: '700', marginBottom: 6 },
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 3 },
  picked: { backgroundColor: 'rgba(210, 164, 95, 0.22)' },
  name: { flex: 1.6, flexDirection: 'row', alignItems: 'center', gap: 5, textAlign: 'left' },
  nameText: { flex: 1, textAlign: 'left' },
  swatch: { width: 8, height: 8, borderWidth: 1 },
  cell: { flex: 1, color: '#e6dfcb', fontFamily: 'monospace', fontSize: 9, textAlign: 'right' },
  head: { color: '#89907f', fontSize: 8 },
  total: { color: '#f0d79a', fontWeight: '700' },
});
