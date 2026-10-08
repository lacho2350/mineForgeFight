// The backdrop: sky, mountains all round, the river running on through them, and the woods on the land
// round the map.
import { memo } from 'react';
import { Group, LinearGradient, Path, vec } from '@shopify/react-native-skia';
import { GATE_ROAD, MAP_SIZE, RIVER_ROWS, SCENE_WIDTH as sceneWidth, iso } from '../GameSceneLayout';
import { parseSvg } from '../skiaPaths';
import { ROAD_COLORS, poly, type P } from './shapes';

type Side = 'backLeft' | 'backRight' | 'frontLeft' | 'frontRight';
// A range's foot, `d` tiles out from one side of the map, `t` tiles along it.
const rangeFoot = (side: Side, d: number, t: number) => {
  switch (side) {
    case 'backLeft':
      return iso(-d, t);
    case 'backRight':
      return iso(t, -d);
    case 'frontLeft':
      return iso(t, MAP_SIZE + d);
    case 'frontRight':
      return iso(MAP_SIZE + d, t);
  }
};
// Gaps in the ranges: the river's gorges (it flows in from the back-left and out to the front-right),
// and the pass the gate road takes out of the front-left side.
const GATE_ROAD_X = GATE_ROAD.x + GATE_ROAD.w / 2;
function inGap(side: Side, d: number, t: number) {
  if (side === 'backLeft' || side === 'frontRight') return t > -1.5 - d * 0.05 && t < RIVER_ROWS + 1.5 + d * 0.05;
  if (side === 'frontLeft') return Math.abs(t - GATE_ROAD_X) < 3.5;
  return false;
}

// Stone: one look for the rocks on the map and the mountains round it — a crag lit from the left, a
// light face and a shaded one, each with a shoulder, on a foot `w` pixels to either side of `base`;
// `dip`: how far its front corner comes down in front of the foot (a rock sitting on the ground);
// `lean`: where the top is, along the foot (−0.5…0.5 of `w`).
export const STONE_LIGHT = '#969886';
export const STONE_DARK = '#6e7262';
export function crag(base: P, w: number, h: number, dip: number, lean: number) {
  const top = { x: base.x + w * lean, y: base.y - h };
  const left = { x: base.x - w, y: base.y };
  const right = { x: base.x + w, y: base.y };
  const front = { x: base.x + w * 0.1, y: base.y + dip };
  return {
    light: poly([left, { x: top.x - w * 0.42, y: top.y + h * 0.4 }, top, front]),
    dark: poly([front, top, { x: top.x + w * 0.48, y: top.y + h * 0.34 }, right]),
    top,
    left,
    right,
    front,
  };
}

// The ranges, back to front, all in the rocks' stone, hazier and bluer with distance: behind the far
// sides distant peaks with snow, a middle range and foothills; in front of the near sides (further out,
// so they never hide the map) two darker ranges. `d`: tiles out from the map's edge; `step`: tiles
// between peaks.
const RANGES: { sides: Side[]; d: number; step: number; low: number; high: number; light: string; dark: string; snowAbove: number }[] = [
  { sides: ['backLeft', 'backRight'], d: 11, step: 3.2, low: 70, high: 150, light: '#a3abad', dark: '#808a8f', snowAbove: 100 },
  { sides: ['backLeft', 'backRight'], d: 7, step: 3.6, low: 50, high: 110, light: '#8e9285', dark: '#6c7064', snowAbove: 92 },
  { sides: ['backLeft', 'backRight'], d: 3.5, step: 4.2, low: 30, high: 70, light: '#81846f', dark: '#5f6353', snowAbove: Infinity },
  { sides: ['frontLeft', 'frontRight'], d: 7.5, step: 4, low: 35, high: 95, light: '#797c69', dark: '#5a5e4f', snowAbove: Infinity },
  { sides: ['frontLeft', 'frontRight'], d: 11.5, step: 4.6, low: 60, high: 150, light: '#6f7261', dark: '#525648', snowAbove: 125 },
];
const SKY_TOP = '#8ea8bb';
const SKY_LOW = '#cfdad7';
export const WATER = '#3a6a86';
// How far out the river runs past the map's ends (to the farthest ranges).
const RIVER_REACH = 12;

// The land's colours, shared by the map and the backdrop so the hold sits in its valley rather than on
// a board: the wild land all round (and the raiders' ground on the map), the town's lawn, the woods.
export const LAND = '#506738';
export const LAWN = '#5f7942';
export const TRUNK = '#5e4630';
export const CROWNS = ['#3f5f30', '#4b6d36', '#557a3c'];

