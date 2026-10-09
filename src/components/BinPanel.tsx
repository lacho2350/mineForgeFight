import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RESOURCE_INFO, type Resource } from '../game/resources';
import { SectionLabel } from './GameUI';

export type BinStage = { label: string; amount: number; capacity: number };

// The stock of the resource whose bin the player tapped on the mine map, at every stage of the haul:
// the miners' bins, the bin at the mine exit, the mine stockpile and the warehouse.
export default function BinPanel({ resource, stages, onClose }: { resource: Resource; stages: BinStage[]; onClose: () => void }) {
  const info = RESOURCE_INFO[resource];
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={[styles.swatch, { backgroundColor: info.color, borderColor: info.light }]} />
        <Text style={styles.title}>{info.name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Close the ${info.name.toLowerCase()} bins`} onPress={onClose} style={styles.close}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
      <View style={styles.stages}>
        {stages.map((stage) => {
          const fill = stage.capacity > 0 ? Math.min(1, stage.amount / stage.capacity) : 0;
          return (
            <View key={stage.label} style={styles.stage}>
              <SectionLabel>{stage.label}</SectionLabel>
              <Text style={[styles.amount, stage.amount <= 0 && styles.empty]}>
                {Math.floor(stage.amount).toLocaleString()}
                <Text style={styles.capacity}> / {stage.capacity.toLocaleString()}</Text>
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(fill * 100)}%`, backgroundColor: info.tint }]} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 10, marginTop: 12, padding: 12, borderWidth: 1, borderColor: '#3a4439', backgroundColor: '#161b15' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 14, height: 14, borderWidth: 1 },
  title: { flex: 1, color: '#e7e1d0', fontFamily: 'Georgia', fontSize: 16 },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#9da28d', fontSize: 20, lineHeight: 22 },
  stages: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stage: { flexGrow: 1, flexBasis: 140, gap: 4 },
  amount: { color: '#ffd166', fontFamily: 'monospace', fontSize: 16, fontWeight: '700' },
  empty: { color: '#5f665a' },
  capacity: { color: '#87907f', fontSize: 11, fontWeight: '400' },
  track: { height: 4, backgroundColor: '#343a31' },
  fill: { height: 4 },
});
