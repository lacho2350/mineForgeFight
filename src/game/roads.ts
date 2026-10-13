// Roads: tiles of dirt, stone or granite laid by the player on open town ground. Peasants walk faster
// on them, and walking is what moves goods: haulers carry more per tick on a quick road between the
// mine and the warehouse, and builders carrying materials from the warehouse raise a building faster.
// Paths are found over the tile grid (4 directions; buildings, the keep and the mine are in the way,
// so where a building stands matters too). Peasants can also walk out through the gate, over the
// bridge and round the land outside the walls (to the docks on the riverbank). Pure TS.
import type { BuildingId } from './buildings';
import {
  CASTLE,
  FIXED_SPOTS,
  FOOTPRINTS,
  GATE_TILES,
  MAP_SIZE,
  STARTING_ROAD_RUNS,
  coveredTiles,
  doorTiles,
  isOpenGround,
  MAIN_ROAD,
  needsRoad,
  onGateRoad,
  onMainRoad,
  tileKey,
  zoneAt,
  type Footprint,
  type Placements,
  type Spot,
} from './cityMap';
import { rockAt } from './rocks';
import type { Resource } from './resources';

export const ROAD_KINDS = ['dirt', 'stone', 'granite'] as const;
export type RoadKind = (typeof ROAD_KINDS)[number];
/** Laid road tiles, by tile key ("x,y"). */
export type Roads = Record<string, RoadKind>;

/** Walking speed on bare ground, in tiles per second, and over rocks not yet cleared. */
/** (Off the roads people walk 70% slower than on a dirt road, so they take a road wherever it's quicker; rocks
 * slow them as much again as before.) */
export const GROUND_SPEED = 0.45;
export const ROCK_SPEED = 0.18;

export const ROAD_INFO: Record<RoadKind, { name: string; speed: number; gold: number; resources: Partial<Record<Resource, number>> }> = {
  dirt: { name: 'Dirt road', speed: 1.5, gold: 2, resources: {} },
  stone: { name: 'Stone road', speed: 2, gold: 6, resources: {} },
  granite: { name: 'Granite road', speed: 2.5, gold: 4, resources: { granite: 2 } },
};

/** No rocks cleared (for callers that don't care about rocks). */
const NO_CLEARING: readonly string[] = [];

export const isRoadKind = (kind: unknown): kind is RoadKind => typeof kind === 'string' && (ROAD_KINDS as readonly string[]).includes(kind);

/** The dirt roads of a new game (minus any tile a building stands on). */
export function startingRoads(placements: Placements): Roads {
  const covered = coveredTiles(placements);
  const roads: Roads = {};
  for (const [x0, y0, w, d] of STARTING_ROAD_RUNS) {
    for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + d; y++) if (!covered.has(tileKey(x, y))) roads[tileKey(x, y)] = 'dirt';
  }
  return roads;
}

// ——— Roads to the keep and the gate ———

const box = (id: 'keep' | 'gate') => ({ ...(FIXED_SPOTS[id] as Spot), ...FOOTPRINTS[id] });
const inBox = (b: Spot & Footprint, x: number, y: number) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.d;
// Beside a footprint (sharing an edge with one of its tiles), not in it.
const beside = (b: Spot & Footprint, x: number, y: number) =>
  !inBox(b, x, y) && (inBox(b, x - 1, y) || inBox(b, x + 1, y) || inBox(b, x, y - 1) || inBox(b, x, y + 1));
const KEEP_BOX = box('keep');
const GATE_BOX = box('gate');
const NEXT: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const accessCache = new WeakMap<Roads, ReadonlySet<string>>();
/**
 * The road tiles a building's door may be on: every stretch of road (tiles joined side by side) that
 * reaches both the keep and the main gate. Worked out once per roads object.
 */
export function accessRoads(roads: Roads): ReadonlySet<string> {
  const known = accessCache.get(roads);
  if (known) return known;
  const access = new Set<string>();
  const seen = new Set<string>();
  for (const start of Object.keys(roads)) {
    if (seen.has(start)) continue;
    const stretch = [start];
    seen.add(start);
    let keep = false;
    let gate = false;
    for (let i = 0; i < stretch.length; i++) {
      const [x, y] = stretch[i].split(',').map(Number);
      keep ||= beside(KEEP_BOX, x, y);
      gate ||= beside(GATE_BOX, x, y);
      for (const [dx, dy] of NEXT) {
        const key = tileKey(x + dx, y + dy);
        if (roads[key] && !seen.has(key)) {
          seen.add(key);
          stretch.push(key);
        }
      }
    }
    if (keep && gate) for (const key of stretch) access.add(key);
  }
  accessCache.set(roads, access);
  return access;
}

