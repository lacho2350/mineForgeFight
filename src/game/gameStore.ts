import { create } from 'zustand';
import { MINE_GALLERY_COUNT, MINE_STATIONS } from '../components/MineMapLayout';
import { cartEventsBetween, cartsOnLevel, getCartRoutes, type LevelCarts } from './haulage';
import { RESOURCES, RESOURCE_INFO, RESOURCE_PRICE, emptyStock, type Resource, type Stock } from './resources';
import {
  BUILDING_INFO,
  MAX_BUILDING_LEVEL,
  STARTING_BUILDINGS,
  buildingCost,
  buildingStats,
  buildingTime,
  requiredKeep,
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
  emptyArmy,
  unitGrowth,
  type Army,
  type ArmyUnit,
} from './units';
import { act, battleOutcome, createBattle, resolveBattle, stepAI, type Battle, type BattleAction } from './combat';
import {
  FIRST_RAID_AT,
  PLUNDER_SHARE,
  RAID_AUTO_AFTER,
  RAID_INTERVAL,
  RAID_WARNING,
  raidBounty,
  raidParty,
  type RaidParty,
} from './raids';
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
  nextFreeSite,
  tileKey,
  parseKey,
  siteLevel,
  stationKey,
  stationSite,
  type MineLayout,
  type Site,
} from './mineLayout';

export const FIXED_TICK_MS = 1000;
export const COAL_REQUEST_SIZE = 20;
export const COAL_REQUEST_REWARD = 32;
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
export type Construction = { building: BuildingId; level: number; progress: number; duration: number };

/** Raiders on their way: sighted at first, then at the gate. */
export type Raid = { number: number; arrivesAt: number; party: RaidParty };

/** What came of a raid. */
export type RaidReport = {
  number: number;
  outcome: 'won' | 'lost' | 'withdrawn';
  bounty: number;
  losses: Partial<Record<ArmyUnit, number>>;
  slain: number;
  plundered: { gold: number; resources: Partial<Stock> } | null;
};

/** What a level's cart is carrying. */
export type CartLoad = { resource: Resource; amount: number };

type GameState = {
  elapsedSeconds: number;
  depth: number;
  gold: number;
  miners: number;
  minerRate: number;
  /** Level of every stronghold building (0 = not built yet). */
  buildings: BuildingLevels;
  /** Buildings the builders are working on, at most one per builder. */
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
  /** Units the surface wagons move per tick on each leg (mine exit → mine → warehouse). */
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
  notice: string;
  tick: () => void;
  fulfillCoalRequest: () => void;
  /** Start building the next level of a building (paid now, finished by the builders over time). */
  upgradeBuilding: (id: BuildingId) => void;
  digDeeper: () => void;
  /** Order a connected run of tiles dug; charged now, dug over time. */
  planDig: (keys: string[]) => void;
  /** Put an idle miner to work on the deposit at `key`. */
  assignMiner: (key: string) => void;
  /** Take the miner off the deposit at `key`; they become idle. */
  releaseMiner: (key: string) => void;
  /** Buy another cart and hauler for a level. */
  buyCart: (level: number) => void;
  /** Sell whole units of a resource from the warehouse at the trading post market. */
  sellResource: (resource: Resource, amount: number | 'all') => void;
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
};

const roundCoal = (amount: number) => Math.round(amount * 10) / 10;

