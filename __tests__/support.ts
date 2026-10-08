// Shared set-up for the game-logic tests (not a test file itself: only `*-test.ts` files run).
import type { BuildingId } from '../src/game/buildings';
import { nearestFreeSpot, type Spot } from '../src/game/cityMap';
import type { GameState } from '../src/game/state';
import { BUILDING_NAMES } from '../src/game/hold';
import { useGameStore } from '../src/game/gameStore';
import { emptyStock, type Resource, type Stock } from '../src/game/resources';

/** A `localStorage` kept in memory, so the save can be written and read back. */
export function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
  };
}

/** Write a save the way the game stores it (`{ state, version }` under its key). */
export function writeSave(storage: ReturnType<typeof memoryStorage>, state: Record<string, unknown>, version: number) {
  storage.setItem('mineforge-save', JSON.stringify({ state, version }));
}

/** Back to a brand-new game, with raids pushed far off unless a test wants them. */
export function newGame(overrides: Partial<GameState> = {}) {
  useGameStore.setState(useGameStore.getInitialState(), true);
  useGameStore.setState({ nextRaidAt: 1e9, ...overrides });
  return useGameStore;
}

export const game = () => useGameStore.getState();

/** Run the simulation `seconds` ticks. */
export function run(seconds: number) {
  for (let i = 0; i < seconds; i++) useGameStore.getState().tick();
}

/** A warehouse holding just these amounts. */
export const warehouseWith = (amounts: Partial<Record<Resource, number>>): Stock => ({ ...emptyStock(), ...amounts });

/** Give these buildings spots near the warehouse (rocks aside) and set their levels. */
export function build(levels: Partial<Record<BuildingId, number>>, near: Spot = { x: 31, y: 30 }) {
  const state = useGameStore.getState();
  let placements = { ...state.placements };
  for (const id of Object.keys(levels) as BuildingId[]) {
    if (placements[id]) continue;
    const spot = nearestFreeSpot(id, near, placements, BUILDING_NAMES);
    if (spot) placements = { ...placements, [id]: spot };
  }
  useGameStore.setState({ placements, buildings: { ...state.buildings, ...levels } });
}
