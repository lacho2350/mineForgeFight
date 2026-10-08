// Everything lying on the map's ground: grass, the yard and the river, rocks, roads, traps, trees and
// raiders waiting outside the walls.
import { useMemo } from 'react';
import { Circle, Group, Path, Rect } from '@shopify/react-native-skia';
import { PLAZA, isOpenGround, isWater, onGateRoad, zoneAt, type MapSide } from '../../game/cityMap';
import type { RaidParty } from '../../game/raids';
import type { RoadKind, Roads } from '../../game/roads';
import type { ClearOrder, RockSize } from '../../game/rocks';
import type { Trap } from '../../game/traps';
import type { UnitId } from '../../game/units';
import {
  CASTLE,
  DOCK_TILES,
  DOCKS_ROW,
  GATE_ROAD,
  GATE_TILES,
  HARBOUR,
  MAP_SIZE,
  RIVER_ROWS,
  TILE_HH,
  TILE_HW,
  WALL_TILES,
  iso,
} from '../GameSceneLayout';
import { spritePixels } from '../unitSprites';
import { latest, parseSvg, svgPath, useSvgPaths, type Slot } from '../skiaPaths';
import { ROAD_COLORS, poly, seg, type P } from './shapes';
import { CROWNS, LAND, LAWN, STONE_DARK, STONE_LIGHT, TRUNK, WATER, crag } from './backdrop';

// Trees: a few on open town ground, and thick woods on the raiders' ground beyond the traps.
export const TREES: [number, number, number][] = (() => {
  const trees: [number, number, number][] = [];
  for (let x = 0; x < MAP_SIZE; x++) {
    for (let y = 0; y < MAP_SIZE; y++) {
      const h = (x * 73856093) ^ (y * 19349663);
      const zone = zoneAt(x, y);
      const onPlaza = x >= PLAZA.x0 && x <= PLAZA.x1 && y >= PLAZA.y0 && y <= PLAZA.y1;
      const keep = zone === 'enemy' ? Math.abs(h) % 4 === 0 && !onGateRoad(x, y) && !isWater(x, y) : zone === 'town' && Math.abs(h) % 11 === 0 && isOpenGround(x, y) && !onPlaza;
      if (!keep) continue;
      trees.push([x + 0.3 + (Math.abs(h >> 4) % 5) / 10, y + 0.3 + (Math.abs(h >> 8) % 5) / 10, 0.8 + (Math.abs(h >> 12) % 5) / 10]);
    }
  }
  return trees;
})();

// A path of all tiles matching `test`, as diamonds.
function tilesPath(test: (x: number, y: number) => boolean) {
  const parts: string[] = [];
  for (let x = 0; x < MAP_SIZE; x++) for (let y = 0; y < MAP_SIZE; y++) if (test(x, y)) parts.push(poly([iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)]));
  return parts.join(' ');
}

// The outline of the square `inset` tiles in from the map's edge.
function ringPath(inset: number) {
  const a = inset;
  const b = MAP_SIZE - inset;
  return poly([iso(a, a), iso(b, a), iso(b, b), iso(a, b)]);
}

