// Playthroughs: whole stretches of a game run through the store the way the screens drive it — a bot
// player building up the hold, a player away while the raids come, a hold driven to despair and nursed back,
// a game saved and loaded mid-play, a campaign fought by the captains. Every game minute the state is checked
// for things that must never happen (NaN, negative stock, happiness off its scale, too many peasants).
import { BUILDING_IDS } from '../src/game/buildings';
import { isPlaceable, nearestFreeSpot, tileKey } from '../src/game/cityMap';
import { upgradeBlocker } from '../src/game/costs';
import { FOODS, isFarm } from '../src/game/farms';
import { useGameStore } from '../src/game/gameStore';
import { DIFFICULTIES, rulesOf, type Difficulty } from '../src/game/difficulty';
import { MAX_HAPPINESS, moodWord } from '../src/game/happiness';
import { BUILDING_NAMES, fillStaffing } from '../src/game/hold';
import { MAX_PEASANTS } from '../src/game/houses';
import { RESOURCES, type Stock } from '../src/game/resources';
import { accessRoads } from '../src/game/roads';
import { rockyTest } from '../src/game/rocks';
import { mergeSave } from '../src/game/saveMigration';
import type { GameState } from '../src/game/state';
import { emptyArmy } from '../src/game/units';
import { game, newGame, run, warehouseWith } from './support';

