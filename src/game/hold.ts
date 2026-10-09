// Reading the hold: who's free to work, how far things are to walk, the mine's layout, the hold's power,
// what a forge or cart is doing, and what can be recruited. Pure functions of the state.
import { cartsOnLevel } from './haulage';
import { RESOURCE_INFO, type Resource } from './resources';
import { BUILDING_IDS, BUILDING_INFO, buildingStats, type BuildingId } from './buildings';
import { ARMY_RECRUITING, ARMY_UNITS, UNIT_STATS, armyValue, type ArmyUnit } from './units';
import { holdPower, type HoldPower, type RaidParty } from './raids';
import { allocateWorkforce, type Workforce } from './workforce';
import { CLEAR_CREW, type ClearOrder } from './rocks';
import { ITEM_INFO, UNIT_GEAR, type ItemId } from './items';
import { FORGE_IDS, FORGE_OUTPUT_CAP, emptyLoad, isForge, loadUnits, missingInputs, shelfMissing, type ForgeId, type Load } from './forges';
import { HOUSE_IDS, isHouse } from './houses';
import { FARM_SERIES, type FarmId } from './farms';
import { itemsInTransit, wagonBackAt, wagonDropAt, wagonStops, type WagonJob } from './wagons';
import { FOOTPRINTS, MINE_SPOT, RAID_SIDES, spotOf, type Footprint, type Placements, type Spot } from './cityMap';
import { buildFactor, walkBetween, type Walk } from './roads';
import { TRAP_DAMAGE, trapCounts } from './traps';
import { buildMineLayout, depositAt, siteLevel, type MineLayout, type Site } from './mineLayout';
import type { GameState, WalkState, WorkforceState } from './state';

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

/** The docks now: how often barges come (0: no dockhands, none come), how big their orders are, the trade bonus. */
export function docksOf(state: WorkforceState & Pick<GameState, 'techs'>) {
  const stats = buildingStats(state.buildings, workforceOf(state).staff, state.techs);
  return { interval: stats.shipCycle, hold: stats.shipHold, tradeBonus: stats.tradeBonus };
}

const footprintOf = (id: BuildingId, placements: Placements) => {
  const spot = spotOf(id, placements);
  return spot ? { ...spot, ...FOOTPRINTS[id] } : null;
};

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

/** The built forges set to make an item. */
export const forgesMaking = (state: Pick<GameState, 'buildings' | 'forgeTasks'>, item: ItemId) =>
  FORGE_IDS.filter((forge) => state.buildings[forge] > 0 && state.forgeTasks[forge]?.item === item);

/** Lists show only the next forge, house or farm of a kind to build (each kind is built in order). */
export function isShownBuilding(state: Pick<GameState, 'buildings' | 'construction'>, id: BuildingId) {
  const series: readonly BuildingId[] | null = isForge(id) ? FORGE_IDS : isHouse(id) ? HOUSE_IDS : (FARM_SERIES.find((kind) => kind.includes(id as FarmId)) ?? null);
  if (!series) return true;
  const started = (other: BuildingId) => state.buildings[other] > 0 || state.construction.some((job) => job.building === other);
  return started(id) || series.find((other) => !started(other)) === id;
}

/** The first built forge with no task, if any. */
export const freeForge = (state: Pick<GameState, 'buildings' | 'forgeTasks'>) => FORGE_IDS.find((forge) => state.buildings[forge] > 0 && !state.forgeTasks[forge]) ?? null;

export function describeParty(party: RaidParty) {
  return party.map(({ unit, count }) => `${String(count)} ${(count === 1 ? UNIT_STATS[unit].name : UNIT_STATS[unit].plural).toLowerCase()}`).join(', ');
}

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
export function minerCrew(state: Pick<GameState, 'sites' | 'pendingSites'>, site: Site) {
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
