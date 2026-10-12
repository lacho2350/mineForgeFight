// The grass texture, shared by the map's ground (ground.tsx) and the land round the map (backdrop.tsx), so
// the hold sits in its valley rather than on a board: broad lighter and darker patches from smooth value
// noise, and tufts — all worked out from the tile position, so it's the same every time and runs on
// across the map's edge without a seam.
import { TILE_HH, TILE_HW, iso } from '../GameSceneLayout';

export const GRASS_LIGHT = '#6c8748';
export const GRASS_DARK = '#526a39';
export const TUFT = '#435c2e';
export const TUFT_LIGHT = '#82a057';

export const hash01 = (x: number, y: number, salt: number) => {
  let h = Math.imul(Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + salt * 1013904223, 1274126177);
  h ^= h >>> 13;
  h = Math.imul(h, 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Smooth value noise, `scale` tiles across.
export function smoothNoise(x: number, y: number, scale: number, salt: number) {
  const fx = x / scale;
  const fy = y / scale;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const u = tx * tx * (3 - 2 * tx);
  const v = ty * ty * (3 - 2 * ty);
  const a = hash01(ix, iy, salt);
  const b = hash01(ix + 1, iy, salt);
  const c = hash01(ix, iy + 1, salt);
  const d = hash01(ix + 1, iy + 1, salt);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// A circle on the ground (tile units) as an ellipse on screen.
export function groundBlob(cx: number, cy: number, r: number) {
  const c = iso(cx, cy);
  const rx = r * TILE_HW * Math.SQRT2;
  const ry = r * TILE_HH * Math.SQRT2;
  return `M ${(c.x - rx).toFixed(1)} ${c.y.toFixed(1)} a ${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(2 * rx).toFixed(1)} 0 a ${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(-2 * rx).toFixed(1)} 0 Z`;
}

export type Grass = { light: string[]; dark: string[]; tufts: string[]; tuftsLight: string[] };
export const emptyGrass = (): Grass => ({ light: [], dark: [], tufts: [], tuftsLight: [] });

/** One tile's grass: a lighter or darker patch where the broad noise says so, and three tufts. */
export function grassTile(x: number, y: number, grass: Grass) {
  const n = smoothNoise(x, y, 7, 1) * 0.7 + smoothNoise(x, y, 3, 2) * 0.3;
  const jx = x + 0.2 + hash01(x, y, 3) * 0.6;
  const jy = y + 0.2 + hash01(x, y, 4) * 0.6;
  const r = 0.55 + hash01(x, y, 5) * 0.55;
  if (n > 0.56) grass.light.push(groundBlob(jx, jy, r));
  else if (n < 0.44) grass.dark.push(groundBlob(jx, jy, r));
  for (let i = 0; i < 3; i++) {
    const p = iso(x + hash01(x, y, 10 + i), y + hash01(y, x, 20 + i));
    const tuft = `M ${(p.x - 1.6).toFixed(1)} ${p.y.toFixed(1)} L ${(p.x - 0.3).toFixed(1)} ${(p.y - 3).toFixed(1)} L ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 0.4).toFixed(1)} ${(p.y - 2.6).toFixed(1)} L ${(p.x + 1.6).toFixed(1)} ${p.y.toFixed(1)}`;
    (hash01(x, y, 30 + i) < 0.3 ? grass.tuftsLight : grass.tufts).push(tuft);
  }
}
