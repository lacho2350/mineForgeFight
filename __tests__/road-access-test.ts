import { BUILDING_NAMES } from '../src/game/hold';
import { FOOTPRINTS, MAIN_ROAD, MINE_SPOT, doorTiles, nearestFreeSpot, needsRoad, placementProblem, tileKey, type Placements } from '../src/game/cityMap';
import { GROUND_SPEED, ROAD_INFO, accessRoads, cartWay, hasRoadAccess, joinBuildings, roadBetween, walkBetween, type Roads } from '../src/game/roads';
import { rockyTest } from '../src/game/rocks';
import { mergeSave, migrateSave } from '../src/game/saveMigration';
import { useGameStore } from '../src/game/gameStore';
import { hasHomeRoad, isHappy, sleepers, workPace } from '../src/game/homes';
import type { BuildingId } from '../src/game/buildings';
import { game, newGame } from './support';

const onRoad = () => (x: number, y: number) => !!game().roads[tileKey(x, y)];
const check = (id: BuildingId, spot: { x: number; y: number }) =>
  placementProblem(id, spot, game().placements, BUILDING_NAMES, rockyTest(game().clearedRocks), onRoad(), accessRoads(game().roads));
// A spot for the armory that's fine but for the road at its door: clear ground, off the roads, no road in front.
function offTheRoads() {
  const { placements, clearedRocks } = game();
  for (let x = 8; x < 50; x++) {
    for (let y = 8; y < 50; y++) {
      if (!placementProblem('armory', { x, y }, placements, BUILDING_NAMES, rockyTest(clearedRocks), onRoad()) && check('armory', { x, y })) return { x, y };
    }
  }
  throw new Error('no spot off the roads');
}

describe('a road at the door', () => {
  it('joins a new game’s first buildings to the keep and the gate', () => {
    newGame();
    const access = accessRoads(game().roads);
    expect(access.size).toBeGreaterThan(20);
    for (const [id, spot] of Object.entries(game().placements) as [BuildingId, { x: number; y: number }][]) {
      if (needsRoad(id)) expect(hasRoadAccess(id, spot, game().roads)).toBe(true);
    }
  });

  it('is needed to place a building: off the roads it’s refused, with its door on one it fits', () => {
    newGame({ gold: 5000 });
    const away = offTheRoads();
    expect(check('armory', away)).toMatch(/road at its door/);
    game().placeBuilding('armory', away);
    expect(game().placements.armory).toBeUndefined();
    expect(game().notice).toMatch(/road at its door/);
    const near = nearestFreeSpot('armory', away, game().placements, BUILDING_NAMES, rockyTest(game().clearedRocks), onRoad(), accessRoads(game().roads));
    expect(near).not.toBeNull();
    if (!near) return;
    expect(check('armory', near)).toBeNull();
    expect(doorTiles('armory', near).some((tile) => game().roads[tileKey(tile.x, tile.y)])).toBe(true);
  });

  it('only counts roads that reach both the keep and the main gate', () => {
    newGame();
    const away = offTheRoads();
    // A stretch of road in front of the door, joined to nothing.
    const lonely: Roads = { ...game().roads };
    for (const tile of doorTiles('armory', away)) lonely[tileKey(tile.x, tile.y)] = 'dirt';
    expect(accessRoads(lonely).has(tileKey(away.x, away.y + 3))).toBe(false);
    expect(placementProblem('armory', away, game().placements, BUILDING_NAMES, undefined, undefined, accessRoads(lonely))).toMatch(/road at its door/);
  });

  it('is laid free from the door to the roads, for the buildings that lack one', () => {
    newGame();
    const away = offTheRoads();
    const placements: Placements = { ...game().placements, armory: away };
    expect(hasRoadAccess('armory', away, game().roads)).toBe(false);
    const { roads, laid } = joinBuildings(placements, game().roads);
    expect(laid).toBeGreaterThan(0);
    expect(hasRoadAccess('armory', away, roads)).toBe(true);
    // Only dirt is added; nothing that was there is changed.
    for (const [key, kind] of Object.entries(game().roads)) expect(roads[key]).toBe(kind);
  });

  it('keeps the main road from the keep to the gate: never taken up or built over, and whole again on loading', () => {
    newGame({ gold: 5000 });
    for (let y = MAIN_ROAD.y0; y <= MAIN_ROAD.y1; y++) expect(game().roads[tileKey(MAIN_ROAD.x, y)]).toBe('dirt');
    game().layRoads('erase', [{ x: MAIN_ROAD.x, y: 40 }]);
    expect(game().roads[tileKey(MAIN_ROAD.x, 40)]).toBe('dirt');
    expect(game().notice).toMatch(/main road .* stays/);
    // Paved better, it stays the main road.
    game().layRoads('stone', [{ x: MAIN_ROAD.x, y: 40 }]);
    expect(game().roads[tileKey(MAIN_ROAD.x, 40)]).toBe('stone');
    expect(placementProblem('houses2', { x: MAIN_ROAD.x, y: 40 }, game().placements, BUILDING_NAMES)).toMatch(/main road/);
    // A save with stretches of it gone gets them back.
    const roads = Object.fromEntries(Object.entries(game().roads).filter(([key]) => !key.startsWith(`${String(MAIN_ROAD.x)},5`)));
    const loaded = mergeSave(migrateSave(JSON.parse(JSON.stringify({ ...game(), roads })), 5), useGameStore.getInitialState());
    for (let y = MAIN_ROAD.y0; y <= MAIN_ROAD.y1; y++) expect(loaded.roads[tileKey(MAIN_ROAD.x, y)]).toBeDefined();
  });

  it('is laid free on loading a save from before (and the rocks under it cleared)', () => {
    newGame();
    const away = offTheRoads();
    const saved = { ...game(), placements: { ...game().placements, armory: away }, buildings: { ...game().buildings, armory: 1 } };
    const loaded = mergeSave(migrateSave(JSON.parse(JSON.stringify(saved)), 4), useGameStore.getInitialState());
    expect(hasRoadAccess('armory', away, loaded.roads)).toBe(true);
    expect(loaded.notice).toMatch(/laid free/);
    expect('joinRoads' in loaded).toBe(false);
    for (const key of Object.keys(loaded.roads)) {
      const [x, y] = key.split(',').map(Number);
      expect(rockyTest(loaded.clearedRocks)(x, y)).toBe(false);
    }
    // A save already under the rule is left as it is.
    const current = mergeSave(migrateSave(JSON.parse(JSON.stringify(saved)), 5), useGameStore.getInitialState());
    expect(hasRoadAccess('armory', away, current.roads)).toBe(false);
  });
});

