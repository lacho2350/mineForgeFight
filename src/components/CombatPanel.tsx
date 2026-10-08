import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BUILDING_INFO, type BuildingId } from '../game/buildings';
import { RAID_SIDES, SIDE_NAMES } from '../game/cityMap';
import type { GameState } from '../game/state';
import { affordableRecruits, unitAvailable } from '../game/hold';
import { ITEM_INFO, UNIT_GEAR } from '../game/items';
import { trapsFacing } from '../game/traps';
import { ARMY_RECRUITING, ARMY_UNITS, UNIT_STATS, armyValue, type ArmyUnit } from '../game/units';
import type { Workforce } from '../game/workforce';
import { DefenceSummary } from './BuildingsPanel';
import { BUILDING_ICONS } from './buildingIcons';
import { GameButton, SectionLabel } from './GameUI';
import RaidBanner from './RaidBanner';

// The War panel, behind the ⚔️ button on the side of the stronghold: everything about fighting in one
// place — the raid now (sighted, in battle, or the next one), the auto-resolver, the army with its
// recruits and gear, the defences with the traps on every side, and what's at stake.

/** How many recruits could be hired right now, over every unit (each needs gold, its gear and a free peasant). */
export function hireableNow(game: GameState, workforce: Workforce) {
  const total = ARMY_UNITS.reduce((sum, unit) => sum + (unitAvailable(game, unit) ? Math.min(Math.floor(game.recruits[unit]), affordableRecruits(game, unit)) : 0), 0);
  return Math.min(total, workforce.free);
}

const DEFENCES: BuildingId[] = ['keep', 'wall', 'towers', 'gate', 'moat', 'armory'];

