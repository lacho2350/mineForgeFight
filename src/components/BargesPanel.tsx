import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GameState } from '../game/state';
import { docksOf } from '../game/hold';
import { bargeBlocker } from '../game/costs';
import { RESOURCE_INFO } from '../game/resources';
import { MAX_BARGES, isMoored, isWaiting, type Barge } from '../game/ship';

const clock = (seconds: number) => `${String(Math.floor(Math.max(0, seconds) / 60))}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;

// The barges waiting at the docks, each with its order: sell it some of what it wants, or fill it (the
// barge then sails off and its berth is free for the next one).
export default function BargesPanel({ game }: { game: GameState }) {
  const docks = docksOf(game);
  const waiting = game.barges.filter(isWaiting).sort((a, b) => a.berth - b.berth);
  const next = Math.max(0, game.nextBargeAt - game.elapsedSeconds);
  let status: string;
  if (docks.interval <= 0) status = 'The docks have no dockhands: no barges come, and waiting ones can’t be loaded.';
  else if (waiting.length >= MAX_BARGES) status = `All ${String(MAX_BARGES)} berths are taken: fill an order to make room for the next barge.`;
  else status = `${String(waiting.length)} of ${String(MAX_BARGES)} berths taken · the next barge ${next > 0 ? `in ${clock(next)}` : 'is on its way'} · one every ${clock(docks.interval)}`;
  return (
    <View style={styles.panel}>
      <Text style={styles.status}>{status}</Text>
      {waiting.length === 0 && <Text style={styles.empty}>No barges at the docks yet.</Text>}
      {waiting.map((barge) => (
        <BargeCard
          key={barge.id}
          barge={barge}
          stock={Math.floor(game.warehouse[barge.resource])}
          blocker={bargeBlocker(game, barge)}
          moored={isMoored(barge, game.elapsedSeconds)}
          onSell={game.sellToBarge}
          onSendAway={game.sendBargeAway}
        />
      ))}
    </View>
  );
}

// One barge's order, with what selling 10 or filling it (as far as the warehouse allows) earns; a barge can
// also be sent away empty to make room (one still sailing in turns back).
const BargeCard = memo(function BargeCard({ barge, stock, blocker, moored, onSell, onSendAway }: {
  barge: Barge;
  stock: number;
  blocker: string | null;
  moored: boolean;
  onSell: (id: number, amount: number | 'all') => void;
  onSendAway: (id: number) => void;
}) {
  const info = RESOURCE_INFO[barge.resource];
  const fill = Math.min(barge.wants, stock);
  return (
    <View style={styles.card}>
      <View style={[styles.flag, { backgroundColor: info.color, borderColor: info.light }]} />
      <View style={styles.copy}>
        <Text style={styles.name}>
          Wants {barge.wants.toLocaleString()} {info.name.toLowerCase()}
        </Text>
        <Text style={styles.detail}>
          {String(barge.price)} G each (+{String(Math.round(barge.premium * 100))}%) · {stock.toLocaleString()} in the warehouse
        </Text>
        {blocker && <Text style={styles.blocker}>{blocker}</Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={moored ? 'Send this barge away without trading' : 'Turn this barge back'}
          onPress={() => onSendAway(barge.id)}
          hitSlop={8}
          style={({ pressed }) => [styles.sendAway, pressed && styles.buttonPressed]}
        >
          <Text style={styles.sendAwayText}>{moored ? 'SEND AWAY' : 'TURN BACK'}</Text>
        </Pressable>
      </View>
      <SellButton label="10" disabled={!!blocker} onPress={() => onSell(barge.id, 10)} accessibilityLabel={`Sell 10 ${info.name} to this barge`} />
      <SellButton
        label={fill >= barge.wants ? `FILL +${Math.floor(fill * barge.price).toLocaleString()}` : `SELL ${fill.toLocaleString()} +${Math.floor(fill * barge.price).toLocaleString()}`}
        disabled={!!blocker || fill <= 0}
        onPress={() => onSell(barge.id, 'all')}
        accessibilityLabel={`Sell ${String(fill)} ${info.name} to this barge for ${String(Math.floor(fill * barge.price))} gold`}
        wide
      />
    </View>
  );
});

function SellButton({ label, disabled, onPress, accessibilityLabel, wide = false }: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  wide?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, wide && styles.buttonWide, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}
    >
      <Text style={[styles.buttonText, wide && styles.buttonTextWide]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 8 },
  status: { color: '#a9ad99', fontFamily: 'monospace', fontSize: 9, lineHeight: 14 },
  empty: { color: '#858d7c', fontFamily: 'monospace', fontSize: 10 },
  card: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderColor: '#2f352d' },
  flag: { width: 12, height: 18, borderWidth: 1 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: '#e8e3d1', fontFamily: 'Georgia', fontSize: 13 },
  detail: { color: '#898f7e', fontFamily: 'monospace', fontSize: 8 },
  blocker: { color: '#e08a72', fontFamily: 'monospace', fontSize: 8 },
  sendAway: { alignSelf: 'flex-start', marginTop: 2 },
  sendAwayText: { color: '#8fb8cc', fontFamily: 'monospace', fontSize: 8, fontWeight: '700', textDecorationLine: 'underline' },
  button: {
    minWidth: 40,
    minHeight: 30,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d2a45f',
  },
  buttonWide: { minWidth: 96, backgroundColor: '#d2a45f' },
  buttonDisabled: { opacity: 0.35 },
  buttonPressed: { opacity: 0.68 },
  buttonText: { color: '#eee9d9', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  buttonTextWide: { color: '#20231b' },
});
