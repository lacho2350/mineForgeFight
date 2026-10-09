// Loading a save: older saves are migrated (the map grew, old armory orders are paid back) and laid over a
// fresh game, so new state always has a default.
import { RESOURCES, STARTING_WOOD, emptyStock, type Resource } from './resources';
import { cleanForest } from './forest';
import { STARTING_APPLES } from './farms';
import { BUILDING_IDS, crewSize, type BuildingId } from './buildings';
import { ARMY_RECRUITING, ARMY_UNITS, emptyArmy, type ArmyUnit } from './units';
import { RAID_AUTO_AFTER, partyValue, raidParty, raidStrength } from './raids';
import { BERTHS, MAX_BARGES, isWaiting } from './ship';
import { rockAt, startingRock } from './rocks';
import { UNIT_GEAR, emptyItems, isItemId, type ItemStock } from './items';
import { DEFAULT_FORGE_TARGET, FORGE_TARGETS, emptyLoad, isForge, type ForgeTasks, type Load } from './forges';
import type { WagonJob } from './wagons';
import {
  CASTLE,
  GATE_ROAD,
  GROWN_MAP_SHIFT,
  OLD_MAP_SHIFT,
  zoneAt,
  coveredTiles,
  fillPlacements,
  grownCoordinate,
  tileKey as mapTileKey,
  validPlacements,
  type Placements,
  type Spot,
} from './cityMap';
import { haulFactor, isRoadKind, roadProblem, startingRoads, type RoadKind, type Roads } from './roads';
import { TRAP_INFO, TRAP_KINDS, trapProblem, type Trap } from './traps';
import { isTechId } from './techs';
import type { GameState, SavedState } from './state';
import { BUILDING_NAMES, haulWalk, holdPowerOf } from './hold';
import { buildingFields } from './updates';

/** An order from when the armory made all the gear (paid up front); kept only to pay older saves back. */
type LegacyCraftJob = { count: number; made?: number; paid?: { resources?: Record<string, number>; used?: Record<string, number> } };

// Lay a save over a fresh game. Records are merged key by key, so a save from an older version still gets
// any buildings, units or resources added since; stats that follow from building levels are recomputed.
export function mergeSave(saved: Partial<SavedState> | undefined, fresh: GameState): GameState {
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
  // Saves from before wood: the same start as a new game.
  if (!('wood' in (saved.warehouse ?? {}))) warehouse.wood = STARTING_WOOD;
  // Saves from before food: a new game's apples, to last until the first farms are up.
  if (!('apples' in (saved.warehouse ?? {}))) warehouse.apples = STARTING_APPLES;
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
    // The forest as it was left; a save from before the forest (or a damaged one) gets a new one.
    forest: cleanForest(saved.forest) ?? fresh.forest,
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
  // Raids sighted before field battles were sieges. One sighted under older, harsher rules (well beyond what
  // the hold's power now calls for) is sized afresh.
  if (merged.raid && merged.raid.kind !== 'field' && merged.raid.kind !== 'siege') merged.raid = { ...merged.raid, kind: 'siege' };
  const { raid } = merged;
  if (raid && merged.battle?.status !== 'active') {
    const power = holdPowerOf(merged);
    const strength = raidStrength(raid.number, raid.kind === 'field' ? power.army : power.total, merged.raidsLostInARow);
    if (partyValue(raid.party) > strength * 1.2) merged.raid = { ...raid, party: raidParty(raid.number, strength, raid.kind) };
  }
  if (washedAway.count > 0) {
    merged.notice = `The river now runs up to the far wall: its ${String(washedAway.count)} trap${washedAway.count === 1 ? '' : 's'} on that side were paid back (${String(washedAway.gold)} gold).`;
  }
  return merged;
}

// Older saves, step by step: version 1 placed buildings on a 32-tile map, which then grew outer rings
// (raiders, traps, moat, wall), so everything moved in by the same amount; version 2 was on the 47-tile
// map, which then grew 6 tiles on every side (`grownMap`).
export function migrateSave(saved: Partial<SavedState> | undefined, version: number): Partial<SavedState> {
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
