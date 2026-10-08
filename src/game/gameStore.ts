import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MINE_GALLERY_COUNT, MINE_STATIONS } from '../components/MineMapLayout';
import { cartEventsBetween, cartsOnLevel, getCartRoutes, type LevelCarts } from './haulage';
import { RESOURCES, RESOURCE_INFO, emptyStock, type Resource, type Stock } from './resources';
import {
  BUILDING_IDS,
  BUILDING_INFO,
  DWELLING_UNIT,
  MAX_BUILDING_LEVEL,
  STARTING_BUILDINGS,
  buildingCost,
  buildingStats,
  buildingTime,
  crewSize,
  requiredKeep,
  staffNeeded,
  workedLevel,
  type BuildCost,
  type BuildingId,
  type BuildingLevels,
} from './buildings';
import {
  ARMY_RECRUITING,
  ARMY_UNITS,
  MAX_MUSTERS_WAITING,
  MUSTER_SECONDS,
  UNIT_STATS,
  armyValue,
  emptyArmy,
  unitGrowth,
  type Army,
  type ArmyUnit,
} from './units';
import { act, battleOutcome, createBattle, raiderStrength, resolveBattle, stepAI, type Battle, type BattleAction } from './combat';
import {
  FIRST_RAID_AT,
  PLUNDER_SHARE,
  RAID_AUTO_AFTER,
  RAID_INTERVAL,
  RAID_WARNING,
  holdPower,
  partyValue,
  raidBounty,
  raidParty,
  raidSide,
  raidStrength,
  type HoldPower,
  type RaidParty,
} from './raids';
import { SAVE_KEY, SAVE_VERSION, createSaveStorage } from './save';
import { allocateWorkforce, type Workforce } from './workforce';
import { BERTHS, MAX_BARGES, bargeOrder, isMoored, isWaiting, BARGE_SAIL, type Barge } from './ship';
import { CLEAR_CREW, ROCK_INFO, rockAt, rockyTest, startingRock, type ClearOrder } from './rocks';
import { ITEM_INFO, UNIT_GEAR, emptyItems, isItemId, type ItemId, type ItemStock } from './items';
import {
  DEFAULT_FORGE_TARGET,
  FORGE_IDS,
  FORGE_NAMES,
  FORGE_OUTPUT_CAP,
  FORGE_TARGETS,
  addLoad,
  emptyLoad,
  isForge,
  loadUnits,
  missingInputs,
  shelfMissing,
  type ForgeId,
  type ForgeTask,
  type ForgeTasks,
  type Load,
} from './forges';
import { gearComing, gearWanted, incomingTo, itemsInTransit, supplyLoad, wagonBackAt, wagonDropAt, wagonStops, type WagonJob } from './wagons';
import {
  CASTLE,
  FOOTPRINTS,
  GATE_ROAD,
  GROWN_MAP_SHIFT,
  MINE_SPOT,
  OLD_MAP_SHIFT,
  RAID_SIDES,
  SIDE_NAMES,
  zoneAt,
  coveredTiles,
  fillPlacements,
  grownCoordinate,
  isPlaceable,
  placementProblem,
  spotOf,
  tileKey as mapTileKey,
  validPlacements,
  type Footprint,
  type Placements,
  type Spot,
} from './cityMap';
import {
  ROAD_INFO,
  buildFactor,
  haulFactor,
  isRoadKind,
  roadProblem,
  roadsUnder,
  startingRoads,
  walkBetween,
  withoutRoads,
  type RoadKind,
  type Roads,
  type Walk,
} from './roads';
import { TRAP_DAMAGE, TRAP_INFO, TRAP_KINDS, TRAP_REFUND, trapAt, trapCounts, trapProblem, trapsFacing, type Trap, type TrapKind } from './traps';
import { TECHS, TIER_DEPTH, TIER_LEVEL, isTechId, techBonuses, techCost, type TechBranch, type TechId } from './techs';
import {
  buildMineLayout,
  checkDigStep,
  depositAt,
  depositRemaining,
  depositStep,
  depositTotal,
  digCost,
  digTime,
  findDigParent,
  findDigRoute,
  standingTargets,
  getDepositInfo,
  tileKey,
  parseKey,
  siteLevel,
  stationKey,
  stationSite,
  type MineLayout,
  type Site,
} from './mineLayout';

export const FIXED_TICK_MS = 1000;
export const MAX_DEPTH = MINE_GALLERY_COUNT;
export const VEIN_CAPACITY_PER_DEPTH = 25;
export const MINE_STATIONS_PER_GALLERY = MINE_STATIONS.length;

type Cost = { coal: number; gold: number };

type TickFlow = {
  mined: number;
  toMineExit: number;
  toMineStockpile: number;
  toWarehouse: number;
};

/** A building being raised to `level`; done once `progress` reaches `duration` seconds. */
export type Construction = { building: BuildingId; level: number; progress: number; duration: number; crew: number };

/** Raiders on their way: sighted at first, then at the gate. */
export type Raid = { number: number; arrivesAt: number; party: RaidParty };

/** What came of a raid. */
export type RaidReport = {
  number: number;
  outcome: 'won' | 'lost' | 'withdrawn';
  bounty: number;
  losses: Partial<Record<ArmyUnit, number>>;
  slain: number;
  /** Raiders the traps killed (counted in `slain` too). */
  trapKills?: number;
  plundered: { gold: number; resources: Partial<Stock> } | null;
};

/** What a level's cart is carrying. */
export type CartLoad = { resource: Resource; amount: number };

export type GameState = {
  elapsedSeconds: number;
  depth: number;
  gold: number;
  /** Peasants living in the hold: every miner, pusher, builder, hauler and building hand (soldiers aren't counted). */
  population: number;
  /** Buildings the player has stopped, sending their staff back to the campfire. */
  paused: BuildingId[];
  /** Where the player has put each building on the stronghold's map (the keep and defences are fixed). */
  placements: Placements;
  /** Traps laid in the trap belt. */
  traps: Trap[];
  /** Roads laid in the town (tile key → kind). */
  roads: Roads;
  /** Rock tiles cleared so far (the rocks themselves lie where rocks.ts puts them). */
  clearedRocks: string[];
  /** Rocks ordered cleared, worked through in order by the clearing crew. */
  clearOrders: ClearOrder[];
  /** The army's gear and its parts, in store. */
  items: ItemStock;
  /** What each forge is set to make (forges without a task stand idle), with its shelf and rack. */
  forgeTasks: ForgeTasks;
  /** The depot's carts out on trips (the rest wait at the depot). */
  wagonJobs: WagonJob[];
  /** Gear kept at each unit's dwelling (brought by carts): what recruiting there takes. */
  dwellingGear: Partial<Record<ArmyUnit, number>>;
  /** Cart trips sent so far (each one's id). */
  wagonSerial: number;
  /** Techs bought from the tech tree. */
  techs: TechId[];
  minerRate: number;
  /** Level of every stronghold building (0 = not built yet). */
  buildings: BuildingLevels;
  /** Buildings being raised, each by its own crew of peasants. */
  construction: Construction[];
  /** Each resource has its own stockpiles: beside the miners, at the mine exit, at the mine, in the warehouse. */
  vein: Stock;
  mineExit: Stock;
  mineStock: Stock;
  warehouse: Stock;
  /** Capacities apply to each resource's stockpile separately. */
  veinCapacity: number;
  mineExitCapacity: number;
  mineCapacity: number;
  warehouseCapacity: number;
  mineCartCapacity: number;
  /** Units the haulers move per tick on each leg (mine exit → mine → warehouse). */
  surfaceHaul: number;
  lastFlow: TickFlow;
  /** Seconds of cart movement; only advances while the mine exit has room for another load. */
  haulTime: number;
  /** Haul time up to which cart loads and tips have already been applied. */
  haulAppliedTime: number;
  /** What each cart carries, keyed by `cartKey(level, index)`. */
  cartLoads: Record<string, CartLoad>;
  /** Carts working each level (levels not listed have one). */
  carts: LevelCarts;
  /** Where each working miner works. */
  sites: Site[];
  /** Miners on their way to a deposit whose tunnel is still being dug; they start when it's done. */
  pendingSites: Site[];
  /** Units taken from each deposit so far, keyed by tile; a deposit is mined out at its total. */
  depositMined: Record<string, number>;
  /** Gallery stations that have been cut ("level:station"); their chamber and shaft stay dug. */
  openedStations: string[];
  /** Tiles the player has had dug, in the order they were finished. */
  playerDug: string[];
  /** Tiles ordered and paid for but not dug yet; the diggers work through them in order. */
  digPlan: string[];
  /** Seconds the diggers have spent on the first tile of the plan. */
  digProgress: number;
  /** Bumped whenever the dug tiles or sites change, so derived layouts and cart routes refresh. */
  layoutVersion: number;
  /** The hold's army: creatures of each unit. */
  army: Army;
  /** Recruits waiting at each dwelling (they arrive gradually, so this is fractional). */
  recruits: Record<ArmyUnit, number>;
  /** Raids fought so far. */
  raidsFought: number;
  /** Raids lost in a row (the next ones come smaller until one is won). */
  raidsLostInARow: number;
  /** Game second the next raiders arrive. */
  nextRaidAt: number;
  /** Raiders sighted or at the gate. */
  raid: Raid | null;
  /** The battle at the gate, while it's fought and until the player leaves the battlefield. */
  battle: Battle | null;
  /** The army when the battle began (recruits joining mid-battle are kept out of it). */
  battleArmy: Army;
  /** The player took command; otherwise the battle fights itself at `battleDeadline`. */
  battleCommanded: boolean;
  battleDeadline: number;
  raidReport: RaidReport | null;
  /** Barges at the docks with their orders (and ones just sailing off, for the animation). */
  barges: Barge[];
  /** Game second the next barge may set off up the river (when a berth is free). */
  nextBargeAt: number;
  /** Barges sent so far (each one's order is drawn from it). */
  bargeSerial: number;
  notice: string;
  tick: () => void;
  /** Start building the next level of a building (paid now, finished by a crew of peasants over time). */
  upgradeBuilding: (id: BuildingId) => void;
  /** Put a new building on the map at `spot` and start building it. */
  placeBuilding: (id: BuildingId, spot: Spot) => void;
  /** Stop or restart a building: a stopped building sends its staff back to the campfire. */
  toggleBuildingPause: (id: BuildingId) => void;
  /** Lay traps on these belt tiles, in order, while they can be paid for. */
  layTraps: (kind: TrapKind, tiles: Spot[]) => void;
  /** Lay (or take up) road on these town tiles, in order, while they can be paid for. */
  layRoads: (kind: RoadKind | 'erase', tiles: Spot[]) => void;
  /** Pull a building down (any but the keep): half of everything spent on it comes back, and its plot is free again. */
  destroyBuilding: (id: BuildingId) => void;
  /** Stop building a building's next level: what it cost comes back (a building never finished leaves its plot). */
  cancelConstruction: (id: BuildingId) => void;
  /** Call a cart back: what it carries goes back where it came from. */
  recallWagon: (id: number) => void;
  /** Order the rocks on these tiles cleared (one order for the crew). */
  clearRocks: (tiles: Spot[]) => void;
  /** Take up the trap at `spot`, for part of its gold back. */
  removeTrap: (spot: Spot) => void;
  /** Buy a tech from the tech tree (gold, at once). */
  buyTech: (id: TechId) => void;
  digDeeper: () => void;
  /** Order a connected run of tiles dug; charged now, dug over time. */
  planDig: (keys: string[]) => void;
  /** Send a free peasant to mine the deposit at `key`. */
  assignMiner: (key: string) => void;
  /** Take the miner off the deposit at `key`; they go back to the campfire. */
  releaseMiner: (key: string) => void;
  /** Buy another cart and hauler for a level. */
  buyCart: (level: number) => void;
  /** Sell a moored barge whole units of what it wants, from the warehouse ('all': as much as it takes). */
  sellToBarge: (id: number, amount: number | 'all') => void;
  /** Send a barge off without trading (one still sailing in turns back), freeing its berth. */
  sendBargeAway: (id: number) => void;
  /** Set a forge to make an item (null: no task); a piece it had started is given back. */
  setForgeTask: (forge: ForgeId, item: ItemId | null) => void;
  /** How many of its item a forge keeps in store before it stops. */
  setForgeTarget: (forge: ForgeId, target: number) => void;
  /** Hire waiting recruits at a unit's dwelling. */
  recruit: (unit: ArmyUnit, amount: number | 'max') => void;
  /** Take command of the battle at the gate (it then waits for the player's orders). */
  commandBattle: () => void;
  /** Order the stack whose turn it is. */
  battleAct: (action: BattleAction) => void;
  /** Let the raiders (or auto-battle) make their next move. */
  battleStep: () => void;
  setBattleAuto: (auto: boolean) => void;
  /** Fight the rest of the battle at once. */
  quickResolveBattle: () => void;
  /** Leave a finished battlefield. */
  closeBattle: () => void;
  dismissRaidReport: () => void;
  /** Wipe the save and start again from the beginning. */
  resetGame: () => void;
};

