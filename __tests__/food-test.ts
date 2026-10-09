import { BUILDING_NAMES } from '../src/game/hold';
import { placementProblem, sideOf, FOOTPRINTS } from '../src/game/cityMap';
import { FOOD_PER_PEASANT, HUNGRY_WORK, SHEEP_PER_LEVEL } from '../src/game/farms';
import { raidSide } from '../src/game/raids';
import { emptyArmy } from '../src/game/units';
import { useGameStore } from '../src/game/gameStore';
import { build, game, newGame, run, warehouseWith } from './support';

const place = (spots: Record<string, { x: number; y: number }>, levels: Record<string, number>, extra = {}) =>
  useGameStore.setState({ placements: { ...game().placements, ...spots }, buildings: { ...game().buildings, ...levels }, ...extra });

describe('where farms go', () => {
  it('puts fishing huts on the river banks outside the walls, and nowhere else', () => {
    const problem = (x: number, y: number) => placementProblem('fishery1', { x, y }, {}, BUILDING_NAMES);
    expect(problem(0, 6)).toBeNull();
    expect(problem(57, 7)).toBeNull();
    expect(problem(0, 20)).toMatch(/river/);
    expect(problem(30, 30)).toMatch(/river bank/);
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
    const eats = 24 * FOOD_PER_PEASANT;
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
    place({ fishery1: { x: 0, y: 6 }, pasture1: { x: 0, y: 20 } }, { fishery1: 2, pasture1: 1 }, { flocks: { pasture1: SHEEP_PER_LEVEL } });
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

  it('makes hungry peasants work slower', () => {
    newGame({ warehouse: warehouseWith({ apples: 500 }) });
    run(1);
    const fed = game().lastFlow.mined;
    newGame({ warehouse: warehouseWith({}), hungry: true });
    run(1);
    // Each miner's cut is rounded to a tenth.
    expect(game().lastFlow.mined).toBeLessThan(fed);
    expect(game().lastFlow.mined).toBeLessThanOrEqual(fed * HUNGRY_WORK + 0.1 * game().sites.length);
  });

  it('grows each flock to what its pasture grazes', () => {
    newGame({ population: 30, warehouse: warehouseWith({ apples: 500 }) });
    place({ pasture1: { x: 0, y: 20 } }, { pasture1: 2 });
    run(600);
    expect(game().flocks.pasture1).toBe(2 * SHEEP_PER_LEVEL);
  });
});

describe('raids on the land outside the walls', () => {
  it('drive off sheep from their side, and burn its fishing huts when they win', () => {
    newGame({ population: 30, warehouse: warehouseWith({ apples: 500 }) });
    place({ fishery1: { x: 0, y: 6 }, pasture1: { x: 0, y: 20 } }, { fishery1: 2, pasture1: 2 }, { flocks: { pasture1: 20 } });
    const side = sideOf({ x: 0, y: 20 }, FOOTPRINTS.pasture1);
    expect(sideOf({ x: 0, y: 6 }, FOOTPRINTS.fishery1)).toBe(side);
    const n = Array.from({ length: 60 }, (_, i) => i + 3).find((raid) => raidSide(raid) === side) ?? 3;
    // Nobody to fight it: the raid is lost at once.
    newGame({ ...game(), raidsFought: n - 1, nextRaidAt: game().elapsedSeconds + 61, army: emptyArmy(), autoResolveRaids: true });
    run(65);
    expect(game().raidReport?.outcome).toBe('lost');
    expect(game().flocks.pasture1).toBeLessThan(20 - 5);
    expect(game().buildings.fishery1).toBe(1);
  });
});
