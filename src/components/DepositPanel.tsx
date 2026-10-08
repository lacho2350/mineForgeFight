import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DepositInfo } from '../game/mineLayout';
import { RESOURCE_INFO } from '../game/resources';
import { GameButton, SectionLabel } from './GameUI';



// Details for the tile the player tapped, with the action that fits it: put a free peasant to mine a
// coal deposit, or take the miner off it.
export default function DepositPanel({
  info,
  idle,
  gold,
  pending,
  route,
  onAssign,
  onRelease,
  onClose,
}: {
  info: DepositInfo;
  idle: number;
  gold: number;
  /** A miner is reserved for this deposit and waiting for its tunnel. */
  pending: boolean;
  /** For a deposit with nothing dug beside it: the tunnel that would be dug to reach it. */
  route: { tiles: number; cost: number } | null;
  onAssign: () => void;
  onRelease: () => void;
  onClose: () => void;
}) {
  const title = info.deposit ? RESOURCE_INFO[info.deposit].deposit : info.status === 'empty' ? 'Rock' : 'Tunnel';
  const minedOut = info.total - info.remaining;
  const progress = info.total > 0 ? minedOut / info.total : 0;

  const detail = {
    worked: 'A miner is working this deposit.',
    available: idle > 0
      ? `${String(idle)} free peasant${idle === 1 ? '' : 's'} can mine. Tip: double-tap a deposit to assign straight away.`
      : 'No free peasants: wait for newcomers, stop a building, or release a miner.',
    unreachable: route
      ? `Nothing dug beside it yet. Diggers can cut a ${String(route.tiles)}-tile tunnel to it for ${String(route.cost)} gold, then a miner starts. Double-tap does the same.`
      : 'No legal tunnel reaches it from nearby. Dig closer to it first.',
    depleted: 'Mined out. Nothing left to dig here.',
    unminable: 'Miners can only work coal for now. Dig around it.',
    empty: 'Nothing to mine here.',
  }[info.status];

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <SectionLabel>ROW {String(info.row)} · COLUMN {String(info.column)}</SectionLabel>
          <Text style={styles.title}>{title}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close deposit details" onPress={onClose} style={styles.close}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      {info.deposit && (
        <View style={styles.amounts}>
          <Text style={styles.amount}>
            {Math.floor(info.remaining).toLocaleString()}
            <Text style={styles.amountTotal}> / {info.total.toLocaleString()} {RESOURCE_INFO[info.deposit].unit} LEFT</Text>
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round((1 - progress) * 100)}%` }]} />
          </View>
        </View>
      )}

      {!pending && <Text style={styles.detail}>{detail}</Text>}

      {pending && <Text style={styles.detail}>A miner is on the way. They start as soon as the tunnel is through.</Text>}
      {pending && <GameButton label="CANCEL" detail="back to the campfire" onPress={onRelease} secondary />}
      {!pending && info.status === 'unreachable' && route && (
        <GameButton
          label="DIG & ASSIGN"
          detail={`${String(route.tiles)} tiles · ${String(route.cost)} gold · ${String(idle)} free`}
          onPress={onAssign}
          disabled={idle <= 0 || gold < route.cost}
        />
      )}
      {info.status === 'available' && (
        <GameButton label="ASSIGN MINER" detail={`${String(idle)} free peasants`} onPress={onAssign} disabled={idle <= 0} />
      )}
      {info.status === 'worked' && <GameButton label="RELEASE MINER" detail="back to the campfire" onPress={onRelease} secondary />}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 10, marginTop: 12, padding: 12, borderWidth: 1, borderColor: '#3a4439', backgroundColor: '#161b15' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  titleBlock: { flex: 1, gap: 4 },
  title: { color: '#e7e1d0', fontFamily: 'Georgia', fontSize: 16 },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#9da28d', fontSize: 20, lineHeight: 22 },
  amounts: { gap: 6 },
  amount: { color: '#ffd166', fontFamily: 'monospace', fontSize: 16, fontWeight: '700' },
  amountTotal: { color: '#87907f', fontSize: 9, fontWeight: '400' },
  track: { height: 4, backgroundColor: '#343a31' },
  fill: { height: 4, backgroundColor: '#cfac68' },
  detail: { color: '#a9ad99', fontFamily: 'monospace', fontSize: 9 },
});
