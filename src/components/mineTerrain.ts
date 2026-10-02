import { ClipOp, Skia, createPicture, type SkCanvas, type SkPaint, type SkPicture } from '@shopify/react-native-skia';
import { MINE_COLUMNS, MINE_MAP_WIDTH, MINE_SHAFT_COLUMN, MINE_SURFACE_ROWS, MINE_TILE_SIZE } from './MineMapLayout';
import {
  depositAt,
  depositRemaining,
  depositStep,
  depositTotal,
  hash,
  isDug,
  levelOfRow,
  tileKey,
  type MineLayout,
  type Site,
} from '../game/mineLayout';
import { RESOURCE_INFO } from '../game/resources';

// Deep Corp–style terrain: bright orange earth seen from the side, narrow dark tunnels,
// and blocky darkness over everything that is not near a dug tile.

const T = MINE_TILE_SIZE;

const palette = {
  skyTop: '#f1ddb3',
  skyBottom: '#e8c88f',
  mesa: '#d49a5e',
  mesaShade: '#bf8350',
  topsoil: '#d8955a',
  dirtShallow: [0xc8, 0x7d, 0x3e],
  dirtDeep: [0x8e, 0x4b, 0x27],
  tunnel: '#2b221c',
  tunnelWall: '#34291f',
  shaft: '#20232a',
  shaftRail: '#6c727b',
  wood: '#7c4d2a',
  woodDark: '#5a361d',
  woodLight: '#a26a3a',
  rail: '#8d939b',
  tie: '#4e3220',
  lantern: '#ffd166',
  glow: '#ffcf6b',
  coal: '#1c1c1f',
  coalShine: '#4b4b52',
  patina: '#4fa58f',
  fog: '#0d0a08',
  rope: '#c9b48a',
};

// Darkness by Chebyshev distance (in tiles) from the nearest dug tile or the open surface.
const FOG_ALPHA = [0, 0.12, 0.58, 0.88];

function fogDistance(layout: MineLayout, row: number, column: number) {
  if (row < MINE_SURFACE_ROWS) return 0;
  let distance = row - (MINE_SURFACE_ROWS - 1);
  for (let r = row - FOG_ALPHA.length; r <= row + FOG_ALPHA.length; r += 1) {
    for (const c of layout.dugByRow.get(r) ?? []) {
      distance = Math.min(distance, Math.max(Math.abs(r - row), Math.abs(c - column)));
    }
  }
  return distance;
}

function fogAlpha(distance: number) {
  return distance < FOG_ALPHA.length ? FOG_ALPHA[distance] : 1;
}

