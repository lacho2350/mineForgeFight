import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RESOURCE_INFO, type Resource } from '../game/resources';
import { SectionLabel } from './GameUI';

/** Which store was tapped on the mine map: an exit warehouse on the surface, or a miner's bin below. */
export type BinPlace = 'exit' | 'miner';

// The stock in the store the player tapped on the mine map — just that building: an exit warehouse's
// heap of its resource, or what the miners' bins of that resource hold.
export default function BinPanel({
  resource,
  place,
  amount,
  capacity,
  onClose,
}: {
  resource: Resource;
  place: BinPlace;
  amount: number;
  capacity: number;
  onClose: () => void;
}) {
  const info = RESOURCE_INFO[resource];
  const title = place === 'exit' ? `${info.name} Warehouse` : `${info.name} Bins`;
  const fill = capacity > 0 ? Math.min(1, amount / capacity) : 0;
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={[styles.swatch, { backgroundColor: info.color, borderColor: info.light }]} />
        <Text style={styles.title}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Close the ${title}`} onPress={onClose} style={styles.close}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
      <SectionLabel>{place === 'exit' ? 'IN STOCK' : 'IN THE MINERS’ BINS'}</SectionLabel>
      <Text style={[styles.amount, amount <= 0 && styles.empty]}>
        {Math.floor(amount).toLocaleString()}
        <Text style={styles.capacity}> / {capacity.toLocaleString()}</Text>
        {fill >= 1 && <Text style={styles.full}>  FULL</Text>}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(fill * 100)}%`, backgroundColor: info.tint }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 6, marginTop: 12, padding: 12, borderWidth: 1, borderColor: '#3a4439', backgroundColor: '#161b15' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 14, height: 14, borderWidth: 1 },
  title: { flex: 1, color: '#e7e1d0', fontFamily: 'Georgia', fontSize: 16 },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#9da28d', fontSize: 20, lineHeight: 22 },
  amount: { color: '#ffd166', fontFamily: 'monospace', fontSize: 18, fontWeight: '700' },
  empty: { color: '#5f665a' },
  capacity: { color: '#87907f', fontSize: 12, fontWeight: '400' },
  full: { color: '#f08a6e', fontSize: 12 },
  track: { height: 5, backgroundColor: '#343a31' },
  fill: { height: 5 },
});