// The same outline on the three land sides only, ending at the river (which runs up to the far wall).
export function landRing(inset: number) {
  const a = inset;
  const b = MAP_SIZE - inset;
  const [p, q, r, t] = [iso(b, RIVER_ROWS), iso(b, b), iso(a, b), iso(a, RIVER_ROWS)];
  return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${q.x.toFixed(1)} ${q.y.toFixed(1)} L ${r.x.toFixed(1)} ${r.y.toFixed(1)} L ${t.x.toFixed(1)} ${t.y.toFixed(1)}`;
}

// ——— Ground texture ———
// Stronghold-style ground: no grid, but lush grass in broad lighter and darker patches with tufts and the
// odd flower, bare earth in the trap belt, and a dirt yard round the keep with a ragged edge. All of it is
// derived from the tile position, so it's the same every time.

const hash01 = (x: number, y: number, salt: number) => {
  let h = Math.imul(Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + salt * 1013904223, 1274126177);
  h ^= h >>> 13;
  h = Math.imul(h, 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// Smooth value noise, `scale` tiles across.
function smoothNoise(x: number, y: number, scale: number, salt: number) {
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
const GRASS_LIGHT = '#6c8748';
const GRASS_DARK = '#526a39';
const TUFT = '#435c2e';
const TUFT_LIGHT = '#82a057';

function buildGrass() {
  const light: string[] = [];
  const dark: string[] = [];
  const tufts: string[] = [];
  const tuftsLight: string[] = [];
  const flowers: string[] = [];
  const clods: string[] = [];
  for (let x = 0; x < MAP_SIZE; x++) {
    for (let y = 0; y < MAP_SIZE; y++) {
      const zone = zoneAt(x, y);
      if (zone === 'traps') {
        // Bare earth: dark clods and a few stones.
        for (let i = 0; i < 3; i++) clods.push(groundBlob(x + hash01(x, y, 40 + i), y + hash01(y, x, 41 + i), 0.06 + 0.06 * hash01(x, y, 42 + i)));
        continue;
      }
      if (zone !== 'town' && zone !== 'enemy') continue;
      // Broad patches: the low-frequency noise decides lighter or darker grass here.
      const n = smoothNoise(x, y, 7, 1) * 0.7 + smoothNoise(x, y, 3, 2) * 0.3;
      const jx = x + 0.2 + hash01(x, y, 3) * 0.6;
      const jy = y + 0.2 + hash01(x, y, 4) * 0.6;
      const r = 0.55 + hash01(x, y, 5) * 0.55;
      if (n > 0.56) light.push(groundBlob(jx, jy, r));
      else if (n < 0.44) dark.push(groundBlob(jx, jy, r));
      // Tufts of grass, and now and then a flower.
      for (let i = 0; i < 3; i++) {
        const p = iso(x + hash01(x, y, 10 + i), y + hash01(y, x, 20 + i));
        const tuft = `M ${(p.x - 1.6).toFixed(1)} ${p.y.toFixed(1)} L ${(p.x - 0.3).toFixed(1)} ${(p.y - 3).toFixed(1)} L ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 0.4).toFixed(1)} ${(p.y - 2.6).toFixed(1)} L ${(p.x + 1.6).toFixed(1)} ${p.y.toFixed(1)}`;
        (hash01(x, y, 30 + i) < 0.3 ? tuftsLight : tufts).push(tuft);
      }
      if (zone === 'town' && hash01(x, y, 50) < 0.08) {
        const p = iso(x + hash01(x, y, 51), y + hash01(x, y, 52));
        flowers.push(`M ${(p.x - 0.9).toFixed(1)} ${(p.y - 1).toFixed(1)} h 1.8 v 1.8 h -1.8 Z`);
      }
    }
  }
  // The keep's yard: packed dirt with a ragged edge, and pebbles.
  const edge: P[] = [];
  const step = 0.25;
  const wobble = (u: number, v: number) => (hash01(Math.round(u * 8), Math.round(v * 8), 60) - 0.5) * 0.5;
  const { x0, y0 } = PLAZA;
  const x1 = PLAZA.x1 + 1;
  const y1 = PLAZA.y1 + 1;
  for (let u = x0; u < x1; u += step) edge.push(iso(u, y0 + wobble(u, y0)));
  for (let v = y0; v < y1; v += step) edge.push(iso(x1 + wobble(x1, v), v));
  for (let u = x1; u > x0; u -= step) edge.push(iso(u, y1 + wobble(u, y1)));
  for (let v = y1; v > y0; v -= step) edge.push(iso(x0 + wobble(x0, v), v));
  const pebbles: string[] = [];
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let i = 0; i < 2; i++) pebbles.push(groundBlob(x + hash01(x, y, 70 + i), y + hash01(y, x, 72 + i), 0.04 + 0.04 * hash01(x, y, 74 + i)));
  return { light: light.join(' '), dark: dark.join(' '), tufts: tufts.join(' '), tuftsLight: tuftsLight.join(' '), flowers: flowers.join(' '), clods: clods.join(' '), yard: poly(edge), pebbles: pebbles.join(' ') };
}

// The ground, rings and river (built once, on first use, after Skia has loaded).
let groundPaths: ReturnType<typeof buildGround> | null = null;
function buildGround() {
  const { x: rx, w: rw } = GATE_ROAD;
  const svg = {
    ...buildGrass(),
    outline: ringPath(0),
    wild: tilesPath((x, y) => zoneAt(x, y) === 'enemy'),
    traps: tilesPath((x, y) => zoneAt(x, y) === 'traps'),
    moat: tilesPath((x, y) => zoneAt(x, y) === 'moat'),
    river: tilesPath((x, y) => zoneAt(x, y) === 'water'),
    // Ripples drifting downstream (west to east), and the river's banks where it meets the land beyond
    // the wall at either end.
    ripples: Array.from({ length: 40 }, (_, i) => {
      const x = 0.6 + (i * 2.9) % (MAP_SIZE - 1) + (i % 3) * 0.3;
      const y = 0.5 + ((i * 7) % 5) * (RIVER_ROWS - 1) / 5;
      const a = iso(x, y);
      const b = iso(x + 0.7, y);
      return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    }).join(' '),
    banks: [[0, CASTLE.x0 - 1], [CASTLE.x1 + 2, MAP_SIZE]]
      .map(([x0, x1]) => {
        const a = iso(x0, RIVER_ROWS);
        const b = iso(x1, RIVER_ROWS);
        return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
      })
      .join(' '),
    gateRoad: poly([iso(GATE_ROAD.x, GATE_ROAD.y), iso(GATE_ROAD.x + GATE_ROAD.w, GATE_ROAD.y), iso(GATE_ROAD.x + GATE_ROAD.w, GATE_ROAD.y + GATE_ROAD.d), iso(GATE_ROAD.x, GATE_ROAD.y + GATE_ROAD.d)]),
    enemyEdge: landRing(3),
    moatRims: `${landRing(5)} ${landRing(6)}`,
    // The bridge: the gate road where it crosses the moat (5 tiles in from the edge).
    bridge: poly([iso(rx - 0.2, MAP_SIZE - 6), iso(rx + rw + 0.2, MAP_SIZE - 6), iso(rx + rw + 0.2, MAP_SIZE - 5), iso(rx - 0.2, MAP_SIZE - 5)]),
  };
  return Object.fromEntries(Object.entries(svg).map(([name, path]) => [name, parseSvg(path)])) as Record<keyof typeof svg, ReturnType<typeof parseSvg>>;
}

// The ground, rings and river. Until the moat is built its ring is a dry ditch (no bridge needed).
export function Ground({ flooded }: { flooded: boolean }) {
  const ground = (groundPaths ??= buildGround());
  return (
    <Group>
      <Path path={ground.outline} color={LAWN} />
      {/* Raiders' ground: the wild land that runs on past the map */}
      <Path path={ground.wild} color={LAND} />
      {/* Grass in broad patches, with tufts and the odd flower */}
      <Path path={ground.light} color={GRASS_LIGHT} opacity={0.55} />
      <Path path={ground.dark} color={GRASS_DARK} opacity={0.55} />
      <Path path={ground.tufts} style="stroke" strokeWidth={0.7} color={TUFT} opacity={0.75} />
      <Path path={ground.tuftsLight} style="stroke" strokeWidth={0.7} color={TUFT_LIGHT} opacity={0.8} />
      <Path path={ground.flowers} color="#e8d36a" />
      <Path path={ground.enemyEdge} style="stroke" strokeWidth={1.5} color="rgba(200, 70, 50, 0.45)" />
      {/* The trap belt: bare earth, waiting for traps */}
      <Path path={ground.traps} color="#6a6446" />
      <Path path={ground.clods} color="#57523a" />
      {/* The river up to the far wall (and its harbour), the moat (flooded from it once built), and the bridge at the gate */}
      <Path path={ground.river} color={WATER} />
      <Path path={ground.ripples} style="stroke" strokeWidth={1} color="rgba(170, 210, 228, 0.45)" />
      <Path path={ground.banks} style="stroke" strokeWidth={1.5} color="#c9b98a" />
      <Path path={ground.moat} color={flooded ? '#3f6f8a' : '#5e5038'} />
      <Path path={ground.moatRims} style="stroke" strokeWidth={1} color={flooded ? '#8fb8cc' : '#4a3f2c'} />
      {/* The keep's yard: packed dirt */}
      <Path path={ground.yard} color="#8b7e58" />
      <Path path={ground.pebbles} color="#6f6446" />
      <Path path={ground.gateRoad} color={ROAD_COLORS.dirt.fill} />
      {flooded && <Path path={ground.bridge} color="#8c6a3c" />}
    </Group>
  );
}

// The wall's line, staked out until the wall is built: round the town, stepping in round the harbour.
const PLANNED_WALL = (() => {
  const a = CASTLE.x0 + 0.5;
  const b = CASTLE.x1 + 0.5;
  const left = HARBOUR.x0 - 0.5;
  const right = HARBOUR.x1 + 1.5;
  const back = DOCKS_ROW + 0.5;
  // Round from one side of the gateway to the other, leaving the gate open.
  const points = [iso(GATE_TILES[0], b), iso(a, b), iso(a, a), iso(left, a), iso(left, back), iso(right, back), iso(right, a), iso(b, a), iso(b, b), iso(GATE_TILES[2] + 1, b)];
  return `M ${points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')}`;
})();
// Until the wall is built, a low wattle fence of posts and two rails marks its line (no defence in battle).
const FENCE_POSTS = WALL_TILES.filter(([x, y]) => !(y === CASTLE.y1 && GATE_TILES.includes(x)) && !(y === DOCKS_ROW && DOCK_TILES.includes(x)))
  .map(([x, y]) => seg(iso(x + 0.5, y + 0.5), iso(x + 0.5, y + 0.5, 7)))
  .join(' ');
