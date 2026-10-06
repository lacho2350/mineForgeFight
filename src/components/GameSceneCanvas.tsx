import { memo, type ReactNode } from 'react';
import { Canvas, Circle, Group, Path, Rect } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import { useGameStore, type Construction } from '../game/gameStore';
import { towerCount, type BuildingId } from '../game/buildings';
import { ARMY_UNITS } from '../game/units';
import {
  BUILDING_PLOTS,
  EXTRA_HOTSPOTS,
  FRONT_BASE,
  HEADFRAME_X,
  SCENE_HEIGHT as sceneHeight,
  WALL_BASE,
  WALL_LEFT,
  WALL_RIGHT,
  YARD,
  type SceneLayout,
  type SceneRect,
} from './GameSceneLayout';
import { spritePixels } from './unitSprites';

export type GameSceneProps = { layout: SceneLayout };

// Every building grows through four looks as it levels: timber (1–5), plaster (6–10),
// stone (11–15) and dressed stone with gold trim (16–20).
type Material = { wall: string; shade: string; trim: string; roof: string; roofShade: string };
const MATERIALS: Material[] = [
  { wall: '#9a6b45', shade: '#7c5435', trim: '#5e3f28', roof: '#7a4b2e', roofShade: '#5f3a24' },
  { wall: '#c9a676', shade: '#a98a5f', trim: '#7d5a3a', roof: '#8c4a32', roofShade: '#6e3826' },
  { wall: '#9c9a8c', shade: '#7f7d71', trim: '#5f5d53', roof: '#5d6b78', roofShade: '#46525d' },
  { wall: '#c9c3b0', shade: '#a8a291', trim: '#8d8676', roof: '#3f5a74', roofShade: '#2f455a' },
];
const GOLD = '#e2b84f';
const BANNER = '#b8483a';
const DARK = '#2a2620';
const WINDOW = '#3d4438';
const GLOW = '#f0b45a';

const tierOf = (level: number) => (level <= 0 ? 0 : Math.min(4, Math.ceil(level / 5)));

function GameSceneCanvas({ layout }: GameSceneProps) {
  const buildings = useGameStore((state) => state.buildings);
  const construction = useGameStore((state) => state.construction);
  const army = useGameStore((state) => state.army);
  const { width, height, scale, offsetX } = layout;
  // Ground strips extend past the centred scene to fill wide frames.
  const bleedX = -offsetX / scale;
  const bleedWidth = width / scale;
  const job = (id: BuildingId) => construction.find((item) => item.building === id);
  const plot = (id: BuildingId, draw: (rect: SceneRect, tier: number) => ReactNode, base?: SceneRect) => {
    const rect = base ?? BUILDING_PLOTS[id];
    const tier = tierOf(buildings[id]);
    return (
      <Group key={id}>
        {tier === 0 ? <EmptyPlot rect={rect} /> : draw(rect, tier)}
        <Scaffold rect={rect} job={job(id)} />
      </Group>
    );
  };

  return (
    <View style={[styles.frame, { height }]}>
      <Canvas style={styles.canvas}>
        <Group transform={[{ translateX: offsetX }, { scale }]}>
          {/* Sky, sun, clouds and the hills behind the hold */}
          <Rect x={bleedX} y={0} width={bleedWidth} height={sceneHeight} color="#9dad85" />
          <Circle cx={530} cy={36} r={18} color="#e7c47e" />
          <Rect x={30} y={30} width={34} height={8} color="#d4d0aa" />
          <Rect x={42} y={23} width={20} height={8} color="#d4d0aa" />
          <Rect x={330} y={16} width={46} height={7} color="#d4d0aa" />
          <Rect x={342} y={9} width={24} height={8} color="#d4d0aa" />
          <Path path={`M ${String(bleedX)} 112 L 70 86 L 180 104 L 300 80 L 420 102 L 520 84 L ${String(bleedX + bleedWidth)} 100 L ${String(bleedX + bleedWidth)} 140 L ${String(bleedX)} 140 Z`} color="#82946b" />
          <Rect x={bleedX} y={WALL_BASE - 2} width={bleedWidth} height={sceneHeight} color="#64754d" />
          <Rect x={bleedX} y={WALL_BASE - 2} width={bleedWidth} height={3} color="#73845a" />

          {/* The wall and its back towers stand behind everything */}
          {plot('wall', (_, tier) => <Wall tier={tier} />, { x: WALL_LEFT, y: WALL_BASE - 12, width: WALL_RIGHT - WALL_LEFT, height: 12 })}
          <BackTowers level={buildings.towers} />

          {/* Back row */}
          {plot('research', (rect, tier) => <Research rect={rect} tier={tier} />)}
          {plot('monastery', (rect, tier) => <Monastery rect={rect} tier={tier} />)}
          {plot('griffinEyrie', (rect, tier) => <GriffinEyrie rect={rect} tier={tier} />)}
          {plot('sanctum', (rect, tier) => <Sanctum rect={rect} tier={tier} />)}
          {plot('foundry', (rect, tier) => <Foundry rect={rect} tier={tier} />)}
          {plot('armory', (rect, tier) => <Armory rect={rect} tier={tier} />)}
          {plot('keep', (rect, tier) => <Keep rect={rect} tier={tier} />)}

          {/* Middle row: the dwellings */}
          {plot('guardhouse', (rect, tier) => <Guardhouse rect={rect} tier={tier} />)}
          {plot('archery', (rect, tier) => <ArcheryRange rect={rect} tier={tier} />)}
          {plot('barracks', (rect, tier) => <Barracks rect={rect} tier={tier} />)}
          {plot('chapel', (rect, tier) => <Chapel rect={rect} tier={tier} />)}
          {plot('balloonWorks', (rect, tier) => <BalloonWorks rect={rect} tier={tier} />)}
          {plot('stables', (rect, tier) => <Stables rect={rect} tier={tier} />)}

          {/* Road and the front row */}
          <Rect x={bleedX} y={FRONT_BASE} width={bleedWidth} height={10} color="#b49a68" />
          <Rect x={bleedX} y={FRONT_BASE + 10} width={bleedWidth} height={sceneHeight} color="#4a4535" />
          {Array.from({ length: 14 }, (_, index) => (
            <Rect key={index} x={index * 45 + 8} y={FRONT_BASE + 4 + (index % 2) * 3} width={14} height={2} color="#9a8155" />
          ))}
          {plot('gate', (rect, tier) => <Gate rect={rect} tier={tier} />)}
          {plot('houses', (rect, tier) => <Houses rect={rect} tier={tier} />)}
          {plot('warehouse', (rect, tier) => <Warehouse rect={rect} tier={tier} />)}
          <Yard units={ARMY_UNITS.filter((unit) => army[unit] > 0)} />
          <Headframe />
          <EdgeTowers level={buildings.towers} job={job('towers')} />
        </Group>
      </Canvas>
    </View>
  );
}