function dirtColor(row: number) {
  const t = Math.min(1, Math.max(0, (row - MINE_SURFACE_ROWS) / 70));
  const [r, g, b] = palette.dirtShallow.map((value, index) => Math.round(value + (palette.dirtDeep[index] - value) * t));
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

type Painter = {
  canvas: SkCanvas;
  paint: SkPaint;
  rect: (x: number, y: number, w: number, h: number, color: string, alpha?: number) => void;
  circle: (x: number, y: number, r: number, color: string, alpha?: number) => void;
};

function painter(canvas: SkCanvas): Painter {
  const paint = Skia.Paint();
  // Hard pixel edges: anti-aliasing leaves hairline seams between tiles and chunks when zoomed.
  paint.setAntiAlias(false);
  const setFill = (color: string, alpha: number) => {
    paint.setColor(Skia.Color(color));
    paint.setAlphaf(alpha);
  };
  return {
    canvas,
    paint,
    rect: (x, y, w, h, color, alpha = 1) => {
      setFill(color, alpha);
      canvas.drawRect(Skia.XYWHRect(x, y, w, h), paint);
    },
    circle: (x, y, r, color, alpha = 1) => {
      setFill(color, alpha);
      canvas.drawCircle(x, y, r, paint);
    },
  };
}

function drawDirtTile(p: Painter, row: number, column: number) {
  const x = column * T;
  const h = hash(row, column);
  // Speckles and pebbles give the earth its grainy pixel texture.
  p.rect(x + (h % 30) + 4, (h >>> 5) % 34 + 6, 6, 3, '#000000', 0.08);
  p.rect(x + ((h >>> 9) % 30) + 6, (h >>> 14) % 34 + 6, 4, 3, '#ffffff', 0.07);
  p.rect(x + ((h >>> 18) % 34) + 4, (h >>> 23) % 36 + 4, 3, 2, '#000000', 0.12);
}

function drawCoalCluster(p: Painter, x: number, y: number, seed: number, count: number) {
  for (let i = 0; i < count; i += 1) {
    const h = hash(seed, i, 5);
    const cx = x + (h % 30) + 4;
    const cy = y + ((h >>> 6) % 26) + 4;
    const size = 7 + ((h >>> 12) % 5);
    p.rect(cx, cy, size, size - 1, palette.coal);
    p.rect(cx + 1, cy + 1, 3, 2, palette.coalShine);
  }
}

// Each resource has its own look so clusters read at a glance: a tinted tile with a coloured edge,
// and a distinct shape inside. The shape thins out in steps as the deposit is mined, and a mined-out
// deposit becomes an empty hollow.
function drawDeposit(p: Painter, layout: MineLayout, row: number, column: number, worked: boolean) {
  const deposit = depositAt(row, column);
  if (!deposit) return;
  const x = column * T;
  const step = depositStep(depositTotal(row, column), depositRemaining(layout, row, column));
  if (step === 0) {
    p.rect(x + 6, 8, T - 12, T - 16, palette.tunnel, 0.55);
    for (let i = 0; i < 4; i += 1) {
      const h = hash(row, column, 50 + i);
      p.rect(x + 8 + (h % 28), 14 + ((h >>> 6) % 22), 3, 2, RESOURCE_INFO[deposit].light, 0.6);
    }
    return;
  }
  const { color, light, dark, tint } = RESOURCE_INFO[deposit];
  p.rect(x + 1, 1, T - 2, T - 2, tint, deposit === 'coal' ? 0.22 : 0.2);
  p.rect(x + 1, 1, T - 2, 2, tint, 0.5);
  p.rect(x + 1, T - 3, T - 2, 2, tint, 0.5);
  p.rect(x + 1, 1, 2, T - 2, tint, 0.5);
  p.rect(x + T - 3, 1, 2, T - 2, tint, 0.5);

  const amount = (worked ? 2 : 1) * step; // pieces drawn: 1–8
  if (deposit === 'coal') {
    drawCoalCluster(p, x, worked ? 4 : 0, hash(row, column, worked ? 6 : 3), amount);
  } else if (deposit === 'granite') {
    for (let i = 0; i < Math.ceil(amount / 2) + 1; i += 1) {
      const h = hash(row, column, 10 + i);
      const bx = x + (h % 22) + 5;
      const by = (h >>> 6) % 20 + 8;
      p.rect(bx + 2, by, 14, 12, color);
      p.rect(bx, by + 2, 18, 8, color);
      p.rect(bx + 3, by + 1, 6, 3, light);
      p.rect(bx + 2, by + 9, 14, 3, dark);
      p.rect(bx + 9, by + 3, 1, 6, dark);
    }
  } else if (deposit === 'copper') {
    for (let i = 0; i < amount + 1; i += 1) {
      const h = hash(row, column, 30 + i);
      const sx = x + (h % 28) + 6;
      const sy = (h >>> 6) % 26 + 8;
      // Diagonal ore streaks with green patina.
      p.rect(sx, sy, 6, 3, color);
      p.rect(sx + 3, sy + 3, 6, 3, color);
      p.rect(sx + 1, sy, 3, 1, light);
      p.rect(sx + 7, sy + 5, 3, 2, palette.patina);
    }
  } else if (deposit === 'iron') {
    for (let i = 0; i < amount + 1; i += 1) {
      const h = hash(row, column, 20 + i);
      const cx = x + (h % 26) + 6;
      const cy = (h >>> 6) % 26 + 7;
      p.rect(cx, cy, 12, 9, color);
      p.rect(cx, cy + 6, 12, 3, dark);
      // Silver metallic banding.
      p.rect(cx + 2, cy + 2, 8, 1, light);
      p.rect(cx + 1, cy + 4, 5, 1, light);
    }
  } else if (deposit === 'gold') {
    // A zigzag vein across the tile, plus nuggets.
    for (let i = 0; i < 6; i += 1) p.rect(x + 6 + i * 6, 20 + (i % 2) * 5, 7, 2, color, 0.85);
    for (let i = 0; i < amount; i += 1) {
      const h = hash(row, column, 40 + i);
      const cx = x + (h % 30) + 5;
      const cy = (h >>> 6) % 28 + 6;
      const size = 4 + ((h >>> 12) % 3);
      p.rect(cx, cy, size + 2, size, color);
      p.rect(cx, cy + size - 1, size + 2, 1, dark);
      p.rect(cx + 1, cy + 1, 2, 2, light);
    }
  } else if (deposit === 'diamond') {
    for (let i = 0; i < Math.ceil(amount / 2) + 1; i += 1) {
      const h = hash(row, column, 50 + i);
      const cx = x + (h % 26) + 8;
      const cy = (h >>> 6) % 24 + 8;
      // A small faceted crystal with a bright glint.
      p.rect(cx + 2, cy, 4, 2, color);
      p.rect(cx, cy + 2, 8, 3, color);
      p.rect(cx + 2, cy + 5, 4, 2, dark);
      p.rect(cx + 3, cy + 7, 2, 1, dark);
      p.rect(cx + 2, cy + 2, 2, 1, light);
      p.rect(cx + 9, cy - 2, 1, 3, light, 0.8);
      p.rect(cx + 8, cy - 1, 3, 1, light, 0.8);
    }
  }
}

function drawShaftTile(p: Painter, isTunnel: boolean) {
  const x = MINE_SHAFT_COLUMN * T;
  p.rect(x, 0, T, T, palette.shaft);
  p.rect(x + 7, 0, 3, T, palette.shaftRail);
  p.rect(x + T - 10, 0, 3, T, palette.shaftRail);
  for (let y = 6; y < T; y += 12) p.rect(x + 10, y, T - 20, 3, palette.woodLight);
  p.rect(x + 23, 0, 2, T, '#3a3f46'); // lift cable
  p.rect(x, 0, 4, T, palette.wood);
  p.rect(x + T - 4, 0, 4, T, palette.wood);
  if (isTunnel) p.rect(x - 2, T - 6, T + 4, 6, palette.woodLight);
}

function drawTunnelRow(p: Painter, row: number, span: { left: number; right: number }, stations: Site[]) {
  const { left, right } = span;
  const x0 = left * T;
  const width = (right - left + 1) * T;

  p.rect(x0, 0, width, T, palette.tunnel);
  // Back wall: faint plank-like strata so tunnels are not flat black.
  for (let column = left; column <= right; column += 1) {
    const h = hash(row, column, 4);
    p.rect(column * T + (h % 20), 10 + ((h >>> 5) % 18), 18, 3, palette.tunnelWall);
  }
  // Rails along the floor.
  for (let column = left; column <= right; column += 1) {
    for (let tie = 0; tie < 4; tie += 1) p.rect(column * T + tie * 12 + 2, T - 6, 7, 4, palette.tie);
  }
  p.rect(x0, T - 8, width, 2, palette.rail);
  p.rect(x0, T - 4, width, 2, palette.rail);
  // Timber supports every third tile.
  for (let column = left; column <= right; column += 3) {
    const x = column * T;
    p.rect(x + 2, 4, 5, T - 10, palette.wood);
    p.rect(x + 2, 4, T - 4, 5, palette.woodLight);
    p.rect(x + 2, 9, T - 4, 2, palette.woodDark);
  }
  // Lanterns hung from the beams.
  for (let column = left + 1; column <= right; column += 4) drawLantern(p, column * T + 24, 12);
  // Openings where each miner's ladder shaft comes down into the tunnel, with the hoist cable.
  stations.forEach((site) => {
    const x = site.column * T;
    p.rect(x + 4, 0, 4, T - 8, palette.wood);
    p.rect(x + T - 8, 0, 4, T - 8, palette.wood);
    p.rect(x + 23, 0, 2, T - 30, palette.rope);
  });
  // Tunnel ends taper into the rock.
  p.rect(x0 - 6, 6, 6, T - 12, palette.tunnel);
  p.rect(x0 + width, 6, 6, T - 12, palette.tunnel);
}

function drawLantern(p: Painter, cx: number, top: number) {
  p.circle(cx, top + 5, 12, palette.glow, 0.07);
  p.circle(cx, top + 5, 7, palette.glow, 0.12);
  p.rect(cx - 2, top - 3, 4, 3, palette.woodDark);
  p.rect(cx - 3, top, 6, 7, palette.lantern);
}

// A miner's ladder shaft between their chamber and the rail tunnel; the cart is hoisted on a
// cable down the middle, with the ladder on the side away from the coal face.
function drawLadderTile(p: Painter, site: Site, column: number) {
  const x = column * T;
  const ladderX = site.faceColumn < site.column ? x + 26 : x + 6;
  p.rect(x, 0, T, T, palette.tunnel);
  p.rect(x, 0, 4, T, palette.wood);
  p.rect(x + T - 4, 0, 4, T, palette.wood);
  p.rect(ladderX, 0, 3, T, palette.woodLight);
  p.rect(ladderX + 13, 0, 3, T, palette.woodLight);
  for (let y = 6; y < T; y += 10) p.rect(ladderX, y, 16, 2, palette.woodLight);
  p.rect(x + 23, 0, 2, T, palette.rope);
}

// The small chamber a miner works in, cut beside the coal face.
function drawChamberTile(p: Painter, site: Site) {
  const x = site.column * T;
  p.rect(x, 4, T, T - 4, palette.tunnel);
  p.rect(x, 4, T, 4, palette.woodLight);
  p.rect(x, 8, 4, T - 8, palette.wood);
  p.rect(x + T - 4, 8, 4, T - 8, palette.wood);
  // Hoist pulley over the ladder shaft, and a lantern for the miner.
  p.rect(x + 16, 8, 16, 3, palette.woodDark);
  p.rect(x + 23, 11, 2, T - 11, palette.rope);
  const lanternX = site.faceColumn < site.column ? x + 10 : x + T - 10;
  p.circle(lanternX, 16, 8, palette.glow, 0.1);
  p.rect(lanternX - 2, 13, 4, 6, palette.lantern);
}

// A tile the player had dug. Its look follows its neighbours: rails where it runs sideways,
// a ladder and hoist cable where it runs up or down.
function drawPlayerTile(p: Painter, layout: MineLayout, row: number, column: number, isSite: boolean) {
  const x = column * T;
  const up = isDug(layout, row - 1, column);
  const down = isDug(layout, row + 1, column);
  const left = isDug(layout, row, column - 1);
  const right = isDug(layout, row, column + 1);
  const h = hash(row, column, 4);

  p.rect(x + (left ? 0 : 3), up ? 0 : 4, T - (left ? 0 : 3) - (right ? 0 : 3), T - (up ? 0 : 4), palette.tunnel);
  p.rect(x + (h % 20) + 4, 12 + ((h >>> 5) % 16), 16, 3, palette.tunnelWall);

  if (up || down) {
    p.rect(x + 3, 0, 3, T, palette.wood);
    p.rect(x + T - 6, 0, 3, T, palette.wood);
    p.rect(x + 8, 0, 3, T, palette.woodLight);
    p.rect(x + 18, 0, 3, T, palette.woodLight);
    for (let y = 6; y < T; y += 10) p.rect(x + 8, y, 13, 2, palette.woodLight);
    p.rect(x + 30, 0, 2, T, palette.rope);
  }
  if (left || right || (!up && !down)) {
    const railLeft = x + (left ? 0 : 4);
    const railWidth = T - (left ? 0 : 4) - (right ? 0 : 4);
    for (let tie = 0; tie < 4; tie += 1) p.rect(x + tie * 12 + 2, T - 6, 7, 4, palette.tie);
    p.rect(railLeft, T - 8, railWidth, 2, palette.rail);
    p.rect(railLeft, T - 4, railWidth, 2, palette.rail);
  }
  if (!up) {
    p.rect(x + 2, 4, T - 4, 4, palette.woodLight);
    if (h % 3 === 0) {
      p.rect(x + 2, 8, 4, T - 14, palette.wood);
      p.rect(x + T - 6, 8, 4, T - 14, palette.wood);
    }
  }
  if (isSite || (!up && h % 5 === 0)) drawLantern(p, x + 24, 12);
}

function drawSurface(p: Painter) {
  const height = T * MINE_SURFACE_ROWS;
  const groundY = height - 14;
  p.rect(0, 0, MINE_MAP_WIDTH, height, palette.skyTop);
  p.rect(0, 30, MINE_MAP_WIDTH, height - 30, palette.skyBottom);
  // Distant mesas.
  for (let column = 0; column < MINE_COLUMNS; column += 1) {
    const h = hash(0, column, 40);
    const top = 38 + (h % 22);
    p.rect(column * T, top, T, groundY - top, palette.mesa);
    p.rect(column * T, top, T, 4, palette.mesaShade);
  }
  p.rect(0, groundY, MINE_MAP_WIDTH, height - groundY, palette.topsoil);
  p.rect(0, groundY, MINE_MAP_WIDTH, 3, '#e8b077');

  // Headhouse over the lift.
  const houseX = MINE_SHAFT_COLUMN * T - 22;
  const houseW = T + 44;
  p.rect(houseX, 34, houseW, groundY - 34, palette.wood);
  for (let y = 40; y < groundY; y += 8) p.rect(houseX, y, houseW, 1, palette.woodDark);
  for (let step = 0; step < 4; step += 1) {
    p.rect(houseX - 4 + step * 8, 30 - step * 6, houseW + 8 - step * 16, 6, palette.woodDark);
  }
  p.rect(MINE_SHAFT_COLUMN * T + 10, 52, T - 20, groundY - 52, palette.shaft);
  p.rect(houseX + 18, 38, houseW - 36, 9, '#e3c38a');
  p.rect(houseX + 22, 41, houseW - 44, 3, palette.woodDark);

  // Storage shed and a small cabin, placed relative to the lift.
  const shedX = (MINE_SHAFT_COLUMN - 5) * T;
  p.rect(shedX, 50, T * 2, groundY - 50, palette.woodLight);
  p.rect(shedX - 4, 44, T * 2 + 8, 7, palette.woodDark);
  p.rect(shedX + 34, 62, 28, groundY - 62, palette.woodDark);
  const cabinX = (MINE_SHAFT_COLUMN + 9) * T + 10; // leaves room for the mine exit stockpiles beside the headhouse
  p.rect(cabinX, 58, T + 10, groundY - 58, palette.wood);
  p.rect(cabinX - 4, 52, T + 18, 7, palette.woodDark);
  p.rect(cabinX + 10, 66, 12, 10, '#3b2a1c');
  // Fence posts.
  for (let column = MINE_SHAFT_COLUMN + 11; column < MINE_SHAFT_COLUMN + 16; column += 1) {
    p.rect(column * T + 8, groundY - 12, 4, 12, palette.woodDark);
    p.rect(column * T, groundY - 9, T, 3, palette.wood);
  }
}

// Draw columns [from, to) of one 48px map row, in map x and row-local y (0 to T).
function drawRow(canvas: SkCanvas, row: number, from: number, to: number, layout: MineLayout) {
  const p = painter(canvas);
  canvas.save();
  canvas.clipRect(Skia.XYWHRect(from * T, 0, (to - from) * T, T), ClipOp.Intersect, false);
  p.rect(from * T, 0, (to - from) * T, T, dirtColor(row));
  if (row === MINE_SURFACE_ROWS) p.rect(from * T, 0, (to - from) * T, 4, '#000000', 0.12);

  const sitesHere = layout.sites.filter((site) => site.row === row);
  const faces = new Set(layout.sites.filter((site) => site.faceRow === row).map((site) => site.faceColumn));

  for (let column = from; column < to; column += 1) {
    if (isDug(layout, row, column) || fogAlpha(fogDistance(layout, row, column)) >= 1) continue;
    drawDirtTile(p, row, column);
    drawDeposit(p, layout, row, column, faces.has(column));
  }

  const { level, rise } = levelOfRow(row);
  const span = rise === 0 ? layout.spans.get(level) : undefined;
  const levelStations = layout.stationsByLevel.get(level) ?? [];
  if (span && span.right >= from && span.left < to) drawTunnelRow(p, row, span, levelStations);

  for (const column of layout.dugByRow.get(row) ?? []) {
    if (column < from - 1 || column > to) continue;
    const kind = layout.kinds.get(tileKey(row, column));
    if (kind === 'ladder') {
      const site = levelStations.find((station) => station.column === column);
      if (site) drawLadderTile(p, site, column);
    } else if (kind === 'chamber') {
      const site = levelStations.find((station) => station.column === column);
      if (site) drawChamberTile(p, site);
    } else if (kind === 'tunnel') {
      drawPlayerTile(p, layout, row, column, sitesHere.some((site) => site.column === column));
    } else if (kind === 'lift') {
      drawShaftTile(p, span !== undefined);
    }
  }

  // Blocky darkness, merged into runs of equal shade.
  let runStart = from;
  let runAlpha = fogAlpha(fogDistance(layout, row, from));
  for (let column = from + 1; column <= to; column += 1) {
    const alpha = column < to ? fogAlpha(fogDistance(layout, row, column)) : -1;
    if (alpha === runAlpha) continue;
    if (runAlpha > 0) p.rect(runStart * T, 0, (column - runStart) * T, T, palette.fog, runAlpha);
    runStart = column;
    runAlpha = alpha;
  }
  canvas.restore();
}

/** Rows are cached in chunks this many columns wide, so only what is on screen is drawn. */
export const TERRAIN_CHUNK_COLUMNS = 16;
export const TERRAIN_CHUNKS = Math.ceil(MINE_COLUMNS / TERRAIN_CHUNK_COLUMNS);

const pictureCache = new Map<string, SkPicture>();
let surfacePicture: SkPicture | null = null;

/** The surface (sky, mesas, headhouse) across the whole claim, two rows tall. */
export function getSurfacePicture(): SkPicture {
  surfacePicture ??= createPicture((canvas) => drawSurface(painter(canvas)), Skia.XYWHRect(0, 0, MINE_MAP_WIDTH, T * MINE_SURFACE_ROWS));
  return surfacePicture;
}

// Chunks are recorded once into pictures and replayed while panning. A chunk only depends on
// tiles within a few rows of it, but keying on the layout version keeps invalidation simple.
export function getChunkPicture(row: number, chunk: number, layout: MineLayout): SkPicture {
  const key = `${String(layout.version)}:${String(row)}:${String(chunk)}`;
  const cached = pictureCache.get(key);
  if (cached) return cached;
  if (pictureCache.size > 1500) pictureCache.clear();
  const from = chunk * TERRAIN_CHUNK_COLUMNS;
  const to = Math.min(MINE_COLUMNS, from + TERRAIN_CHUNK_COLUMNS);
  const picture = createPicture((canvas) => drawRow(canvas, row, from, to, layout), Skia.XYWHRect(from * T, 0, (to - from) * T, T));
  pictureCache.set(key, picture);
  return picture;
}
