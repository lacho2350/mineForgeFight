// Saving the game: the store is persisted to `localStorage` (the browser's on web; on iOS/Android
// the app entry installs expo-sqlite's implementation). The simulation changes state every second, so
// writes are batched: the latest state is written a few seconds after a change, and straight away when
// the app goes to the background or the page closes (`flushSave`). Without any `localStorage` (e.g. in
// Node tests) saving is simply off.
import type { PersistStorage, StorageValue } from 'zustand/middleware';

export const SAVE_KEY = 'mineforge-save';
/**
 * 2: the stronghold map grew outer rings (placements moved 7 tiles in). 3: it grew from 47 to 59 tiles.
 * 4: the eight 2×2 workers' houses became up to 24 one-tile cottages, each kept by its woman.
 * 5: buildings need a road at the door joined to the keep and the gate (laid free for the ones without).
 * 6: a one-tile building's door opens on any side (the roads are laid free once more, for the cottages
 *    packed four to a block whose back row no road could reach).
 */
export const SAVE_VERSION = 6;
const SAVE_DELAY_MS = 3000;

type Pending = { name: string; value: StorageValue<unknown> };

let pending: Pending | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

const storage = () => (typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage);

/** Write the latest state now (call when the app is about to be hidden or closed). */
export function flushSave() {
  if (timer) clearTimeout(timer);
  timer = undefined;
  const next = pending;
  pending = null;
  if (!next) return;
  try {
    storage()?.setItem(next.name, JSON.stringify(next.value));
  } catch (error) {
    console.warn('Could not save the game', error);
  }
}

/** The store's save storage; `markLoaded` once the save is in the game (or there was none). */
export type SaveStorage<S> = PersistStorage<S> & { markLoaded: () => void };

export function createSaveStorage<S>(): SaveStorage<S> {
  // Nothing is written until the save has been loaded into the game: a game that failed to load it (or,
  // in development, a store recreated by a reload that hasn't loaded it yet) is a new game, and must
  // never be written over the player's save.
  let loaded = false;
  return {
    getItem: (name) => {
      let raw: string | null | undefined;
      try {
        raw = storage()?.getItem(name);
        return raw ? (JSON.parse(raw) as StorageValue<S>) : null;
      } catch (error) {
        // A damaged save starts a new game rather than crashing; a copy of it is kept aside.
        console.warn('Could not load the saved game', error);
        if (raw) storage()?.setItem(`${name}-damaged`, raw);
        return null;
      }
    },
    setItem: (name, value) => {
      if (!loaded) return;
      // State snapshots are immutable, so holding on to the latest one until it's written is safe.
      pending = { name, value };
      timer ??= setTimeout(flushSave, SAVE_DELAY_MS);
    },
    removeItem: (name) => {
      if (pending?.name === name) pending = null;
      storage()?.removeItem(name);
    },
    markLoaded: () => {
      loaded = true;
    },
  };
}
