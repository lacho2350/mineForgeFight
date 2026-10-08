import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BUILDING_INFO } from '../game/buildings';
import { techBlocker, techNeeds, type GameState } from '../game/gameStore';
import { TECHS, TECH_BRANCHES, TECH_IDS, techCost, techsOf, tierName, type TechBranch, type TechId, type Tier } from '../game/techs';
import { BUILDING_ICONS } from './buildingIcons';
import { GameButton } from './GameUI';

// The tech tree: a branch per building and one for the mine, each climbing in tiers I → II → III.
// Tap a tech to see what it does and what it needs, then research it with gold.

type TechState = 'owned' | 'ready' | 'gold' | 'locked';
type TreeGame = Pick<GameState, 'techs' | 'buildings' | 'depth' | 'gold' | 'buyTech'>;

function techState(game: TreeGame, id: TechId): TechState {
  const blocker = techBlocker(game, id);
  if (game.techs.includes(id)) return 'owned';
  if (!blocker) return 'ready';
  return blocker === 'Not enough gold.' ? 'gold' : 'locked';
}

/** How many techs could be bought right now. */
export const techsReady = (game: TreeGame) => TECH_IDS.filter((id) => !techBlocker(game, id)).length;

const branchName = (branch: TechBranch) => (branch === 'mine' ? 'The Mine' : branch === 'forges' ? 'The Forges' : BUILDING_INFO[branch].name);
const branchIcon = (branch: TechBranch) => (branch === 'mine' ? '⛏' : branch === 'forges' ? '⚒️' : BUILDING_ICONS[branch]);

/** Every branch, with one tech open at a time. */
export function TechTree({ game }: { game: TreeGame }) {
  const [selected, setSelected] = useState<TechId | null>(null);
  const ready = techsReady(game);
  return (
    <View style={styles.tree}>
      <Text style={styles.summary}>
        RESEARCHED {String(game.techs.length)}/{String(TECH_IDS.length)} · {ready > 0 ? `${String(ready)} READY TO RESEARCH` : 'NOTHING READY YET'}
      </Text>
      {TECH_BRANCHES.map((branch) => (
        <TechBranchView key={branch} game={game} branch={branch} selected={selected} onSelect={setSelected} />
      ))}
    </View>
  );
}

/**
 * One branch: its tiers left to right, and the open tech's details below. Without `selected` /
 * `onSelect` it keeps its own selection (for a building's pop-up or the mine screen).
 */