/** The saved part of the state: everything but the actions. */
type SavedState = { [K in keyof GameState as GameState[K] extends (...args: never[]) => unknown ? never : K]: GameState[K] };

const roundCoal = (amount: number) => Math.round(amount * 10) / 10;

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

/** What the hold can field against raiders (raids are sized to it). */
export function holdPowerOf(state: WorkforceState & Pick<GameState, 'army' | 'techs' | 'traps'>): HoldPower {
  const stats = buildingStats(state.buildings, workforceOf(state).staff, state.techs);
  // The traps on an average side: a raid comes from one of the land sides (a few companies cross the pitch).
  const counts = trapCounts(state.traps);
  const trapDamage = ((counts.spikes * TRAP_DAMAGE.spikes + counts.pitch * TRAP_DAMAGE.pitch * 3 + counts.snare * 10) * stats.trapPower) / RAID_SIDES.length;
  return holdPower({
    army: armyValue(state.army),
    towers: stats.towers,
    towerDamage: stats.towerDamage,
    towerShots: stats.towerShots,
    wallHp: stats.wallHp,
    gateHp: stats.gateHp,
    trapDamage,
    moatDamage: stats.moatDamage,
  });
}

const minutes = (seconds: number) => `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;

/** The docks now: how often barges come (0: no dockhands, none come), how big their orders are, the trade bonus. */
export function docksOf(state: WorkforceState & Pick<GameState, 'techs'>) {
  const stats = buildingStats(state.buildings, workforceOf(state).staff, state.techs);
  return { interval: stats.shipCycle, hold: stats.shipHold, tradeBonus: stats.tradeBonus };
}

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

const footprintOf = (id: BuildingId, placements: Placements) => {
  const spot = spotOf(id, placements);
  return spot ? { ...spot, ...FOOTPRINTS[id] } : null;
};

type WalkState = Pick<GameState, 'placements' | 'roads' | 'clearedRocks'>;

/** The haulers' walk between the mine and the warehouse (null: no way through, or no warehouse). */
export function haulWalk(state: WalkState): Walk | null {
  const store = footprintOf('warehouse', state.placements);
  return store ? walkBetween(MINE_SPOT, store, state.placements, state.roads, state.clearedRocks) : null;
}

/** A cart trip's three legs in seconds (at cart speed), or null if a stop is missing or can't be reached. */
export function wagonLegs(state: WalkState & Pick<GameState, 'buildings' | 'techs'>, kind: WagonJob['kind'], site: BuildingId, speed: number): [number, number, number] | null {
  const stops = wagonStops({ kind, site }).map((id) => footprintOf(id, state.placements));
  if (stops.some((stop) => !stop) || speed <= 0) return null;
  const legs: number[] = [];
  for (let i = 0; i < 3; i++) {
    const walk = walkBetween(stops[i] as Spot & Footprint, stops[i + 1] as Spot & Footprint, state.placements, state.roads, state.clearedRocks);
    if (!walk) return null;
    legs.push(Math.max(1, Math.round(walk.time / speed)));
  }
  return legs as [number, number, number];
}

/** Builders' walk from the warehouse to a building's plot. */
export function siteWalk(state: WalkState, id: BuildingId): Walk | null {
  const store = footprintOf('warehouse', state.placements);
  const site = footprintOf(id, state.placements);
  if (!store || !site) return null;
  if (id === 'warehouse') return { time: 0, points: [], times: [] };
  return walkBetween(store, site, state.placements, state.roads, state.clearedRocks);
}

/** How fast a building's crew works, by their walk from the warehouse. */
export const siteFactor = (state: WalkState, id: BuildingId) => buildFactor(siteWalk(state, id));

/** Rocks waiting in the clearing orders (tile keys). */
export const orderedRocks = (orders: readonly ClearOrder[]) => new Set(orders.flatMap((order) => order.tiles));

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


/** Can this unit be recruited (its dwelling is built and the keep is high enough)? */
export function unitAvailable(state: Pick<GameState, 'buildings'>, unit: ArmyUnit) {
  const { dwelling, requiresKeep } = ARMY_RECRUITING[unit];
  return state.buildings[dwelling] >= 1 && state.buildings.keep >= requiresKeep;
}

/** How many of a unit the treasury and the gear at its dwelling can pay for. */
export function affordableRecruits(state: Pick<GameState, 'gold' | 'dwellingGear'>, unit: ArmyUnit) {
  return Math.min(Math.floor(state.gold / ARMY_RECRUITING[unit].gold), Math.floor(state.dwellingGear[unit] ?? 0));
}

/** Seconds of work each forge does each second now (0: not built, or no smiths). */
export function forgeSpeedsOf(state: WorkforceState & Pick<GameState, 'techs'>) {
  return buildingStats(state.buildings, workforceOf(state).staff, state.techs).forgeSpeed;
}

const itemName = (item: ItemId, count: number) => (count === 1 ? ITEM_INFO[item].name : ITEM_INFO[item].plural).toLowerCase();

/** A list of what's short, e.g. "2 iron, 1 steel bar". */
function missingText(missing: Load) {
  return [
    ...(Object.entries(missing.items) as [ItemId, number][]).map(([item, n]) => `${String(n)} ${itemName(item, n)}`),
    ...(Object.entries(missing.resources) as [Resource, number][]).map(([resource, n]) => `${String(n)} ${RESOURCE_INFO[resource].name.toLowerCase()}`),
  ].join(', ');
}

export type ForgeStatus = { state: 'unbuilt' | 'idle' | 'unstaffed' | 'working' | 'full' | 'rackFull' | 'waiting'; text: string; progress: number };

type ForgeState = WorkforceState & Pick<GameState, 'techs' | 'forgeTasks' | 'items' | 'warehouse' | 'wagonJobs' | 'elapsedSeconds' | 'dwellingGear'>;

/** Pieces of an item made: in the store, on forge racks, on carts and at the dwellings (what a forge's target counts). */
export function itemsCounted(state: Pick<GameState, 'items' | 'forgeTasks' | 'wagonJobs' | 'dwellingGear'>, item: ItemId) {
  const racked = FORGE_IDS.reduce((sum, forge) => sum + (state.forgeTasks[forge]?.item === item ? (state.forgeTasks[forge]?.output ?? 0) : 0), 0);
  const atDwellings = ARMY_UNITS.reduce((sum, unit) => sum + (UNIT_GEAR[unit] === item ? Math.floor(state.dwellingGear[unit] ?? 0) : 0), 0);
  return Math.floor(state.items[item]) + racked + atDwellings + (itemsInTransit(state.wagonJobs)[item] ?? 0);
}

/** What a forge is doing, for the lists. */
export function forgeStatus(state: ForgeState, forge: ForgeId, speeds = forgeSpeedsOf(state)): ForgeStatus {
  if (state.buildings[forge] < 1) return { state: 'unbuilt', text: 'Not built.', progress: 0 };
  const task = state.forgeTasks[forge];
  if (!task) return { state: 'idle', text: 'No task: pick what it makes.', progress: 0 };
  const { recipe, plural } = ITEM_INFO[task.item];
  const counted = itemsCounted(state, task.item);
  if (speeds[forge] <= 0) return { state: 'unstaffed', text: 'No smiths: free a peasant or restart it.', progress: task.loaded ? task.done / recipe.seconds : 0 };
  if (task.loaded) return { state: 'working', text: `Making ${plural.toLowerCase()} · ${String(counted)}/${String(task.target)} made`, progress: task.done / recipe.seconds };
  if (task.output >= FORGE_OUTPUT_CAP) return { state: 'rackFull', text: `Its rack is full (${String(task.output)}): waiting for a cart to take them.`, progress: 0 };
  if (counted >= task.target) return { state: 'full', text: `${plural}: ${String(counted)}/${String(task.target)} made — waiting until some are used.`, progress: 0 };
  // Short of materials on its shelf: coming, short in the store, or no cart to bring them.
  const coming = state.wagonJobs.find((job) => job.kind === 'supply' && job.site === forge && !job.dropped);
  if (coming) return { state: 'waiting', text: `A cart is bringing its materials (${String(Math.max(0, Math.ceil(wagonDropAt(coming) - state.elapsedSeconds)))} s).`, progress: 0 };
  const short = missingInputs(recipe, state.warehouse, state.items);
  const shelf = shelfMissing(task);
  const reallyShort: Load = emptyLoad();
  for (const [resource, n] of Object.entries(short.resources) as [Resource, number][]) if (shelf.resources[resource]) reallyShort.resources[resource] = n;
  for (const [item, n] of Object.entries(short.items) as [ItemId, number][]) if (shelf.items[item]) reallyShort.items[item] = n;
  if (loadUnits(reallyShort) > 0) return { state: 'waiting', text: `Waiting for ${missingText(reallyShort)} in the store.`, progress: 0 };
  if (buildingStats(state.buildings, workforceOf(state).staff, state.techs).wagons <= 0) return { state: 'waiting', text: 'No carts to bring its materials: build a Cart Depot (and give it carters).', progress: 0 };
  return { state: 'waiting', text: 'Waiting for a free cart to bring its materials.', progress: 0 };
}

/** What a cart is doing, for the depot's list. */
export function wagonText(state: Pick<GameState, 'elapsedSeconds'>, job: WagonJob) {
  const goods = loadText(job.load);
  const site = BUILDING_INFO[job.site].name;
  const now = state.elapsedSeconds;
  if (!job.dropped) {
    const at = Math.max(0, Math.ceil(wagonDropAt(job) - now));
    if (job.kind === 'collect') return `Taking ${goods} from ${site} to the store · ${String(at)} s`;
    return `Bringing ${goods} to ${job.kind === 'deliver' ? 'the ' : ''}${site} · ${String(at)} s`;
  }
  return `Coming back to the depot · ${String(Math.max(0, Math.ceil(wagonBackAt(job) - now)))} s`;
}

/** A load as text, e.g. "4 iron, 2 coal, 1 steel bar". */
export function loadText(load: Load) {
  return missingText(load) || 'nothing';
}

/**
 * A forge's goods back into the store (mutates `warehouse` and `items`): its shelf, the materials of the
 * piece on its anvil and the finished pieces on its rack; resources only up to the warehouse's room.
 */
function returnForgeGoods(task: ForgeTask, warehouse: Stock, items: ItemStock, before: Stock, capacity: number) {
  const goods = task.loaded ? addLoad(task.stock, { resources: ITEM_INFO[task.item].recipe.resources, items: ITEM_INFO[task.item].recipe.items }) : task.stock;
  for (const [resource, n] of Object.entries(goods.resources) as [Resource, number][]) {
    warehouse[resource] = Math.min(roundCoal(warehouse[resource] + n), Math.max(before[resource], capacity));
  }
  for (const [item, n] of Object.entries(goods.items) as [ItemId, number][]) items[item] += n;
  items[task.item] += task.output;
}

/** A waiting barge sent back downriver from wherever it is now (one sailing in turns round on the spot). */
function turnBack(barge: Barge, now: number): Barge {
  const along = Math.min(1, Math.max(0, (now - barge.arrivedAt) / BARGE_SAIL));
  return { ...barge, leftAt: now - (1 - along) * BARGE_SAIL };
}

/**
 * Undo a cart's trip (mutates the stores passed in): materials not yet delivered go back to the warehouse
 * (up to its room) and the store; pieces not yet delivered go back onto their forge's rack (or into the
 * store if the forge has moved on). Returns where the goods went, for the news.
 */
function undoWagonTrip(
  job: WagonJob,
  stores: { warehouse: Stock; items: ItemStock; forgeTasks: ForgeTasks; buildings: BuildingLevels; before: Stock; capacity: number },
): string {
  if (job.dropped) return '';
  const { warehouse, items, forgeTasks } = stores;
  if (job.kind === 'deliver') {
    for (const [item, n] of Object.entries(job.load.items) as [ItemId, number][]) items[item] += n;
    return 'back in the store';
  }
  if (job.kind === 'supply') {
    for (const [resource, n] of Object.entries(job.load.resources) as [Resource, number][]) {
      warehouse[resource] = Math.min(roundCoal(warehouse[resource] + n), Math.max(stores.before[resource], stores.capacity));
    }
    for (const [item, n] of Object.entries(job.load.items) as [ItemId, number][]) items[item] += n;
    return 'back in the warehouse';
  }
  const forge = isForge(job.site) ? job.site : null;
  const task = forge ? forgeTasks[forge] : undefined;
  const pieces = Object.values(job.load.items).reduce<number>((sum, n) => sum + (n ?? 0), 0);
  if (forge && task && task.item === job.item && stores.buildings[forge] > 0) {
    forgeTasks[forge] = { ...task, output: task.output + pieces };
    return `back on ${FORGE_NAMES[forge]}’s rack`;
  }
  for (const [item, n] of Object.entries(job.load.items) as [ItemId, number][]) items[item] += n;
  return 'in the store';
}

/** The built forges set to make an item. */
export const forgesMaking = (state: Pick<GameState, 'buildings' | 'forgeTasks'>, item: ItemId) =>
  FORGE_IDS.filter((forge) => state.buildings[forge] > 0 && state.forgeTasks[forge]?.item === item);

/** Lists show only the next forge to build (all of them are built in order). */
export function isShownBuilding(state: Pick<GameState, 'buildings' | 'construction'>, id: BuildingId) {
  if (!isForge(id)) return true;
  const started = (forge: ForgeId) => state.buildings[forge] > 0 || state.construction.some((job) => job.building === forge);
  return started(id) || FORGE_IDS.find((forge) => !started(forge)) === id;
}

/** The first built forge with no task, if any. */
export const freeForge = (state: Pick<GameState, 'buildings' | 'forgeTasks'>) => FORGE_IDS.find((forge) => state.buildings[forge] > 0 && !state.forgeTasks[forge]) ?? null;


export function describeParty(party: RaidParty) {
  return party.map(({ unit, count }) => `${String(count)} ${(count === 1 ? UNIT_STATS[unit].name : UNIT_STATS[unit].plural).toLowerCase()}`).join(', ');
}

type SettleState = Pick<GameState, 'gold' | 'warehouse' | 'army' | 'battleArmy' | 'elapsedSeconds' | 'raid' | 'raidsFought' | 'raidsLostInARow'>;

// A battle just ended: survivors rejoin the army, and the bounty is paid or the plunder taken.
function settleBattle(state: SettleState, battle: Battle) {
  const { survivors, losses, slain } = battleOutcome(battle, state.battleArmy);
  const army = { ...state.army };
  for (const unit of ARMY_UNITS) army[unit] = Math.max(0, army[unit] - state.battleArmy[unit] + survivors[unit]);
  const number = state.raid?.number ?? battle.raid;
  const report: RaidReport = {
    number,
    outcome: battle.status === 'won' ? 'won' : battle.status === 'lost' ? 'lost' : 'withdrawn',
    bounty: 0,
    losses,
    slain,
    trapKills: battle.trapKills ?? 0,
    plundered: null,
  };
  let { gold, warehouse } = state;
  let notice: string;
  if (report.outcome === 'won') {
    report.bounty = raidBounty(raiderStrength(battle));
    gold += report.bounty;
    notice = `Raid ${String(number)} beaten! The raiders' bounty: ${String(report.bounty)} gold.`;
  } else if (report.outcome === 'lost') {
    const taken: Partial<Stock> = {};
    warehouse = { ...warehouse };
    for (const resource of RESOURCES) {
      const amount = Math.floor(warehouse[resource] * PLUNDER_SHARE);
      if (amount > 0) taken[resource] = amount;
      warehouse[resource] = roundCoal(warehouse[resource] - amount);
    }
    const goldTaken = Math.floor(gold * PLUNDER_SHARE);
    gold -= goldTaken;
    report.plundered = { gold: goldTaken, resources: taken };
    notice = `Raid ${String(number)}: the hold fell. The raiders carried off ${String(goldTaken)} gold and a share of every stockpile.`;
  } else {
    notice = `Raid ${String(number)}: the raiders gave up and withdrew.`;
  }
  return {
    army,
    gold,
    warehouse,
    raidReport: report,
    raid: null,
    raidsFought: Math.max(state.raidsFought, number),
    raidsLostInARow: report.outcome === 'lost' ? state.raidsLostInARow + 1 : 0,
    nextRaidAt: state.elapsedSeconds + RAID_INTERVAL,
    notice,
  };
}

