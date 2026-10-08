// What things cost, and what stops the player doing them (with the reason shown).
import { RESOURCES, RESOURCE_INFO } from './resources';
import {
  BUILDING_INFO,
  MAX_BUILDING_LEVEL,
  buildingCost,
  buildingStats,
  crewSize,
  requiredKeep,
  type BuildCost,
  type BuildingId,
  type BuildingLevels,
} from './buildings';
import type { Workforce } from './workforce';
import { isMoored, isWaiting, BARGE_SAIL, type Barge } from './ship';
import { FORGE_IDS } from './forges';
import type { Spot } from './cityMap';
import { ROAD_INFO, type RoadKind } from './roads';
import { TRAP_INFO, trapProblem, type TrapKind } from './traps';
import { TECHS, TIER_DEPTH, TIER_LEVEL, techBonuses, techCost, type TechBranch, type TechId } from './techs';
import { digCost, parseKey } from './mineLayout';
import type { Cost, GameState, WorkforceState } from './state';
import { docksOf, workforceOf } from './hold';

// Grows steadily rather than exponentially, so the 450-gallery mine stays reachable. Shaft surveys cut it.
export function getDepthCost(depth: number, techs: readonly TechId[] = []) {
  return Math.round((100 + 60 * (depth - 1) ** 1.35) * (1 - techBonuses(techs).depthCost));
}

export function canAfford(state: Pick<GameState, 'warehouse' | 'gold'>, cost: Cost) {
  return state.warehouse.coal >= cost.coal && state.gold >= cost.gold;
}

/** Can the treasury and warehouse pay a building cost? */
export function canAffordBuild(state: Pick<GameState, 'warehouse' | 'gold'>, cost: BuildCost) {
  return state.gold >= cost.gold && RESOURCES.every((resource) => state.warehouse[resource] >= (cost.resources[resource] ?? 0));
}

/** Why the next level of a building can't be started right now, or null if it can. */
export function upgradeBlocker(
  state: WorkforceState & Pick<GameState, 'warehouse' | 'gold' | 'warehouseCapacity' | 'techs'>,
  id: BuildingId,
  workforce: Workforce = workforceOf(state),
): string | null {
  const level = state.buildings[id];
  const stats = buildingStats(state.buildings, undefined, state.techs);
  if (level >= MAX_BUILDING_LEVEL) return 'Fully built.';
  if (state.construction.some((job) => job.building === id)) return 'Already under construction.';
  if (id !== 'keep' && level >= stats.maxLevel) return `Raise the Central Keep to level ${String(level + 1)} first.`;
  if (level === 0 && state.buildings.keep < requiredKeep(id)) return `Needs the Central Keep at level ${String(requiredKeep(id))}.`;
  if (state.construction.length >= stats.buildSites) {
    return `The keep can run only ${String(stats.buildSites)} building site${stats.buildSites === 1 ? '' : 's'} at once.`;
  }
  const crew = crewSize(level + 1);
  const free = workforce.free;
  if (free < crew) return `Needs a crew of ${String(crew)} peasants (${String(free)} free). Wait for more, or pause a building.`;
  const cost = buildingCost(id, level + 1);
  const tooBig = RESOURCES.find((resource) => (cost.resources[resource] ?? 0) > state.warehouseCapacity);
  if (tooBig) {
    return `Needs ${(cost.resources[tooBig] ?? 0).toLocaleString()} ${RESOURCE_INFO[tooBig].name.toLowerCase()}, but the warehouses hold only ${state.warehouseCapacity.toLocaleString()} each.`;
  }
  if (!canAffordBuild(state, cost)) return 'Not enough resources yet.';
  return null;
}

/** Why a trap can't be laid at `spot` right now (or anywhere, without a spot), or null if it can. */
export function trapBlocker(state: Pick<GameState, 'warehouse' | 'gold' | 'traps'>, kind: TrapKind, spot?: Spot): string | null {
  const problem = spot ? trapProblem(spot, state.traps) : null;
  if (problem) return problem;
  return canAffordBuild(state, TRAP_INFO[kind]) ? null : 'Not enough resources.';
}

/** The trap cost as text, e.g. "30 gold · 10 coal". */
export function trapCostText(kind: TrapKind) {
  const { gold, resources } = TRAP_INFO[kind];
  return [`${String(gold)} gold`, ...RESOURCES.filter((resource) => resources[resource]).map((resource) => `${String(resources[resource])} ${RESOURCE_INFO[resource].name.toLowerCase()}`)].join(' · ');
}