export function PlannedWall() {
  return (
    <Group>
      <Path path={svgPath(FENCE_POSTS)} style="stroke" strokeWidth={1.4} color="#6e4a2f" />
      <Group transform={[{ translateY: -3 }]}>
        <Path path={svgPath(PLANNED_WALL)} style="stroke" strokeWidth={1} color="#8c6a3c" />
      </Group>
      <Group transform={[{ translateY: -6 }]}>
        <Path path={svgPath(PLANNED_WALL)} style="stroke" strokeWidth={1} color="#a5804c" />
      </Group>
    </Group>
  );
}

// The belt's tiles, lit up while traps are being laid.
export const BELT = tilesPath((x, y) => zoneAt(x, y) === 'traps' && !onGateRoad(x, y));

// ——— Rocks ———

// Every rock still standing, by size: a scatter of stones, a rock, or a big boulder. Low, so they're
// drawn with the ground (under every building and tree), a few paths for all of them.
const rockSlot: Slot<readonly string[], { light: ReturnType<typeof parseSvg>; dark: ReturnType<typeof parseSvg>; shadow: ReturnType<typeof parseSvg> }> = {};
export function Rocks({ cleared, rocks }: { cleared: readonly string[]; rocks: { x: number; y: number; size: RockSize }[] }) {
  const paths = latest(rockSlot, cleared, () => {
    const light: string[] = [];
    const dark: string[] = [];
    const shadow: string[] = [];
    const lump = (cx: number, cy: number, r: number, h: number) => {
      // A crag of rock on the ground at (cx, cy) (tile units), `r` tiles across and `h` pixels tall.
      const base = iso(cx, cy);
      const w = r * TILE_HW;
      const rock = crag(base, w, h, w * 0.3, -0.15);
      shadow.push(poly([{ x: base.x - w, y: base.y }, { x: base.x, y: base.y + w * 0.35 }, { x: base.x + w, y: base.y }, { x: base.x, y: base.y - w * 0.25 }]));
      light.push(rock.light);
      dark.push(rock.dark);
    };
    for (const { x, y, size } of rocks) {
      if (size === 1) {
        lump(x + 0.3, y + 0.4, 0.2, 3);
        lump(x + 0.65, y + 0.35, 0.16, 2.5);
        lump(x + 0.5, y + 0.7, 0.18, 3);
      } else if (size === 2) {
        lump(x + 0.5, y + 0.5, 0.42, 8);
        lump(x + 0.25, y + 0.78, 0.15, 3);
      } else {
        lump(x + 0.5, y + 0.55, 0.62, 14);
      }
    }
    return { light: parseSvg(light.join(' ')), dark: parseSvg(dark.join(' ')), shadow: parseSvg(shadow.join(' ')) };
  });
  if (rocks.length === 0) return null;
  return (
    <Group>
      <Path path={paths.shadow} color="rgba(40, 46, 30, 0.35)" />
      <Path path={paths.light} color={STONE_LIGHT} />
      <Path path={paths.dark} color={STONE_DARK} />
    </Group>
  );
}

