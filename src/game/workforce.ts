// The peasants: one pool of people for every job. The player's own orders come first (miners, the
// cart pushers their levels need, building crews); then buildings are staffed in priority order
// (every building but the keep, the wall and the towers needs staff); whoever is left waits at the
// campfire. Recruiting a soldier takes a peasant out of the pool for good.
import { BUILDING_IDS, staffNeeded, type BuildingId, type BuildingLevels } from './buildings';
import { FORGE_IDS } from './forges';
import { FISHERY_IDS, ORCHARD_IDS, PASTURE_IDS } from './farms';
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

export function allocateWorkforce({
  population,
  miners,
  pushers,
  builders,
  levels,
  paused,
}: {
  population: number;
  miners: number;
  pushers: number;
  builders: number;
  levels: BuildingLevels;
  paused: readonly BuildingId[];
}): Workforce {
  const free = Math.max(0, population - miners - pushers - builders);
  const staff = Object.fromEntries(BUILDING_IDS.map((id) => [id, 0])) as Record<BuildingId, number>;
  const needed = Object.fromEntries(BUILDING_IDS.map((id) => [id, paused.includes(id) ? 0 : staffNeeded(id, levels[id])])) as Record<BuildingId, number>;
  let left = free;
  for (const id of STAFF_PRIORITY) {
    const take = Math.min(needed[id], left);
    staff[id] = take;
    left -= take;
  }
  return { population, miners, pushers, builders, free, staff, needed, staffTotal: free - left, idle: left };
}
