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
export const MINE_STATIONS = [-2, 2, -5, 5, -8, 8, -11, 11].map((offset) => ({
  minerColumn: MINE_SHAFT_COLUMN + offset,
  oreColumn: MINE_SHAFT_COLUMN + offset + Math.sign(offset),
}));

// Surface ground line (see mineTerrain's drawSurface) and the mine exit stockpile beside the headhouse.
export const MINE_GROUND_Y = MINE_TILE_SIZE * MINE_SURFACE_ROWS - 14;
export const MINE_EXIT_PILE_X = MINE_SHAFT_X + MINE_TILE_SIZE + 32;
// One bin per resource stands in a row beside the headhouse.
export const MINE_EXIT_BIN_WIDTH = 40;
export const MINE_EXIT_BIN_GAP = 8;
export const getExitBinX = (index: number) => MINE_EXIT_PILE_X + index * (MINE_EXIT_BIN_WIDTH + MINE_EXIT_BIN_GAP);
