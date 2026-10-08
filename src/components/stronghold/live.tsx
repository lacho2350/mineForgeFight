// The live layer: what moves or changes often — stockpiles, smoke and balloons, the mine wheel, carts,
// barges and progress bars.
import { memo, useEffect, useMemo } from 'react';
import { Circle, Group, Line, Path, Rect, vec } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { Construction } from '../../game/state';
import { useGameStore } from '../../game/gameStore';
import type { BuildingId } from '../../game/buildings';
import type { Placements } from '../../game/cityMap';
import { BERTHS, bargePose, bargeRoute } from '../../game/ship';
import { wagonStops, type WagonJob } from '../../game/wagons';
import { walkBetween, type Roads } from '../../game/roads';
import { RESOURCES, RESOURCE_INFO } from '../../game/resources';
import { CAMPFIRE, TILE_HH, TILE_HW, iso, plotOf, type Plot } from '../GameSceneLayout';
import { parseSvg, useSvgPaths } from '../skiaPaths';
import { BANNER, DARK, ORIGIN, poly, tierOf, type P } from './shapes';
import { CartArt, WHEEL } from './buildingArt';

/** Stockpiles change look in steps, so ordinary ticks don't redraw the castle. */
export const PILE_STEPS = 6;

// The warehouse's piles, one per resource, growing with the stock (in steps). They change often,
// so they're drawn live instead of making the still image redraw.
export const Piles = memo(function Piles({ steps, plot }: { steps: string; plot: Plot }) {
  const piles = steps.split(',').map(Number);
  // Each pile a little pyramid: its two lit faces in the resource's colour, the two shaded ones darker.
  const svgs = RESOURCES.flatMap((resource, index) => {
    const fill = piles[index] / PILE_STEPS;
    if (fill <= 0) return ['', ''];
    const x = plot.x + 0.15 + (index % 4) * 0.7;
    const y = plot.y + 1.45 + Math.floor(index / 4) * 0.5;
    const [A, B, C, D] = [iso(x, y), iso(x + 0.55, y), iso(x + 0.55, y + 0.4), iso(x, y + 0.4)];
    const apex = iso(x + 0.275, y + 0.2, 3 + 9 * fill);
    return [`${poly([A, D, apex])} ${poly([D, C, apex])}`, `${poly([A, B, apex])} ${poly([B, C, apex])}`];
  });
  const paths = useSvgPaths(svgs);
  return (
    <Group>
      {RESOURCES.map((resource, index) =>
        svgs[index * 2] ? (
          <Group key={resource}>
            <Path path={paths[index * 2]} color={RESOURCE_INFO[resource].color} />
            <Path path={paths[index * 2 + 1]} color={RESOURCE_INFO[resource].dark} />
          </Group>
        ) : null,
      )}
    </Group>
  );
});

/** Where the animated bits are: foundry smoke, balloons over the Balloon Works. */
function liveAnchors(buildings: Record<BuildingId, number>, placements: Placements) {
  const foundry = tierOf(buildings.foundry);
  const balloons = tierOf(buildings.balloonWorks);
  const f = plotOf('foundry', placements);
  const b = plotOf('balloonWorks', placements);
  const stack = 16 + 3 * foundry + 18 + 4 * foundry;
  const shed = 12 + 3 * balloons;
  return {
    smoke: f ? Array.from({ length: Math.min(3, foundry) }, (_, index) => iso(f.x + 0.57 + index * 0.75, f.y + 0.42, stack)) : [],
    balloons: !b || balloons === 0 ? [] : [
      { at: iso(b.x + b.w / 2, b.y + b.d / 2, shed + 40 + 3 * balloons), r: 9 + balloons },
      ...(balloons >= 3 ? [{ at: iso(b.x + b.w - 0.3, b.y + 0.4, shed + 24), r: 7 }] : []),
    ],
  };
}

export const LiveBits = memo(function LiveBits({ buildings, placements, clock }: { buildings: Record<BuildingId, number>; placements: Placements; clock: SharedValue<number> }) {
  const anchors = useMemo(() => liveAnchors(buildings, placements), [buildings, placements]);
  return (
    <Group>
      {anchors.smoke.map((at, index) => <Smoke key={index} clock={clock} at={at} phase={index * 0.37} />)}
      {anchors.balloons.map((balloon, index) => <Balloon key={index} clock={clock} at={balloon.at} r={balloon.r} phase={index * 1.3} />)}
      <Flame clock={clock} />
      <Wheel clock={clock} />
    </Group>
  );
});

