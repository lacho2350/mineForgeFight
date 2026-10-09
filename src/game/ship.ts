// River barges: the hold's trade. Barges come up the river from downriver one at a time and wait at the
// docks — up to five, three moored in the harbour and two on the river by its mouth — each with an order:
// so much of one resource, at a premium. They wait as long as it takes; the player fills an order (all at
// once or bit by bit) and the barge sails off when it's full, freeing its berth for the next. The docks
// set how often barges come, how big their orders are and how well they pay. Pure TS; `bargePose` is a
// worklet for the renderer.
import { DOCKS_ROW, HARBOUR, MAP_SIZE, RIVER_ROWS } from './cityMap';
import { RESOURCES, RESOURCE_PRICE, type Resource, type Stock } from './resources';

/** Barges that can wait at the docks at once. */
export const MAX_BARGES = 5;
/** Seconds a barge takes to sail between downriver and its berth. */
export const BARGE_SAIL = 20;
/** Shortest time between barges arriving. */
export const MIN_BARGE_INTERVAL = 40;

/** A barge with its order: `wants` units of `resource` at `price` gold each (`premium` over the base). */
export type Barge = {
  id: number;
  berth: number;
  resource: Resource;
  wants: number;
  price: number;
  premium: number;
  /** Game second it set off from downriver (it's at its berth `BARGE_SAIL` seconds later). */
  arrivedAt: number;
  /** Game second it sailed off, full (kept a moment for the sailing-away animation). */
  leftAt?: number;
};

/** Berths (tile units): three nose-in at the harbour's quay, two on the river either side of its mouth. */
export const BERTHS: { x: number; y: number; inHarbour: boolean }[] = [
  { x: (HARBOUR.x0 + HARBOUR.x1 + 1) / 2, y: DOCKS_ROW - 0.75, inHarbour: true },
  { x: HARBOUR.x0 + 0.5, y: DOCKS_ROW - 0.9, inHarbour: true },
  { x: HARBOUR.x1 + 0.5, y: DOCKS_ROW - 0.9, inHarbour: true },
  { x: HARBOUR.x0 - 2.5, y: RIVER_ROWS - 1.6, inHarbour: false },
  { x: HARBOUR.x1 + 3.5, y: RIVER_ROWS - 1.6, inHarbour: false },
];

const RIVER_MIDDLE = RIVER_ROWS / 2;
/** A barge's course (flat tile points): in from downriver along the river, then to its berth. */
export function bargeRoute(berth: number): number[] {
  const { x, y, inHarbour } = BERTHS[berth];
  return inHarbour ? [MAP_SIZE + 1.5, RIVER_MIDDLE, x, RIVER_MIDDLE, x, y] : [MAP_SIZE + 1.5, RIVER_MIDDLE, x + 1.5, RIVER_MIDDLE, x, y];
}

/** Still at the docks (its order not filled yet; it may still be sailing in). */
export const isWaiting = (barge: Barge) => barge.leftAt === undefined;
/** Moored at its berth, ready to trade. */
export const isMoored = (barge: Barge, now: number) => isWaiting(barge) && now >= barge.arrivedAt + BARGE_SAIL;

/**
 * Where a barge is at time `t` (seconds, fractional): [x, y, heading along x (1) or y (0), shown (1/0)].
 * Sailing in for `BARGE_SAIL` seconds from `arrivedAt`, moored, then sailing back out from `leftAt` (−1: still here).
 */
export function bargePose(t: number, arrivedAt: number, leftAt: number, route: number[]): number[] {
  'worklet';
  let along: number;
  if (leftAt >= 0 && t >= leftAt) {
    along = 1 - (t - leftAt) / BARGE_SAIL;
    if (along <= 0) return [0, 0, 1, 0];
  } else {
    along = Math.min(1, Math.max(0, (t - arrivedAt) / BARGE_SAIL));
  }
  let total = 0;
  for (let i = 2; i < route.length; i += 2) total += Math.hypot(route[i] - route[i - 2], route[i + 1] - route[i - 1]);
  let left = along * total;
  for (let i = 2; i < route.length; i += 2) {
    const length = Math.hypot(route[i] - route[i - 2], route[i + 1] - route[i - 1]);
    if (left <= length || i === route.length - 2) {
      const f = length > 0 ? Math.min(1, left / length) : 0;
      const alongX = Math.abs(route[i] - route[i - 2]) > Math.abs(route[i + 1] - route[i - 1]) ? 1 : 0;
      return [route[i - 2] + (route[i] - route[i - 2]) * f, route[i - 1] + (route[i + 1] - route[i - 1]) * f, alongX, 1];
    }
    left -= length;
  }
  return [0, 0, 1, 0];
}

// How much each resource is in demand downriver.
const DEMAND: Record<Resource, number> = {
  coal: 4, granite: 2, copper: 2, iron: 2, gold: 1, diamond: 0.5, tin: 2, silver: 1, sulfur: 1.5, salt: 2, emerald: 0.6, mithril: 0.4,
  // The barges come for the mine's goods, fish and wool — not timber, apples or mutton.
  wood: 0,
  fish: 2,
  apples: 0,
  mutton: 0,
  wool: 2,
};

/**
 * A new barge's order: mostly for goods the hold has (and less often for one another barge is already
 * asking for), about `hold` gold's worth at base prices, at a premium of 10–50% on top of the docks'
 * trade bonus.
 */
export function bargeOrder(serial: number, warehouse: Stock, hold: number, tradeBonus: number, asked: Resource[]) {
  let seed = Math.imul(serial + 1, 2654435761) | 0;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const weights = RESOURCES.map((resource) => DEMAND[resource] * (warehouse[resource] >= 1 ? 3 : 1) * (asked.includes(resource) ? 0.3 : 1));
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  let resource: Resource = 'coal';
  for (const [index, weight] of weights.entries()) {
    roll -= weight;
    if (roll <= 0) {
      resource = RESOURCES[index];
      break;
    }
  }
  const premium = Math.round((0.1 + random() * 0.4) * 100) / 100;
  const wants = Math.max(3, Math.round((hold * (0.6 + random() * 0.6)) / RESOURCE_PRICE[resource]));
  const price = Math.round(RESOURCE_PRICE[resource] * (1 + tradeBonus) * (1 + premium) * 100) / 100;
  return { resource, wants, price, premium };
}