// Trees as four paths (trunks, then three shades of crown), and boulders (tile x, y, height in pixels)
// as the rocks' crags, cheap to draw every frame.
function woodsPaths(trees: [number, number, number][], boulders: [number, number, number][]) {
  const stone = { light: [] as string[], dark: [] as string[], shadow: [] as string[] };
  for (const [x, y, h] of boulders) {
    const base = iso(x, y);
    const w = h * 0.75;
    const rock = crag(base, w, h, w * 0.3, -0.15);
    stone.shadow.push(poly([{ x: base.x - w, y: base.y }, { x: base.x, y: base.y + w * 0.35 }, { x: base.x + w, y: base.y }, { x: base.x, y: base.y - w * 0.25 }]));
    stone.light.push(rock.light);
    stone.dark.push(rock.dark);
  }
  const trunks: string[] = [];
  const crowns: string[][] = [[], [], []];
  const circle = (cx: number, cy: number, r: number) =>
    `M ${(cx - r).toFixed(1)} ${cy.toFixed(1)} a ${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0 a ${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0 Z`;
  for (const [x, y, size] of [...trees].sort((a, b) => a[0] + a[1] - b[0] - b[1])) {
    const base = iso(x, y);
    trunks.push(`M ${(base.x - 1).toFixed(1)} ${(base.y - 8 * size).toFixed(1)} h 2 v ${(8 * size).toFixed(1)} h -2 Z`);
    crowns[0].push(circle(base.x, base.y - 12 * size, 6 * size));
    crowns[1].push(circle(base.x - 3 * size, base.y - 9 * size, 4.5 * size));
    crowns[2].push(circle(base.x + 3 * size, base.y - 10 * size, 4 * size));
  }
  return {
    trunks: trunks.join(' '),
    crowns: crowns.map((parts) => parts.join(' ')),
    stone: { light: stone.light.join(' '), dark: stone.dark.join(' '), shadow: stone.shadow.join(' ') },
  };
}

// The woods on the land round the map, carrying on the raiders' woods on its edge ring, with boulders
// fallen from the mountains here and there: a few rows deep behind the far sides (up to the foothills)
// and in front of the near ones (up to the front ranges), but not in the river's gorges or on the road
// out through the pass.
const WOODS = (() => {
  const back: [number, number, number][] = [];
  const front: [number, number, number][] = [];
  const backRocks: [number, number, number][] = [];
  const frontRocks: [number, number, number][] = [];
  for (let x = -4; x < MAP_SIZE + 7; x++) {
    for (let y = -4; y < MAP_SIZE + 7; y++) {
      const inFront = x >= MAP_SIZE || y >= MAP_SIZE;
      if (!inFront && x >= 0 && y >= 0) continue;
      const out = Math.max(-x, -y, x - MAP_SIZE + 1, y - MAP_SIZE + 1);
      if (out > (inFront ? 6 : 3)) continue;
      if ((x < 0 || x >= MAP_SIZE) && y >= -1 && y <= RIVER_ROWS) continue;
      if (y >= MAP_SIZE && Math.abs(x + 0.5 - GATE_ROAD_X) < 2.5) continue;
      const h = (x * 73856093) ^ (y * 19349663);
      const at: [number, number] = [x + 0.3 + (Math.abs(h >> 4) % 5) / 10, y + 0.3 + (Math.abs(h >> 8) % 5) / 10];
      if (Math.abs(h) % 4 === 0) (inFront ? front : back).push([...at, 0.8 + (Math.abs(h >> 12) % 5) / 10]);
      else if (Math.abs(h >> 3) % 9 === 0) (inFront ? frontRocks : backRocks).push([...at, 6 + (Math.abs(h >> 14) % 4) * 3]);
    }
  }
  return { back: woodsPaths(back, backRocks), front: woodsPaths(front, frontRocks) };
})();