// Apply a new battle state, settling the raid if it just ended.
function withBattle(state: GameState, next: Battle): Partial<GameState> {
  if (next === state.battle) return {};
  if (state.battle?.status === 'active' && next.status !== 'active') return { battle: next, ...settleBattle(state, next) };
  return { battle: next };
}

// The state fields that follow from building levels (and, for what buildings do, their staff), the
// techs bought, and how quickly the haulers walk between the mine and the warehouse (`haul`).
function buildingFields(buildings: BuildingLevels, staff: Partial<Record<BuildingId, number>> | undefined, techs: readonly TechId[], haul: number) {
  const stats = buildingStats(buildings, staff, techs);
  return {
    buildings,
    minerRate: stats.minerRate,
    mineCartCapacity: stats.mineCartCapacity,
    warehouseCapacity: stats.warehouseCapacity,
    mineCapacity: stats.mineCapacity,
    mineExitCapacity: stats.mineCapacity,
    surfaceHaul: Math.round(stats.surfaceHaul * haul),
  };
}

type WorkforceState = Pick<GameState, 'population' | 'sites' | 'pendingSites' | 'carts' | 'construction' | 'clearOrders' | 'buildings' | 'paused'>;

/** Peasants pushing mine carts: one per cart on every level with miners (carts never outnumber miners). */
export function cartPushers(state: Pick<GameState, 'sites' | 'pendingSites' | 'carts'>) {
  let total = 0;
  for (const [level, miners] of minersByLevel([...state.sites, ...state.pendingSites])) total += Math.min(cartsOnLevel(state.carts, level), miners);
  return total;
}

/** Who's doing what: miners, pushers, builders, building staff and the idle. */
export function workforceOf(state: WorkforceState): Workforce {
  return allocateWorkforce({
    population: state.population,
    miners: state.sites.length + state.pendingSites.length,
    pushers: cartPushers(state),
    // Building crews, and the rock-clearing crew while there are orders.
    builders: state.construction.reduce((sum, job) => sum + job.crew, 0) + (state.clearOrders.length > 0 ? CLEAR_CREW : 0),
    levels: state.buildings,
    paused: state.paused,
  });
}

/** Peasants not under orders (staff and idle): what a new order or a recruit can take. */
export const freeHands = (state: WorkforceState) => workforceOf(state).free;

/** Peasants a new miner on `site` needs: the miner, plus a cart pusher if the level has nobody yet. */
function minerCrew(state: Pick<GameState, 'sites' | 'pendingSites'>, site: Site) {
  return minersByLevel([...state.sites, ...state.pendingSites]).has(siteLevel(site)) ? 1 : 2;
}

type LayoutState = Pick<GameState, 'layoutVersion' | 'depth' | 'sites' | 'playerDug' | 'depositMined' | 'openedStations'>;

export function selectMineLayout(state: LayoutState): MineLayout {
  return buildMineLayout({
    version: state.layoutVersion,
    depth: state.depth,
    sites: state.sites,
    playerDug: state.playerDug,
    depositMined: state.depositMined,
    openedStations: state.openedStations,
  });
}

// Assigning a miner to a gallery station cuts its chamber and ladder shaft for good.
function withSite(state: Pick<GameState, 'sites' | 'openedStations' | 'layoutVersion'>, site: Site) {
  const level = siteLevel(site);
  const key = site.station === undefined ? null : stationKey(level, site.station);
  return {
    sites: [...state.sites, site],
    openedStations: key && !state.openedStations.includes(key) ? [...state.openedStations, key] : state.openedStations,
    layoutVersion: state.layoutVersion + 1,
  };
}

/** Price of the next cart for a level that already has `current` carts (shaft surveys cut it). */
export function cartCost(current: number, techs: readonly TechId[] = []): Cost {
  const scale = 1.6 ** Math.max(0, current - 1) * (1 - techBonuses(techs).cartCost);
  return { coal: Math.round(25 * scale), gold: Math.round(40 * scale) };
}

/** Working miners on each level (a level can use at most one cart per miner). */
export function minersByLevel(sites: Site[]) {
  const counts = new Map<number, number>();
  for (const site of sites) counts.set(siteLevel(site), (counts.get(siteLevel(site)) ?? 0) + 1);
  return counts;
}

/** The resource a miner's site produces. */
export function siteResource(site: Site): Resource {
  return depositAt(site.faceRow, site.faceColumn) ?? 'coal';
}

/** Building names, for placement messages. */
export const BUILDING_NAMES = Object.fromEntries(BUILDING_IDS.map((id) => [id, BUILDING_INFO[id].name])) as Record<BuildingId, string>;

const startingSites = [stationSite(-1, 0), stationSite(-1, 1)];
const startingPlacements = fillPlacements(STARTING_BUILDINGS, [], {}, BUILDING_NAMES);
const startingStats = buildingStats(STARTING_BUILDINGS);

const withArticle = (noun: string) => `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`;

// Move up to `capacity` units in total from one set of stockpiles to the next, resource by resource,
// without overfilling any destination pile.
function transfer(from: Stock, to: Stock, capacity: number, destinationCapacity: number) {
  const nextFrom = { ...from };
  const nextTo = { ...to };
  let moved = 0;
  for (const resource of RESOURCES) {
    const amount = roundCoal(Math.min(nextFrom[resource], capacity - moved, Math.max(0, destinationCapacity - nextTo[resource])));
    if (amount <= 0) continue;
    nextFrom[resource] = roundCoal(nextFrom[resource] - amount);
    nextTo[resource] = roundCoal(nextTo[resource] + amount);
    moved = roundCoal(moved + amount);
  }
  return { from: nextFrom, to: nextTo, moved };
}

const saveStorage = createSaveStorage<SavedState>();

