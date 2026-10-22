// The cottages' homes. Each is kept by a woman of its own (not one of the workers): she walks to the
// river for water and to the store (the granary, or the warehouse) for food, a load at a time, and the
// peasants who sleep there drink and eat what she brings. Peasants sleep where there's water and food
// if there's room — the happy cottages first, then the keep's hall (fed straight from the store), and
// only then the unhappy ones. A cottage's people are happy with water and food in and a road at its door
// joined to the keep and the main gate; an unhappy one (run dry, or cut off) drags the hold's happiness
// down (happiness.ts: its sleepers count as sleeping badly) and nobody new moves into it. Pure TS.
import { KEEP_BEDS, type BuildingLevels } from './buildings';
import { FOOTPRINTS, MAP_SIZE, RIVER_ROWS, spotOf, zoneAt, type Footprint, type Placements, type Spot } from './cityMap';
import { FOODS, FOOD_PER_PEASANT } from './farms';
import { HOUSE_IDS, houseBeds, type HouseId } from './houses';
import { hasRoadAccess, walkBetween, type Roads } from './roads';
import { techBonuses, type TechId } from './techs';
import type { Stock } from './resources';

/** An errand: to the river for water or to the store for food, there and back the same way (`seconds` each way). */
export type Errand = { kind: 'water' | 'food'; startedAt: number; seconds: number; to: Spot & Footprint; load: number };
/** What a home has in, and its woman's errand (null: she's at home). */
export type Home = { water: number; food: number; errand: Errand | null };
export type Homes = Partial<Record<HouseId, Home>>;

/** Water a peasant drinks each second (a bucket a minute); food is FOOD_PER_PEASANT, as anywhere. */
export const WATER_PER_PEASANT = 1 / 60;
/**
 * What a home holds, and what its woman carries in one trip: a full cottage (9 sleepers) gets through a
 * load of each in about two minutes, so a cottage within a few dozen tiles' walk of the river and the
 * store (quicker on roads, slower over rocks) never runs dry.
 */
export const PANTRY = { water: 40, food: 20 } as const;
export const LOAD = { water: 20, food: 10 } as const;
/** A home with its pantry full (a new game's first cottage, and cottages in older saves). */
export const fullHome = (): Home => ({ water: PANTRY.water, food: PANTRY.food, errand: null });
const emptyHome = (): Home => ({ water: 0, food: 0, errand: null });

const hundredths = (value: number) => Math.round(value * 100) / 100;

/** Does a home have both water and food in? */
export const isKept = (home: Home | undefined) => !!home && home.water > 0 && home.food > 0;

/** What the sleeping arrangements follow; without the layout (`placements`, `roads`) every cottage counts as having its road. */
type Sleeping = { population: number; buildings: BuildingLevels; techs: readonly TechId[]; homes: Homes; placements?: Placements; roads?: Roads };

/** Has a cottage its road: one at its door joined to the keep and the main gate (roads.ts)? */
export const hasHomeRoad = (id: HouseId, { placements, roads }: Pick<Sleeping, 'placements' | 'roads'>) => {
  const spot = placements?.[id];
  return !spot || !roads || hasRoadAccess(id, spot, roads);
};

/** Are a cottage's people happy: water and food in, and its road? */
export const isHappy = (id: HouseId, state: Pick<Sleeping, 'homes' | 'placements' | 'roads'>) => isKept(state.homes[id]) && hasHomeRoad(id, state);

/**
 * Who sleeps where: in each cottage (by id) and in the keep's hall, and how many beds each has. The kept
 * cottages fill first, then the hall (while the store has food), then the cottages run dry, then the
 * hall again; anyone left over (beds pulled down) sleeps in the hall.
 */
export function sleepers(state: Sleeping, storeHasFood: boolean) {
  const { population, buildings, techs } = state;
  const bonus = 1 + techBonuses(techs).beds;
  const beds = Object.fromEntries(HOUSE_IDS.map((id) => [id, Math.floor(houseBeds(buildings[id]) * bonus)])) as Record<HouseId, number>;
  const residents = Object.fromEntries(HOUSE_IDS.map((id) => [id, 0])) as Record<HouseId, number>;
  const hallBeds = Math.floor(KEEP_BEDS * bonus);
  let hall = 0;
  let left = population;
  const fill = (ids: readonly HouseId[]) => {
    for (const id of ids) {
      const take = Math.min(left, beds[id]);
      residents[id] += take;
      left -= take;
    }
  };
  const kept = HOUSE_IDS.filter((id) => beds[id] > 0 && isHappy(id, state));
  const dry = HOUSE_IDS.filter((id) => beds[id] > 0 && !isHappy(id, state));
  const intoHall = () => {
    const take = Math.min(left, hallBeds - hall);
    hall += take;
    left -= take;
  };
  fill(kept);
  if (storeHasFood) intoHall();
  fill(dry);
  intoHall();
  hall += left;
  return { residents, beds, hall, hallBeds };
}

/** Peasants sleeping badly: in an unhappy cottage — run dry, or with no road — or in the hall with no food in store. They drag the hold's happiness down (happiness.ts). */
export function drySleepers(state: Sleeping & { hungry: boolean }) {
  if (state.population <= 0) return 0;
  const { residents, hall } = sleepers(state, !state.hungry);
  return HOUSE_IDS.reduce((sum, id) => sum + (isHappy(id, state) ? 0 : residents[id]), 0) + (state.hungry ? hall : 0);
}

