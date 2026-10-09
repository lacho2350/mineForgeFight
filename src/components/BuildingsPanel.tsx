import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BUILDING_IDS,
  BUILDING_INFO,
  MAX_BUILDING_LEVEL,
  buildingCost,
  buildingEffects,
  buildingStats,
  buildingTime,
  DWELLING_UNIT,
  crewSize,
  staffNeeded,
  workedLevel,
  type BuildingId,
} from '../game/buildings';
import { isPlaceable } from '../game/cityMap';
import type { GameState } from '../game/state';
import {
  affordableRecruits,
  forgesMaking,
  freeForge,
  holdPowerOf,
  isShownBuilding,
  siteFactor,
  siteWalk,
  unitAvailable,
  workforceOf,
} from '../game/hold';
import { destroyRefund, upgradeBlocker } from '../game/costs';
import { gearComing } from '../game/wagons';
import { FORGE_IDS, FORGE_NAMES, isForge } from '../game/forges';
import { isHouse } from '../game/houses';
import { techsOf } from '../game/techs';
import { ITEM_INFO, UNIT_GEAR } from '../game/items';
import type { Workforce } from '../game/workforce';
import { RESOURCES, RESOURCE_INFO } from '../game/resources';
import { ARMY_RECRUITING, MUSTER_SECONDS, UNIT_STATS, unitGrowth, type ArmyUnit } from '../game/units';
import { GameButton, SectionLabel } from './GameUI';
import { TechBranchView } from './TechTree';

// The construction office, in pieces for the stronghold's pop-ups: a defence summary, the grid of
// every building, and one building's details (effects, cost, staff, recruiting).

/** Building sites in use, and the hold's defences at a glance. */
export function DefenceSummary({ game, workforce }: { game: GameState; workforce: Workforce }) {
  const stats = buildingStats(game.buildings, workforce.staff, game.techs);
  const power = holdPowerOf(game);
  return (
    <View style={styles.military}>
      <Text style={styles.militaryText}>SITES {String(game.construction.length)}/{String(stats.buildSites)}</Text>
      <Text style={styles.militaryText}>
        HOLD POWER {power.total.toLocaleString()} (ARMY {power.army.toLocaleString()} · DEFENCES {power.defences.toLocaleString()})
      </Text>
      <Text style={styles.militaryText}>WALL {stats.wallHp > 0 ? `${String(stats.wallHp)} HP` : 'NONE'}</Text>
      <Text style={styles.militaryText}>GATE {stats.gateHp > 0 ? `${String(stats.gateHp)} HP` : stats.wallHp > 0 ? 'OPEN GAP' : '—'}</Text>
      <Text style={styles.militaryText}>TOWERS {String(stats.towers)}{stats.towers > 0 ? ` × ${String(stats.towerDamage)}` : ''}</Text>
      <Text style={styles.militaryText}>MOAT {stats.moatDamage > 0 ? `${String(stats.moatDamage)} / ROUND` : 'DRY'}</Text>
      <Text style={styles.militaryText}>ARMS +{String(stats.attackBonus)}/+{String(stats.defenceBonus)}</Text>
      <Text style={styles.militaryText}>TRAPS {String(game.traps.length)}{game.traps.length > 0 && stats.trapPower > 1 ? ` × ${String(stats.trapPower)}` : ''}</Text>
    </View>
  );
}

