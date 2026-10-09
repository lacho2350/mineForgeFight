import { STARTING_BUILDINGS, buildingStats, KEEP_BEDS } from '../src/game/buildings';
import { HOUSE_IDS, MAX_PEASANTS, houseBeds } from '../src/game/houses';
import { isShownBuilding } from '../src/game/hold';
import { game, newGame } from './support';

const withHouses = (levels: number[]) => ({
  ...STARTING_BUILDINGS,
  ...Object.fromEntries(HOUSE_IDS.map((id, index) => [id, levels[index] ?? 0])),
});

describe('workers’ houses', () => {
  it('add up: every house sleeps its own peasants, with the keep’s hall', () => {
    expect(buildingStats(withHouses([5, 5])).beds).toBe(KEEP_BEDS + 2 * houseBeds(5));
    expect(buildingStats(withHouses([3, 2, 1])).beds).toBe(KEEP_BEDS + houseBeds(3) + houseBeds(2) + houseBeds(1));
  });

  it('sleep at most 200 peasants however many there are', () => {
    expect(MAX_PEASANTS).toBe(200);
    expect(buildingStats(withHouses(HOUSE_IDS.map(() => 20))).beds).toBe(200);
    expect(buildingStats(withHouses(HOUSE_IDS.map(() => 20)), undefined, ['bunkBeds', 'villageWell', 'stoneCottages']).beds).toBe(200);
  });

  it('are offered one at a time, in order', () => {
    newGame();
    expect(isShownBuilding(game(), 'houses2')).toBe(true);
    expect(isShownBuilding(game(), 'houses3')).toBe(false);
    newGame({ buildings: { ...game().buildings, houses2: 1 } });
    expect(isShownBuilding(game(), 'houses3')).toBe(true);
  });

  it('start with only the first built', () => {
    newGame();
    expect(HOUSE_IDS.map((id) => game().buildings[id])).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
  });
});
