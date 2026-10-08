// Each building's look: it fills its footprint (w × d tiles) and changes look every five levels. And the
// odd bits of the still image: the campfire, the mine headframe, scaffolding, the army on parade.
import { memo } from 'react';
import { Circle, Group, Line, Path, Rect, vec } from '@shopify/react-native-skia';
import type { BuildingId } from '../../game/buildings';
import { ARMY_UNITS } from '../../game/units';
import { CAMPFIRE, MINE_PLOT, PARADE, iso, type Plot } from '../GameSceneLayout';
import { spritePixels } from '../unitSprites';
import { svgPath } from '../skiaPaths';
import {
  BANNER,
  Box,
  Crenels,
  Cylinder,
  DARK,
  Flag,
  GLOW,
  GOLD,
  Gable,
  Hip,
  LeftFace,
  MARBLE,
  MATS,
  RightFace,
  STONE,
  fortMat,
  matOf,
  poly,
} from './shapes';

export function BuildingArt({ id, plot, tier, level }: { id: BuildingId; plot: Plot; tier: number; level: number }) {
  const m = matOf(tier);
  const { x, y, w, d } = plot;
  switch (id) {
    case 'keep': {
      // The keep, Stronghold-style: a timber keep (a tall wooden tower with an overhanging fighting
      // platform and a thatched roof) at first; then a square stone keep with corner turrets; then a
      // fortress keep with round corner towers and a central tower; dressed stone and gold at the last tier.
      if (tier === 1) {
        const h = 40;
        const door = iso(x + 2.5, y + 3.7, 0);
        return (
          <Group>
            {[[1.0, 1.0], [3.7, 1.0], [1.0, 3.7], [3.7, 3.7]].map(([px, py]) => (
              <Box key={`${String(px)}${String(py)}`} x={x + px} y={y + py} w={0.3} d={0.3} h={h} m={m} />
            ))}
            <Box x={x + 1.4} y={y + 1.4} w={2.2} d={2.2} h={h - 6} m={m} />
            <Box x={x + 0.9} y={y + 0.9} w={3.2} d={3.2} h={6} z={h - 6} m={m} />
            <Crenels x={x + 0.9} y={y + 0.9} w={3.2} d={3.2} z={h} m={m} />
            <Hip x={x + 1.5} y={y + 1.5} w={2.0} d={2.0} z={h} rise={22} m={m} />
            <LeftFace x={x + 1.4} yFront={y + 3.6} u0={0.8} u1={1.4} v0={0} v1={12} color={DARK} />
            <Rect x={door.x - 6} y={door.y - 1} width={12} height={2} color="#6e4a2f" />
            <Flag x={x + 2.5} y={y + 2.5} z={h + 22} />
          </Group>
        );
      }
      const keepMat = fortMat(tier);
      const h = 40 + 9 * tier;
      const bx = x + 0.8;
      const by = y + 0.8;
      const bw = w - 1.6;
      const bd = d - 1.6;
      const slits = [0.6, 1.3, 2.1, 2.8].map((u) => <LeftFace key={u} x={bx} yFront={by + bd} u0={u} u1={u + 0.12} v0={h - 20} v1={h - 10} color={DARK} />);
      const rightSlits = [0.6, 1.5, 2.6].map((u) => <RightFace key={u} xFront={bx + bw} y={by} u0={u} u1={u + 0.12} v0={h - 20} v1={h - 10} color={DARK} />);
      if (tier === 2) {
        // A square stone keep with two corner turrets at the front.
        return (
          <Group>
            <Box x={bx} y={by} w={bw} d={bd} h={h} m={keepMat} />
            <Crenels x={bx} y={by} w={bw} d={bd} z={h} m={keepMat} />
            {slits}
            {rightSlits}
            <LeftFace x={bx} yFront={by + bd} u0={bw / 2 - 0.45} u1={bw / 2 + 0.45} v0={0} v1={16} color={DARK} />
            {[[bx + bw - 0.6, by - 0.3], [bx - 0.3, by + bd - 0.6], [bx + bw - 0.6, by + bd - 0.6]].map(([tx, ty]) => (
              <Group key={`${String(tx)}${String(ty)}`}>
                <Box x={tx} y={ty} w={0.9} d={0.9} h={h + 10} m={keepMat} />
                <Crenels x={tx} y={ty} w={0.9} d={0.9} z={h + 10} m={keepMat} />
              </Group>
            ))}
            <Flag x={bx + bw / 2} y={by + bd / 2} z={h + 4} />
          </Group>
        );
      }
      // A fortress keep: round towers at the four corners, a central tower rising above the walls.
      const corner = (cx: number, cy: number) => <Cylinder key={`${String(cx)},${String(cy)}`} cx={cx} cy={cy} r={0.75} h={h + 12} m={keepMat} />;
      return (
        <Group>
          {corner(bx, by)}
          <Box x={bx} y={by} w={bw} d={bd} h={h} m={keepMat} />
          <Crenels x={bx} y={by} w={bw} d={bd} z={h} m={keepMat} />
          {slits}
          {rightSlits}
          <LeftFace x={bx} yFront={by + bd} u0={bw / 2 - 0.5} u1={bw / 2 + 0.5} v0={0} v1={18} color={DARK} />
          <Box x={bx + bw / 2 - 0.85} y={by + bd / 2 - 0.85} w={1.7} d={1.7} h={26} z={h} m={keepMat} />
          <Crenels x={bx + bw / 2 - 0.85} y={by + bd / 2 - 0.85} w={1.7} d={1.7} z={h + 26} m={keepMat} />
          {tier === 4 && (
            <Group>
              <LeftFace x={bx} yFront={by + bd} u0={0} u1={bw} v0={h - 4} v1={h - 2.5} color={GOLD} />
              {[0.35, bw - 0.65].map((u) => <LeftFace key={u} x={bx} yFront={by + bd} u0={u} u1={u + 0.3} v0={h - 26} v1={h - 6} color={BANNER} />)}
            </Group>
          )}
          {corner(bx + bw, by)}
          {corner(bx, by + bd)}
          {corner(bx + bw, by + bd)}
          <Flag x={bx + bw / 2} y={by + bd / 2} z={h + 30} color={tier === 4 ? GOLD : BANNER} />
        </Group>
      );
    }
    case 'houses': {
      // Cottages on the plot, one more every few levels, plaster and then stone as the houses grow.
      const count = Math.min(4, 1 + Math.floor(level / 4));
      const spots = count === 1 ? [[0.55, 0.55]] : [[0.1, 0.1], [1.05, 0.1], [0.1, 1.05], [1.05, 1.05]].slice(0, count);
      const hh = 8 + 2 * tier;
      return (
        <Group>
          {spots.map(([dx, dy], index) => {
            const hx = x + dx;
            const hy = y + dy;
            return (
              <Group key={index}>
                <Box x={hx} y={hy} w={0.85} d={0.8} h={hh} m={m} />
                <Gable x={hx - 0.05} y={hy - 0.05} w={0.95} d={0.9} z={hh} rise={7} m={m} along={index % 2 ? 'y' : 'x'} />
                <LeftFace x={hx} yFront={hy + 0.8} u0={0.3} u1={0.52} v0={0} v1={6} color={DARK} />
                {tier >= 2 && <Box x={hx + 0.6} y={hy + 0.2} w={0.14} d={0.14} h={6} z={hh + 2} m={STONE} />}
              </Group>
            );
          })}
        </Group>
      );
    }
    case 'warehouse': {
      // A shed (a barn from level 6) at the back; the stock piles in front are drawn live (see `Piles`).
      const barn = tier >= 2;
      const h = barn ? 12 + 3 * tier : 10;
      return (
        <Group>
          <Box x={x + 0.15} y={y + 0.15} w={barn ? w - 0.3 : 1.4} d={1.2} h={h} m={m} />
          <Gable x={x + 0.1} y={y + 0.1} w={barn ? w - 0.2 : 1.5} d={1.3} z={h} rise={9} m={m} />
          <LeftFace x={x + 0.15} yFront={y + 1.35} u0={0.35} u1={1.0} v0={0} v1={9} color={DARK} />
        </Group>
      );
    }
    case 'foundry': {
      const h = 16 + 3 * tier;
      const chimneys = Math.min(3, tier);
      const stack = h + 18 + 4 * tier;
      return (
        <Group>
          {Array.from({ length: chimneys }, (_, index) => (
            <Box key={index} x={x + 0.4 + index * 0.75} y={y + 0.25} w={0.35} d={0.35} h={stack} m={STONE} />
          ))}
          <Box x={x + 0.2} y={y + 0.75} w={w - 0.4} d={d - 0.95} h={h} m={m} />
          <Gable x={x + 0.15} y={y + 0.7} w={w - 0.3} d={d - 0.85} z={h} rise={9} m={m} along="y" />
          <LeftFace x={x + 0.2} yFront={y + d - 0.2} u0={1.0} u1={1.7} v0={0} v1={11} color="#3b2418" />
          <LeftFace x={x + 0.2} yFront={y + d - 0.2} u0={1.1} u1={1.6} v0={0} v1={8} color="#f08a3a" />
          {tier === 4 && <LeftFace x={x + 0.2} yFront={y + d - 0.2} u0={0} u1={w - 0.4} v0={h - 3} v1={h - 1.5} color={GOLD} />}
        </Group>
      );
    }
    case 'research': {
      const h = 14 + 3 * tier;
      const th = 30 + 6 * tier;
      const dome = iso(x + w - 0.55, y + 0.65, th + 2);
      return (
        <Group>
          {tier >= 2 && (
            <Group>
              <Box x={x + w - 1.0} y={y + 0.2} w={0.9} d={0.9} h={th} m={m} />
              <Circle cx={dome.x} cy={dome.y} r={8} color={tier === 4 ? GOLD : '#7f97a3'} />
              {tier >= 3 && <Line p1={vec(dome.x, dome.y - 3)} p2={vec(dome.x + 13, dome.y - 13)} color="#5a4a3a" strokeWidth={3} />}
            </Group>
          )}
          <Box x={x + 0.15} y={y + 1.0} w={w - 0.9} d={d - 1.2} h={h} m={m} />
          <Gable x={x + 0.1} y={y + 0.95} w={w - 0.8} d={d - 1.1} z={h} rise={9} m={m} />
          {[0.35, 0.85, 1.35].map((u) => <LeftFace key={u} x={x + 0.15} yFront={y + d - 0.2} u0={u} u1={u + 0.24} v0={h - 10} v1={h - 4} color="#9fd0e0" />)}
        </Group>
      );
    }
    case 'armory': {
      const h = 16 + 3 * tier;
      const emblem = iso(x + w / 2, y + d - 0.3, h / 2 + 2);
      return (
        <Group>
          <Box x={x + 0.3} y={y + 0.3} w={w - 0.6} d={d - 0.6} h={h} m={m} />
          {tier >= 2 ? <Crenels x={x + 0.3} y={y + 0.3} w={w - 0.6} d={d - 0.6} z={h} m={m} /> : <Hip x={x + 0.25} y={y + 0.25} w={w - 0.5} d={d - 0.5} z={h} rise={14} m={m} />}
          <Circle cx={emblem.x} cy={emblem.y} r={5} color={tier === 4 ? GOLD : BANNER} />
          <LeftFace x={x + 0.3} yFront={y + d - 0.3} u0={1.6} u1={2.1} v0={0} v1={10} color={DARK} />
        </Group>
      );
    }
    case 'barracks': {
      const h = 14 + 3 * tier;
      return (
        <Group>
          <Box x={x + 0.2} y={y + 0.2} w={w - 0.4} d={d - 0.4} h={h} m={m} />
          <Gable x={x + 0.15} y={y + 0.15} w={w - 0.3} d={d - 0.3} z={h} rise={10} m={m} along="y" />
          <RightFace xFront={x + w - 0.2} y={y + 0.2} u0={1.1} u1={1.7} v0={0} v1={9} color={DARK} />
          {tier >= 2 && [0.3, 2.0].map((u) => <RightFace key={u} xFront={x + w - 0.2} y={y + 0.2} u0={u} u1={u + 0.3} v0={h - 12} v1={h - 2} color={tier === 4 ? GOLD : BANNER} />)}
        </Group>
      );
    }
    case 'guardhouse': {
      const h = 13 + 3 * tier;
      return (
        <Group>
          <Box x={x + 0.15} y={y + 0.5} w={1.3} d={1.3} h={h} m={m} />
          {tier >= 2 ? <Crenels x={x + 0.15} y={y + 0.5} w={1.3} d={1.3} z={h} m={m} /> : <Gable x={x + 0.1} y={y + 0.45} w={1.4} d={1.4} z={h} rise={7} m={m} />}
          <LeftFace x={x + 0.15} yFront={y + 1.8} u0={0.45} u1={0.85} v0={0} v1={8} color={DARK} />
          {/* A rack of pikes */}
          {Array.from({ length: tier + 2 }, (_, index) => {
            const p = iso(x + 1.7, y + 0.4 + index * 0.22);
            return <Line key={index} p1={vec(p.x, p.y)} p2={vec(p.x + 1, p.y - 26)} color="#8c6a3c" strokeWidth={1.2} />;
          })}
        </Group>
      );
    }
    case 'sanctum': {
      const h = 22 + 4 * tier;
      const columns = 2 + tier;
      const portal = iso(x + w / 2, y + d / 2, h / 2 + 3);
      const stone = tier >= 2 ? MARBLE : m;
      const span = w - 0.5;
      return (
        <Group>
          <Box x={x + 0.1} y={y + 0.1} w={w - 0.2} d={d - 0.2} h={3} m={stone} />
          <Circle cx={portal.x} cy={portal.y} r={h / 3} color="#9fd0f0" opacity={0.85} />
          <Circle cx={portal.x} cy={portal.y} r={h / 6} color="#ffffff" />
          {Array.from({ length: columns }, (_, index) => (
            <Box key={`f${String(index)}`} x={x + 0.2 + (index * span) / (columns - 1)} y={y + d - 0.45} w={0.22} d={0.22} h={h} z={3} m={stone} />
          ))}
          {Array.from({ length: columns - 1 }, (_, index) => (
            <Box key={`r${String(index)}`} x={x + w - 0.45} y={y + 0.2 + (index * span) / (columns - 1)} w={0.22} d={0.22} h={h} z={3} m={stone} />
          ))}
          <Box x={x + 0.1} y={y + 0.1} w={w - 0.2} d={d - 0.2} h={3} z={h + 3} m={stone} />
          <Hip x={x + 0.1} y={y + 0.1} w={w - 0.2} d={d - 0.2} z={h + 6} rise={tier >= 3 ? 16 : 9} m={tier === 4 ? MARBLE : { ...stone, roof: stone.top, roofDark: stone.right }} />
        </Group>
      );
    }
    case 'chapel': {
      const h = 18 + 3 * tier;
      const sh = 34 + 6 * tier;
      const sun = iso(x + w - 0.55, y + d - 0.55, sh + 24);
      const rose = iso(x + 1.05, y + d - 0.2, h - 6);
      return (
        <Group>
          <Box x={x + 0.2} y={y + 0.2} w={1.7} d={d - 0.4} h={h} m={m} />
          <Gable x={x + 0.15} y={y + 0.15} w={1.8} d={d - 0.3} z={h} rise={15} m={m} along="y" />
          <Circle cx={rose.x} cy={rose.y} r={4} color="#7fa8d0" />
          <Box x={x + w - 0.9} y={y + d - 0.9} w={0.7} d={0.7} h={sh} m={m} />
          <Hip x={x + w - 0.95} y={y + d - 0.95} w={0.8} d={0.8} z={sh} rise={22} m={m} />
          <Circle cx={sun.x} cy={sun.y} r={3} color={GOLD} />
          <LeftFace x={x + 0.2} yFront={y + d - 0.2} u0={0.6} u1={1.1} v0={0} v1={10} color={DARK} />
        </Group>
      );
    }
    case 'griffinEyrie': {
      const h = 40 + 9 * tier;
      const nest = iso(x + w / 2, y + d / 2, h + 2);
      return (
        <Group>
          {tier >= 3 ? (
            <Group>
              <Box x={x + 0.5} y={y + 0.5} w={1} d={1} h={h} m={m} />
              <Crenels x={x + 0.5} y={y + 0.5} w={1} d={1} z={h} m={m} />
            </Group>
          ) : (
            <Hip x={x + 0.2} y={y + 0.2} w={w - 0.4} d={d - 0.4} z={0} rise={h} m={{ ...STONE, roof: '#9c9a8c', roofDark: '#7f7d71' }} />
          )}
          <Rect x={nest.x - 8} y={nest.y - 3} width={16} height={4} color="#7a5232" />
          <Rect x={nest.x - 3} y={nest.y - 9} width={8} height={6} color="#c9a34a" />
          <Path path={svgPath(poly([{ x: nest.x - 2, y: nest.y - 8 }, { x: nest.x - 13, y: nest.y - 17 }, { x: nest.x - 5, y: nest.y - 6 }]))} color="#ece6d4" />
          <Path path={svgPath(poly([{ x: nest.x + 3, y: nest.y - 8 }, { x: nest.x + 13, y: nest.y - 18 }, { x: nest.x + 7, y: nest.y - 6 }]))} color="#ece6d4" />
          <Rect x={nest.x + 4} y={nest.y - 12} width={4} height={4} color="#ece6d4" />
          {tier === 4 && <Flag x={x + w / 2} y={y + d / 2} z={h + 2} color={GOLD} />}
        </Group>
      );
    }
    case 'monastery': {
      const h = 14 + 3 * tier;
      const bh = 28 + 5 * tier;
      const bell = iso(x + w - 0.55, y + 0.55, bh - 5);
      return (
        <Group>
          <Box x={x + w - 0.9} y={y + 0.2} w={0.7} d={0.7} h={bh} m={m} />
          <Hip x={x + w - 0.95} y={y + 0.15} w={0.8} d={0.8} z={bh} rise={13} m={m} />
          <Circle cx={bell.x} cy={bell.y} r={2.5} color={GOLD} />
          <Box x={x + 0.15} y={y + 1.0} w={w - 0.3} d={d - 1.2} h={h} m={m} />
          <Gable x={x + 0.1} y={y + 0.95} w={w - 0.2} d={d - 1.1} z={h} rise={9} m={m} />
          {[0.4, 0.95, 1.5, 2.05].map((u) => <LeftFace key={u} x={x + 0.15} yFront={y + d - 0.2} u0={u} u1={u + 0.22} v0={h - 9} v1={h - 3} color={GLOW} />)}
        </Group>
      );
    }
    case 'archery': {
      const targets = Math.min(4, 1 + tier);
      return (
        <Group>
          <Box x={x + 0.15} y={y + 0.15} w={1.1} d={1.1} h={10 + 2 * tier} m={m} />
          <Gable x={x + 0.1} y={y + 0.1} w={1.2} d={1.2} z={10 + 2 * tier} rise={6} m={m} />
          {Array.from({ length: targets }, (_, index) => {
            const t = iso(x + w - 0.45, y + 0.5 + index * ((d - 0.8) / Math.max(1, targets - 1)), 8);
            return (
              <Group key={index}>
                <Rect x={t.x - 0.75} y={t.y} width={1.5} height={8} color="#8c6a3c" />
                <Circle cx={t.x} cy={t.y} r={4.5} color="#ece6d4" />
                <Circle cx={t.x} cy={t.y} r={3} color={BANNER} />
                <Circle cx={t.x} cy={t.y} r={1.2} color="#ece6d4" />
              </Group>
            );
          })}
        </Group>
      );
    }
    case 'stables': {
      const h = 12 + 3 * tier;
      const fence = [iso(x + 0.1, y + 1.5), iso(x + w - 0.1, y + 1.5), iso(x + w - 0.1, y + d - 0.1), iso(x + 0.1, y + d - 0.1)];
      return (
        <Group>
          <Box x={x + 0.1} y={y + 0.1} w={w - 0.2} d={1.2} h={h} m={m} />
          <Gable x={x + 0.05} y={y + 0.05} w={w - 0.1} d={1.3} z={h} rise={8} m={m} />
          {[0.4, 1.3, 2.2, 3.0].map((u) => <LeftFace key={u} x={x + 0.1} yFront={y + 1.3} u0={u} u1={u + 0.5} v0={0} v1={8} color={DARK} />)}
          <Path path={svgPath(poly(fence))} style="stroke" strokeWidth={1.5} color="#8c6a3c" />
          {Array.from({ length: Math.min(4, tier + 1) }, (_, index) => {
            const p = iso(x + 0.8 + (index % 2) * 1.6, y + 2.0 + Math.floor(index / 2) * 0.6);
            const coat = index % 2 ? '#5a3a24' : '#7a5232';
            return (
              <Group key={index}>
                <Rect x={p.x - 5} y={p.y - 6} width={9} height={4} color={coat} />
                <Rect x={p.x + 3} y={p.y - 9} width={3} height={4} color={coat} />
                <Rect x={p.x - 4} y={p.y - 2} width={1.3} height={2.5} color="#3a2a1c" />
                <Rect x={p.x + 2} y={p.y - 2} width={1.3} height={2.5} color="#3a2a1c" />
              </Group>
            );
          })}
        </Group>
      );
    }
    case 'docks': {
      // A stone quay at the back of the harbour, a shed for the goods, and a crane that
      // swings out over the water to load the barge.
      // The barge ties up in the middle, so the shed stands at one end and the crane at the other.
      const h = 6 + 2 * tier;
      const shed = h + 10 + 2 * tier;
      const post = iso(x + 2.55, y + 0.45, h + 26);
      const arm = iso(x + 1.7, y - 0.5, h + 23);
      const hook = iso(x + 1.7, y - 0.5, h + 8);
      return (
        <Group>
          <Box x={x} y={y + 0.05} w={w} d={d - 0.1} h={h} m={STONE} />
          <Box x={x + 0.15} y={y + 0.15} w={1.1} d={0.7} h={shed} m={m} />
          <Gable x={x + 0.1} y={y + 0.1} w={1.2} d={0.8} z={shed} rise={7} m={m} />
          <Box x={x + 2.46} y={y + 0.36} w={0.18} d={0.18} h={h + 26} m={MATS[0]} />
          <Line p1={vec(post.x, post.y)} p2={vec(arm.x, arm.y)} strokeWidth={2} color="#6e4a2f" />
          <Line p1={vec(arm.x, arm.y)} p2={vec(hook.x, hook.y)} strokeWidth={0.8} color="#3a2a1c" />
          {tier >= 3 && <Flag x={x + 0.7} y={y + 0.5} z={shed + 7} color="#3f6f8a" />}
        </Group>
      );
    }
    case 'depot': {
      // A long open cart shed: three bays under one roof, and two carts parked in front.
      const h = 10 + 2 * tier;
      const sd = d - 0.75;
      return (
        <Group>
          <Box x={x + 0.1} y={y + 0.1} w={w - 0.2} d={sd} h={h} m={m} />
          <Gable x={x + 0.05} y={y + 0.05} w={w - 0.1} d={sd + 0.1} z={h} rise={8} m={m} />
          {[0.2, 1.1, 2.0].map((u) => (
            <LeftFace key={u} x={x + 0.1} yFront={y + 0.1 + sd} u0={u} u1={u + 0.6} v0={0} v1={h - 3} color={DARK} />
          ))}
          {[0.75, 2.05].map((u) => {
            const at = iso(x + u, y + d - 0.3);
            return (
              <Group key={u} transform={[{ translateX: at.x }, { translateY: at.y }]}>
                <CartArt load={null} />
              </Group>
            );
          })}
        </Group>
      );
    }
    case 'forge1':
    case 'forge2':
    case 'forge3':
    case 'forge4':
    case 'forge5':
    case 'forge6':
    case 'forge7':
    case 'forge8': {
      // A small smithy: an open-fronted shed, a chimney stack, the forge's glow in the doorway and an
      // anvil on the ground in front.
      const h = 10 + 2 * tier;
      const anvil = iso(x + 0.45, y + d - 0.15);
      return (
        <Group>
          <Box x={x + 0.15} y={y + 0.15} w={w - 0.5} d={d - 0.45} h={h} m={m} />
          <Gable x={x + 0.1} y={y + 0.1} w={w - 0.4} d={d - 0.35} z={h} rise={7} m={m} along="y" />
          <Box x={x + w - 0.75} y={y + 0.2} w={0.4} d={0.4} h={h + 12 + 2 * tier} m={STONE} />
          <LeftFace x={x + 0.15} yFront={y + d - 0.3} u0={0.3} u1={0.85} v0={0} v1={7} color="#3b2418" />
          <LeftFace x={x + 0.15} yFront={y + d - 0.3} u0={0.38} u1={0.77} v0={0} v1={4.5} color="#f08a3a" />
          <Rect x={anvil.x - 3} y={anvil.y - 4} width={6} height={2} color="#3d4148" />
          <Rect x={anvil.x - 1.2} y={anvil.y - 2} width={2.4} height={2} color="#2a2d33" />
        </Group>
      );
    }
    case 'balloonWorks': {
      const h = 12 + 3 * tier;
      return (
        <Group>
          <Box x={x + 0.2} y={y + 0.6} w={w - 0.4} d={d - 0.8} h={h} m={m} />
          <Gable x={x + 0.15} y={y + 0.55} w={w - 0.3} d={d - 0.7} z={h} rise={9} m={m} />
          <LeftFace x={x + 0.2} yFront={y + d - 0.2} u0={0.8} u1={1.8} v0={0} v1={11} color={DARK} />
        </Group>
      );
    }
    default:
      return null;
  }
}