export default memo(GameSceneCanvas);

// ——— Shared pieces ———

function Gable({ x, y, width, rise, color }: { x: number; y: number; width: number; rise: number; color: string }) {
  return <Path path={`M ${String(x - 2)} ${String(y)} L ${String(x + width / 2)} ${String(y - rise)} L ${String(x + width + 2)} ${String(y)} Z`} color={color} />;
}

function Crenels({ x, y, width, color, size = 4 }: { x: number; y: number; width: number; color: string; size?: number }) {
  const count = Math.max(2, Math.floor(width / (size * 2)));
  const gap = (width - size) / (count - 1);
  return Array.from({ length: count }, (_, index) => (
    <Rect key={index} x={x + index * gap} y={y - size} width={size} height={size} color={color} />
  ));
}

function Flag({ x, y, color = BANNER }: { x: number; y: number; color?: string }) {
  return (
    <Group>
      <Rect x={x} y={y - 12} width={1.5} height={12} color={DARK} />
      <Rect x={x + 1.5} y={y - 12} width={7} height={5} color={color} />
    </Group>
  );
}

function Windows({ x, y, count, gap, color = WINDOW, width = 4, height = 5 }: { x: number; y: number; count: number; gap: number; color?: string; width?: number; height?: number }) {
  return Array.from({ length: count }, (_, index) => (
    <Rect key={index} x={x + index * gap} y={y} width={width} height={height} color={color} />
  ));
}

// An empty plot: four stakes and a rope.
function EmptyPlot({ rect }: { rect: SceneRect }) {
  const base = rect.y + rect.height;
  const left = rect.x + 4;
  const right = rect.x + rect.width - 6;
  return (
    <Group opacity={0.75}>
      <Rect x={left} y={base - 7} width={right - left + 2} height={1} color="#d8c48f" />
      {[left, (left + right) / 2, right].map((x) => (
        <Rect key={x} x={x} y={base - 9} width={2} height={9} color="#6e4a2f" />
      ))}
    </Group>
  );
}

// Scaffolding and a progress bar over a building being raised.
function Scaffold({ rect, job }: { rect: SceneRect; job?: Construction }) {
  if (!job) return null;
  const base = rect.y + rect.height;
  const top = Math.max(rect.y + 6, base - 46);
  const poles = [rect.x + 2, rect.x + rect.width / 2 - 1, rect.x + rect.width - 4];
  const done = Math.min(1, job.progress / job.duration);
  return (
    <Group>
      {poles.map((x) => <Rect key={x} x={x} y={top} width={2} height={base - top} color="#d7b273" />)}
      {[top + 6, (top + base) / 2, base - 8].map((y) => <Rect key={y} x={rect.x + 1} y={y} width={rect.width - 2} height={1.5} color="#d7b273" />)}
      <Rect x={rect.x + 4} y={top - 8} width={rect.width - 8} height={4} color="#1d211b" />
      <Rect x={rect.x + 4} y={top - 8} width={(rect.width - 8) * done} height={4} color="#e9c475" />
    </Group>
  );
}

// ——— Buildings ———

