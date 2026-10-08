// Rocks: a new hold starts with most of its town under rocks — stones, rocks and boulders — except the
// keep's plaza, the mine yard, the first roads and the first buildings. Buildings and roads can't go on
// rocks and peasants pick their way over them slowly, so land is won by clearing it: the player orders
// rocks cleared, a crew of peasants works through each order, and the stone comes back as granite.
// Where the rocks lie is fixed (a hash of the tile); the save keeps only the tiles cleared. Pure TS.
import { DEFAULT_SPOTS, FOOTPRINTS, GROWN_MAP_SHIFT, MAP_SIZE, MINE_SPOT, PLAZA, STARTING_ROAD_RUNS, tileKey, zoneAt } from './cityMap';
import type { BuildingId } from './buildings';

export type RockSize = 1 | 2 | 3;

/** Per size: seconds of a crew's work to clear it, and the granite it yields. */
export const ROCK_INFO: Record<RockSize, { name: string; seconds: number; granite: number }> = {
  1: { name: 'stones', seconds: 1.5, granite: 1 },
  2: { name: 'rock', seconds: 3, granite: 2 },
  3: { name: 'boulder', seconds: 5, granite: 3 },
};
/** Peasants in the clearing crew while there are orders. */
export const CLEAR_CREW = 2;

/** A clearing order: its tiles (keys), the seconds of work it takes and how many are done. */
export type ClearOrder = { tiles: string[]; work: number; done: number };

// Ground that starts clear: the plaza round the keep (with the campfire and parade ground), the mine and
// the yard between it and the warehouse, the first roads, and the first buildings' plots with a margin.
const STARTING_BUILDINGS_PLACED: BuildingId[] = ['houses', 'warehouse', 'foundry', 'guardhouse'];
const CLEAR_AT_START: Set<string> = (() => {
  const clear = new Set<string>();
  const area = (x0: number, y0: number, x1: number, y1: number) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) clear.add(tileKey(x, y));
  };
  area(PLAZA.x0 - 1, PLAZA.y0 - 1, PLAZA.x1 + 1, PLAZA.y1 + 1);
  area(MINE_SPOT.x - 2, MINE_SPOT.y - 2, MINE_SPOT.x + MINE_SPOT.w + 1, MINE_SPOT.y + MINE_SPOT.d + 1);
  area(MINE_SPOT.x - 8, MINE_SPOT.y - 5, MINE_SPOT.x + 3, MINE_SPOT.y + 3);
  for (const [x, y, w, d] of STARTING_ROAD_RUNS) area(x - 1, y, x + w, y + d - 1);
  for (const id of STARTING_BUILDINGS_PLACED) {
    const spot = DEFAULT_SPOTS[id];
    if (spot) area(spot.x - 1, spot.y - 1, spot.x + FOOTPRINTS[id].w, spot.y + FOOTPRINTS[id].d);
  }
  return clear;
})();

const hash = (x: number, y: number) => {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  h ^= h >>> 13;
  h = Math.imul(h, 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** The rock a tile started with (before any clearing), or 0. About four tiles in five outside the clear ground. */
export function startingRock(x: number, y: number): RockSize | 0 {
  if (zoneAt(x, y) !== 'town' || CLEAR_AT_START.has(tileKey(x, y))) return 0;
  // Hashed from where the tile lay on the old 47-tile map, so the rocks there didn't move when it grew.
  const [hx, hy] = [x - GROWN_MAP_SHIFT, y - GROWN_MAP_SHIFT];
  const roll = hash(hx, hy);
  if (roll >= 0.8) return 0;
  const size = hash(hy + 101, hx + 37);
  return size < 0.5 ? 1 : size < 0.85 ? 2 : 3;
}

// The cleared tiles as a set, cached per saved list.
const sets = new WeakMap<readonly string[], Set<string>>();
export function clearedSet(cleared: readonly string[]): Set<string> {
  let set = sets.get(cleared);
  if (!set) {
    set = new Set(cleared);
    sets.set(cleared, set);
  }
  return set;
}

/** The rock on a tile now (0 if it never had one or it's been cleared). */
export function rockAt(cleared: readonly string[], x: number, y: number): RockSize | 0 {
  const rock = startingRock(x, y);
  return rock && !clearedSet(cleared).has(tileKey(x, y)) ? rock : 0;
}

/** A tile test for rocks still standing (for placement checks and walking). */
export const rockyTest = (cleared: readonly string[]) => (x: number, y: number) => rockAt(cleared, x, y) > 0;

/** Every rock still standing, by tile key. */
export function rocksLeft(cleared: readonly string[]): { key: string; x: number; y: number; size: RockSize }[] {
  const rocks: { key: string; x: number; y: number; size: RockSize }[] = [];
  const done = clearedSet(cleared);
  for (let x = 0; x < MAP_SIZE; x++) {
    for (let y = 0; y < MAP_SIZE; y++) {
      const size = startingRock(x, y);
      if (size && !done.has(tileKey(x, y))) rocks.push({ key: tileKey(x, y), x, y, size });
    }
  }
  return rocks;
}
