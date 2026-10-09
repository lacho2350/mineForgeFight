// The stronghold's ground: a square grid of tiles in rings. From the map's edge inward: three tiles
// where raiders appear, two for traps (see traps.ts), the moat, then the wall ring with its towers
// and gate; inside it the town. On the far side from the gate there's no land outside the wall: a river
// runs right up to it (the moat flows into it at both ends), and a walled harbour is cut into the
// castle square from it for the docks. The keep (with a plaza round it) and the mine have fixed places; every
// other building is placed by the player, one footprint per building, anywhere in the town it fits,
// and can be moved later. Roads are laid by the player (see roads.ts). Pure TS.
import type { BuildingId } from './buildings';
import { FORGE_IDS, type ForgeId } from './forges';
import { HOUSE_IDS, type HouseId } from './houses';
import { FISHERY_IDS, ORCHARD_IDS, PASTURE_IDS, isFishery, isPasture, type FisheryId, type OrchardId, type PastureId } from './farms';

export const MAP_SIZE = 59;
/** The map's middle tile (the gate, the harbour and the keep's axis). */
const MIDDLE = (MAP_SIZE - 1) / 2;

/** Tiles from the nearest map edge (0 on the edge). */
export const edgeDistance = (x: number, y: number) => Math.min(x, y, MAP_SIZE - 1 - x, MAP_SIZE - 1 - y);

/** The rings, by distance from the edge: raiders 0–2, traps 3–4, moat 5, wall 6; the town is inside. */
export const RINGS = { enemy: 3, traps: 2, moat: 1, wall: 1 } as const;
const TRAPS_FROM = RINGS.enemy;
const MOAT_AT = TRAPS_FROM + RINGS.traps;
const WALL_AT = MOAT_AT + RINGS.moat;

/** The river: every row from the far edge (y = 0) up to the wall, flowing west to east. */
export const RIVER_ROWS = WALL_AT;
/** The harbour: a walled inlet cut into the castle square from the river (water tiles). */
export const HARBOUR = { x0: MIDDLE - 1, x1: MIDDLE + 1, y0: WALL_AT, y1: WALL_AT + 2 };
/** The harbour's back wall, where the docks stand in the middle. */
export const DOCKS_ROW = HARBOUR.y1 + 1;
/** The docks: the middle of the harbour's back wall. */
export const DOCKS_SPOT = { x: HARBOUR.x0, y: DOCKS_ROW };
export const DOCK_TILES = [HARBOUR.x0, HARBOUR.x0 + 1, HARBOUR.x1];
const inHarbour = (x: number, y: number) => x >= HARBOUR.x0 && x <= HARBOUR.x1 && y >= HARBOUR.y0 && y <= HARBOUR.y1;
// The wall round the harbour: a column either side and the row behind it.
const harbourWall = (x: number, y: number) =>
  ((x === HARBOUR.x0 - 1 || x === HARBOUR.x1 + 1) && y >= WALL_AT && y <= DOCKS_ROW) || (y === DOCKS_ROW && x >= HARBOUR.x0 - 1 && x <= HARBOUR.x1 + 1);

export type Zone = 'enemy' | 'traps' | 'moat' | 'wall' | 'town' | 'water';
export function zoneAt(x: number, y: number): Zone {
  if (x >= 0 && x < MAP_SIZE && y >= 0 && y < RIVER_ROWS) return 'water';
  if (inHarbour(x, y)) return 'water';
  if (harbourWall(x, y)) return 'wall';
  const distance = edgeDistance(x, y);
  if (distance < TRAPS_FROM) return 'enemy';
  if (distance < MOAT_AT) return 'traps';
  if (distance === MOAT_AT) return 'moat';
  if (distance === WALL_AT) return 'wall';
  return 'town';
}

/** The map's four edges, named by where they lie on screen (north is up): raiders come from one each raid. */
export const MAP_SIDES = ['southWest', 'southEast', 'northEast', 'northWest'] as const;
export type MapSide = (typeof MAP_SIDES)[number];
export const SIDE_NAMES: Record<MapSide, string> = { southWest: 'south-west', southEast: 'south-east', northEast: 'north-east', northWest: 'north-west' };

/** Tiles from a tile to one side's edge. */
export function sideDistance(x: number, y: number, side: MapSide) {
  switch (side) {
    case 'southWest':
      return MAP_SIZE - 1 - y;
    case 'southEast':
      return MAP_SIZE - 1 - x;
    case 'northEast':
      return y;
    case 'northWest':
      return x;
  }
}

/** The side of the map a footprint is nearest (where raiders from that side pass it). */
export function sideOf(spot: Spot, footprint: Footprint): MapSide {
  const x = spot.x + footprint.w / 2 - 0.5;
  const y = spot.y + footprint.d / 2 - 0.5;
  return MAP_SIDES.reduce((best, side) => (sideDistance(x, y, side) < sideDistance(x, y, best) ? side : best));
}