/** Every building with its level, staff and construction progress; a green dot marks what can be built now. */
export function BuildingGrid({ game, workforce, selected, onSelect }: {
  game: GameState;
  workforce: Workforce;
  selected: BuildingId | null;
  onSelect: (id: BuildingId) => void;
}) {
  const { buildings, construction } = game;
  return (
    <View style={styles.grid}>
      {BUILDING_IDS.filter((id) => isShownBuilding(game, id)).map((id) => {
        const level = buildings[id];
        const job = construction.find((item) => item.building === id);
        const need = staffNeeded(id, level);
        const stopped = game.paused.includes(id);
        return (
          <BuildingChip
            key={id}
            id={id}
            selected={id === selected}
            onSelect={onSelect}
            ready={!upgradeBlocker(game, id, workforce)}
            short={stopped || workforce.needed[id] > workforce.staff[id]}
            level={level}
            status={`${level === 0 ? 'NOT BUILT' : `LV ${String(level)}`}${job ? ` → ${String(job.level)}` : ''}${stopped ? ' · STOPPED' : need > 0 ? ` · ${String(workforce.staff[id])}/${String(need)} STAFF` : ''}`}
            progress={job ? Math.round((job.progress / job.duration) * 100) : -1}
          />
        );
      })}
    </View>
  );
}

// One building in the grid; memoized, so a tick only redraws the chips whose text changed.
const BuildingChip = memo(function BuildingChip({ id, selected, onSelect, ready, short, level, status, progress }: {
  id: BuildingId;
  selected: boolean;
  onSelect: (id: BuildingId) => void;
  ready: boolean;
  short: boolean;
  level: number;
  status: string;
  /** Construction progress in %, or -1 when nothing is being built. */
  progress: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${BUILDING_INFO[id].name}, level ${String(level)}`}
      onPress={() => onSelect(id)}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <View style={styles.chipTop}>
        <Text style={styles.chipName} numberOfLines={1}>{BUILDING_INFO[id].name}</Text>
        {ready && <View style={styles.readyDot} />}
      </View>
      <Text style={[styles.chipLevel, short && styles.chipShort]}>{status}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress >= 0 ? progress : Math.round((level / MAX_BUILDING_LEVEL) * 100)}%` }, progress >= 0 && styles.fillBuilding]} />
      </View>
    </Pressable>
  );
});

/**
 * One building's details; `bare` drops the name, level and frame (for a pop-up that shows them itself).
 * A building that isn't on the map yet offers `onChooseSpot` (placement) instead of building in place.
 */