/** Is there a road at this building's door joined to the keep and the main gate? */
export const hasRoadAccess = (id: BuildingId, spot: Spot, roads: Roads) => {
  const access = accessRoads(roads);
  return doorTiles(id, spot).some((tile) => access.has(tileKey(tile.x, tile.y)));
};

/**
 * Lay dirt road, free, from the door of every placed building that lacks one to the nearest road joined to
 * the keep and the gate (the shortest way over open town ground; rocks on it are the caller's to clear;
 * the main road always joins the keep to the gate). For a new game's first buildings and saves from
 * before buildings needed a road. Returns the roads, and how many tiles were laid.
 */
export function joinBuildings(placements: Placements, roads: Roads): { roads: Roads; laid: number } {
  const covered = coveredTiles(placements);
  const open = (x: number, y: number) => zoneAt(x, y) === 'town' && isOpenGround(x, y) && !covered.has(tileKey(x, y));
  let joined = roads;
  let laid = 0;
  for (const [id, spot] of Object.entries(placements) as [BuildingId, Spot][]) {
    if (!needsRoad(id) || hasRoadAccess(id, spot, joined)) continue;
    const access = accessRoads(joined);
    // Breadth-first from the door tiles to the first tile of the joined roads.
    const from = new Map<string, string | null>();
    const queue: Spot[] = [];
    for (const door of doorTiles(id, spot)) {
      if (!open(door.x, door.y)) continue;
      from.set(tileKey(door.x, door.y), null);
      queue.push(door);
    }
    let reached: string | null = null;
    for (let i = 0; i < queue.length && !reached; i++) {
      const { x, y } = queue[i];
      for (const [dx, dy] of NEXT) {
        const key = tileKey(x + dx, y + dy);
        if (from.has(key)) continue;
        if (access.has(key)) {
          reached = tileKey(x, y);
          break;
        }
        if (!open(x + dx, y + dy)) continue;
        from.set(key, tileKey(x, y));
        queue.push({ x: x + dx, y: y + dy });
      }
    }
    if (!reached) continue;
    joined = { ...joined };
    for (let key: string | null = reached; key; key = from.get(key) ?? null) {
      if (!joined[key]) {
        joined[key] = 'dirt';
        laid += 1;
      }
    }
  }
  return { roads: joined, laid };
}

/** The roads with the main road (keep → gate) whole again: dirt wherever it's missing and nothing stands. */
export function withMainRoad(roads: Roads, covered: Set<string>): Roads {
  let whole = roads;
  for (let y = MAIN_ROAD.y0; y <= MAIN_ROAD.y1; y++) {
    const key = tileKey(MAIN_ROAD.x, y);
    if (whole[key] || covered.has(key)) continue;
    if (whole === roads) whole = { ...roads };
    whole[key] = 'dirt';
  }
  return whole;
}

/** Why a road (or taking one up) can't happen on this tile, or null if it can (`cleared`: rocks cleared so far). */
export function roadProblem(spot: Spot, kind: RoadKind | 'erase', roads: Roads, covered: Set<string>, cleared: readonly string[] = NO_CLEARING): string | null {
  const key = tileKey(spot.x, spot.y);
  if (kind === 'erase') return onMainRoad(spot.x, spot.y) ? 'The main road from the keep to the gate stays: it can’t be taken up.' : roads[key] ? null : 'No road there.';
  if (zoneAt(spot.x, spot.y) !== 'town' || !isOpenGround(spot.x, spot.y)) return 'Roads go on open ground inside the wall.';
  if (covered.has(key)) return 'A building stands there.';
  if (rockAt(cleared, spot.x, spot.y)) return 'Rocks in the way: clear them first.';
  if (roads[key] === kind) return `There’s a ${ROAD_INFO[kind].name.toLowerCase()} there already.`;
  return null;
}

// ——— Walking ———

/** A walk: its time in seconds, and the points walked through (tile units) with the time at each. */
export type Walk = { time: number; points: number[][]; times: number[] };

type Grid = { open: Uint8Array; slow: Float64Array; cache: Map<string, Walk | null> };
const index = (x: number, y: number) => y * MAP_SIZE + x;