/** The sides a tile faces: the edges it's nearest to (two at the corners). */
export const sidesOf = (x: number, y: number) => MAP_SIDES.filter((side) => sideDistance(x, y, side) === edgeDistance(x, y));

/** The wall ring's tiles run round this square; the town is inside it. */
export const CASTLE = { x0: WALL_AT, y0: WALL_AT, x1: MAP_SIZE - 1 - WALL_AT, y1: MAP_SIZE - 1 - WALL_AT };
/** The gate's tiles in the front-left wall (row y = CASTLE.y1). */
export const GATE_TILES = [MIDDLE - 1, MIDDLE, MIDDLE + 1];
/** Where towers stand on the wall, in the order they're built (front ones first). */
export const TOWER_SPOTS: [number, number][] = [
  [CASTLE.x1, CASTLE.y1],
  [CASTLE.x0, CASTLE.y1],
  [CASTLE.x1, CASTLE.y0],
  [CASTLE.x0, CASTLE.y0],
  [CASTLE.x1, MIDDLE],
  [CASTLE.x0, MIDDLE],
];

/** River, harbour or moat. */
export const isWater = (x: number, y: number) => {
  const zone = zoneAt(x, y);
  return zone === 'water' || zone === 'moat';
};

/** Every tile of the wall: the ring round the town (open where the harbour comes in) and the harbour's walls. */
export const WALL_TILES: [number, number][] = (() => {
  const tiles: [number, number][] = [];
  for (let x = 0; x < MAP_SIZE; x++) for (let y = 0; y < MAP_SIZE; y++) if (zoneAt(x, y) === 'wall') tiles.push([x, y]);
  return tiles;
})();

/** The sides raiders come from: every side but the river's. */
export const RAID_SIDES: MapSide[] = ['southWest', 'southEast', 'northWest'];
/** Saves from before the outer rings used a 32-tile map; their buildings move this far in. */
export const OLD_MAP_SHIFT = 7;
/**
 * Saves from the 47-tile map (version 2): the map grew this much on every side, so the town and everything
 * in it moves in this far; things in the outer rings keep their distance from their own edge.
 */
export const GROWN_MAP_SHIFT = 6;
/** Where a coordinate (x or y) on the 47-tile map lies on this one. */
export function grownCoordinate(c: number) {
  const oldSize = MAP_SIZE - 2 * GROWN_MAP_SHIFT;
  if (c < WALL_AT) return c;
  if (c > oldSize - 1 - WALL_AT) return c + 2 * GROWN_MAP_SHIFT;
  return c + GROWN_MAP_SHIFT;
}

export type Spot = { x: number; y: number };
export type Footprint = { w: number; d: number };
export type Placements = Partial<Record<BuildingId, Spot>>;

/** Tiles each building covers (along x, along y). */
export const FOOTPRINTS: Record<BuildingId, Footprint> = {
  keep: { w: 5, d: 5 },
  ...(Object.fromEntries(HOUSE_IDS.map((id) => [id, { w: 2, d: 2 }])) as Record<HouseId, Footprint>),
  warehouse: { w: 3, d: 3 },
  foundry: { w: 3, d: 3 },
  research: { w: 3, d: 3 },
  armory: { w: 3, d: 3 },
  depot: { w: 3, d: 2 },
  woodcutter: { w: 2, d: 2 },
  granary: { w: 2, d: 2 },
  ...(Object.fromEntries(ORCHARD_IDS.map((id) => [id, { w: 3, d: 3 }])) as Record<OrchardId, Footprint>),
  ...(Object.fromEntries(FISHERY_IDS.map((id) => [id, { w: 1, d: 1 }])) as Record<FisheryId, Footprint>),
  ...(Object.fromEntries(PASTURE_IDS.map((id) => [id, { w: 3, d: 3 }])) as Record<PastureId, Footprint>),
  ...(Object.fromEntries(FORGE_IDS.map((id) => [id, { w: 2, d: 2 }])) as Record<ForgeId, Footprint>),
  wall: { w: 1, d: CASTLE.y1 - CASTLE.y0 + 1 },
  towers: { w: 1, d: 1 },
  gate: { w: 3, d: 1 },
  moat: { w: 1, d: 1 },
  docks: { w: 3, d: 1 },
  guardhouse: { w: 2, d: 2 },
  archery: { w: 3, d: 3 },
  barracks: { w: 3, d: 3 },
  monastery: { w: 3, d: 3 },
  balloonWorks: { w: 3, d: 3 },
  stables: { w: 4, d: 3 },
  griffinEyrie: { w: 2, d: 2 },
  chapel: { w: 3, d: 3 },
  sanctum: { w: 3, d: 3 },
};