export const useGameStore = create<GameState>()(persist<GameState, [], [], SavedState>((set) => ({
  elapsedSeconds: 0,
  depth: 1,
  gold: 120,
  population: 10,
  paused: [],
  placements: startingPlacements,
  roads: startingRoads(startingPlacements),
  clearedRocks: [],
  clearOrders: [],
  items: emptyItems(),
  forgeTasks: {},
  wagonJobs: [],
  wagonSerial: 0,
  // A few pikes at the guardhouse to start with, so it can raise pikemen before there are forges and carts.
  dwellingGear: { pikeman: 10 },
  traps: [],
  techs: [],
  minerRate: startingStats.minerRate,
  buildings: STARTING_BUILDINGS,
  construction: [],
  vein: emptyStock(),
  mineExit: emptyStock(),
  mineStock: emptyStock(),
  warehouse: { ...emptyStock(), coal: 16 },
  veinCapacity: 50,
  mineExitCapacity: startingStats.mineCapacity,
  mineCapacity: startingStats.mineCapacity,
  warehouseCapacity: startingStats.warehouseCapacity,
  mineCartCapacity: startingStats.mineCartCapacity,
  surfaceHaul: startingStats.surfaceHaul,
  lastFlow: { mined: 0, toMineExit: 0, toMineStockpile: 0, toWarehouse: 0 },
  haulTime: 0,
  haulAppliedTime: 0,
  cartLoads: {},
  carts: {},
  sites: startingSites,
  pendingSites: [],
  depositMined: {},
  openedStations: [stationKey(-1, 0), stationKey(-1, 1)],
  playerDug: [],
  digPlan: [],
  digProgress: 0,
  layoutVersion: 0,
  army: { ...emptyArmy(), pikeman: 12 },
  raidsFought: 0,
  raidsLostInARow: 0,
  recruits: { ...emptyArmy(), pikeman: 7 },
  nextRaidAt: FIRST_RAID_AT,
  raid: null,
  battle: null,
  battleArmy: emptyArmy(),
  battleCommanded: false,
  battleDeadline: 0,
  raidReport: null,
  barges: [],
  nextBargeAt: 5,
  bargeSerial: 0,
  notice: 'Two miners are already working the first seam.',

  tick: () => set((state) => {
    // Each miner cuts from their own deposit into that resource's stockpile beside the miners,
    // until the deposit is mined out (or the stockpile is full).
    const vein = { ...state.vein };
    let mined = 0;
    let depositMined = state.depositMined;
    let sites = state.sites;
    let layoutChanged = false;
    const exhausted: Site[] = [];
    for (const site of state.sites) {
      const resource = siteResource(site);
      const total = depositTotal(site.faceRow, site.faceColumn);
      const remaining = depositRemaining({ depositMined }, site.faceRow, site.faceColumn);
      const take = roundCoal(Math.min(state.minerRate, remaining, Math.max(0, state.veinCapacity - vein[resource])));
      if (take <= 0 && remaining > 0) continue;
      const key = tileKey(site.faceRow, site.faceColumn);
      if (depositMined === state.depositMined) depositMined = { ...depositMined };
      depositMined[key] = roundCoal((depositMined[key] ?? 0) + take);
      vein[resource] = roundCoal(vein[resource] + take);
      mined = roundCoal(mined + take);
      const left = remaining - take;
      // Redraw the deposit as it shrinks, and free the miner once it is mined out.
      if (depositStep(total, left) !== depositStep(total, remaining)) layoutChanged = true;
      if (left <= 0) exhausted.push(site);
    }
    let notice = state.notice;
    if (exhausted.length > 0) {
      sites = sites.filter((site) => !exhausted.includes(site));
      layoutChanged = true;
      notice = exhausted.length === 1
        ? 'A deposit is mined out. Its miner went back to the campfire: tap another deposit to assign one.'
        : `${String(exhausted.length)} deposits are mined out. Their miners went back to the campfire.`;
    }

    // Carts: the mine renderer animates the second that ends at `haulTime`, so the loads and tips
    // that happen in it are applied now, as the player sees them. Each trip serves one miner: it
    // loads that miner's resource from its stockpile and tips it into the same resource's bin at
    // the mine exit.
    const from = state.haulAppliedTime;
    const to = state.haulTime;
    const mineExitIn = { ...state.mineExit };
    let cartLoads = state.cartLoads;
    let toMineExit = 0;
    const routes = getCartRoutes(selectMineLayout(state), state.carts);
    for (const [cart, route] of routes) {
      const tips = cartEventsBetween(route, from, to, 'tip');
      const loads = cartEventsBetween(route, from, to, 'load');
      if (tips.length === 0 && loads.length === 0) continue;
      cartLoads = cartLoads === state.cartLoads ? { ...cartLoads } : cartLoads;
      if (tips.length > 0) {
        const carried = cartLoads[cart] as CartLoad | undefined;
        if (carried && carried.amount > 0) {
          mineExitIn[carried.resource] = roundCoal(mineExitIn[carried.resource] + carried.amount);
          toMineExit = roundCoal(toMineExit + carried.amount);
        }
        delete cartLoads[cart];
      }
      for (const trip of loads) {
        const resource = route.resources[trip];
        const take = Math.min(vein[resource], state.mineCartCapacity);
        vein[resource] = roundCoal(vein[resource] - take);
        cartLoads[cart] = { resource, amount: take };
      }
    }

    // Carts keep rolling only while every bin they deliver to at the mine exit has room for a load.
    const carried = emptyStock();
    for (const load of Object.values(cartLoads)) carried[load.resource] += load.amount;
    const served = new Set<Resource>();
    for (const route of routes.values()) route.resources.forEach((resource) => served.add(resource));
    const canHaul = [...served].every(
      (resource) => mineExitIn[resource] + carried[resource] + state.mineCartCapacity <= state.mineExitCapacity,
    );

    // Surface hauling: mine exit → mine stockpile → warehouse, in the same tick as a delivery.
    const toMine = transfer(mineExitIn, state.mineStock, state.surfaceHaul, state.mineCapacity);
    const toStore = transfer(toMine.to, state.warehouse, state.surfaceHaul, state.warehouseCapacity);

    // Diggers work through the plan one tile at a time.
    let { digPlan, digProgress, playerDug, pendingSites } = state;
    let layoutVersion = state.layoutVersion + (layoutChanged ? 1 : 0);
    if (digPlan.length > 0) {
      digProgress = roundCoal(digProgress + buildingStats(state.buildings, undefined, state.techs).digSpeed);
      if (digProgress >= digTime(parseKey(digPlan[0]).row)) {
        playerDug = [...playerDug, digPlan[0]];
        digPlan = digPlan.slice(1);
        digProgress = 0;
        layoutVersion += 1;
      }
    }
    // A miner waiting on a tunnel starts as soon as the tile beside their deposit is dug.
    const dugNow = new Set(playerDug);
    const arrived = pendingSites.filter((site) => dugNow.has(tileKey(site.row, site.column)));
    if (arrived.length > 0) {
      pendingSites = pendingSites.filter((site) => !arrived.includes(site));
      const faces = new Set(sites.map((site) => tileKey(site.faceRow, site.faceColumn)));
      const starting = arrived.filter((site) => !faces.has(tileKey(site.faceRow, site.faceColumn)));
      sites = [...sites, ...starting];
      layoutVersion += 1;
      if (starting.length > 0) notice = `The tunnel is through: a miner started on the ${RESOURCE_INFO[siteResource(starting[0])].deposit.toLowerCase()}.`;
    }

    // Building crews: each job advances a second (more with master masons, and with a quick walk from
    // the warehouse); finished levels take effect at once.
    const { techs } = state;
    let { buildings, construction } = state;
    let gold = state.gold;
    if (construction.length > 0) {
      const speed = buildingStats(buildings, undefined, techs).buildSpeed;
      construction = construction.map((job) => ({ ...job, progress: Math.round((job.progress + speed * siteFactor(state, job.building)) * 100) / 100 }));
      const finished = construction.filter((job) => job.progress >= job.duration);
      if (finished.length > 0) {
        construction = construction.filter((job) => job.progress < job.duration);
        buildings = { ...buildings };
        for (const job of finished) buildings[job.building] = job.level;
        const job = finished[0];
        notice = `${BUILDING_INFO[job.building].name} reached level ${String(job.level)}; the crew is back at the campfire.`;
        if (job.building === 'houses') notice += ` The houses now sleep ${String(buildingStats(buildings, undefined, techs).beds)} peasants.`;
      }
    }
    // The clearing crew works through the first order; when it's done its rocks are gone and their
    // stone reaches the warehouse as granite.
    let { clearedRocks, clearOrders } = state;
    if (clearOrders.length > 0) {
      const [order, ...rest] = clearOrders;
      const done = Math.round((order.done + 1) * 100) / 100;
      if (done < order.work) {
        clearOrders = [{ ...order, done }, ...rest];
      } else {
        clearOrders = rest;
        clearedRocks = [...clearedRocks, ...order.tiles];
        const granite = order.tiles.reduce((sum, key) => {
          const [x, y] = key.split(',').map(Number);
          const size = startingRock(x, y);
          return sum + (size ? ROCK_INFO[size].granite : 0);
        }, 0);
        const room = Math.max(0, state.warehouseCapacity - toStore.to.granite);
        toStore.to.granite = roundCoal(toStore.to.granite + Math.min(granite, room));
        notice = `Cleared ${String(order.tiles.length)} rock${order.tiles.length === 1 ? '' : 's'}: +${String(Math.min(granite, room))} granite${granite > room ? ' (the warehouse is full)' : ''}.`;
      }
    }

    // Carts, then forges. A cart unloads at its second stop (materials onto a forge's shelf, or finished
    // pieces into the store; materials for a forge that has changed task go back to the warehouse) and is
    // free again once back at the depot. Free carts are sent where they're most needed: racks that are full,
    // then forges with nothing to work with, then any rack with pieces, then any shelf running low.
    const second = state.elapsedSeconds + 1;
    let { items, forgeTasks, wagonJobs, wagonSerial, dwellingGear } = state;
    const anyForge = FORGE_IDS.some((forge) => forgeTasks[forge]);
    const anyGear = ARMY_UNITS.some((unit) => state.items[UNIT_GEAR[unit]] >= 1 && buildings[ARMY_RECRUITING[unit].dwelling] > 0);
    if (anyForge || anyGear || wagonJobs.length > 0) {
      items = { ...items };
      forgeTasks = { ...forgeTasks };
      dwellingGear = { ...dwellingGear };
      const nextJobs: WagonJob[] = [];
      for (const job of wagonJobs) {
        let current = job;
        if (!job.dropped && second >= wagonDropAt(job)) {
          const task = isForge(job.site) ? forgeTasks[job.site] : undefined;
          const unit = DWELLING_UNIT[job.site];
          if (job.kind === 'collect') {
            for (const [item, n] of Object.entries(job.load.items) as [ItemId, number][]) items[item] += n;
          } else if (job.kind === 'deliver' && unit && state.buildings[job.site] > 0) {
            dwellingGear[unit] = (dwellingGear[unit] ?? 0) + loadUnits(job.load);
          } else if (job.kind === 'supply' && isForge(job.site) && task && task.item === job.item && state.buildings[job.site] > 0) {
            forgeTasks[job.site] = { ...task, stock: addLoad(task.stock, job.load) };
          } else {
            // Nowhere to unload it (the forge changed task, or the building is gone): back to the stores.
            for (const [resource, n] of Object.entries(job.load.resources) as [Resource, number][]) toStore.to[resource] = roundCoal(toStore.to[resource] + n);
            for (const [item, n] of Object.entries(job.load.items) as [ItemId, number][]) items[item] += n;
          }
          current = { ...job, dropped: true };
        }
        if (second < wagonBackAt(current)) nextJobs.push(current);
      }
      wagonJobs = nextJobs;

      const stats = buildingStats(buildings, workforceOf(state).staff, techs);
      let free = stats.wagons - wagonJobs.length;
      if (free > 0) {
        const send = (kind: WagonJob['kind'], site: BuildingId, load: Load, item: ItemId) => {
          const legs = wagonLegs(state, kind, site, stats.wagonSpeed);
          if (!legs) return false;
          wagonJobs = [...wagonJobs, { id: wagonSerial, kind, site, item, load, startedAt: second, legs, dropped: false }];
          wagonSerial += 1;
          free -= 1;
          return true;
        };
        const collect = (forge: ForgeId) => {
          const task = forgeTasks[forge];
          if (!task || task.output < 1) return;
          const n = Math.min(task.output, stats.wagonLoad);
          if (send('collect', forge, { resources: {}, items: { [task.item]: n } }, task.item)) forgeTasks[forge] = { ...task, output: task.output - n };
        };
        const counted = (item: ItemId) => itemsCounted({ items, forgeTasks, wagonJobs, dwellingGear }, item);
        const supply = (forge: ForgeId) => {
          const task = forgeTasks[forge];
          if (!task || counted(task.item) >= task.target) return;
          const load = supplyLoad(task, incomingTo(wagonJobs, forge), toStore.to, items, stats.wagonLoad);
          if (!load) return;
          if (send('supply', forge, load, task.item)) {
            for (const [resource, n] of Object.entries(load.resources) as [Resource, number][]) toStore.to[resource] = roundCoal(toStore.to[resource] - n);
            for (const [item, n] of Object.entries(load.items) as [ItemId, number][]) items[item] -= n;
          }
        };
        // Gear out to a dwelling: enough for its recruits waiting (`gearWanted`), counting what's there and coming.
        const gearShort = (unit: ArmyUnit) => {
          const dwelling = ARMY_RECRUITING[unit].dwelling;
          if (buildings[dwelling] < 1) return 0;
          return gearWanted(state.recruits[unit]) - Math.floor(dwellingGear[unit] ?? 0) - gearComing(wagonJobs, dwelling);
        };
        const deliver = (unit: ArmyUnit) => {
          const gear = UNIT_GEAR[unit];
          const n = Math.min(gearShort(unit), Math.floor(items[gear]), stats.wagonLoad);
          if (n < 1) return;
          if (send('deliver', ARMY_RECRUITING[unit].dwelling, { resources: {}, items: { [gear]: n } }, gear)) items[gear] -= n;
        };
        const forges = FORGE_IDS.filter((forge) => forgeTasks[forge] && buildings[forge] > 0);
        const starved = (forge: ForgeId) => {
          const task = forgeTasks[forge];
          return !!task && !task.loaded && loadUnits(shelfMissing(task)) > 0 && loadUnits(incomingTo(wagonJobs, forge)) === 0;
        };
        // In rounds, most pressing first: full racks, forges with nothing to work with, dwellings with more
        // recruits waiting than gear there or coming, any rack with pieces, any shelf running low, any
        // dwelling below what it keeps on hand.
        const forgeRound = (wanted: (forge: ForgeId) => boolean, act: (forge: ForgeId) => void) => () => {
          for (const forge of forges) if (free > 0 && wanted(forge)) act(forge);
        };
        const dwellingRound = (wanted: (unit: ArmyUnit) => boolean) => () => {
          for (const unit of ARMY_UNITS) if (free > 0 && wanted(unit)) deliver(unit);
        };
        const bare = (unit: ArmyUnit) =>
          Math.floor(state.recruits[unit]) > Math.floor(dwellingGear[unit] ?? 0) + gearComing(wagonJobs, ARMY_RECRUITING[unit].dwelling);
        const rounds = [
          forgeRound((forge) => (forgeTasks[forge]?.output ?? 0) >= FORGE_OUTPUT_CAP, collect),
          forgeRound(starved, supply),
          dwellingRound(bare),
          forgeRound((forge) => (forgeTasks[forge]?.output ?? 0) >= 1, collect),
          forgeRound(() => true, supply),
          dwellingRound((unit) => gearShort(unit) > 0),
        ];
        for (const round of rounds) round();
      }

      // Each forge works from its own shelf: it takes the next piece's materials while its rack has room and
      // the store (counting racks and carts) is below its target; finished, the piece goes onto the rack.
      const speeds = forgeSpeedsOf(state);
      for (const forge of FORGE_IDS) {
        const task = forgeTasks[forge];
        if (!task || speeds[forge] <= 0) continue;
        const { recipe } = ITEM_INFO[task.item];
        let next: ForgeTask = task;
        if (!task.loaded) {
          if (task.output >= FORGE_OUTPUT_CAP || itemsCounted({ items, forgeTasks, wagonJobs, dwellingGear }, task.item) >= task.target) continue;
          if (loadUnits(shelfMissing(task)) > 0) continue;
          next = { ...task, stock: addLoad(task.stock, { resources: recipe.resources, items: recipe.items }, -1), loaded: true, done: 0 };
        }
        const done = Math.round((next.done + speeds[forge]) * 100) / 100;
        next = done >= recipe.seconds ? { ...next, loaded: false, done: 0, output: next.output + 1 } : { ...next, done };
        forgeTasks[forge] = next;
      }
    }

    // Barges: ones that sailed off are gone once out of sight; while a berth is free, the next one sets
    // off up the river every so often (none come without dockhands), with an order drawn for it.
    let { barges, nextBargeAt, bargeSerial } = state;
    if (barges.some((barge) => barge.leftAt !== undefined && state.elapsedSeconds >= barge.leftAt + BARGE_SAIL)) {
      barges = barges.filter((barge) => barge.leftAt === undefined || state.elapsedSeconds < barge.leftAt + BARGE_SAIL);
    }
    const docks = docksOf(state);
    const taken = new Set(barges.map((barge) => barge.berth));
    const berth = BERTHS.findIndex((_, index) => !taken.has(index));
    if (docks.interval > 0 && state.elapsedSeconds >= nextBargeAt && berth >= 0 && barges.filter(isWaiting).length < MAX_BARGES) {
      const order = bargeOrder(bargeSerial, toStore.to, docks.hold, docks.tradeBonus, barges.filter(isWaiting).map((barge) => barge.resource));
      barges = [...barges, { id: bargeSerial, berth, arrivedAt: state.elapsedSeconds, ...order }];
      bargeSerial += 1;
      nextBargeAt = state.elapsedSeconds + docks.interval;
    }

    const structure = buildingStats(buildings, undefined, techs);
    // The keep collects taxes every five seconds.
    const elapsedSeconds = state.elapsedSeconds + 1;
    if (elapsedSeconds % 5 === 0) gold = Math.round((gold + structure.taxPerFiveSeconds) * 100) / 100;

    // New peasants come to the campfire while there are free beds (the houses' staff keep the beds).
    const before = { sites, pendingSites, carts: state.carts, construction, clearOrders, buildings, paused: state.paused };
    const beds = buildingStats(buildings, workforceOf({ ...before, population: state.population }).staff, techs).beds;
    let population = state.population;
    if (elapsedSeconds % structure.arrivalSeconds === 0 && population < beds) population += 1;

    // Staff the buildings from whoever isn't under orders; what each building does follows its staff.
    const workforce = workforceOf({ ...before, population });
    const fields = buildingFields(buildings, workforce.staff, techs, haulFactor(haulWalk(state)));

    // Dwellings: new recruits trickle in over each muster, and wait (up to a few musters' worth).
    const recruits = { ...state.recruits };
    for (const unit of ARMY_UNITS) {
      if (!unitAvailable({ buildings }, unit)) continue;
      const dwelling = ARMY_RECRUITING[unit].dwelling;
      const growth = unitGrowth(unit, workedLevel(dwelling, buildings[dwelling], workforce.staff[dwelling]), structure.growthBonus[unit]);
      recruits[unit] = Math.min(growth * MAX_MUSTERS_WAITING, Math.round((recruits[unit] + growth / MUSTER_SECONDS) * 1000) / 1000);
    }

    // Raids: sighted a minute out, then a battle at the gate. Nobody in command? It fights itself.
    let raidFields: Partial<GameState> = {};
    const { raid, battle } = state;
    const battleRunning = battle?.status === 'active';
    if (!raid && !battleRunning && elapsedSeconds + RAID_WARNING >= state.nextRaidAt) {
      // Raiders sized to the hold as it stands when they're sighted.
      const number = state.raidsFought + 1;
      const power = holdPowerOf({ ...state, buildings, construction, population, sites, pendingSites }).total;
      const party = raidParty(number, raidStrength(number, power, state.raidsLostInARow));
      raidFields = { raid: { number, arrivesAt: state.nextRaidAt, party } };
      const side = raidSide(number);
      const traps = trapsFacing(state.traps, side).length;
      notice = `Raiders sighted to the ${SIDE_NAMES[side]}: ${describeParty(party)}. They attack in ${String(state.nextRaidAt - elapsedSeconds)} s${traps > 0 ? `, crossing ${String(traps)} trap${traps === 1 ? '' : 's'}` : ' — no traps on that side'}.`;
    } else if (raid && !battleRunning && elapsedSeconds >= raid.arrivesAt) {
      const stats = buildingStats(buildings, workforce.staff, techs);
      const created = createBattle({
        raid: raid.number,
        army: state.army,
        enemies: raid.party,
        wallHp: stats.wallHp,
        gateHp: stats.gateHp,
        towers: stats.towers,
        towerDamage: stats.towerDamage,
        attackBonus: stats.attackBonus,
        defenceBonus: stats.defenceBonus,
        traps: trapCounts(trapsFacing(state.traps, raidSide(raid.number))),
        trapPower: stats.trapPower,
        towerShots: stats.towerShots,
        wallOil: stats.wallOil,
        moatDamage: stats.moatDamage,
        moatAtGate: stats.moatAtGate,
        unitBonus: stats.unitBonus,
      });
      if (created.status !== 'active') {
        // Decided before it began (no army to defend the hold): settle the raid at once.
        const settled = settleBattle({ ...state, gold, warehouse: toStore.to, elapsedSeconds, battleArmy: state.army }, created);
        raidFields = { ...settled, battle: created, battleArmy: state.army, battleCommanded: false };
        notice = settled.notice;
      } else {
        raidFields = {
          battle: created,
          battleArmy: state.army,
          battleCommanded: false,
          battleDeadline: elapsedSeconds + RAID_AUTO_AFTER,
        };
        notice = `Raiders at the gate! Take command, or the defence fights on its own in ${String(RAID_AUTO_AFTER)} s.`;
      }
    } else if (battle && battleRunning && !state.battleCommanded && elapsedSeconds >= state.battleDeadline) {
      const settled = settleBattle({ ...state, gold, warehouse: toStore.to, elapsedSeconds }, resolveBattle(battle));
      raidFields = { ...settled, battle: null };
      notice = settled.notice;
    }

    return {
      ...fields,
      population,
      construction,
      gold,
      elapsedSeconds,
      digPlan,
      digProgress,
      playerDug,
      pendingSites,
      layoutVersion,
      sites,
      clearedRocks,
      clearOrders,
      items,
      forgeTasks,
      wagonJobs,
      wagonSerial,
      dwellingGear,
      barges,
      nextBargeAt,
      bargeSerial,
      depositMined,
      vein,
      mineExit: toMine.from,
      mineStock: toStore.from,
      warehouse: toStore.to,
      lastFlow: { mined, toMineExit, toMineStockpile: toMine.moved, toWarehouse: toStore.moved },
      haulTime: canHaul ? state.haulTime + 1 : state.haulTime,
      haulAppliedTime: to,
      cartLoads,
      recruits,
      ...raidFields,
      notice,
    };
  }),

  assignMiner: (key) => set((state) => {
    const free = freeHands(state);
    if (free <= 0) return { notice: 'No free peasants. Wait for more to arrive, pause a building, or release a miner.' };
    const info = getDepositInfo(selectMineLayout(state), key);
    if (info.status === 'depleted') return { notice: 'That deposit is mined out.' };
    if (info.status === 'worked') return { notice: 'A miner is already working that deposit.' };
    if (state.pendingSites.some((site) => tileKey(site.faceRow, site.faceColumn) === key)) {
      return { notice: 'A miner is already on the way to that deposit.' };
    }
    if (!info.standing) {
      // Nothing to stand on yet: order the shortest tunnel to it and send a miner along.
      const layout = selectMineLayout(state);
      const route = findDigRoute(layout, new Set(state.digPlan), standingTargets(layout, key));
      if (!route) return { notice: 'There’s no way to tunnel to that deposit from here.' };
      const cost = tunnelCost(state, route);
      if (state.gold < cost) return { notice: `Tunnelling to that deposit costs ${String(cost)} gold (${String(route.length)} tiles).` };
      const stand = parseKey(route[route.length - 1]);
      const pending: Site = { row: stand.row, column: stand.column, faceRow: info.row, faceColumn: info.column, kind: 'deposit' };
      const crew = minerCrew(state, pending);
      if (free < crew) return { notice: 'The first miner on a level needs a cart pusher too: 2 free peasants.' };
      return {
        gold: state.gold - cost,
        digPlan: [...state.digPlan, ...route],
        pendingSites: [...state.pendingSites, pending],
        notice: `Digging ${String(route.length)} tile${route.length === 1 ? '' : 's'} to the ${RESOURCE_INFO[info.deposit ?? 'coal'].deposit.toLowerCase()} for ${String(cost)} gold. A miner will start when it’s through.`,
      };
    }
    if (free < minerCrew(state, info.standing)) return { notice: 'The first miner on a level needs a cart pusher too: 2 free peasants.' };
    return {
      ...withSite(state, info.standing),
      notice: `A miner is now working ${withArticle(RESOURCE_INFO[siteResource(info.standing)].deposit.toLowerCase())} with ${info.remaining.toLocaleString()} ${RESOURCE_INFO[siteResource(info.standing)].unit.toLowerCase()} left.`,
    };
  }),

  releaseMiner: (key) => set((state) => {
    const { row, column } = parseKey(key);
    // A miner still waiting on a tunnel just stays idle (the tunnel is still dug).
    const pendingSites = state.pendingSites.filter((site) => !(site.faceRow === row && site.faceColumn === column));
    if (pendingSites.length !== state.pendingSites.length) {
      return { pendingSites, notice: 'The miner won’t wait for that tunnel and went back to the campfire.' };
    }
    const sites = state.sites.filter((site) => !(site.faceRow === row && site.faceColumn === column));
    if (sites.length === state.sites.length) return {};
    return { sites, layoutVersion: state.layoutVersion + 1, notice: 'The miner left the deposit and went back to the campfire.' };
  }),

  buyCart: (level) => set((state) => {
    const current = cartsOnLevel(state.carts, level);
    const miners = minersByLevel(state.sites).get(level) ?? 0;
    if (current >= miners) {
      return { notice: 'That level already has a cart for every miner. Add miners first.' };
    }
    const cost = cartCost(current, state.techs);
    if (!canAfford(state, cost)) {
      return { notice: `Another cart costs ${String(cost.coal)} coal and ${String(cost.gold)} gold.` };
    }
    if (freeHands(state) <= 0) return { notice: 'A new cart needs a free peasant to push it.' };
    return {
      warehouse: { ...state.warehouse, coal: roundCoal(state.warehouse.coal - cost.coal) },
      gold: state.gold - cost.gold,
      carts: { ...state.carts, [level]: current + 1 },
      notice: `A new cart and hauler joined ${level < 0 ? 'the entrance level' : `gallery ${String(level + 1)}`} (${String(current + 1)} carts).`,
    };
  }),

  sellToBarge: (id, amount) => set((state) => {
    const barge = state.barges.find((other) => other.id === id);
    if (!barge) return {};
    const blocker = bargeBlocker(state, barge);
    if (blocker) return { notice: blocker };
    const stock = Math.floor(state.warehouse[barge.resource]);
    const units = Math.min(barge.wants, stock, amount === 'all' ? stock : Math.floor(amount));
    if (units <= 0) return {};
    const earned = Math.floor(units * barge.price);
    const wants = barge.wants - units;
    const name = RESOURCE_INFO[barge.resource].name.toLowerCase();
    return {
      warehouse: { ...state.warehouse, [barge.resource]: roundCoal(state.warehouse[barge.resource] - units) },
      gold: state.gold + earned,
      // A barge whose order is filled sails off downriver.
      barges: state.barges.map((other) => (other.id === id ? { ...other, wants, ...(wants <= 0 ? { leftAt: state.elapsedSeconds } : {}) } : other)),
      notice: `Sold ${units.toLocaleString()} ${name} to a barge for ${earned.toLocaleString()} gold.${wants <= 0 ? ' Its order is filled: it sails off downriver.' : ` It wants ${wants.toLocaleString()} more.`}`,
    };
  }),

  sendBargeAway: (id) => set((state) => {
    const barge = state.barges.find((other) => other.id === id);
    if (!barge || !isWaiting(barge)) return {};
    const moored = isMoored(barge, state.elapsedSeconds);
    return {
      barges: state.barges.map((other) => (other.id === id ? turnBack(other, state.elapsedSeconds) : other)),
      notice: `The barge wanting ${RESOURCE_INFO[barge.resource].name.toLowerCase()} ${moored ? 'sails off downriver empty' : 'turns back downriver'}; its berth is free for the next one.`,
    };
  }),

  recallWagon: (id) => set((state) => {
    const job = state.wagonJobs.find((other) => other.id === id);
    if (!job) return {};
    const warehouse = { ...state.warehouse };
    const items = { ...state.items };
    const forgeTasks = { ...state.forgeTasks };
    const where = undoWagonTrip(job, { warehouse, items, forgeTasks, buildings: state.buildings, before: state.warehouse, capacity: state.warehouseCapacity });
    return {
      warehouse,
      items,
      forgeTasks,
      wagonJobs: state.wagonJobs.filter((other) => other.id !== id),
      notice: job.dropped ? 'The cart is back at the depot.' : `The cart turns back: ${loadText(job.load)} ${where}.`,
    };
  }),

  setForgeTask: (forge, item) => set((state) => {
    const name = FORGE_NAMES[forge];
    if (state.buildings[forge] < 1) return { notice: `${name} isn’t built yet.` };
    const old = state.forgeTasks[forge];
    if (old?.item === item) return {};
    // What the forge holds goes back to the store: its shelf, the piece on the anvil and its rack.
    const warehouse = { ...state.warehouse };
    const items = { ...state.items };
    if (old) returnForgeGoods(old, warehouse, items, state.warehouse, state.warehouseCapacity);
    const forgeTasks = { ...state.forgeTasks };
    if (item) forgeTasks[forge] = { item, target: old?.target ?? DEFAULT_FORGE_TARGET, done: 0, loaded: false, stock: emptyLoad(), output: 0 };
    else delete forgeTasks[forge];
    return {
      warehouse,
      items,
      forgeTasks,
      notice: item ? `${name} now makes ${ITEM_INFO[item].plural.toLowerCase()} (up to ${String(forgeTasks[forge]?.target)} in store).` : `${name} stands idle.`,
    };
  }),

  setForgeTarget: (forge, target) => set((state) => {
    const task = state.forgeTasks[forge];
    if (!task || !(FORGE_TARGETS as readonly number[]).includes(target)) return {};
    return { forgeTasks: { ...state.forgeTasks, [forge]: { ...task, target } } };
  }),

  recruit: (unit, amount) => set((state) => {
    const stats = UNIT_STATS[unit];
    if (!unitAvailable(state, unit)) return { notice: `${stats.plural} can't be recruited yet.` };
    const waiting = Math.floor(state.recruits[unit]);
    const free = freeHands(state);
    const count = Math.min(waiting, affordableRecruits(state, unit), free, amount === 'max' ? Infinity : amount);
    if (count <= 0) {
      if (waiting <= 0) return { notice: `No ${stats.plural.toLowerCase()} are waiting to be recruited.` };
      if (free <= 0) return { notice: 'Every soldier is a peasant first, and none are free. Wait for more, or pause a building.' };
      return { notice: `You can't afford any ${stats.plural.toLowerCase()}.` };
    }
    return {
      gold: state.gold - ARMY_RECRUITING[unit].gold * count,
      dwellingGear: { ...state.dwellingGear, [unit]: (state.dwellingGear[unit] ?? 0) - count },
      army: { ...state.army, [unit]: state.army[unit] + count },
      // Soldiers leave the peasant pool (and its beds) for good.
      population: state.population - count,
      recruits: { ...state.recruits, [unit]: state.recruits[unit] - count },
      notice: `Recruited ${String(count)} ${(count === 1 ? stats.name : stats.plural).toLowerCase()}.`,
    };
  }),

  commandBattle: () => set((state) => (state.battle?.status === 'active' ? { battleCommanded: true } : {})),

  battleAct: (action) => set((state) => (state.battle ? withBattle(state, act(state.battle, action)) : {})),

  battleStep: () => set((state) => (state.battle ? withBattle(state, stepAI(state.battle)) : {})),

  setBattleAuto: (auto) => set((state) => (state.battle ? { battle: { ...state.battle, auto } } : {})),

  quickResolveBattle: () => set((state) => (state.battle ? withBattle(state, resolveBattle(state.battle)) : {})),

  closeBattle: () => set((state) => (state.battle && state.battle.status !== 'active' ? { battle: null } : {})),

  dismissRaidReport: () => set({ raidReport: null }),

  resetGame: () => set((state) => ({
    ...useGameStore.getInitialState(),
    // Keep counting up, so caches keyed by the layout version never mistake the new mine for the old one.
    layoutVersion: state.layoutVersion + 1,
    notice: 'A new game begins. Two miners are already working the first seam.',
  })),

  toggleBuildingPause: (id) => set((state) => {
    const { name } = BUILDING_INFO[id];
    if (state.paused.includes(id)) return { paused: state.paused.filter((other) => other !== id), notice: `The ${name} is back at work.` };
    if (staffNeeded(id, state.buildings[id]) === 0) return { notice: `The ${name} needs no staff.` };
    return { paused: [...state.paused, id], notice: `The ${name} is stopped; its staff went back to the campfire.` };
  }),

  upgradeBuilding: (id) => set((state) => {
    const blocker = upgradeBlocker(state, id);
    const { name } = BUILDING_INFO[id];
    if (blocker) return { notice: `${name}: ${blocker}` };
    if (state.buildings[id] === 0 && isPlaceable(id) && !state.placements[id]) return { notice: `Choose where to build the ${name} first.` };
    return startBuilding(state, id);
  }),

  placeBuilding: (id, spot) => set((state) => {
    const { name } = BUILDING_INFO[id];
    if (state.buildings[id] > 0 || state.construction.some((job) => job.building === id)) return { notice: `The ${name} is already built.` };
    const problem = placementProblem(id, spot, state.placements, BUILDING_NAMES, rockyTest(state.clearedRocks)) ?? upgradeBlocker(state, id);
    if (problem) return { notice: `${name}: ${problem}` };
    // Roads where it goes are taken up.
    const under = roadsUnder({ ...spot, ...FOOTPRINTS[id] }, state.roads);
    const started = startBuilding(state, id);
    return {
      ...started,
      placements: { ...state.placements, [id]: spot },
      roads: withoutRoads(state.roads, under),
      notice: under.length > 0 ? `${started.notice ?? ''} ${String(under.length)} road tile${under.length === 1 ? ' was' : 's were'} taken up.` : started.notice,
    };
  }),

  clearRocks: (tiles) => set((state) => {
    const ordered = orderedRocks(state.clearOrders);
    const keys: string[] = [];
    let work = 0;
    for (const { x, y } of tiles) {
      const key = mapTileKey(x, y);
      const size = rockAt(state.clearedRocks, x, y);
      if (!size || ordered.has(key) || keys.includes(key)) continue;
      keys.push(key);
      work += ROCK_INFO[size].seconds;
    }
    if (keys.length === 0) return { notice: 'No rocks there to clear (or they’re already ordered).' };
    work = Math.ceil(work);
    const queued = state.clearOrders.reduce((sum, order) => sum + order.work - order.done, 0);
    return {
      clearOrders: [...state.clearOrders, { tiles: keys, work, done: 0 }],
      notice: `Ordered ${String(keys.length)} rock${keys.length === 1 ? '' : 's'} cleared: ${String(work)} s of work for a crew of ${String(CLEAR_CREW)}${queued > 0 ? `, after ${String(Math.ceil(queued))} s already ordered` : ''}.`,
    };
  }),

  cancelConstruction: (id) => set((state) => {
    const job = state.construction.find((other) => other.building === id);
    if (!job) return {};
    const { name } = BUILDING_INFO[id];
    const cost = buildingCost(id, job.level);
    const warehouse = { ...state.warehouse };
    const lost: string[] = [];
    for (const resource of RESOURCES) {
      const amount = cost.resources[resource] ?? 0;
      const room = Math.max(0, state.warehouseCapacity - warehouse[resource]);
      if (amount > room) lost.push(RESOURCE_INFO[resource].name.toLowerCase());
      warehouse[resource] = roundCoal(warehouse[resource] + Math.min(amount, room));
    }
    // A building that was never finished leaves its plot.
    const placements = { ...state.placements };
    const unbuilt = state.buildings[id] === 0 && isPlaceable(id);
    if (unbuilt) delete placements[id];
    return {
      gold: state.gold + cost.gold,
      warehouse,
      placements,
      construction: state.construction.filter((other) => other.building !== id),
      notice: `Stopped building the ${name}${unbuilt ? '' : ` (level ${String(job.level)})`}: its ${String(cost.gold)} gold and materials are back${lost.length > 0 ? `, but the warehouses had no room for all the ${lost.join(', ')}` : ''}.`,
    };
  }),

  destroyBuilding: (id) => set((state) => {
    const { name } = BUILDING_INFO[id];
    if (id === 'keep') return { notice: 'The Central Keep is the seat of the hold: it can’t be pulled down.' };
    const building = state.construction.some((job) => job.building === id);
    if (state.buildings[id] === 0 && !building) return { notice: `There is no ${name} to destroy.` };
    const refund = destroyRefund(state, id);
    const warehouse = { ...state.warehouse };
    const lost: string[] = [];
    for (const resource of RESOURCES) {
      const amount = refund.resources[resource] ?? 0;
      const room = Math.max(0, state.warehouseCapacity - warehouse[resource]);
      if (amount > room) lost.push(RESOURCE_INFO[resource].name.toLowerCase());
      warehouse[resource] = roundCoal(warehouse[resource] + Math.min(amount, room));
    }
    const placements = { ...state.placements };
    delete placements[id];
    // A forge's task goes with it; the piece on its anvil goes back to the stores.
    const forgeTasks = { ...state.forgeTasks };
    const items = { ...state.items };
    if (isForge(id)) {
      const task = forgeTasks[id];
      if (task) returnForgeGoods(task, warehouse, items, state.warehouse, state.warehouseCapacity);
      delete forgeTasks[id];
    }
    // A dwelling's gear goes back to the store.
    const dwellingGear = { ...state.dwellingGear };
    const dwelt = DWELLING_UNIT[id];
    if (dwelt) {
      items[UNIT_GEAR[dwelt]] += Math.floor(dwellingGear[dwelt] ?? 0);
      delete dwellingGear[dwelt];
    }
    // Without the depot every cart turns back; without the docks every barge leaves.
    let { wagonJobs, barges } = state;
    if (id === 'depot') {
      for (const job of wagonJobs) undoWagonTrip(job, { warehouse, items, forgeTasks, buildings: state.buildings, before: state.warehouse, capacity: state.warehouseCapacity });
      wagonJobs = [];
    }
    if (id === 'docks') barges = barges.map((barge) => (isWaiting(barge) ? turnBack(barge, state.elapsedSeconds) : barge));
    const back = [`${String(refund.gold)} gold`, ...RESOURCES.filter((resource) => refund.resources[resource]).map((resource) => `${String(refund.resources[resource])} ${RESOURCE_INFO[resource].name.toLowerCase()}`)];
    return {
      buildings: { ...state.buildings, [id]: 0 },
      construction: state.construction.filter((job) => job.building !== id),
      placements,
      paused: state.paused.filter((other) => other !== id),
      gold: state.gold + refund.gold,
      warehouse,
      items,
      forgeTasks,
      wagonJobs,
      barges,
      dwellingGear,
      notice: `The ${name} was pulled down: ${back.join(', ')} back.${lost.length > 0 ? ` The warehouses had no room for all the ${lost.join(', ')}.` : ''}`,
    };
  }),

  layTraps: (kind, tiles) => set((state) => {
    const info = TRAP_INFO[kind];
    let { gold, traps } = state;
    const warehouse = { ...state.warehouse };
    let laid = 0;
    let reason = '';
    for (const spot of tiles) {
      const blocker = trapBlocker({ gold, warehouse, traps }, kind, spot);
      if (blocker === 'Not enough resources.') {
        reason = ' Not enough resources for more.';
        break;
      }
      if (blocker) {
        reason = ` ${blocker}`;
        continue;
      }
      gold -= info.gold;
      for (const resource of RESOURCES) warehouse[resource] = roundCoal(warehouse[resource] - (info.resources[resource] ?? 0));
      traps = [...traps, { kind, x: spot.x, y: spot.y }];
      laid += 1;
    }
    if (laid === 0) return { notice: `${info.name}:${reason || ' nowhere to lay it.'}` };
    return {
      gold,
      warehouse,
      traps,
      notice: `${laid === 1 ? `${info.name} laid` : `${String(laid)} ${info.plural} laid`} in the trap belt.${reason}`,
    };
  }),

  layRoads: (kind, tiles) => set((state) => {
    const covered = coveredTiles(state.placements);
    const roads = { ...state.roads };
    let gold = state.gold;
    const warehouse = { ...state.warehouse };
    let done = 0;
    let reason = '';
    for (const spot of tiles) {
      const problem = roadProblem(spot, kind, roads, covered, state.clearedRocks);
      if (problem) continue;
      const key = mapTileKey(spot.x, spot.y);
      if (kind === 'erase') {
        delete roads[key];
        done += 1;
        continue;
      }
      const cost = ROAD_INFO[kind];
      if (!canAffordBuild({ gold, warehouse }, cost)) {
        reason = ' Not enough resources for more.';
        break;
      }
      gold -= cost.gold;
      for (const resource of RESOURCES) warehouse[resource] = roundCoal(warehouse[resource] - (cost.resources[resource] ?? 0));
      roads[key] = kind;
      done += 1;
    }
    if (done === 0) {
      if (kind === 'erase') return { notice: 'No roads there to take up.' };
      return { notice: reason ? `${ROAD_INFO[kind].name}:${reason}` : 'No road can go there: roads go on open ground inside the wall.' };
    }
    if (kind === 'erase') return { roads, notice: `Took up ${String(done)} road tile${done === 1 ? '' : 's'}.` };
    return {
      roads,
      gold,
      warehouse,
      notice: `Laid ${String(done)} tile${done === 1 ? '' : 's'} of ${ROAD_INFO[kind].name.toLowerCase()} for ${String(state.gold - gold)} gold${ROAD_INFO[kind].resources.granite ? ` and ${String(done * (ROAD_INFO[kind].resources.granite ?? 0))} granite` : ''}.${reason}`,
    };
  }),

  removeTrap: (spot) => set((state) => {
    const trap = trapAt(state.traps, spot.x, spot.y);
    if (!trap) return {};
    const refund = Math.floor(TRAP_INFO[trap.kind].gold * TRAP_REFUND);
    return {
      gold: state.gold + refund,
      traps: state.traps.filter((other) => other !== trap),
      notice: `${TRAP_INFO[trap.kind].name} taken up: ${String(refund)} gold back.`,
    };
  }),

  buyTech: (id) => set((state) => {
    const tech = TECHS[id];
    const blocker = techBlocker(state, id);
    if (blocker) return { notice: `${tech.name}: ${blocker}` };
    const techs = [...state.techs, id];
    return {
      gold: state.gold - techCost(state.techs, id),
      techs,
      // Bigger bins are added to the miners' bins straight away (they also grow with depth).
      veinCapacity: state.veinCapacity + (tech.bonus?.veinCapacity ?? 0),
      ...buildingFields(state.buildings, workforceOf(state).staff, techs, haulFactor(haulWalk(state))),
      notice: `Researched ${tech.name}: ${tech.effect}`,
    };
  }),

  digDeeper: () => set((state) => {
    if (state.depth >= MAX_DEPTH) return { notice: 'The mine has reached bedrock.' };
    const goldCost = getDepthCost(state.depth, state.techs);
    if (state.gold < goldCost) {
      return { notice: `The next shaft costs ${String(goldCost)} gold.` };
    }
    const depth = state.depth + 1;
    return {
      depth,
      gold: state.gold - goldCost,
      veinCapacity: state.veinCapacity + VEIN_CAPACITY_PER_DEPTH,
      layoutVersion: state.layoutVersion + 1,
      notice: `The miners opened gallery ${String(depth)}: room for ${String(MINE_STATIONS_PER_GALLERY)} more miners and a longer vein.`,
    };
  }),

  planDig: (keys) => set((state) => {
    // Re-check the whole run against the current mine, and stop at the first tile that breaks the
    // rock rule or can't be paid for.
    const layout = selectMineLayout(state);
    const planned = new Set(state.digPlan);
    const accepted: string[] = [];
    let gold = state.gold;
    let reason = '';
    for (const [index, key] of keys.entries()) {
      const parent = index === 0 ? findDigParent(layout, planned, key) : keys[index - 1];
      const check = parent ? checkDigStep(layout, planned, key, parent) : { ok: false as const, reason: 'Dig from the end of a tunnel.' };
      if (!check.ok) {
        reason = check.reason;
        break;
      }
      const cost = tileDigCost(state, parseKey(key).row);
      if (gold < cost) {
        reason = 'Not enough gold for the rest of the tunnel.';
        break;
      }
      gold -= cost;
      planned.add(key);
      accepted.push(key);
    }
    if (accepted.length === 0) return { notice: reason || 'Nothing to dig.' };
    const spent = state.gold - gold;
    return {
      gold,
      digPlan: [...state.digPlan, ...accepted],
      notice: `Ordered ${String(accepted.length)} tile${accepted.length === 1 ? '' : 's'} dug for ${String(spent)} gold.${reason ? ` ${reason}` : ''}`,
    };
  }),
}), {
  name: SAVE_KEY,
  version: SAVE_VERSION,
  storage: saveStorage,
  // Only a game that loaded the save (or found none) may write it; one that failed keeps its hands off.
  onRehydrateStorage: () => (_state, error) => {
    if (!error) {
      saveStorage.markLoaded();
      return;
    }
    console.error('Could not load the saved game; it is kept as it was and this game will not be saved.', error);
    useGameStore.setState({ notice: 'Your saved game couldn’t be loaded. It’s kept safe: this game won’t be saved over it.' });
  },
  // The app entry loads the save once storage is ready (see `loadGame`).
  skipHydration: true,
  partialize: (state) => Object.fromEntries(Object.entries(state).filter(([, value]) => typeof value !== 'function')) as SavedState,
  // The merge below fills in anything a migrated save lacks.
  migrate: (persisted, version) => migrateSave(persisted as Partial<SavedState> | undefined, version) as SavedState,
  merge: (persisted, current) => mergeSave(persisted as Partial<SavedState> | undefined, current),
}));

