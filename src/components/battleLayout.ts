// Battlefield geometry shared by the board canvas and the battle screen (taps, labels). Skia-free.
import { BATTLE_COLS, BATTLE_ROWS, type Hex } from '../game/combat';

export const SQRT3 = Math.sqrt(3);
/** Width of the strip right of the field where the towers stand, in hex sizes. */
const TOWER_STRIP = 1.7;

export type BoardLayout = { size: number; width: number; height: number; fieldWidth: number };

/** Fit the field (and the tower strip) into `width`, with hexes between `minSize` and `maxSize`. */
export function boardLayout(width: number, maxSize = 30, minSize = 8): BoardLayout {
  const size = Math.max(minSize, Math.min(maxSize, width / (SQRT3 * (BATTLE_COLS + 0.5) + TOWER_STRIP)));
  const fieldWidth = SQRT3 * size * (BATTLE_COLS + 0.5);
  return { size, fieldWidth, width: fieldWidth + TOWER_STRIP * size, height: size * (1.5 * BATTLE_ROWS + 0.5) };
}

export function hexCenter(size: number, col: number, row: number) {
  return { x: SQRT3 * size * (col + 0.5 * (row & 1)) + (SQRT3 * size) / 2, y: size * (1.5 * row + 1) };
}

/** Corners of a hex, for drawing. */
export function hexPath(size: number, col: number, row: number, inset = 0) {
  const { x, y } = hexCenter(size, col, row);
  const r = size - inset;
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 90);
    return `${(x + r * Math.cos(angle)).toFixed(1)} ${(y + r * Math.sin(angle)).toFixed(1)}`;
  });
  return `M ${points.join(' L ')} Z`;
}

/** The hex under a point on the board, if any. */
export function hexAt(size: number, x: number, y: number): Hex | null {
  let best: Hex | null = null;
  let bestDistance = size * size;
  for (let row = 0; row < BATTLE_ROWS; row++) {
    for (let col = 0; col < BATTLE_COLS; col++) {
      const center = hexCenter(size, col, row);
      const distance = (center.x - x) ** 2 + (center.y - y) ** 2;
      if (distance < bestDistance) {
        best = { col, row };
        bestDistance = distance;
      }
    }
  }
  return best;
}