function Keep({ rect, tier }: { rect: SceneRect; tier: number }) {
  const m = MATERIALS[tier - 1];
  const base = rect.y + rect.height;
  const centre = rect.x + rect.width / 2;
  const hallWidth = 54 + 10 * tier;
  const hallHeight = 36 + 8 * tier;
  const hallX = centre - hallWidth / 2;
  const hallTop = base - hallHeight;
  const towerHeight = hallHeight + 16;
  const donjonHeight = hallHeight + 30;
  return (
    <Group>
      {tier >= 3 && (
        <Group>
          <Rect x={centre - 13} y={base - donjonHeight} width={26} height={donjonHeight} color={m.shade} />
          <Crenels x={centre - 13} y={base - donjonHeight} width={26} color={m.shade} />
          <Windows x={centre - 6} y={base - donjonHeight + 8} count={2} gap={9} />
          <Flag x={centre} y={base - donjonHeight - 4} color={tier === 4 ? GOLD : BANNER} />
        </Group>
      )}
      <Rect x={hallX} y={hallTop} width={hallWidth} height={hallHeight} color={m.wall} />
      <Rect x={hallX} y={hallTop} width={hallWidth} height={3} color={m.trim} />
      {tier === 1 ? <Gable x={hallX} y={hallTop} width={hallWidth} rise={16} color={m.roof} /> : <Crenels x={hallX} y={hallTop} width={hallWidth} color={m.wall} />}
      {tier >= 2 && [hallX - 8, hallX + hallWidth - 8].map((x) => (
        <Group key={x}>
          <Rect x={x} y={base - towerHeight} width={16} height={towerHeight} color={m.shade} />
          {tier >= 3
            ? <Gable x={x} y={base - towerHeight} width={16} rise={14} color={m.roof} />
            : <Crenels x={x} y={base - towerHeight} width={16} color={m.shade} />}
          <Rect x={x + 6} y={base - towerHeight + 8} width={4} height={6} color={WINDOW} />
          {tier === 4 && <Flag x={x + 8} y={base - towerHeight - 14} color={GOLD} />}
        </Group>
      ))}
      <Windows x={hallX + 10} y={hallTop + 10} count={Math.floor((hallWidth - 16) / 12)} gap={12} />
      <Rect x={centre - 8} y={base - 18} width={16} height={18} color={DARK} />
      <Rect x={centre - 1} y={base - 18} width={2} height={18} color={m.trim} />
      {tier === 4 && <Rect x={hallX} y={hallTop + 5} width={hallWidth} height={2} color={GOLD} />}
      {tier < 3 && <Flag x={centre} y={hallTop - (tier === 1 ? 16 : 4)} />}
    </Group>
  );
}

function Houses({ rect, tier }: { rect: SceneRect; tier: number }) {
  const m = MATERIALS[tier - 1];
  const base = rect.y + rect.height;
  const count = [2, 3, 4, 4][tier - 1];
  const houseWidth = tier >= 3 ? 16 : 15;
  const gap = (rect.width - houseWidth * count) / (count + 1);
  return (
    <Group>
      {Array.from({ length: count }, (_, index) => {
        const x = rect.x + gap + index * (houseWidth + gap);
        const houseHeight = (tier >= 3 ? 24 : 14 + 2 * tier) - (index % 2) * 2;
        const top = base - houseHeight;
        return (
          <Group key={index}>
            {tier >= 2 && <Rect x={x + houseWidth - 5} y={top - 12} width={3} height={8} color={m.trim} />}
            <Rect x={x} y={top} width={houseWidth} height={houseHeight} color={index % 2 ? m.shade : m.wall} />
            <Gable x={x} y={top} width={houseWidth} rise={8} color={index % 2 ? m.roofShade : m.roof} />
            <Rect x={x + 3} y={base - 8} width={4} height={8} color={DARK} />
            <Rect x={x + 9} y={top + 4} width={4} height={4} color={tier === 4 ? GLOW : WINDOW} />
            {tier >= 3 && <Rect x={x + 9} y={base - 9} width={4} height={4} color={WINDOW} />}
          </Group>
        );
      })}
    </Group>
  );
}

function Warehouse({ rect, tier }: { rect: SceneRect; tier: number }) {
  const m = MATERIALS[tier - 1];
  const base = rect.y + rect.height;
  const width = 38 + 5 * tier;
  const height = 20 + 4 * tier;
  const x = rect.x + 2;
  const top = base - height;
  return (
    <Group>
      {tier >= 3 && <Rect x={x + width - 6} y={base - height + 8} width={rect.width - width + 2} height={height - 8} color={m.shade} />}
      <Rect x={x} y={top} width={width} height={height} color={m.wall} />
      <Gable x={x} y={top} width={width} rise={10} color={m.roof} />
      <Rect x={x + width / 2 - 8} y={base - 16} width={16} height={16} color={m.trim} />
      <Path path={`M ${String(x + width / 2 - 8)} ${String(base - 16)} L ${String(x + width / 2 + 8)} ${String(base)} M ${String(x + width / 2 + 8)} ${String(base - 16)} L ${String(x + width / 2 - 8)} ${String(base)}`} style="stroke" strokeWidth={1.5} color={m.shade} />
      {tier === 4 && <Rect x={x} y={top + 3} width={width} height={2} color={GOLD} />}
      {Array.from({ length: tier + 1 }, (_, index) => (
        <Rect key={index} x={rect.x + rect.width - 8 - (index % 3) * 7} y={base - 6 - Math.floor(index / 3) * 6} width={6} height={6} color={index % 2 ? '#a7844f' : '#8c6a3c'} />
      ))}
    </Group>
  );
}