/** An order from when the armory made all the gear (paid up front); kept only to pay older saves back. */
type LegacyCraftJob = { count: number; made?: number; paid?: { resources?: Record<string, number>; used?: Record<string, number> } };

// Lay a save over a fresh game. Records are merged key by key, so a save from an older version still gets
// any buildings, units or resources added since; stats that follow from building levels are recomputed.
function mergeSave(saved: Partial<SavedState> | undefined, fresh: GameState): GameState {
  if (!saved) return fresh;
  const stock = (key: 'vein' | 'mineExit' | 'mineStock' | 'warehouse') => ({ ...emptyStock(), ...saved[key] });
  const buildings = { ...fresh.buildings, ...saved.buildings };
  // Techs this version doesn't know (or doubles) are dropped.
  const techs = [...new Set((saved.techs ?? []).filter(isTechId))];
  const placements = fillPlacements(
    buildings,
    (saved.construction ?? []).map((job) => job.building),
    validPlacements(saved.placements ?? {}, BUILDING_NAMES),
    BUILDING_NAMES,
  );
  // Traps that no longer fit the belt (or aren't traps) are dropped; ones the river took when it came up
  // to the wall on the far side are paid back in full.
  const washedAway = { count: 0, gold: 0 };
  const traps = (saved.traps ?? []).reduce<Trap[]>((laid, trap) => {
    if (!TRAP_KINDS.includes(trap.kind)) return laid;
    if (!trapProblem(trap, laid)) return [...laid, { kind: trap.kind, x: trap.x, y: trap.y }];
    if (zoneAt(trap.x, trap.y) === 'water') {
      washedAway.count += 1;
      washedAway.gold += TRAP_INFO[trap.kind].gold;
    }
    return laid;
  }, []);
  let roads = startingRoads(placements);
  if (saved.roads) {
    const covered = coveredTiles(placements);
    roads = {};
    for (const [key, kind] of Object.entries(saved.roads)) {
      const [x, y] = key.split(',').map(Number);
      if (isRoadKind(kind) && !roadProblem({ x, y }, kind, roads, covered)) roads[key] = kind;
    }
  }
  // Saves from before the rocks: the ground under every building, building site and road counts as
  // cleared, so the hold stands as it was (the rest of the town is rocky now).
  const cleared = new Set((saved.clearedRocks ?? []).filter((key) => typeof key === 'string'));
  for (const key of [...coveredTiles(placements), ...Object.keys(roads)]) {
    const [x, y] = key.split(',').map(Number);
    if (startingRock(x, y)) cleared.add(key);
  }
  const clearedRocks = [...cleared];
  const stillRocky = (key: string) => {
    const [x, y] = key.split(',').map(Number);
    return rockAt(clearedRocks, x, y) > 0;
  };
  const clearOrders = (saved.clearOrders ?? [])
    .map((order) => ({ ...order, tiles: order.tiles.filter(stillRocky) }))
    .filter((order) => order.tiles.length > 0);
  const elapsedSeconds = saved.elapsedSeconds ?? 0;
  const items: ItemStock = { ...emptyItems(), ...Object.fromEntries(Object.entries(saved.items ?? {}).filter(([item, n]) => isItemId(item) && typeof n === 'number')) };
  // Gear at the dwellings. Saves from before gear was made start with a new game's pikes; saves from before
  // carts delivered gear have each unit's gear in the store moved out to its dwelling (if it's built).
  let dwellingGear: Partial<Record<ArmyUnit, number>> = {};
  if (saved.dwellingGear) {
    for (const unit of ARMY_UNITS) if ((saved.dwellingGear[unit] ?? 0) > 0) dwellingGear[unit] = Math.floor(saved.dwellingGear[unit] ?? 0);
  } else if (!saved.items) {
    dwellingGear = { ...fresh.dwellingGear };
  } else {
    for (const unit of ARMY_UNITS) {
      const gear = UNIT_GEAR[unit];
      if ((buildings[ARMY_RECRUITING[unit].dwelling] ?? 0) > 0 && items[gear] >= 1) {
        dwellingGear[unit] = Math.floor(items[gear]);
        items[gear] -= Math.floor(items[gear]);
      }
    }
  }
  const warehouse = stock('warehouse');
  // Orders from when the armory made all the gear itself: what wasn't made yet is paid back.
  const legacyQueue = (saved as { craftQueue?: LegacyCraftJob[] }).craftQueue ?? [];
  for (const job of legacyQueue) {
    if (!job.paid || !(job.count > 0)) continue;
    const share = Math.max(0, (job.count - (job.made ?? 0)) / job.count);
    for (const [resource, n] of Object.entries(job.paid.resources ?? {})) {
      if (RESOURCES.includes(resource as Resource)) warehouse[resource as Resource] += Math.floor(n * share);
    }
    for (const [item, n] of Object.entries(job.paid.used ?? {})) if (isItemId(item)) items[item] += Math.floor(n * share);
  }
  // Tasks for forges and items this version knows.
  const forgeTasks: ForgeTasks = {};
  for (const [forge, task] of Object.entries(saved.forgeTasks ?? {})) {
    if (!isForge(forge) || !task || !isItemId(task.item)) continue;
    const target = (FORGE_TARGETS as readonly number[]).includes(task.target) ? task.target : DEFAULT_FORGE_TARGET;
    const shelf: Load = emptyLoad();
    for (const [resource, n] of Object.entries(task.stock?.resources ?? {})) if (RESOURCES.includes(resource as Resource) && n > 0) shelf.resources[resource as Resource] = n;
    for (const [item, n] of Object.entries(task.stock?.items ?? {})) if (isItemId(item) && n > 0) shelf.items[item] = n;
    forgeTasks[forge] = { item: task.item, target, done: task.done || 0, loaded: !!task.loaded, stock: shelf, output: Math.max(0, Math.floor(task.output || 0)) };
  }
  // Saves from before peasants counted only miners.
  const oldMiners = (saved as { miners?: number }).miners;
  const merged: GameState = {
    ...fresh,
    ...saved,
    vein: stock('vein'),
    mineExit: stock('mineExit'),
    mineStock: stock('mineStock'),
    warehouse,
    army: saved.army ? { ...emptyArmy(), ...saved.army } : fresh.army,
    recruits: saved.recruits ? { ...emptyArmy(), ...saved.recruits } : fresh.recruits,
    ...buildingFields(buildings, undefined, techs, haulFactor(haulWalk({ placements, roads, clearedRocks }))),
    techs,
    population: saved.population ?? Math.max(fresh.population, (oldMiners ?? 0) + 8),
    paused: saved.paused ?? [],
    construction: (saved.construction ?? []).map((job) => ({ ...job, crew: job.crew ?? crewSize(job.level) })),
    // Saves from before buildings were placed: every existing building gets a spot.
    placements,
    // Saves from before roads were laid by hand start with the old dirt roads; roads under a building
    // (or off the town's open ground) are dropped.
    roads,
    clearedRocks,
    clearOrders,
    items,
    forgeTasks,
    // Carts out on trips (they finish them; anything odd is dropped).
    // (Trips saved before carts went to dwellings named their forge `forge`.)
    wagonJobs: (saved.wagonJobs ?? [])
      .map((job) => ({ ...job, site: job.site ?? (job as { forge?: BuildingId }).forge }) as WagonJob)
      .filter(
        (job) =>
          (job.kind === 'supply' || job.kind === 'collect' || job.kind === 'deliver') &&
          (BUILDING_IDS as readonly string[]).includes(job.site) &&
          isItemId(job.item) &&
          Array.isArray(job.legs) &&
          job.legs.length === 3 &&
          typeof job.startedAt === 'number',
      ),
    dwellingGear,
    wagonSerial: saved.wagonSerial ?? 0,
    // Barges still waiting with their orders (older saves had one barge on a timetable: none wait yet).
    barges: (saved.barges ?? [])
      .filter((barge) => isWaiting(barge) && RESOURCES.includes(barge.resource) && barge.wants > 0 && barge.berth >= 0 && barge.berth < BERTHS.length)
      .filter((barge, index, all) => all.findIndex((other) => other.berth === barge.berth) === index)
      .slice(0, MAX_BARGES),
    nextBargeAt: saved.nextBargeAt ?? elapsedSeconds + 5,
    bargeSerial: saved.bargeSerial ?? 0,
    traps,
    gold: (saved.gold ?? fresh.gold) + washedAway.gold,
    // A battle left open when the game closed waits a little for its commander, then fights itself.
    battleCommanded: false,
    // Saves from before the losing streak was kept count it from the last raid.
    raidsLostInARow: saved.raidsLostInARow ?? (saved.raidReport?.outcome === 'lost' ? 1 : 0),
    battleDeadline: saved.battle?.status === 'active' ? elapsedSeconds + RAID_AUTO_AFTER : (saved.battleDeadline ?? 0),
  };
  // The old timed barge's bookkeeping.
  for (const key of ['shipVisit', 'shipSold', 'craftQueue']) delete (merged as Record<string, unknown>)[key];
  // A raid sighted under older, harsher rules (well beyond what the hold's power now calls for) is sized afresh.
  const { raid } = merged;
  if (raid && merged.battle?.status !== 'active') {
    const strength = raidStrength(raid.number, holdPowerOf(merged).total, merged.raidsLostInARow);
    if (partyValue(raid.party) > strength * 1.2) merged.raid = { ...raid, party: raidParty(raid.number, strength) };
  }
  if (washedAway.count > 0) {
    merged.notice = `The river now runs up to the far wall: its ${String(washedAway.count)} trap${washedAway.count === 1 ? '' : 's'} on that side were paid back (${String(washedAway.gold)} gold).`;
  }
  return merged;
}

