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
  type BuildingId,
  type BuildingLevels,
} from '../game/buildings';
import { affordableRecruits, unitAvailable, upgradeBlocker, type Construction } from '../game/gameStore';
import { RESOURCES, RESOURCE_INFO, type Stock } from '../game/resources';
import { ARMY_RECRUITING, MUSTER_SECONDS, UNIT_STATS, armyValue, unitGrowth, type Army, type ArmyUnit } from '../game/units';
import { GameButton, SectionLabel } from './GameUI';

type Props = {
  buildings: BuildingLevels;
  construction: Construction[];
  warehouse: Stock;
  warehouseCapacity: number;
  gold: number;
  selected: BuildingId;
  onSelect: (id: BuildingId) => void;
  onUpgrade: (id: BuildingId) => void;
  army: Army;
  recruits: Record<ArmyUnit, number>;
  onRecruit: (unit: ArmyUnit, amount: number | 'max') => void;
};

// The stronghold's construction office: every building, its level and what the next level brings.
export default function BuildingsPanel(props: Props) {
  const { buildings, construction, selected, onSelect } = props;
  const stats = buildingStats(buildings);

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View>
          <SectionLabel>CONSTRUCTION</SectionLabel>
          <Text style={styles.subheading}>Raise the hold, level by level</Text>
        </View>
        <Text style={styles.builders}>
          BUILDERS {String(construction.length)}/{String(stats.builders)}
        </Text>
      </View>
      <View style={styles.military}>
        <Text style={styles.militaryText}>ARMY POWER {armyValue(props.army).toLocaleString()}</Text>
        <Text style={styles.militaryText}>WALL {stats.wallHp > 0 ? `${String(stats.wallHp)} HP` : 'NONE'}</Text>
        <Text style={styles.militaryText}>GATE {stats.gateHp > 0 ? `${String(stats.gateHp)} HP` : stats.wallHp > 0 ? 'OPEN GAP' : '—'}</Text>
        <Text style={styles.militaryText}>TOWERS {String(stats.towers)}{stats.towers > 0 ? ` × ${String(stats.towerDamage)}` : ''}</Text>
        <Text style={styles.militaryText}>ARMS +{String(stats.attackBonus)}/+{String(stats.defenceBonus)}</Text>
      </View>

      <BuildingDetail {...props} id={selected} />

      <View style={styles.grid}>
        {BUILDING_IDS.map((id) => {
          const level = buildings[id];
          const job = construction.find((item) => item.building === id);
          const ready = !upgradeBlocker(props, id);
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`${BUILDING_INFO[id].name}, level ${String(level)}`}
              onPress={() => onSelect(id)}
              style={({ pressed }) => [styles.chip, id === selected && styles.chipSelected, pressed && styles.pressed]}
            >
              <View style={styles.chipTop}>
                <Text style={styles.chipName} numberOfLines={1}>{BUILDING_INFO[id].name}</Text>
                {ready && <View style={styles.readyDot} />}
              </View>
              <Text style={styles.chipLevel}>{level === 0 ? 'NOT BUILT' : `LV ${String(level)}`}{job ? ` → ${String(job.level)}` : ''}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${job ? Math.round((job.progress / job.duration) * 100) : Math.round((level / MAX_BUILDING_LEVEL) * 100)}%` }, job && styles.fillBuilding]} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function BuildingDetail({ id, buildings, construction, warehouse, warehouseCapacity, gold, onUpgrade, army, recruits, onRecruit }: Props & { id: BuildingId }) {
  const unit = DWELLING_UNIT[id];
  const level = buildings[id];
  const info = BUILDING_INFO[id];
  const job = construction.find((item) => item.building === id);
  const maxed = level >= MAX_BUILDING_LEVEL;
  const next = level + 1;
  const now = buildingEffects(id, level);
  const after = maxed ? null : buildingEffects(id, next);
  const cost = maxed ? null : buildingCost(id, next);
  const blocker = upgradeBlocker({ buildings, construction, warehouse, warehouseCapacity, gold }, id);

  return (
    <View style={styles.detail}>
      <View style={styles.detailHeader}>
        <Text style={styles.detailName}>{info.name}</Text>
        <Text style={styles.detailLevel}>LEVEL {String(level)} / {String(MAX_BUILDING_LEVEL)}</Text>
      </View>
      <Text style={styles.role}>{info.role}</Text>
      {unit && <RecruitCard unit={unit} buildings={buildings} gold={gold} warehouse={warehouse} army={army} waiting={recruits[unit]} onRecruit={onRecruit} />}

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
            BUILDING LEVEL {String(job.level)} · {String(job.duration - job.progress)} S LEFT
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, styles.fillBuilding, { width: `${Math.round((job.progress / job.duration) * 100)}%` }]} />
          </View>
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
            <Text style={styles.time}>{String(buildingTime(next))} S</Text>
          </View>
          <GameButton
            label={level === 0 ? 'BUILD' : `UPGRADE TO LV ${String(next)}`}
            detail={blocker ?? `${String(buildingTime(next))} s of work`}
            onPress={() => onUpgrade(id)}
            disabled={!!blocker}
          />
        </>
      ) : (
        <Text style={styles.buildingText}>FULLY BUILT</Text>
      )}
    </View>
  );
}

// A dwelling's unit: its battle stats, recruits waiting, the price, and Recruit buttons.
function RecruitCard({ unit, buildings, gold, warehouse, army, waiting, onRecruit }: {
  unit: ArmyUnit;
  buildings: BuildingLevels;
  gold: number;
  warehouse: Stock;
  army: Army;
  waiting: number;
  onRecruit: (unit: ArmyUnit, amount: number | 'max') => void;
}) {
  const stats = UNIT_STATS[unit];
  const recruiting = ARMY_RECRUITING[unit];
  const available = unitAvailable({ buildings }, unit);
  const ready = Math.floor(waiting);
  const affordable = affordableRecruits({ gold, warehouse }, unit);
  const canHire = Math.min(ready, affordable);
  const price = [`${String(recruiting.gold)} gold`, ...RESOURCES.filter((resource) => recruiting.resources[resource]).map((resource) => `${String(recruiting.resources[resource])} ${RESOURCE_INFO[resource].name.toLowerCase()}`)].join(' + ');
  return (
    <View style={styles.unitCard}>
      <View style={styles.detailHeader}>
        <Text style={styles.unitName}>{stats.plural}</Text>
        <Text style={styles.unitOwned}>IN ARMY: {String(army[unit])}</Text>
      </View>
      <Text style={styles.unitStats}>
        ATK {String(stats.attack)} · DEF {String(stats.defence)} · DMG {String(stats.minDamage)}–{String(stats.maxDamage)} · HP {String(stats.hp)} · SPD {String(stats.speed)}
        {stats.shots ? ` · SHOTS ${String(stats.shots)}` : ''}
      </Text>
      <Text style={styles.unitAbility}>{stats.ability}</Text>
      {available ? (
        <>
          <Text style={styles.unitStats}>
            WAITING {String(ready)} · +{String(unitGrowth(unit, buildings[recruiting.dwelling]))} PER {String(MUSTER_SECONDS / 60)} MIN · {price} EACH
          </Text>
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
  detail: { gap: 8, padding: 12, borderWidth: 1, borderColor: '#4a5240', backgroundColor: '#171c16' },
  detailHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  detailName: { color: '#f0ead8', fontFamily: 'Georgia', fontSize: 18, fontWeight: 'bold' },
  detailLevel: { color: '#d2a45f', fontFamily: 'monospace', fontSize: 9 },
  role: { color: '#a3a893', fontFamily: 'Georgia', fontSize: 12 },
  effects: { gap: 4 },
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
  recruitButton: { flexGrow: 1, flexBasis: 150 },
  chip: { flexGrow: 1, flexBasis: 140, gap: 4, padding: 8, borderWidth: 1, borderColor: '#2f352d', backgroundColor: '#151a14' },
  chipSelected: { borderColor: '#d2a45f' },
  pressed: { opacity: 0.7 },
  chipTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  chipName: { flexShrink: 1, color: '#e8e3d1', fontFamily: 'Georgia', fontSize: 12 },
  readyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#c1cf7b' },
  chipLevel: { color: '#87907f', fontFamily: 'monospace', fontSize: 8 },
  track: { height: 3, backgroundColor: '#343a31' },
  fill: { height: 3, backgroundColor: '#8d9a6a' },
  fillBuilding: { backgroundColor: '#e9c475' },
});