export default function CombatPanel({ game, workforce, onOpenBuilding, onLayTraps }: {
  game: GameState;
  workforce: Workforce;
  onOpenBuilding: (id: BuildingId) => void;
  onLayTraps: () => void;
}) {
  const units = ARMY_UNITS.filter((unit) => game.army[unit] > 0 || game.recruits[unit] >= 1 || game.buildings[ARMY_RECRUITING[unit].dwelling] > 0);
  return (
    <View style={styles.panel}>
      <RaidBanner inPanel />
      <GameButton
        label={game.autoResolveRaids ? 'AUTO-RESOLVE RAIDS: ON' : 'AUTO-RESOLVE RAIDS: OFF'}
        detail={game.autoResolveRaids ? 'raids are fought out the moment they arrive' : 'raids wait for your orders (30 s, then they fight on their own)'}
        onPress={() => game.setAutoResolveRaids(!game.autoResolveRaids)}
        secondary
      />

      <View style={styles.block}>
        <SectionLabel>ARMY · VALUE {armyValue(game.army).toLocaleString()} · {String(workforce.free)} PEASANTS FREE</SectionLabel>
        {units.length === 0 && <Text style={styles.note}>No soldiers and no dwellings yet: build a Guardhouse.</Text>}
        {units.map((unit) => (
          <UnitRow key={unit} game={game} unit={unit} free={workforce.free} onOpen={() => onOpenBuilding(ARMY_RECRUITING[unit].dwelling)} />
        ))}
      </View>

      <View style={styles.block}>
        <SectionLabel>DEFENCES</SectionLabel>
        <DefenceSummary game={game} workforce={workforce} />
        <Text style={styles.note}>
          TRAPS BY SIDE ·{' '}
          {RAID_SIDES.map((side) => `${SIDE_NAMES[side].toUpperCase()} ${String(trapsFacing(game.traps, side).length)}`).join(' · ')}
        </Text>
        <GameButton label="LAY TRAPS" detail="in the trap belt (sieges cross it)" onPress={onLayTraps} secondary />
        <View style={styles.links}>
          {DEFENCES.map((id) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`Open the ${BUILDING_INFO[id].name}`}
              onPress={() => onOpenBuilding(id)}
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
            >
              <Text style={styles.linkIcon}>{BUILDING_ICONS[id]}</Text>
              <Text style={styles.linkText}>
                {BUILDING_INFO[id].name.toUpperCase()} {game.buildings[id] > 0 ? `LV ${String(game.buildings[id])}` : '—'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={styles.note}>
        A SIEGE: WALLS, GATE, TOWERS, OIL, MOAT AND TRAPS FIGHT TOO; LOST, THE RAIDERS TAKE 30%. IN THE FIELD: TROOPS ONLY; LOST, 15%; WON,
        HALF AGAIN THE BOUNTY. RAIDS GROW WITH THE HOLD AND COME SMALLER AFTER LOSSES.
      </Text>
    </View>
  );
}

// One unit: how many stand in the army, wait at the dwelling, and have gear there; RECRUIT ALL.
function UnitRow({ game, unit, free, onOpen }: { game: GameState; unit: ArmyUnit; free: number; onOpen: () => void }) {
  const stats = UNIT_STATS[unit];
  const { dwelling } = ARMY_RECRUITING[unit];
  const waiting = Math.floor(game.recruits[unit]);
  const gear = Math.floor(game.dwellingGear[unit] ?? 0);
  const available = unitAvailable(game, unit);
  const canHire = available ? Math.min(waiting, affordableRecruits(game, unit), free) : 0;
  const why = !available
    ? game.buildings[dwelling] < 1
      ? `build the ${BUILDING_INFO[dwelling].name}`
      : `needs the keep at level ${String(ARMY_RECRUITING[unit].requiresKeep)}`
    : waiting < 1
      ? 'none waiting'
      : gear < 1
        ? `no ${ITEM_INFO[UNIT_GEAR[unit]].plural.toLowerCase()} at the ${BUILDING_INFO[dwelling].name}`
        : free < 1
          ? 'no free peasants'
          : 'not enough gold';
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open the ${BUILDING_INFO[dwelling].name}`} onPress={onOpen} style={({ pressed }) => [styles.unit, pressed && styles.pressed]}>
        <Text style={styles.icon}>{BUILDING_ICONS[dwelling]}</Text>
        <View style={styles.copy}>
          <Text style={styles.name}>{stats.plural}</Text>
          <Text style={styles.detail}>
            IN ARMY {String(game.army[unit])} · WAITING {String(waiting)} · {ITEM_INFO[UNIT_GEAR[unit]].plural.toUpperCase()} HERE {String(gear)}
          </Text>
          {canHire < 1 && <Text style={styles.why}>{why}</Text>}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Recruit ${String(canHire)} ${stats.plural}`}
        accessibilityState={{ disabled: canHire < 1 }}
        disabled={canHire < 1}
        onPress={() => game.recruit(unit, 'max')}
        style={({ pressed }) => [styles.hire, canHire < 1 && styles.hireDisabled, pressed && canHire > 0 && styles.pressed]}
      >
        <Text style={styles.hireText}>RECRUIT {String(canHire)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  block: { gap: 6 },
  note: { color: '#898f7e', fontFamily: 'monospace', fontSize: 8, lineHeight: 12 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderColor: '#2f352d' },
  unit: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  icon: { width: 24, fontSize: 16, textAlign: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: '#e8e3d1', fontFamily: 'Georgia', fontSize: 13 },
  detail: { color: '#a9ad99', fontFamily: 'monospace', fontSize: 8 },
  why: { color: '#e08a72', fontFamily: 'monospace', fontSize: 8 },
  hire: { minWidth: 92, minHeight: 32, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d2a45f' },
  hireDisabled: { opacity: 0.35 },
  hireText: { color: '#20231b', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 30, paddingHorizontal: 8, borderWidth: 1, borderColor: '#3a4439', backgroundColor: '#1a211b' },
  linkIcon: { fontSize: 13 },
  linkText: { color: '#d6c79e', fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  pressed: { opacity: 0.68 },
});
