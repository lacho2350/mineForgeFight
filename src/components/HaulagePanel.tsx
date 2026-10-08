import { StyleSheet, Text, View } from 'react-native';
import { minersByLevel } from '../game/hold';
import { cartCost } from '../game/costs';
import { cartsOnLevel, type LevelCarts } from '../game/haulage';
import type { TechId } from '../game/techs';
import type { Site } from '../game/mineLayout';
import { GameButton, SectionLabel } from './GameUI';

// Carts and haulers per level: each worked level starts with one cart; more carts share out the
// level's miners so their coal and ore reach the surface faster.
export default function HaulagePanel({
  sites,
  carts,
  coal,
  gold,
  techs,
  onBuyCart,
}: {
  sites: Site[];
  carts: LevelCarts;
  coal: number;
  gold: number;
  techs: readonly TechId[];
  onBuyCart: (level: number) => void;
}) {
  const levels = [...minersByLevel(sites)].sort(([a], [b]) => a - b);

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View>
          <SectionLabel>HAULAGE</SectionLabel>
          <Text style={styles.subheading}>More carts, faster hauling</Text>
        </View>
        <Text style={styles.note}>UP TO 1 CART PER MINER</Text>
      </View>
      {levels.length === 0 && <Text style={styles.empty}>No miners are working yet.</Text>}
      {levels.map(([level, miners]) => {
        const current = cartsOnLevel(carts, level);
        const full = current >= miners;
        const cost = cartCost(current, techs);
        return (
          <View key={level} style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.level}>{level < 0 ? 'Entrance level' : `Gallery ${String(level + 1)}`}</Text>
              <Text style={styles.detail}>
                {String(miners)} miner{miners === 1 ? '' : 's'} · {String(Math.min(current, miners))} cart{current === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.button}>
              <GameButton
                label={full ? 'FULL' : 'ADD CART'}
                detail={full ? 'cart per miner' : `${String(cost.coal)} coal · ${String(cost.gold)} G`}
                onPress={() => onBuyCart(level)}
                disabled={full || coal < cost.coal || gold < cost.gold}
                secondary
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8, paddingTop: 22 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 },
  subheading: { color: '#e7e2d2', fontFamily: 'Georgia', fontSize: 15, marginTop: 4 },
  note: { color: '#7f8776', fontFamily: 'monospace', fontSize: 8 },
  empty: { color: '#87907f', fontFamily: 'monospace', fontSize: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: '#2f352d', paddingBottom: 8 },
  copy: { flex: 1, gap: 4 },
  level: { color: '#e7e1d0', fontFamily: 'Georgia', fontSize: 14 },
  detail: { color: '#87907f', fontFamily: 'monospace', fontSize: 9 },
  button: { width: 210 },
});