export const WHEEL = iso(MINE_PLOT.x + MINE_PLOT.w / 2, MINE_PLOT.y + MINE_PLOT.d / 2, 56);

// A small two-wheeled cart drawn at the origin, with a carter at the shaft; `load`: the colour of the goods heaped on it.
export const CartArt = memo(function CartArt({ load }: { load: string | null }) {
  if (load) return <Rect x={-4.5} y={-9} width={9} height={3} color={load} />;
  return (
    <Group>
      <Rect x={-5.5} y={-6.5} width={11} height={4} color="#7a5232" />
      <Rect x={-5.5} y={-6.5} width={11} height={1.2} color="#a5774c" />
      <Circle cx={-3} cy={-2} r={2} color="#3a2a1c" />
      <Circle cx={3} cy={-2} r={2} color="#3a2a1c" />
      <Rect x={5.5} y={-5} width={4} height={1} color="#6e4a2f" />
      <Rect x={9} y={-9} width={2.2} height={6} color="#5d6e3a" />
      <Rect x={9.2} y={-11.2} width={1.8} height={2} color="#e0b48a" />
    </Group>
  );
});

// The campfire's ring of stones and logs (the flame is live).
export function Campfire() {
  const c = iso(CAMPFIRE.x, CAMPFIRE.y);
  return (
    <Group>
      {Array.from({ length: 8 }, (_, index) => {
        const a = (index / 8) * Math.PI * 2;
        return <Circle key={index} cx={c.x + Math.cos(a) * 7} cy={c.y + Math.sin(a) * 3.5} r={1.6} color="#8e8f84" />;
      })}
      <Rect x={c.x - 5} y={c.y - 1} width={10} height={2} color="#5e4630" />
    </Group>
  );
}