// The walking grid for a layout: which tiles can be walked, and the seconds each one takes.
const grids = new WeakMap<Placements, WeakMap<Roads, WeakMap<readonly string[], Grid>>>();
function gridFor(placements: Placements, roads: Roads, cleared: readonly string[]): Grid {
  let byRoads = grids.get(placements);
  if (!byRoads) {
    byRoads = new WeakMap();
    grids.set(placements, byRoads);
  }
  let byRocks = byRoads.get(roads);
  if (!byRocks) {
    byRocks = new WeakMap();
    byRoads.set(roads, byRocks);
  }
  const cached = byRocks.get(cleared);
  if (cached) return cached;
  const covered = coveredTiles(placements);
  const open = new Uint8Array(MAP_SIZE * MAP_SIZE);
  const slow = new Float64Array(MAP_SIZE * MAP_SIZE);
  for (let x = 0; x < MAP_SIZE; x++) {
    for (let y = 0; y < MAP_SIZE; y++) {
      const key = tileKey(x, y);
      const zone = zoneAt(x, y);
      // The town, the land outside the walls, the road out over the bridge, and the gateway itself.
      const gateway = x === GATE_TILES[1] && y === CASTLE.y1;
      const ground = (zone === 'town' || zone === 'enemy' || zone === 'traps') && !covered.has(key);
      if (!ground && !gateway && !onGateRoad(x, y)) continue;
      open[index(x, y)] = 1;
      const road = roads[key];
      slow[index(x, y)] = 1 / (road ? ROAD_INFO[road].speed : rockAt(cleared, x, y) ? ROCK_SPEED : GROUND_SPEED);
    }
  }
  const grid = { open, slow, cache: new Map<string, Walk | null>() };
  byRocks.set(cleared, grid);
  return grid;
}

// The carts' grid: road tiles only (not under a building), each at its road's speed.
const roadGrids = new WeakMap<Placements, WeakMap<Roads, Grid>>();
function roadGridFor(placements: Placements, roads: Roads): Grid {
  let byRoads = roadGrids.get(placements);
  if (!byRoads) {
    byRoads = new WeakMap();
    roadGrids.set(placements, byRoads);
  }
  const cached = byRoads.get(roads);
  if (cached) return cached;
  const covered = coveredTiles(placements);
  const open = new Uint8Array(MAP_SIZE * MAP_SIZE);
  const slow = new Float64Array(MAP_SIZE * MAP_SIZE);
  for (const [key, kind] of Object.entries(roads)) {
    if (covered.has(key)) continue;
    const [x, y] = key.split(',').map(Number);
    if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) continue;
    open[index(x, y)] = 1;
    slow[index(x, y)] = 1 / ROAD_INFO[kind].speed;
  }
  const grid = { open, slow, cache: new Map<string, Walk | null>() };
  byRoads.set(roads, grid);
  return grid;
}

// Walkable tiles beside a footprint, with the point on its edge a walker leaves or enters by.
function doors(grid: Grid, plot: Spot & Footprint) {
  const found: { x: number; y: number; edge: number[] }[] = [];
  const add = (x: number, y: number, edge: number[]) => {
    if (x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE && grid.open[index(x, y)]) found.push({ x, y, edge });
  };
  for (let x = plot.x; x < plot.x + plot.w; x++) {
    add(x, plot.y - 1, [x + 0.5, plot.y]);
    add(x, plot.y + plot.d, [x + 0.5, plot.y + plot.d]);
  }
  for (let y = plot.y; y < plot.y + plot.d; y++) {
    add(plot.x - 1, y, [plot.x, y + 0.5]);
    add(plot.x + plot.w, y, [plot.x + plot.w, y + 0.5]);
  }
  return found;
}

// A small binary heap of [cost, tile] for Dijkstra.
class Heap {
  private items: number[][] = [];
  get size() {
    return this.items.length;
  }
  push(cost: number, tile: number) {
    const items = this.items;
    items.push([cost, tile]);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent][0] <= items[i][0]) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop(): number[] {
    const items = this.items;
    const top = items[0];
    const last = items.pop() as number[];
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < items.length && items[left][0] < items[smallest][0]) smallest = left;
        if (right < items.length && items[right][0] < items[smallest][0]) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

/** The quickest walk from one footprint to another, or null if there's no way through (rocks only slow it). */
export function walkBetween(from: Spot & Footprint, to: Spot & Footprint, placements: Placements, roads: Roads, cleared: readonly string[] = NO_CLEARING): Walk | null {
  return route(gridFor(placements, roads, cleared), from, to);
}

/** The quickest way from one footprint to another on the roads alone (a road tile beside each), or null if no road joins them. */
export function roadBetween(from: Spot & Footprint, to: Spot & Footprint, placements: Placements, roads: Roads): Walk | null {
  return route(roadGridFor(placements, roads), from, to);
}

/**
 * A cart's way between two footprints: along the roads; only where no road joins them (one taken up since)
 * over open ground like a walker, so a delivery never stalls.
 */
