// The curtain wall, its towers and the gatehouse.
import { Group, Rect } from '@shopify/react-native-skia';
import { WALL_TILES, iso, type Plot } from '../GameSceneLayout';
import { BANNER, Box, Crenels, Cylinder, DARK, Flag, GOLD, Hip, LeftFace, MATS, fortMat } from './shapes';
import { Peasant } from './peasants';

// Which way the wall runs through a tile (along x, along y, or both at a corner).
const WALL_SET = new Set(WALL_TILES.map(([x, y]) => `${String(x)},${String(y)}`));
const wallRuns = (x: number, y: number) => ({
  alongX: WALL_SET.has(`${String(x - 1)},${String(y)}`) || WALL_SET.has(`${String(x + 1)},${String(y)}`),
  alongY: WALL_SET.has(`${String(x)},${String(y - 1)}`) || WALL_SET.has(`${String(x)},${String(y + 1)}`),
});

// One tile of the wall: a palisade of sharpened logs at first, then a continuous stone curtain wall with a
// walkway and battlements on both faces.
export function WallSegment({ x, y, tier }: { x: number; y: number; tier: number }) {
  const { alongX, alongY } = wallRuns(x, y);
  if (tier === 1) {
    const logs: [number, number][] = [];
    if (alongX || !alongY) for (const u of [0.05, 0.3, 0.55, 0.8]) logs.push([x + u, y + 0.4]);
    if (alongY) for (const v of [0.05, 0.3, 0.55, 0.8]) logs.push([x + 0.4, y + v]);
    return (
      <Group>
        {logs.map(([lx, ly]) => (
          <Group key={`${String(lx)},${String(ly)}`}>
            <Box x={lx} y={ly} w={0.2} d={0.2} h={14} m={MATS[0]} outline={false} />
            <Hip x={lx} y={ly} w={0.2} d={0.2} z={14} rise={4} m={{ ...MATS[0], kind: undefined }} />
          </Group>
        ))}
      </Group>
    );
  }
  const m = fortMat(tier);
  const h = 12 + 5 * tier;
  const size = 0.22;
  const merlons: [number, number][] = [];
  for (const u of [0.1, 0.6]) {
    if (alongX || !alongY) merlons.push([x + u, y], [x + u, y + 1 - size]);
    if (alongY) merlons.push([x, y + u], [x + 1 - size, y + u]);
  }
  return (
    <Group>
      <Box x={x} y={y} w={1} d={1} h={h} m={m} outline={false} />
      {merlons
        .sort((a, b) => a[0] + a[1] - b[0] - b[1])
        .map(([mx, my]) => <Box key={`${String(mx)},${String(my)}`} x={mx} y={my} w={size} d={size} h={4} z={h} m={m} />)}
      {tier === 4 && (x + y) % 5 === 0 && <LeftFace x={x} yFront={y + 1} u0={0.35} u1={0.6} v0={h - 14} v1={h - 2} color={BANNER} />}
    </Group>
  );
}

// A tower on the wall: a timber watchtower at first, then a round stone tower with battlements (taller and
// wider as it grows), an archer on top.
export function Tower({ x, y, tier }: { x: number; y: number; tier: number }) {
  const m = fortMat(tier);
  const h = 30 + 9 * tier;
  if (tier === 1) {
    const top = iso(x + 0.5, y + 0.5, h - 2);
    return (
      <Group>
        {[[0, 0.8], [0.8, 0.8], [0.8, 0]].map(([dx, dy]) => <Box key={`${String(dx)}${String(dy)}`} x={x + dx} y={y + dy} w={0.18} d={0.18} h={h - 10} m={m} />)}
        <Box x={x - 0.05} y={y - 0.05} w={1.1} d={1.1} h={8} z={h - 10} m={m} />
        <Peasant x={top.x} y={top.y} tunic="#3f5f9a" />
        <Hip x={x - 0.05} y={y - 0.05} w={1.1} d={1.1} z={h - 2} rise={12} m={m} />
      </Group>
    );
  }
  const r = 0.62 + 0.06 * tier;
  const top = iso(x + 0.5, y + 0.5, h);
  const slit = iso(x + 0.5, y + 0.5 + r, h - 14);
  return (
    <Group>
      <Cylinder cx={x + 0.5} cy={y + 0.5} r={r} h={h} m={m} />
      <Rect x={slit.x - 0.8} y={slit.y - 4} width={1.6} height={7} color={DARK} />
      <Peasant x={top.x} y={top.y} tunic="#3f5f9a" />
      {tier === 4 && <Flag x={x + 0.5} y={y + 0.5} z={h + 4} color={GOLD} />}
    </Group>
  );
}

// The gate: a timber gate between two posts at first, then a stone gatehouse — two round towers flanking
// an arched gateway with a portcullis, battlements on the bridge between them.
export function Gatehouse({ tier, plot }: { tier: number; plot: Plot }) {
  const m = fortMat(tier);
  const { x, y } = plot;
  if (tier === 1) {
    return (
      <Group>
        <Box x={x + 0.3} y={y + 0.2} w={0.35} d={0.6} h={26} m={m} />
        <Box x={x + 2.35} y={y + 0.2} w={0.35} d={0.6} h={26} m={m} />
        <Box x={x + 0.3} y={y + 0.2} w={2.4} d={0.6} h={5} z={22} m={m} />
        <LeftFace x={x + 0.65} yFront={y + 0.8} u0={0} u1={0.82} v0={0} v1={20} color={m.right} />
        <LeftFace x={x + 0.65} yFront={y + 0.8} u0={0.88} u1={1.7} v0={0} v1={20} color={m.left} />
      </Group>
    );
  }
  const h = 30 + 7 * tier;
  const bridge = h - 6;
  return (
    <Group>
      <Cylinder cx={x + 0.5} cy={y + 0.5} r={0.68} h={h} m={m} />
      <Box x={x + 0.9} y={y + 0.1} w={1.2} d={0.8} h={bridge} m={m} />
      <Crenels x={x + 0.9} y={y + 0.1} w={1.2} d={0.8} z={bridge} m={m} />
      <LeftFace x={x + 0.9} yFront={y + 0.9} u0={0.2} u1={1.0} v0={0} v1={20} color={DARK} />
      {[0.32, 0.5, 0.68, 0.86].map((u) => <LeftFace key={u} x={x + 0.9} yFront={y + 0.9} u0={u} u1={u + 0.04} v0={8} v1={20} color={tier === 4 ? GOLD : '#8a8477'} />)}
      <LeftFace x={x + 0.9} yFront={y + 0.9} u0={0.2} u1={1.0} v0={12} v1={13} color={tier === 4 ? GOLD : '#8a8477'} />
      <Cylinder cx={x + 2.5} cy={y + 0.5} r={0.68} h={h} m={m} />
      {tier >= 3 && <Flag x={x + 0.5} y={y + 0.5} z={h + 4} color={tier === 4 ? GOLD : BANNER} />}
      {tier >= 3 && <Flag x={x + 2.5} y={y + 0.5} z={h + 4} color={tier === 4 ? GOLD : BANNER} />}
    </Group>
  );
}