// The mine headframe (its wheel is live).
export function Headframe() {
  const { x, y, w, d } = MINE_PLOT;
  const cx = x + w / 2;
  const cy = y + d / 2;
  const legs = [iso(cx - 1, cy), iso(cx + 1, cy), iso(cx, cy - 1), iso(cx, cy + 1)];
  const mouth = [iso(cx - 0.5, cy - 0.5), iso(cx + 0.5, cy - 0.5), iso(cx + 0.5, cy + 0.5), iso(cx - 0.5, cy + 0.5)];
  const ground = iso(cx, cy);
  return (
    <Group>
      <Path path={svgPath(poly(mouth))} color="#171d1b" />
      <Hip x={x + w - 0.9} y={y + d - 0.9} w={0.7} d={0.7} z={0} rise={7} m={{ ...STONE, roof: '#26262a', roofDark: '#1c1c1f' }} />
      {legs.map((leg, index) => <Line key={index} p1={vec(leg.x, leg.y)} p2={vec(WHEEL.x, WHEEL.y)} color="#805a3c" strokeWidth={3} />)}
      <Line p1={vec(WHEEL.x, WHEEL.y)} p2={vec(ground.x, ground.y)} color="#bd8d55" strokeWidth={1} />
    </Group>
  );
}

// Building sites: scaffolding round the plot (still) and a progress bar above it (live).
export function Scaffold({ plot }: { plot: Plot }) {
  const poles = [iso(plot.x, plot.y + plot.d), iso(plot.x + plot.w, plot.y + plot.d), iso(plot.x + plot.w, plot.y)];
  const rail = (h: number) => {
    const [a, b, c] = [iso(plot.x, plot.y + plot.d, h), iso(plot.x + plot.w, plot.y + plot.d, h), iso(plot.x + plot.w, plot.y, h)];
    return `M ${String(a.x)} ${String(a.y)} L ${String(b.x)} ${String(b.y)} L ${String(c.x)} ${String(c.y)}`;
  };
  return (
    <Group>
      {poles.map((pole, index) => <Rect key={index} x={pole.x - 1} y={pole.y - 30} width={2} height={30} color="#d7b273" />)}
      {[10, 22].map((h) => <Path key={h} path={rail(h)} style="stroke" strokeWidth={1.5} color="#d7b273" />)}
    </Group>
  );
}

// The army on parade inside the bailey: one row per kind of unit, more figures for bigger companies.
export function Parade({ figures: companies }: { figures: number[] }) {
  const rows = ARMY_UNITS.filter((_, index) => companies[index] > 0);
  const pixel = 1.05;
  return (
    <Group>
      {rows.map((unit, row) => {
        const figures = companies[ARMY_UNITS.indexOf(unit)];
        const pixels = spritePixels(unit);
        return Array.from({ length: figures }, (_, index) => {
          const p = iso(PARADE.x + index * 0.55 + (row % 2) * 0.25, PARADE.y + row * 0.42);
          return (
            <Group key={`${unit}-${String(index)}`}>
              {pixels.map((px, i) => (
                <Rect key={i} x={p.x - 6 * pixel + px.x * pixel} y={p.y - 12 * pixel + px.y * pixel} width={pixel + 0.2} height={pixel + 0.2} color={px.color} />
              ))}
            </Group>
          );
        });
      })}
    </Group>
  );
}