function Smoke({ clock, at, phase }: { clock: SharedValue<number>; at: P; phase: number }) {
  const first = useDerivedValue(() => {
    const t = (clock.get() * 0.5 + phase) % 1;
    return [{ translateX: at.x + t * 10 }, { translateY: at.y - 4 - t * 22 }, { scale: 0.6 + t * 1.2 }];
  });
  const second = useDerivedValue(() => {
    const t = (clock.get() * 0.5 + phase + 0.5) % 1;
    return [{ translateX: at.x + t * 10 }, { translateY: at.y - 4 - t * 22 }, { scale: 0.6 + t * 1.2 }];
  });
  return (
    <Group>
      <Group transform={first}><Circle cx={0} cy={0} r={4} color="rgba(200, 196, 184, 0.7)" /></Group>
      <Group transform={second}><Circle cx={0} cy={0} r={4} color="rgba(214, 210, 198, 0.55)" /></Group>
    </Group>
  );
}

function Balloon({ clock, at, r, phase }: { clock: SharedValue<number>; at: P; r: number; phase: number }) {
  const transform = useDerivedValue(() => [{ translateX: at.x }, { translateY: at.y + Math.sin(clock.get() * 1.4 + phase) * 3 }]);
  return (
    <Group transform={transform}>
      <Line p1={vec(-r * 0.6, r * 0.7)} p2={vec(-3, r + 8)} color={DARK} strokeWidth={1} />
      <Line p1={vec(r * 0.6, r * 0.7)} p2={vec(3, r + 8)} color={DARK} strokeWidth={1} />
      <Circle cx={0} cy={0} r={r} color={BANNER} />
      <Rect x={-r * 0.35} y={-r + 1} width={r * 0.7} height={r * 2 - 2} color="#ece6d4" />
      <Rect x={-4} y={r + 7} width={8} height={5} color="#8c6a3c" />
    </Group>
  );
}

function Flame({ clock }: { clock: SharedValue<number> }) {
  const c = iso(CAMPFIRE.x, CAMPFIRE.y);
  const flame = useDerivedValue(() => 4 + Math.sin(clock.get() * 11) * 1.2 + Math.sin(clock.get() * 17) * 0.8);
  const core = useDerivedValue(() => 2.4 + Math.sin(clock.get() * 13 + 1) * 0.8);
  return (
    <Group>
      <Circle cx={c.x} cy={c.y - 4} r={flame} color="#f08a3a" />
      <Circle cx={c.x} cy={c.y - 3} r={core} color="#ffd36a" />
    </Group>
  );
}

function Wheel({ clock }: { clock: SharedValue<number> }) {
  const spin = useDerivedValue(() => [{ translateX: WHEEL.x }, { translateY: WHEEL.y }, { rotate: clock.get() * 1.5 }]);
  return (
    <Group transform={spin}>
      <Circle cx={0} cy={0} r={7} style="stroke" strokeWidth={2} color="#c28d52" />
      <Line p1={vec(-7, 0)} p2={vec(7, 0)} color="#c28d52" strokeWidth={1.5} />
      <Line p1={vec(0, -7)} p2={vec(0, 7)} color="#c28d52" strokeWidth={1.5} />
    </Group>
  );
}

// The depot's carts on their trips: each follows the roads from the depot to its first stop, on to the
// second and back (the same walks the simulation timed, stretched to its legs), loaded on the middle leg.
type WagonRoute = { points: number[]; times: number[] };
export function Wagons({ clock, placements, roads, clearedRocks }: { clock: SharedValue<number>; placements: Placements; roads: Roads; clearedRocks: string[] }) {
  const jobs = useGameStore((state) => state.wagonJobs);
  const elapsed = useGameStore((state) => state.elapsedSeconds);
  const anchor = useSharedValue([elapsed, 0]);
  useEffect(() => {
    anchor.set([elapsed, clock.get()]);
  }, [elapsed, anchor, clock]);
  return jobs.map((job) => <WagonSprite key={job.id} job={job} anchor={anchor} clock={clock} placements={placements} roads={roads} clearedRocks={clearedRocks} />);
}