// Older saves, step by step: version 1 placed buildings on a 32-tile map, which then grew outer rings
// (raiders, traps, moat, wall), so everything moved in by the same amount; version 2 was on the 47-tile
// map, which then grew 6 tiles on every side (`grownMap`).
function migrateSave(saved: Partial<SavedState> | undefined, version: number): Partial<SavedState> {
  if (!saved) return {};
  let next = saved;
  if (version < 2 && next.placements) {
    const placements: Placements = {};
    for (const [id, spot] of Object.entries(next.placements) as [BuildingId, Spot][]) {
      placements[id] = { x: spot.x + OLD_MAP_SHIFT, y: spot.y + OLD_MAP_SHIFT };
    }
    next = { ...next, placements };
  }
  if (version < 3) next = grownMap(next);
  return next;
}

// The town and everything in it (buildings, roads, cleared and ordered rocks) moves in with the grown map;
// traps keep their place in the belt on their own side.
function grownMap(saved: Partial<SavedState>): Partial<SavedState> {
  const move = (key: string) => {
    const [x, y] = key.split(',').map(Number);
    return mapTileKey(x + GROWN_MAP_SHIFT, y + GROWN_MAP_SHIFT);
  };
  const next = { ...saved };
  if (saved.placements) {
    next.placements = Object.fromEntries(
      (Object.entries(saved.placements) as [BuildingId, Spot][]).map(([id, spot]) => [id, { x: spot.x + GROWN_MAP_SHIFT, y: spot.y + GROWN_MAP_SHIFT }]),
    );
  }
  if (saved.roads) {
    const roads: Roads = Object.fromEntries(Object.entries(saved.roads).map(([key, kind]) => [move(key), kind]));
    // A road that ran down to the gate (or nearly) is carried on to where the gate is now.
    let end: { y: number; kind: RoadKind } | null = null;
    for (const [key, kind] of Object.entries(roads)) {
      const [x, y] = key.split(',').map(Number);
      if (x === GATE_ROAD.x && y < CASTLE.y1 && (!end || y > end.y)) end = { y, kind };
    }
    if (end && end.y >= CASTLE.y1 - 1 - GROWN_MAP_SHIFT - 3) {
      for (let y = end.y + 1; y < CASTLE.y1; y++) roads[mapTileKey(GATE_ROAD.x, y)] = end.kind;
    }
    next.roads = roads;
  }
  if (saved.clearedRocks) next.clearedRocks = saved.clearedRocks.map(move);
  if (saved.clearOrders) next.clearOrders = saved.clearOrders.map((order) => ({ ...order, tiles: order.tiles.map(move) }));
  if (saved.traps) next.traps = saved.traps.map((trap) => ({ ...trap, x: grownCoordinate(trap.x), y: grownCoordinate(trap.y) }));
  return next;
}