/** Is there a bed a newcomer can move into: in a kept cottage, or in the keep's hall while the store has food? */
export function roomForNewcomer(state: Sleeping & { hungry: boolean }) {
  const { residents, beds, hall, hallBeds } = sleepers(state, !state.hungry);
  return HOUSE_IDS.some((id) => isHappy(id, state) && residents[id] < beds[id]) || (!state.hungry && hall < hallBeds);
}

/** Where a cottage's woman draws water: the riverside tile nearest the cottage, just inside the river wall. */
export function waterSpot(house: Spot): Spot & Footprint {
  const y = RIVER_ROWS + 1;
  let best = { x: house.x, y, w: 1, d: 1 };
  let bestDistance = Infinity;
  for (let x = 0; x < MAP_SIZE; x++) {
    if (zoneAt(x, y) !== 'town') continue;
    const distance = Math.abs(x - house.x);
    if (distance < bestDistance) {
      best = { x, y, w: 1, d: 1 };
      bestDistance = distance;
    }
  }
  return best;
}

/** Where a cottage's woman fetches food: the granary if there is one, else the warehouse. */
export function foodStore(buildings: BuildingLevels, placements: Placements): (Spot & Footprint) | null {
  const id = buildings.granary > 0 && spotOf('granary', placements) ? 'granary' : 'warehouse';
  const spot = spotOf(id, placements);
  return spot ? { ...spot, ...FOOTPRINTS[id] } : null;
}

type HomesState = Sleeping & {
  placements: Placements;
  roads: Roads;
  clearedRocks: readonly string[];
};

/**
 * One second in the homes: errands come home (their loads go in), every cottage's sleepers drink and
 * eat what's in, the hall's eat from the store, and a woman at home with room for a load sets off for
 * it — whichever her home is shorter of, food only while the store has a unit or more (she takes it as
 * she sets off). `stock` is the warehouse (its food is the store's); returns the homes, the stock and whether
 * the store ran out of food (the hold is hungry).
 */
export function tickHomes(state: HomesState, stock: Stock, elapsedSeconds: number, appetite = 1) {
  // What a peasant eats a second, at the game's difficulty (`appetite`, times Normal's).
  const eats = FOOD_PER_PEASANT * appetite;
  const store: Stock = { ...stock };
  const storeFood = () => FOODS.reduce((sum, food) => sum + store[food], 0);
  const takeFood = (amount: number) => {
    const stored = storeFood();
    const taken = Math.min(amount, stored);
    if (stored > 0) for (const food of FOODS) store[food] = hundredths(Math.max(0, store[food] - (taken * store[food]) / stored));
    return taken;
  };
  const { residents, hall } = sleepers(state, storeFood() > 0);
  const homes: Homes = {};
  for (const id of HOUSE_IDS) {
    if (state.buildings[id] <= 0) continue;
    const before = state.homes[id] ?? emptyHome();
    let { water, food, errand } = before;
    if (errand && elapsedSeconds >= errand.startedAt + 2 * errand.seconds) {
      if (errand.kind === 'water') water = Math.min(PANTRY.water, water + errand.load);
      else food = Math.min(PANTRY.food, food + errand.load);
      errand = null;
    }
    water = hundredths(Math.max(0, water - residents[id] * WATER_PER_PEASANT));
    food = hundredths(Math.max(0, food - residents[id] * eats));
    const spot = spotOf(id, state.placements);
    if (!errand && spot) {
      const needs: Errand['kind'][] = [];
      if (water <= PANTRY.water - LOAD.water) needs.push('water');
      // Food only when the store has a unit or more to give (not a walk for crumbs).
      if (food <= PANTRY.food - LOAD.food && storeFood() >= 1) needs.push('food');
      // Whichever her home is shorter of.
      needs.sort((a, b) => (a === 'water' ? water / PANTRY.water : food / PANTRY.food) - (b === 'water' ? water / PANTRY.water : food / PANTRY.food));
      const kind = needs[0];
      const to = kind === 'water' ? waterSpot(spot) : kind === 'food' ? foodStore(state.buildings, state.placements) : null;
      const walk = kind && to ? walkBetween({ ...spot, ...FOOTPRINTS[id] }, to, state.placements, state.roads, state.clearedRocks) : null;
      if (kind && to && walk) {
        const load = kind === 'water' ? LOAD.water : hundredths(takeFood(LOAD.food));
        errand = { kind, startedAt: elapsedSeconds, seconds: Math.max(1, walk.time), to, load };
      }
    }
    homes[id] = errand === before.errand && water === before.water && food === before.food ? before : { water, food, errand };
  }
  // The keep's hall eats from the store.
  const hallHunger = eats * hall;
  const hungry = storeFood() < hallHunger - 1e-9 || storeFood() <= 0;
  takeFood(hallHunger);
  return { homes, stock: store, hungry };
}

/** What a woman is doing, for her cottage's pop-up. */
export function errandText(errand: Errand | null, elapsedSeconds: number, storeName: string) {
  if (!errand) return 'At home.';
  const back = Math.max(0, Math.ceil(errand.startedAt + 2 * errand.seconds - elapsedSeconds));
  const out = elapsedSeconds < errand.startedAt + errand.seconds;
  if (errand.kind === 'water') return out ? `Off to the river for water (back in ${String(back)} s).` : `Bringing water from the river (home in ${String(back)} s).`;
  return out ? `Off to the ${storeName} for food (back in ${String(back)} s).` : `Bringing ${String(errand.load)} food home from the ${storeName} (home in ${String(back)} s).`;
}
