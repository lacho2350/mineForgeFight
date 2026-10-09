// The forest: woods on the slopes of the near mountains in front of the hold — the range beyond the
// front-left side, where the gate road leaves through the pass, and on round the front corner to the
// front-right side. It is made of stands, each on a spot of a slope (a place along the range and a height:
// low, middle or high) and holding about 100 wood. The woodcutters fell the stand nearest the end of the
// gate road; every stand cut down grows back somewhere else on the mountains (picked procedurally from a
// counter), so the forest keeps its size and never runs out. Pure TS: the renderer puts the spots on the
// mountains it draws (backdrop.tsx).
import { GATE_ROAD, MAP_SIZE, RIVER_ROWS } from './cityMap';

/** The near mountains' sides, and how far out from the map's edge they rise (backdrop.tsx draws them there). */
export type ForestSide = 'frontLeft' | 'frontRight';
export const FOREST_SIDES: ForestSide[] = ['frontLeft', 'frontRight'];
export const MOUNTAIN_FOOT = 7.5;
/** Heights up a slope a stand can stand at: low, middle, high. */
export const SLOPE_BANDS = 3;
/** Places along a side kept clear: the pass the gate road takes, and the river's gorge. */
const PASS_CLEARANCE = 4;
/** Share of the spots that stand wooded at the start (and stay so: every stand cut grows back elsewhere). */
const WOODED_PERCENT = 55;
/** Wood a stand holds: about 100 (80–120). */
export const STAND_WOOD = 100;
const STAND_SPREAD = 20;

/** Standing stands ("side:along:band") and the wood left on each. */
export type Forest = Record<string, number>;

export type ForestSpot = { side: ForestSide; along: number; band: number };
export const spotKey = ({ side, along, band }: ForestSpot) => `${side}:${String(along)}:${String(band)}`;
export function parseSpot(key: string): ForestSpot | null {
  const [side, along, band] = key.split(':');
  const spot = { side: side as ForestSide, along: Number(along), band: Number(band) };
  return isForestSpot(spot) ? spot : null;
}