function Foundry({ rect, tier }: { rect: SceneRect; tier: number }) {
  const m = MATERIALS[tier - 1];
  const base = rect.y + rect.height;
  const width = 36 + 4 * tier;
  const height = 22 + 5 * tier;
  const x = rect.x + 4;
  const top = base - height;
  const chimneys = Math.min(3, tier);
  return (
    <Group>
      {Array.from({ length: chimneys }, (_, index) => {
        const cx = x + 4 + index * 12;
        const chimneyTop = top - 14 - 6 * tier + index * 4;
        return (
          <Group key={index}>
            <Rect x={cx} y={chimneyTop} width={7} height={top - chimneyTop + 2} color={tier >= 3 ? '#6d4b3c' : m.trim} />
            <Circle cx={cx + 6} cy={chimneyTop - 6} r={5} color="#c5c1b4" opacity={0.75} />
            <Circle cx={cx + 12} cy={chimneyTop - 13} r={6} color="#d6d2c6" opacity={0.55} />
          </Group>
        );
      })}
      <Rect x={x} y={top} width={width} height={height} color={m.wall} />
      <Rect x={x} y={top} width={width} height={3} color={m.trim} />
      <Rect x={x + width / 2 - 7} y={base - 14} width={14} height={14} color="#3b2418" />
      <Rect x={x + width / 2 - 5} y={base - 10} width={10} height={10} color="#f08a3a" />
      <Windows x={x + 4} y={top + 7} count={2} gap={width - 12} color={GLOW} />
      {tier === 4 && <Rect x={x} y={top + 4} width={width} height={2} color={GOLD} />}
    </Group>
  );
}

function Research({ rect, tier }: { rect: SceneRect; tier: number }) {
  const m = MATERIALS[tier - 1];
  const base = rect.y + rect.height;
  const width = 34 + 4 * tier;
  const height = 20 + 4 * tier;
  const x = rect.x + 2;
  const top = base - height;
  const towerHeight = height + 10 + 4 * tier;
  return (
    <Group>
      {tier >= 2 && (
        <Group>
          <Circle cx={x + width - 8} cy={base - towerHeight} r={8} color={tier === 4 ? GOLD : '#7f97a3'} />
          <Rect x={x + width - 16} y={base - towerHeight} width={16} height={towerHeight} color={m.shade} />
          <Rect x={x + width - 11} y={base - towerHeight + 6} width={5} height={6} color="#9fd0e0" />
          {tier >= 3 && <Path path={`M ${String(x + width - 8)} ${String(base - towerHeight - 4)} L ${String(x + width + 8)} ${String(base - towerHeight - 16)}`} style="stroke" strokeWidth={3} color="#5a4a3a" />}
        </Group>
      )}
      <Rect x={x} y={top} width={width - (tier >= 2 ? 14 : 0)} height={height} color={m.wall} />
      <Gable x={x} y={top} width={width - (tier >= 2 ? 14 : 0)} rise={9} color={m.roof} />
      <Windows x={x + 4} y={top + 6} count={tier >= 2 ? 2 : 3} gap={8} color="#9fd0e0" />
      <Rect x={x + 5} y={base - 9} width={6} height={9} color={DARK} />
    </Group>
  );
}

function Armory({ rect, tier }: { rect: SceneRect; tier: number }) {
  const m = MATERIALS[tier - 1];
  const base = rect.y + rect.height;
  const width = 30 + 3 * tier;
  const height = 20 + 5 * tier;
  const x = rect.x + 2;
  const top = base - height;
  return (
    <Group>
      <Rect x={x} y={top} width={width} height={height} color={m.wall} />
      {tier >= 3 ? <Crenels x={x} y={top} width={width} color={m.wall} /> : <Gable x={x} y={top} width={width} rise={9} color={m.roof} />}
      <Circle cx={x + width / 2} cy={top + 10} r={5} color={tier === 4 ? GOLD : BANNER} />
      <Rect x={x + width / 2 - 1} y={top + 6} width={2} height={8} color="#e8e0c8" />
      <Rect x={x + width / 2 - 5} y={base - 10} width={10} height={10} color={DARK} />
      {/* Weapon rack: a spear for each tier */}
      {Array.from({ length: tier + 1 }, (_, index) => (
        <Rect key={index} x={x + width + 3 + index * 3} y={base - 18} width={1.5} height={18} color="#b9b4a3" />
      ))}
      <Rect x={x + width + 1} y={base - 12} width={tier * 3 + 6} height={2} color={m.trim} />
    </Group>
  );
}

function Barracks({ rect, tier }: { rect: SceneRect; tier: number }) {
  const m = MATERIALS[tier - 1];
  const base = rect.y + rect.height;
  const width = 44 + 5 * tier;
  const height = 16 + 5 * tier;
  const x = rect.x + 2;
  const top = base - height;
  return (
    <Group>
      <Rect x={x} y={top} width={width} height={height} color={m.wall} />
      <Gable x={x} y={top} width={width} rise={8} color={m.roof} />
      <Windows x={x + 5} y={top + 5} count={Math.floor((width - 10) / 9)} gap={9} />
      {tier >= 3 && <Windows x={x + 5} y={base - 10} count={Math.floor((width - 10) / 9)} gap={9} />}
      <Rect x={x + width / 2 - 4} y={base - 10} width={8} height={10} color={DARK} />
      {tier >= 2 && [x + 2, x + width - 6].map((bx) => <Rect key={bx} x={bx} y={top + 2} width={4} height={10} color={tier === 4 ? GOLD : BANNER} />)}
      {/* Training dummies in the yard */}
      {Array.from({ length: Math.min(3, tier) }, (_, index) => (
        <Group key={index}>
          <Rect x={rect.x + rect.width - 4 - index * 7} y={base - 12} width={2} height={12} color="#8c6a3c" />
          <Rect x={rect.x + rect.width - 7 - index * 7} y={base - 9} width={8} height={2} color="#8c6a3c" />
          <Circle cx={rect.x + rect.width - 3 - index * 7} cy={base - 13} r={2} color="#d8c48f" />
        </Group>
      ))}
    </Group>
  );
}

