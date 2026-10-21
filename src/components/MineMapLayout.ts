export const MINE_TILE_SIZE = 48;
export const MINE_COLUMNS = 300;
export const MINE_GALLERY_COUNT = 450;
// The lift runs down the middle of the claim, leaving room to dig out either side.
export const MINE_SHAFT_COLUMN = MINE_COLUMNS / 2;
export const MINE_SHAFT_X = MINE_SHAFT_COLUMN * MINE_TILE_SIZE;
// Each level is 5 rows: a rock row, the miners' chambers, 2 rows of ladder shaft, then the rail tunnel.
export const MINE_LEVEL_ROWS = 5;
// Miners work this many rows above their level's rail tunnel; buckets lower the coal down to it.
export const MINE_WORK_RISE = 3;
// Map rows: 0–1 surface, 2–6 the entrance level (rail tunnel on row 6), then one level per gallery.
export const MINE_SURFACE_ROWS = 2;
export const MINE_ENTRANCE_ROW = MINE_SURFACE_ROWS + MINE_LEVEL_ROWS - 1;
export const MINE_GALLERY_STEP = MINE_TILE_SIZE * MINE_LEVEL_ROWS;
export const MINE_GALLERY_START = (MINE_ENTRANCE_ROW + 1) * MINE_TILE_SIZE;
export const MINE_MAP_WIDTH = MINE_COLUMNS * MINE_TILE_SIZE;

// The camera (MineViewport): map drawn beyond the screen edges so panning rarely reveals undrawn rock,
// and the visible-area state only updates when the camera crosses VIEW_STEP map pixels (or a zoom step).
export const MINE_OVERSCAN = MINE_TILE_SIZE * 4;
export const MINE_VIEW_STEP = MINE_TILE_SIZE * 3;

/** The part of the map (in map pixels, with some margin) the camera can currently see. */
export type MineView = { left: number; top: number; right: number; bottom: number };

/** The camera's first position: centred on the lift at the surface, at zoom 1, in a viewport `width` wide. */
export const mineStartCamX = (width: number) => Math.min(Math.max(MINE_SHAFT_X + MINE_TILE_SIZE / 2 - width / 2, 0), Math.max(0, MINE_MAP_WIDTH - width));

/** The view the camera shows from (camX, camY) at `zoom` in a viewport `width` × `height` (as the viewport reports it). */
export function mineViewAt(camX: number, camY: number, zoom: number, width: number, height: number): MineView {
  const left = Math.floor(camX / MINE_VIEW_STEP) * MINE_VIEW_STEP - MINE_OVERSCAN;
  const top = Math.floor(camY / MINE_VIEW_STEP) * MINE_VIEW_STEP - MINE_OVERSCAN;
  return { left, top, right: left + MINE_VIEW_STEP + width / zoom + MINE_OVERSCAN * 2, bottom: top + MINE_VIEW_STEP + height / zoom + MINE_OVERSCAN * 2 };
}

// Unexplored rock shown under the deepest gallery.
export const MINE_BEDROCK_MARGIN = MINE_TILE_SIZE * 2;

// Only galleries the player has dug are drawn, so the map grows with depth.
export function getMineMapHeight(depth: number) {
  const galleries = Math.min(Math.max(depth, 0), MINE_GALLERY_COUNT);
  return (getTunnelRow(galleries - 1) + 1) * MINE_TILE_SIZE + MINE_BEDROCK_MARGIN;
}

// Level -1 is the entrance level; galleries are 0..depth-1.
export function getTunnelRow(level: number) {
  return MINE_ENTRANCE_ROW + (level + 1) * MINE_LEVEL_ROWS;
}

export function getWorkRow(level: number) {
  return getTunnelRow(level) - MINE_WORK_RISE;
}

// Work stations, filled nearest-first alternating sides of the lift. Every miner's ladder shaft keeps a
// tile of solid rock between it and the lift or the next shaft: lift | rock | shaft, ore | rock | shaft, ore …
export const MINE_STATIONS = [-2, 2, -5, 5, -8, 8, -11, 11, -14, 14, -17, 17].map((offset) => ({
  minerColumn: MINE_SHAFT_COLUMN + offset,
  oreColumn: MINE_SHAFT_COLUMN + offset + Math.sign(offset),
}));

// Surface ground line (see mineSurface.ts) and the mine exit stockpiles either side of the headhouse.
export const MINE_GROUND_Y = MINE_TILE_SIZE * MINE_SURFACE_ROWS - 14;
/** Where the first bin right of the headhouse starts; the left row mirrors the right about the lift. */
export const MINE_EXIT_PILE_X = MINE_SHAFT_X + MINE_TILE_SIZE + 32;
// One bin per resource, in two rows of six either side of the headhouse: the resources take turns,
// right then left (coal right by the door, granite left by it, …), so the commonest sit nearest the lift.
export const MINE_EXIT_BIN_WIDTH = 40;
export const MINE_EXIT_BIN_GAP = 8;
/** Is this resource's exit bin (by its index in MINE_RESOURCES) on the left of the headhouse? */
export const exitBinOnLeft = (index: number) => index % 2 === 1;
export const getExitBinX = (index: number) => {
  const right = MINE_EXIT_PILE_X + Math.floor(index / 2) * (MINE_EXIT_BIN_WIDTH + MINE_EXIT_BIN_GAP);
  return exitBinOnLeft(index) ? 2 * MINE_SHAFT_X + MINE_TILE_SIZE - right - MINE_EXIT_BIN_WIDTH : right;
};