function wagonRoute(job: WagonJob, placements: Placements, roads: Roads, clearedRocks: string[]): WagonRoute | null {
  const stops = wagonStops(job).map((id) => plotOf(id, placements));
  const points: number[] = [];
  const times: number[] = [];
  let offset = 0;
  for (let leg = 0; leg < 3; leg++) {
    const [from, to] = [stops[leg], stops[leg + 1]];
    if (!from || !to) return null;
    const walk = walkBetween(from, to, placements, roads, clearedRocks);
    if (!walk || walk.points.length === 0) return null;
    const scale = walk.time > 0 ? job.legs[leg] / walk.time : 0;
    walk.points.forEach(([px, py], index) => {
      points.push(px, py);
      times.push(offset + walk.times[index] * scale);
    });
    offset += job.legs[leg];
  }
  return { points, times };
}

const ITEM_TINT = '#b4b8c0';
const WagonSprite = memo(function WagonSprite({ job, anchor, clock, placements, roads, clearedRocks }: {
  job: WagonJob;
  anchor: SharedValue<number[]>;
  clock: SharedValue<number>;
  placements: Placements;
  roads: Roads;
  clearedRocks: string[];
}) {
  const route = useMemo(() => wagonRoute(job, placements, roads, clearedRocks), [job, placements, roads, clearedRocks]);
  const firstResource = Object.keys(job.load.resources)[0] as keyof typeof RESOURCE_INFO | undefined;
  const load = firstResource ? RESOURCE_INFO[firstResource].color : Object.keys(job.load.items).length > 0 ? ITEM_TINT : null;
  const points = route?.points ?? [];
  const times = route?.times ?? [];
  const { startedAt, legs } = job;
  const ox = ORIGIN.x;
  const oy = ORIGIN.y;
  const hw = TILE_HW;
  const hh = TILE_HH;
  // [screen x, screen y, loaded (1/0), shown (1/0)]
  const pose = useDerivedValue(() => {
    const [second, at] = anchor.get();
    const t = second + Math.min(1, Math.max(0, clock.get() - at)) - startedAt;
    if (points.length < 2 || t < 0) return [0, 0, 0, 0];
    let x = points[points.length - 2];
    let y = points[points.length - 1];
    for (let i = 1; i < times.length; i++) {
      if (t <= times[i]) {
        const span = times[i] - times[i - 1];
        const f = span > 0 ? (t - times[i - 1]) / span : 1;
        x = points[2 * i - 2] + (points[2 * i] - points[2 * i - 2]) * f;
        y = points[2 * i - 1] + (points[2 * i + 1] - points[2 * i - 1]) * f;
        break;
      }
    }
    const loaded = t >= legs[0] && t < legs[0] + legs[1] ? 1 : 0;
    return [ox + (x - y) * hw, oy + (x + y) * hh, loaded, 1];
  });
  const transform = useDerivedValue(() => [{ translateX: pose.get()[0] }, { translateY: pose.get()[1] }]);
  const shown = useDerivedValue(() => pose.get()[3]);
  const loaded = useDerivedValue(() => pose.get()[2]);
  if (!route) return null;
  return (
    <Group transform={transform} opacity={shown}>
      <CartArt load={null} />
      {load && (
        <Group opacity={loaded}>
          <CartArt load={load} />
        </Group>
      )}
    </Group>
  );
});

// The river barges: each sails in from downriver, along the river to its berth (in the harbour or on
// the river by its mouth), waits there for its order to be filled, and sails off again — on the game
// clock (`bargePose`), smoothed between ticks. Nearer berths are drawn over farther ones.
export function Barges({ clock }: { clock: SharedValue<number> }) {
  const elapsed = useGameStore((state) => state.elapsedSeconds);
  const barges = useGameStore((state) => state.barges);
  // The game second, and the scene clock when it began.
  const anchor = useSharedValue([elapsed, 0]);
  useEffect(() => {
    anchor.set([elapsed, clock.get()]);
  }, [elapsed, anchor, clock]);
  const depth = (berth: number) => BERTHS[berth].x + BERTHS[berth].y;
  return [...barges]
    .sort((a, b) => depth(a.berth) - depth(b.berth))
    .map((barge) => (
      <BargeSprite
        key={barge.id}
        berth={barge.berth}
        arrivedAt={barge.arrivedAt}
        leftAt={barge.leftAt ?? -1}
        flag={RESOURCE_INFO[barge.resource].tint}
        anchor={anchor}
        clock={clock}
      />
    ));
}

