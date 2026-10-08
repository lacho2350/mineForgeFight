import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { buildingStats } from '../game/buildings';
import type { GameState } from '../game/state';
import { forgeSpeedsOf, forgeStatus, loadText, wagonText, workforceOf, type ForgeStatus } from '../game/hold';
import { FORGE_IDS, FORGE_NAMES, FORGE_OUTPUT_CAP, FORGE_TARGETS, loadUnits, type ForgeId } from '../game/forges';
import { GEAR_IDS, ITEM_INFO, PART_IDS, UNIT_GEAR, recipeParts, type ItemId } from '../game/items';
import { RESOURCE_INFO, type Resource } from '../game/resources';
import { ARMY_UNITS, UNIT_STATS } from '../game/units';

const resourceName = (resource: Resource) => RESOURCE_INFO[resource].name.toLowerCase();
const GEAR_FOR = Object.fromEntries(ARMY_UNITS.map((unit) => [UNIT_GEAR[unit], UNIT_STATS[unit].plural.toLowerCase()])) as Partial<Record<ItemId, string>>;
const SHORT_NAME = (forge: ForgeId) => FORGE_NAMES[forge].replace('Forge ', '');

// One forge: what it's doing, how many it keeps in store, and its task — any part or piece of gear.
export function ForgePanel({ game, forge }: { game: GameState; forge: ForgeId }) {
  const task = game.forgeTasks[forge];
  const status = forgeStatus(game, forge);
  // Which other forges make what, to tag the list.
  const others: Partial<Record<ItemId, string>> = {};
  for (const other of FORGE_IDS) {
    const item = game.forgeTasks[other]?.item;
    if (other !== forge && item && game.buildings[other] > 0) others[item] = others[item] ? `${others[item] ?? ''}, ${SHORT_NAME(other)}` : `Forge ${SHORT_NAME(other)}`;
  }
  const row = (item: ItemId) => (
    <TaskRow
      key={item}
      item={item}
      stock={Math.floor(game.items[item])}
      forUnits={GEAR_FOR[item]}
      madeBy={others[item]}
      current={task?.item === item}
      onPick={(picked) => game.setForgeTask(forge, picked)}
    />
  );
  return (
    <View style={styles.panel}>
      {game.buildings[forge] > 0 && (
        <>
          <StatusCard status={status} item={task?.item ?? null} />
          {task && (
            <Text style={styles.note}>
              ON ITS SHELF: {loadUnits(task.stock) > 0 ? loadText(task.stock).toUpperCase() : 'NOTHING'} · RACK {String(task.output)}/{String(FORGE_OUTPUT_CAP)} FINISHED, WAITING FOR A CART
            </Text>
          )}
          {task && (
            <View style={styles.targets}>
              <Text style={styles.targetLabel}>KEEP IN STORE</Text>
              {FORGE_TARGETS.map((target) => (
                <Pressable
                  key={target}
                  accessibilityRole="button"
                  accessibilityState={{ selected: task.target === target }}
                  accessibilityLabel={`Keep ${String(target)} in store`}
                  onPress={() => game.setForgeTarget(forge, target)}
                  style={({ pressed }) => [styles.target, task.target === target && styles.targetOn, pressed && styles.pressed]}
                >
                  <Text style={[styles.targetText, task.target === target && styles.targetTextOn]}>{String(target)}</Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take this forge off its task"
                onPress={() => game.setForgeTask(forge, null)}
                style={({ pressed }) => [styles.stop, pressed && styles.pressed]}
              >
                <Text style={styles.stopText}>NO TASK</Text>
              </Pressable>
            </View>
          )}
          <Text style={styles.heading}>TASK · TAP WHAT THIS FORGE MAKES</Text>
          <Text style={styles.note}>Each step needs its parts in store: set other forges to make them, or this one to each in turn. Carts from the Cart Depot bring the materials and take the pieces to the store.</Text>
          {GEAR_IDS.map(row)}
          <Text style={styles.heading}>PARTS</Text>
          {PART_IDS.map(row)}
        </>
      )}
      <GearStore game={game} />
    </View>
  );
}

// Every forge at a glance and everything in the gear store (the armory's pop-up shows this too).
export function GearStore({ game }: { game: GameState }) {
  const speeds = forgeSpeedsOf(game);
  const built = FORGE_IDS.filter((forge) => game.buildings[forge] > 0);
  const stocked = [...GEAR_IDS, ...PART_IDS].filter((item) => game.items[item] >= 1);
  const wagons = buildingStats(game.buildings, workforceOf(game).staff, game.techs).wagons;
  return (
    <View style={styles.store}>
      <Text style={styles.heading}>CARTS · {String(game.wagonJobs.length)} OUT OF {String(Math.max(wagons, game.wagonJobs.length))}</Text>
      {wagons === 0 && game.wagonJobs.length === 0 && <Text style={styles.note}>No carts: build a Cart Depot (and give it carters), or nothing reaches the forges.</Text>}
      <Text style={styles.heading}>THE FORGES</Text>
      {built.length === 0 && <Text style={styles.note}>No forge built yet: BUILD → Forge I.</Text>}
      {built.map((forge) => {
        const status = forgeStatus(game, forge, speeds);
        const item = game.forgeTasks[forge]?.item;
        return (
          <View key={forge} style={styles.forgeLine}>
            <Text style={styles.forgeName}>{FORGE_NAMES[forge]}</Text>
            <Text style={styles.icon}>{item ? ITEM_INFO[item].icon : '·'}</Text>
            <Text style={[styles.forgeStatus, status.state === 'working' ? styles.ok : status.state === 'full' || status.state === 'idle' ? null : styles.bad]} numberOfLines={2}>
              {item ? `${ITEM_INFO[item].plural}: ` : ''}
              {status.text}
            </Text>
          </View>
        );
      })}
      {ARMY_UNITS.some((unit) => (game.dwellingGear[unit] ?? 0) >= 1) && (
        <>
          <Text style={styles.heading}>GEAR AT THE DWELLINGS</Text>
          <View style={styles.stockGrid}>
            {ARMY_UNITS.filter((unit) => (game.dwellingGear[unit] ?? 0) >= 1).map((unit) => (
              <View key={unit} style={styles.stockChip}>
                <Text style={styles.icon}>{ITEM_INFO[UNIT_GEAR[unit]].icon}</Text>
                <Text style={styles.stockText}>
                  {String(Math.floor(game.dwellingGear[unit] ?? 0))} for {UNIT_STATS[unit].plural.toLowerCase()}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
      <Text style={styles.heading}>GEAR AND PARTS IN STORE</Text>
      {stocked.length === 0 ? (
        <Text style={styles.note}>Nothing yet.</Text>
      ) : (
        <View style={styles.stockGrid}>
          {stocked.map((item) => (
            <View key={item} style={styles.stockChip} accessibilityLabel={`${ITEM_INFO[item].plural}: ${String(Math.floor(game.items[item]))}`}>
              <Text style={styles.icon}>{ITEM_INFO[item].icon}</Text>
              <Text style={styles.stockText}>
                {String(Math.floor(game.items[item]))} {ITEM_INFO[item].plural.toLowerCase()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// The Cart Depot: every cart, out on a trip or waiting.
export function DepotPanel({ game }: { game: GameState }) {
  const stats = buildingStats(game.buildings, workforceOf(game).staff, game.techs);
  const idle = Math.max(0, stats.wagons - game.wagonJobs.length);
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>
        CARTS · {String(stats.wagons)} · EACH CARRIES {String(stats.wagonLoad)} · ×{String(stats.wagonSpeed)} WALKING SPEED
      </Text>
      {game.wagonJobs.map((job) => (
        <View key={job.id} style={styles.forgeLine}>
          <Text style={styles.icon}>🛒</Text>
          <Text style={[styles.forgeStatus, styles.ok]}>{wagonText(game, job)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Call this cart back"
            onPress={() => game.recallWagon(job.id)}
            hitSlop={6}
            style={({ pressed }) => [styles.stop, pressed && styles.pressed]}
          >
            <Text style={styles.stopText}>RECALL</Text>
          </Pressable>
        </View>
      ))}
      {idle > 0 && <Text style={styles.note}>{String(idle)} cart{idle === 1 ? '' : 's'} waiting at the depot.</Text>}
      {stats.wagons === 0 && <Text style={styles.note}>No carters: free a peasant or restart the depot.</Text>}
      <Text style={styles.note}>
        Carts bring each forge its materials from the warehouse and take its finished pieces to the store, along the roads: lay roads between the
        depot, the warehouse and the forges, and build them close together.
      </Text>
    </View>
  );
}

function StatusCard({ status, item }: { status: ForgeStatus; item: ItemId | null }) {
  return (
    <View style={styles.statusCard}>
      <Text style={styles.bigIcon}>{item ? ITEM_INFO[item].icon : '⚒️'}</Text>
      <View style={styles.copy}>
        <Text style={styles.name}>{item ? ITEM_INFO[item].plural : 'Idle'}</Text>
        <Text style={[styles.detail, status.state === 'waiting' || status.state === 'unstaffed' ? styles.bad : null]}>{status.text}</Text>
        {item && (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(Math.min(1, status.progress) * 100)}%` }]} />
          </View>
        )}
      </View>
    </View>
  );
}

// One item the forge could make: what's in store, what it takes, and which other forges make it already.
const TaskRow = memo(function TaskRow({ item, stock, forUnits, madeBy, current, onPick }: {
  item: ItemId;
  stock: number;
  forUnits?: string;
  madeBy?: string;
  current: boolean;
  onPick: (item: ItemId) => void;
}) {
  const info = ITEM_INFO[item];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: current }}
      accessibilityLabel={`Make ${info.plural}`}
      onPress={() => onPick(item)}
      style={({ pressed }) => [styles.row, current && styles.rowOn, pressed && styles.pressed]}
    >
      <Text style={styles.icon}>{info.icon}</Text>
      <View style={styles.copy}>
        <Text style={styles.name}>
          {info.name}
          <Text style={styles.stock}>  {String(stock)} in store</Text>
        </Text>
        <Text style={styles.detail}>
          {forUnits ? `For ${forUnits} · ` : ''}
          {recipeParts(item, resourceName).join(' · ')} · {String(info.recipe.seconds)} s
        </Text>
        {madeBy && <Text style={styles.madeBy}>{madeBy} makes these</Text>}
      </View>
      {current && <Text style={styles.currentTag}>MAKING</Text>}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  panel: { gap: 8, marginTop: 12 },
  heading: { color: '#c98c5d', fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.5, marginTop: 6 },
  note: { color: '#898f7e', fontFamily: 'monospace', fontSize: 8, lineHeight: 12 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderWidth: 1, borderColor: '#3a4439', backgroundColor: '#1a211b' },
  bigIcon: { width: 30, fontSize: 24, textAlign: 'center' },
  targets: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  targetLabel: { color: '#a9ad99', fontFamily: 'monospace', fontSize: 8, marginRight: 2 },
  target: { minWidth: 36, minHeight: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#4a5244' },
  targetOn: { borderColor: '#d2a45f', backgroundColor: '#d2a45f' },
  targetText: { color: '#c9c4b2', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  targetTextOn: { color: '#20231b' },
  stop: { marginLeft: 'auto', minHeight: 28, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#6a4a3a' },
  stopText: { color: '#e0a08a', fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderColor: '#2f352d' },
  rowOn: { backgroundColor: '#2a2a1c', borderColor: '#d2a45f' },
  icon: { width: 24, fontSize: 16, textAlign: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  name: { color: '#e8e3d1', fontFamily: 'Georgia', fontSize: 13 },
  stock: { color: '#d6c79e', fontFamily: 'monospace', fontSize: 9 },
  detail: { color: '#898f7e', fontFamily: 'monospace', fontSize: 8 },
  madeBy: { color: '#8fb8cc', fontFamily: 'monospace', fontSize: 8 },
  currentTag: { color: '#d2a45f', fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  track: { height: 3, backgroundColor: '#343a31' },
  fill: { height: 3, backgroundColor: '#d2a45f' },
  store: { gap: 6, marginTop: 8 },
  forgeLine: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 26 },
  forgeName: { width: 76, color: '#e8e3d1', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  forgeStatus: { flex: 1, color: '#a9ad99', fontFamily: 'monospace', fontSize: 8 },
  ok: { color: '#b5c97f' },
  bad: { color: '#e08a72' },
  stockGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stockChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 6, borderWidth: 1, borderColor: '#3a4439' },
  stockText: { color: '#d6c79e', fontFamily: 'monospace', fontSize: 9 },
  pressed: { opacity: 0.68 },
});
