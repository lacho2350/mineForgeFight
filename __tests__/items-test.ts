import { MINE_STATIONS } from '../src/components/MineMapLayout';
import { GEAR_IDS, ITEM_INFO, UNIT_GEAR, type ItemId } from '../src/game/items';
import { depositAt } from '../src/game/mineLayout';
import { FOOD_RESOURCES, RESOURCES, type Resource } from '../src/game/resources';
import { ARMY_UNITS } from '../src/game/units';

// Every raw resource an item takes, all the way down its parts.
function resourcesIn(item: ItemId, found = new Set<Resource>()) {
  const { recipe } = ITEM_INFO[item];
  for (const resource of Object.keys(recipe.resources) as Resource[]) found.add(resource);
  for (const part of Object.keys(recipe.items) as ItemId[]) resourcesIn(part, found);
  return found;
}

describe('gear', () => {
  it('gives every unit its own gear', () => {
    const gear = ARMY_UNITS.map((unit) => UNIT_GEAR[unit]);
    expect(new Set(gear).size).toBe(ARMY_UNITS.length);
    for (const item of gear) expect(GEAR_IDS).toContain(item);
  });

  it('makes the celestial relic from every resource gear is made of (all but food and wool)', () => {
    const crafted = RESOURCES.filter((resource) => !FOOD_RESOURCES.includes(resource) && resource !== 'wool');
    expect([...resourcesIn('relic')].sort()).toEqual([...crafted].sort());
  });
});

describe('the mine', () => {
  it('has twelve stations a gallery', () => {
    expect(MINE_STATIONS).toHaveLength(12);
  });

  it('keeps the newer ores below their depths', () => {
    const first: Partial<Record<Resource, number>> = {};
    for (let row = 0; row < 200; row++) {
      for (let column = 100; column < 200; column++) {
        const deposit = depositAt(row, column);
        if (deposit && first[deposit] === undefined) first[deposit] = row;
      }
    }
    // A cluster starts at or below its ore's depth and grows at most three rows up.
    expect(first.silver).toBeGreaterThanOrEqual(20 - 3);
    expect(first.sulfur).toBeGreaterThanOrEqual(35 - 3);
    expect(first.salt).toBeGreaterThanOrEqual(50 - 3);
    expect(first.emerald).toBeGreaterThanOrEqual(75 - 3);
    expect(first.mithril).toBeGreaterThanOrEqual(105 - 3);
  });
});