const BACKDROP = (() => {
  let seed = 7;
  const random = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) | 0;
    return ((seed >>> 8) & 0xffff) / 0xffff;
  };
  const ranges = RANGES.map((range) => {
    const light: string[] = [];
    const dark: string[] = [];
    const snow: string[] = [];
    const peakAt = (base: P) => {
      const h = range.low + random() * (range.high - range.low);
      const w = h * (1 + random() * 0.4);
      const { light: lit, dark: shaded, top, left, right, front } = crag(base, w, h, 0, (random() - 0.5) * 0.3);
      light.push(lit);
      dark.push(shaded);
      if (h > range.snowAbove) {
        const along = (to: P, f: number) => ({ x: top.x + (to.x - top.x) * f, y: top.y + (to.y - top.y) * f });
        snow.push(poly([top, along(left, 0.24), { x: top.x - w * 0.04, y: top.y + h * 0.16 }, along(front, 0.2), along(right, 0.22)]));
      }
    };
    for (const side of range.sides) {
      for (let t = -range.d - 4; t <= MAP_SIZE + range.d + 4; t += range.step * (0.8 + random() * 0.4)) {
        if (!inGap(side, range.d, t)) peakAt(rangeFoot(side, range.d + random() * 0.8, t));
      }
    }
    return { key: `${range.sides.join()}-${String(range.d)}`, light: light.join(' '), dark: dark.join(' '), snow: snow.join(' '), lightColor: range.light, darkColor: range.dark, front: range.sides.includes('frontLeft') };
  });
  // The sky: everything above the farthest back range's foot line (and far out to either side).
  const far = RANGES[0].d;
  const apex = iso(-far, -far);
  const right = iso(MAP_SIZE - far, -far);
  const left = iso(-far, MAP_SIZE - far);
  const sky = poly([
    { x: -5000, y: -5000 },
    { x: sceneWidth + 5000, y: -5000 },
    { x: sceneWidth + 5000, y: right.y },
    right,
    apex,
    left,
    { x: -5000, y: left.y },
  ]);
  // The river beyond the map: in from the back-left gorge, out through the front-right one.
  const band = (x0: number, x1: number) => poly([iso(x0, 0), iso(x1, 0), iso(x1, RIVER_ROWS), iso(x0, RIVER_ROWS)]);
  const river = `${band(-RIVER_REACH, 0)} ${band(MAP_SIZE, MAP_SIZE + RIVER_REACH)}`;
  const ripples = Array.from({ length: 10 }, (_, i) => {
    const x = i < 5 ? -RIVER_REACH + 1 + i * 2.1 : MAP_SIZE + 0.6 + (i - 5) * 2.1;
    const y = 0.8 + ((i * 3) % 4) * 1.2;
    const a = iso(x, y);
    const b = iso(x + 0.7, y);
    return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }).join(' ');
  // The gate road on out through the pass.
  const road = poly([iso(GATE_ROAD.x, MAP_SIZE), iso(GATE_ROAD.x + GATE_ROAD.w, MAP_SIZE), iso(GATE_ROAD.x + GATE_ROAD.w, MAP_SIZE + 14), iso(GATE_ROAD.x, MAP_SIZE + 14)]);
  return { ranges, sky, skyTop: apex.y - 200, skyLow: right.y, river, ripples, road };
})();

// Drawn live, a handful of paths, so cheap to draw every frame: the back part (sky, river, road, the
// far ranges and the woods behind the map) under the castle image; the front part (the woods and ranges
// in front of the near sides, which may hide the map's edge) over it.
// The backdrop's geometry never changes: parsed once, on first use, and kept.
let backdropPaths: ReturnType<typeof buildBackdropPaths> | null = null;
function buildBackdropPaths() {
  const woods = (w: (typeof WOODS)['back']) => ({
    trunks: parseSvg(w.trunks),
    crowns: w.crowns.map(parseSvg),
    stone: { light: parseSvg(w.stone.light), dark: parseSvg(w.stone.dark), shadow: parseSvg(w.stone.shadow) },
  });
  return {
    ranges: BACKDROP.ranges.map((r) => ({ ...r, light: parseSvg(r.light), dark: parseSvg(r.dark), snow: r.snow ? parseSvg(r.snow) : null })),
    sky: parseSvg(BACKDROP.sky),
    river: parseSvg(BACKDROP.river),
    ripples: parseSvg(BACKDROP.ripples),
    road: parseSvg(BACKDROP.road),
    woods: { back: woods(WOODS.back), front: woods(WOODS.front) },
  };
}

export const Backdrop = memo(function Backdrop({ part }: { part: 'back' | 'front' }) {
  const paths = (backdropPaths ??= buildBackdropPaths());
  const range = (r: (typeof paths.ranges)[number]) => (
    <Group key={r.key}>
      <Path path={r.light} color={r.lightColor} />
      <Path path={r.dark} color={r.darkColor} />
      {r.snow && <Path path={r.snow} color="#eef2f3" />}
    </Group>
  );
  const woods = paths.woods[part];
  const trees = (
    <Group>
      <Path path={woods.stone.shadow} color="rgba(40, 46, 30, 0.35)" />
      <Path path={woods.stone.light} color={STONE_LIGHT} />
      <Path path={woods.stone.dark} color={STONE_DARK} />
      <Path path={woods.trunks} color={TRUNK} />
      {woods.crowns.map((crowns, index) => <Path key={index} path={crowns} color={CROWNS[index]} />)}
    </Group>
  );
  if (part === 'front') {
    return (
      <Group>
        {trees}
        {paths.ranges.filter((r) => r.front).map(range)}
      </Group>
    );
  }
  return (
    <Group>
      <Path path={paths.sky}>
        <LinearGradient start={vec(0, BACKDROP.skyTop)} end={vec(0, BACKDROP.skyLow)} colors={[SKY_TOP, SKY_LOW]} />
      </Path>
      <Path path={paths.river} color={WATER} />
      <Path path={paths.ripples} style="stroke" strokeWidth={1} color="rgba(170, 210, 228, 0.45)" />
      <Path path={paths.road} color={ROAD_COLORS.dirt.fill} />
      {paths.ranges.filter((r) => !r.front).map(range)}
      {trees}
    </Group>
  );
});
