// Drawing the stronghold's map (src/game/cityMap.ts) in isometric view, like Firefly's Stronghold:
// projection, building plots from their placements, tap outlines. Skia-free: the screen uses it for
// taps and badges, the canvas for drawing.
import type { BuildingId } from '../game/buildings';
import { CASTLE, FOOTPRINTS, MAP_SIZE, MINE_SPOT, spotOf, type Placements } from '../game/cityMap';
import { FORGE_IDS, type ForgeId } from '../game/forges';

export { CAMPFIRE, CASTLE, DOCK_TILES, DOCKS_ROW, GATE_ROAD, GATE_TILES, HARBOUR, MAP_SIZE, PARADE, PLAZA, RIVER_ROWS, TOWER_SPOTS, WALL_TILES, zoneAt } from '../game/cityMap';

export const TILE_HW = 16; // half a tile's width on screen
export const TILE_HH = 8; // half a tile's height on screen
/** Room above the map: sky and mountains (`SKY_ROOM`), then room for tall buildings. */
export const SKY_ROOM = 170;
const HEADROOM = SKY_ROOM + 110;
/** Room below the map for the mountains on the near sides. */
export const FOOT_ROOM = 200;

export const SCENE_WIDTH = MAP_SIZE * 2 * TILE_HW;
export const SCENE_HEIGHT = HEADROOM + MAP_SIZE * 2 * TILE_HH + 12 + FOOT_ROOM;
/** The part of the scene the castle image covers (the map and its buildings, without sky or foothills). */
export const STILL_TOP = SKY_ROOM;
export const STILL_HEIGHT = SCENE_HEIGHT - SKY_ROOM - FOOT_ROOM;
/** Where map point (0, 0) is on screen (exported for worklets, which can't call `groundAt`). */
export const ORIGIN_X = SCENE_WIDTH / 2;
export const ORIGIN_Y = HEADROOM;

/** Screen position of a map point (tile units; corners are whole numbers) raised `z` pixels. */
export function iso(x: number, y: number, z = 0) {
  return { x: ORIGIN_X + (x - y) * TILE_HW, y: ORIGIN_Y + (x + y) * TILE_HH - z };
}

/** The map point (tile units) under a screen position on the ground. */
export function groundAt(sx: number, sy: number) {
  const a = (sx - ORIGIN_X) / TILE_HW; // x − y
  const b = (sy - ORIGIN_Y) / TILE_HH; // x + y
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** A footprint on the map: from (x, y), `w` tiles along x and `d` along y. */
export type Plot = { x: number; y: number; w: number; d: number; /** Tallest it gets, in pixels (for taps). */ tall: number };

const TALL: Record<BuildingId, number> = {
  keep: 120,
  houses: 40,
  warehouse: 50,
  foundry: 80,
  research: 72,
  armory: 50,
  depot: 40,
  ...(Object.fromEntries(FORGE_IDS.map((id) => [id, 48])) as Record<ForgeId, number>),
  wall: 44,
  towers: 96,
  gate: 70,
  moat: 4,
  docks: 40,
  guardhouse: 44,
  archery: 34,
  barracks: 50,
  monastery: 70,
  balloonWorks: 96,
  stables: 44,
  griffinEyrie: 92,
  chapel: 78,
  sanctum: 64,
};

/** A building's plot where it stands (or would stand at `at`), or null if it hasn't been placed. */
export function plotOf(id: BuildingId, placements: Placements, at?: { x: number; y: number }): Plot | null {
  const spot = at ?? spotOf(id, placements);
  if (!spot) return null;
  return { ...spot, ...FOOTPRINTS[id], tall: TALL[id] };
}

/** The mine headframe (tap it to go down). */
export const MINE_PLOT: Plot = { ...MINE_SPOT, tall: 70 };

export type SceneRect = { x: number; y: number; width: number; height: number };

/** A building's outline on screen: its footprint raised `tall` pixels (a box seen from the front). */
export function silhouette(plot: Plot, tall: number) {
  return [
    iso(plot.x, plot.y + plot.d),
    iso(plot.x + plot.w, plot.y + plot.d),
    iso(plot.x + plot.w, plot.y),
    iso(plot.x + plot.w, plot.y, tall),
    iso(plot.x, plot.y, tall),
    iso(plot.x, plot.y + plot.d, tall),
  ];
}

/** The screen rectangle around a footprint and its building (scene coordinates). */
export function plotRect(plot: Plot): SceneRect {
  const left = iso(plot.x, plot.y + plot.d).x;
  const right = iso(plot.x + plot.w, plot.y).x;
  const top = iso(plot.x, plot.y).y - plot.tall;
  const bottom = iso(plot.x + plot.w, plot.y + plot.d).y;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

// The wall runs behind half the bailey, so it's tapped at the front end of its left run; the moat (a
// ring too) on its front stretch west of the gate.
const WALL_TAP: Plot = { x: CASTLE.x0, y: CASTLE.y1 - 4, w: 1, d: 4, tall: 40 };
const MOAT_TAP: Plot = { x: CASTLE.x0 + 4, y: CASTLE.y1 + 1, w: 12, d: 1, tall: 6 };
const depth = (plot: Plot) => plot.x + plot.w + plot.y + plot.d;

/** What can be tapped on the map, back to front (later ones win where they overlap). */
export function tapTargets(placements: Placements): { id: BuildingId; plot: Plot }[] {
  const targets: { id: BuildingId; plot: Plot }[] = [];
  for (const id of Object.keys(FOOTPRINTS) as BuildingId[]) {
    if (id === 'wall' || id === 'moat') continue;
    const plot = plotOf(id, placements);
    if (plot) targets.push({ id, plot });
  }
  targets.sort((a, b) => depth(a.plot) - depth(b.plot));
  return [{ id: 'moat', plot: MOAT_TAP }, { id: 'wall', plot: WALL_TAP }, ...targets];
}

export const SHAFT_RECT: SceneRect = plotRect(MINE_PLOT);