const minutes = (seconds: number) => `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;

/** Why this barge can't be sold to right now, or null if it can. */
export function bargeBlocker(state: WorkforceState & Pick<GameState, 'techs' | 'elapsedSeconds' | 'warehouse'>, barge: Barge): string | null {
  if (!isWaiting(barge)) return 'It has sailed.';
  if (!isMoored(barge, state.elapsedSeconds)) return `Still sailing in: at the docks in ${minutes(barge.arrivedAt + BARGE_SAIL - state.elapsedSeconds)}.`;
  if (docksOf(state).interval <= 0) return 'No dockhands to load it: free a peasant or restart the docks.';
  if (Math.floor(state.warehouse[barge.resource]) < 1) return `No ${RESOURCE_INFO[barge.resource].name.toLowerCase()} in the warehouse.`;
  return null;
}

/** The road cost per tile as text, e.g. "4 gold · 2 granite". */
export function roadCostText(kind: RoadKind) {
  const { gold, resources } = ROAD_INFO[kind];
  return [`${String(gold)} gold`, ...RESOURCES.filter((resource) => resources[resource]).map((resource) => `${String(resources[resource])} ${RESOURCE_INFO[resource].name.toLowerCase()}`)].join(' · ');
}

/** Everything spent on a building so far (every level built, and the one being built). */
export function buildingSpent(state: Pick<GameState, 'buildings' | 'construction'>, id: BuildingId) {
  const job = state.construction.find((item) => item.building === id);
  const top = job ? job.level : state.buildings[id];
  const spent: BuildCost = { gold: 0, resources: {} };
  for (let level = 1; level <= top; level++) {
    const cost = buildingCost(id, level);
    spent.gold += cost.gold;
    for (const resource of RESOURCES) {
      const amount = cost.resources[resource];
      if (amount) spent.resources[resource] = (spent.resources[resource] ?? 0) + amount;
    }
  }
  return spent;
}

/** Share of what a building cost that comes back when it's destroyed. */
export const DESTROY_REFUND = 0.5;

/** What destroying a building gives back. */
export function destroyRefund(state: Pick<GameState, 'buildings' | 'construction'>, id: BuildingId): BuildCost {
  const spent = buildingSpent(state, id);
  const refund: BuildCost = { gold: Math.floor(spent.gold * DESTROY_REFUND), resources: {} };
  for (const resource of RESOURCES) {
    const amount = Math.floor((spent.resources[resource] ?? 0) * DESTROY_REFUND);
    if (amount > 0) refund.resources[resource] = amount;
  }
  return refund;
}

/** The level that counts for a building branch of the tech tree (the forges': the best forge). */
function branchLevel(buildings: BuildingLevels, branch: Exclude<TechBranch, 'mine'>) {
  return branch === 'forges' ? Math.max(...FORGE_IDS.map((forge) => buildings[forge])) : buildings[branch];
}
const branchBuilding = (branch: Exclude<TechBranch, 'mine'>) => (branch === 'forges' ? 'a forge' : `the ${BUILDING_INFO[branch].name}`);

/** Why a tech can't be bought right now, or null if it can. */
export function techBlocker(state: Pick<GameState, 'techs' | 'buildings' | 'depth' | 'gold'>, id: TechId): string | null {
  const tech = TECHS[id];
  if (state.techs.includes(id)) return 'Researched.';
  const missing = tech.requires.find((other) => !state.techs.includes(other));
  if (missing) return `Needs ${TECHS[missing].name} first.`;
  if (tech.branch === 'mine') {
    if (state.depth < TIER_DEPTH[tech.tier]) return `Needs the mine ${String(TIER_DEPTH[tech.tier])} galleries deep.`;
  } else if (branchLevel(state.buildings, tech.branch) < TIER_LEVEL[tech.tier]) {
    const name = branchBuilding(tech.branch);
    return tech.tier === 1 ? `Build ${name} first.` : `Needs ${name} at level ${String(TIER_LEVEL[tech.tier])}.`;
  }
  if (state.gold < techCost(state.techs, id)) return 'Not enough gold.';
  return null;
}

/** What a tech needs, each with whether it's met (for the tech tree's details). */
export function techNeeds(state: Pick<GameState, 'techs' | 'buildings' | 'depth'>, id: TechId): { label: string; met: boolean }[] {
  const tech = TECHS[id];
  const needs = tech.requires.map((other) => ({ label: TECHS[other].name, met: state.techs.includes(other) }));
  if (tech.branch === 'mine') {
    const depth = TIER_DEPTH[tech.tier];
    if (depth > 1) needs.push({ label: `The mine ${String(depth)} galleries deep`, met: state.depth >= depth });
  } else {
    const level = TIER_LEVEL[tech.tier];
    const name = branchBuilding(tech.branch);
    const label = level === 1 ? `${name} built` : `${name} at level ${String(level)}`;
    needs.push({ label: label[0].toUpperCase() + label.slice(1), met: branchLevel(state.buildings, tech.branch) >= level });
  }
  return needs;
}

/** Gold to dig a tile on `row`, after the research facility's and the techs' discounts. */
export function tileDigCost(state: Pick<GameState, 'buildings' | 'techs'>, row: number) {
  return Math.max(1, Math.round(digCost(row) * buildingStats(state.buildings, undefined, state.techs).digCostFactor));
}

/** Gold to dig a whole route, after the discounts. */
export function tunnelCost(state: Pick<GameState, 'buildings' | 'techs'>, route: string[]) {
  return route.reduce((sum, key) => sum + tileDigCost(state, parseKey(key).row), 0);
}

/** Price of the next cart for a level that already has `current` carts (shaft surveys cut it). */
export function cartCost(current: number, techs: readonly TechId[] = []): Cost {
  const scale = 1.6 ** Math.max(0, current - 1) * (1 - techBonuses(techs).cartCost);
  return { coal: Math.round(25 * scale), gold: Math.round(40 * scale) };
}
