import { STARTING_BUILDINGS, buildingStats, KEEP_BEDS, staffNeeded } from '../src/game/buildings';
import { FOOTPRINTS } from '../src/game/cityMap';
import { FOODS } from '../src/game/farms';
import { HOUSE_IDS, MAX_PEASANTS, houseBeds } from '../src/game/houses';
import { LOAD, PANTRY, drySleepers, foodStore, roomForNewcomer, waterSpot } from '../src/game/homes';
import { isShownBuilding } from '../src/game/hold';
import { build, game, newGame, run, warehouseWith } from './support';

const withHouses = (levels: number[]) => ({
  ...STARTING_BUILDINGS,
  ...Object.fromEntries(HOUSE_IDS.map((id, index) => [id, levels[index] ?? 0])),
});
const dry = { water: 0, food: 0, errand: null };
const storeFood = () => FOODS.reduce((sum, food) => sum + game().warehouse[food], 0);

describe('workers’ cottages', () => {
  it('are many small one-tile houses, 4 beds at first and 9 at the top', () => {
    expect(HOUSE_IDS).toHaveLength(24);
    for (const id of HOUSE_IDS) expect(FOOTPRINTS[id]).toEqual({ w: 1, d: 1 });
    expect(houseBeds(1)).toBe(4);
    expect(houseBeds(20)).toBe(9);
  });

  it('add up: every cottage sleeps its own peasants, with the keep’s hall', () => {
    expect(buildingStats(withHouses([5, 5])).beds).toBe(KEEP_BEDS + 2 * houseBeds(5));
    expect(buildingStats(withHouses([3, 2, 1])).beds).toBe(KEEP_BEDS + houseBeds(3) + houseBeds(2) + houseBeds(1));
  });

  it('sleep at most 200 peasants however many there are', () => {
    expect(MAX_PEASANTS).toBe(200);
    expect(buildingStats(withHouses(HOUSE_IDS.map(() => 20))).beds).toBe(200);
    expect(buildingStats(withHouses(HOUSE_IDS.map(() => 20)), undefined, ['bunkBeds', 'villageWell', 'stoneCottages']).beds).toBe(200);
  });

  it('need no workers: their women keep them', () => {
    for (const id of HOUSE_IDS) expect(staffNeeded(id, 10)).toBe(0);
  });

  it('are offered one at a time, in order', () => {
    newGame();
    expect(isShownBuilding(game(), 'houses2')).toBe(true);
    expect(isShownBuilding(game(), 'houses3')).toBe(false);
    newGame({ buildings: { ...game().buildings, houses2: 1 } });
    expect(isShownBuilding(game(), 'houses3')).toBe(true);
  });

  it('start with only the first built, its pantry full', () => {
    newGame();
    expect(HOUSE_IDS.map((id) => game().buildings[id])).toEqual([1, ...Array.from({ length: 23 }, () => 0)]);
    expect(game().homes.houses).toEqual({ water: PANTRY.water, food: PANTRY.food, errand: null });
  });
});

describe('a cottage’s woman', () => {
  it('fetches water from the river, then food from the store, a load at a time', () => {
    newGame({ population: 4, warehouse: warehouseWith({ apples: 100 }), homes: { houses: dry } });
    run(1);
    const water = game().homes.houses?.errand;
    expect(water?.kind).toBe('water');
    expect(water?.to).toEqual(waterSpot(game().placements.houses ?? { x: 0, y: 0 }));
    // There and back the same way.
    run(Math.ceil(2 * (water?.seconds ?? 0)));
    expect(game().homes.houses?.water).toBeGreaterThan(LOAD.water - 2);
    // Then the food: she takes it from the store as she sets off.
    const food = game().homes.houses?.errand;
    expect(food?.kind).toBe('food');
    expect(food?.load).toBe(LOAD.food);
    expect(food?.to).toEqual(foodStore(game().buildings, game().placements));
    expect(storeFood()).toBeLessThan(100 - LOAD.food + 0.5);
    run(Math.ceil(2 * (food?.seconds ?? 0)));
    expect(game().homes.houses?.food).toBeGreaterThan(LOAD.food - 1);
  });

  it('goes to the granary for food once there is one', () => {
    newGame();
    build({ granary: 1 });
    expect(foodStore(game().buildings, game().placements)).toEqual({ ...game().placements.granary, ...FOOTPRINTS.granary });
  });

  it('isn’t one of the workers, and keeps every cottage built, even an empty one', () => {
    newGame({ population: 2, warehouse: warehouseWith({ apples: 100 }) });
    build({ houses2: 1 });
    run(1);
    // Nobody sleeps in the second cottage yet, and its woman is stocking it already.
    expect(game().homes.houses2?.errand?.kind).toBe('water');
  });
});

describe('a cottage run dry', () => {
  it('counts whoever sleeps there as sleeping badly (they drag happiness down)', () => {
    newGame({ population: 4, warehouse: warehouseWith({ apples: 100 }) });
    expect(drySleepers(game())).toBe(0);
    newGame({ population: 4, warehouse: warehouseWith({ apples: 100 }), homes: { houses: dry } });
    // With room in the keep's hall they'd sleep there; once it's full, the rest sleep dry.
    expect(drySleepers(game())).toBe(0);
    newGame({ ...game(), population: 12 });
    expect(drySleepers(game())).toBe(4);
  });

  it('takes nobody new until its woman stocks it again', () => {
    // The keep's hall is full, and the cottage is dry: no room for a newcomer.
    newGame({ population: KEEP_BEDS, warehouse: warehouseWith({ apples: 200 }), homes: { houses: dry } });
    expect(roomForNewcomer(game())).toBe(false);
    run(8);
    expect(game().population).toBe(KEEP_BEDS);
    // Once she's brought water and food, newcomers move in.
    run(200);
    expect(game().homes.houses?.water).toBeGreaterThan(0);
    expect(game().homes.houses?.food).toBeGreaterThan(0);
    expect(game().population).toBeGreaterThan(KEEP_BEDS);
  });
});
