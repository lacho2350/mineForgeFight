// Changes to the state shared by the store's actions and the tick: settling a battle, returning goods,
// starting a building, moving stock.
import { RESOURCES, type Resource, type Stock } from './resources';
import { FOOTPRINTS, sideOf, type MapSide } from './cityMap';
import { FISHERY_IDS, LOST_RAID_SHEEP_TAKEN, PASTURE_IDS, RAID_SHEEP_TAKEN } from './farms';
import { BUILDING_INFO, buildingCost, buildingStats, buildingTime, crewSize, type BuildingId, type BuildingLevels } from './buildings';
import { ARMY_UNITS } from './units';
import { battleOutcome, raiderStrength, type Battle } from './combat';
import { FIELD_BOUNTY, FIELD_PLUNDER_SHARE, PLUNDER_SHARE, RAID_INTERVAL, raidBounty, raidSide } from './raids';
import { BARGE_SAIL, type Barge } from './ship';
import { ITEM_INFO, type ItemId, type ItemStock } from './items';
import { FORGE_NAMES, addLoad, isForge, type ForgeTask, type ForgeTasks } from './forges';
import type { WagonJob } from './wagons';
import type { TechId } from './techs';
import { siteLevel, stationKey, type Site } from './mineLayout';
import type { GameState, RaidReport } from './state';

export const roundCoal = (amount: number) => Math.round(amount * 10) / 10;

/**
 * A forge's goods back into the store (mutates `warehouse` and `items`): its shelf, the materials of the
 * piece on its anvil and the finished pieces on its rack; resources only up to the warehouse's room.
 */
export function returnForgeGoods(task: ForgeTask, warehouse: Stock, items: ItemStock, before: Stock, capacity: number) {
  const goods = task.loaded ? addLoad(task.stock, { resources: ITEM_INFO[task.item].recipe.resources, items: ITEM_INFO[task.item].recipe.items }) : task.stock;
  for (const [resource, n] of Object.entries(goods.resources) as [Resource, number][]) {
    warehouse[resource] = Math.min(roundCoal(warehouse[resource] + n), Math.max(before[resource], capacity));
  }
  for (const [item, n] of Object.entries(goods.items) as [ItemId, number][]) items[item] += n;
  items[task.item] += task.output;
}

/** A waiting barge sent back downriver from wherever it is now (one sailing in turns round on the spot). */
export function turnBack(barge: Barge, now: number): Barge {
  const along = Math.min(1, Math.max(0, (now - barge.arrivedAt) / BARGE_SAIL));
  return { ...barge, leftAt: now - (1 - along) * BARGE_SAIL };
}

/**
 * Undo a cart's trip (mutates the stores passed in): materials not yet delivered go back to the warehouse
 * (up to its room) and the store; pieces not yet delivered go back onto their forge's rack (or into the
 * store if the forge has moved on). Returns where the goods went, for the news.
 */
