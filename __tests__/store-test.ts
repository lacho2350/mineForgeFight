import { buildingStats, KEEP_BEDS } from '../src/game/buildings';
import { raidBattleKind } from '../src/game/state';
import { affordableRecruits, itemsCounted } from '../src/game/hold';
import { raidKind } from '../src/game/raids';
import { emptyArmy } from '../src/game/units';
import { build, game, newGame, run, warehouseWith } from './support';

beforeEach(() => newGame());

describe('a new game', () => {
  it('starts with pikes at the guardhouse, so pikemen can be raised', () => {
    expect(game().dwellingGear.pikeman).toBe(10);
    expect(game().items.pike).toBe(0);
    expect(affordableRecruits(game(), 'pikeman')).toBeGreaterThan(0);
    game().recruit('pikeman', 2);
    expect(game().army.pikeman).toBe(14);
    expect(game().dwellingGear.pikeman).toBe(8);
  });

  it('always has the keep’s beds, even with no housekeepers', () => {
    const stats = buildingStats({ ...game().buildings, houses: 0 }, undefined, []);
    expect(stats.beds).toBe(KEEP_BEDS);
  });
});

describe('forges and carts', () => {
  it('make swords in three steps, the carts moving everything', () => {
    build({ depot: 1, forge1: 1, forge2: 1, forge3: 1 });
    newGame({ ...game(), warehouse: warehouseWith({ iron: 60, coal: 40, copper: 20, tin: 20 }), population: 40, nextRaidAt: 1e9 });
    game().setForgeTask('forge1', 'steel');
    game().setForgeTask('forge2', 'bronze');
    game().setForgeTask('forge3', 'sword');
    for (const forge of ['forge1', 'forge2', 'forge3'] as const) game().setForgeTarget(forge, 5);
    run(150);
    expect(itemsCounted(game(), 'sword')).toBe(5);
    expect(game().items.sword).toBe(5);
    expect(game().wagonJobs).toHaveLength(0);
    // Materials only ever left the warehouse on carts: two iron and a coal per steel bar, and so on.
    expect(game().warehouse.iron).toBeLessThan(60);
  });

  it('give back what a forge holds when its task changes', () => {
    build({ forge1: 1 });
    useGameStateWith({ items: { ...game().items, steel: 3, bronze: 2 } });
    game().setForgeTask('forge1', 'sword');
    // Put a shelf's worth on the forge by hand, as a cart would.
    const task = game().forgeTasks.forge1;
    if (!task) throw new Error('no task');
    newGame({ ...game(), forgeTasks: { forge1: { ...task, stock: { resources: {}, items: { steel: 1, bronze: 1 } }, output: 2 } } });
    game().setForgeTask('forge1', 'steel');
    expect(game().items.steel).toBe(4);
    expect(game().items.bronze).toBe(3);
    expect(game().items.sword).toBe(2);
  });

  it('carry gear out to the dwellings for the recruits waiting there', () => {
    build({ depot: 2, archery: 1 });
    newGame({
      ...game(),
      items: { ...game().items, crossbow: 12 },
      recruits: { ...emptyArmy(), bowman: 8 },
      dwellingGear: {},
      population: 40,
    });
    run(60);
    expect(game().dwellingGear.bowman).toBe(8);
    expect(game().items.crossbow).toBe(4);
  });
});

describe('raids', () => {
  const fieldRaid = Array.from({ length: 50 }, (_, i) => i + 3).find((n) => raidKind(n) === 'field') ?? 3;
  const siegeRaid = Array.from({ length: 50 }, (_, i) => i + 3).find((n) => raidKind(n) === 'siege') ?? 3;
  const sightNext = (n: number, extra = {}) =>
    newGame({ ...game(), raidsFought: n - 1, nextRaidAt: game().elapsedSeconds + 61, army: { ...emptyArmy(), pikeman: 20, bowman: 10 }, gold: 1000, ...extra });

  it('are fought out on arrival when the auto-resolver is on', () => {
    sightNext(fieldRaid, { autoResolveRaids: true });
    run(70);
    expect(game().raid).toBeNull();
    expect(game().raidReport?.number).toBe(fieldRaid);
    expect(game().raidReport?.kind).toBe('field');
    expect(game().battle?.status).not.toBe('active');
  });

  it('wait for orders when it is off', () => {
    sightNext(siegeRaid);
    run(70);
    expect(game().battle?.status).toBe('active');
    expect(game().battle?.kind).toBe('siege');
    game().quickResolveBattle();
    expect(game().battle?.status).not.toBe('active');
    expect(game().raidReport?.kind).toBe('siege');
  });

  it('let the hold ride out against a siege army and fight in the field', () => {
    sightNext(siegeRaid);
    run(5);
    const raid = game().raid;
    expect(raid?.kind).toBe('siege');
    game().setRideOut(true);
    expect(raidBattleKind(game().raid ?? raid!)).toBe('field');
    run(70);
    expect(game().battle?.kind).toBe('field');
  });
});

function useGameStateWith(patch: Parameters<typeof newGame>[0]) {
  newGame({ ...game(), ...patch });
}
