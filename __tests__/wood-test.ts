import { MINE_SHAFT_COLUMN, getTunnelRow } from '../src/components/MineMapLayout';
import { FOOTPRINTS, GATE_ROAD, MAP_SIZE, spotOf } from '../src/game/cityMap';
import { buildingCost } from '../src/game/buildings';
import { TUNNEL_WOOD } from '../src/game/costs';
import { ITEM_INFO } from '../src/game/items';
import { STARTING_WOOD } from '../src/game/resources';
import { walkBetween } from '../src/game/roads';
import { tileKey } from '../src/game/mineLayout';
import { FOREST_EXIT, STAND_WOOD, cleanForest, fellWood, fellingStand, forestWood, parseSpot, standFoot, startingForest } from '../src/game/forest';
import { build, game, newGame, run } from './support';

describe('wood', () => {
  it('is cut by a staffed woodcutter’s hut and lands in the warehouse', () => {
    newGame({ population: 20 });
    build({ woodcutter: 4 });
    const before = game().warehouse.wood;
    run(10);
    expect(game().warehouse.wood).toBeCloseTo(before + 10 * 0.25 * 4, 5);
  });

  it('starts a game with enough for the first tunnels', () => {
    newGame();
    expect(game().warehouse.wood).toBe(STARTING_WOOD);
  });

  it('goes into gear, every building from level 2, but never into the hut itself', () => {
    expect(ITEM_INFO.pike.recipe.resources.wood).toBeGreaterThan(0);
    expect(ITEM_INFO.crossbow.recipe.resources.wood).toBeGreaterThan(0);
    expect(buildingCost('warehouse', 1).resources.wood).toBeUndefined();
    expect(buildingCost('warehouse', 2).resources.wood).toBeGreaterThan(0);
    for (let level = 1; level <= 20; level++) expect(buildingCost('woodcutter', level).resources.wood).toBeUndefined();
  });

  it('holds up every tunnel tile: no wood, no digging', () => {
    newGame({ gold: 10_000 });
    // A shaft straight down from the end of the entrance tunnel.
    const keys = [1, 2, 3].map((down) => tileKey(getTunnelRow(-1) + down, MINE_SHAFT_COLUMN - 2));
    newGame({ ...game(), warehouse: { ...game().warehouse, wood: 2 * TUNNEL_WOOD } });
    game().planDig(keys);
    expect(game().digPlan).toEqual(keys.slice(0, 2));
    expect(game().warehouse.wood).toBe(0);
  });

  it('is fetched from the forest beyond the gate, down the gate road', () => {
    newGame();
    build({ woodcutter: 1 });
    const hut = spotOf('woodcutter', game().placements);
    if (!hut) throw new Error('the hut was not placed');
    const walk = walkBetween({ ...hut, ...FOOTPRINTS.woodcutter }, { ...FOREST_EXIT, w: 1, d: 1 }, game().placements, game().roads, game().clearedRocks);
    expect(walk).not.toBeNull();
  });
});

describe('the forest', () => {
  it('stands on the near mountains, off the map and clear of the pass, about 100 wood a stand', () => {
    const forest = startingForest();
    const stands = Object.entries(forest);
    expect(stands.length).toBeGreaterThan(120);
    for (const [key, wood] of stands) {
      const spot = parseSpot(key);
      if (!spot) throw new Error(`not a forest spot: ${key}`);
      const [x, y] = standFoot(spot);
      expect(Math.max(x, y)).toBeGreaterThan(MAP_SIZE);
      if (spot.side === 'frontLeft') expect(Math.abs(spot.along - GATE_ROAD.x)).toBeGreaterThan(3);
      expect(wood).toBeGreaterThanOrEqual(STAND_WOOD - 20);
      expect(wood).toBeLessThanOrEqual(STAND_WOOD + 20);
    }
    // A save from before the mountains' forest gets a new one.
    expect(cleanForest({ '24,59': 100 })).toBeNull();
  });

  it('is felled stand by stand from the road, and every stand cut down grows back elsewhere', () => {
    const forest = startingForest();
    const first = fellingStand(forest);
    const stands = Object.keys(forest).length;
    let state = { forest, serial: 0 };
    let taken = 0;
    for (let i = 0; i < 200; i++) {
      const felled = fellWood(state.forest, state.serial, 7.5);
      state = { forest: felled.forest, serial: felled.serial };
      taken += felled.wood;
    }
    expect(taken).toBeCloseTo(1500, 5);
    // Stands came down and grew back elsewhere: the forest keeps its size.
    expect(state.serial).toBeGreaterThan(10);
    expect(Object.keys(state.forest)).toHaveLength(stands);
    expect(first && first in state.forest ? state.forest[first] : 0).toBeLessThan(forest[first ?? ''] ?? 0);
  });

  it('feeds the warehouse while the hut is staffed', () => {
    newGame({ population: 20 });
    build({ woodcutter: 4 });
    const before = { wood: game().warehouse.wood, forest: forestWood(game().forest), stands: Object.keys(game().forest).length };
    run(10);
    expect(game().warehouse.wood - before.wood).toBeCloseTo(10, 5);
    // Nothing grew back yet (no stand was cut down in 10 s): the forest lost what came home.
    if (game().forestSerial === 0) expect(forestWood(game().forest)).toBeCloseTo(before.forest - 10, 5);
    expect(Object.keys(game().forest)).toHaveLength(before.stands);
  });
});
