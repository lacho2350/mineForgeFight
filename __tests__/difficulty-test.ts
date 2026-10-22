// Difficulty (difficulty.ts): the settings' numbers, and each knob doing what it says in the game.
import { DIFFICULTIES, DIFFICULTY, SIEGES_TO_FALL, rulesOf } from '../src/game/difficulty';
import { FIRST_RAID_AT, PLUNDER_SHARE, RAID_INTERVAL, raidKind } from '../src/game/raids';
import { buildingCost, buildingCostAt } from '../src/game/buildings';
import { getDepthCost, tileDigCost } from '../src/game/costs';
import { techCost, TECH_IDS } from '../src/game/techs';
import { surveyRadius } from '../src/game/survey';
import { moodFactors } from '../src/game/happiness';
import { workforceOf } from '../src/game/hold';
import { campaignBlocker } from '../src/game/campaign';
import { mergeSave } from '../src/game/saveMigration';
import { startBuilding } from '../src/game/updates';
import { useGameStore } from '../src/game/gameStore';
import { campaignWonOn, readUnlocks, resetUnlocksCache } from '../src/game/unlocks';
import { emptyArmy } from '../src/game/units';
import { game, memoryStorage, newGame, run, warehouseWith } from './support';

describe('the difficulty settings', () => {
  it('keep Normal exactly as the game was', () => {
    const normal = DIFFICULTY.normal;
    expect(normal.firstRaidAt).toBe(FIRST_RAID_AT);
    expect(normal.raidInterval).toBe(RAID_INTERVAL);
    expect(normal.plunder).toBe(PLUNDER_SHARE);
    expect([normal.raidStrength, normal.cost, normal.food, normal.moodPenalty, normal.campaign, normal.startStock]).toEqual([1, 1, 1, 1, 1, 1]);
    expect(normal.startGold).toBe(useGameStore.getInitialState().gold);
    expect(rulesOf(undefined)).toBe(normal);
    expect(buildingCostAt('granary', 3, 'normal')).toEqual(buildingCost('granary', 3));
  });

  it('get harder step by step, Hardcore being Nightmare with one life', () => {
    for (let i = 1; i < DIFFICULTIES.length - 1; i++) {
      const easier = DIFFICULTY[DIFFICULTIES[i - 1]];
      const harder = DIFFICULTY[DIFFICULTIES[i]];
      expect(harder.raidStrength).toBeGreaterThan(easier.raidStrength);
      expect(harder.raidInterval).toBeLessThan(easier.raidInterval);
      expect(harder.plunder).toBeGreaterThan(easier.plunder);
      expect(harder.startGold).toBeLessThan(easier.startGold);
      expect(harder.cost).toBeGreaterThan(easier.cost);
      expect(harder.food).toBeGreaterThan(easier.food);
      expect(harder.moodPenalty).toBeGreaterThan(easier.moodPenalty);
      expect(harder.leaveSeconds).toBeLessThan(easier.leaveSeconds);
    }
    const { oneLife, leaveFloor, name, blurb, ...nightmareRest } = DIFFICULTY.hardcore;
    const { oneLife: n1, leaveFloor: n2, name: n3, blurb: n4, ...hardcoreAsNightmare } = DIFFICULTY.nightmare;
    expect(nightmareRest).toEqual(hardcoreAsNightmare);
    expect([oneLife, leaveFloor, n1, n2]).toEqual([true, 0, false, 4]);
    expect(name).not.toBe(n3);
    expect(blurb).not.toBe(n4);
  });

  it('start a new game with the setting’s gold, stores and first raid', () => {
    useGameStore.getState().resetGame('easy');
    expect(game().difficulty).toBe('easy');
    expect(game().gold).toBe(1500);
    expect(game().nextRaidAt).toBe(600);
    expect(game().warehouse.apples).toBe(Math.round(useGameStore.getInitialState().warehouse.apples * 1.5));
    useGameStore.getState().resetGame();
    expect(game().difficulty).toBe('normal');
    expect(game().gold).toBe(1000);
    expect(game().warehouse).toEqual(useGameStore.getInitialState().warehouse);
  });

  it('price building, tunnels, techs and going deeper by the setting', () => {
    expect(buildingCostAt('granary', 1, 'hard').gold).toBe(Math.round(buildingCost('granary', 1).gold * 1.2));
    expect(buildingCostAt('granary', 1, 'easy').gold).toBe(Math.round(buildingCost('granary', 1).gold * 0.8));
    const id = TECH_IDS[0];
    expect(techCost([], id, 'nightmare')).toBe(Math.round(techCost([], id) * 1.4));
    expect(getDepthCost(3, [], 'hard')).toBe(Math.round(getDepthCost(3, []) * 1.2));
    newGame();
    expect(tileDigCost({ ...game(), difficulty: 'nightmare' }, 20)).toBeGreaterThan(tileDigCost(game(), 20));
    // Building takes the dearer price.
    newGame({ difficulty: 'hard', gold: 5000 });
    const started = startBuilding(game(), 'keep');
    expect(game().gold - (started.gold ?? 0)).toBe(buildingCostAt('keep', 2, 'hard').gold);
  });

  it('weigh the bad things on the mood more the harder it is', () => {
    newGame({ hungry: true, warehouse: warehouseWith({}) });
    const food = (difficulty: (typeof DIFFICULTIES)[number]) =>
      moodFactors({ ...game(), difficulty, staff: workforceOf(game()).staff }).find((factor) => factor.id === 'food')?.perMinute;
    expect(food('normal')).toBe(-6);
    expect(food('easy')).toBeCloseTo(-4.2);
    expect(food('nightmare')).toBe(-9);
  });

  it('let the peasants eat more the harder it is', () => {
    const eaten = (difficulty: (typeof DIFFICULTIES)[number]) => {
      newGame({ difficulty, population: 12, warehouse: warehouseWith({ apples: 200 }) });
      run(120);
      return 200 - game().warehouse.apples;
    };
    const easy = eaten('easy');
    const normal = eaten('normal');
    const nightmare = eaten('nightmare');
    expect(normal).toBeGreaterThan(easy);
    expect(nightmare).toBeGreaterThan(normal);
  });

  it('narrow the surveyors’ reach on Nightmare and Hardcore', () => {
    expect(surveyRadius([], 'nightmare')).toBe(surveyRadius([]) - 1);
    expect(surveyRadius([], 'easy')).toBe(surveyRadius([]));
  });

  it('send peasants away faster at happiness 0 on Hard', () => {
    newGame({ difficulty: 'hard', population: 12, happiness: 0, warehouse: warehouseWith({}), hungry: true });
    game().setTaxRate('cruel');
    run(60);
    expect(game().population).toBe(12 - 3);
  });
});