function Stables({ rect, tier }: { rect: SceneRect; tier: number }) {
  const m = MATERIALS[tier - 1];
  const base = rect.y + rect.height;
  const width = 36 + 6 * tier;
  const height = 16 + 4 * tier;
  const x = rect.x + 2;
  const top = base - height;
  const stalls = tier + 1;
  return (
    <Group>
      <Rect x={x} y={top} width={width} height={height} color={m.wall} />
      <Gable x={x} y={top} width={width} rise={9} color={m.roof} />
      {Array.from({ length: stalls }, (_, index) => (
        <Rect key={index} x={x + 3 + index * ((width - 6) / stalls)} y={base - 11} width={(width - 6) / stalls - 2} height={11} color={DARK} />
      ))}
      {/* Fence and horses */}
      <Rect x={x + width + 1} y={base - 7} width={rect.width - width - 3} height={1.5} color="#8c6a3c" />
      <Rect x={x + width + 1} y={base - 3} width={rect.width - width - 3} height={1.5} color="#8c6a3c" />
      {Array.from({ length: Math.min(tier, 3) }, (_, index) => {
        const hx = x + 6 + index * 14;
        return (
          <Group key={index}>
            <Rect x={hx} y={base - 7} width={10} height={4} color={index % 2 ? '#5a3a24' : '#7a5232'} />
            <Rect x={hx + 9} y={base - 10} width={3} height={4} color={index % 2 ? '#5a3a24' : '#7a5232'} />
            <Rect x={hx + 1} y={base - 3} width={1.5} height={3} color="#3a2a1c" />
            <Rect x={hx + 7} y={base - 3} width={1.5} height={3} color="#3a2a1c" />
          </Group>
        );
      })}
    </Group>
  );
}

function Gate({ rect, tier }: { rect: SceneRect; tier: number }) {
  const m = MATERIALS[tier - 1];
  const base = rect.y + rect.height;
  const centre = rect.x + rect.width / 2;
  if (tier === 1) {
    return (
      <Group>
        <Rect x={centre - 18} y={base - 34} width={5} height={34} color={m.trim} />
        <Rect x={centre + 13} y={base - 34} width={5} height={34} color={m.trim} />
        <Rect x={centre - 20} y={base - 34} width={40} height={4} color={m.wall} />
        <Rect x={centre - 13} y={base - 24} width={12} height={24} color={m.wall} />
        <Rect x={centre + 1} y={base - 24} width={12} height={24} color={m.shade} />
      </Group>
    );
  }
  const height = 30 + 7 * tier;
  const width = 36 + 2 * tier;
  return (
    <Group>
      {tier >= 3 && [centre - width / 2 - 8, centre + width / 2 - 6].map((x) => (
        <Group key={x}>
          <Rect x={x} y={base - height - 8} width={14} height={height + 8} color={m.shade} />
          <Crenels x={x} y={base - height - 8} width={14} color={m.shade} size={3} />
          {tier === 4 && <Flag x={x + 7} y={base - height - 12} color={GOLD} />}
        </Group>
      ))}
      <Rect x={centre - width / 2} y={base - height} width={width} height={height} color={m.wall} />
      <Crenels x={centre - width / 2} y={base - height} width={width} color={m.wall} />
      <Rect x={centre - 9} y={base - 26} width={18} height={26} color={DARK} />
      <Circle cx={centre} cy={base - 26} r={9} color={DARK} />
      {/* Portcullis */}
      {[-6, -2, 2, 6].map((dx) => <Rect key={dx} x={centre + dx - 0.5} y={base - 30} width={1} height={tier === 4 ? 14 : 8} color={tier === 4 ? GOLD : '#8a8477'} />)}
    </Group>
  );
}

// The wall along the back: a pointed palisade, then timber on stone, stone, and tall stone with banners.
function Wall({ tier }: { tier: number }) {
  const m = MATERIALS[tier - 1];
  const left = WALL_LEFT;
  const right = WALL_RIGHT;
  const height = 12 + 6 * tier;
  const top = WALL_BASE - height;
  if (tier === 1) {
    return (
      <Group>
        {Array.from({ length: Math.floor((right - left) / 5) }, (_, index) => {
          const x = left + index * 5;
          return <Path key={index} path={`M ${String(x)} ${String(WALL_BASE)} L ${String(x)} ${String(top + 3)} L ${String(x + 2)} ${String(top)} L ${String(x + 4)} ${String(top + 3)} L ${String(x + 4)} ${String(WALL_BASE)} Z`} color={index % 2 ? m.wall : m.shade} />;
        })}
      </Group>
    );
  }
  return (
    <Group>
      <Rect x={left} y={top} width={right - left} height={height} color={m.wall} />
      {tier === 2 && <Rect x={left} y={WALL_BASE - 8} width={right - left} height={8} color="#8e8f84" />}
      {tier >= 3 && Array.from({ length: Math.floor((right - left) / 16) }, (_, index) => (
        <Rect key={index} x={left + index * 16 + (Math.floor(index / 1) % 2) * 4} y={top + 6 + (index % 2) * 6} width={10} height={1} color={m.shade} />
      ))}
      <Crenels x={left} y={top} width={right - left} color={m.wall} size={5} />
      {tier === 4 && [110, 200, 400, 490].map((x) => <Rect key={x} x={x} y={top + 2} width={6} height={12} color={BANNER} />)}
    </Group>
  );
}