export function undoWagonTrip(
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

type SettleState = Pick<GameState, 'gold' | 'warehouse' | 'army' | 'battleArmy' | 'elapsedSeconds' | 'raid' | 'raidsFought' | 'raidsLostInARow' | 'buildings' | 'placements' | 'flocks'>;

// A battle just ended: survivors rejoin the army, and the bounty is paid or the plunder taken.
export function settleBattle(state: SettleState, battle: Battle) {
  const { survivors, losses, slain } = battleOutcome(battle, state.battleArmy);
  const army = { ...state.army };
  for (const unit of ARMY_UNITS) army[unit] = Math.max(0, army[unit] - state.battleArmy[unit] + survivors[unit]);
  const number = state.raid?.number ?? battle.raid;
  const field = battle.kind === 'field';
  const report: RaidReport = {
    number,
    kind: field ? 'field' : 'siege',
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
    report.bounty = Math.round(raidBounty(raiderStrength(battle)) * (field ? FIELD_BOUNTY : 1));
    gold += report.bounty;
    notice = `Raid ${String(number)} won: +${String(report.bounty)} gold.`;
  } else if (report.outcome === 'lost') {
    const taken: Partial<Stock> = {};
    warehouse = { ...warehouse };
    for (const resource of RESOURCES) {
      const amount = Math.floor(warehouse[resource] * (field ? FIELD_PLUNDER_SHARE : PLUNDER_SHARE));
      if (amount > 0) taken[resource] = amount;
      warehouse[resource] = roundCoal(warehouse[resource] - amount);
    }
    const goldTaken = Math.floor(gold * (field ? FIELD_PLUNDER_SHARE : PLUNDER_SHARE));
    gold -= goldTaken;
    report.plundered = { gold: goldTaken, resources: taken };
    notice = field
      ? `Raid ${String(number)} lost in the field: −${String(goldTaken)} gold and a little of every stockpile.`
      : `Raid ${String(number)} lost: the hold was plundered, −${String(goldTaken)} gold and a share of every stockpile.`;
  } else {
    notice = `Raid ${String(number)}: the raiders withdrew.`;
  }
  // On their way, the raiders ravaged the land outside the walls on their side.
  const ravaged = ravage(state, raidSide(number), report.outcome === 'lost');
  if (ravaged.note) notice += ` ${ravaged.note}`;
  return {
    army,
    gold,
    warehouse,
    buildings: ravaged.buildings,
    flocks: ravaged.flocks,
    raidReport: report,
    raid: null,
    raidsFought: Math.max(state.raidsFought, number),
    raidsLostInARow: report.outcome === 'lost' ? state.raidsLostInARow + 1 : 0,
    nextRaidAt: state.elapsedSeconds + RAID_INTERVAL,
    notice,
  };
}

// What raiders from `side` do to the land outside the walls: they drive off a share of every flock grazing
// there (more if they won), and if they won, burn every fishing hut on that bank down a level.
function ravage(state: Pick<GameState, 'buildings' | 'placements' | 'flocks'>, side: MapSide, won: boolean) {
  let { buildings, flocks } = state;
  let sheep = 0;
  const burned: string[] = [];
  const onSide = (id: BuildingId) => {
    const spot = state.placements[id];
    return !!spot && state.buildings[id] > 0 && sideOf(spot, FOOTPRINTS[id]) === side;
  };
  for (const id of PASTURE_IDS) {
    const flock = flocks[id] ?? 0;
    if (!onSide(id) || flock <= 0) continue;
    const taken = Math.round(flock * (won ? LOST_RAID_SHEEP_TAKEN : RAID_SHEEP_TAKEN));
    if (taken <= 0) continue;
    flocks = { ...flocks, [id]: flock - taken };
    sheep += taken;
  }
  if (won) {
    for (const id of FISHERY_IDS) {
      if (!onSide(id)) continue;
      buildings = { ...buildings, [id]: buildings[id] - 1 };
      burned.push(BUILDING_INFO[id].name);
    }
  }
  const notes = [
    sheep > 0 ? `They drove off ${String(sheep)} sheep.` : '',
    burned.length > 0 ? `They burned ${burned.join(', ')} down a level.` : '',
  ];
  return { buildings, flocks, note: notes.filter(Boolean).join(' ') };
}

// Apply a new battle state, settling the raid if it just ended.
export function withBattle(state: GameState, next: Battle): Partial<GameState> {
  if (next === state.battle) return {};
  if (state.battle?.status === 'active' && next.status !== 'active') return { battle: next, ...settleBattle(state, next) };
  return { battle: next };
}

// The state fields that follow from building levels (and, for what buildings do, their staff), the
// techs bought, and how quickly the haulers walk between the mine and the warehouse (`haul`).
export function buildingFields(buildings: BuildingLevels, staff: Partial<Record<BuildingId, number>> | undefined, techs: readonly TechId[], haul: number) {
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

// Assigning a miner to a gallery station cuts its chamber and ladder shaft for good.
export function withSite(state: Pick<GameState, 'sites' | 'openedStations' | 'layoutVersion'>, site: Site) {
  const level = siteLevel(site);
  const key = site.station === undefined ? null : stationKey(level, site.station);
  return {
    sites: [...state.sites, site],
    openedStations: key && !state.openedStations.includes(key) ? [...state.openedStations, key] : state.openedStations,
    layoutVersion: state.layoutVersion + 1,
  };
}

export const withArticle = (noun: string) => `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`;

// Move up to `capacity` units in total from one set of stockpiles to the next, resource by resource,
// without overfilling any destination pile.
export function transfer(from: Stock, to: Stock, capacity: number, destinationCapacity: number) {
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

// Pay for the next level of a building and put a crew on it.
export function startBuilding(state: GameState, id: BuildingId): Partial<GameState> {
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
