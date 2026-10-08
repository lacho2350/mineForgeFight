// The stronghold's drawing kit: building materials and shared colours, and the isometric shapes
// everything is built from (boxes, roofs, round towers, flags).
import type { ReactNode } from 'react';
import { Group, LinearGradient, Path, Rect, vec } from '@shopify/react-native-skia';
import type { RoadKind } from '../../game/roads';
import { TILE_HH, TILE_HW, iso } from '../GameSceneLayout';
import { svgPath } from '../skiaPaths';

// ——— Materials: every building changes look every five levels ———

// Stronghold-style: plank huts under thatch, then half-timbered plaster under red tiles, then stone and
// dressed stone under slate. `kind` dresses walls (planks, beams, stone courses) and roofs (thatch, tile,
// slate rows); materials without it (piles, odd parts) stay plain.
type MatKind = 'timber' | 'plaster' | 'stone' | 'dressed';
type Mat = { left: string; right: string; top: string; roof: string; roofDark: string; kind?: MatKind };
export const MATS: Mat[] = [
  { left: '#a5774c', right: '#7c5435', top: '#b98a5a', roof: '#b38c4f', roofDark: '#8c6a37', kind: 'timber' }, // planks, thatch
  { left: '#e2d2ab', right: '#bea883', top: '#ebdcb8', roof: '#9a5038', roofDark: '#78382a', kind: 'plaster' }, // half-timbered, tiles
  { left: '#a9a698', right: '#86847a', top: '#bdbaab', roof: '#5f6f80', roofDark: '#475563', kind: 'stone' }, // stone, slate
  { left: '#d6d1c0', right: '#b3ad9b', top: '#e4e0d0', roof: '#41607c', roofDark: '#30475e', kind: 'dressed' }, // dressed stone, slate
];
export const STONE: Mat = MATS[2];
export const MARBLE: Mat = { left: '#ece7da', right: '#cfc9b9', top: '#f6f2e8', roof: '#e2b84f', roofDark: '#b8902f' };
export const GOLD = '#e2b84f';
export const BANNER = '#b8483a';
export const DARK = '#2a2620';
export const GLOW = '#f0b45a';
export const tierOf = (level: number) => (level <= 0 ? 0 : Math.min(4, Math.ceil(level / 5)));
export const matOf = (tier: number) => MATS[Math.max(0, tier - 1)];
/** Fortifications (the keep, walls, towers, gate) go straight from timber to stone, dressed stone last. */
export const fortMat = (tier: number) => (tier <= 1 ? MATS[0] : tier === 4 ? MATS[3] : MATS[2]);

export type P = { x: number; y: number };
export const poly = (points: P[]) => `M ${points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')} Z`;

// ——— Geometry helpers ———