// Grows steadily rather than exponentially, so the 450-gallery mine stays reachable.
export function getDepthCost(depth: number) {
  return Math.round(100 + 60 * (depth - 1) ** 1.35);
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
  state: Pick<GameState, 'buildings' | 'construction' | 'warehouse' | 'gold' | 'warehouseCapacity'>,
  id: BuildingId,
): string | null {
  const level = state.buildings[id];
  const stats = buildingStats(state.buildings);
  if (level >= MAX_BUILDING_LEVEL) return 'Fully built.';
  if (state.construction.some((job) => job.building === id)) return 'Already under construction.';
  if (id !== 'keep' && level >= stats.maxLevel) return `Raise the Central Keep to level ${String(level + 1)} first.`;
  if (level === 0 && state.buildings.keep < requiredKeep(id)) return `Needs the Central Keep at level ${String(requiredKeep(id))}.`;
  if (state.construction.length >= stats.builders) {
    return `All ${String(stats.builders)} builder${stats.builders === 1 ? ' is' : 's are'} busy.`;
  }
  const cost = buildingCost(id, level + 1);
  const tooBig = RESOURCES.find((resource) => (cost.resources[resource] ?? 0) > state.warehouseCapacity);
  if (tooBig) {
    return `Needs ${(cost.resources[tooBig] ?? 0).toLocaleString()} ${RESOURCE_INFO[tooBig].name.toLowerCase()}, but the warehouses hold only ${state.warehouseCapacity.toLocaleString()} each.`;
  }
  if (!canAffordBuild(state, cost)) return 'Not enough resources yet.';
  return null;
}

/** Gold to dig a tile on `row`, after the research facility's discount. */
export function tileDigCost(state: Pick<GameState, 'buildings'>, row: number) {
  return Math.max(1, Math.round(digCost(row) * buildingStats(state.buildings).digCostFactor));
}

/** Gold to dig a whole route, after the research facility's discount. */
export function tunnelCost(state: Pick<GameState, 'buildings'>, route: string[]) {
  return route.reduce((sum, key) => sum + tileDigCost(state, parseKey(key).row), 0);
}

/** What the trading post pays per unit, with the gate's caravan bonus. */
export function sellPrice(state: Pick<GameState, 'buildings'>, resource: Resource) {
  return Math.round(RESOURCE_PRICE[resource] * (1 + buildingStats(state.buildings).tradeBonus) * 100) / 100;
}

export function coalRequestReward(state: Pick<GameState, 'buildings'>) {
  return Math.round(COAL_REQUEST_REWARD * (1 + buildingStats(state.buildings).tradeBonus));
}

/** Can this unit be recruited (its dwelling is built and the keep is high enough)? */
export function unitAvailable(state: Pick<GameState, 'buildings'>, unit: ArmyUnit) {
  const { dwelling, requiresKeep } = ARMY_RECRUITING[unit];
  return state.buildings[dwelling] >= 1 && state.buildings.keep >= requiresKeep;
}

/** How many of a unit the treasury and warehouse can pay for. */
export function affordableRecruits(state: Pick<GameState, 'gold' | 'warehouse'>, unit: ArmyUnit) {
  const { gold, resources } = ARMY_RECRUITING[unit];
  let count = Math.floor(state.gold / gold);
  for (const resource of RESOURCES) {
    const each = resources[resource] ?? 0;
    if (each > 0) count = Math.min(count, Math.floor(state.warehouse[resource] / each));
  }
  return count;
}

export function describeParty(party: RaidParty) {
  return party.map(({ unit, count }) => `${String(count)} ${(count === 1 ? UNIT_STATS[unit].name : UNIT_STATS[unit].plural).toLowerCase()}`).join(', ');
}

type SettleState = Pick<GameState, 'gold' | 'warehouse' | 'army' | 'battleArmy' | 'elapsedSeconds' | 'raid' | 'raidsFought'>;

