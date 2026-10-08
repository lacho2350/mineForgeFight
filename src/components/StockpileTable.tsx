import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RESOURCES, RESOURCE_INFO, type Resource, type Stock } from '../game/resources';

type Stage = { label: string; stock: Stock; capacity: number };

// Every resource's stockpiles along the haul route, from the miners' bins to the warehouse.
export default function StockpileTable({ stages }: { stages: Stage[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.row}>
        <Text style={[styles.heading, styles.nameCell]}>RESOURCE</Text>
        {stages.map((stage) => (
          <Text key={stage.label} style={[styles.heading, styles.cell]}>{stage.label}</Text>
        ))}
      </View>
      {RESOURCES.map((resource) => (
        <StockRow
          key={resource}
          resource={resource}
          cells={stages.map((stage) => `${String(Math.floor(stage.stock[resource]))}/${String(stage.capacity)}`).join(' ')}
        />
      ))}
    </View>
  );
}

// One resource's row; `cells` ("value/capacity" per stage) is a string, so the row only redraws when a number changes.
const StockRow = memo(function StockRow({ resource, cells }: { resource: Resource; cells: string }) {
  const info = RESOURCE_INFO[resource];
  return (
    <View style={styles.row}>
      <View style={[styles.nameCell, styles.name]}>
        <View style={[styles.swatch, { backgroundColor: info.color, borderColor: info.light }]} />
        <Text style={styles.nameText}>{info.name.toUpperCase()}</Text>
      </View>
      {cells.split(' ').map((cell, index) => {
        const [value, capacity] = cell.split('/').map(Number);
        const fill = capacity > 0 ? Math.min(1, value / capacity) : 0;
        return (
          <View key={index} style={styles.cell}>
            <Text style={[styles.value, value <= 0 && styles.valueEmpty]}>
              {String(value)}
              <Text style={styles.capacity}> / {String(capacity)}</Text>
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(fill * 100)}%`, backgroundColor: info.tint }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  table: { gap: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { color: '#828a78', fontFamily: 'monospace', fontSize: 7 },
  nameCell: { width: 78 },
  name: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 9, height: 9, borderWidth: 1 },
  nameText: { color: '#c9c4b2', fontFamily: 'monospace', fontSize: 8 },
  cell: { flex: 1, minWidth: 0, gap: 3 },
  value: { color: '#e6dfcb', fontFamily: 'monospace', fontSize: 10 },
  valueEmpty: { color: '#5f665a' },
  capacity: { color: '#737c6f', fontSize: 7 },
  track: { height: 2, backgroundColor: '#343a31' },
  fill: { height: 2 },
});