// Towers: the two big ones at the ends of the hold, then smaller ones along the wall as they grow.
const BACK_TOWER_X = [150, 450, 300];

function BackTowers({ level }: { level: number }) {
  const tier = tierOf(level);
  if (tier === 0) return null;
  const m = MATERIALS[tier - 1];
  const extra = towerCount(level) - 2;
  const height = 34 + 8 * tier;
  return BACK_TOWER_X.slice(0, extra).map((x) => (
    <Group key={x}>
      <Rect x={x - 9} y={WALL_BASE - height} width={18} height={height} color={m.shade} />
      {tier >= 3 ? <Gable x={x - 9} y={WALL_BASE - height} width={18} rise={12} color={m.roof} /> : <Crenels x={x - 9} y={WALL_BASE - height} width={18} color={m.shade} size={3} />}
      <Rect x={x - 2} y={WALL_BASE - height + 8} width={4} height={6} color={WINDOW} />
    </Group>
  ));
}

function EdgeTowers({ level, job }: { level: number; job?: Construction }) {
  const tier = tierOf(level);
  return [BUILDING_PLOTS.towers.x, EXTRA_HOTSPOTS[0].rect.x].map((x) => {
    const rect = { ...BUILDING_PLOTS.towers, x };
    if (tier === 0) return <Group key={x}><EmptyPlot rect={rect} /><Scaffold rect={rect} job={job} /></Group>;
    const m = MATERIALS[tier - 1];
    const height = 62 + 18 * tier;
    const top = FRONT_BASE - height;
    const left = x + 4;
    const width = 28;
    return (
      <Group key={x}>
        {tier === 1 ? (
          // A timber watchtower: legs, a platform and a little roof.
          <Group>
            {[left + 2, left + width - 5].map((lx) => <Rect key={lx} x={lx} y={top + 10} width={3} height={height - 10} color={m.trim} />)}
            <Path path={`M ${String(left + 3)} ${String(top + 24)} L ${String(left + width - 4)} ${String(FRONT_BASE - 4)} M ${String(left + width - 4)} ${String(top + 24)} L ${String(left + 3)} ${String(FRONT_BASE - 4)}`} style="stroke" strokeWidth={1.5} color={m.shade} />
            <Rect x={left - 2} y={top + 10} width={width + 4} height={14} color={m.wall} />
            <Gable x={left - 2} y={top + 10} width={width + 4} rise={10} color={m.roof} />
          </Group>
        ) : (
          <Group>
            <Rect x={left} y={top} width={width} height={height} color={m.wall} />
            <Rect x={left - 3} y={top} width={width + 6} height={8} color={m.shade} />
            {tier >= 3
              ? <Gable x={left - 3} y={top} width={width + 6} rise={18} color={m.roof} />
              : <Crenels x={left - 3} y={top} width={width + 6} color={m.shade} size={4} />}
            <Windows x={left + 12} y={top + 16} count={1} gap={0} width={4} height={8} />
            <Windows x={left + 12} y={top + 46} count={1} gap={0} width={4} height={8} />
            {tier === 4 && <Flag x={left + width / 2} y={top - 18} color={GOLD} />}
          </Group>
        )}
        <Scaffold rect={rect} job={job} />
      </Group>
    );
  });
}

// The mine headframe over the shaft (tap it to go down).
function Headframe() {
  const x = HEADFRAME_X;
  const base = FRONT_BASE;
  return (
    <Group>
      <Rect x={x + 22} y={base - 98} width={12} height={6} color="#493b2a" />
      <Rect x={x + 2} y={base - 92} width={52} height={5} color="#c28d52" />
      <Rect x={x + 6} y={base - 87} width={6} height={87} color="#805a3c" />
      <Rect x={x + 44} y={base - 87} width={6} height={87} color="#805a3c" />
      <Rect x={x} y={base - 70} width={56} height={6} color="#bd8d55" />
      <Rect x={x + 16} y={base - 34} width={24} height={34} color="#171d1b" />
      <Rect x={x + 27} y={base - 87} width={2} height={87} color="#bd8d55" />
      <Rect x={x + 10} y={base + 10} width={36} height={22} color="#222720" />
      <Rect x={x + 18} y={base + 10} width={20} height={22} color="#151b19" />
      <Rect x={x + 27} y={base + 10} width={2} height={22} color="#d2ae70" />
      <Rect x={x - 14} y={base - 7} width={10} height={7} color="#26262a" />
      <Rect x={x - 12} y={base - 10} width={6} height={4} color="#3a3a40" />
    </Group>
  );
}

// One figure for every kind of unit in the army, drilling in the yard.
function Yard({ units }: { units: (typeof ARMY_UNITS)[number][] }) {
  const pixel = 1.6;
  return units.map((unit, index) => {
    const left = YARD.x + 4 + index * 17;
    const top = FRONT_BASE - 12 * pixel - 1;
    return (
      <Group key={unit}>
        {spritePixels(unit).map((p, i) => (
          <Rect key={i} x={left + p.x * pixel} y={top + p.y * pixel} width={pixel + 0.2} height={pixel + 0.2} color={p.color} />
        ))}
      </Group>
    );
  });
}

// ——— Dwellings ———

