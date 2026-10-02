import { create } from 'zustand';
import { MINE_GALLERY_COUNT, MINE_STATIONS } from '../components/MineMapLayout';
import { cartEventsBetween, getCartRoutes } from './haulage';
import { RESOURCES, RESOURCE_INFO, RESOURCE_PRICE, emptyStock, type Resource, type Stock } from './resources';
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
  routeCost,
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
export const MAX_PICKAXE_LEVEL = 4;
export const VEIN_CAPACITY_PER_DEPTH = 25;
export const MINE_STATIONS_PER_GALLERY = MINE_STATIONS.length;

export const COSTS = {
  minerHut: { coal: 30, gold: 20 },
  pickaxe: { coal: 20, gold: 35 },
  warehouse: { coal: 40, gold: 30 },
} as const;

type Cost = { coal: number; gold: number };

type TickFlow = {
  mined: number;
  toMineExit: number;
  toMineStockpile: number;
  toWarehouse: number;
};

/** What a level's cart is carrying. */
export type CartLoad = { resource: Resource; amount: number };

type GameState = {
  elapsedSeconds: number;
  depth: number;
  gold: number;
  miners: number;
  minerRate: number;
  pickaxeLevel: number;
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
  warehouseCartCapacity: number;
  huts: number;
  warehouseUpgrades: number;
  lastFlow: TickFlow;
  /** Seconds of cart movement; only advances while the mine exit has room for another load. */
  haulTime: number;
  /** Haul time up to which cart loads and tips have already been applied. */
  haulAppliedTime: number;
  /** What each level's cart carries, keyed by level (-1 is the entrance level). */
  cartLoads: Record<number, CartLoad>;
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
  notice: string;
  tick: () => void;
  fulfillCoalRequest: () => void;
  buildMinerHut: () => void;
  forgePickaxe: () => void;
  expandWarehouse: () => void;
  digDeeper: () => void;
  /** Order a connected run of tiles dug; charged now, dug over time. */
  planDig: (keys: string[]) => void;
  /** Put an idle miner to work on the deposit at `key`. */
  assignMiner: (key: string) => void;
  /** Take the miner off the deposit at `key`; they become idle. */
  releaseMiner: (key: string) => void;
  /** Sell whole units of a resource from the warehouse at the trading post market. */
  sellResource: (resource: Resource, amount: number | 'all') => void;
};

const roundCoal = (amount: number) => Math.round(amount * 10) / 10;

// Grows steadily rather than exponentially, so the 450-gallery mine stays reachable.
export function getDepthCost(depth: number) {
  return Math.round(100 + 60 * (depth - 1) ** 1.35);
}