/** A stable pseudo-random number (also scatters the drawn trees). */
export function forestHash(x: number, y: number, salt: number) {
  let h = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/** A spot the forest can grow on: on a near slope, clear of the pass and the gorge. */
export function isForestSpot({ side, along, band }: ForestSpot) {
  if (!FOREST_SIDES.includes(side) || !Number.isInteger(along) || !Number.isInteger(band)) return false;
  if (band < 0 || band >= SLOPE_BANDS || along < 0 || along >= MAP_SIZE) return false;
  if (side === 'frontLeft') return Math.abs(along - GATE_ROAD.x) > PASS_CLEARANCE;
  return along > RIVER_ROWS + PASS_CLEARANCE;
}

const SPOTS: ForestSpot[] = [];
for (const side of FOREST_SIDES) {
  for (let along = 0; along < MAP_SIZE; along++) for (let band = 0; band < SLOPE_BANDS; band++) if (isForestSpot({ side, along, band })) SPOTS.push({ side, along, band });
}
const sideSalt = (side: ForestSide) => (side === 'frontLeft' ? 1 : 2);
const standWood = (spot: ForestSpot, salt: number) => STAND_WOOD - STAND_SPREAD + (forestHash(spot.along, spot.band * 7 + sideSalt(spot.side), salt) % (2 * STAND_SPREAD + 1));

/** The forest at the start of a game. */
export function startingForest(): Forest {
  const forest: Forest = {};
  for (const spot of SPOTS) if (forestHash(spot.along, spot.band, sideSalt(spot.side)) % 100 < WOODED_PERCENT) forest[spotKey(spot)] = standWood(spot, 0);
  return forest;
}

/** Where the woodcutters leave the map: the last tile of the gate road, on to the pass. */
export const FOREST_EXIT = { x: GATE_ROAD.x, y: MAP_SIZE - 1 };

/** The ground (tile coordinates, off the map) at the foot of a stand's slope, where its woodcutters work. */
export function standFoot({ side, along }: ForestSpot): [number, number] {
  const out = MAP_SIZE + MOUNTAIN_FOOT - 1;
  return side === 'frontLeft' ? [along + 0.5, out] : [out, along + 0.5];
}

/**
 * The woodcutters' way on from the end of the gate road to a stand's foot (tile coordinates, off the map):
 * down the road into the pass, then along the mountains' foot — round the front corner for the
 * front-right side.
 */
export function standWay(spot: ForestSpot): number[][] {
  const road = [FOREST_EXIT.x + 0.5, MAP_SIZE + 1];
  const foot = standFoot(spot);
  if (spot.side === 'frontLeft') return [road, [FOREST_EXIT.x + 0.5, foot[1]], foot];
  const corner = MAP_SIZE + MOUNTAIN_FOOT - 2;
  return [road, [road[0], corner], [corner, corner], foot];
}

/** The stand the woodcutters are felling: the one nearest the end of the gate road, low slopes first. */
export function fellingStand(forest: Forest): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const key of Object.keys(forest)) {
    const spot = parseSpot(key);
    if (!spot) continue;
    const [x, y] = standFoot(spot);
    const distance = Math.hypot(x - FOREST_EXIT.x - 0.5, y - FOREST_EXIT.y - 0.5) + spot.band * 0.5;
    if (distance < bestDistance || (distance === bestDistance && best !== null && key < best)) {
      best = key;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Fell up to `amount` wood, stand by stand from the nearest. A stand cut down grows back as a new one
 * elsewhere on the mountains (the `serial`-th regrowth picks the spot), so the forest keeps its size.
 */
export function fellWood(forest: Forest, serial: number, amount: number): { forest: Forest; serial: number; wood: number } {
  let left = amount;
  let next = forest;
  let regrown = serial;
  for (let guard = 0; left > 1e-9 && guard < 8; guard++) {
    const key = fellingStand(next);
    if (!key) break;
    const take = Math.min(left, next[key]);
    next = { ...next, [key]: Math.round((next[key] - take) * 10) / 10 };
    left -= take;
    if (next[key] > 0) continue;
    // Cut down: it grows back somewhere else.
    const { [key]: _gone, ...rest } = next;
    next = rest;
    regrown += 1;
    const start = forestHash(regrown, 7, 3) % SPOTS.length;
    for (let i = 0; i < SPOTS.length; i++) {
      const spot = SPOTS[(start + i) % SPOTS.length];
      const where = spotKey(spot);
      if (where === key || where in next) continue;
      next = { ...next, [where]: standWood(spot, regrown) };
      break;
    }
  }
  return { forest: next, serial: regrown, wood: Math.round((amount - left) * 10) / 10 };
}

/** Trees drawn on a stand: three while it's full, fewer as it's cut. */
export const treesOnStand = (wood: number) => (wood <= 0 ? 0 : Math.min(3, Math.ceil((3 * wood) / STAND_WOOD)));

/** How the forest looks ("key=trees;…"): changes only when a stand loses a tree, so screens redraw rarely. */
export function forestLook(forest: Forest) {
  return Object.entries(forest)
    .map(([key, wood]) => `${key}=${String(treesOnStand(wood))}`)
    .sort()
    .join(';');
}

/** Wood standing in the whole forest. */
export const forestWood = (forest: Forest) => Object.values(forest).reduce((sum, wood) => sum + wood, 0);

/** Keep only stands on forest spots (an older or damaged save gets a new forest). */
export function cleanForest(saved: unknown): Forest | null {
  if (!saved || typeof saved !== 'object') return null;
  const forest: Forest = {};
  for (const [key, wood] of Object.entries(saved)) {
    const spot = parseSpot(key);
    if (spot && typeof wood === 'number' && wood > 0) forest[spotKey(spot)] = wood;
  }
  return Object.keys(forest).length > 0 ? forest : null;
}