function Guardhouse({ rect, tier }: { rect: SceneRect; tier: number }) {
  const m = MATERIALS[tier - 1];
  const base = rect.y + rect.height;
  const width = 28 + 3 * tier;
  const height = 18 + 4 * tier;
  const x = rect.x + 2;
  const top = base - height;
  return (
    <Group>
      {/* A rack of pikes */}
      {Array.from({ length: tier + 2 }, (_, index) => (
        <Group key={index}>
          <Rect x={x + width + 4 + index * 4} y={base - 30 - tier * 2} width={1.5} height={30 + tier * 2} color="#8c6a3c" />
          <Rect x={x + width + 3.5 + index * 4} y={base - 34 - tier * 2} width={2.5} height={4} color="#c9ccd1" />
        </Group>
      ))}
      <Rect x={x} y={top} width={width} height={height} color={m.wall} />
      {tier >= 2 ? <Crenels x={x} y={top} width={width} color={m.wall} size={3} /> : <Gable x={x} y={top} width={width} rise={8} color={m.roof} />}
      <Rect x={x + width / 2 - 4} y={base - 10} width={8} height={10} color={DARK} />
      <Windows x={x + 4} y={top + 5} count={2} gap={width - 12} />
      {tier >= 3 && (
        <Group>
          <Rect x={x - 4} y={top - 10} width={10} height={height + 10} color={m.shade} />
          <Crenels x={x - 4} y={top - 10} width={10} color={m.shade} size={3} />
        </Group>
      )}
      {tier === 4 && <Rect x={x} y={top + 3} width={width} height={2} color={GOLD} />}
    </Group>
  );
}

function ArcheryRange({ rect, tier }: { rect: SceneRect; tier: number }) {
  const m = MATERIALS[tier - 1];
  const base = rect.y + rect.height;
  const width = 28 + 3 * tier;
  const height = 16 + 3 * tier;
  const x = rect.x + 2;
  const top = base - height;
  return (
    <Group>
      <Rect x={x} y={top} width={width} height={height} color={m.wall} />
      <Gable x={x} y={top} width={width} rise={8} color={m.roof} />
      <Rect x={x + 4} y={top + 6} width={width - 8} height={height - 6} color={DARK} />
      {tier === 4 && <Rect x={x} y={top + 2} width={width} height={2} color={GOLD} />}
      {/* Targets */}
      {Array.from({ length: Math.min(3, tier + 1) }, (_, index) => {
        const cx = rect.x + rect.width - 6 - index * 11;
        return (
          <Group key={index}>
            <Rect x={cx - 0.75} y={base - 10} width={1.5} height={10} color="#8c6a3c" />
            <Circle cx={cx} cy={base - 13} r={5} color="#ece6d4" />
            <Circle cx={cx} cy={base - 13} r={3.3} color={BANNER} />
            <Circle cx={cx} cy={base - 13} r={1.4} color="#ece6d4" />
          </Group>
        );
      })}
    </Group>
  );
}

function Monastery({ rect, tier }: { rect: SceneRect; tier: number }) {
  const m = MATERIALS[tier - 1];
  const base = rect.y + rect.height;
  const width = 30 + 3 * tier;
  const height = 18 + 4 * tier;
  const x = rect.x + 2;
  const top = base - height;
  const towerHeight = height + 14 + 4 * tier;
  const tx = x + width - 2;
  return (
    <Group>
      <Rect x={x} y={top} width={width} height={height} color={m.wall} />
      <Gable x={x} y={top} width={width} rise={9} color={m.roof} />
      <Rect x={tx} y={base - towerHeight} width={11} height={towerHeight} color={m.shade} />
      <Gable x={tx} y={base - towerHeight} width={11} rise={12} color={m.roofShade} />
      <Circle cx={tx + 5.5} cy={base - towerHeight + 7} r={3} color={GOLD} />
      {Array.from({ length: Math.floor((width - 8) / 9) }, (_, index) => (
        <Group key={index}>
          <Rect x={x + 5 + index * 9} y={top + 7} width={4} height={6} color={GLOW} />
          <Circle cx={x + 7 + index * 9} cy={top + 7} r={2} color={GLOW} />
        </Group>
      ))}
      <Rect x={x + 4} y={base - 9} width={6} height={9} color={DARK} />
    </Group>
  );
}

function BalloonWorks({ rect, tier }: { rect: SceneRect; tier: number }) {
  const m = MATERIALS[tier - 1];
  const base = rect.y + rect.height;
  const width = 32 + 4 * tier;
  const height = 16 + 3 * tier;
  const x = rect.x + 2;
  const top = base - height;
  const balloon = (cx: number, cy: number, r: number, key: string) => (
    <Group key={key}>
      <Path path={`M ${String(cx - r * 0.6)} ${String(cy + r * 0.7)} L ${String(cx - 3)} ${String(cy + r + 9)} M ${String(cx + r * 0.6)} ${String(cy + r * 0.7)} L ${String(cx + 3)} ${String(cy + r + 9)}`} style="stroke" strokeWidth={1} color={DARK} />
      <Circle cx={cx} cy={cy} r={r} color={BANNER} />
      <Rect x={cx - r * 0.35} y={cy - r + 1} width={r * 0.7} height={r * 2 - 2} color="#ece6d4" />
      <Rect x={cx - 4} y={cy + r + 8} width={8} height={5} color="#8c6a3c" />
    </Group>
  );
  return (
    <Group>
      {balloon(x + width / 2, top - 28 - tier * 2, 9 + tier, 'main')}
      {tier >= 3 && balloon(rect.x + rect.width - 8, top - 18, 7, 'second')}
      <Rect x={x} y={top} width={width} height={height} color={m.wall} />
      <Gable x={x} y={top} width={width} rise={8} color={m.roof} />
      <Rect x={x + width / 2 - 8} y={base - 13} width={16} height={13} color={DARK} />
      {tier === 4 && <Rect x={x} y={top + 2} width={width} height={2} color={GOLD} />}
    </Group>
  );
}