export function canAfford(state: Pick<GameState, 'warehouse' | 'gold'>, cost: Cost) {
  return state.warehouse.coal >= cost.coal && state.gold >= cost.gold;
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

export function idleMiners(state: Pick<GameState, 'miners' | 'sites' | 'pendingSites'>) {
  return Math.max(0, state.miners - state.sites.length - state.pendingSites.length);
}

/** The resource a miner's site produces. */
export function siteResource(site: Site): Resource {
  return depositAt(site.faceRow, site.faceColumn) ?? 'coal';
}

const startingSites = [stationSite(-1, 0), stationSite(-1, 1)];

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
  miners: 2,
  minerRate: 0.5,
  pickaxeLevel: 1,
  vein: emptyStock(),
  mineExit: emptyStock(),
  mineStock: emptyStock(),
  warehouse: { ...emptyStock(), coal: 16 },
  veinCapacity: 50,
  mineExitCapacity: 50,
  mineCapacity: 50,
  warehouseCapacity: 100,
  mineCartCapacity: 12,
  warehouseCartCapacity: 10,
  huts: 1,
  warehouseUpgrades: 0,
  lastFlow: { mined: 0, toMineExit: 0, toMineStockpile: 0, toWarehouse: 0 },
  haulTime: 0,
  haulAppliedTime: 0,
  cartLoads: {},
  sites: startingSites,
  pendingSites: [],
  depositMined: {},
  openedStations: [stationKey(-1, 0), stationKey(-1, 1)],
  playerDug: [],
  digPlan: [],
  digProgress: 0,
  layoutVersion: 0,
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
    const routes = getCartRoutes(selectMineLayout(state));
    for (const [level, route] of routes) {
      const tips = cartEventsBetween(route, from, to, 'tip');
      const loads = cartEventsBetween(route, from, to, 'load');
      if (tips.length === 0 && loads.length === 0) continue;
      cartLoads = cartLoads === state.cartLoads ? { ...cartLoads } : cartLoads;
      if (tips.length > 0) {
        const carried = cartLoads[level] as CartLoad | undefined;
        if (carried && carried.amount > 0) {
          mineExitIn[carried.resource] = roundCoal(mineExitIn[carried.resource] + carried.amount);
          toMineExit = roundCoal(toMineExit + carried.amount);
        }
        delete cartLoads[level];
      }
      for (const trip of loads) {
        const resource = route.resources[trip];
        const take = Math.min(vein[resource], state.mineCartCapacity);
        vein[resource] = roundCoal(vein[resource] - take);
        cartLoads[level] = { resource, amount: take };
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
    const toMine = transfer(mineExitIn, state.mineStock, state.mineCartCapacity, state.mineCapacity);
    const toStore = transfer(toMine.to, state.warehouse, state.warehouseCartCapacity, state.warehouseCapacity);

    // Diggers work through the plan one tile at a time.
    let { digPlan, digProgress, playerDug, pendingSites } = state;
    let layoutVersion = state.layoutVersion + (layoutChanged ? 1 : 0);
    if (digPlan.length > 0) {
      digProgress += 1;
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

    return {
      elapsedSeconds: state.elapsedSeconds + 1,
      digPlan,
      digProgress,
      playerDug,
      pendingSites,
      layoutVersion,
      sites,
      depositMined,
      notice,
      vein,
      mineExit: toMine.from,
      mineStock: toStore.from,
      warehouse: toStore.to,
      lastFlow: { mined, toMineExit, toMineStockpile: toMine.moved, toWarehouse: toStore.moved },
      haulTime: canHaul ? state.haulTime + 1 : state.haulTime,
      haulAppliedTime: to,
      cartLoads,
    };
  }),

  fulfillCoalRequest: () => set((state) => {
    if (state.warehouse.coal < COAL_REQUEST_SIZE) {
      return { notice: `The request needs ${String(COAL_REQUEST_SIZE)} coal in the warehouse.` };
    }
    return {
      warehouse: { ...state.warehouse, coal: roundCoal(state.warehouse.coal - COAL_REQUEST_SIZE) },
      gold: state.gold + COAL_REQUEST_REWARD,
      notice: `Delivered ${String(COAL_REQUEST_SIZE)} coal. The trading post paid ${String(COAL_REQUEST_REWARD)} gold.`,
    };
  }),

  buildMinerHut: () => set((state) => {
    const cost = COSTS.minerHut;
    if (!canAfford(state, cost)) {
      return { notice: `A miner hut costs ${String(cost.coal)} coal and ${String(cost.gold)} gold.` };
    }
    // New miners go straight to an open coal face if there is one; otherwise they wait to be assigned.
    const site = nextFreeSite(selectMineLayout(state));
    const paid = {
      warehouse: { ...state.warehouse, coal: roundCoal(state.warehouse.coal - cost.coal) },
      gold: state.gold - cost.gold,
      miners: state.miners + 1,
      huts: state.huts + 1,
    };
    if (!site) {
      return { ...paid, notice: 'A new miner is waiting for work. Dig to a deposit and tap it to assign them.' };
    }
    return {
      ...paid,
      ...withSite(state, site),
      notice: site.kind === 'deposit'
        ? `A new miner set to work on the ${RESOURCE_INFO[siteResource(site)].deposit.toLowerCase()} you uncovered.`
        : 'A new miner joined the shift at a gallery station.',
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
      const cost = routeCost(route);
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

  sellResource: (resource, amount) => set((state) => {
    const available = Math.floor(state.warehouse[resource]);
    const units = amount === 'all' ? available : Math.min(available, Math.floor(amount));
    const { name } = RESOURCE_INFO[resource];
    if (units <= 0) return { notice: `There is no ${name.toLowerCase()} in the warehouse to sell.` };
    const earned = units * RESOURCE_PRICE[resource];
    return {
      warehouse: { ...state.warehouse, [resource]: roundCoal(state.warehouse[resource] - units) },
      gold: state.gold + earned,
      notice: `Sold ${units.toLocaleString()} ${name.toLowerCase()} at the trading post for ${earned.toLocaleString()} gold.`,
    };
  }),

  forgePickaxe: () => set((state) => {
    const cost = COSTS.pickaxe;
    if (state.pickaxeLevel >= MAX_PICKAXE_LEVEL) return { notice: 'Your pickaxes are fully forged.' };
    if (!canAfford(state, cost)) {
      return { notice: `Forging better picks costs ${String(cost.coal)} coal and ${String(cost.gold)} gold.` };
    }
    return {
      warehouse: { ...state.warehouse, coal: roundCoal(state.warehouse.coal - cost.coal) },
      gold: state.gold - cost.gold,
      pickaxeLevel: state.pickaxeLevel + 1,
      minerRate: roundCoal(state.minerRate + 0.25),
      notice: 'The new pickaxes let every miner dig 0.25 more per second.',
    };
  }),

  expandWarehouse: () => set((state) => {
    const cost = COSTS.warehouse;
    if (!canAfford(state, cost)) {
      return { notice: `Warehouse expansion costs ${String(cost.coal)} coal and ${String(cost.gold)} gold.` };
    }
    return {
      warehouse: { ...state.warehouse, coal: roundCoal(state.warehouse.coal - cost.coal) },
      gold: state.gold - cost.gold,
      warehouseCapacity: state.warehouseCapacity + 50,
      warehouseCartCapacity: state.warehouseCartCapacity + 5,
      warehouseUpgrades: state.warehouseUpgrades + 1,
      notice: 'Every warehouse stockpile holds 50 more, and the surface cart hauls 5 more per trip.',
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
      const cost = digCost(parseKey(key).row);
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