/** Where a number in the state is NaN, if anywhere. */
function findNaN(value: unknown, path = 'state', seen = new Set<unknown>()): string | null {
  if (typeof value === 'number') return Number.isNaN(value) ? path : null;
  if (!value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  for (const [key, inner] of Object.entries(value)) {
    if (typeof inner === 'function') continue;
    const found = findNaN(inner, `${path}.${key}`, seen);
    if (found) return found;
  }
  return null;
}

/** What must hold at every moment of every game. */
function checkInvariants(state: GameState = game()) {
  const where = `at ${String(state.elapsedSeconds)} s`;
  expect([where, findNaN(state)]).toEqual([where, null]);
  expect(state.happiness).toBeGreaterThanOrEqual(0);
  expect(state.happiness).toBeLessThanOrEqual(MAX_HAPPINESS);
  expect(state.population).toBeGreaterThanOrEqual(0);
  expect(state.population).toBeLessThanOrEqual(MAX_PEASANTS);
  expect(state.gold).toBeGreaterThanOrEqual(0);
  const stocks: [string, Stock][] = [
    ['warehouse', state.warehouse],
    ['mineExit', state.mineExit],
    ['mineStock', state.mineStock],
  ];
  for (const [name, stock] of stocks) {
    for (const resource of RESOURCES) {
      const amount = stock[resource];
      if (amount < -1e-6) throw new Error(`${name}.${resource} is ${String(amount)} ${where}`);
    }
  }
  for (const resource of RESOURCES) {
    if (state.warehouse[resource] > state.warehouseCapacity + 1e-6) {
      throw new Error(`warehouse.${resource} holds ${String(state.warehouse[resource])}, over its ${String(state.warehouseCapacity)} ${where}`);
    }
  }
  for (const [unit, count] of Object.entries(state.army)) {
    if (!(count >= 0)) throw new Error(`army.${unit} is ${String(count)} ${where}`);
  }
  for (const id of BUILDING_IDS) {
    const level = state.buildings[id];
    if (!Number.isInteger(level) || level < 0) throw new Error(`${id} is at level ${String(level)} ${where}`);
  }
}

/** Run `minutes` game minutes, checking the invariants each minute and doing `each` (the player) first. */
function play(minutes: number, each?: (minute: number) => void) {
  for (let minute = 0; minute < minutes; minute++) {
    each?.(minute);
    run(60);
    checkInvariants();
  }
}

const totalLevels = (state: GameState = game()) => BUILDING_IDS.reduce((sum, id) => sum + state.buildings[id], 0);

const foodInStore = (state: GameState = game()) => FOODS.reduce((sum, food) => sum + state.warehouse[food], 0);

/** Farms first: a sensible player feeds the hold before anything else. */
const BOT_ORDER = [...BUILDING_IDS.filter(isFarm), ...BUILDING_IDS.filter((id) => !isFarm(id))];

/** A simple player: staffs the city and the mine, then starts whatever it can — upgrades first, new buildings
 * on the nearest free spot to the warehouse, farms before anything else and only farms while the larder runs
 * down — and recruits a few pikemen when the hold can spare them. */
function makeBot() {
  let lastFood = foodInStore();
  return () => {
    game().autoAssignCity();
    game().autoAssignMine();
    const food = foodInStore();
    const short = game().hungry || food < lastFood || food < game().population * 3;
    lastFood = food;
    for (const id of BOT_ORDER) {
      if (short && !isFarm(id)) break;
      const state = game();
      if (upgradeBlocker(state, id)) continue;
      if (state.buildings[id] > 0 || state.placements[id] || !isPlaceable(id)) {
        game().upgradeBuilding(id);
        continue;
      }
      const near = state.placements.warehouse ?? { x: 31, y: 30 };
      const onRoad = (x: number, y: number) => !!state.roads[tileKey(x, y)];
      const spot = nearestFreeSpot(id, near, state.placements, BUILDING_NAMES, rockyTest(state.clearedRocks), onRoad, accessRoads(state.roads));
      if (spot) game().placeBuilding(id, spot);
    }
    // A few soldiers at a time, never the hold's last hands.
    if (!short && game().population > 20) game().recruit('pikeman', 2);
    game().autoAssignCity();
  };
}

describe('playthroughs', () => {
  it('a new game starts sound', () => {
    newGame();
    checkInvariants();
    expect(game().population).toBeGreaterThan(0);
    expect(FOODS.some((food) => game().warehouse[food] > 0)).toBe(true);
  });

  it('a bot player builds the hold up over an hour without anything going wrong', () => {
    newGame();
    const startLevels = totalLevels();
    const startPopulation = game().population;
    const bot = makeBot();
    const trace: string[] = [];
    play(60, (minute) => {
      const state = game();
      trace.push(`${String(minute)}m pop ${String(state.population)} mood ${String(Math.round(state.happiness))} gold ${String(Math.round(state.gold))} levels ${String(totalLevels(state))} hungry ${String(state.hungry)}`);
      bot();
    });
    const end = game();
    if (end.population <= 0) throw new Error(`the hold emptied:\n${trace.join('\n')}`);
    expect(end.elapsedSeconds).toBeGreaterThanOrEqual(3600);
    // It got somewhere: more built, and the hold is still lived in.
    expect(totalLevels(end)).toBeGreaterThan(startLevels);
    expect(end.population).toBeGreaterThan(0);
    expect(end.population).toBeGreaterThanOrEqual(Math.min(startPopulation, 1));
  });

  it('an absent player’s hold weathers an hour and a half of raids, the captains fighting them', () => {
    newGame({ nextRaidAt: 120, autoResolveRaids: true, army: { ...emptyArmy(), pikeman: 20, bowman: 10 }, gold: 500 });
    let activeFor = 0;
    for (let minute = 0; minute < 90; minute++) {
      for (let second = 0; second < 60; second++) {
        run(1);
        activeFor = game().battle?.status === 'active' ? activeFor + 1 : 0;
        // No battle hangs waiting for a player who isn't there.
        if (activeFor > 900) throw new Error(`a battle has waited ${String(activeFor)} s at ${String(game().elapsedSeconds)} s`);
      }
      checkInvariants();
    }
    expect(game().raidsFought).toBeGreaterThanOrEqual(1);
    expect(game().raidReport).not.toBeNull();
  });

  // The same absent player at every difficulty: nothing breaks, harder settings bring more raids, and a
  // fallen Hardcore hold stops dead.
  const raidsBy: Partial<Record<Difficulty, number>> = {};
  it.each(DIFFICULTIES)('on %s, an absent player’s hour and a half of raids leaves the game sound', (difficulty) => {
    useGameStore.getState().resetGame(difficulty);
    useGameStore.setState({ autoResolveRaids: true, army: { ...emptyArmy(), pikeman: 20, bowman: 10 }, staffing: fillStaffing(game()) });
    expect(game().difficulty).toBe(difficulty);
    expect(game().gold).toBe(rulesOf(difficulty).startGold);
    for (let minute = 0; minute < 90; minute++) {
      if (game().fallen) break;
      run(60);
      checkInvariants();
    }
    if (game().fallen) {
      expect(difficulty).toBe('hardcore');
      const at = game().elapsedSeconds;
      run(30);
      expect(game().elapsedSeconds).toBe(at);
    } else {
      expect(game().raidsFought).toBeGreaterThanOrEqual(1);
    }
    raidsBy[difficulty] = game().raidsFought;
  });

  it('brings more raids the harder the game', () => {
    expect(raidsBy.easy).toBeDefined();
    expect(raidsBy.nightmare!).toBeGreaterThan(raidsBy.normal!);
    expect(raidsBy.normal!).toBeGreaterThan(raidsBy.easy!);
  });

  it('cruel taxes and an empty store drive the peasants away, and kindness brings the hold back', () => {
    const empty = Object.fromEntries(FOODS.map((food) => [food, 0]));
    newGame({ happiness: 10 });
    useGameStore.setState({ warehouse: { ...game().warehouse, ...empty } });
    game().setTaxRate('cruel');
    // It sinks to nothing within a few minutes, whatever the farms bring in.
    let minutes = 0;
    while (game().happiness > 0 && minutes < 15) {
      useGameStore.setState({ warehouse: { ...game().warehouse, ...empty } });
      play(1);
      minutes += 1;
    }
    expect(game().happiness).toBe(0);
    expect(moodWord(game().happiness)).toBe('Leaving');
    const despairing = game().population;
    play(5, () => useGameStore.setState({ warehouse: { ...game().warehouse, ...empty } }));
    expect(game().population).toBeLessThan(despairing);
    // No taxes and a full larder: the mood turns and nobody else leaves.
    game().setTaxRate('none');
    const full = Object.fromEntries(FOODS.map((food) => [food, Math.min(200, game().warehouseCapacity)]));
    useGameStore.setState({ warehouse: { ...game().warehouse, ...full }, hungry: false });
    play(3);
    expect(game().happiness).toBeGreaterThan(0);
    const recovering = game().population;
    play(10);
    expect(game().happiness).toBeGreaterThan(5);
    expect(game().population).toBeGreaterThanOrEqual(recovering);
    expect(moodWord(game().happiness)).not.toBe('Leaving');
  });

  it('a game saved and loaded mid-play carries on as if nothing happened', () => {
    newGame();
    const bot = makeBot();
    play(20, bot);
    const before = game();
    // The save is plain JSON: write it out and read it back into a fresh store state.
    const saved = JSON.parse(JSON.stringify(before)) as Parameters<typeof mergeSave>[0];
    const loaded = mergeSave(saved, useGameStore.getInitialState());
    useGameStore.setState(loaded, true);
    const after = game();
    checkInvariants(after);
    expect(after.elapsedSeconds).toBe(before.elapsedSeconds);
    expect(after.population).toBe(before.population);
    expect(after.buildings).toEqual(before.buildings);
    expect(after.warehouse).toEqual(before.warehouse);
    expect(after.happiness).toBe(before.happiness);
    expect(after.taxRate).toBe(before.taxRate);
    expect(after.placements).toEqual(before.placements);
    // … and the game goes on from there.
    play(20, bot);
    expect(game().elapsedSeconds).toBeGreaterThanOrEqual(before.elapsedSeconds + 1200);
  });

  it('a campaign fought out by the captains, minute by minute, cheers the hold with each win', () => {
    newGame({ army: { ...emptyArmy(), angel: 1, pikeman: 12 }, happiness: 40 });
    run(1);
    expect(game().campaign.unlocked).toBe(true);
    useGameStore.setState({ army: { ...emptyArmy(), angel: 120, paladin: 40 } });
    for (let stage = 1; stage <= 3; stage++) {
      game().startCampaignBattle();
      expect(game().battle?.campaign).toBe(stage);
      let mood = game().happiness;
      for (let seconds = 0; game().battle?.status === 'active' && seconds < 3000; seconds++) {
        mood = game().happiness;
        run(1);
      }
      expect(game().battle?.status).toBe('won');
      expect(game().campaign.won).toBe(stage);
      // The win lifts the mood at once (BATTLE_MOOD.won), up to the top of the scale.
      expect(game().happiness).toBeGreaterThanOrEqual(Math.min(MAX_HAPPINESS, mood + 9));
      checkInvariants();
      game().closeBattle();
    }
  });
});