// A battle just ended: survivors rejoin the army, and the bounty is paid or the plunder taken.
function settleBattle(state: SettleState, battle: Battle) {
  const { survivors, losses, slain } = battleOutcome(battle, state.battleArmy);
  const army = { ...state.army };
  for (const unit of ARMY_UNITS) army[unit] = Math.max(0, army[unit] - state.battleArmy[unit] + survivors[unit]);
  const number = state.raid?.number ?? battle.raid;
  const report: RaidReport = { number, outcome: battle.status === 'won' ? 'won' : battle.status === 'lost' ? 'lost' : 'withdrawn', bounty: 0, losses, slain, plundered: null };
  let { gold, warehouse } = state;
  let notice: string;
  if (report.outcome === 'won') {
    report.bounty = raidBounty(number);
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

// The state fields that follow from building levels.
function buildingFields(buildings: BuildingLevels) {
  const stats = buildingStats(buildings);
  return {
    buildings,
    minerRate: stats.minerRate,
    mineCartCapacity: stats.mineCartCapacity,
    warehouseCapacity: stats.warehouseCapacity,
    mineCapacity: stats.mineCapacity,
    mineExitCapacity: stats.mineCapacity,
    surfaceHaul: stats.surfaceHaul,
  };
}

type HireState = Pick<GameState, 'miners' | 'sites' | 'openedStations' | 'layoutVersion' | 'depth' | 'playerDug' | 'depositMined'>;

// New miners move into the houses and go straight to an open face if there is one.
function hireMiners(state: HireState, count: number) {
  let next = { miners: state.miners, sites: state.sites, openedStations: state.openedStations, layoutVersion: state.layoutVersion };
  let placed = 0;
  for (let i = 0; i < count; i++) {
    next.miners += 1;
    const site = nextFreeSite(selectMineLayout({ ...state, ...next }));
    if (!site) continue;
    next = { ...next, ...withSite(next, site) };
    placed += 1;
  }
  return { fields: next, placed };
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

/** Price of the next cart for a level that already has `current` carts. */
export function cartCost(current: number): Cost {
  const scale = 1.6 ** Math.max(0, current - 1);
  return { coal: Math.round(25 * scale), gold: Math.round(40 * scale) };
}

/** Working miners on each level (a level can use at most one cart per miner). */
export function minersByLevel(sites: Site[]) {
  const counts = new Map<number, number>();
  for (const site of sites) counts.set(siteLevel(site), (counts.get(siteLevel(site)) ?? 0) + 1);
  return counts;
}

export function idleMiners(state: Pick<GameState, 'miners' | 'sites' | 'pendingSites'>) {
  return Math.max(0, state.miners - state.sites.length - state.pendingSites.length);
}

/** The resource a miner's site produces. */
export function siteResource(site: Site): Resource {
  return depositAt(site.faceRow, site.faceColumn) ?? 'coal';
}

const startingSites = [stationSite(-1, 0), stationSite(-1, 1)];
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

export const useGameStore = create<GameState>((set) => ({
  elapsedSeconds: 0,
  depth: 1,
  gold: 120,
  miners: startingStats.beds,
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
  recruits: { ...emptyArmy(), pikeman: 7 },
  nextRaidAt: FIRST_RAID_AT,
  raid: null,
  battle: null,
  battleArmy: emptyArmy(),
  battleCommanded: false,
  battleDeadline: 0,
  raidReport: null,
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
        ? 'A deposit is mined out. Its miner is idle: tap another deposit to assign them.'
        : `${String(exhausted.length)} deposits are mined out. Their miners are idle.`;
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
      digProgress = roundCoal(digProgress + buildingStats(state.buildings).digSpeed);
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

    // Builders: each job advances a second; finished levels take effect at once.
    let { buildings, construction } = state;
    let built: Partial<GameState> = {};
    let gold = state.gold;
    if (construction.length > 0) {
      construction = construction.map((job) => ({ ...job, progress: job.progress + 1 }));
      const finished = construction.filter((job) => job.progress >= job.duration);
      if (finished.length > 0) {
        construction = construction.filter((job) => job.progress < job.duration);
        buildings = { ...buildings };
        for (const job of finished) buildings[job.building] = job.level;
        built = buildingFields(buildings);
        const job = finished[0];
        notice = `${BUILDING_INFO[job.building].name} reached level ${String(job.level)}.`;
        const newBeds = buildingStats(buildings).beds - state.miners;
        if (newBeds > 0) {
          const hired = hireMiners({ ...state, sites, layoutVersion }, newBeds);
          sites = hired.fields.sites;
          layoutVersion = hired.fields.layoutVersion;
          built = { ...built, miners: hired.fields.miners, openedStations: hired.fields.openedStations };
          const waiting = newBeds - hired.placed;
          notice += ` ${String(newBeds)} new miner${newBeds === 1 ? '' : 's'} moved in${waiting > 0 ? `; ${String(waiting)} wait for work, so tap a deposit in the mine to assign them` : ' and started work'}.`;
        }
      }
    }
    // The keep collects taxes every five seconds.
    const elapsedSeconds = state.elapsedSeconds + 1;
    if (elapsedSeconds % 5 === 0) gold += buildingStats(buildings).taxPerFiveSeconds;

    // Dwellings: new recruits trickle in over each muster, and wait (up to a few musters' worth).
    const recruits = { ...state.recruits };
    for (const unit of ARMY_UNITS) {
      if (!unitAvailable({ buildings }, unit)) continue;
      const growth = unitGrowth(unit, buildings[ARMY_RECRUITING[unit].dwelling]);
      recruits[unit] = Math.min(growth * MAX_MUSTERS_WAITING, Math.round((recruits[unit] + growth / MUSTER_SECONDS) * 1000) / 1000);
    }

    // Raids: sighted a minute out, then a battle at the gate. Nobody in command? It fights itself.
    let raidFields: Partial<GameState> = {};
    const { raid, battle } = state;
    const battleRunning = battle?.status === 'active';
    if (!raid && !battleRunning && elapsedSeconds + RAID_WARNING >= state.nextRaidAt) {
      const number = state.raidsFought + 1;
      const party = raidParty(number);
      raidFields = { raid: { number, arrivesAt: state.nextRaidAt, party } };
      notice = `Raiders sighted: ${describeParty(party)}. They reach the gate in ${String(state.nextRaidAt - elapsedSeconds)} s.`;
    } else if (raid && !battleRunning && elapsedSeconds >= raid.arrivesAt) {
      const stats = buildingStats(buildings);
      raidFields = {
        battle: createBattle({
          raid: raid.number,
          army: state.army,
          enemies: raid.party,
          wallHp: stats.wallHp,
          gateHp: stats.gateHp,
          towers: stats.towers,
          towerDamage: stats.towerDamage,
          attackBonus: stats.attackBonus,
          defenceBonus: stats.defenceBonus,
        }),
        battleArmy: state.army,
        battleCommanded: false,
        battleDeadline: elapsedSeconds + RAID_AUTO_AFTER,
      };
      notice = `Raiders at the gate! Take command, or the defence fights on its own in ${String(RAID_AUTO_AFTER)} s.`;
    } else if (battle && battleRunning && !state.battleCommanded && elapsedSeconds >= state.battleDeadline) {
      const settled = settleBattle({ ...state, gold, warehouse: toStore.to, elapsedSeconds }, resolveBattle(battle));
      raidFields = { ...settled, battle: null };
      notice = settled.notice;
    }

    return {
      ...built,
      construction,
      gold,
      elapsedSeconds,
      digPlan,
      digProgress,
      playerDug,
      pendingSites,
      layoutVersion,
      sites,
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

  fulfillCoalRequest: () => set((state) => {
    if (state.warehouse.coal < COAL_REQUEST_SIZE) {
      return { notice: `The request needs ${String(COAL_REQUEST_SIZE)} coal in the warehouse.` };
    }
    return {
      warehouse: { ...state.warehouse, coal: roundCoal(state.warehouse.coal - COAL_REQUEST_SIZE) },
      gold: state.gold + coalRequestReward(state),
      notice: `Delivered ${String(COAL_REQUEST_SIZE)} coal. The trading post paid ${String(coalRequestReward(state))} gold.`,
    };
  }),

  assignMiner: (key) => set((state) => {
    if (idleMiners(state) <= 0) return { notice: 'No idle miners. Build a miner hut, or release a miner from another deposit.' };
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
      return {
        gold: state.gold - cost,
        digPlan: [...state.digPlan, ...route],
        pendingSites: [
          ...state.pendingSites,
          { row: stand.row, column: stand.column, faceRow: info.row, faceColumn: info.column, kind: 'deposit' as const },
        ],
        notice: `Digging ${String(route.length)} tile${route.length === 1 ? '' : 's'} to the ${RESOURCE_INFO[info.deposit ?? 'coal'].deposit.toLowerCase()} for ${String(cost)} gold. A miner will start when it’s through.`,
      };
    }
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
      return { pendingSites, notice: 'The miner won’t wait for that tunnel and is idle.' };
    }
    const sites = state.sites.filter((site) => !(site.faceRow === row && site.faceColumn === column));
    if (sites.length === state.sites.length) return {};
    return { sites, layoutVersion: state.layoutVersion + 1, notice: 'The miner left the deposit and is idle.' };
  }),

  buyCart: (level) => set((state) => {
    const current = cartsOnLevel(state.carts, level);
    const miners = minersByLevel(state.sites).get(level) ?? 0;
    if (current >= miners) {
      return { notice: 'That level already has a cart for every miner. Add miners first.' };
    }
    const cost = cartCost(current);
    if (!canAfford(state, cost)) {
      return { notice: `Another cart costs ${String(cost.coal)} coal and ${String(cost.gold)} gold.` };
    }
    return {
      warehouse: { ...state.warehouse, coal: roundCoal(state.warehouse.coal - cost.coal) },
      gold: state.gold - cost.gold,
      carts: { ...state.carts, [level]: current + 1 },
      notice: `A new cart and hauler joined ${level < 0 ? 'the entrance level' : `gallery ${String(level + 1)}`} (${String(current + 1)} carts).`,
    };
  }),

  sellResource: (resource, amount) => set((state) => {
    const available = Math.floor(state.warehouse[resource]);
    const units = amount === 'all' ? available : Math.min(available, Math.floor(amount));
    const { name } = RESOURCE_INFO[resource];
    if (units <= 0) return { notice: `There is no ${name.toLowerCase()} in the warehouse to sell.` };
    const earned = Math.floor(units * sellPrice(state, resource));
    return {
      warehouse: { ...state.warehouse, [resource]: roundCoal(state.warehouse[resource] - units) },
      gold: state.gold + earned,
      notice: `Sold ${units.toLocaleString()} ${name.toLowerCase()} at the trading post for ${earned.toLocaleString()} gold.`,
    };
  }),

  recruit: (unit, amount) => set((state) => {
    const stats = UNIT_STATS[unit];
    if (!unitAvailable(state, unit)) return { notice: `${stats.plural} can't be recruited yet.` };
    const waiting = Math.floor(state.recruits[unit]);
    const count = Math.min(waiting, affordableRecruits(state, unit), amount === 'max' ? Infinity : amount);
    if (count <= 0) {
      return { notice: waiting <= 0 ? `No ${stats.plural.toLowerCase()} are waiting to be recruited.` : `You can't afford any ${stats.plural.toLowerCase()}.` };
    }
    const { gold, resources } = ARMY_RECRUITING[unit];
    const warehouse = { ...state.warehouse };
    for (const resource of RESOURCES) warehouse[resource] = roundCoal(warehouse[resource] - (resources[resource] ?? 0) * count);
    return {
      gold: state.gold - gold * count,
      warehouse,
      army: { ...state.army, [unit]: state.army[unit] + count },
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

  upgradeBuilding: (id) => set((state) => {
    const blocker = upgradeBlocker(state, id);
    const { name } = BUILDING_INFO[id];
    if (blocker) return { notice: `${name}: ${blocker}` };
    const level = state.buildings[id] + 1;
    const cost = buildingCost(id, level);
    const warehouse = { ...state.warehouse };
    for (const resource of RESOURCES) warehouse[resource] = roundCoal(warehouse[resource] - (cost.resources[resource] ?? 0));
    const duration = buildingTime(level);
    return {
      gold: state.gold - cost.gold,
      warehouse,
      construction: [...state.construction, { building: id, level, progress: 0, duration }],
      notice: `Builders started on the ${name} (level ${String(level)}, ${String(duration)} s).`,
    };
  }),

  digDeeper: () => set((state) => {
    if (state.depth >= MAX_DEPTH) return { notice: 'The mine has reached bedrock.' };
    const goldCost = getDepthCost(state.depth);
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
}));

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