// Rocks ordered cleared, marked on the map until the crew gets to them (the first order brighter).
export function ClearingMarks({ orders }: { orders: ClearOrder[] }) {
  const paths = useMemo(() => {
    const mark = (keys: string[]) => keys.map((key) => {
      const [x, y] = key.split(',').map(Number);
      return poly([iso(x + 0.1, y + 0.1), iso(x + 0.9, y + 0.1), iso(x + 0.9, y + 0.9), iso(x + 0.1, y + 0.9)]);
    }).join(' ');
    return { now: mark(orders[0].tiles), later: mark(orders.slice(1).flatMap((order) => order.tiles)) };
  }, [orders]);
  const [later, now] = useSvgPaths([paths.later, paths.now]);
  return (
    <Group>
      <Path path={later} style="stroke" strokeWidth={1} color="rgba(243, 210, 122, 0.55)" />
      <Path path={now} style="stroke" strokeWidth={1.6} color="#f3d27a" />
    </Group>
  );
}

// ——— Roads ———

// Every road tile, by kind: dirt with a few ruts, stone as cobbles, granite as big dressed slabs.
const roadSlot: Slot<Roads, { fill: Record<RoadKind, ReturnType<typeof parseSvg>>; mark: Record<RoadKind, ReturnType<typeof parseSvg>> }> = {};
export function RoadTiles({ roads }: { roads: Roads }) {
  const paths = latest(roadSlot, roads, () => {
    const fill: Record<RoadKind, string[]> = { dirt: [], stone: [], granite: [] };
    const mark: Record<RoadKind, string[]> = { dirt: [], stone: [], granite: [] };
    const diamond = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) =>
      poly([iso(x + x0, y + y0), iso(x + x1, y + y0), iso(x + x1, y + y1), iso(x + x0, y + y1)]);
    for (const [key, kind] of Object.entries(roads)) {
      const [x, y] = key.split(',').map(Number);
      fill[kind].push(diamond(x, y, 0, 0, 1, 1));
      if (kind === 'dirt') {
        mark.dirt.push(diamond(x, y, 0.3, 0.3, 0.42, 0.42), diamond(x, y, 0.62, 0.55, 0.72, 0.65));
      } else if (kind === 'stone') {
        for (const [u, v] of [[0.08, 0.08], [0.55, 0.08], [0.08, 0.55], [0.55, 0.55]]) mark.stone.push(diamond(x, y, u, v, u + 0.37, v + 0.37));
      } else {
        mark.granite.push(diamond(x, y, 0.06, 0.06, 0.94, 0.94));
      }
    }
    return {
      fill: Object.fromEntries(Object.entries(fill).map(([kind, parts]) => [kind, parseSvg(parts.join(' '))])) as Record<RoadKind, ReturnType<typeof parseSvg>>,
      mark: Object.fromEntries(Object.entries(mark).map(([kind, parts]) => [kind, parseSvg(parts.join(' '))])) as Record<RoadKind, ReturnType<typeof parseSvg>>,
    };
  });
  return (
    <Group>
      <Path path={paths.fill.dirt} color={ROAD_COLORS.dirt.fill} />
      <Path path={paths.mark.dirt} color={ROAD_COLORS.dirt.mark} />
      <Path path={paths.fill.stone} color={ROAD_COLORS.stone.mark} />
      <Path path={paths.mark.stone} color={ROAD_COLORS.stone.fill} />
      <Path path={paths.fill.granite} color={ROAD_COLORS.granite.fill} />
      <Path path={paths.mark.granite} style="stroke" strokeWidth={0.8} color={ROAD_COLORS.granite.mark} />
    </Group>
  );
}