export const seg = (a: P, b: P) => `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
const OUTLINE = 'rgba(28, 20, 12, 0.5)';

/** A wall face's dressing as line segments: `at(u, v)` is the point `u` tiles along it and `v` pixels up. */
function faceDressing(kind: MatKind, at: (u: number, v: number) => P, span: number, h: number) {
  const lines: string[] = [];
  if (kind === 'timber') {
    // Planks, and a sill at the foot.
    for (let u = 0.2; u < span - 0.05; u += 0.2) lines.push(seg(at(u, 0), at(u, h)));
    lines.push(seg(at(0, 1.2), at(span, 1.2)));
  } else if (kind === 'plaster') {
    // A timber frame: sill, rail and plate, posts, and a brace in every other bay.
    for (const v of [0.8, h / 2, h - 0.8]) lines.push(seg(at(0, v), at(span, v)));
    const bays = Math.max(1, Math.round(span / 0.55));
    for (let i = 0; i <= bays; i++) lines.push(seg(at((span * i) / bays, 0), at((span * i) / bays, h)));
    for (let i = 0; i < bays; i += 2) lines.push(seg(at((span * i) / bays, 0.8), at((span * (i + 1)) / bays, h / 2)));
  } else {
    // Stone courses with staggered joints (finer for dressed stone).
    const course = kind === 'dressed' ? 5 : 4;
    const block = kind === 'dressed' ? 0.45 : 0.34;
    for (let v = course, row = 0; v < h; v += course, row++) {
      lines.push(seg(at(0, v), at(span, v)));
      for (let u = (row % 2) * (block / 2) + block / 2; u < span; u += block) lines.push(seg(at(u, v - course), at(u, v)));
    }
  }
  return lines.join(' ');
}
const DRESSING_COLOR: Record<MatKind, string> = {
  timber: 'rgba(55, 32, 14, 0.45)',
  plaster: '#5b3d25',
  stone: 'rgba(40, 38, 32, 0.35)',
  dressed: 'rgba(90, 84, 70, 0.4)',
};

/** A box standing on the map: two visible walls and a top, dressed by its material and outlined. */
export function Box({ x, y, w, d, h, z = 0, m, top, outline = true }: { x: number; y: number; w: number; d: number; h: number; z?: number; m: Mat; top?: string; outline?: boolean }) {
  const A = iso(x, y, z + h);
  const B = iso(x + w, y, z + h);
  const C = iso(x + w, y + d, z + h);
  const D = iso(x, y + d, z + h);
  const big = outline && w >= 0.4 && d >= 0.4 && h >= 4;
  const dressed = m.kind && h >= 7;
  const left = dressed && w >= 0.5 ? faceDressing(m.kind as MatKind, (u, v) => iso(x + u, y + d, z + v), w, h) : '';
  const right = dressed && d >= 0.5 ? faceDressing(m.kind as MatKind, (u, v) => iso(x + w, y + u, z + v), d, h) : '';
  const lines = `${left} ${right}`.trim();
  return (
    <Group>
      <Path path={svgPath(poly([iso(x, y + d, z), iso(x + w, y + d, z), C, D]))} color={m.left} />
      <Path path={svgPath(poly([iso(x + w, y, z), iso(x + w, y + d, z), C, B]))} color={m.right} />
      <Path path={svgPath(poly([A, B, C, D]))} color={top ?? m.top} />
      {lines.length > 0 && <Path path={svgPath(lines)} style="stroke" strokeWidth={m.kind === 'plaster' ? 1.1 : 0.6} color={DRESSING_COLOR[m.kind as MatKind]} />}
      {big && (
        <Path
          path={svgPath(`${poly([iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y, z), B, A, D])} ${seg(iso(x + w, y + d, z), C)}`)}
          style="stroke"
          strokeWidth={0.7}
          color={OUTLINE}
        />
      )}
    </Group>
  );
}

// Rows across a roof slope, parallel to its eave (`e0`–`e1`) up to its ridge (`r0`–`r1`): thatch, tiles or slates.
function roofRows(kind: MatKind | undefined, e0: P, e1: P, r0: P, r1: P) {
  if (!kind) return '';
  const lerp = (a: P, b: P, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const length = Math.hypot((r0.x + r1.x) / 2 - (e0.x + e1.x) / 2, (r0.y + r1.y) / 2 - (e0.y + e1.y) / 2);
  const gap = kind === 'timber' ? 2.2 : 3;
  const rows: string[] = [];
  for (let t = gap / Math.max(1, length); t < 0.97; t += gap / Math.max(1, length)) rows.push(seg(lerp(e0, r0, t), lerp(e1, r1, t)));
  return rows.join(' ');
}
const ROOF_ROW_COLOR: Record<MatKind, string> = {
  timber: 'rgba(84, 58, 24, 0.5)',
  plaster: 'rgba(60, 18, 10, 0.4)',
  stone: 'rgba(20, 26, 36, 0.35)',
  dressed: 'rgba(16, 24, 36, 0.35)',
};
function RoofDressing({ m, rows, outline }: { m: Mat; rows: string; outline: string }) {
  if (!m.kind) return null;
  return (
    <Group>
      {rows.length > 0 && <Path path={svgPath(rows)} style="stroke" strokeWidth={m.kind === 'timber' ? 0.8 : 0.7} color={ROOF_ROW_COLOR[m.kind]} />}
      <Path path={svgPath(outline)} style="stroke" strokeWidth={0.7} color={OUTLINE} />
    </Group>
  );
}

/** A pitched roof on a box top at height z; the ridge runs along x or y. */
export function Gable({ x, y, w, d, z, rise, m, along = 'x' }: { x: number; y: number; w: number; d: number; z: number; rise: number; m: Mat; along?: 'x' | 'y' }) {
  const A = iso(x, y, z);
  const B = iso(x + w, y, z);
  const C = iso(x + w, y + d, z);
  const D = iso(x, y + d, z);
  if (along === 'x') {
    const r1 = iso(x, y + d / 2, z + rise);
    const r2 = iso(x + w, y + d / 2, z + rise);
    return (
      <Group>
        <Path path={svgPath(poly([A, B, r2, r1]))} color={m.roofDark} />
        <Path path={svgPath(poly([B, C, r2]))} color={m.right} />
        <Path path={svgPath(poly([D, C, r2, r1]))} color={m.roof} />
        <RoofDressing m={m} rows={`${roofRows(m.kind, D, C, r1, r2)} ${roofRows(m.kind, A, B, r1, r2)}`.trim()} outline={`${poly([D, C, B, r2, r1])} ${seg(C, r2)}`} />
      </Group>
    );
  }
  const r1 = iso(x + w / 2, y, z + rise);
  const r2 = iso(x + w / 2, y + d, z + rise);
  return (
    <Group>
      <Path path={svgPath(poly([A, D, r2, r1]))} color={m.roof} />
      <Path path={svgPath(poly([D, C, r2]))} color={m.left} />
      <Path path={svgPath(poly([B, C, r2, r1]))} color={m.roofDark} />
      <RoofDressing m={m} rows={`${roofRows(m.kind, A, D, r1, r2)} ${roofRows(m.kind, B, C, r1, r2)}`.trim()} outline={`${poly([A, D, C, B, r1])} ${seg(D, r2)} ${seg(r2, C)}`} />
    </Group>
  );
}

/** A pyramid roof (or spire) on a box top. */
export function Hip({ x, y, w, d, z, rise, m }: { x: number; y: number; w: number; d: number; z: number; rise: number; m: Mat }) {
  const apex = iso(x + w / 2, y + d / 2, z + rise);
  const A = iso(x, y, z);
  const B = iso(x + w, y, z);
  const C = iso(x + w, y + d, z);
  const D = iso(x, y + d, z);
  return (
    <Group>
      <Path path={svgPath(poly([A, B, apex]))} color={m.roofDark} />
      <Path path={svgPath(poly([A, D, apex]))} color={m.roof} />
      <Path path={svgPath(poly([D, C, apex]))} color={m.roof} />
      <Path path={svgPath(poly([B, C, apex]))} color={m.roofDark} />
      <RoofDressing
        m={m}
        rows={`${roofRows(m.kind, D, C, apex, apex)} ${roofRows(m.kind, B, C, apex, apex)} ${roofRows(m.kind, A, D, apex, apex)}`.trim()}
        outline={`${poly([A, D, C, B, apex])} ${seg(D, apex)} ${seg(C, apex)}`}
      />
    </Group>
  );
}

/** Battlements along the two front edges of a box top. */
export function Crenels({ x, y, w, d, z, m }: { x: number; y: number; w: number; d: number; z: number; m: Mat }) {
  const merlons: ReactNode[] = [];
  const size = 0.22;
  for (let u = 0; u + size <= w + 0.01; u += 0.5) merlons.push(<Box key={`f${String(u)}`} x={x + u} y={y + d - size} w={size} d={size} h={3.5} z={z} m={m} />);
  for (let v = 0; v + size <= d - 0.3; v += 0.5) merlons.push(<Box key={`r${String(v)}`} x={x + w - size} y={y + v} w={size} d={size} h={3.5} z={z} m={m} />);
  return <Group>{merlons}</Group>;
}

// A round tower's body: a cylinder `r` tiles across standing at (cx, cy), lit from the left, with stone
// courses round its front and a ring of merlons on top (a walkway inside them).
export function Cylinder({ cx, cy, r, h, z = 0, m, merlons = true }: { cx: number; cy: number; r: number; h: number; z?: number; m: Mat; merlons?: boolean }) {
  const base = iso(cx, cy, z);
  const rx = r * TILE_HW * Math.SQRT2;
  const ry = r * TILE_HH * Math.SQRT2;
  const top = base.y - h;
  const f = (n: number) => n.toFixed(1);
  const arc = (y: number) => `M ${f(base.x - rx)} ${f(y)} A ${f(rx)} ${f(ry)} 0 0 0 ${f(base.x + rx)} ${f(y)}`;
  const body = `M ${f(base.x - rx)} ${f(top)} L ${f(base.x - rx)} ${f(base.y)} A ${f(rx)} ${f(ry)} 0 0 0 ${f(base.x + rx)} ${f(base.y)} L ${f(base.x + rx)} ${f(top)} Z`;
  const disc = `M ${f(base.x - rx)} ${f(top)} A ${f(rx)} ${f(ry)} 0 1 0 ${f(base.x + rx)} ${f(top)} A ${f(rx)} ${f(ry)} 0 1 0 ${f(base.x - rx)} ${f(top)} Z`;
  const courses: string[] = [];
  for (let v = 4; v < h; v += 4) courses.push(arc(base.y - v));
  const ring = merlons
    ? Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2)
        .map((a) => ({ x: base.x + Math.cos(a) * rx * 0.88, y: top + Math.sin(a) * ry * 0.88, front: Math.sin(a) }))
        .sort((a, b) => a.y - b.y)
    : [];
  return (
    <Group>
      <Path path={svgPath(body)}>
        <LinearGradient start={vec(base.x - rx, 0)} end={vec(base.x + rx, 0)} colors={[m.top, m.left, m.right, m.right]} />
      </Path>
      {courses.length > 0 && <Path path={svgPath(courses.join(' '))} style="stroke" strokeWidth={0.6} color={DRESSING_COLOR[m.kind ?? 'stone']} />}
      <Path path={svgPath(disc)} color={m.top} />
      <Path path={svgPath(`${body} ${disc}`)} style="stroke" strokeWidth={0.7} color={OUTLINE} />
      {ring.map((p, i) => (
        <Group key={i}>
          <Rect x={p.x - 1.6} y={p.y - 4} width={3.2} height={4} color={p.x < base.x ? m.left : m.right} />
          <Rect x={p.x - 1.6} y={p.y - 4.8} width={3.2} height={1} color={m.top} />
        </Group>
      ))}
    </Group>
  );
}

/** A quad on a box's front-left wall (the face along y = yFront), from u0..u1 along x and v0..v1 up. */
export function LeftFace({ x, yFront, z = 0, u0, u1, v0, v1, color }: { x: number; yFront: number; z?: number; u0: number; u1: number; v0: number; v1: number; color: string }) {
  return <Path path={svgPath(poly([iso(x + u0, yFront, z + v0), iso(x + u1, yFront, z + v0), iso(x + u1, yFront, z + v1), iso(x + u0, yFront, z + v1)]))} color={color} />;
}

/** A quad on a box's front-right wall (the face along x = xFront). */
export function RightFace({ xFront, y, z = 0, u0, u1, v0, v1, color }: { xFront: number; y: number; z?: number; u0: number; u1: number; v0: number; v1: number; color: string }) {
  return <Path path={svgPath(poly([iso(xFront, y + u0, z + v0), iso(xFront, y + u1, z + v0), iso(xFront, y + u1, z + v1), iso(xFront, y + u0, z + v1)]))} color={color} />;
}

export function Flag({ x, y, z, color = BANNER }: { x: number; y: number; z: number; color?: string }) {
  const base = iso(x, y, z);
  return (
    <Group>
      <Rect x={base.x - 0.6} y={base.y - 14} width={1.2} height={14} color={DARK} />
      <Rect x={base.x + 0.6} y={base.y - 14} width={8} height={5} color={color} />
    </Group>
  );
}

// Road colours, by kind (the backdrop's road carries on the map's dirt road).
export const ROAD_COLORS: Record<RoadKind, { fill: string; mark: string }> = {
  dirt: { fill: '#b09a6a', mark: '#9a845a' },
  stone: { fill: '#a19d93', mark: '#7f7b72' },
  granite: { fill: '#c9cbcf', mark: '#8e9198' },
};

/** Where the map's origin is drawn: sprites drawn at the origin are moved from here. */
export const ORIGIN = iso(0, 0);