export function BuildingDetail({ game, workforce, id, bare = false, onChooseSpot, onDestroyed }: {
  game: GameState;
  workforce: Workforce;
  id: BuildingId;
  bare?: boolean;
  onChooseSpot?: () => void;
  /** After the building was pulled down. */
  onDestroyed?: () => void;
}) {
  const { buildings, construction, warehouse, warehouseCapacity, gold, recruits } = game;
  const unit = DWELLING_UNIT[id];
  const level = buildings[id];
  const info = BUILDING_INFO[id];
  const job = construction.find((item) => item.building === id);
  const maxed = level >= MAX_BUILDING_LEVEL;
  const next = level + 1;
  const branch = isForge(id) ? 'forges' : isHouse(id) ? 'houses' : id;
  const now = buildingEffects(id, level, game.techs);
  const after = maxed ? null : buildingEffects(id, next, game.techs);
  const cost = maxed ? null : buildingCost(id, next);
  const blocker = upgradeBlocker(game, id, workforce);
  const need = staffNeeded(id, level);
  const paused = game.paused.includes(id);
  const staffed = workforce.staff[id];
  const worked = workedLevel(id, level, staffed);
  // Builders carry materials from the warehouse: a quick walk (roads, a close plot) builds faster.
  const placed = !!game.placements[id] || !isPlaceable(id);
  const walk = placed ? siteWalk(game, id) : null;
  const speed = buildingStats(buildings, undefined, game.techs).buildSpeed * (placed ? siteFactor(game, id) : 1);
  const seconds = (duration: number) => Math.ceil(duration / speed);

  return (
    <View style={bare ? styles.detailBare : styles.detail}>
      {!bare && (
        <View style={styles.detailHeader}>
          <Text style={styles.detailName}>{info.name}</Text>
          <Text style={styles.detailLevel}>LEVEL {String(level)} / {String(MAX_BUILDING_LEVEL)}</Text>
        </View>
      )}
      <Text style={styles.role}>{info.role}</Text>
      {need > 0 && (
        <View style={styles.staffRow}>
          <Text style={[styles.staffText, (paused || staffed < need) && styles.staffShort]}>
            {paused
              ? `STOPPED · its ${String(need)} worker${need === 1 ? '' : 's'} wait at the campfire`
              : `STAFF ${String(staffed)}/${String(need)}${staffed < need ? ` · short of peasants: works as level ${String(worked)}` : ' · fully staffed'}`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={paused ? `Restart the ${info.name}` : `Stop the ${info.name} and free its staff`}
            onPress={() => game.toggleBuildingPause(id)}
            style={({ pressed }) => [styles.pauseButton, pressed && styles.pressed]}
          >
            <Text style={styles.pauseText}>{paused ? 'RESTART' : 'STOP'}</Text>
          </Pressable>
        </View>
      )}
      {unit && <RecruitCard unit={unit} game={game} waiting={recruits[unit]} free={workforce.free} />}

      <View style={styles.effects}>
        {now.map((effect, index) => (
          <View key={effect.label} style={styles.effectRow}>
            <Text style={styles.effectLabel}>{effect.label}</Text>
            <Text style={styles.effectNow}>{level === 0 ? '—' : effect.value}</Text>
            {after && <Text style={styles.effectNext}>→ {after[index].value}</Text>}
          </View>
        ))}
      </View>

      {job ? (
        <View style={styles.building}>
          <Text style={styles.buildingText}>
            BUILDING LEVEL {String(job.level)} · {String(seconds(job.duration - job.progress))} S LEFT
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, styles.fillBuilding, { width: `${Math.round((job.progress / job.duration) * 100)}%` }]} />
          </View>
          <ConfirmButton
            label={`STOP BUILDING · ALL ${String(buildingCost(id, job.level).gold)} GOLD AND MATERIALS BACK`}
            armedLabel="TAP AGAIN TO STOP BUILDING · THE CREW’S WORK IS LOST"
            accessibilityLabel={`Stop building the ${BUILDING_INFO[id].name}`}
            onConfirm={() => game.cancelConstruction(id)}
          />
        </View>
      ) : cost ? (
        <>
          <View style={styles.costs}>
            <CostChip label="GOLD" amount={cost.gold} have={gold} color="#e5a565" />
            {RESOURCES.filter((resource) => cost.resources[resource]).map((resource) => (
              <CostChip
                key={resource}
                label={RESOURCE_INFO[resource].name.toUpperCase()}
                amount={cost.resources[resource] ?? 0}
                have={warehouse[resource]}
                color={RESOURCE_INFO[resource].color}
                over={(cost.resources[resource] ?? 0) > warehouseCapacity}
              />
            ))}
            <Text style={styles.time}>CREW {String(crewSize(next))} · {String(seconds(buildingTime(next)))} S</Text>
          </View>
          <GameButton
            label={level === 0 ? (onChooseSpot ? 'CHOOSE A SPOT' : 'BUILD') : `UPGRADE TO LV ${String(next)}`}
            detail={blocker ?? `${String(crewSize(next))} peasants · ${String(seconds(buildingTime(next)))} s`}
            onPress={level === 0 && onChooseSpot ? onChooseSpot : () => game.upgradeBuilding(id)}
            disabled={!!blocker}
          />
        </>
      ) : (
        <Text style={styles.buildingText}>FULLY BUILT</Text>
      )}
      {placed && id !== 'warehouse' && (
        <Text style={styles.walkText}>
          {walk
            ? `BUILDERS WALK ${String(walk.time)} S FROM THE WAREHOUSE · BUILDING ×${String(siteFactor(game, id))}`
            : 'NO WAY THROUGH FROM THE WAREHOUSE · BUILDING ×0.7'}
        </Text>
      )}
      {id !== 'keep' && (level > 0 || job) && <DestroyButton game={game} id={id} onDestroyed={onDestroyed} />}

      {techsOf(branch).length > 0 && (
        <View style={styles.techs}>
          <SectionLabel>TECH TREE · UPGRADES FOR GOLD</SectionLabel>
          <TechBranchView game={game} branch={branch} showName={false} />
        </View>
      )}
    </View>
  );
}