// A map point `out` tiles in from a side's edge, `along` tiles along it.
function onSide(side: MapSide, along: number, out: number) {
  switch (side) {
    case 'southWest':
      return { x: along, y: MAP_SIZE - out };
    case 'southEast':
      return { x: MAP_SIZE - out, y: along };
    case 'northEast':
      return { x: along, y: out };
    case 'northWest':
      return { x: out, y: along };
  }
}

// Raiders gathering on their ground, on the side they come from: a few figures per company, spread
// out when sighted, bunched up at the belt's edge when they attack.
export function raiderFigures(party: RaidParty, side: MapSide, atGate: boolean) {
  const figures: { unit: UnitId; x: number; y: number }[] = [];
  const middle = MAP_SIZE / 2;
  party.forEach(({ unit, count }, company) => {
    const many = Math.max(1, Math.min(4, Math.ceil(count / 6)));
    for (let i = 0; i < many && figures.length < 18; i++) {
      const spread = atGate ? 0.7 : 1.6;
      const along = middle + ((company % 2 ? 1 : -1) * (1 + Math.floor(company / 2)) + (i - many / 2) * 0.6) * spread;
      figures.push({ unit, ...onSide(side, along, (atGate ? 2.6 : 1.6) + (i % 2) * 0.6) });
    }
  });
  return figures;
}

