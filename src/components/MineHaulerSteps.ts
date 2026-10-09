// The stockpile bins' sizes and places, and how finely their heaps follow the stock. Kept Skia-free so
// MineViewport can import it on web before CanvasKit has loaded (it hit-tests taps on the bins).
import { depositAt, type Site } from '../game/mineLayout';
import { MINE_RESOURCES, type Resource } from '../game/resources';
import { MINE_EXIT_BIN_WIDTH, MINE_GROUND_Y, MINE_TILE_SIZE, getExitBinX } from './MineMapLayout';

/** Heap heights a bin can show (0..steps): about one pixel each, so a heap rises and sinks smoothly. */
export const MINER_PILE_STEPS = 24;
export const EXIT_PILE_STEPS = 30;

export const MINER_BIN_WIDTH = 20;
export const MINER_BIN_HEIGHT = 12;
export const EXIT_BIN_HEIGHT = 22;
/** How far a full heap rises above the rim. */
export const HEAP_RISE = 8;
/** The exit bins' signs stand this far above the ground. */
const EXIT_SIGN_TOP = 46;
/** Taps this close to a bin count as on it (the miners' bins are small). */
const TAP_SLOP = 6;

/** The left edge of a miner's bin: on the floor beside them, away from the face they work. */
export function minerBinX(site: Site) {
  const faceOnLeft = site.faceColumn < site.column;
  return site.column * MINE_TILE_SIZE + (faceOnLeft ? MINE_TILE_SIZE - MINER_BIN_WIDTH - 4 : 4);
}

/** The resource of the bin at a map point, if any: one of the exit bins on the surface, or a miner's bin. */
export function binAt(sites: readonly Site[], x: number, y: number): Resource | null {
  const inside = (left: number, top: number, width: number, bottom: number) =>
    x >= left - TAP_SLOP && x <= left + width + TAP_SLOP && y >= top - TAP_SLOP && y <= bottom + TAP_SLOP;
  for (const [index, resource] of MINE_RESOURCES.entries()) {
    if (inside(getExitBinX(index), MINE_GROUND_Y - EXIT_SIGN_TOP, MINE_EXIT_BIN_WIDTH, MINE_GROUND_Y)) return resource;
  }
  for (const site of sites) {
    const floor = site.row * MINE_TILE_SIZE + MINE_TILE_SIZE;
    if (inside(minerBinX(site), floor - MINER_BIN_HEIGHT - HEAP_RISE, MINER_BIN_WIDTH, floor)) {
      return depositAt(site.faceRow, site.faceColumn) ?? 'coal';
    }
  }
  return null;
}
