// Each building's look: it fills its footprint (w × d tiles) and changes look every five levels. And the
// odd bits of the still image: the campfire, the mine headframe, scaffolding, the army on parade.
import { memo } from 'react';
import { Circle, Group, Line, Path, Rect, vec } from '@shopify/react-native-skia';
import type { BuildingId } from '../../game/buildings';
import { isHouse } from '../../game/houses';
import { ARMY_UNITS } from '../../game/units';
import { CAMPFIRE, MINE_PLOT, PARADE, TILE_HW, iso, type Plot } from '../GameSceneLayout';
import { SPRITE_SIZE, spriteRuns } from '../unitSprites';
import { FIGURE_PIXEL } from './ground';
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
  type Mat,
} from './shapes';

// Cut logs, end grain on top.
const LOGS: Mat = { left: '#8a5a2e', right: '#6b4422', top: '#c9955c', roof: '#8a5a2e', roofDark: '#553519' };

export function BuildingArt({ id, plot, tier, level }: { id: BuildingId; plot: Plot; tier: number; level: number }) {
  const m = matOf(tier);
  const { x, y, w, d } = plot;
  if (isHouse(id)) {
    // A one-tile cottage, unmistakably a home: a hearth chimney smoking-tall at every level, a door and
    // a lit window with shutters, and a picket fence along the front with a gate by the door and flowers
    // behind it. Plaster and thatch, then stone and tiles as it's raised; the ridge turned on every other
    // cottage, so a street of them varies.
    const hh = 7 + 2 * tier;
    const along = (x + y) % 2 ? 'y' : 'x';
    const fenceY = y + 0.95;
    const pickets = [0.06, 0.16, 0.44, 0.56, 0.68, 0.8, 0.92];
    const flowers = [[0.5, BANNER], [0.66, '#e2b84f'], [0.82, '#c86bb0']] as const;
    return (
      <Group>
        <Box x={x + 0.18} y={y + 0.2} w={0.64} d={0.6} h={hh} m={m} />
        <Gable x={x + 0.12} y={y + 0.14} w={0.76} d={0.72} z={hh} rise={6} m={m} along={along} />
        <Box x={x + 0.62} y={y + 0.26} w={0.13} d={0.13} h={7 + tier} z={hh + 1} m={STONE} />
        <LeftFace x={x + 0.18} yFront={y + 0.8} u0={0.2} u1={0.36} v0={0} v1={5.5} color={DARK} />
        <LeftFace x={x + 0.18} yFront={y + 0.8} u0={0.4} u1={0.44} v0={3} v1={6.8} color="#5b3d25" />
        <LeftFace x={x + 0.18} yFront={y + 0.8} u0={0.44} u1={0.58} v0={3} v1={6.8} color={GLOW} />
        <LeftFace x={x + 0.18} yFront={y + 0.8} u0={0.58} u1={0.62} v0={3} v1={6.8} color="#5b3d25" />
        <LeftFace x={x + 0.18} yFront={y + 0.8} u0={0.5} u1={0.52} v0={3} v1={6.8} color="#5b3d25" />
        {flowers.map(([u, color]) => {
          const at = iso(x + u, y + 0.88);
          return (
            <Group key={u}>
              <Rect x={at.x - 0.5} y={at.y - 3} width={1} height={3} color="#4f7a36" />
              <Circle cx={at.x} cy={at.y - 3.5} r={1.3} color={color} />
            </Group>
          );
        })}
        <LeftFace x={x} yFront={fenceY} u0={0.04} u1={0.18} v0={1.5} v1={2.1} color="#d7b273" />
        <LeftFace x={x} yFront={fenceY} u0={0.42} u1={0.95} v0={1.5} v1={2.1} color="#d7b273" />
        {pickets.map((u) => {
          const at = iso(x + u, fenceY);
          return <Rect key={u} x={at.x - 0.6} y={at.y - 3.2} width={1.2} height={3.2} color="#d7b273" />;
        })}
      </Group>
    );
  }
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
    case 'warehouse': {
      // A warehouse filling its plot: a long barn along the back with a loft door and a hoist beam in its
      // gable, a lower store in front of it with wide double doors, a lean-to at the side, and a loading
      // apron along the front stacked with crates, barrels and sacks; taller and in better stone with the
      // tiers. Tapping it draws it see-through, and the stockpile inside (see `Stockpile`, drawn live) shows.
      const h = 14 + 3 * tier;
      const back = Math.max(1.2, d * 0.44);
      const apron = 0.6;
      const front = d - back - 0.3 - apron;
      const lean = Math.max(0.8, w * 0.22);
      const doorY = y + d - 0.15 - apron;
      const mid = (w - 0.3 - lean) / 2;
      const beam = [iso(x + w - 0.15, y + 0.15 + back / 2, h + 5), iso(x + w + 0.3, y + 0.15 + back / 2, h + 5)];
      const sack = iso(x + w + 0.3, y + 0.15 + back / 2, h - 6);
      return (
        <Group>
          <Box x={x + 0.15} y={y + 0.15} w={w - 0.3} d={back} h={h} m={m} />
          <Gable x={x + 0.1} y={y + 0.1} w={w - 0.2} d={back + 0.1} z={h} rise={10 + tier} m={m} />
          <RightFace xFront={x + w - 0.15} y={y + 0.15} u0={back / 2 - 0.22} u1={back / 2 + 0.22} v0={h - 7} v1={h + 2} color={DARK} />
          <Line p1={vec(beam[0].x, beam[0].y)} p2={vec(beam[1].x, beam[1].y)} strokeWidth={2} color="#6e4a2f" />
          <Line p1={vec(beam[1].x, beam[1].y)} p2={vec(sack.x, sack.y)} strokeWidth={0.8} color="#3a2a1c" />
          <Circle cx={sack.x} cy={sack.y + 2} r={2.6} color="#d8c48a" />
          <Box x={x + 0.15} y={y + 0.15 + back} w={w - 0.3 - lean} d={front} h={h - 5} m={m} />
          <Gable x={x + 0.1} y={y + 0.1 + back} w={w - 0.2 - lean} d={front + 0.1} z={h - 5} rise={7} m={m} along="y" />
          <Box x={x + w - 0.15 - lean} y={y + 0.15 + back} w={lean} d={front} h={h - 9} m={m} />
          <LeftFace x={x + 0.15} yFront={doorY} u0={mid - 0.7} u1={mid + 0.7} v0={0} v1={h - 9} color={DARK} />
          <LeftFace x={x + 0.15} yFront={doorY} u0={mid - 0.05} u1={mid + 0.05} v0={0} v1={h - 9} color="#6e4a2f" />
          {tier >= 3 && <RightFace xFront={x + w - 0.15} y={y + 0.15} u0={back * 0.3} u1={back * 0.7} v0={h - 9} v1={h - 5} color={DARK} />}
          {/* The loading apron: a stone slab, crates stacked by the doors, barrels under the lean-to, sacks by the wall. */}
          <Box x={x + 0.15} y={doorY} w={w - 0.3} d={apron} h={0.8} m={STONE} outline={false} />
          {[0.35, 0.75].map((u) => <Box key={u} x={x + u} y={doorY + 0.12} w={0.34} d={0.34} h={5} m={LOGS} />)}
          <Box x={x + 0.55} y={doorY + 0.12} w={0.34} d={0.34} h={5} z={5} m={LOGS} />
          {[mid + 1.0, mid + 1.45].map((u) => <Box key={u} x={x + u} y={doorY + 0.16} w={0.3} d={0.3} h={4} m={LOGS} />)}
          {[0.25, 0.65].map((u) => <Cylinder key={u} cx={x + w - 0.15 - lean + u} cy={doorY + 0.3} r={0.15} h={6} m={{ ...LOGS, top: '#8a5a2e' }} merlons={false} />)}
          {[0.2, 0.45, 0.7].map((u) => {
            const at = iso(x + w - 0.15 - u, doorY + 0.5, 0.8);
            return <Circle key={u} cx={at.x} cy={at.y - 2} r={2.4} color="#d8c48a" />;
          })}
        </Group>
      );
    }
    case 'foundry': {
      // The foundry: a hall with tall smoking chimney stacks (the smoke is live), a wide furnace mouth
      // glowing in its front, an ore heap and a pile of fresh ingots beside the door.
      const h = 16 + 3 * tier;
      const chimneys = Math.min(3, tier);
      const stack = h + 18 + 4 * tier;
      const heap = { x: x + w - 1.0, y: y + d - 0.85 };
      const embers = [[0.25, 0.3], [0.5, 0.55], [0.3, 0.6]];
      return (
        <Group>
          {Array.from({ length: chimneys }, (_, index) => (
            <Box key={index} x={x + 0.4 + index * 0.75} y={y + 0.25} w={0.35} d={0.35} h={stack} m={STONE} />
          ))}
          <Box x={x + 0.2} y={y + 0.75} w={w - 0.4} d={d - 0.95} h={h} m={m} />
          <Gable x={x + 0.15} y={y + 0.7} w={w - 0.3} d={d - 0.85} z={h} rise={9} m={m} along="y" />
          <LeftFace x={x + 0.2} yFront={y + d - 0.2} u0={0.8} u1={1.9} v0={0} v1={13} color="#3b2418" />
          <LeftFace x={x + 0.2} yFront={y + d - 0.2} u0={0.95} u1={1.75} v0={0} v1={10} color="#f08a3a" />
          <LeftFace x={x + 0.2} yFront={y + d - 0.2} u0={1.15} u1={1.55} v0={0} v1={6} color="#ffd36a" />
          {tier === 4 && <LeftFace x={x + 0.2} yFront={y + d - 0.2} u0={0} u1={w - 0.4} v0={h - 3} v1={h - 1.5} color={GOLD} />}
          {/* The ore heap, dark rock with embers of ore in it, on the apron to the right of the door. */}
          <Hip x={heap.x} y={heap.y} w={0.7} d={0.65} z={0} rise={7} m={{ ...STONE, roof: '#4a4c52', roofDark: '#33353a' }} />
          {embers.map(([ex, ey], index) => {
            const at = iso(heap.x + ex, heap.y + ey, 3);
            return <Circle key={index} cx={at.x} cy={at.y} r={1.1} color="#f08a3a" />;
          })}
          {/* Ingots stacked to the left of the door. */}
          {[0, 1, 2].map((row) => (
            <Box key={row} x={x + 0.3 + row * 0.04} y={y + d - 0.75 + row * 0.04} w={0.42 - row * 0.08} d={0.42 - row * 0.08} h={2} z={row * 2} m={{ left: '#8f949c', right: '#6b7079', top: '#c9ccd2', roof: '#8f949c', roofDark: '#6b7079' }} outline={false} />
          ))}
        </Group>
      );
    }
    case 'research': {
      // The research facility: an observatory tower with a copper dome and a telescope poking out of it
      // from the first level, a hall of tall glass windows beside it, a blue pennant, and from the third
      // tier a gold armillary sphere on the hall's ridge.
      const h = 14 + 3 * tier;
      const th = 26 + 7 * tier;
      const dome = iso(x + w - 0.55, y + 0.65, th + 2);
      const orb = iso(x + 0.15 + (w - 0.9) / 2, y + 0.95 + (d - 1.1) / 2, h + 9 + 7);
      return (
        <Group>
          <Box x={x + w - 1.0} y={y + 0.2} w={0.9} d={0.9} h={th} m={m} />
          <Circle cx={dome.x} cy={dome.y} r={8.5} color={tier === 4 ? GOLD : '#5f8f8a'} />
          <Circle cx={dome.x - 3} cy={dome.y - 3} r={2.5} color={tier === 4 ? '#f3dc9a' : '#8fbdb6'} />
          <Rect x={dome.x - 1.2} y={dome.y - 8} width={2.4} height={6} color={DARK} />
          <Line p1={vec(dome.x, dome.y - 4)} p2={vec(dome.x + 14, dome.y - 15)} color="#5a4a3a" strokeWidth={3} />
          <Line p1={vec(dome.x + 10, dome.y - 12)} p2={vec(dome.x + 14, dome.y - 15)} color="#c9ccd2" strokeWidth={3.6} />
          <Box x={x + 0.15} y={y + 1.0} w={w - 0.9} d={d - 1.2} h={h} m={m} />
          <Gable x={x + 0.1} y={y + 0.95} w={w - 0.8} d={d - 1.1} z={h} rise={9} m={m} />
          {[0.3, 0.75, 1.2, 1.65].map((u) => <LeftFace key={u} x={x + 0.15} yFront={y + d - 0.2} u0={u} u1={u + 0.3} v0={3} v1={h - 3} color="#9fd0e0" />)}
          {[0.3, 0.75, 1.2, 1.65].map((u) => <LeftFace key={u} x={x + 0.15} yFront={y + d - 0.2} u0={u + 0.13} u1={u + 0.17} v0={3} v1={h - 3} color={DARK} />)}
          {tier >= 3 ? (
            <Group>
              <Rect x={orb.x - 0.6} y={orb.y} width={1.2} height={7} color={DARK} />
              <Circle cx={orb.x} cy={orb.y - 3} r={5} style="stroke" strokeWidth={1.4} color={GOLD} />
              <Line p1={vec(orb.x - 5, orb.y - 1)} p2={vec(orb.x + 5, orb.y - 5)} strokeWidth={1.2} color={GOLD} />
              <Circle cx={orb.x} cy={orb.y - 3} r={1.4} color={GOLD} />
            </Group>
          ) : (
            <Flag x={x + 0.15 + (w - 0.9) / 2} y={y + 0.95 + (d - 1.1) / 2} z={h + 9} color="#3f6f8a" />
          )}
        </Group>
      );
    }
    case 'armory': {
      // The armory: a squat strong-room with a big shield and crossed swords over its door, a rack of
      // spears and round shields along its front, and a red pennant.
      const h = 16 + 3 * tier;
      const emblem = iso(x + w / 2 + 0.3, y + d - 0.3, h / 2 + 6);
      const steel = '#c9ccd2';
      const shield = (cx: number, cy: number, r: number) => poly([{ x: cx - r, y: cy - r }, { x: cx + r, y: cy - r }, { x: cx + r, y: cy + r * 0.3 }, { x: cx, y: cy + r * 1.3 }, { x: cx - r, y: cy + r * 0.3 }]);
      return (
        <Group>
          <Box x={x + 0.3} y={y + 0.3} w={w - 0.6} d={d - 0.6} h={h} m={m} />
          {tier >= 2 ? <Crenels x={x + 0.3} y={y + 0.3} w={w - 0.6} d={d - 0.6} z={h} m={m} /> : <Hip x={x + 0.25} y={y + 0.25} w={w - 0.5} d={d - 0.5} z={h} rise={14} m={m} />}
          <LeftFace x={x + 0.3} yFront={y + d - 0.3} u0={1.6} u1={2.2} v0={0} v1={10} color={DARK} />
          <Line p1={vec(emblem.x - 9, emblem.y + 8)} p2={vec(emblem.x + 9, emblem.y - 8)} strokeWidth={2.2} color={steel} />
          <Line p1={vec(emblem.x + 9, emblem.y + 8)} p2={vec(emblem.x - 9, emblem.y - 8)} strokeWidth={2.2} color={steel} />
          <Path path={svgPath(shield(emblem.x, emblem.y, 6))} color={tier === 4 ? GOLD : BANNER} />
          <Path path={svgPath(shield(emblem.x, emblem.y, 6))} style="stroke" strokeWidth={1} color={DARK} />
          <Rect x={emblem.x - 0.9} y={emblem.y - 5} width={1.8} height={10} color={tier === 4 ? BANNER : GOLD} />
          <Rect x={emblem.x - 4} y={emblem.y - 2} width={8} height={1.8} color={tier === 4 ? BANNER : GOLD} />
          {/* The rack along the front wall: spears leaning on a rail, shields hung between them. */}
          <LeftFace x={x + 0.3} yFront={y + d - 0.28} u0={0.1} u1={1.45} v0={9} v1={9.8} color="#6e4a2f" />
          {[0.18, 0.5, 0.82, 1.14].map((u) => {
            const foot = iso(x + 0.3 + u, y + d - 0.22);
            return (
              <Group key={u}>
                <Line p1={vec(foot.x, foot.y)} p2={vec(foot.x + 1.5, foot.y - 20)} strokeWidth={1.3} color="#8c6a3c" />
                <Circle cx={foot.x + 1.6} cy={foot.y - 20.5} r={1.4} color={steel} />
              </Group>
            );
          })}
          {[0.34, 0.66, 0.98].map((u, index) => {
            const at = iso(x + 0.3 + u, y + d - 0.26, 5);
            return (
              <Group key={u}>
                <Circle cx={at.x} cy={at.y} r={3.2} color={index % 2 ? '#3f6f8a' : BANNER} />
                <Circle cx={at.x} cy={at.y} r={1.1} color={steel} />
              </Group>
            );
          })}
          <Flag x={x + w - 0.5} y={y + 0.5} z={h + (tier >= 2 ? 3.5 : 0)} />
        </Group>
      );
    }
    case 'barracks': {
      // The barracks: a long hall hung with red banners along the back of the plot, and a drill yard in
      // front of it, a flagstone square with two training dummies, a weapon stand and the company's flag
      // on a tall pole.
      const h = 14 + 3 * tier;
      const hd = d - 1.3;
      const dummies = [x + 0.7, x + 1.5];
      const yardY = y + 0.2 + hd;
      return (
        <Group>
          <Box x={x + 0.2} y={y + 0.2} w={w - 0.4} d={hd} h={h} m={m} />
          <Gable x={x + 0.15} y={y + 0.15} w={w - 0.3} d={hd + 0.1} z={h} rise={10} m={m} />
          <LeftFace x={x + 0.2} yFront={yardY} u0={1.0} u1={1.6} v0={0} v1={9} color={DARK} />
          {[0.25, 2.05].map((u) => <LeftFace key={u} x={x + 0.2} yFront={yardY} u0={u} u1={u + 0.3} v0={h - 12} v1={h - 2} color={tier === 4 ? GOLD : BANNER} />)}
          {[0.25, 2.05].map((u) => <LeftFace key={u} x={x + 0.2} yFront={yardY} u0={u + 0.08} u1={u + 0.22} v0={h - 11} v1={h - 8} color={tier === 4 ? BANNER : GOLD} />)}
          <Box x={x + 0.2} y={yardY} w={w - 0.4} d={d - 0.4 - hd} h={0.8} m={STONE} outline={false} />
          {dummies.map((dx) => {
            const post = iso(dx, yardY + 0.6, 0.8);
            return (
              <Group key={dx}>
                <Rect x={post.x - 1} y={post.y - 13} width={2} height={13} color="#8c6a3c" />
                <Rect x={post.x - 6} y={post.y - 10} width={12} height={1.8} color="#8c6a3c" />
                <Circle cx={post.x} cy={post.y - 12} r={2.6} color="#d8c48a" />
                <Rect x={post.x - 3.5} y={post.y - 9} width={7} height={5} color="#7a5232" />
              </Group>
            );
          })}
          {[0, 1, 2].map((index) => {
            const foot = iso(x + 2.2 + index * 0.18, yardY + 0.85, 0.8);
            return <Line key={index} p1={vec(foot.x, foot.y)} p2={vec(foot.x + 4 - index * 4, foot.y - 12)} strokeWidth={1.4} color="#c9ccd2" />;
          })}
          <Flag x={x + w - 0.5} y={yardY + 0.25} z={h - 2} />
          <Rect x={iso(x + w - 0.5, yardY + 0.25, 0.8).x - 0.7} y={iso(x + w - 0.5, yardY + 0.25, h - 2).y} width={1.4} height={h - 2.8} color={DARK} />
        </Group>
      );
    }
    case 'guardhouse': {
      // The guardhouse: a squat watch-post with a brazier burning on a post by its door, a rack of
      // steel-tipped pikes against its side, and a red pennant.
      const h = 13 + 3 * tier;
      const brazier = iso(x + 0.45, y + 1.75, 12);
      return (
        <Group>
          <Box x={x + 0.15} y={y + 0.5} w={1.3} d={1.3} h={h} m={m} />
          {tier >= 2 ? <Crenels x={x + 0.15} y={y + 0.5} w={1.3} d={1.3} z={h} m={m} /> : <Gable x={x + 0.1} y={y + 0.45} w={1.4} d={1.4} z={h} rise={7} m={m} />}
          <LeftFace x={x + 0.15} yFront={y + 1.8} u0={0.65} u1={1.05} v0={0} v1={8} color={DARK} />
          <LeftFace x={x + 0.15} yFront={y + 1.8} u0={0.8} u1={0.9} v0={8} v1={8.8} color="#8c6a3c" />
          {/* The brazier: an iron basket on a post, coals glowing. */}
          <Rect x={brazier.x - 0.8} y={brazier.y} width={1.6} height={12} color={DARK} />
          <Rect x={brazier.x - 4} y={brazier.y - 3} width={8} height={3} color="#3d4148" />
          <Circle cx={brazier.x} cy={brazier.y - 5} r={3.2} color="#f08a3a" />
          <Circle cx={brazier.x} cy={brazier.y - 4.5} r={1.8} color="#ffd36a" />
          {/* A rack of pikes, steel heads up. */}
          <Box x={x + 1.55} y={y + 0.35} w={0.3} d={0.2 + (tier + 2) * 0.22} h={1.5} m={LOGS} outline={false} />
          {Array.from({ length: tier + 2 }, (_, index) => {
            const p = iso(x + 1.7, y + 0.45 + index * 0.22, 1.5);
            return (
              <Group key={index}>
                <Line p1={vec(p.x, p.y)} p2={vec(p.x + 1.5, p.y - 28)} color="#8c6a3c" strokeWidth={1.5} />
                <Rect x={p.x + 0.6} y={p.y - 32} width={1.8} height={5} color="#c9ccd2" />
              </Group>
            );
          })}
          <Flag x={x + 0.8} y={y + 1.15} z={h + (tier >= 2 ? 3.5 : 7)} />
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
          {/* The paladins' banner hung down the tower's face: red with a gold cross, and swords crossed over the chapel door. */}
          <LeftFace x={x + w - 0.9} yFront={y + d - 0.2} u0={0.15} u1={0.55} v0={sh - 26} v1={sh - 6} color={BANNER} />
          <LeftFace x={x + w - 0.9} yFront={y + d - 0.2} u0={0.31} u1={0.39} v0={sh - 23} v1={sh - 9} color={GOLD} />
          <LeftFace x={x + w - 0.9} yFront={y + d - 0.2} u0={0.22} u1={0.48} v0={sh - 18} v1={sh - 15.5} color={GOLD} />
          {(() => {
            const over = iso(x + 0.42, y + d - 0.2, 9);
            return (
              <Group>
                <Line p1={vec(over.x - 7, over.y + 5)} p2={vec(over.x + 7, over.y - 6)} strokeWidth={1.8} color="#c9ccd2" />
                <Line p1={vec(over.x + 7, over.y + 5)} p2={vec(over.x - 7, over.y - 6)} strokeWidth={1.8} color="#c9ccd2" />
              </Group>
            );
          })()}
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
          {/* The eyrie's pennant on a tall pole at the foot of the crag (gold at the last tier). */}
          <Rect x={iso(x + 0.3, y + d - 0.3).x - 0.6} y={iso(x + 0.3, y + d - 0.3, 18).y} width={1.2} height={18} color={DARK} />
          <Flag x={x + 0.3} y={y + d - 0.3} z={18} color={tier === 4 ? GOLD : BANNER} />
        </Group>
      );
    }
    case 'monastery': {
      // The monastery: a cloister. The monks' hall along the back with a bell cote and a gold cross on its
      // ridge, a low arcaded walk round the other three sides, and in the middle the garth: a lawn with a
      // well and the herb beds. Unlike the church and chapel, nothing of it is tall.
      const h = 14 + 3 * tier;
      const hd = 1.0;
      const hall = { x: x + 0.15, y: y + 0.15, w: w - 0.3, d: hd };
      const walk = 0.4;
      const cote = iso(x + w / 2, y + 0.15 + hd / 2, h + 9);
      const bell = iso(x + w / 2, y + 0.15 + hd / 2, h + 9 + 4);
      const cross = iso(x + w / 2, y + 0.15 + hd / 2, h + 9 + 9);
      const garth = { x: x + 0.15 + walk, y: y + 0.15 + hd, w: w - 0.3 - 2 * walk, d: d - 0.3 - hd - walk };
      const lawn: Mat = { left: '#4f7a36', right: '#3c5e29', top: '#5e8a3f', roof: '#4f7a36', roofDark: '#3c5e29' };
      const columns: [number, number][] = [];
      for (let u = 0.2; u < w - 0.3; u += 0.45) columns.push([x + 0.15 + u, y + d - 0.15 - walk / 2]);
      for (let v = hd + 0.3; v < d - 0.3 - walk; v += 0.45) columns.push([x + 0.15 + walk / 2, y + 0.15 + v], [x + w - 0.15 - walk / 2, y + 0.15 + v]);
      return (
        <Group>
          <Box x={hall.x} y={hall.y} w={hall.w} d={hall.d} h={h} m={m} />
          <Gable x={hall.x - 0.05} y={hall.y - 0.05} w={hall.w + 0.1} d={hall.d + 0.1} z={h} rise={9} m={m} />
          {[0.4, 0.95, 1.5, 2.05].map((u) => <LeftFace key={u} x={hall.x} yFront={hall.y + hall.d} u0={u} u1={u + 0.22} v0={h - 9} v1={h - 3} color={GLOW} />)}
          <LeftFace x={hall.x} yFront={hall.y + hall.d} u0={hall.w / 2 - 0.2} u1={hall.w / 2 + 0.2} v0={0} v1={7} color={DARK} />
          {/* The bell cote: two posts, a little roof, the bell hung between, a gold cross on top. */}
          <Rect x={cote.x - 5} y={cote.y - 8} width={1.5} height={8} color={m.right} />
          <Rect x={cote.x + 3.5} y={cote.y - 8} width={1.5} height={8} color={m.right} />
          <Rect x={cote.x - 6} y={cote.y - 10} width={12} height={2} color={m.roofDark} />
          <Circle cx={bell.x} cy={bell.y + 1} r={2.4} color={GOLD} />
          <Rect x={cross.x - 0.8} y={cross.y - 1} width={1.6} height={9} color={GOLD} />
          <Rect x={cross.x - 3.2} y={cross.y + 1.5} width={6.4} height={1.6} color={GOLD} />
          {/* The cloister walk: a low wall and columns round the garth. */}
          <Box x={x + 0.15} y={y + d - 0.15 - walk} w={w - 0.3} d={walk} h={2.5} m={m} outline={false} />
          <Box x={x + 0.15} y={y + 0.15 + hd} w={walk} d={d - 0.3 - hd} h={2.5} m={m} outline={false} />
          <Box x={x + w - 0.15 - walk} y={y + 0.15 + hd} w={walk} d={d - 0.3 - hd} h={2.5} m={m} outline={false} />
          {columns.map(([cx, cy], index) => (
            <Box key={index} x={cx - 0.07} y={cy - 0.07} w={0.14} d={0.14} h={7} z={2.5} m={tier >= 3 ? MARBLE : m} outline={false} />
          ))}
          {/* The garth: lawn, herb beds and the well. */}
          <Box x={garth.x} y={garth.y} w={garth.w} d={garth.d} h={0.6} m={lawn} outline={false} />
          {[[0.15, 0.15], [garth.w - 0.55, 0.15], [0.15, garth.d - 0.55], [garth.w - 0.55, garth.d - 0.55]].map(([bx, by], index) => (
            <Box key={index} x={garth.x + bx} y={garth.y + by} w={0.4} d={0.4} h={1.2} z={0.6} m={{ left: '#6e5236', right: '#553f28', top: '#7f9a4a', roof: '#6e5236', roofDark: '#553f28' }} outline={false} />
          ))}
          <Cylinder cx={garth.x + garth.w / 2} cy={garth.y + garth.d / 2} r={0.18} h={4} z={0.6} m={STONE} merlons={false} />
        </Group>
      );
    }
    case 'archery': {
      // The archery range: a shooting line of posts with a red pennant and a lodge at one end, and a row of
      // big straw butts with painted targets (more with the tiers) along the far side, arrows in them.
      const targets = Math.min(4, 1 + tier);
      const lh = 10 + 2 * tier;
      const butts = Array.from({ length: targets }, (_, index) => y + 0.5 + index * ((d - 0.9) / Math.max(1, targets - 1)));
      return (
        <Group>
          <Box x={x + 0.15} y={y + 0.15} w={1.1} d={1.1} h={lh} m={m} />
          <Gable x={x + 0.1} y={y + 0.1} w={1.2} d={1.2} z={lh} rise={6} m={m} />
          <LeftFace x={x + 0.15} yFront={y + 1.25} u0={0.4} u1={0.7} v0={0} v1={7} color={DARK} />
          {/* The shooting line: posts and a rail down the near side of the range. */}
          {[1.6, 2.3, 3.0].map((ty) => {
            const p = iso(x + 0.4, y + Math.min(d - 0.2, ty));
            return <Rect key={ty} x={p.x - 1} y={p.y - 7} width={2} height={7} color="#8c6a3c" />;
          })}
          {butts.map((ty, index) => {
            const t = iso(x + w - 0.45, ty, 10);
            return (
              <Group key={index}>
                <Rect x={t.x - 1} y={t.y} width={2} height={10} color="#8c6a3c" />
                <Circle cx={t.x} cy={t.y} r={7} color="#d8c48a" />
                <Circle cx={t.x} cy={t.y} r={5.5} color="#ece6d4" />
                <Circle cx={t.x} cy={t.y} r={3.8} color={BANNER} />
                <Circle cx={t.x} cy={t.y} r={2} color="#ece6d4" />
                <Circle cx={t.x} cy={t.y} r={0.9} color={DARK} />
                <Line p1={vec(t.x - 1, t.y - 1)} p2={vec(t.x - 9, t.y - 6)} strokeWidth={1} color="#5e4630" />
                <Line p1={vec(t.x + 2, t.y + 1)} p2={vec(t.x - 6, t.y + 6)} strokeWidth={1} color="#5e4630" />
              </Group>
            );
          })}
          <Flag x={x + 0.7} y={y + 0.7} z={lh + 6} />
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
          {/* A haystack in the paddock corner and a water trough by the stable doors. */}
          <Hip x={x + w - 1.0} y={y + d - 0.95} w={0.75} d={0.75} z={0} rise={11} m={{ ...MATS[0], roof: '#d8b85a', roofDark: '#b8923a', kind: 'timber' }} />
          <Box x={x + 0.3} y={y + 1.45} w={0.9} d={0.22} h={3} m={LOGS} top="#5f8fa8" outline={false} />
          <Flag x={x + 0.4} y={y + 0.4} z={h + 8} />
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
      // A stone quay along the whole back of the harbour, where all five barges tie up nose-in: a shed
      // for the goods at one end (a second at the other from the second tier), and a crane between
      // that swings out over the water to load them.
      const h = 6 + 2 * tier;
      const shed = h + 10 + 2 * tier;
      const post = iso(x + w - 1.45, y + 0.45, h + 26);
      const arm = iso(x + w - 2.3, y - 0.5, h + 23);
      const hook = iso(x + w - 2.3, y - 0.5, h + 8);
      return (
        <Group>
          <Box x={x} y={y + 0.05} w={w} d={d - 0.1} h={h} m={STONE} />
          <Box x={x + 0.15} y={y + 0.15} w={1.1} d={0.7} h={shed} m={m} />
          <Gable x={x + 0.1} y={y + 0.1} w={1.2} d={0.8} z={shed} rise={7} m={m} />
          {tier >= 2 && (
            <Group>
              <Box x={x + w - 1.0} y={y + 0.2} w={0.85} d={0.65} h={shed - 4} m={m} />
              <Gable x={x + w - 1.05} y={y + 0.15} w={0.95} d={0.75} z={shed - 4} rise={6} m={m} />
            </Group>
          )}
          <Box x={x + w - 1.54} y={y + 0.36} w={0.18} d={0.18} h={h + 26} m={MATS[0]} />
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
          {/* The wheelwright's sign: a big spare cartwheel leaning on the wall, and a stack of two more. */}
          {(() => {
            const at = iso(x + w - 0.45, y + 0.1 + sd, 7);
            return (
              <Group>
                <Circle cx={at.x} cy={at.y} r={6.5} color="#5e4630" />
                <Circle cx={at.x} cy={at.y} r={5} color="#b98a5a" />
                <Circle cx={at.x} cy={at.y} r={1.6} color="#3a2a1c" />
                <Line p1={vec(at.x - 5, at.y)} p2={vec(at.x + 5, at.y)} strokeWidth={1} color="#5e4630" />
                <Line p1={vec(at.x, at.y - 5)} p2={vec(at.x, at.y + 5)} strokeWidth={1} color="#5e4630" />
                <Line p1={vec(at.x - 3.5, at.y - 3.5)} p2={vec(at.x + 3.5, at.y + 3.5)} strokeWidth={1} color="#5e4630" />
                <Line p1={vec(at.x + 3.5, at.y - 3.5)} p2={vec(at.x - 3.5, at.y + 3.5)} strokeWidth={1} color="#5e4630" />
              </Group>
            );
          })()}
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
    case 'granary': {
      // The granary: a barn on a stone footing with a round grain silo under a pointed cap at its corner,
      // the loft door open, sheaves of wheat drying on the barn's front, and sacks at the foot.
      const h = 16 + 3 * tier;
      const bw = w - 0.4 - 0.75;
      const silo = { cx: x + w - 0.6, cy: y + d - 0.65, r: 0.38 };
      const cap = iso(silo.cx, silo.cy, h + 2);
      const capBase = silo.r * TILE_HW * Math.SQRT2;
      return (
        <Group>
          <Box x={x + 0.2} y={y + 0.2} w={bw} d={d - 0.5} h={5} m={STONE} />
          <Box x={x + 0.2} y={y + 0.2} w={bw} d={d - 0.5} h={h - 5} z={5} m={tier >= 3 ? m : MATS[0]} />
          <Gable x={x + 0.12} y={y + 0.12} w={bw + 0.16} d={d - 0.34} z={h} rise={12} m={tier >= 2 ? m : MATS[0]} along="y" />
          <LeftFace x={x + 0.2} yFront={y + d - 0.3} u0={bw / 2 - 0.2} u1={bw / 2 + 0.2} v0={h - 9} v1={h - 3} color={DARK} />
          {[0.3, 0.55].map((u) => {
            const at = iso(x + 0.2 + u * bw, y + d - 0.3, 8);
            return (
              <Group key={u}>
                <Line p1={vec(at.x - 3, at.y + 8)} p2={vec(at.x, at.y)} strokeWidth={1.2} color="#d8c48a" />
                <Line p1={vec(at.x + 3, at.y + 8)} p2={vec(at.x, at.y)} strokeWidth={1.2} color="#d8c48a" />
                <Line p1={vec(at.x, at.y + 8)} p2={vec(at.x, at.y)} strokeWidth={1.2} color="#d8c48a" />
                <Circle cx={at.x} cy={at.y - 1} r={2} color="#e2c470" />
              </Group>
            );
          })}
          <Cylinder cx={silo.cx} cy={silo.cy} r={silo.r} h={h + 2} m={tier >= 3 ? m : STONE} merlons={false} />
          <Path path={svgPath(poly([{ x: cap.x - capBase, y: cap.y }, { x: cap.x + capBase, y: cap.y }, { x: cap.x, y: cap.y - 11 }]))} color={(tier >= 2 ? m : MATS[0]).roof} />
          <Path path={svgPath(poly([{ x: cap.x, y: cap.y }, { x: cap.x + capBase, y: cap.y }, { x: cap.x, y: cap.y - 11 }]))} color={(tier >= 2 ? m : MATS[0]).roofDark} />
          {[0.3, 0.65, 1.0].map((u) => {
            const at = iso(x + u, y + d - 0.12);
            return <Circle key={u} cx={at.x} cy={at.y - 2} r={2.4} color="#d8c48a" />;
          })}
        </Group>
      );
    }
    case 'orchard1':
    case 'orchard2':
    case 'orchard3':
    case 'orchard4':
    case 'orchard5':
    case 'orchard6':
    case 'orchard7':
    case 'orchard8': {
      // Rows of apple trees, red with fruit, behind a low hedge of posts.
      const rows = [0.55, 1.5, 2.45];
      return (
        <Group>
          {rows.flatMap((ty) =>
            rows.map((tx) => {
              const at = iso(x + tx, y + ty);
              const r = 4.5 + tier;
              return (
                <Group key={`${String(tx)}-${String(ty)}`}>
                  <Rect x={at.x - 1} y={at.y - 7} width={2} height={7} color="#5e4630" />
                  <Circle cx={at.x} cy={at.y - 9 - tier} r={r} color="#4f7a36" />
                  <Circle cx={at.x - r * 0.45} cy={at.y - 9 - tier} r={1.2} color="#c0392b" />
                  <Circle cx={at.x + r * 0.4} cy={at.y - 11 - tier} r={1.2} color="#c0392b" />
                  <Circle cx={at.x + r * 0.1} cy={at.y - 7 - tier} r={1.2} color="#c0392b" />
                </Group>
              );
            }),
          )}
        </Group>
      );
    }
    case 'fishery1':
    case 'fishery2':
    case 'fishery3':
    case 'fishery4':
    case 'fishery5':
    case 'fishery6':
    case 'fishery7':
    case 'fishery8': {
      // A shack on stilts along the river wall, a rack of drying fish.
      const h = 7 + 2 * tier;
      return (
        <Group>
          <Box x={x + 0.15} y={y + 0.2} w={0.7} d={0.65} h={h} z={3} m={MATS[0]} />
          <Gable x={x + 0.1} y={y + 0.15} w={0.8} d={0.75} z={h + 3} rise={5} m={tier >= 2 ? m : MATS[0]} />
          {[0.2, 0.5, 0.8].map((u) => {
            const at = iso(x + u, y + 0.95);
            return <Rect key={u} x={at.x - 0.6} y={at.y - 6} width={1.2} height={4} color="#9fb2bc" />;
          })}
        </Group>
      );
    }
    case 'pasture1':
    case 'pasture2':
    case 'pasture3':
    case 'pasture4':
    case 'pasture5':
    case 'pasture6':
    case 'pasture7':
    case 'pasture8': {
      // Grazing on the raiders' ground: a fence of posts round the field and the shepherd's shed. The
      // sheep themselves are live (their flock changes).
      const posts: [number, number][] = [];
      for (let i = 0; i <= 6; i++) {
        posts.push([x + (i * w) / 6, y], [x + (i * w) / 6, y + d], [x, y + (i * d) / 6], [x + w, y + (i * d) / 6]);
      }
      return (
        <Group>
          {posts.map(([px, py], index) => {
            const at = iso(px, py);
            return <Rect key={index} x={at.x - 0.7} y={at.y - 4} width={1.4} height={4} color="#6e5236" />;
          })}
          <Box x={x + 0.2} y={y + 0.2} w={0.8} d={0.8} h={6 + tier} m={MATS[0]} />
          <Gable x={x + 0.15} y={y + 0.15} w={0.9} d={0.9} z={6 + tier} rise={5} m={tier >= 2 ? m : MATS[0]} />
        </Group>
      );
    }
    case 'woodcutter':
    case 'woodcutter2':
    case 'woodcutter3':
    case 'woodcutter4':
    case 'woodcutter5': {
      // A woodcutter's log cabin, nothing like a cottage: walls of whole logs laid in courses with the
      // notched ends showing at the corner (roofed in its tier's tiles or slate later), a log stack
      // growing with the hut, a felled trunk and a sawhorse with a two-man saw in the yard, a chopping
      // block with the axe left in it, and pines standing behind.
      const h = 9 + 2 * tier;
      const cabin = { x: x + 0.15, y: y + 0.15, w: 1.05, d: 1.2 };
      const cabinMat: Mat = { left: '#8a5a2e', right: '#6b4422', top: '#b98a5a', roof: '#8a5a2e', roofDark: '#553519' };
      const courses: number[] = [];
      for (let v = 2.4; v < h - 1; v += 2.6) courses.push(v);
      const pine = (px: number, py: number, size: number) => {
        const foot = iso(px, py);
        return (
          <Group key={`${String(px)}${String(py)}`}>
            <Rect x={foot.x - 1.2} y={foot.y - 6} width={2.4} height={6} color="#5e4630" />
            {[0, 1, 2].map((layer) => {
              const half = size * (1 - layer * 0.28);
              const base = foot.y - 5 - layer * size * 0.75;
              return <Path key={layer} path={svgPath(poly([{ x: foot.x - half, y: base }, { x: foot.x + half, y: base }, { x: foot.x, y: base - size * 1.1 }]))} color={layer % 2 ? '#3f6a2e' : '#2f5a26'} />;
            })}
          </Group>
        );
      };
      const block = iso(x + 0.66, y + 1.78, 4);
      const horse = iso(x + 1.55, y + 1.72);
      const trunkEnd = iso(x + 0.2, y + 1.62, 2.5);
      return (
        <Group>
          {pine(x + 0.3, y + 0.08, 9)}
          {pine(x + 1.7, y + 0.1, 7)}
          <Box x={cabin.x} y={cabin.y} w={cabin.w} d={cabin.d} h={h} m={cabinMat} />
          {courses.map((v) => (
            <Group key={v}>
              <LeftFace x={cabin.x} yFront={cabin.y + cabin.d} u0={0} u1={cabin.w} v0={v} v1={v + 0.7} color="#553519" />
              <RightFace xFront={cabin.x + cabin.w} y={cabin.y} u0={0} u1={cabin.d} v0={v} v1={v + 0.7} color="#3e2612" />
              <Circle cx={iso(cabin.x + cabin.w, cabin.y + cabin.d, v - 1).x + 0.4} cy={iso(cabin.x + cabin.w, cabin.y + cabin.d, v - 1).y} r={1.5} color="#c9955c" />
            </Group>
          ))}
          <Gable x={cabin.x - 0.07} y={cabin.y - 0.07} w={cabin.w + 0.14} d={cabin.d + 0.14} z={h} rise={7} m={tier >= 2 ? m : MATS[0]} along="y" />
          <LeftFace x={cabin.x} yFront={cabin.y + cabin.d} u0={0.38} u1={0.68} v0={0} v1={h - 3} color={DARK} />
          {Array.from({ length: 2 + tier }, (_, row) => (
            <Box key={row} x={x + 1.38} y={y + 0.4} w={0.5} d={1.15} h={3} z={row * 3} m={LOGS} />
          ))}
          {/* The felled trunk lying across the yard, its sawn end towards us. */}
          <Box x={x + 0.2} y={y + 1.52} w={1.0} d={0.2} h={5} m={{ ...LOGS, top: '#a06a38' }} outline={false} />
          <Circle cx={trunkEnd.x} cy={trunkEnd.y} r={2.6} color="#c9955c" />
          <Circle cx={trunkEnd.x} cy={trunkEnd.y} r={1.2} color="#8a5a2e" />
          {/* The sawhorse and the long two-man saw resting on it. */}
          <Line p1={vec(horse.x - 4, horse.y)} p2={vec(horse.x, horse.y - 7)} strokeWidth={1.3} color="#8c6a3c" />
          <Line p1={vec(horse.x + 4, horse.y)} p2={vec(horse.x, horse.y - 7)} strokeWidth={1.3} color="#8c6a3c" />
          <Line p1={vec(horse.x - 11, horse.y - 2)} p2={vec(horse.x + 10, horse.y - 12)} strokeWidth={2.2} color="#c9ccd2" />
          <Rect x={horse.x - 13} y={horse.y - 3} width={3} height={2} color="#8c6a3c" />
          <Rect x={horse.x + 10} y={horse.y - 14} width={3} height={2} color="#8c6a3c" />
          <Box x={x + 0.55} y={y + 1.68} w={0.22} d={0.22} h={4} m={LOGS} />
          <Line p1={vec(block.x, block.y - 1)} p2={vec(block.x + 6, block.y - 8)} strokeWidth={1.2} color="#8c6a3c" />
          <Rect x={block.x - 2.5} y={block.y - 3.5} width={4} height={2.5} color="#c9ccd2" />
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
          <Rect x={anvil.x - 3.5} y={anvil.y - 4.5} width={7} height={2.4} color="#3d4148" />
          <Rect x={anvil.x - 1.4} y={anvil.y - 2.2} width={2.8} height={2.2} color="#2a2d33" />
          <Rect x={anvil.x + 3.5} y={anvil.y - 5.5} width={2} height={1.4} color="#3d4148" />
          {/* The smith's hammer on the anvil, and the day's blades racked gleaming against the wall. */}
          <Line p1={vec(anvil.x - 1, anvil.y - 4.5)} p2={vec(anvil.x - 5, anvil.y - 9)} strokeWidth={1.1} color="#8c6a3c" />
          <Rect x={anvil.x - 6.5} y={anvil.y - 10.5} width={3} height={2} color="#3d4148" />
          {[1.0, 1.15, 1.3].map((u, index) => {
            const foot = iso(x + u, y + d - 0.28);
            return <Line key={u} p1={vec(foot.x, foot.y)} p2={vec(foot.x + 1.5 + index * 0.6, foot.y - 12)} strokeWidth={1.4} color="#c9ccd2" />;
          })}
        </Group>
      );
    }
    case 'fairground1':
    case 'fairground2':
    case 'fairground3':
    case 'fairground4': {
      // A fairground: a maypole with ribbons in the middle, a striped tent behind it, and stalls along the
      // front (more as it grows), bunting between the poles.
      const poleTop = iso(x + w / 2, y + d / 2, 34);
      const poleBase = iso(x + w / 2, y + d / 2);
      const stalls = Math.min(3, 1 + Math.floor(tier / 2));
      const ribbons = [iso(x + 0.9, y + 1.2), iso(x + 2.1, y + 1.0), iso(x + 1.0, y + 2.2), iso(x + 2.2, y + 2.3)];
      return (
        <Group>
          <Box x={x + 1.7} y={y + 0.3} w={1.1} d={1.0} h={8} m={m} />
          <Hip x={x + 1.55} y={y + 0.15} w={1.4} d={1.3} z={8} rise={14 + 2 * tier} m={{ ...m, roof: BANNER, roofDark: '#8a3328' }} />
          <Flag x={x + 2.25} y={y + 0.8} z={22 + 2 * tier} color={GOLD} />
          {Array.from({ length: stalls }, (_, index) => (
            <Group key={index}>
              <Box x={x + 0.25 + index * 0.95} y={y + d - 0.9} w={0.7} d={0.6} h={6} m={MATS[0]} />
              <Gable x={x + 0.18 + index * 0.95} y={y + d - 0.98} w={0.84} d={0.76} z={6} rise={4} m={{ ...MATS[0], roof: index % 2 ? '#e2b84f' : '#3f6f8a', roofDark: index % 2 ? '#b8902f' : '#2a4b60' }} along="y" />
            </Group>
          ))}
          <Box x={x + w / 2 - 0.08} y={y + d / 2 - 0.08} w={0.16} d={0.16} h={34} m={MATS[0]} />
          {ribbons.map((end, index) => (
            <Line key={index} p1={vec(poleTop.x, poleTop.y)} p2={vec(end.x, end.y - 1)} strokeWidth={1} color={index % 2 ? BANNER : '#e2b84f'} />
          ))}
          <Circle cx={poleTop.x} cy={poleTop.y} r={2} color={GOLD} />
          <Circle cx={poleBase.x} cy={poleBase.y} r={1.2} color={DARK} />
        </Group>
      );
    }
    case 'church1':
    case 'church2':
    case 'church3':
    case 'church4': {
      // A church: a nave with a steep roof and lit windows, a bell tower at the front corner with a spire
      // that grows with it, and a gold finial on top.
      const h = 14 + 3 * tier;
      const th = 30 + 6 * tier;
      const finial = iso(x + 0.6, y + d - 0.6, th + 20);
      return (
        <Group>
          <Box x={x + 0.2} y={y + 0.2} w={w - 0.4} d={d - 1.1} h={h} m={m} />
          <Gable x={x + 0.12} y={y + 0.12} w={w - 0.24} d={d - 0.94} z={h} rise={11} m={m} along="x" />
          {[0.5, 1.1, 1.7, 2.3].map((u) => <LeftFace key={u} x={x + 0.2} yFront={y + d - 0.9} u0={u} u1={u + 0.18} v0={h - 10} v1={h - 2} color={GLOW} />)}
          <Box x={x + 0.2} y={y + d - 1.0} w={0.8} d={0.8} h={th} m={m} />
          <LeftFace x={x + 0.2} yFront={y + d - 0.2} u0={0.3} u1={0.5} v0={th - 9} v1={th - 3} color={DARK} />
          <Hip x={x + 0.12} y={y + d - 1.08} w={0.96} d={0.96} z={th} rise={20} m={m} />
          <Circle cx={finial.x} cy={finial.y - 1} r={1.6} color={GOLD} />
          {tier >= 3 && <Flag x={x + w - 0.5} y={y + 0.5} z={h + 11} color={GOLD} />}
        </Group>
      );
    }
    case 'gardens1':
    case 'gardens2':
    case 'gardens3':
    case 'gardens4': {
      // Gardens: a low hedge round the plot, four flowerbeds and a fountain in the middle (a marble one
      // from the second tier), trees at the corners as it grows.
      const flowers = ['#d9534f', '#e2b84f', '#c86bb0', '#f0ead8'];
      const beds: [number, number][] = [[0.5, 0.5], [1.9, 0.5], [0.5, 1.9], [1.9, 1.9]];
      const trees = Math.min(4, tier);
      const corners: [number, number][] = [[0.25, 0.25], [w - 0.25, 0.25], [0.25, d - 0.25], [w - 0.25, d - 0.25]];
      const hedge: Mat = { left: '#4f7a36', right: '#3c5e29', top: '#5f8f40', roof: '#4f7a36', roofDark: '#3c5e29' };
      return (
        <Group>
          <Box x={x + 0.05} y={y + 0.05} w={w - 0.1} d={0.12} h={3} m={hedge} outline={false} />
          <Box x={x + 0.05} y={y + 0.05} w={0.12} d={d - 0.1} h={3} m={hedge} outline={false} />
          {beds.map(([bx, by], index) => (
            <Group key={index}>
              <Box x={x + bx} y={y + by} w={0.6} d={0.6} h={1} m={MATS[0]} outline={false} />
              {[[0.15, 0.15], [0.45, 0.2], [0.3, 0.45]].map(([fx, fy], f) => {
                const at = iso(x + bx + fx, y + by + fy, 1);
                return <Circle key={f} cx={at.x} cy={at.y - 1.5} r={1.4} color={flowers[(index + f) % flowers.length]} />;
              })}
            </Group>
          ))}
          <Cylinder cx={x + w / 2} cy={y + d / 2} r={0.32} h={4} m={tier >= 2 ? MARBLE : STONE} merlons={false} />
          {(() => {
            const top = iso(x + w / 2, y + d / 2, 4);
            return (
              <Group>
                <Circle cx={top.x} cy={top.y} r={5} color="#3f6f8a" />
                <Rect x={top.x - 0.8} y={top.y - 9} width={1.6} height={9} color={tier >= 2 ? MARBLE.left : STONE.left} />
                <Circle cx={top.x} cy={top.y - 10} r={1.6} color="#9fc8dc" />
              </Group>
            );
          })()}
          {corners.slice(0, trees).map(([cx, cy], index) => {
            const at = iso(x + cx, y + cy);
            return (
              <Group key={index}>
                <Rect x={at.x - 1} y={at.y - 8} width={2} height={8} color="#5e4630" />
                <Circle cx={at.x} cy={at.y - 11} r={5.5} color="#4f7a36" />
              </Group>
            );
          })}
        </Group>
      );
    }
    case 'balloonWorks': {
      // The balloon works: a hangar with huge doors, a riveted iron gas-holder beside it, a mooring mast
      // with its ring at the corner, and the tether the war balloon (live, see `LiveBits`) hangs from.
      const h = 12 + 3 * tier;
      const iron: Mat = { left: '#7a7f88', right: '#5a5f68', top: '#8f949c', roof: '#7a7f88', roofDark: '#5a5f68' };
      const mastTop = iso(x + w - 0.35, y + 0.35, h + 26);
      const ridge = iso(x + w / 2, y + d / 2, h + 9);
      const basket = iso(x + w / 2, y + d / 2, h + 40 + 3 * tier - (9 + tier) - 12);
      return (
        <Group>
          <Cylinder cx={x + 0.6} cy={y + 0.55} r={0.42} h={12 + 2 * tier} m={iron} merlons={false} />
          <Box x={x + 0.2} y={y + 0.9} w={w - 0.4} d={d - 1.1} h={h} m={m} />
          <Gable x={x + 0.15} y={y + 0.85} w={w - 0.3} d={d - 1.0} z={h} rise={9} m={m} />
          <LeftFace x={x + 0.2} yFront={y + d - 0.2} u0={0.5} u1={2.1} v0={0} v1={h - 2} color={DARK} />
          <LeftFace x={x + 0.2} yFront={y + d - 0.2} u0={1.28} u1={1.32} v0={0} v1={h - 2} color="#6e4a2f" />
          <LeftFace x={x + 0.2} yFront={y + d - 0.2} u0={0.5} u1={2.1} v0={h - 2} v1={h - 0.5} color={BANNER} />
          <Box x={x + w - 0.41} y={y + 0.29} w={0.12} d={0.12} h={h + 26} m={iron} outline={false} />
          <Circle cx={mastTop.x} cy={mastTop.y - 3} r={3.5} style="stroke" strokeWidth={1.4} color="#c9ccd2" />
          <Line p1={vec(ridge.x, ridge.y)} p2={vec(basket.x, basket.y)} strokeWidth={0.9} color={DARK} />
          <Flag x={x + 0.6} y={y + 0.55} z={12 + 2 * tier} />
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
  const pixel = FIGURE_PIXEL;
  return (
    <Group>
      {rows.map((unit, row) => {
        const figures = companies[ARMY_UNITS.indexOf(unit)];
        const runs = spriteRuns(unit);
        return Array.from({ length: figures }, (_, index) => {
          const p = iso(PARADE.x + index * 0.55 + (row % 2) * 0.25, PARADE.y + row * 0.42);
          return (
            <Group key={`${unit}-${String(index)}`}>
              {runs.map((run, i) => (
                <Rect key={i} x={p.x - (SPRITE_SIZE / 2) * pixel + run.x * pixel} y={p.y - SPRITE_SIZE * pixel + run.y * pixel} width={run.w * pixel + 0.2} height={pixel + 0.2} color={run.color} />
              ))}
            </Group>
          );
        });
      })}
    </Group>
  );
}
