import { BUILDING_NAMES } from '../src/game/hold';
import { FOOTPRINTS, RIVER_ROWS, buildSpots, buildingGround, coveredTiles, placementProblem, tileKey, zoneAt } from '../src/game/cityMap';
import { rockyTest } from '../src/game/rocks';
import { game, newGame } from './support';

const roadTest = () => (x: number, y: number) => !!game().roads[tileKey(x, y)];
// A spot for the armory that's fine but for a road running over it.
const onARoad = () => {
  const { placements, clearedRocks } = game();
  for (const key of Object.keys(game().roads)) {
    const [x, y] = key.split(',').map(Number);
    if (!placementProblem('armory', { x, y }, placements, BUILDING_NAMES, rockyTest(clearedRocks))) return { x, y };
  }
  throw new Error('no road with room for the armory');
};

describe('placing a building', () => {
  it('can’t put it on a road', () => {
    newGame({ gold: 5000 });
    const road = onARoad();
    expect(placementProblem('armory', road, game().placements, BUILDING_NAMES, rockyTest(game().clearedRocks), roadTest())).toMatch(/road/);
    const roads = game().roads;
    game().placeBuilding('armory', road);
    expect(game().placements.armory).toBeUndefined();
    expect(game().notice).toMatch(/road/);
    expect(game().roads).toEqual(roads);
  });

  it('lights the ground it may go on: off roads and other buildings, rocky ground apart', () => {
    newGame({});
    const { placements, clearedRocks } = game();
    const rocky = rockyTest(clearedRocks);
    const spots = buildSpots('armory', placements, roadTest(), rocky);
    const covered = coveredTiles(placements);
    expect(spots.clear.length).toBeGreaterThan(0);
    expect(spots.rocky.length).toBeGreaterThan(0);
    for (const tile of [...spots.clear, ...spots.rocky]) {
      expect(zoneAt(tile.x, tile.y)).toBe('town');
      expect(covered.has(tileKey(tile.x, tile.y))).toBe(false);
      expect(game().roads[tileKey(tile.x, tile.y)]).toBeUndefined();
    }
    for (const tile of spots.clear) expect(rocky(tile.x, tile.y)).toBe(false);
    for (const tile of spots.rocky) expect(rocky(tile.x, tile.y)).toBe(true);
    // A 1×1 building fits on any clear tile lit for it.
    for (const tile of buildSpots('fishery1', placements, roadTest(), rocky).clear) {
      expect(tile.y).toBe(RIVER_ROWS + 1);
      expect(placementProblem('fishery1', tile, placements, BUILDING_NAMES, rocky, roadTest())).toBeNull();
    }
    expect(FOOTPRINTS.fishery1).toEqual({ w: 1, d: 1 });
  });

  it('lights each kind’s own ground: pastures outside the walls, the rest in town', () => {
    for (const tile of buildingGround('pasture1')) expect(zoneAt(tile.x, tile.y)).toBe('enemy');
    for (const tile of buildingGround('granary')) expect(zoneAt(tile.x, tile.y)).toBe('town');
    expect(buildingGround('keep')).toHaveLength(0);
  });
});