function GriffinEyrie({ rect, tier }: { rect: SceneRect; tier: number }) {
  const m = MATERIALS[tier - 1];
  const base = rect.y + rect.height;
  const centre = rect.x + rect.width / 2;
  const height = 44 + 11 * tier;
  const top = base - height;
  const half = 20;
  return (
    <Group>
      {tier >= 3 ? (
        <Group>
          <Rect x={centre - 9} y={top} width={18} height={height} color={m.wall} />
          <Crenels x={centre - 11} y={top} width={22} color={m.wall} size={3} />
          <Windows x={centre - 2} y={top + 12} count={1} gap={0} width={4} height={7} />
        </Group>
      ) : (
        <Path path={`M ${String(centre - half)} ${String(base)} L ${String(centre - 7)} ${String(top)} L ${String(centre + 6)} ${String(top + 4)} L ${String(centre + half)} ${String(base)} Z`} color={tier === 1 ? '#8e8a7c' : '#9c9a8c'} />
      )}
      {tier === 2 && <Rect x={centre - 12} y={top + 4} width={24} height={3} color="#8c6a3c" />}
      {/* Nest and its griffin */}
      <Rect x={centre - 10} y={top - 4} width={20} height={5} color="#7a5232" />
      <Rect x={centre - 4} y={top - 10} width={9} height={6} color="#c9a34a" />
      <Path path={`M ${String(centre - 3)} ${String(top - 9)} L ${String(centre - 14)} ${String(top - 18)} L ${String(centre - 6)} ${String(top - 7)} Z`} color="#ece6d4" />
      <Path path={`M ${String(centre + 3)} ${String(top - 9)} L ${String(centre + 13)} ${String(top - 19)} L ${String(centre + 7)} ${String(top - 7)} Z`} color="#ece6d4" />
      <Rect x={centre + 4} y={top - 13} width={4} height={4} color="#ece6d4" />
      <Rect x={centre + 8} y={top - 12} width={2} height={2} color="#e08a3a" />
      {tier === 4 && <Flag x={centre - 9} y={top - 4} color={GOLD} />}
    </Group>
  );
}

function Chapel({ rect, tier }: { rect: SceneRect; tier: number }) {
  const m = MATERIALS[tier - 1];
  const base = rect.y + rect.height;
  const width = 32 + 3 * tier;
  const height = 20 + 4 * tier;
  const x = rect.x + 12;
  const top = base - height;
  const steeple = height + 16 + 4 * tier;
  return (
    <Group>
      <Rect x={rect.x + 1} y={base - steeple} width={12} height={steeple} color={m.shade} />
      <Gable x={rect.x + 1} y={base - steeple} width={12} rise={14} color={m.roofShade} />
      <Circle cx={rect.x + 7} cy={base - steeple - 16} r={3} color={GOLD} />
      <Rect x={x} y={top} width={width} height={height} color={m.wall} />
      <Gable x={x} y={top} width={width} rise={13} color={m.roof} />
      <Circle cx={x + width / 2} cy={top + 9} r={5} color="#7fa8d0" />
      <Circle cx={x + width / 2} cy={top + 9} r={2} color={GOLD} />
      <Rect x={x + width / 2 - 5} y={base - 12} width={10} height={12} color={DARK} />
      {tier >= 2 && [x + 2, x + width - 6].map((bx) => <Rect key={bx} x={bx} y={top + 4} width={4} height={11} color={tier === 4 ? GOLD : '#ece6d4'} />)}
    </Group>
  );
}

function Sanctum({ rect, tier }: { rect: SceneRect; tier: number }) {
  const m = MATERIALS[tier - 1];
  const base = rect.y + rect.height;
  const marble = tier >= 2 ? '#e6e1d3' : m.wall;
  const width = 40 + 3 * tier;
  const x = rect.x + (rect.width - width) / 2;
  const height = 26 + 5 * tier;
  const top = base - height;
  const columns = 3 + tier;
  return (
    <Group>
      {tier >= 3 && <Circle cx={x + width / 2} cy={top - 4} r={width / 3.4} color={tier === 4 ? GOLD : '#c9c3b0'} />}
      <Rect x={x - 2} y={base - 4} width={width + 4} height={4} color={m.shade} />
      {/* The glowing portal between the columns */}
      <Rect x={x + 4} y={top + 4} width={width - 8} height={height - 8} color="#2b3550" />
      <Circle cx={x + width / 2} cy={top + height / 2} r={height / 3} color="#9fd0f0" opacity={0.85} />
      <Circle cx={x + width / 2} cy={top + height / 2} r={height / 6} color="#ffffff" />
      {Array.from({ length: columns }, (_, index) => (
        <Rect key={index} x={x + index * ((width - 4) / (columns - 1))} y={top} width={4} height={height - 4} color={marble} />
      ))}
      <Rect x={x - 3} y={top - 3} width={width + 6} height={4} color={marble} />
      <Gable x={x - 3} y={top - 3} width={width + 6} rise={10} color={tier === 4 ? GOLD : marble} />
    </Group>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', overflow: 'hidden' },
  canvas: { flex: 1 },
});
