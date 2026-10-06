import { MINE_GROUND_Y, MINE_SHAFT_COLUMN, MINE_TILE_SIZE, getExitBinX } from '../components/MineMapLayout';
import { depositAt, parseKey, siteLevel, tileKey, type MineLayout, type Site } from './mineLayout';
import { RESOURCES, type Resource } from './resources';

// The cart schedule shared by the simulation (which moves coal when a cart loads or tips) and
// the mine renderer (which draws the cart where the same schedule says it is). Both read the
// same "haul time", so the numbers change exactly when the cart is seen loading or tipping.
// Carts find their way through whatever is dug, including tunnels the player cut.

const T = MINE_TILE_SIZE;
export const CART_WIDTH = 40;
export const CART_HEIGHT = 22; // rim at y = 0, wheels touch the floor at y = CART_HEIGHT
const PUSH_SPEED = 80; // map px per second along tunnels
const SHAFT_SPEED = 70; // hoisting up/down a ladder shaft or player-dug shaft
const LIFT_SPEED = 260; // the main lift
const LOAD_TIME = 1.2; // seconds spent loading at the miner
const TIP_TIME = 1; // seconds spent tipping at the mine exit

/**
 * One round trip: a polyline of cart positions (top-left of the rim) with a duration per leg.
 * Leg i runs from point i to point i + 1; loading and tipping are legs between equal points.
 * The trip starts loading beside its miner and ends beside the next miner on the same cart's round.
 */
export type Trip = { xs: number[]; ys: number[]; legs: number[]; tipLeg: number; start: number; total: number };
/** `resources[i]` is what trip i collects (from its miner's deposit) and tips into that resource's bin. */
export type CartRoute = { trips: Trip[]; cycle: number; offset: number; liftX: number; resources: Resource[] };

const cartX = (column: number) => column * T + (T - CART_WIDTH) / 2;
const cartY = (row: number) => row * T + T - 4 - CART_HEIGHT;

