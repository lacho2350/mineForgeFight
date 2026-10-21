// The mine's surface strip (map rows 0–1, seen from the side), drawn in the stronghold's look so going
// down the mine feels like the same valley: grey snow-capped mountains and green hills behind, a grass
// verge with a dirt road along it, and the mine's buildings built like the town's — plank walls under
// thatch and half-timbered plaster under red tiles on stone footings, outlined, lit windows, a red banner.
// Colours come from the stronghold's kit (stronghold/shapes.tsx, grass.ts). Drawn once into a picture
// (mineTerrain.ts `getSurfacePicture`).
import { PaintStyle, Skia, type SkCanvas, type SkPaint } from '@shopify/react-native-skia';
import { MINE_COLUMNS, MINE_MAP_WIDTH, MINE_SHAFT_COLUMN, MINE_SURFACE_ROWS, MINE_TILE_SIZE } from './MineMapLayout';
import { hash } from '../game/mineLayout';
import { BANNER, DARK, GLOW, MATS, ROAD_COLORS, STONE, type Mat } from './stronghold/shapes';
import { GRASS_DARK, GRASS_LIGHT, TUFT, TUFT_LIGHT } from './stronghold/grass';

const T = MINE_TILE_SIZE;
const HEIGHT = T * MINE_SURFACE_ROWS;
/** Where the buildings stand (MINE_GROUND_Y). */
const G = HEIGHT - 14;
/** How far each building's side wall shows, to the right and up: the town's buildings are seen from above. */
const SIDE = 6;
const RISE = 3;
const OUTLINE = 'rgba(28, 20, 12, 0.5)';
const TIMBER = '#5b3d25';
const PICKET = '#d7b273';
const LEG = '#805a3c';

type Pt = [number, number];

type Pen = {
  rect: (x: number, y: number, w: number, h: number, color: string, alpha?: number) => void;
  circle: (x: number, y: number, r: number, color: string) => void;
  poly: (points: Pt[], color: string) => void;
  outline: (points: Pt[]) => void;
  line: (a: Pt, b: Pt, color: string, width?: number) => void;
};

function pen(canvas: SkCanvas): Pen {
  const fill: SkPaint = Skia.Paint();
  fill.setAntiAlias(true);
  const stroke: SkPaint = Skia.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(PaintStyle.Stroke);
  const path = (points: Pt[]) => {
    const p = Skia.Path.Make();
    p.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) p.lineTo(x, y);
    p.close();
    return p;
  };
  return {
    rect: (x, y, w, h, color, alpha = 1) => {
      fill.setColor(Skia.Color(color));
      fill.setAlphaf(alpha);
      canvas.drawRect(Skia.XYWHRect(x, y, w, h), fill);
      fill.setAlphaf(1);
    },
    circle: (x, y, r, color) => {
      fill.setColor(Skia.Color(color));
      canvas.drawCircle(x, y, r, fill);
    },
    poly: (points, color) => {
      fill.setColor(Skia.Color(color));
      canvas.drawPath(path(points), fill);
    },
    outline: (points) => {
      stroke.setColor(Skia.Color(OUTLINE));
      stroke.setStrokeWidth(1);
      canvas.drawPath(path(points), stroke);
    },
    line: ([ax, ay], [bx, by], color, width = 1) => {
      stroke.setColor(Skia.Color(color));
      stroke.setStrokeWidth(width);
      canvas.drawLine(ax, ay, bx, by, stroke);
    },
  };
}

// ——— The backdrop ———