/** Buildings with a fixed place: the keep, the defences (the wall's spot is its left run) and the docks. */
export const FIXED_SPOTS: Partial<Record<BuildingId, Spot>> = {
  keep: { x: MIDDLE - 2, y: 21 },
  wall: { x: CASTLE.x0, y: CASTLE.y0 },
  towers: { x: CASTLE.x1, y: CASTLE.y1 },
  gate: { x: GATE_TILES[0], y: CASTLE.y1 },
  // The moat is a ring; its spot is the stretch in front of the wall west of the gate (badge and taps).
  moat: { x: GATE_TILES[0] - 3, y: CASTLE.y1 + 1 },
  docks: DOCKS_SPOT,
};
export const isPlaceable = (id: BuildingId) => !(id in FIXED_SPOTS);

export const MINE_SPOT = { x: 38, y: 38, w: 3, d: 3 };
/** The paved plaza round the keep (anyone may build on it). */
export const PLAZA = { x0: 23, y0: 20, x1: 35, y1: 32 };
/** The campfire where idle peasants wait, and where the army drills (in front of the keep). */
export const CAMPFIRE = { x: 27.5, y: 27.5 };
export const PARADE = { x: 30.6, y: 26.7 };
/** The road out of the gate, over the moat and through the traps (fixed; town roads are the player's). */
export const GATE_ROAD = { x: MIDDLE, y: CASTLE.y1 + 1, w: 1, d: MAP_SIZE - CASTLE.y1 - 1 };
export const onGateRoad = (x: number, y: number) => x >= GATE_ROAD.x && x < GATE_ROAD.x + GATE_ROAD.w && y >= GATE_ROAD.y && y < GATE_ROAD.y + GATE_ROAD.d;

/**
 * The dirt roads a new game starts with, as tile runs [x, y, w, d]: keep → the main road, the main
 * road, down to the mine, and out to the gate.
 */
export const STARTING_ROAD_RUNS: [number, number, number, number][] = [
  [29, 26, 1, 7],
  [16, 33, 26, 1],
  [39, 34, 1, 4],
  [29, 34, 1, CASTLE.y1 - 34],
];

/** Where buildings stand that exist before the player places them (a new game's start, older saves). */
export const DEFAULT_SPOTS: Partial<Record<BuildingId, Spot>> = {
  houses: { x: 18, y: 35 },
  warehouse: { x: 31, y: 34 },
  foundry: { x: 35, y: 35 },
  guardhouse: { x: 24, y: 29 },
  research: { x: 17, y: 22 },
  armory: { x: 24, y: 22 },
  barracks: { x: 32, y: 21 },
  griffinEyrie: { x: 32, y: 24 },
  chapel: { x: 38, y: 25 },
  sanctum: { x: 17, y: 26 },
  monastery: { x: 17, y: 17 },
  archery: { x: 16, y: 29 },
  stables: { x: 37, y: 21 },
  balloonWorks: { x: 38, y: 16 },
};

export const tileKey = (x: number, y: number) => `${String(x)},${String(y)}`;

// Tiles nobody may build on: the outer rings (raiders, traps, moat, wall), the keep, the mine, and the
// campfire and parade ground in front of the keep.
const FIXED_BLOCKED: Set<string> = (() => {
  const blocked = new Set<string>();
  const area = (x: number, y: number, w: number, d: number) => {
    for (let i = x; i < x + w; i++) for (let j = y; j < y + d; j++) blocked.add(tileKey(i, j));
  };
  for (let x = 0; x < MAP_SIZE; x++) for (let y = 0; y < MAP_SIZE; y++) if (zoneAt(x, y) !== 'town') blocked.add(tileKey(x, y));
  const keep = FIXED_SPOTS.keep as Spot;
  area(keep.x, keep.y, FOOTPRINTS.keep.w, FOOTPRINTS.keep.d);
  area(MINE_SPOT.x, MINE_SPOT.y, MINE_SPOT.w, MINE_SPOT.d);
  area(26, 26, 3, 3); // campfire
  area(30, 26, 4, 5); // parade ground
  return blocked;
})();

/** Is this tile buildable town ground (not an outer ring, the keep, the campfire, parade or mine)? */
export const isOpenGround = (x: number, y: number) => !FIXED_BLOCKED.has(tileKey(x, y));

/** Where a building stands (fixed or placed), or null if it hasn't been placed. */
export function spotOf(id: BuildingId, placements: Placements): Spot | null {
  return FIXED_SPOTS[id] ?? placements[id] ?? null;
}

const overlaps = (a: Spot & Footprint, b: Spot & Footprint) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;

/** Tells whether a tile still has rocks on it (rocks.ts); placement checks without one ignore rocks. */
export type RockyTest = (x: number, y: number) => boolean;