/** Load the saved game (call once storage is ready, before the simulation starts). */
export function loadGame() {
  return useGameStore.persist.rehydrate();
}

// Pay for the next level of a building and put a crew on it.
function startBuilding(state: GameState, id: BuildingId): Partial<GameState> {
  const level = state.buildings[id] + 1;
  const cost = buildingCost(id, level);
  const warehouse = { ...state.warehouse };
  for (const resource of RESOURCES) warehouse[resource] = roundCoal(warehouse[resource] - (cost.resources[resource] ?? 0));
  const duration = buildingTime(level);
  return {
    gold: state.gold - cost.gold,
    warehouse,
    construction: [...state.construction, { building: id, level, progress: 0, duration, crew: crewSize(level) }],
    notice: `A crew of ${String(crewSize(level))} peasants started on the ${BUILDING_INFO[id].name} (level ${String(level)}, ${String(duration)} s).`,
  };
}

let simulationTimer: ReturnType<typeof setInterval> | undefined;

export function startSimulation() {
  if (simulationTimer) return () => {};

  simulationTimer = setInterval(() => {
    useGameStore.getState().tick();
  }, FIXED_TICK_MS);

  return () => {
    if (simulationTimer) clearInterval(simulationTimer);
    simulationTimer = undefined;
  };
}