// Pulling a building down gives back half of everything spent on it; it takes a second tap to confirm.
function DestroyButton({ game, id, onDestroyed }: { game: GameState; id: BuildingId; onDestroyed?: () => void }) {
  const refund = destroyRefund(game, id);
  const back = [`${String(refund.gold)} gold`, ...RESOURCES.filter((resource) => refund.resources[resource]).map((resource) => `${String(refund.resources[resource])} ${RESOURCE_INFO[resource].name.toLowerCase()}`)].join(' · ');
  return (
    <ConfirmButton
      label={`DESTROY · 50% BACK: ${back}`}
      armedLabel={`TAP AGAIN TO DESTROY IT · ${back} BACK`}
      accessibilityLabel={`Destroy the ${BUILDING_INFO[id].name}`}
      onConfirm={() => {
        game.destroyBuilding(id);
        onDestroyed?.();
      }}
    />
  );
}

// A button that needs a second tap within 4 s (for things that can't be undone).
function ConfirmButton({ label, armedLabel, accessibilityLabel, onConfirm }: { label: string; armedLabel: string; accessibilityLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={armed ? `Confirm: ${accessibilityLabel}` : accessibilityLabel}
      onPress={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
      style={({ pressed }) => [styles.destroy, armed && styles.destroyArmed, pressed && styles.pressed]}
    >
      <Text style={[styles.destroyText, armed && styles.destroyTextArmed]}>{armed ? armedLabel : label}</Text>
    </Pressable>
  );
}

// A dwelling's unit: its battle stats, recruits waiting, the price, and Recruit buttons.
// A dwelling's unit: how it fights, and recruiting it — gold, a free peasant and a piece of its gear each,
// with the gear ordered from the armory right here.
function RecruitCard({ unit, game, waiting, free }: { unit: ArmyUnit; game: GameState; waiting: number; free: number }) {
  const { buildings, techs, army } = game;
  const onRecruit = game.recruit;
  const stats = UNIT_STATS[unit];
  const recruiting = ARMY_RECRUITING[unit];
  const { unitBonus, growthBonus, attackBonus, defenceBonus } = buildingStats(buildings, undefined, techs);
  const bonus = unitBonus[unit];
  // Stats as they'll fight: with the armory's and the techs' bonuses.
  const attack = stats.attack + attackBonus + (bonus?.attack ?? 0);
  const defence = stats.defence + defenceBonus + (bonus?.defence ?? 0);
  const shots = stats.shots ? stats.shots + (bonus?.shots ?? 0) : 0;
  const available = unitAvailable({ buildings }, unit);
  const ready = Math.floor(waiting);
  const affordable = affordableRecruits(game, unit);
  // Every soldier is a peasant first.
  const canHire = Math.min(ready, affordable, free);
  const gear = UNIT_GEAR[unit];
  const gearInfo = ITEM_INFO[gear];
  const inStore = Math.floor(game.items[gear]);
  const here = Math.floor(game.dwellingGear[unit] ?? 0);
  const coming = gearComing(game.wagonJobs, recruiting.dwelling);
  const carts = buildingStats(buildings, workforceOf(game).staff, techs).wagons;
  const price = `${String(recruiting.gold)} gold + 1 ${gearInfo.name.toLowerCase()}`;
  // Which forges make this gear, and a forge that could be set to it.
  const makers = forgesMaking(game, gear);
  const spare = freeForge(game);
  return (
    <View style={styles.unitCard}>
      <View style={styles.detailHeader}>
        <Text style={styles.unitName}>{stats.plural}</Text>
        <Text style={styles.unitOwned}>IN ARMY: {String(army[unit])}</Text>
      </View>
      <Text style={styles.unitStats}>
        ATK {String(attack)} · DEF {String(defence)} · DMG {String(stats.minDamage)}–{String(stats.maxDamage)} · HP {String(stats.hp)} · SPD {String(stats.speed)}
        {shots ? ` · SHOTS ${String(shots)}` : ''}
      </Text>
      <Text style={styles.unitAbility}>{stats.ability}</Text>
      {available ? (
        <>
          <Text style={styles.unitStats}>
            WAITING {String(ready)} · +{String(unitGrowth(unit, buildings[recruiting.dwelling], growthBonus[unit]))} PER {String(MUSTER_SECONDS / 60)} MIN · {price} + 1 PEASANT EACH · {String(free)} FREE
          </Text>
          <View style={styles.gearRow}>
            <Text style={styles.gearIcon}>{gearInfo.icon}</Text>
            <View style={styles.gearCopy}>
              <Text style={[styles.gearText, here < 1 && styles.gearShort]}>
                {gearInfo.plural.toUpperCase()} HERE {String(here)}
                {coming > 0 ? ` · ${String(coming)} ON A CART` : ''} · IN THE STORE {String(inStore)}
              </Text>
              <Text style={styles.gearText}>
                {makers.length > 0 ? `MADE AT ${makers.map((forge) => FORGE_NAMES[forge].toUpperCase()).join(', ')}` : 'NO FORGE MAKES THEM'}
                {inStore > 0 && coming === 0 && here < ready ? (carts > 0 ? ' · A CART WILL BRING THEM' : ' · NO CARTS TO BRING THEM: BUILD A CART DEPOT') : ''}
              </Text>
            </View>
          </View>
          {makers.length === 0 && (
            <GameButton
              label={spare ? `SET ${FORGE_NAMES[spare].toUpperCase()} TO ${gearInfo.plural.toUpperCase()}` : `NO FREE FORGE`}
              detail={spare ? 'its parts need forges of their own' : FORGE_IDS.some((forge) => buildings[forge] > 0) ? 'every forge has a task: change one, or build another' : 'build a forge first (BUILD → Forge I)'}
              onPress={() => spare && game.setForgeTask(spare, gear)}
              disabled={!spare}
              secondary
            />
          )}
          <View style={styles.recruitRow}>
            <View style={styles.recruitButton}>
              <GameButton label="RECRUIT 1" detail={price} onPress={() => onRecruit(unit, 1)} disabled={canHire < 1} secondary />
            </View>
            <View style={styles.recruitButton}>
              <GameButton label={`RECRUIT ${String(canHire)}`} detail="all you can" onPress={() => onRecruit(unit, 'max')} disabled={canHire < 1} />
            </View>
          </View>
        </>
      ) : (
        <Text style={styles.unitLocked}>
          {buildings[recruiting.dwelling] < 1 ? 'Build this to start recruiting.' : `Recruiting needs the Central Keep at level ${String(recruiting.requiresKeep)}.`}
        </Text>
      )}
    </View>
  );
}

function CostChip({ label, amount, have, color, over = false }: { label: string; amount: number; have: number; color: string; over?: boolean }) {
  const short = have < amount;
  return (
    <View style={[styles.costChip, short && styles.costShort]}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={[styles.costText, short && styles.costTextShort]}>
        {amount.toLocaleString()} {label}
        {over ? ' · TOO BIG FOR WAREHOUSE' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10, paddingTop: 20 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  subheading: { color: '#e7e2d2', fontFamily: 'Georgia', fontSize: 16, marginTop: 4 },
  builders: { color: '#bac785', fontFamily: 'monospace', fontSize: 9 },
  military: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 6, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#2f352d' },
  militaryText: { color: '#a9ad99', fontFamily: 'monospace', fontSize: 8 },
  detailBare: { gap: 10 },
  detail: { gap: 8, padding: 12, borderWidth: 1, borderColor: '#4a5240', backgroundColor: '#171c16' },
  detailHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  detailName: { color: '#f0ead8', fontFamily: 'Georgia', fontSize: 18, fontWeight: 'bold' },
  detailLevel: { color: '#d2a45f', fontFamily: 'monospace', fontSize: 9 },
  role: { color: '#a3a893', fontFamily: 'Georgia', fontSize: 12 },
  effects: { gap: 4 },
  walkText: { color: '#89907f', fontFamily: 'monospace', fontSize: 8 },
  destroy: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#4a3a32' },
  destroyArmed: { borderColor: '#e8604a', backgroundColor: '#2a1a16' },
  destroyText: { color: '#b0806a', fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  destroyTextArmed: { color: '#ff8a6c' },
  techs: { gap: 8, paddingTop: 6 },
  effectRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  effectLabel: { flex: 1, color: '#c9c4b2', fontFamily: 'monospace', fontSize: 9 },
  effectNow: { color: '#e6dfcb', fontFamily: 'monospace', fontSize: 10 },
  effectNext: { color: '#c0cd83', fontFamily: 'monospace', fontSize: 10, minWidth: 70, textAlign: 'right' },
  costs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  costChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: '#3a4439' },
  costShort: { borderColor: '#8a4436' },
  swatch: { width: 8, height: 8, borderWidth: 1, borderColor: '#55594c' },
  costText: { color: '#e6dfcb', fontFamily: 'monospace', fontSize: 9 },
  costTextShort: { color: '#e08a72' },
  time: { color: '#87907f', fontFamily: 'monospace', fontSize: 9, marginLeft: 'auto' },
  building: { gap: 6 },
  buildingText: { color: '#e9c475', fontFamily: 'monospace', fontSize: 9 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  unitCard: { gap: 5, padding: 10, borderWidth: 1, borderColor: '#3a4439', backgroundColor: '#1a211b' },
  unitName: { color: '#e9c475', fontFamily: 'Georgia', fontSize: 15, fontWeight: 'bold' },
  unitOwned: { color: '#8fb0e0', fontFamily: 'monospace', fontSize: 9 },
  unitStats: { color: '#c9c4b2', fontFamily: 'monospace', fontSize: 9 },
  unitAbility: { color: '#a3a893', fontFamily: 'Georgia', fontSize: 12 },
  unitLocked: { color: '#e08a72', fontFamily: 'monospace', fontSize: 9 },
  recruitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gearRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gearIcon: { fontSize: 16 },
  gearCopy: { flex: 1, gap: 2 },
  gearText: { color: '#d6c79e', fontFamily: 'monospace', fontSize: 9 },
  gearShort: { color: '#e08a72' },
  recruitButton: { flexGrow: 1, flexBasis: 150 },
  chip: { flexGrow: 1, flexBasis: 140, gap: 4, padding: 8, borderWidth: 1, borderColor: '#2f352d', backgroundColor: '#151a14' },
  chipSelected: { borderColor: '#d2a45f' },
  pressed: { opacity: 0.7 },
  chipTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  chipName: { flexShrink: 1, color: '#e8e3d1', fontFamily: 'Georgia', fontSize: 12 },
  readyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#c1cf7b' },
  chipLevel: { color: '#87907f', fontFamily: 'monospace', fontSize: 8 },
  chipShort: { color: '#e08a72' },
  staffRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  staffText: { flex: 1, color: '#c0cd83', fontFamily: 'monospace', fontSize: 9 },
  staffShort: { color: '#e08a72' },
  pauseButton: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#4a5240' },
  pauseText: { color: '#e6dfcb', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  track: { height: 3, backgroundColor: '#343a31' },
  fill: { height: 3, backgroundColor: '#8d9a6a' },
  fillBuilding: { backgroundColor: '#e9c475' },
});
