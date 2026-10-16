// The peasants: one pool of people for every job. The player's own orders come first (miners, the
// cart pushers their levels need, building crews); then the buildings have the staff the player gave
// them (`staffing`: their + / − or AUTO-ASSIGN — nobody is sent anywhere by themselves), in priority order
// when there aren't enough to go round; whoever is left waits at the campfire. An order with nobody at
// the campfire takes a worker off the lowest building in the order (it stays short until staffed again).
// Recruiting a soldier takes a peasant out of the pool for good.
import { BUILDING_IDS, staffNeeded, type BuildingId, type BuildingLevels } from './buildings';
import { FORGE_IDS } from './forges';
import { FISHERY_IDS, ORCHARD_IDS, PASTURE_IDS } from './farms';
import { CHURCH_IDS, FAIRGROUND_IDS } from './moodBuildings';
import { WOODCUTTER_IDS } from './woodcutters';

export { PEASANT_ARRIVAL_SECONDS } from './buildings';

/**
 * Who gets staff first when there aren't enough peasants for every building. (The cottages need none:
 * their women keep them, and aren't workers.)
 */
export const STAFF_PRIORITY: BuildingId[] = [
  'warehouse',
  ...ORCHARD_IDS,
  ...FISHERY_IDS,
  ...PASTURE_IDS,
  'granary',
  ...WOODCUTTER_IDS,
  ...FAIRGROUND_IDS,
  ...CHURCH_IDS,
  'foundry',
  'docks',
  'gate',
  'guardhouse',
  'archery',
  'barracks',
  'research',
  'armory',
  'depot',
  ...FORGE_IDS,
  'monastery',
  'stables',
  'balloonWorks',
  'griffinEyrie',
  'chapel',
  'sanctum',
];

export type Workforce = {
  population: number;
  miners: number;
  pushers: number;
  builders: number;
  /** Peasants not under the player's orders (staff + idle): what new orders and recruits can draw on. */
  free: number;
  staff: Record<BuildingId, number>;
  needed: Record<BuildingId, number>;
  staffTotal: number;
  idle: number;
};

/** The staff the player gave each building (any building missing has none). */
export type Staffing = Partial<Record<BuildingId, number>>;

/** Staffing that fills every building (in priority order, as far as the peasants go): a new game, older saves. */
export const FULL_STAFFING: Staffing = Object.fromEntries(BUILDING_IDS.map((id) => [id, Number.MAX_SAFE_INTEGER]));

export function allocateWorkforce({
  population,
  miners,
  pushers,
  builders,
  levels,
  paused,
  staffing,
}: {
  population: number;
  miners: number;
  pushers: number;
  builders: number;
  levels: BuildingLevels;
  paused: readonly BuildingId[];
  staffing: Staffing;
}): Workforce {
  const free = Math.max(0, population - miners - pushers - builders);
  const staff = Object.fromEntries(BUILDING_IDS.map((id) => [id, 0])) as Record<BuildingId, number>;
  const needed = Object.fromEntries(BUILDING_IDS.map((id) => [id, paused.includes(id) ? 0 : staffNeeded(id, levels[id])])) as Record<BuildingId, number>;
  let left = free;
  for (const id of STAFF_PRIORITY) {
    const take = Math.max(0, Math.min(staffing[id] ?? 0, needed[id], left));
    staff[id] = take;
    left -= take;
  }
  return { population, miners, pushers, builders, free, staff, needed, staffTotal: free - left, idle: left };
}

/** Empty spots in the buildings (staff they could take). */
export const vacancies = (workforce: Workforce) => BUILDING_IDS.reduce((sum, id) => sum + workforce.needed[id] - workforce.staff[id], 0);