function drawBackdrop(p: Pen) {
  p.rect(0, 0, MINE_MAP_WIDTH, HEIGHT, '#d9e2df');
  p.rect(0, 26, MINE_MAP_WIDTH, HEIGHT - 26, '#e7e8dc');
  // Far mountains: grey, lit on the left, with snow on the tallest.
  for (let i = 0, x = -60; x < MINE_MAP_WIDTH + 60; i++) {
    const h = hash(0, i, 41);
    const half = 70 + (h % 60);
    const top = 6 + ((h >> 8) % 30);
    const cx = x + half;
    p.poly([[x, G], [cx, top], [cx + half, G]], '#9a9d94');
    p.poly([[cx, top], [cx + half, G], [cx + half * 0.35, G]], '#7d8179');
    if (top < 26) {
      const snow = (G - top) * 0.28;
      const s = snow / (G - top);
      p.poly([[cx - half * s, top + snow], [cx, top], [cx + half * s, top + snow], [cx + half * s * 0.3, top + snow * 0.7], [cx - half * s * 0.2, top + snow * 0.85]], '#f2f3ef');
    }
    x += half * (1.1 + ((h >> 4) % 5) / 10);
  }
  // Green hills in front of them, and a line of trees along the foot.
  for (let i = 0, x = -40; x < MINE_MAP_WIDTH + 40; i++) {
    const h = hash(1, i, 42);
    const half = 50 + (h % 50);
    const top = G - 14 - (h >> 6) % 16;
    p.poly([[x, G], [x + half * 0.5, top + 4], [x + half, top], [x + half * 1.5, top + 5], [x + half * 2, G]], i % 2 ? '#6a8447' : '#617c40');
    x += half * 1.6;
  }
  for (let column = 0; column < MINE_COLUMNS * 3; column++) {
    const h = hash(2, column, 43);
    if (h % 3 === 0) continue;
    const x = column * (T / 3) + (h % 9);
    const r = 4 + (h >> 5) % 3;
    p.circle(x, G - r + 1, r, h % 2 ? '#3f5a2c' : '#4b6a33');
    p.circle(x - 1, G - r - 1, r * 0.55, '#5b7c3c');
  }
}

/** The grass verge the buildings stand on, and the dirt road along the mine's yard. */
function drawGround(p: Pen) {
  p.rect(0, G, MINE_MAP_WIDTH, HEIGHT - G, '#8c6239');
  p.rect(0, G, MINE_MAP_WIDTH, 7, GRASS_LIGHT);
  p.rect(0, G + 7, MINE_MAP_WIDTH, 2, GRASS_DARK);
  for (let column = 0; column < MINE_COLUMNS * 4; column++) {
    const h = hash(3, column, 44);
    const x = column * (T / 4) + (h % 7);
    p.rect(x, G - 2, 1.5, 3, h % 2 ? TUFT : TUFT_LIGHT);
  }
  // The road: from the storehouse past the headhouse and the exit stockpiles to the cottage.
  const from = (MINE_SHAFT_COLUMN - 12) * T;
  const to = (MINE_SHAFT_COLUMN + 10) * T;
  const road = ROAD_COLORS.dirt;
  p.rect(from, G, to - from, 6, road.fill);
  p.rect(from, G + 6, to - from, 1, road.mark);
  for (let x = from + 5; x < to; x += 11) p.rect(x + (hash(4, x, 45) % 5), G + 2 + (x % 3), 2, 1, road.mark);
}

// ——— The town's way of building, side on ———

/** Wall dressing like the town's (shapes.tsx `faceDressing`), on a front face. */
function dress(p: Pen, m: Mat, x: number, y: number, w: number, h: number) {
  if (m.kind === 'timber') {
    for (let u = x + 7; u < x + w - 2; u += 7) p.line([u, y], [u, y + h], 'rgba(55, 32, 14, 0.45)');
    p.line([x, y + h - 1.5], [x + w, y + h - 1.5], 'rgba(55, 32, 14, 0.45)');
  } else if (m.kind === 'plaster') {
    for (const v of [y + 1, y + h / 2, y + h - 1]) p.line([x, v], [x + w, v], TIMBER, 1.5);
    const bays = Math.max(1, Math.round(w / 18));
    for (let i = 0; i <= bays; i++) p.line([x + (w * i) / bays, y], [x + (w * i) / bays, y + h], TIMBER, 1.5);
    for (let i = 0; i < bays; i += 2) p.line([x + (w * i) / bays, y + h - 1], [x + (w * (i + 1)) / bays, y + h / 2], TIMBER, 1.2);
  } else {
    for (let v = y + h - 4, row = 0; v > y; v -= 4, row++) {
      p.line([x, v], [x + w, v], 'rgba(40, 38, 32, 0.35)');
      for (let u = x + (row % 2) * 5 + 5; u < x + w; u += 10) p.line([u, v], [u, v + 4], 'rgba(40, 38, 32, 0.35)');
    }
  }
}