export const cartWay = (from: Spot & Footprint, to: Spot & Footprint, placements: Placements, roads: Roads, cleared: readonly string[] = NO_CLEARING) =>
  roadBetween(from, to, placements, roads) ?? walkBetween(from, to, placements, roads, cleared);

// Dijkstra over a grid from the tiles beside one footprint to the tiles beside another (cached per grid).
function route(grid: Grid, from: Spot & Footprint, to: Spot & Footprint): Walk | null {
  const key = `${String(from.x)},${String(from.y)},${String(from.w)},${String(from.d)}>${String(to.x)},${String(to.y)},${String(to.w)},${String(to.d)}`;
  if (grid.cache.has(key)) return grid.cache.get(key) ?? null;
  const starts = doors(grid, from);
  const ends = new Map(doors(grid, to).map((door) => [index(door.x, door.y), door.edge]));
  const size = MAP_SIZE * MAP_SIZE;
  const cost = new Float64Array(size).fill(Infinity);
  const previous = new Int32Array(size).fill(-1);
  const startEdge = new Map<number, number[]>();
  const heap = new Heap();
  for (const start of starts) {
    const tile = index(start.x, start.y);
    // Half a tile from the door to the middle of the first tile.
    const first = grid.slow[tile] / 2;
    if (first < cost[tile]) {
      cost[tile] = first;
      startEdge.set(tile, start.edge);
      heap.push(first, tile);
    }
  }
  let reached = -1;
  while (heap.size > 0) {
    const [spent, tile] = heap.pop();
    if (spent > cost[tile]) continue;
    if (ends.has(tile)) {
      reached = tile;
      break;
    }
    const x = tile % MAP_SIZE;
    const y = (tile - x) / MAP_SIZE;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= MAP_SIZE || ny >= MAP_SIZE) continue;
      const next = index(nx, ny);
      if (!grid.open[next]) continue;
      // Half a tile at the speed of each.
      const step = spent + (grid.slow[tile] + grid.slow[next]) / 2;
      if (step < cost[next]) {
        cost[next] = step;
        previous[next] = tile;
        heap.push(step, next);
      }
    }
  }
  let walk: Walk | null = null;
  if (reached >= 0) {
    const tiles: number[] = [];
    for (let tile = reached; tile >= 0; tile = previous[tile]) tiles.unshift(tile);
    const centre = (tile: number) => [(tile % MAP_SIZE) + 0.5, Math.floor(tile / MAP_SIZE) + 0.5];
    const points = [startEdge.get(tiles[0]) ?? centre(tiles[0]), ...tiles.map(centre), ends.get(reached) ?? centre(reached)];
    const times = [0, cost[tiles[0]]];
    for (let i = 1; i < tiles.length; i++) times.push(cost[tiles[i]]);
    const total = cost[reached] + grid.slow[reached] / 2;
    times.push(total);
    walk = { time: Math.round(total * 100) / 100, points, times };
  }
  grid.cache.set(key, walk);
  return walk;
}

/** A walk carried on past its end, in straight legs over open ground (off the map, where there are no tiles). */
export function walkOn(walk: Walk, points: number[][]): Walk {
  const all = [...walk.points];
  const times = [...walk.times];
  for (const point of points) {
    const [px, py] = all[all.length - 1];
    times.push(times[times.length - 1] + Math.hypot(point[0] - px, point[1] - py) / GROUND_SPEED);
    all.push(point);
  }
  const time = times[times.length - 1];
  return { time: Math.round(time * 100) / 100, points: all, times };
}

// ——— What walking does ———

/** Seconds of walking between the mine and the warehouse that hauling is balanced for: a new game's walk
 * (5.1 s since the warehouse grew to 5 × 5 — its yard reaches within two tiles of the mine). */
export const HAUL_REFERENCE = 5;
/** Seconds of walking from the warehouse to a building site that construction is balanced for. */
export const BUILD_REFERENCE = 12;

/** Goods the haulers move per tick, relative to the reference walk (no way through: half). */
export function haulFactor(walk: Walk | null) {
  if (!walk) return 0.5;
  return Math.round(Math.min(3, Math.max(0.5, HAUL_REFERENCE / Math.max(1, walk.time))) * 100) / 100;
}

/** How fast builders work, by their walk from the warehouse to the site (no way through: slowest). */
export function buildFactor(walk: Walk | null) {
  if (!walk) return 0.7;
  return Math.round(Math.min(1.3, Math.max(0.7, 1 + (BUILD_REFERENCE - walk.time) / 40)) * 100) / 100;
}