export function TechBranchView({ game, branch, selected, onSelect, showName = true }: {
  game: TreeGame;
  branch: TechBranch;
  selected?: TechId | null;
  onSelect?: (id: TechId | null) => void;
  showName?: boolean;
}) {
  const [own, setOwn] = useState<TechId | null>(null);
  const open = onSelect ? (selected ?? null) : own;
  const select = onSelect ?? setOwn;
  const ids = techsOf(branch);
  const tiers = ([1, 2, 3] as Tier[]).map((tier) => ids.filter((id) => TECHS[id].tier === tier));
  const owned = ids.filter((id) => game.techs.includes(id)).length;
  return (
    <View style={styles.branch}>
      {showName && (
        <View style={styles.branchHeader}>
          <Text style={styles.branchIcon}>{branchIcon(branch)}</Text>
          <Text style={styles.branchName}>{branchName(branch)}</Text>
          <Text style={styles.branchCount}>
            {String(owned)}/{String(ids.length)}
          </Text>
        </View>
      )}
      <View style={styles.tiers}>
        {tiers.map((column, index) => (
          <View key={index} style={styles.tierWrap}>
            {index > 0 && <View style={styles.link} />}
            <View style={styles.tier}>
              {column.map((id) => (
                <TechNode
                  key={id}
                  id={id}
                  state={techState(game, id)}
                  cost={techCost(game.techs, id)}
                  open={open === id}
                  onPress={() => select(open === id ? null : id)}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
      {open && TECHS[open].branch === branch && <TechDetail game={game} id={open} />}
    </View>
  );
}

function TechNode({ id, state, cost, open, onPress }: { id: TechId; state: TechState; cost: number; open: boolean; onPress: () => void }) {
  const tech = TECHS[id];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tech.name}, tier ${tierName(tech.tier)}, ${state === 'owned' ? 'researched' : `${String(cost)} gold`}`}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={({ pressed }) => [styles.node, nodeStyles[state], open && styles.nodeOpen, pressed && styles.pressed]}
    >
      <View style={styles.nodeTop}>
        <Text style={styles.nodeTier}>{tierName(tech.tier)}</Text>
        <Text style={[styles.nodeCost, state === 'owned' && styles.nodeCostOwned, state === 'gold' && styles.nodeCostShort]}>
          {state === 'owned' ? '✓' : state === 'locked' ? `🔒 ${String(cost)}` : `${String(cost)} G`}
        </Text>
      </View>
      <Text style={[styles.nodeName, state === 'locked' && styles.nodeNameLocked]} numberOfLines={2}>
        {tech.name}
      </Text>
    </Pressable>
  );
}

function TechDetail({ game, id }: { game: TreeGame; id: TechId }) {
  const tech = TECHS[id];
  const owned = game.techs.includes(id);
  const blocker = techBlocker(game, id);
  const cost = techCost(game.techs, id);
  const needs = techNeeds(game, id);
  return (
    <View style={styles.detail}>
      <Text style={styles.detailName}>
        {tech.name} <Text style={styles.detailTier}>· TIER {tierName(tech.tier)}</Text>
      </Text>
      <Text style={styles.detailEffect}>{tech.effect}</Text>
      {needs.length > 0 && (
        <Text style={styles.detailNeeds}>
          NEEDS{' '}
          {needs.map((need, index) => (
            <Text key={need.label} style={need.met ? styles.needMet : styles.needMissing}>
              {index > 0 ? ' · ' : ''}
              {need.met ? '✓' : '✗'} {need.label}
            </Text>
          ))}
        </Text>
      )}
      {owned ? (
        <Text style={styles.detailOwned}>RESEARCHED · IN EFFECT</Text>
      ) : (
        <GameButton label={`RESEARCH · ${String(cost)} GOLD`} detail={blocker ?? 'takes effect at once'} onPress={() => game.buyTech(id)} disabled={!!blocker} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  tree: { gap: 14 },
  summary: { color: '#c0cd83', fontFamily: 'monospace', fontSize: 9 },
  branch: { gap: 8 },
  branchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  branchIcon: { fontSize: 16, lineHeight: 20 },
  branchName: { flex: 1, color: '#e8e3d1', fontFamily: 'Georgia', fontSize: 14 },
  branchCount: { color: '#89907f', fontFamily: 'monospace', fontSize: 9 },
  tiers: { flexDirection: 'row' },
  tierWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  link: { width: 8, height: 2, backgroundColor: '#4a5240' },
  tier: { flex: 1, minWidth: 0, gap: 6 },
  node: { minHeight: 54, gap: 3, paddingVertical: 6, paddingHorizontal: 7, borderWidth: 1 },
  nodeOpen: { borderColor: '#f3d27a', borderWidth: 2 },
  nodeTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  nodeTier: { color: '#89907f', fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  nodeCost: { color: '#e5a565', fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  nodeCostOwned: { color: '#d2a45f' },
  nodeCostShort: { color: '#b0806a' },
  nodeName: { color: '#e8e3d1', fontFamily: 'Georgia', fontSize: 12 },
  nodeNameLocked: { color: '#8a8f7f' },
  detail: { gap: 6, padding: 10, borderLeftWidth: 2, borderLeftColor: '#d2a45f', backgroundColor: '#1d221b' },
  detailName: { color: '#f0ead8', fontFamily: 'Georgia', fontSize: 15, fontWeight: 'bold' },
  detailTier: { color: '#89907f', fontFamily: 'monospace', fontSize: 9, fontWeight: 'normal' },
  detailEffect: { color: '#d8d2c0', fontFamily: 'monospace', fontSize: 10, lineHeight: 15 },
  detailNeeds: { color: '#89907f', fontFamily: 'monospace', fontSize: 9, lineHeight: 14 },
  needMet: { color: '#9fbf6a' },
  needMissing: { color: '#e08a72' },
  detailOwned: { color: '#d2a45f', fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
});

const nodeStyles = StyleSheet.create({
  owned: { borderColor: '#8a6e3a', backgroundColor: '#2a2618' },
  ready: { borderColor: '#7f9a52', backgroundColor: '#1d2619' },
  gold: { borderColor: '#3a4439', backgroundColor: '#1a211b' },
  locked: { borderColor: '#2c322a', backgroundColor: '#151a14', opacity: 0.75 },
});
