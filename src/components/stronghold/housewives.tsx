// The cottages' women on their errands (game/homes.ts): each walks the way the simulation timed, from
// her cottage to the river or the store and back — empty-handed out, a bucket of water or a basket of
// food home — on the game clock, smoothed between ticks. A woman at home isn't drawn.
import { memo, useEffect, useMemo } from 'react';
import { Group, Rect } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useGameSlice } from '../../game/gameStore';
import { FOOTPRINTS, spotOf, type Placements } from '../../game/cityMap';
import { HOUSE_IDS, type HouseId } from '../../game/houses';
import type { Errand } from '../../game/homes';
import { walkBetween, type Roads } from '../../game/roads';
import { TILE_HH, TILE_HW } from '../GameSceneLayout';
import { ORIGIN } from './shapes';

const DRESSES = ['#8a4a5a', '#5a6a8a', '#7a6a3a', '#6a4a7a', '#4a7a6a'];

export function Housewives({ clock, placements, roads, clearedRocks, live }: { clock: SharedValue<number>; placements: Placements; roads: Roads; clearedRocks: string[]; live: boolean }) {
  const homes = useGameSlice((state) => state.homes, live);
  const elapsed = useGameSlice((state) => state.elapsedSeconds, live);
  // The game second, and the scene clock when it began.
  const anchor = useSharedValue([elapsed, 0]);
  useEffect(() => {
    anchor.set([elapsed, clock.get()]);
  }, [elapsed, anchor, clock]);
  return HOUSE_IDS.map((id, index) => {
    const errand = homes[id]?.errand;
    return errand ? (
      <Housewife key={id} id={id} errand={errand} dress={DRESSES[index % DRESSES.length]} anchor={anchor} clock={clock} placements={placements} roads={roads} clearedRocks={clearedRocks} />
    ) : null;
  });
}

const Housewife = memo(function Housewife({ id, errand, dress, anchor, clock, placements, roads, clearedRocks }: {
  id: HouseId;
  errand: Errand;
  dress: string;
  anchor: SharedValue<number[]>;
  clock: SharedValue<number>;
  placements: Placements;
  roads: Roads;
  clearedRocks: string[];
}) {
  // Her way there, its timetable stretched to the errand's (the roads may have changed since she set off).
  const route = useMemo(() => {
    const spot = spotOf(id, placements);
    const walk = spot ? walkBetween({ ...spot, ...FOOTPRINTS[id] }, errand.to, placements, roads, clearedRocks) : null;
    if (!walk || walk.points.length < 2) return null;
    const scale = walk.time > 0 ? errand.seconds / walk.time : 0;
    return { points: walk.points.flat(), times: walk.times.map((t) => t * scale) };
  }, [id, errand, placements, roads, clearedRocks]);
  const points = route?.points ?? [];
  const times = route?.times ?? [];
  const { startedAt, seconds } = errand;
  const ox = ORIGIN.x;
  const oy = ORIGIN.y;
  const hw = TILE_HW;
  const hh = TILE_HH;
  // [screen x, screen y, carrying (1/0), shown (1/0)]
  const pose = useDerivedValue(() => {
    const [second, at] = anchor.get();
    const t = second + Math.min(1, Math.max(0, clock.get() - at)) - startedAt;
    if (points.length < 4 || t < 0 || t >= 2 * seconds) return [0, 0, 0, 0];
    const home = t >= seconds;
    const s = home ? 2 * seconds - t : t;
    let x = points[points.length - 2];
    let y = points[points.length - 1];
    for (let i = 1; i < times.length; i++) {
      if (s <= times[i]) {
        const span = times[i] - times[i - 1];
        const f = span > 0 ? (s - times[i - 1]) / span : 1;
        x = points[2 * i - 2] + (points[2 * i] - points[2 * i - 2]) * f;
        y = points[2 * i - 1] + (points[2 * i + 1] - points[2 * i - 1]) * f;
        break;
      }
    }
    const bob = Math.abs(Math.sin(clock.get() * 9 + startedAt)) * 1.0;
    return [ox + (x - y) * hw, oy + (x + y) * hh - bob, home ? 1 : 0, 1];
  });
  const transform = useDerivedValue(() => [{ translateX: pose.get()[0] }, { translateY: pose.get()[1] }]);
  const shown = useDerivedValue(() => pose.get()[3]);
  const carrying = useDerivedValue(() => pose.get()[2]);
  if (!route) return null;
  const water = errand.kind === 'water';
  return (
    <Group transform={transform} opacity={shown}>
      {/* A long skirt shaded on its far side, a bodice with sleeves, a white apron, her face and headscarf. */}
      <Rect x={-2.2} y={-4.6} width={4.4} height={4.4} color={dress} />
      <Rect x={0.9} y={-4.6} width={1.3} height={4.4} color="rgba(0, 0, 0, 0.22)" />
      <Rect x={-1.9} y={-0.4} width={1.3} height={0.4} color="#3a2a1c" />
      <Rect x={0.5} y={-0.4} width={1.3} height={0.4} color="#3a2a1c" />
      <Rect x={-1.6} y={-7.2} width={3.2} height={2.8} color={dress} />
      <Rect x={-2.1} y={-6.9} width={0.6} height={2.4} color={dress} />
      <Rect x={1.5} y={-6.9} width={0.6} height={2.4} color={dress} />
      <Rect x={1.5} y={-6.9} width={0.6} height={2.4} color="rgba(0, 0, 0, 0.22)" />
      <Rect x={-2.1} y={-4.6} width={0.6} height={0.6} color="#e0b48a" />
      <Rect x={1.5} y={-4.6} width={0.6} height={0.6} color="#e0b48a" />
      <Rect x={-1.0} y={-5.6} width={2.2} height={4.6} color="#ece6d4" />
      <Rect x={-1.6} y={-4.9} width={3.2} height={0.4} color="#bdb6a2" />
      <Rect x={-1.1} y={-9.2} width={2.2} height={2.2} color="#e0b48a" />
      <Rect x={0.55} y={-9.2} width={0.55} height={2.2} color="#b4865e" />
      <Rect x={0.25} y={-8.4} width={0.4} height={0.45} color="#2a2620" />
      <Rect x={-1.35} y={-9.8} width={2.7} height={1.3} color="#ece6d4" />
      <Rect x={-1.6} y={-9.0} width={0.8} height={1.6} color="#ece6d4" />
      {/* What she carries home: a bucket of water, or a basket of food. */}
      <Group opacity={carrying}>
        {water ? (
          <Group>
            <Rect x={1.9} y={-4.2} width={1.9} height={2.6} color="#7b8794" />
            <Rect x={1.9} y={-4.4} width={1.9} height={0.6} color="#5c9fcf" />
          </Group>
        ) : (
          <Group>
            <Rect x={1.8} y={-4.4} width={2.4} height={2.2} color="#9a7342" />
            <Rect x={2.0} y={-5.0} width={0.8} height={0.8} color="#b5462f" />
            <Rect x={3.0} y={-5.0} width={0.8} height={0.8} color="#c9a24a" />
          </Group>
        )}
      </Group>
    </Group>
  );
});
