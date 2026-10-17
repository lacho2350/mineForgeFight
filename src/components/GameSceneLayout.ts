// Drawing the stronghold's map (src/game/cityMap.ts) in isometric view, like Firefly's Stronghold:
// projection, building plots from their placements, tap outlines. Skia-free: the screen uses it for
// taps and badges, the canvas for drawing.
import type { BuildingId } from '../game/buildings';
import { CASTLE, FOOTPRINTS, MAP_SIZE, MINE_SPOT, spotOf, type Placements } from '../game/cityMap';
import { FORGE_IDS, type ForgeId } from '../game/forges';
import { HOUSE_IDS, type HouseId } from '../game/houses';
import { FISHERY_IDS, ORCHARD_IDS, PASTURE_IDS, type FisheryId, type OrchardId, type PastureId } from '../game/farms';
import { WOODCUTTER_IDS, type WoodcutterId } from '../game/woodcutters';
import { CHURCH_IDS, FAIRGROUND_IDS, GARDENS_IDS, type ChurchId, type FairgroundId, type GardensId } from '../game/moodBuildings';

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
  ...(Object.fromEntries(HOUSE_IDS.map((id) => [id, 26])) as Record<HouseId, number>),
  warehouse: 50,
  foundry: 80,
  research: 72,
  armory: 50,
  ...(Object.fromEntries(WOODCUTTER_IDS.map((id) => [id, 34])) as Record<WoodcutterId, number>),
  granary: 44,
  ...(Object.fromEntries(ORCHARD_IDS.map((id) => [id, 22])) as Record<OrchardId, number>),
  ...(Object.fromEntries(FISHERY_IDS.map((id) => [id, 26])) as Record<FisheryId, number>),
  ...(Object.fromEntries(PASTURE_IDS.map((id) => [id, 14])) as Record<PastureId, number>),
  ...(Object.fromEntries(FAIRGROUND_IDS.map((id) => [id, 46])) as Record<FairgroundId, number>),
  ...(Object.fromEntries(CHURCH_IDS.map((id) => [id, 78])) as Record<ChurchId, number>),
  ...(Object.fromEntries(GARDENS_IDS.map((id) => [id, 22])) as Record<GardensId, number>),
  depot: 40,
  ...(Object.fromEntries(FORGE_IDS.map((id) => [id, 48])) as Record<ForgeId, number>),
  wall: 44,
  towers: 96,
  gate: 70,
  moat: 4,
  docks: 40,
  guardhouse: 44,
  archery: 40,
  barracks: 50,
  monastery: 56,
  balloonWorks: 96,
  stables: 48,
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

/** The mine headframe (the toolbar's MINE button goes down). */
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

// ——— Tapping a building ———
// A tap goes to the front-most building whose drawn shape holds it. The shape is what's actually drawn, not
// the plot's full box: as tall as the building is at its tier (`TALL` is its tallest look, chimneys and towers
// included), set in from the plot's edges as the art is, and with the roof narrowing to its ridge — so a
// building in front no longer catches taps meant for its neighbours. A tap that hits no shape goes to the
// building whose footprint is under it (small cottages stay easy to hit), else to the ground.

// Is (x, y) inside the polygon? (Even-odd ray casting.)
export function inside(points: { x: number; y: number }[], x: number, y: number) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** Empty plots are tapped on the ground; built ones on the building. */
const EMPTY_TALL = 8;
/** How far in from its plot's edges a building is drawn (tiles). */
const ART_INSET = 0.12;
/** The walls rise this share of a building's height; the roof above narrows to its ridge. */
const WALL_SHARE = 0.62;
const RIDGE_SHARE = 0.45;

/** How tall a building is drawn at this level (pixels): 70% of its tallest look at the first tier, all of it at the last. */
export const tapHeight = (plot: Plot, level: number) => (level <= 0 ? EMPTY_TALL : plot.tall * Math.min(1, 0.55 + 0.15 * Math.min(4, Math.ceil(level / 5))));

/** The shape a tap must land in to pick a building: walls up from its inset footprint, and a roof narrowing to its ridge. */
export function tapShape(plot: Plot, level: number) {
  const tall = tapHeight(plot, level);
  const inset = Math.min(ART_INSET, plot.w / 4, plot.d / 4);
  const x0 = plot.x + inset;
  const y0 = plot.y + inset;
  const x1 = plot.x + plot.w - inset;
  const y1 = plot.y + plot.d - inset;
  if (level <= 0) return silhouette({ ...plot, x: x0, y: y0, w: x1 - x0, d: y1 - y0 }, tall);
  const walls = tall * WALL_SHARE;
  const left = iso(x0, y1);
  const right = iso(x1, y0);
  const top = iso((x0 + x1) / 2, (y0 + y1) / 2, tall);
  const half = ((right.x - left.x) / 2) * RIDGE_SHARE;
  return [left, iso(x1, y1), right, iso(x1, y0, walls), { x: top.x + half, y: top.y }, { x: top.x - half, y: top.y }, iso(x0, y1, walls)];
}

/** The building a tap at screen point (x, y) picks (built or a staked plot), or null for the ground. */
export function pickBuilding(placements: Placements, levels: Partial<Record<BuildingId, number>>, x: number, y: number): BuildingId | null {
  const targets = tapTargets(placements);
  for (let index = targets.length - 1; index >= 0; index--) {
    const { id, plot } = targets[index];
    if (inside(tapShape(plot, levels[id] ?? 0), x, y)) return id;
  }
  // Nothing drawn there: the building standing on that ground, if any (front-most first).
  const at = groundAt(x, y);
  for (let index = targets.length - 1; index >= 0; index--) {
    const { id, plot } = targets[index];
    if (id === 'wall' || id === 'moat') continue;
    if (at.x >= plot.x && at.x < plot.x + plot.w && at.y >= plot.y && at.y < plot.y + plot.d) return id;
  }
  return null;
}

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

/** How far down the map a plot reaches: bigger is nearer the viewer, drawn later (in front). */
export const plotDepth = depth;

const overlapping = (a: SceneRect, b: SceneRect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Something on the map that must stay in view: the buildings in front of it are drawn see-through
 * (`except` the building it belongs to — the tapped one, the stockpile's warehouse). */
export type Watched = { plot: Plot; rect: SceneRect; except?: BuildingId };

/** What's watched for a plot: itself, raised as tall as it is. */
export const watch = (plot: Plot, except?: BuildingId): Watched => ({ plot, rect: plotRect(plot), except });

/**
 * The buildings drawn see-through, Stronghold-style: every built one (not the fortifications) that stands
 * in front of something watched — the tapped building, the stockpile, the building being placed — and
 * overlaps it on screen, so it would hide it.
 */
export function fadedBuildings(buildings: Record<BuildingId, number>, placements: Placements, watched: Watched[]): BuildingId[] {
  if (watched.length === 0) return [];
  const faded: BuildingId[] = [];
  for (const id of Object.keys(FOOTPRINTS) as BuildingId[]) {
    if (id === 'wall' || id === 'towers' || id === 'gate' || id === 'moat' || buildings[id] <= 0) continue;
    const plot = plotOf(id, placements);
    if (!plot) continue;
    const rect = plotRect(plot);
    if (watched.some((w) => w.except !== id && depth(plot) > depth(w.plot) && overlapping(rect, w.rect))) faded.push(id);
  }
  return faded.sort();
}
