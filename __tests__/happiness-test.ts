import { buildingStats, requiredKeep, staffNeeded, taxPerMinute } from '../src/game/buildings';
import { FOOTPRINTS } from '../src/game/cityMap';
import { BATTLE_MOOD, BUILDING_MOOD, FOOD_MOOD, LEAVE_SECONDS, STARTING_HAPPINESS, afterBattle, driftHappiness, moodCoverage, moodDrift, moodFactors, workPaceAt } from '../src/game/happiness';
import { isShownBuilding, workforceOf } from '../src/game/hold';
import { CHURCH_IDS, FAIRGROUND_IDS, GARDENS_IDS, PEASANTS_PER_LEVEL, moodKeep } from '../src/game/moodBuildings';
import { TAX_INFO, TAX_RATES } from '../src/game/taxes';
import { build, game, newGame, run, warehouseWith } from './support';

const factorsNow = () => moodFactors({ ...game(), staff: workforceOf(game()).staff });
const factor = (id: string) => factorsNow().find((f) => f.id === id)?.perMinute ?? NaN;

describe('happiness', () => {
  it('starts content and sets the pace of work: half speed at 0, full at 100', () => {
    newGame();
    expect(game().happiness).toBe(STARTING_HAPPINESS);
    expect(workPaceAt(0)).toBe(0.5);
    expect(workPaceAt(50)).toBe(0.75);
    expect(workPaceAt(100)).toBe(1);
    expect(workPaceAt(140)).toBe(1);
  });

  it('drifts by the factors, a minute’s worth each 60 s, and stays within 0…100', () => {
    expect(driftHappiness(50, 6)).toBeCloseTo(50.1, 3);
    expect(driftHappiness(99.99, 6)).toBe(100);
    expect(driftHappiness(0.01, -6)).toBe(0);
    newGame({ warehouse: warehouseWith({ apples: 500 }) });
    const drift = moodDrift(factorsNow());
    const before = game().happiness;
    run(60);
    expect(game().happiness).toBeCloseTo(before + drift, 1);
  });

  it('likes a varied larder and hates an empty one', () => {
    newGame({ warehouse: warehouseWith({ apples: 100 }) });
    expect(factor('food')).toBe(FOOD_MOOD[1]);
    newGame({ warehouse: warehouseWith({ apples: 100, fish: 100 }) });
    expect(factor('food')).toBe(FOOD_MOOD[2]);
    newGame({ warehouse: warehouseWith({ apples: 100, fish: 100, mutton: 100 }) });
    expect(factor('food')).toBe(FOOD_MOOD[3]);
    newGame({ warehouse: warehouseWith({}), hungry: true });
    expect(factor('food')).toBe(FOOD_MOOD[0]);
  });

  it('follows the keep’s tax rate, which scales the gold', () => {
    newGame({ population: 20 });
    const stats = buildingStats(game().buildings);
    for (const rate of TAX_RATES) {
      game().setTaxRate(rate);
      expect(game().taxRate).toBe(rate);
      expect(factor('taxes')).toBe(TAX_INFO[rate].mood);
      expect(taxPerMinute(stats, 20, rate)).toBeCloseTo(taxPerMinute(stats, 20) * TAX_INFO[rate].gold, 2);
    }
    game().setTaxRate('none');
    const gold = game().gold;
    run(5);
    expect(game().gold).toBe(gold);
  });

  it('is cheered by fairs, churches and gardens, each level for 50 peasants, thinner beyond that', () => {
    newGame({ population: 40 });
    expect(factor('fun')).toBe(0);
    build({ fairground1: 1 });
    expect(workforceOf(game()).staff.fairground1).toBe(staffNeeded('fairground1', 1));
    expect(factor('fun')).toBe(BUILDING_MOOD.fun);
    // 40 of 120 peasants are entertained: a third of the effect; a second fair covers 100.
    newGame({ population: 120 });
    build({ fairground1: 1 });
    expect(moodCoverage(1, 120)).toBeCloseTo(PEASANTS_PER_LEVEL / 120, 5);
    expect(factor('fun')).toBeCloseTo(BUILDING_MOOD.fun * (PEASANTS_PER_LEVEL / 120), 2);
    build({ fairground2: 1 });
    expect(factor('fun')).toBeCloseTo(BUILDING_MOOD.fun * ((2 * PEASANTS_PER_LEVEL) / 120), 2);
    // Gardens need nobody; a church with nobody in it sways no one.
    newGame({ population: 10 });
    build({ gardens1: 1, church1: 1 });
    expect(staffNeeded('gardens1', 1)).toBe(0);
    expect(factor('beauty')).toBe(BUILDING_MOOD.beauty);
    game().assignStaff('church1', -1);
    expect(workforceOf(game()).staff.church1).toBe(0);
    expect(factor('piety')).toBe(0);
  });

  it('offers the next fair, church or gardens only, and unlocks them with the keep', () => {
    newGame();
    expect(isShownBuilding(game(), 'fairground1')).toBe(true);
    expect(isShownBuilding(game(), 'fairground2')).toBe(false);
    expect(moodKeep('church1')).toBe(1);
    expect(requiredKeep('church2')).toBe(moodKeep('church2'));
    expect(requiredKeep('church2')).toBeGreaterThan(1);
    for (const id of [...FAIRGROUND_IDS, ...CHURCH_IDS, ...GARDENS_IDS]) expect(FOOTPRINTS[id]).toEqual({ w: 3, d: 3 });
  });

  it('celebrates a victory and mourns a defeat', () => {
    expect(afterBattle(50, 'won')).toBe(50 + BATTLE_MOOD.won);
    expect(afterBattle(50, 'lost')).toBe(50 + BATTLE_MOOD.lost);
    expect(afterBattle(50, 'withdrawn')).toBe(50);
    expect(afterBattle(95, 'won')).toBe(100);
  });

  it('sends the peasants away at 0, one every half minute, and lets nobody new in', () => {
    newGame({ population: 12, happiness: 0, warehouse: warehouseWith({}), hungry: true });
    game().setTaxRate('cruel');
    const before = game().population;
    run(LEAVE_SECONDS * 2);
    expect(game().happiness).toBe(0);
    expect(game().population).toBe(before - 2);
    expect(game().notice).toMatch(/left Greyhollow/);
  });
});
