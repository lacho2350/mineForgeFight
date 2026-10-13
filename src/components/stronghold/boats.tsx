// The fishing huts' boats on the river: each hut from level 5 has one out on the water in front of it
// (game/boats.ts), drifting slowly about as its crew fishes — a rowboat, then a sailing skiff, a fishing
// smack with its net out, and a two-masted ketch, roaming further the bigger it is. On the scene clock.
import { memo, useMemo } from 'react';
import { Circle, Group, Line, Path, Rect, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { BoatTier } from '../../game/boats';
import { RIVER_ROWS } from '../../game/cityMap';
import { TILE_HH, TILE_HW } from '../GameSceneLayout';
import { parseSvg } from '../skiaPaths';
import { ORIGIN, poly } from './shapes';

// `look`: "x,tier;…" — each hut's column and its boat — so the boats change only when a hut does.
export const FishingBoats = memo(function FishingBoats({ look, clock }: { look: string; clock: SharedValue<number> }) {
  const boats = useMemo(
    () =>
      (look ? look.split(';') : []).map((part, index) => {
        const [x, tier] = part.split(',').map(Number);
        return { x, tier: tier as BoatTier, phase: index * 1.9 };
      }),
    [look],
  );
  return boats.map((boat) => <Boat key={boat.x} {...boat} clock={clock} />);
});

const Boat = memo(function Boat({ x, tier, phase, clock }: { x: number; tier: BoatTier; phase: number; clock: SharedValue<number> }) {
  const ox = ORIGIN.x;
  const oy = ORIGIN.y;
  const hw = TILE_HW;
  const hh = TILE_HH;
  const middle = RIVER_ROWS / 2;
  const transform = useDerivedValue(() => {
    const t = clock.get();
    // Up and down the river in front of the hut, and in towards the wall and out again, slowly.
    const bx = x + 0.5 + Math.sin(t * 0.06 + phase) * (0.8 + tier * 0.55);
    const by = middle - 0.3 + Math.sin(t * 0.045 + phase * 1.7) * (0.7 + tier * 0.25);
    const bob = Math.sin(t * 1.6 + phase) * 0.6;
    return [{ translateX: ox + (bx - by) * hw }, { translateY: oy + (bx + by) * hh + bob }];
  });
  return (
    <Group transform={transform}>
      <BoatArt tier={tier} />
    </Group>
  );
});

// Tile offsets along the river (u) and across it (v) to screen offsets, raised `z` pixels.
const at = (u: number, v: number, z = 0) => ({ x: (u - v) * TILE_HW, y: (u + v) * TILE_HH - z });
const hull = (scale: number, z = 0) =>
  poly([[-0.75, 0], [-0.55, -0.22], [0.55, -0.22], [0.75, 0], [0.55, 0.22], [-0.55, 0.22]].map(([u, v]) => at(u * scale, v * scale, z)));

type Shape = {
  hull: ReturnType<typeof parseSvg>;
  inside: ReturnType<typeof parseSvg>;
  sails: { path: ReturnType<typeof parseSvg>; color: string }[];
  masts: { a: { x: number; y: number }; b: { x: number; y: number } }[];
  crew: { x: number; y: number }[];
  net: { x: number; y: number }[];
  rod: { a: { x: number; y: number }; b: { x: number; y: number } } | null;
};

// Each boat's shape, worked out once.
const SIZE: Record<BoatTier, number> = { 1: 0.55, 2: 0.72, 3: 0.92, 4: 1.12 };
const shapes = new Map<BoatTier, Shape>();
function shapeOf(tier: BoatTier): Shape {
  const known = shapes.get(tier);
  if (known) return known;
  const s = SIZE[tier];
  const sail = (u: number, low: number, high: number, reach: number) => {
    const foot = at(u, 0, low);
    return poly([at(u, 0, high), foot, { x: foot.x + reach, y: foot.y - 2 }]);
  };
  const masts: Shape['masts'] = [];
  const sails: Shape['sails'] = [];
  if (tier === 2) {
    masts.push({ a: at(0.1, 0, 2), b: at(0.1, 0, 16) });
    sails.push({ path: parseSvg(sail(0.1, 4, 15, 8)), color: '#ece4cc' });
  } else if (tier === 3) {
    masts.push({ a: at(0.15, 0, 3), b: at(0.15, 0, 21) });
    sails.push({ path: parseSvg(poly([at(0.15, 0, 20), at(0.15, 0, 6), { x: at(0.15, 0, 6).x + 11, y: at(0.15, 0, 6).y - 1 }, { x: at(0.15, 0, 17).x + 7, y: at(0.15, 0, 17).y }])), color: '#a5482e' });
  } else if (tier === 4) {
    masts.push({ a: at(0.3, 0, 3), b: at(0.3, 0, 25) }, { a: at(-0.4, 0, 3), b: at(-0.4, 0, 18) });
    sails.push({ path: parseSvg(sail(0.3, 6, 24, 12)), color: '#ece4cc' }, { path: parseSvg(sail(-0.4, 5, 17, 9)), color: '#dcd2b4' });
  }
  const crew = tier === 1 ? [at(-0.1, 0, 2)] : tier === 4 ? [at(-0.6, 0.05, 3), at(0.6, -0.05, 3)] : [at(-0.35 * s * 1.6, 0, 3)];
  // The smack and the ketch trail a net astern: floats on the water behind them.
  const net = tier >= 3 ? Array.from({ length: 5 }, (_, i) => at(-0.75 * s - 0.18 - i * 0.12, (i % 2 === 0 ? 0.08 : -0.08), 0)) : [];
  const shape: Shape = {
    hull: parseSvg(hull(s)),
    inside: parseSvg(hull(s * 0.85, 2)),
    sails,
    masts,
    crew,
    net,
    rod: tier === 1 ? { a: at(-0.1, 0, 7), b: at(0.55, 0, 13) } : null,
  };
  shapes.set(tier, shape);
  return shape;
}

const BoatArt = memo(function BoatArt({ tier }: { tier: BoatTier }) {
  const shape = shapeOf(tier);
  return (
    <Group>
      {shape.net.map((float, index) => <Circle key={index} cx={float.x} cy={float.y} r={0.9} color="#d9c27a" />)}
      <Path path={shape.hull} color="#5a3b22" />
      <Path path={shape.inside} color="#8a6a42" />
      {shape.crew.map((man, index) => (
        <Group key={index}>
          <Rect x={man.x - 1.2} y={man.y - 3.6} width={2.4} height={3.6} color="#5d6e3a" />
          <Circle cx={man.x} cy={man.y - 4.6} r={1.1} color="#e0b48a" />
        </Group>
      ))}
      {shape.rod && (
        <>
          <Line p1={vec(shape.rod.a.x, shape.rod.a.y)} p2={vec(shape.rod.b.x, shape.rod.b.y)} strokeWidth={0.6} color="#6e4a2f" />
          <Line p1={vec(shape.rod.b.x, shape.rod.b.y)} p2={vec(shape.rod.b.x + 1, shape.rod.b.y + 13)} strokeWidth={0.3} color="#e8e4d8" />
        </>
      )}
      {shape.masts.map((mast, index) => (
        <Line key={index} p1={vec(mast.a.x, mast.a.y)} p2={vec(mast.b.x, mast.b.y)} strokeWidth={1.1} color="#3a2a1c" />
      ))}
      {shape.sails.map((sail, index) => <Path key={index} path={sail.path} color={sail.color} />)}
    </Group>
  );
});