/** A building's walls: the front face, dressed, and its side going back. */
function walls(p: Pen, m: Mat, x: number, top: number, w: number, bottom = G) {
  const h = bottom - top;
  p.poly([[x + w, bottom], [x + w + SIDE, bottom - RISE], [x + w + SIDE, top - RISE], [x + w, top]], m.right);
  p.rect(x, top, w, h, m.left);
  dress(p, m, x, top, w, h);
  p.outline([[x, bottom], [x + w, bottom], [x + w + SIDE, bottom - RISE], [x + w + SIDE, top - RISE], [x + w, top], [x, top]]);
}

/** A gable roof seen end on, with the far slope showing behind: thatch, tiles or slate by its material. */
function gable(p: Pen, m: Mat, left: number, right: number, eave: number, apex: number) {
  const mid = (left + right) / 2;
  p.poly([[mid, apex], [right, eave], [right + SIDE, eave - RISE], [mid + SIDE, apex - RISE]], m.roofDark);
  p.poly([[left, eave], [mid, apex], [right, eave]], m.roof);
  // Courses across the roof, narrowing to the ridge.
  for (let y = eave - 4; y > apex + 2; y -= 4) {
    const t = (y - apex) / (eave - apex);
    const half = ((right - left) / 2) * t;
    if (m.kind === 'timber') {
      for (let x = mid - half + 2; x < mid + half - 1; x += 3) p.line([x, y], [x - 0.6, y + 3], m.roofDark, 0.8);
    } else {
      p.line([mid - half + 1, y], [mid + half - 1, y], m.roofDark, 0.8);
    }
  }
  p.outline([[left, eave], [mid, apex], [mid + SIDE, apex - RISE], [right + SIDE, eave - RISE], [right, eave]]);
}

/** A stone footing (the plinth under the headhouse). */
function footing(p: Pen, x: number, w: number, h: number) {
  walls(p, STONE, x, G - h, w);
}

/** A lit window with shutters, like the town's cottages. */
function windowAt(p: Pen, x: number, y: number) {
  p.rect(x - 2, y, 2, 7, TIMBER);
  p.rect(x, y, 6, 7, GLOW);
  p.rect(x + 2.5, y, 1, 7, TIMBER);
  p.rect(x + 6, y, 2, 7, TIMBER);
}

function banner(p: Pen, x: number, top: number) {
  p.rect(x - 0.6, top, 1.2, 14, DARK);
  p.rect(x + 0.6, top, 8, 5, BANNER);
}

// ——— The buildings ———

/** The headhouse over the lift: half-timbered plaster under red tiles on a stone footing, the lift's
 * mouth in its front, and a timber headframe with its wheel standing over the roof. */
function drawHeadhouse(p: Pen) {
  const plaster = MATS[1];
  const x = MINE_SHAFT_COLUMN * T - 22;
  const w = T + 44;
  const cx = MINE_SHAFT_COLUMN * T + T / 2;
  // The headframe stands behind the roof: two legs to the wheel, braced, and its back leg.
  const wheelY = 13;
  p.line([cx + 10, 46], [cx + 3, wheelY + 2], '#5f4129', 3);
  p.line([cx - 26, 44], [cx, wheelY], LEG, 3);
  p.line([cx + 26, 44], [cx, wheelY], LEG, 3);
  p.line([cx - 17, 32], [cx + 17, 32], LEG, 2);
  p.circle(cx, wheelY, 8, '#3a2a1c');
  p.circle(cx, wheelY, 5.5, '#dfe3dc');
  for (let a = 0; a < 4; a++) {
    const angle = (a * Math.PI) / 4;
    p.line([cx - Math.cos(angle) * 6, wheelY - Math.sin(angle) * 6], [cx + Math.cos(angle) * 6, wheelY + Math.sin(angle) * 6], '#3a2a1c', 1);
  }
  p.circle(cx, wheelY, 1.6, '#bd8d55');
  footing(p, x - 3, w + 6, 8);
  walls(p, plaster, x, 47, w, G - 8);
  gable(p, plaster, x - 7, x + w + 7, 48, 26);
  // The lift's mouth, timber-framed, through the footing.
  const mouthX = MINE_SHAFT_COLUMN * T + 10;
  p.rect(mouthX - 3, 53, T - 14, G - 53, TIMBER);
  p.rect(mouthX, 56, T - 20, G - 56, '#20232a');
  p.line([cx, 30], [cx, 56], '#bd8d55', 1); // the cable down from the wheel
  windowAt(p, x + 10, 58);
  windowAt(p, x + w - 18, 58);
  // A board over the door, like the town's signs.
  p.rect(cx - 16, 36, 32, 7, '#e3c38a');
  p.rect(cx - 12, 38.5, 24, 2, TIMBER);
}

