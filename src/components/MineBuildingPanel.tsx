import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GameState } from '../game/state';
import { workforceOf } from '../game/hold';
import type { MineSurfaceBuilding } from './MineMapLayout';
import { MINE_BUILDINGS, buildingNow } from './mineBuildingStatus';
import { GameButton, SectionLabel } from './GameUI';

// The card for a tapped surface building on the mine map: what it is for, and what it's doing now.
export default function MineBuildingPanel({
  building,
  game,
  onAssign,
  onClose,
}: {
  building: MineSurfaceBuilding;
  game: GameState;
  onAssign: () => void;
  onClose: () => void;
}) {
  const info = MINE_BUILDINGS[building];
  const { rows, status } = buildingNow(building, game);
  const idle = workforceOf(game).idle;
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.icon}>{info.icon}</Text>
        <Text style={styles.title}>{info.name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Close the ${info.name}`} onPress={onClose} style={styles.close}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
      <Text style={styles.role}>{info.role}</Text>
      <Text style={[styles.status, styles[status.tone]]}>{status.text}</Text>
      <View style={styles.rows}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <SectionLabel>{row.label}</SectionLabel>
            <Text style={styles.value}>{row.value}</Text>
          </View>
        ))}
      </View>
      {building === 'cottage' && idle > 0 && <GameButton label="ASSIGN" detail={`Send ${String(idle)} to the free faces`} onPress={onAssign} />}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 8, marginTop: 12, padding: 12, borderWidth: 1, borderColor: '#3a4439', backgroundColor: '#161b15' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { fontSize: 16 },
  title: { flex: 1, color: '#e7e1d0', fontFamily: 'Georgia', fontSize: 16 },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#9da28d', fontSize: 20, lineHeight: 22 },
  role: { color: '#b9b5a6', fontSize: 12, lineHeight: 17 },
  status: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  busy: { color: '#9fd27a' },
  quiet: { color: '#e3c38a' },
  stuck: { color: '#f08a6e' },
  rows: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  row: { flexGrow: 1, flexBasis: 130, gap: 2 },
  value: { color: '#ffd166', fontFamily: 'monospace', fontSize: 13, fontWeight: '700' },
});