describe('ways about the town', () => {
  const tilesOf = (walk: { points: number[][] }) => walk.points.slice(1, -1).map(([x, y]) => tileKey(Math.floor(x), Math.floor(y)));
  const warehouse = () => ({ ...(game().placements.warehouse as { x: number; y: number }), ...FOOTPRINTS.warehouse });

  it('keeps carts to the roads, and lets them cross open ground only where no road joins the stops', () => {
    newGame();
    const way = roadBetween(MINE_SPOT, warehouse(), game().placements, game().roads);
    expect(way).not.toBeNull();
    if (!way) return;
    for (const key of tilesOf(way)) expect(game().roads[key]).toBeDefined();
    expect(cartWay(MINE_SPOT, warehouse(), game().placements, game().roads)).toEqual(way);
    // Cut the road down to the mine: no road joins them, so the cart goes over open ground like a walker.
    const cut = Object.fromEntries(Object.entries(game().roads).filter(([key]) => !key.startsWith('39,')));
    expect(roadBetween(MINE_SPOT, warehouse(), game().placements, cut)).toBeNull();
    expect(cartWay(MINE_SPOT, warehouse(), game().placements, cut)).not.toBeNull();
  });

  it('has people take the roads: off them they walk 70% slower than on dirt', () => {
    expect(GROUND_SPEED).toBeCloseTo(ROAD_INFO.dirt.speed * 0.3);
    newGame();
    // From the first cottage across the town to the warehouse.
    const home = { ...(game().placements.houses as { x: number; y: number }), ...FOOTPRINTS.houses };
    const walk = walkBetween(home, warehouse(), game().placements, game().roads, game().clearedRocks);
    expect(walk).not.toBeNull();
    if (!walk) return;
    const tiles = tilesOf(walk);
    const onRoads = tiles.filter((key) => game().roads[key]).length;
    expect(onRoads / tiles.length).toBeGreaterThan(0.8);
    // The same walk with no roads at all takes far longer.
    const bare = walkBetween(home, warehouse(), game().placements, {}, game().clearedRocks);
    expect(bare?.time ?? Infinity).toBeGreaterThan(walk.time * 1.5);
  });
});

describe('cottages', () => {
  it('need their road for happy people: cut off, they work slower and nobody new moves in', () => {
    newGame();
    const state = { ...game(), hungry: false };
    expect(hasHomeRoad('houses', state)).toBe(true);
    expect(workPace(state)).toBe(1);
    // The same hold with the starting cottage's road gone.
    const door = doorTiles('houses', game().placements.houses as { x: number; y: number }).map((tile) => tileKey(tile.x, tile.y));
    const roads = Object.fromEntries(Object.entries(game().roads).filter(([key]) => !door.includes(key)));
    const cut = { ...state, roads };
    expect(hasHomeRoad('houses', cut)).toBe(false);
    expect(isHappy('houses', cut)).toBe(false);
    expect(workPace(cut)).toBeLessThan(1);
    // Its beds fill last, after the hall's.
    expect(sleepers(cut, true).residents.houses).toBeLessThan(sleepers(state, true).residents.houses);
  });
});
