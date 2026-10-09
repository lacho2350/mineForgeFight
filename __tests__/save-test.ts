import { CASTLE, GATE_ROAD } from '../src/game/cityMap';
import { trapProblem } from '../src/game/traps';
import { memoryStorage, writeSave } from './support';

// Each test loads a save into a store of its own (a fresh copy of the modules), the way the app starts.
type Modules = { store: typeof import('../src/game/gameStore'); save: typeof import('../src/game/save') };
function freshModules(): Modules {
  let modules: Modules | undefined;
  jest.isolateModules(() => {
    // A fresh copy needs require: jest only isolates synchronous loads without experimental VM modules.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    modules = { store: require('../src/game/gameStore'), save: require('../src/game/save') };
  });
  if (!modules) throw new Error('modules not loaded');
  return modules;
}

let storage: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  storage = memoryStorage();
  (globalThis as { localStorage?: unknown }).localStorage = storage;
});
afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('loading older saves', () => {
  it('moves a 47-tile hold onto the 59-tile map', async () => {
    writeSave(storage, {
      placements: { houses: { x: 12, y: 29 }, warehouse: { x: 25, y: 28 }, foundry: { x: 35, y: 35 } },
      buildings: { houses: 2, keep: 2 },
      roads: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`23,${String(28 + i)}`, 'dirt'])),
      traps: [{ kind: 'spikes', x: 3, y: 20 }, { kind: 'snare', x: 42, y: 30 }],
      elapsedSeconds: 100,
    }, 2);
    const { store } = freshModules();
    await store.loadGame();
    const state = store.useGameStore.getState();
    expect(state.placements.warehouse).toEqual({ x: 31, y: 34 });
    expect(state.placements.houses).toEqual({ x: 18, y: 35 });
    // Houses added since are there, unbuilt.
    expect(state.buildings.houses).toBe(2);
    expect(state.buildings.houses2).toBe(0);
    expect(state.buildings.houses8).toBe(0);
    // Traps keep their place in the belt on their own side.
    expect(state.traps).toEqual([{ kind: 'spikes', x: 3, y: 26 }, { kind: 'snare', x: 54, y: 36 }]);
    for (const trap of state.traps) expect(trapProblem(trap, state.traps.filter((other) => other !== trap))).toBeNull();
    // The road that ran down to the gate is carried on to it.
    expect(state.roads[`${String(GATE_ROAD.x)},${String(CASTLE.y1 - 1)}`]).toBe('dirt');
  });

  it('pays back old armory orders and moves gear out to its dwellings', async () => {
    writeSave(storage, {
      buildings: { guardhouse: 2 },
      warehouse: { iron: 5 },
      items: { pike: 10, sword: 1, bogus: 4 },
      craftQueue: [{ item: 'sword', count: 4, made: 1, paid: { resources: { iron: 8, tin: 4 }, used: { steel: 2 } } }],
    }, 3);
    const { store } = freshModules();
    await store.loadGame();
    const state = store.useGameStore.getState();
    expect(state.warehouse.iron).toBe(11);
    expect(state.warehouse.tin).toBe(3);
    expect(state.items.steel).toBe(1);
    expect(state.dwellingGear.pikeman).toBe(10);
    expect(state.items.pike).toBe(0);
    expect('bogus' in state.items).toBe(false);
    expect('craftQueue' in state).toBe(false);
  });

  it('treats a raid sighted before field battles as a siege', async () => {
    writeSave(storage, { elapsedSeconds: 500, raidsFought: 9, raid: { number: 10, arrivesAt: 530, party: [{ unit: 'goblin', count: 3 }] } }, 3);
    const { store } = freshModules();
    await store.loadGame();
    expect(store.useGameStore.getState().raid?.kind).toBe('siege');
  });
});

describe('the save guard', () => {
  it('never writes over a save it could not load', async () => {
    writeSave(storage, { elapsedSeconds: 5000, gold: 999, traps: 'not a list' }, 3);
    const before = storage.getItem('mineforge-save');
    const { store, save } = freshModules();
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await store.loadGame();
    for (let i = 0; i < 5; i++) store.useGameStore.getState().tick();
    save.flushSave();
    expect(storage.getItem('mineforge-save')).toBe(before);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('writes nothing until the save has loaded, then saves as usual', async () => {
    writeSave(storage, { elapsedSeconds: 5000, gold: 999 }, 3);
    const { store, save } = freshModules();
    for (let i = 0; i < 3; i++) store.useGameStore.getState().tick();
    save.flushSave();
    expect(JSON.parse(storage.getItem('mineforge-save') ?? '{}').state.elapsedSeconds).toBe(5000);
    await store.loadGame();
    for (let i = 0; i < 3; i++) store.useGameStore.getState().tick();
    save.flushSave();
    const saved = JSON.parse(storage.getItem('mineforge-save') ?? '{}').state;
    expect(saved.elapsedSeconds).toBe(5003);
    expect(saved.gold).toBeGreaterThanOrEqual(999);
  });
});