describe('Hardcore', () => {
  const siegeRaid = Array.from({ length: 50 }, (_, i) => i + 3).find((n) => raidKind(n) === 'siege') ?? 3;

  it('falls to a siege with no army to meet it, and then nothing more happens', () => {
    newGame({ difficulty: 'hardcore', army: emptyArmy(), raidsFought: siegeRaid - 1, nextRaidAt: 61, autoResolveRaids: true });
    run(70);
    expect(game().fallen).not.toBeNull();
    expect(game().fallen?.reason).toMatch(/fallen/);
    const at = game().elapsedSeconds;
    run(20);
    expect(game().elapsedSeconds).toBe(at);
  });

  it('stands on Nightmare after the same siege', () => {
    newGame({ difficulty: 'nightmare', army: emptyArmy(), raidsFought: siegeRaid - 1, nextRaidAt: 61, autoResolveRaids: true });
    run(70);
    expect(game().fallen).toBeNull();
    expect(game().raidReport?.outcome).toBe('lost');
  });

  it(`falls after ${String(SIEGES_TO_FALL)} lost sieges in a row, even with an army`, () => {
    newGame({ difficulty: 'hardcore', army: { ...emptyArmy(), pikeman: 1 }, raidsFought: siegeRaid - 1, raidsLostInARow: SIEGES_TO_FALL - 1, nextRaidAt: 61, autoResolveRaids: true });
    run(70);
    expect(game().raidReport?.outcome).toBe('lost');
    expect(game().fallen?.reason).toMatch(/in a row/);
  });

  it('falls when the last peasant leaves (no household stays)', () => {
    newGame({ difficulty: 'hardcore', population: 2, happiness: 0, warehouse: warehouseWith({}), hungry: true, sites: [], pendingSites: [] });
    game().setTaxRate('cruel');
    run(DIFFICULTY.hardcore.leaveSeconds * 3);
    expect(game().population).toBe(0);
    expect(game().fallen?.reason).toMatch(/last peasant/);
  });

  it('closes the road to Aldmere after a lost campaign battle', () => {
    newGame({ difficulty: 'hardcore', army: { ...emptyArmy(), angel: 1, pikeman: 12 } });
    run(1);
    useGameStore.setState({ army: { ...emptyArmy(), pikeman: 1 } });
    game().startCampaignBattle();
    game().quickResolveBattle();
    expect(game().battle?.status).toBe('lost');
    expect(game().campaign.closed).toBe(true);
    game().closeBattle();
    useGameStore.setState({ army: { ...emptyArmy(), angel: 50 } });
    expect(campaignBlocker(game())).toMatch(/closed/);
  });
});

describe('saves and unlocks', () => {
  it('load older saves as Normal, and keep a setting and a fall', () => {
    const fresh = useGameStore.getInitialState();
    expect(mergeSave({}, fresh).difficulty).toBe('normal');
    expect(mergeSave({ difficulty: 'hard' }, fresh).difficulty).toBe('hard');
    expect(mergeSave({ difficulty: 'impossible' as never }, fresh).difficulty).toBe('normal');
    const fallen = { reason: 'gone', at: 100, raidsFought: 3, campaignWon: 0 };
    expect(mergeSave({ difficulty: 'hardcore', fallen }, fresh).fallen).toEqual(fallen);
    expect(mergeSave({}, fresh).fallen).toBeNull();
  });

  it('open Hardcore with a Nightmare victory and crown a Hardcore one, kept apart from the save', () => {
    (globalThis as { localStorage?: unknown }).localStorage = memoryStorage();
    resetUnlocksCache();
    expect(readUnlocks()).toEqual({ hardcore: false, crowned: false });
    campaignWonOn('hard');
    expect(readUnlocks().hardcore).toBe(false);
    campaignWonOn('nightmare');
    expect(readUnlocks()).toEqual({ hardcore: true, crowned: false });
    campaignWonOn('hardcore');
    expect(readUnlocks()).toEqual({ hardcore: true, crowned: true });
    // Read back from storage, not just the cache.
    resetUnlocksCache();
    expect(readUnlocks().crowned).toBe(true);
    delete (globalThis as { localStorage?: unknown }).localStorage;
    resetUnlocksCache();
  });
});
