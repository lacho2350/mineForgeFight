import { BUILDING_NAMES } from '../src/game/hold';
import { RIVER_ROWS, buildingGround, placementProblem, sideOf, zoneAt, FOOTPRINTS } from '../src/game/cityMap';
import { FOOD_PER_PEASANT, SHEEP_PER_LEVEL } from '../src/game/farms';
import { FOOD_MOOD } from '../src/game/happiness';
import { raidSide } from '../src/game/raids';
import { emptyArmy } from '../src/game/units';
import { useGameStore } from '../src/game/gameStore';
import { houseBeds } from '../src/game/houses';
import { build, game, newGame, run, warehouseWith } from './support';
import { fillStaffing } from '../src/game/hold';
import { foodStore } from '../src/game/homes';
import { hasRoadAccess } from '../src/game/roads';

// Place and build these, and staff them as far as the peasants go (the player would press 👷).
const place = (spots: Record<string, { x: number; y: number }>, levels: Record<string, number>, extra = {}) => {
  useGameStore.setState({ placements: { ...game().placements, ...spots }, buildings: { ...game().buildings, ...levels }, ...extra });
  useGameStore.setState({ staffing: fillStaffing(game()) });
};

describe('where farms go', () => {
  it('puts fishing huts only right next to the river, along the river wall inside the town', () => {
    const problem = (x: number, y: number) => placementProblem('fishery1', { x, y }, {}, BUILDING_NAMES);
    expect(problem(20, 7)).toBeNull();
    expect(problem(0, 6)).toMatch(/river wall/); // the bank outside the walls
    expect(problem(57, 7)).toMatch(/river wall/);
    expect(problem(20, 8)).toMatch(/river wall/); // a row back
    expect(problem(29, 10)).toMatch(/river wall/); // behind the docks
    expect(problem(30, 30)).toMatch(/river wall/);
  });

  it('lights every riverside spot in town, and none outside the walls', () => {
    const spots = buildingGround('fishery1');
    expect(spots.length).toBeGreaterThanOrEqual(8);
    for (const spot of spots) {
      expect(zoneAt(spot.x, spot.y)).toBe('town');
      expect(spot.y).toBe(RIVER_ROWS + 1);
      expect(placementProblem('fishery1', spot, {}, BUILDING_NAMES)).toBeNull();
    }
  });

  it('puts sheep out to graze on the raiders’ ground, and orchards in town', () => {
    expect(placementProblem('pasture1', { x: 0, y: 20 }, {}, BUILDING_NAMES)).toBeNull();
    expect(placementProblem('pasture1', { x: 30, y: 30 }, {}, BUILDING_NAMES)).toMatch(/outside the walls/);
    expect(placementProblem('orchard1', { x: 0, y: 20 }, {}, BUILDING_NAMES)).toMatch(/raiders/);
  });
});

describe('food', () => {
  it('is eaten by every peasant, and runs out into hunger: no newcomers then', () => {
    newGame({ population: 24, warehouse: warehouseWith({ apples: 1 }) });
    // The first cottage's sleepers live on its pantry; everyone else sleeps in the keep's hall and eats from the store.
    const eats = (24 - houseBeds(1)) * FOOD_PER_PEASANT;
    run(1);
    expect(game().warehouse.apples).toBeCloseTo(1 - eats, 2);
    run(10);
    expect(game().warehouse.apples).toBe(0);
    expect(game().hungry).toBe(true);
    const population = game().population;
    run(30);
    expect(game().population).toBe(population);
  });

  it('comes in from the orchards, the fishing huts and the pastures', () => {
    newGame({ population: 40, warehouse: warehouseWith({ apples: 50 }) });
    build({ orchard1: 3 });
    place({ fishery1: { x: 20, y: 7 }, pasture1: { x: 0, y: 20 } }, { fishery1: 2, pasture1: 1 }, { flocks: { pasture1: SHEEP_PER_LEVEL } });
    const before = { ...game().warehouse };
    run(10);
    const after = game().warehouse;
    expect(after.fish).toBeGreaterThan(before.fish);
    expect(after.mutton).toBeGreaterThan(before.mutton);
    expect(after.wool).toBeGreaterThan(before.wool);
    // 40 peasants eat 3.3 food in 10 s; the orchard alone picks 3.
    expect(after.apples).toBeGreaterThan(before.apples - 1);
    expect(game().hungry).toBe(false);
  });

  it('makes a hungry hold unhappy, and an unhappy hold works slower', () => {
    newGame({ warehouse: warehouseWith({ apples: 500 }) });
    run(1);
    const fed = game().lastFlow.mined;
    // No food in store: happiness sinks by the hungry rate (and the dry cottages' share on top).
    newGame({ warehouse: warehouseWith({}), hungry: true, homes: { houses: { water: 0, food: 0, errand: null } } });
    const before = game().happiness;
    run(60);
    expect(game().happiness).toBeLessThanOrEqual(before + FOOD_MOOD[0]);
    // At rock bottom everyone works at half speed (each miner's cut is rounded to a tenth).
    newGame({ warehouse: warehouseWith({ apples: 500 }), happiness: 0 });
    run(1);
    expect(game().lastFlow.mined).toBeLessThan(fed);
    expect(game().lastFlow.mined).toBeLessThanOrEqual(fed * 0.5 + 0.1 * game().sites.length);
  });

  it('grows each flock to what its pasture grazes', () => {
    newGame({ population: 30, warehouse: warehouseWith({ apples: 500 }) });
    place({ pasture1: { x: 0, y: 20 } }, { pasture1: 2 });
    run(600);
    expect(game().flocks.pasture1).toBe(2 * SHEEP_PER_LEVEL);
  });
});

describe('raids on the land outside the walls', () => {
  it('drive off sheep from their side, more when they win, and leave the fishing huts alone', () => {
    newGame({ population: 30, warehouse: warehouseWith({ apples: 500 }) });
    place({ fishery1: { x: 3, y: 7 }, pasture1: { x: 0, y: 20 } }, { fishery1: 2, pasture1: 2 }, { flocks: { pasture1: 20 } });
    const side = sideOf({ x: 0, y: 20 }, FOOTPRINTS.pasture1);
    const n = Array.from({ length: 60 }, (_, i) => i + 3).find((raid) => raidSide(raid) === side) ?? 3;
    // Nobody to fight it: the raid is lost at once.
    newGame({ ...game(), raidsFought: n - 1, nextRaidAt: game().elapsedSeconds + 61, army: emptyArmy(), autoResolveRaids: true });
    run(65);
    expect(game().raidReport?.outcome).toBe('lost');
    expect(game().flocks.pasture1).toBeLessThan(20 - 5);
    expect(game().buildings.fishery1).toBe(2);
  });
});

describe('a new game', () => {
  it('starts with a staffed granary holding two kinds of food, reachable by road', () => {
    newGame();
    const { buildings, placements, warehouse } = game();
    expect(buildings.granary).toBe(1);
    expect(placements.granary).toBeTruthy();
    expect(warehouse.apples).toBeGreaterThan(0);
    expect(warehouse.fish).toBeGreaterThan(0);
    expect(fillStaffing(game()).granary).toBeGreaterThan(0);
    expect(hasRoadAccess('granary', placements.granary as { x: number; y: number }, game().roads)).toBe(true);
    // The peasants' food store is the granary from the start.
    expect(foodStore(buildings, placements)).toEqual({ ...placements.granary, ...FOOTPRINTS.granary });
  });
});
