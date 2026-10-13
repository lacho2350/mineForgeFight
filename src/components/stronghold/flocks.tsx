// The sheep on the pastures, grazing their way about the field: each one ambles to a spot near its own
// patch, grazes there a few seconds, and moves on, turning to face the way it goes. Every sheep is a sprite
// in one atlas moved by one animation function (as the peasants are), so a big flock costs one draw.
import { memo, useMemo } from 'react';
import { Atlas, Skia, useRSXformBuffer, type SkImage } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { TILE_HH, TILE_HW } from '../GameSceneLayout';
import { ORIGIN } from './shapes';

// The sprite sheet: a sheep facing right, then one facing left. Cells are 8 × 6 scene units drawn 4×
// larger; the feet sit at (4, 5.5).
const RES = 4;
const CELL_W = 8;
const CELL_H = 6;
const FEET_X = 4;
const FEET_Y = 5.5;

let sheet: SkImage | null = null;
function getSheet() {
  if (sheet) return sheet;
  const surface = Skia.Surface.Make(2 * CELL_W * RES, CELL_H * RES);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  for (const [cell, facing] of [[0, 1], [1, -1]]) {
    const at = (x: number, y: number) => [(cell * CELL_W + FEET_X + x) * RES, (FEET_Y + y) * RES] as const;
    paint.setColor(Skia.Color('#2e2a26'));
    for (const leg of [-1.3, 1.1]) {
      const [lx, ly] = at(leg, -1.2);
      canvas.drawRect(Skia.XYWHRect(lx, ly, 0.6 * RES, 1.2 * RES), paint);
    }
    paint.setColor(Skia.Color('#eeeae0'));
    const [bx, by] = at(0, -2.2);
    canvas.drawCircle(bx, by, 2.3 * RES, paint);
    paint.setColor(Skia.Color('#2e2a26'));
    const [hx, hy] = at(2.2 * facing, -2.8);
    canvas.drawCircle(hx, hy, 1 * RES, paint);
  }
  surface.flush();
  sheet = surface.makeImageSnapshot();
  return sheet;
}

/** A sheep's walk: where its patch is (tile units), the field it keeps to, and its own pace and timing. */
type Grazer = { hx: number; hy: number; x0: number; y0: number; x1: number; y1: number; pace: number; phase: number };

// `look`: "x,y,sheep;…" per pasture — the plot's corner and its flock — so the flock is rebuilt only when
// it grows, shrinks (raiders drive sheep off) or a pasture is placed.
export const Flocks = memo(function Flocks({ look, clock }: { look: string; clock: SharedValue<number> }) {
  const grazers = useMemo(() => {
    const all: Grazer[] = [];
    for (const pasture of look ? look.split(';') : []) {
      const [px, py, count] = pasture.split(',').map(Number);
      for (let i = 0; i < count; i++) {
        // Patches in a golden-angle scatter over the field, keeping off the shed in its back corner.
        const a = i * 2.39996;
        const r = 0.35 + 0.95 * Math.sqrt((i + 0.5) / 30);
        const n = all.length;
        all.push({
          hx: px + 1.75 + Math.cos(a) * r * 0.9,
          hy: py + 1.75 + Math.sin(a) * r * 0.9,
          x0: px + 0.3,
          y0: py + 0.45,
          x1: px + 2.85,
          y1: py + 2.85,
          // A move every 6–11 seconds.
          pace: 1 / (6 + ((n * 7) % 11) * 0.5),
          phase: (n * 0.618) % 1,
        });
      }
    }
    return all;
  }, [look]);
  const image = getSheet();
  // Two sprites a sheep (facing right, facing left): the one facing the way it goes is shown.
  const sprites = useMemo(() => grazers.flatMap(() => [0, 1].map((cell) => Skia.XYWHRect(cell * CELL_W * RES, 0, CELL_W * RES, CELL_H * RES))), [grazers]);
  const hw = TILE_HW;
  const hh = TILE_HH;
  const ox = ORIGIN.x;
  const oy = ORIGIN.y;
  const transforms = useRSXformBuffer(grazers.length * 2, (value, index) => {
    'worklet';
    const sheep = grazers[index >> 1];
    const facing = index & 1;
    // Stop k: a spot near the patch, the same every time for this sheep (a hash of it and k).
    const spot = (k: number, salt: number) => {
      const h = Math.sin((index >> 1) * 12.9898 + k * 78.233 + salt) * 43758.5453;
      return (h - Math.floor(h) - 0.5) * 1.1;
    };
    const step = clock.get() * sheep.pace + sheep.phase;
    const k = Math.floor(step);
    const f = step - k;
    const ax = Math.min(sheep.x1, Math.max(sheep.x0, sheep.hx + spot(k, 0)));
    const ay = Math.min(sheep.y1, Math.max(sheep.y0, sheep.hy + spot(k, 3.7)));
    const bx = Math.min(sheep.x1, Math.max(sheep.x0, sheep.hx + spot(k + 1, 0)));
    const by = Math.min(sheep.y1, Math.max(sheep.y0, sheep.hy + spot(k + 1, 3.7)));
    // The first third of each stop it walks over (eased), the rest it grazes.
    const walking = f < 0.32;
    const m = walking ? (1 - Math.cos((f / 0.32) * Math.PI)) / 2 : 1;
    const x = ax + (bx - ax) * m;
    const y = ay + (by - ay) * m;
    const left = bx - by - (ax - ay) < 0 ? 1 : 0;
    if (left !== facing) {
      value.set(0, 0, -100, -100);
      return;
    }
    const bob = walking ? Math.abs(Math.sin(f * 60)) * 0.5 : 0;
    value.set(1 / RES, 0, ox + (x - y) * hw - FEET_X, oy + (x + y) * hh - bob - FEET_Y);
  });
  if (!image || grazers.length === 0) return null;
  return <Atlas image={image} sprites={sprites} transforms={transforms} />;
});
