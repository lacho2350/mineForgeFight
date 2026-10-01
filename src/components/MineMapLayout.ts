export const MINE_TILE_SIZE = 48;
export const MINE_COLUMNS = 30;
export const MINE_GALLERY_COUNT = 45;
export const MINE_SHAFT_COLUMN = 14;
export const MINE_SHAFT_X = MINE_SHAFT_COLUMN * MINE_TILE_SIZE;
export const MINE_GALLERY_START = MINE_TILE_SIZE * 5;
export const MINE_GALLERY_STEP = MINE_TILE_SIZE * 2;
export const MINE_MAP_WIDTH = MINE_COLUMNS * MINE_TILE_SIZE;
export const MINE_MAP_HEIGHT = MINE_GALLERY_START + MINE_GALLERY_COUNT * MINE_GALLERY_STEP;

export const MINE_STATIONS = [
  { minerColumn: 13, oreColumn: 12 },
  { minerColumn: 15, oreColumn: 16 },
  { minerColumn: 10, oreColumn: 9 },
  { minerColumn: 18, oreColumn: 19 },
  { minerColumn: 7, oreColumn: 6 },
  { minerColumn: 21, oreColumn: 22 },
  { minerColumn: 4, oreColumn: 3 },
  { minerColumn: 24, oreColumn: 25 },
] as const;