/** Why a building can't stand at `spot`, or null if it can. */
export function placementProblem(id: BuildingId, spot: Spot, placements: Placements, names: Record<BuildingId, string>, rocky?: RockyTest): string | null {
  if (!isPlaceable(id)) return 'It has a fixed place.';
  const { w, d } = FOOTPRINTS[id];
  if (spot.x < 0 || spot.y < 0 || spot.x + w > MAP_SIZE || spot.y + d > MAP_SIZE) return 'Off the edge of the map.';
  // Fishing huts and pastures stand outside the walls, on the raiders' ground: huts on the river's banks.
  const outside = isFishery(id) || isPasture(id);
  for (let x = spot.x; x < spot.x + w; x++) {
    for (let y = spot.y; y < spot.y + d; y++) {
      if (outside) {
        if (zoneAt(x, y) !== 'enemy' || onGateRoad(x, y)) {
          return isFishery(id) ? 'A fishing hut stands on the river bank outside the walls, where the river meets the map’s ends.' : 'Sheep graze outside the walls, on the raiders’ ground (not on the road).';
        }
        if (isFishery(id) && y > RIVER_ROWS + 1) return 'Too far from the river: a fishing hut stands on its bank.';
        continue;
      }
      if (!isOpenGround(x, y)) {
        const zone = zoneAt(x, y);
        if (zone === 'enemy') return 'That ground belongs to the raiders.';
        if (zone === 'traps') return 'That belt is kept for traps (BUILD → Traps).';
        if (zone === 'moat' || zone === 'wall') return 'In the way of the moat or the wall.';
        if (zone === 'water') return 'That’s the river.';
        return 'In the way of the keep, the campfire or the mine.';
      }
    }
  }
  for (const [other, at] of Object.entries(placements) as [BuildingId, Spot][]) {
    if (other === id) continue;
    if (overlaps({ ...spot, w, d }, { ...at, ...FOOTPRINTS[other] })) return `Overlaps the ${names[other]}.`;
  }
  if (rocky) {
    for (let x = spot.x; x < spot.x + w; x++) for (let y = spot.y; y < spot.y + d; y++) if (rocky(x, y)) return 'Rocks in the way: clear them first (BUILD → Clear rocks).';
  }
  return null;
}

/** The free spot for a building closest to `near` (its footprint centred there if possible). */
export function nearestFreeSpot(id: BuildingId, near: Spot, placements: Placements, names: Record<BuildingId, string>, rocky?: RockyTest): Spot | null {
  const { w, d } = FOOTPRINTS[id];
  let best: Spot | null = null;
  let bestDistance = Infinity;
  for (let x = 0; x + w <= MAP_SIZE; x++) {
    for (let y = 0; y + d <= MAP_SIZE; y++) {
      const distance = (x + w / 2 - near.x) ** 2 + (y + d / 2 - near.y) ** 2;
      if (distance >= bestDistance) continue;
      if (placementProblem(id, { x, y }, placements, names, rocky)) continue;
      best = { x, y };
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Give every building that exists (built, or being built) a spot if it lacks one: its default spot
 * when that's free, otherwise the nearest free spot to it. Used for new games and older saves.
 */
export function fillPlacements(
  levels: Record<BuildingId, number>,
  building: BuildingId[],
  placements: Placements,
  names: Record<BuildingId, string>,
): Placements {
  let next = placements;
  for (const id of Object.keys(levels) as BuildingId[]) {
    if (!isPlaceable(id) || next[id] || (levels[id] <= 0 && !building.includes(id))) continue;
    const preferred = DEFAULT_SPOTS[id] ?? { x: Math.floor(MAP_SIZE / 2), y: 36 };
    const spot = placementProblem(id, preferred, next, names) ? nearestFreeSpot(id, preferred, next, names) : preferred;
    if (spot) next = { ...next, [id]: spot };
  }
  return next;
}

/** The tiles every standing building covers (placed or fixed), and the mine. */
export function coveredTiles(placements: Placements): Set<string> {
  const covered = new Set<string>();
  const cover = (x0: number, y0: number, w: number, d: number) => {
    for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + d; y++) covered.add(tileKey(x, y));
  };
  for (const id of Object.keys(FOOTPRINTS) as BuildingId[]) {
    const spot = spotOf(id, placements);
    if (spot) cover(spot.x, spot.y, FOOTPRINTS[id].w, FOOTPRINTS[id].d);
  }
  cover(MINE_SPOT.x, MINE_SPOT.y, MINE_SPOT.w, MINE_SPOT.d);
  return covered;
}

/** Drop placements that no longer fit the map (they get a new spot from `fillPlacements`). */
export function validPlacements(placements: Placements, names: Record<BuildingId, string>): Placements {
  const valid: Placements = {};
  for (const [id, spot] of Object.entries(placements) as [BuildingId, Spot][]) {
    if (!placementProblem(id, spot, valid, names)) valid[id] = spot;
  }
  return valid;
}