// Shortest path over dug tiles from a miner's tile to the nearest lift tile.
function pathToLift(layout: MineLayout, site: Site): [number, number][] | null {
  const start = tileKey(site.row, site.column);
  const previous = new Map<string, string | null>([[start, null]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i += 1) {
    const key = queue[i];
    const { row, column } = parseKey(key);
    if (column === MINE_SHAFT_COLUMN && layout.kinds.get(key) === 'lift') {
      const path: [number, number][] = [];
      for (let at: string | null = key; at; at = previous.get(at) ?? null) {
        const tile = parseKey(at);
        path.push([tile.row, tile.column]);
      }
      return path.reverse();
    }
    for (const [dr, dc] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const next = tileKey(row + dr, column + dc);
      if (previous.has(next) || !layout.kinds.has(next)) continue;
      previous.set(next, key);
      queue.push(next);
    }
  }
  return null;
}

// Keep only the tiles where the path turns, so the cart moves in straight runs.
function corners(path: [number, number][]) {
  return path.filter((tile, index) => {
    if (index === 0 || index === path.length - 1) return true;
    const [pr, pc] = path[index - 1];
    const [nr, nc] = path[index + 1];
    return !((pr === tile[0] && nr === tile[0]) || (pc === tile[1] && nc === tile[1]));
  });
}

function legDuration(x0: number, y0: number, x1: number, y1: number, liftX: number) {
  if (y0 === y1) return Math.abs(x1 - x0) / PUSH_SPEED;
  return Math.abs(y1 - y0) / (x0 === liftX ? LIFT_SPEED : SHAFT_SPEED);
}

/** Carts working each level, keyed by level; levels not listed have one cart. */
export type LevelCarts = Record<number, number>;

export const cartsOnLevel = (carts: LevelCarts, level: number) => Math.max(1, carts[level] ?? 1);

/** Identifies one cart: its level and its number on that level. */
export const cartKey = (level: number, index: number) => `${String(level)}:${String(index)}`;
export const cartLevel = (key: string) => Number(key.split(':')[0]);

let cachedSignature = '';
let cachedRoutes = new Map<string, CartRoute>();

/**
 * Every cart's route, keyed by `cartKey`. A level's miners are shared out between its carts
 * (miner i goes to cart i mod n), each cart visiting its miners in turn, and the carts are spread
 * evenly through their schedules so they don't bunch up at the lift. Cached per layout and cart counts.
 */
export function getCartRoutes(layout: MineLayout, carts: LevelCarts): Map<string, CartRoute> {
  const signature = `${String(layout.version)}|${JSON.stringify(carts)}`;
  if (signature === cachedSignature) return cachedRoutes;
  const liftX = cartX(MINE_SHAFT_COLUMN);
  const surfaceY = MINE_GROUND_Y - CART_HEIGHT;

  const byLevel = new Map<number, { site: Site; path: [number, number][] }[]>();
  for (const site of layout.sites) {
    const path = pathToLift(layout, site);
    if (!path) continue;
    const level = siteLevel(site);
    const list = byLevel.get(level) ?? [];
    list.push({ site, path: corners(path) });
    byLevel.set(level, list);
  }

  const routes = new Map<string, CartRoute>();
  for (const [level, levelStops] of byLevel) {
    const count = Math.min(cartsOnLevel(carts, level), levelStops.length);
    for (let cart = 0; cart < count; cart += 1) {
      const stops = levelStops.filter((_, index) => index % count === cart);
      const route = buildRoute(stops, liftX, surfaceY);
      // Stagger carts: each level starts at its own offset, and its carts are evenly spaced.
      route.offset = (level + 1) * 2.3 + (cart * route.cycle) / count;
      routes.set(cartKey(level, cart), route);
    }
  }

  cachedSignature = signature;
  cachedRoutes = routes;
  return routes;
}

function buildRoute(stops: { site: Site; path: [number, number][] }[], liftX: number, surfaceY: number): CartRoute {
  let start = 0;
  const resources = stops.map(({ site }) => depositAt(site.faceRow, site.faceColumn) ?? 'coal');
  const trips = stops.map(({ path }, index) => {
    // Tip beside this resource's own bin at the mine exit.
    const exitX = getExitBinX(RESOURCES.indexOf(resources[index])) - CART_WIDTH + 12;
    const nextPath = stops[(index + 1) % stops.length].path;
    const xs: number[] = [];
    const ys: number[] = [];
    const add = (x: number, y: number) => {
      xs.push(x);
      ys.push(y);
    };
    add(cartX(path[0][1]), cartY(path[0][0])); // loading
    for (const [row, column] of path) add(cartX(column), cartY(row));
    add(liftX, surfaceY);
    add(exitX, surfaceY);
    const tipLeg = xs.length - 1;
    add(exitX, surfaceY); // tipping
    add(liftX, surfaceY);
    for (const [row, column] of [...nextPath].reverse()) add(cartX(column), cartY(row));
    const legs = xs.slice(1).map((x, i) => legDuration(xs[i], ys[i], x, ys[i + 1], liftX));
    legs[0] = LOAD_TIME;
    legs[tipLeg] = TIP_TIME;
    const total = legs.reduce((sum, leg) => sum + leg, 0);
    const trip: Trip = { xs, ys, legs, tipLeg, start, total };
    start += total;
    return trip;
  });
  return { trips, cycle: start, offset: 0, liftX, resources };
}

function legEnd(trip: Trip, leg: number) {
  let end = 0;
  for (let i = 0; i <= leg; i += 1) end += trip.legs[i];
  return end;
}


/** Which trips (by index) finished loading or tipping in the haul-time window (from, to]. */
export function cartEventsBetween(route: CartRoute, from: number, to: number, event: 'load' | 'tip') {
  const events: number[] = [];
  const firstCycle = Math.floor((from + route.offset) / route.cycle);
  const lastCycle = Math.floor((to + route.offset) / route.cycle);
  for (let cycle = firstCycle; cycle <= lastCycle; cycle += 1) {
    route.trips.forEach((trip, index) => {
      const at = cycle * route.cycle + trip.start + legEnd(trip, event === 'load' ? 0 : trip.tipLeg) - route.offset;
      if (at > from && at <= to) events.push(index);
    });
  }
  return events;
}

export type CartPose = { x: number; y: number; pushing: boolean; facing: number };

export function cartPose(time: number, trips: Trip[], cycle: number, offset: number, liftX: number): CartPose {
  'worklet';
  let t = (((time + offset) % cycle) + cycle) % cycle;
  let tripIndex = 0;
  while (tripIndex < trips.length - 1 && t >= trips[tripIndex].total) {
    t -= trips[tripIndex].total;
    tripIndex += 1;
  }
  const { xs, ys, legs, tipLeg } = trips[tripIndex];
  let leg = 0;
  while (leg < legs.length - 1 && t >= legs[leg]) {
    t -= legs[leg];
    leg += 1;
  }
  const k = legs[leg] > 0 ? Math.min(1, t / legs[leg]) : 1;
  const eased = k * k * (3 - 2 * k);
  const dx = xs[leg + 1] - xs[leg];
  const dy = ys[leg + 1] - ys[leg];
  const pushing = Math.abs(dx) > 0.5 && Math.abs(dy) < 0.5;
  // Push legs face the way the cart rolls; otherwise face the lift on the way out, the miner on the way back.
  const towardLift = liftX >= xs[0] ? 1 : -1;
  return {
    x: xs[leg] + dx * eased,
    y: ys[leg] + dy * eased,
    pushing,
    facing: pushing ? (dx > 0 ? 1 : -1) : leg <= tipLeg ? towardLift : -towardLift,
  };
}