/** The storehouse left of the lift: a plank barn under thatch with its doors open, logs stacked by it,
 * and the hold's banner on the ridge. */
function drawStorehouse(p: Pen) {
  const timber = MATS[0];
  const x = (MINE_SHAFT_COLUMN - 11) * T; // beyond the left row of exit stockpiles
  const w = T * 2;
  walls(p, timber, x, 58, w);
  gable(p, timber, x - 6, x + w + 6, 59, 36);
  banner(p, x + w / 2, 22);
  // Wide doors, one standing open.
  p.rect(x + 30, 64, 36, G - 64, TIMBER);
  p.rect(x + 32, 66, 32, G - 66, DARK);
  p.poly([[x + 48, 66], [x + 58, 68], [x + 58, G - 1], [x + 48, G]], '#8a5a2e');
  p.line([x + 32, 66], [x + 47, G - 1], TIMBER, 1.5);
  windowAt(p, x + 10, 66);
  // Logs, end grain out, against the wall.
  for (const [lx, ly] of [[x - 18, G - 4], [x - 10, G - 4], [x - 2, G - 4], [x - 14, G - 11], [x - 6, G - 11], [x - 10, G - 18]] as Pt[]) {
    p.circle(lx, ly, 4, '#8a5a2e');
    p.circle(lx, ly, 2.6, '#c9955c');
    p.circle(lx, ly, 0.8, '#8a5a2e');
  }
}

/** The mine captain's cottage beyond the stockpiles: like the town's — planks and thatch, a stone
 * chimney, a lit window with shutters, and a picket fence with flowers before it. */
function drawCottage(p: Pen) {
  const timber = MATS[0];
  const x = (MINE_SHAFT_COLUMN + 8) * T + 10; // beyond the right row of exit stockpiles
  const w = T + 10;
  p.rect(x + w - 16, 40, 9, 22, STONE.left);
  p.rect(x + w - 16, 40, 9, 2, STONE.top);
  p.outline([[x + w - 16, 40], [x + w - 7, 40], [x + w - 7, 62], [x + w - 16, 62]]);
  walls(p, timber, x, 62, w);
  gable(p, timber, x - 6, x + w + 6, 63, 44);
  p.rect(x + 10, 68, 11, G - 68, DARK);
  windowAt(p, x + 34, 68);
  // The fence along the front, a gate by the door, flowers behind it.
  const fenceFrom = x - 14;
  const fenceTo = (MINE_SHAFT_COLUMN + 13) * T;
  for (const [fx, color] of [[x + 30, BANNER], [x + 38, '#e2b84f'], [x + 46, '#c86bb0'], [x + 60, BANNER], [x + 70, '#e2b84f']] as [number, string][]) {
    p.rect(fx - 0.5, G - 6, 1, 6, '#4f7a36');
    p.circle(fx, G - 7, 1.8, color);
  }
  p.rect(fenceFrom, G - 7, x + 6 - fenceFrom, 1.5, PICKET);
  p.rect(x + 24, G - 7, fenceTo - x - 24, 1.5, PICKET);
  for (let fx = fenceFrom; fx < fenceTo; fx += 6) {
    if (fx > x + 6 && fx < x + 24) continue;
    p.rect(fx, G - 10, 1.6, 10, PICKET);
  }
}

export function drawMineSurface(canvas: SkCanvas) {
  const p = pen(canvas);
  drawBackdrop(p);
  drawGround(p);
  drawStorehouse(p);
  drawHeadhouse(p);
  drawCottage(p);
}