// Traps in the belt. Spike pits: a dark hole bristling with sharpened stakes. Pitch ditches: a glossy
// black pool. Snares: a rope noose pegged to the ground. All of a kind share a few paths.
export function Traps({ traps }: { traps: Trap[] }) {
  const paths = useMemo(() => {
    const parts = { holes: [] as string[], rims: [] as string[], stakes: [] as string[], pitch: [] as string[], sheen: [] as string[], nooses: [] as string[], pegs: [] as string[] };
    const diamond = (x: number, y: number, inset: number) => poly([iso(x + inset, y + inset), iso(x + 1 - inset, y + inset), iso(x + 1 - inset, y + 1 - inset), iso(x + inset, y + 1 - inset)]);
    for (const { kind, x, y } of traps) {
      if (kind === 'spikes') {
        parts.holes.push(diamond(x, y, 0.16));
        parts.rims.push(diamond(x, y, 0.1));
        for (const [u, v] of [[0.35, 0.35], [0.65, 0.4], [0.4, 0.65], [0.62, 0.66], [0.5, 0.5]]) {
          const base = iso(x + u, y + v);
          parts.stakes.push(poly([{ x: base.x - 1.3, y: base.y }, { x: base.x, y: base.y - 7 }, { x: base.x + 1.3, y: base.y }]));
        }
      } else if (kind === 'pitch') {
        parts.pitch.push(diamond(x, y, 0.12));
        parts.sheen.push(diamond(x + 0.12, y - 0.04, 0.38));
      } else {
        const c = iso(x + 0.5, y + 0.5);
        parts.nooses.push(`M ${(c.x - 7).toFixed(1)} ${c.y.toFixed(1)} A 7 3.5 0 1 0 ${(c.x + 7).toFixed(1)} ${c.y.toFixed(1)} A 7 3.5 0 1 0 ${(c.x - 7).toFixed(1)} ${c.y.toFixed(1)} M ${(c.x + 7).toFixed(1)} ${c.y.toFixed(1)} L ${(c.x + 11).toFixed(1)} ${(c.y - 3).toFixed(1)}`);
        parts.pegs.push(poly([{ x: c.x + 10, y: c.y - 2 }, { x: c.x + 10, y: c.y - 9 }, { x: c.x + 12.4, y: c.y - 9 }, { x: c.x + 12.4, y: c.y - 2 }]));
      }
    }
    return Object.fromEntries(Object.entries(parts).map(([name, list]) => [name, list.join(' ')])) as Record<keyof typeof parts, string>;
  }, [traps]);
  if (traps.length === 0) return null;
  return (
    <Group>
      <Path path={paths.rims} color="#a48d63" />
      <Path path={paths.holes} color="#2b2217" />
      <Path path={paths.stakes} color="#d8c49a" />
      <Path path={paths.stakes} style="stroke" strokeWidth={0.5} color="#6b5233" />
      <Path path={paths.pitch} color="#161310" />
      <Path path={paths.sheen} color="rgba(150, 132, 96, 0.45)" />
      <Path path={paths.nooses} style="stroke" strokeWidth={1.4} color="#d6b878" />
      <Path path={paths.pegs} color="#6e4a2f" />
    </Group>
  );
}

export function RaiderFigure({ unit, x, y }: { unit: UnitId; x: number; y: number }) {
  const p = iso(x, y);
  const pixel = 1.1;
  return (
    <Group>
      {spritePixels(unit).map((px, i) => (
        <Rect key={i} x={p.x - 6 * pixel + px.x * pixel} y={p.y - 12 * pixel + px.y * pixel} width={pixel + 0.2} height={pixel + 0.2} color={px.color} />
      ))}
    </Group>
  );
}

export function Tree({ x, y, size }: { x: number; y: number; size: number }) {
  const base = iso(x, y);
  return (
    <Group>
      <Rect x={base.x - 1} y={base.y - 8 * size} width={2} height={8 * size} color={TRUNK} />
      <Circle cx={base.x} cy={base.y - 12 * size} r={6 * size} color={CROWNS[0]} />
      <Circle cx={base.x - 3 * size} cy={base.y - 9 * size} r={4.5 * size} color={CROWNS[1]} />
      <Circle cx={base.x + 3 * size} cy={base.y - 10 * size} r={4 * size} color={CROWNS[2]} />
    </Group>
  );
}
