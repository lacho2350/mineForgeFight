// What the player has earned across games, kept apart from the save (a new game or a fallen hold doesn't
// lose it): Hardcore, opened by winning the campaign on Nightmare, and the crown for winning it on Hardcore.
// Stored next to the save in `localStorage` (none in Node tests: nothing is kept there).
import type { Difficulty } from './difficulty';

export const UNLOCKS_KEY = 'mineforge-unlocks';
export type Unlocks = { hardcore: boolean; crowned: boolean };
const NONE: Unlocks = { hardcore: false, crowned: false };

const storage = () => (typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage);
let cached: Unlocks | null = null;
const listeners = new Set<() => void>();

export function readUnlocks(): Unlocks {
  if (cached) return cached;
  try {
    const raw = storage()?.getItem(UNLOCKS_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<Unlocks>) : {};
    cached = { hardcore: saved.hardcore === true, crowned: saved.crowned === true };
  } catch {
    cached = { ...NONE };
  }
  return cached;
}

export function subscribeUnlocks(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function write(next: Unlocks) {
  cached = next;
  try {
    storage()?.setItem(UNLOCKS_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('Could not save the unlocks', error);
  }
  for (const listener of listeners) listener();
}

/** The campaign was won on `difficulty`: Nightmare opens Hardcore, Hardcore earns the crown. */
export function campaignWonOn(difficulty: Difficulty) {
  const now = readUnlocks();
  if (difficulty === 'nightmare' && !now.hardcore) write({ ...now, hardcore: true });
  if (difficulty === 'hardcore' && !now.crowned) write({ ...now, hardcore: true, crowned: true });
}

/** Forget the cached copy (tests). */
export function resetUnlocksCache() {
  cached = null;
}