const BargeSprite = memo(function BargeSprite({ berth, arrivedAt, leftAt, flag, anchor, clock }: {
  berth: number;
  arrivedAt: number;
  leftAt: number;
  flag: string;
  anchor: SharedValue<number[]>;
  clock: SharedValue<number>;
}) {
  const route = useMemo(() => bargeRoute(berth), [berth]);
  const pose = useDerivedValue(() => {
    const [second, at] = anchor.get();
    return bargePose(second + Math.min(1, Math.max(0, clock.get() - at)), arrivedAt, leftAt, route);
  });
  const ox = ORIGIN.x;
  const oy = ORIGIN.y;
  const hw = TILE_HW;
  const hh = TILE_HH;
  const transform = useDerivedValue(() => {
    const [x, y] = pose.get();
    return [{ translateX: ox + (x - y) * hw }, { translateY: oy + (x + y) * hh }];
  });
  const alongX = useDerivedValue(() => (pose.get()[3] === 1 && pose.get()[2] === 1 ? 1 : 0));
  const alongY = useDerivedValue(() => (pose.get()[3] === 1 && pose.get()[2] === 0 ? 1 : 0));
  return (
    <Group transform={transform}>
      <Group opacity={alongX}>
        <BargeArt alongX flag={flag} />
      </Group>
      <Group opacity={alongY}>
        <BargeArt alongX={false} flag={flag} />
      </Group>
    </Group>
  );
});

// A small inland barge drawn at the origin: hull, deck with crates, a mast and a sail, and a pennant in
// the color of the goods it wants.
const bargeShapes = new Map<boolean, ReturnType<typeof buildBargeShape>>();
const BargeArt = memo(function BargeArt({ alongX, flag }: { alongX: boolean; flag: string }) {
  let paths = bargeShapes.get(alongX);
  if (!paths) {
    paths = buildBargeShape(alongX);
    bargeShapes.set(alongX, paths);
  }
  return (
    <Group>
      <Path path={paths.hull} color="#4e3420" />
      <Path path={paths.deck} color="#8a6a42" />
      <Path path={paths.crates} color="#6e4a2f" />
      <Path path={paths.cratesTop} color="#b98a5a" />
      <Line p1={vec(paths.mast.a.x, paths.mast.a.y)} p2={vec(paths.mast.b.x, paths.mast.b.y)} strokeWidth={1.2} color="#3a2a1c" />
      <Path path={paths.sail} color="#ece4cc" />
      <Path path={paths.pennant} color={flag} />
    </Group>
  );
});
// A barge's shape heading along x or y, parsed once and kept.
function buildBargeShape(alongX: boolean) {
  const svg = (() => {
    // Tile offsets (along the barge, across it) to screen offsets, raised `z` pixels.
    const at = (u: number, v: number, z = 0) => {
      const [dx, dy] = alongX ? [u, v] : [v, u];
      return { x: (dx - dy) * TILE_HW, y: (dx + dy) * TILE_HH - z };
    };
    const outline = (z: number, scale = 1) =>
      poly([[-0.75, 0], [-0.55, -0.22], [0.55, -0.22], [0.75, 0], [0.55, 0.22], [-0.55, 0.22]].map(([u, v]) => at(u * scale, v * scale, z)));
    return {
      hull: outline(0),
      deck: outline(3, 0.92),
      crates: poly([at(-0.35, -0.12, 3), at(0.05, -0.12, 3), at(0.05, 0.12, 3), at(-0.35, 0.12, 3)]),
      cratesTop: poly([at(-0.35, -0.12, 7), at(0.05, -0.12, 7), at(0.05, 0.12, 7), at(-0.35, 0.12, 7)]),
      mast: { a: at(0.3, 0, 3), b: at(0.3, 0, 24) },
      sail: poly([at(0.3, 0, 23), at(0.3, 0, 9), { x: at(0.3, 0, 11).x + 9, y: at(0.3, 0, 11).y }]),
      pennant: poly([at(0.3, 0, 24), at(0.3, 0, 20), { x: at(0.3, 0, 22).x - 8, y: at(0.3, 0, 22).y }]),
    };
  })();
  return {
    hull: parseSvg(svg.hull),
    deck: parseSvg(svg.deck),
    crates: parseSvg(svg.crates),
    cratesTop: parseSvg(svg.cratesTop),
    mast: svg.mast,
    sail: parseSvg(svg.sail),
    pennant: parseSvg(svg.pennant),
  };
}

export function ProgressBar({ job, plot }: { job: Construction; plot: Plot }) {
  const top = iso(plot.x + plot.w / 2, plot.y + plot.d / 2, 34);
  const done = Math.min(1, job.progress / job.duration);
  return (
    <Group>
      <Rect x={top.x - 16} y={top.y - 8} width={32} height={4} color="#1d211b" />
      <Rect x={top.x - 16} y={top.y - 8} width={32 * done} height={4} color="#e9c475" />
    </Group>
  );
}
