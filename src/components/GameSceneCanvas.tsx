import { memo, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  Atlas,
  BlurMask,
  Canvas,
  Circle,
  Group,
  Image,
  Line,
  LinearGradient,
  Path,
  Rect,
  Skia,
  drawAsPicture,
  useRSXformBuffer,
  vec,
  type SkImage,
  type SkPicture,
} from '@shopify/react-native-skia';
import { PixelRatio, Platform, StyleSheet, View } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useGameStore, workforceOf, type Construction } from '../game/gameStore';
import { towerCount, type BuildingId } from '../game/buildings';
import { FOOTPRINTS, MINE_SPOT, PLAZA, isOpenGround, isWater, onGateRoad, spotOf, zoneAt, type MapSide, type Placements } from '../game/cityMap';
import { BERTHS, bargePose, bargeRoute } from '../game/ship';
import { wagonStops, type WagonJob } from '../game/wagons';
import { raidSide, type RaidParty } from '../game/raids';
import { walkBetween, type RoadKind, type Roads, type Walk } from '../game/roads';
import { rocksLeft, type ClearOrder, type RockSize } from '../game/rocks';
import type { Trap } from '../game/traps';
import { RESOURCES, RESOURCE_INFO } from '../game/resources';
import { ARMY_UNITS, type UnitId } from '../game/units';
import type { Workforce } from '../game/workforce';
import {
  CAMPFIRE,
  CASTLE,
  DOCK_TILES,
  DOCKS_ROW,
  GATE_ROAD,
  GATE_TILES,
  HARBOUR,
  MAP_SIZE,
  MINE_PLOT,
  PARADE,
  RIVER_ROWS,
  STILL_HEIGHT,
  STILL_TOP,
  SCENE_WIDTH as sceneWidth,
  TILE_HH,
  TILE_HW,
  TOWER_SPOTS,
  WALL_TILES,
  iso,
  plotOf,
  type Plot,
} from './GameSceneLayout';
import { spritePixels } from './unitSprites';
import { collectPaths, parseSvg, svgPath, useSvgPaths } from './skiaPaths';

/** A tile in a stroke being painted (roads or traps), and whether it can take what's painted. */
export type PaintTile = { x: number; y: number; ok: boolean };

/**
 * Something being placed: where a building's footprint would go (if anywhere yet) and whether it fits
 * there, or the tiles of a road / trap stroke; `belt` lights up the trap belt, for laying traps.
 */
export type Ghost = { plot: Plot | null; valid: boolean; belt?: boolean; tiles?: PaintTile[] };

export type GameSceneProps = {
  width: number;
  height: number;
  /** The camera: the map point at the screen's top-left corner, and the zoom. */
  camX: SharedValue<number>;
  camY: SharedValue<number>;
  zoom: SharedValue<number>;
  selected?: BuildingId | null;
  /** A building or trap being placed, drawn as a green (fits) or red (doesn't) footprint over a stronger grid. */
  ghost?: Ghost | null;
  /** The screen is in view (animations run, the castle image may be redrawn). */
  active?: boolean;
};

/** Pixels per map unit in the castle image (capped: the whole 47-tile map is one image, ~14 MB at most). */
const STILL_SCALE = Math.min(1.6, PixelRatio.get() * 1.25);

// ——— Materials: every building changes look every five levels ———

// Stronghold-style: plank huts under thatch, then half-timbered plaster under red tiles, then stone and
// dressed stone under slate. `kind` dresses walls (planks, beams, stone courses) and roofs (thatch, tile,
// slate rows); materials without it (piles, odd parts) stay plain.
type MatKind = 'timber' | 'plaster' | 'stone' | 'dressed';
type Mat = { left: string; right: string; top: string; roof: string; roofDark: string; kind?: MatKind };
const MATS: Mat[] = [
  { left: '#a5774c', right: '#7c5435', top: '#b98a5a', roof: '#b38c4f', roofDark: '#8c6a37', kind: 'timber' }, // planks, thatch
  { left: '#e2d2ab', right: '#bea883', top: '#ebdcb8', roof: '#9a5038', roofDark: '#78382a', kind: 'plaster' }, // half-timbered, tiles
  { left: '#a9a698', right: '#86847a', top: '#bdbaab', roof: '#5f6f80', roofDark: '#475563', kind: 'stone' }, // stone, slate
  { left: '#d6d1c0', right: '#b3ad9b', top: '#e4e0d0', roof: '#41607c', roofDark: '#30475e', kind: 'dressed' }, // dressed stone, slate
];
const STONE: Mat = MATS[2];
const MARBLE: Mat = { left: '#ece7da', right: '#cfc9b9', top: '#f6f2e8', roof: '#e2b84f', roofDark: '#b8902f' };
const GOLD = '#e2b84f';
const BANNER = '#b8483a';
const DARK = '#2a2620';
const GLOW = '#f0b45a';
const tierOf = (level: number) => (level <= 0 ? 0 : Math.min(4, Math.ceil(level / 5)));
const matOf = (tier: number) => MATS[Math.max(0, tier - 1)];
/** Fortifications (the keep, walls, towers, gate) go straight from timber to stone, dressed stone last. */
const fortMat = (tier: number) => (tier <= 1 ? MATS[0] : tier === 4 ? MATS[3] : MATS[2]);

type P = { x: number; y: number };
const poly = (points: P[]) => `M ${points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')} Z`;

// ——— The scene ———
// Two layers, for speed. Everything that stands still (ground and grid, buildings, walls, the army on
// parade, scaffolding) is drawn once into an image and only redrawn when something visible changes.
// On top, a light live layer: every peasant in one sprite atlas moved by a single animation
// function, a few small animated bits, stockpiles, progress bars, the selection and placement ghost.

/** Stockpiles and parade companies change look in steps, so ordinary ticks don't redraw the castle. */
const PILE_STEPS = 6;
const figuresFor = (count: number) => (count <= 0 ? 0 : count >= 30 ? 3 : count >= 10 ? 2 : 1);

function GameSceneCanvas({ width, height, camX, camY, zoom, selected, ghost, active = true }: GameSceneProps) {
  const buildings = useGameStore((state) => state.buildings);
  const construction = useGameStore((state) => state.construction);
  const placements = useGameStore((state) => state.placements);
  const traps = useGameStore((state) => state.traps);
  const roads = useGameStore((state) => state.roads);
  const clearedRocks = useGameStore((state) => state.clearedRocks);
  const clearOrders = useGameStore((state) => state.clearOrders);
  const army = useGameStore((state) => state.army);
  const warehouse = useGameStore((state) => state.warehouse);
  const warehouseCapacity = useGameStore((state) => state.warehouseCapacity);
  const population = useGameStore((state) => state.population);
  const sites = useGameStore((state) => state.sites);
  const pendingSites = useGameStore((state) => state.pendingSites);
  const carts = useGameStore((state) => state.carts);
  const paused = useGameStore((state) => state.paused);
  const raid = useGameStore((state) => state.raid);
  const atGate = useGameStore((state) => state.battle?.status === 'active');
  const workforce = useMemo(
    () => workforceOf({ population, sites, pendingSites, carts, construction, clearOrders, buildings, paused }),
    [population, sites, pendingSites, carts, construction, clearOrders, buildings, paused],
  );
  const clock = useCityClock(active);
  const transform = useDerivedValue(() => [{ scale: zoom.get() }, { translateX: -camX.get() }, { translateY: -camY.get() }]);

  // What the still image shows, in steps.
  const piles = RESOURCES.map((resource) => Math.ceil(Math.min(1, warehouse[resource] / Math.max(1, warehouseCapacity)) * PILE_STEPS));
  const parade = ARMY_UNITS.map((unit) => figuresFor(army[unit]));
  const building = construction.map((job) => job.building).sort();
  // Raiders show up on their ground, on the side they come from, while a raid is on its way or at the gate.
  const raiders = raid ? { party: raid.party, side: raidSide(raid.number), atGate } : null;
  const key = JSON.stringify([buildings, placements, roads, clearedRocks.length, traps, parade, building, raiders]);
  const still = useStillImage(key, STILL_SCALE, active, () => (
    <StaticScene buildings={buildings} placements={placements} roads={roads} clearedRocks={clearedRocks} traps={traps} parade={parade} building={building} raiders={raiders} />
  ));
  const warehousePlot = plotOf('warehouse', placements);
  const selectedPlot = selected ? plotOf(selected, placements) : null;

  return (
    <View style={styles.frame}>
      <Canvas style={styles.canvas}>
        <Rect x={0} y={0} width={width} height={height} color={LAND} />
        <Group transform={transform}>
          <Backdrop part="back" />
          {still && <Image image={still} x={0} y={STILL_TOP} width={sceneWidth} height={STILL_HEIGHT} />}
          <Backdrop part="front" />
          {warehousePlot && buildings.warehouse > 0 && <Piles steps={piles.join()} plot={warehousePlot} />}
          <LiveBits buildings={buildings} placements={placements} clock={clock} />
          <Barges clock={clock} />
          <Wagons clock={clock} placements={placements} roads={roads} clearedRocks={clearedRocks} />
          {construction.map((job) => {
            const plot = plotOf(job.building, placements);
            return plot ? <ProgressBar key={job.building} job={job} plot={plot} /> : null;
          })}
          {clearOrders.length > 0 && <ClearingMarks orders={clearOrders} />}
          <PeasantAtlas
            workforce={workforce}
            construction={construction}
            clearOrders={clearOrders}
            clock={clock}
            buildings={buildings}
            placements={placements}
            roads={roads}
            clearedRocks={clearedRocks}
          />
          {selectedPlot && <Selection plot={selectedPlot} />}
          {ghost && <PlacementGhost ghost={ghost} />}
        </Group>
      </Canvas>
    </View>
  );
}

export default memo(GameSceneCanvas);

// Render the still layer offscreen into an image whenever its key changes, but only while the screen
// is in view: on web a screen in the background isn't really frozen — React keeps committing, yet its
// Skia canvas keeps replaying the drawing it had, old image and all. So a replaced image is freed only
// after a commit made while the screen is in view (plus a moment's grace), and the castle isn't
// redrawn at all while hidden; it catches up when the player comes back. Images that never reached
// the screen are freed straight away.
const FREE_AFTER_MS = 2000;

// A picture drawn into an image, on a surface that's freed straight after. Skia's own
// `drawAsImageFromPicture` makes a new GPU surface every time and never frees it; on web each one is
// a WebGL context of its own, and once a page has more than ~16 the browser drops the oldest — the
// map's canvas — and the screen goes black. So on web the image is drawn on the CPU (no context at
// all); on iOS/Android an offscreen GPU surface shares the app's one context, and is disposed here.
function pictureToImage(picture: SkPicture, size: { width: number; height: number }): SkImage | null {
  const surface = Platform.OS === 'web' ? Skia.Surface.Make(size.width, size.height) : Skia.Surface.MakeOffscreen(size.width, size.height);
  if (!surface) return null;
  surface.getCanvas().drawPicture(picture);
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  // A CPU copy outlives the GPU surface it came from.
  const image = Platform.OS === 'web' ? snapshot : snapshot.makeNonTextureImage();
  if (image !== snapshot) snapshot.dispose();
  surface.dispose();
  return image;
}

function useStillImage(key: string, pixelScale: number, active: boolean, render: () => ReactElement) {
  const [image, setImage] = useState<SkImage | null>(null);
  const built = useRef(''); // key of the image in `image`
  const shown = useRef<SkImage | null>(null); // committed to the canvas
  const pending = useRef<SkImage | null>(null); // set in state, not committed yet
  const retiring = useRef<SkImage[]>([]); // replaced, waiting for a commit in view
  const mounted = useRef(true);
  useEffect(() => {
    if (!active || built.current === key) return;
    let cancelled = false;
    // The image starts below the sky (nothing still is drawn up there), so it stays the same size.
    const size = { width: Math.ceil(sceneWidth * pixelScale), height: Math.ceil(STILL_HEIGHT * pixelScale) };
    const scene = <Group transform={[{ scale: pixelScale }, { translateY: -STILL_TOP }]}>{render()}</Group>;
    // The paths the scene's components parse (`svgPath`) are freed once the image is made.
    void collectPaths(
      // Drawings wait their turn; one already outdated by then isn't made at all.
      () => (cancelled ? Promise.resolve(null) : drawAsPicture(scene, Skia.XYWHRect(0, 0, size.width, size.height))),
      (picture) => {
        if (!picture) return;
        const next = cancelled ? null : pictureToImage(picture, size);
        picture.dispose();
        if (!next) return;
        if (pending.current && pending.current !== shown.current) pending.current.dispose();
        pending.current = next;
        built.current = key;
        setImage(next);
      },
    );
    return () => {
      cancelled = true;
    };
    // The key captures everything the still layer shows; `render` is a fresh closure every time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active]);
  // After the commit that put `image` on the canvas, the previous one retires…
  useEffect(() => {
    const previous = shown.current;
    shown.current = image;
    if (pending.current === image) pending.current = null;
    if (previous && previous !== image) retiring.current.push(previous);
  }, [image]);
  // …and is freed once that commit was made with the screen in view.
  useEffect(() => {
    const queue = retiring.current; // one array, changed in place
    if (!active || queue.length === 0) return;
    const batch = queue.splice(0);
    let done = false;
    const timer = setTimeout(() => {
      done = true;
      for (const old of batch) old.dispose();
    }, FREE_AFTER_MS);
    return () => {
      clearTimeout(timer);
      if (!done) queue.push(...batch);
    };
  }, [image, active]);
  // Free everything when the scene goes away for good (a hot reload re-runs this effect at once,
  // which cancels it).
  useEffect(() => {
    mounted.current = true;
    const queue = retiring.current;
    return () => {
      mounted.current = false;
      const leftovers = [shown.current, pending.current, ...queue];
      setTimeout(() => {
        if (mounted.current) return;
        for (const old of new Set(leftovers)) old?.dispose();
      }, FREE_AFTER_MS);
    };
  }, []);
  return image;
}

// Everything that doesn't move.
function StaticScene({ buildings, placements, roads, clearedRocks, traps, parade, building, raiders }: {
  buildings: Record<BuildingId, number>;
  placements: Placements;
  roads: Roads;
  clearedRocks: string[];
  traps: Trap[];
  parade: number[];
  building: BuildingId[];
  raiders: { party: RaidParty; side: MapSide; atGate: boolean } | null;
}) {
  const items: { depth: number; node: ReactNode }[] = [];
  const add = (depth: number, node: ReactNode) => items.push({ depth, node });
  const front = (plot: Plot) => plot.x + plot.w + plot.y + plot.d;

  // Every placed building (and the keep), and the tiles they cover (no trees there).
  const plots: { id: BuildingId; plot: Plot }[] = [];
  const covered = new Set<string>();
  for (const id of Object.keys(buildings) as BuildingId[]) {
    if (id === 'wall' || id === 'towers' || id === 'gate' || id === 'moat') continue;
    const plot = plotOf(id, placements);
    if (!plot) continue;
    plots.push({ id, plot });
    for (let x = plot.x; x < plot.x + plot.w; x++) for (let y = plot.y; y < plot.y + plot.d; y++) covered.add(`${String(x)},${String(y)}`);
  }

  // Soft shadows on the ground, cast to the lower right (the light comes from the upper left).
  const shadows: string[] = [];
  const castShadow = (x: number, y: number, w: number, d: number, tall: number) => {
    const reach = Math.min(3, Math.max(0.35, tall / 22));
    shadows.push(poly([iso(x + w, y + 0.05), iso(x + w + reach, y + 0.05 + reach * 0.3), iso(x + w + reach, y + d + reach * 0.3), iso(x + w, y + d)]));
  };
  for (const { plot } of plots) castShadow(plot.x, plot.y, plot.w, plot.d, plot.tall * 0.7);
  castShadow(MINE_PLOT.x, MINE_PLOT.y, MINE_PLOT.w, MINE_PLOT.d, 40);

  const rocks = rocksLeft(clearedRocks);
  const rocky = new Set(rocks.map((rock) => rock.key));
  for (const [x, y, size] of TREES) {
    const tile = `${String(Math.floor(x))},${String(Math.floor(y))}`;
    if (covered.has(tile) || roads[tile] || rocky.has(tile)) continue;
    shadows.push(groundBlob(x + 0.3, y + 0.05, 0.28 * size));
    add(x + y + 1, <Tree key={`tree-${String(x)}-${String(y)}`} x={x} y={y} size={size} />);
  }

  // The wall ring, its towers and the gatehouse.
  const wallTier = tierOf(buildings.wall);
  const towersBuilt = towerCount(buildings.towers);
  const towerTier = tierOf(buildings.towers);
  const gateTier = tierOf(buildings.gate);
  const towerAt = new Set(TOWER_SPOTS.slice(0, towersBuilt).map(([x, y]) => `${String(x)},${String(y)}`));
  for (const [x, y] of WALL_TILES) {
    if (towerAt.has(`${String(x)},${String(y)}`)) continue;
    // The gate tiles: the gatehouse, or a gap in the wall until one is built.
    if (y === CASTLE.y1 && GATE_TILES.includes(x)) continue;
    // The docks' tiles at the back of the harbour: the quay stands there instead.
    if (y === DOCKS_ROW && DOCK_TILES.includes(x)) continue;
    if (wallTier > 0) {
      castShadow(x, y, 1, 1, 14 + 6 * wallTier);
      add(x + y + 2, <WallSegment key={`wall-${String(x)}-${String(y)}`} x={x} y={y} tier={wallTier} />);
    }
  }
  TOWER_SPOTS.slice(0, towersBuilt).forEach(([x, y], index) => {
    castShadow(x - 0.15, y - 0.15, 1.3, 1.3, 40 + 9 * towerTier);
    add(x + y + 2, <Tower key={`tower-${String(index)}`} x={x} y={y} tier={towerTier} />);
  });
  const gate = plotOf('gate', placements) as Plot;
  const towers = plotOf('towers', placements) as Plot;
  if (gateTier > 0) add(front(gate), <Gatehouse key="gate" tier={gateTier} plot={gate} />);
  // Before the wall is built its line is staked out; empty plots mark the first tower and the gate.
  if (towersBuilt === 0) add(front(towers), <EmptyPlot key="towers-empty" plot={towers} />);
  if (gateTier === 0 && wallTier === 0) add(front(gate), <EmptyPlot key="gate-empty" plot={gate} />);

  // Buildings where they stand; a building's first level shows as a staked site under scaffolding.
  for (const { id, plot } of plots) {
    const tier = tierOf(buildings[id]);
    add(front(plot), tier === 0 ? <EmptyPlot key={id} plot={plot} /> : <BuildingArt key={id} id={id} plot={plot} tier={tier} level={buildings[id]} />);
  }

  add(front(MINE_PLOT), <Headframe key="mine" />);
  if (raiders) raiderFigures(raiders.party, raiders.side, raiders.atGate).forEach((figure, index) => add(figure.x + figure.y, <RaiderFigure key={`raider-${String(index)}`} {...figure} />));
  add(CAMPFIRE.x + CAMPFIRE.y + 1, <Campfire key="fire" />);
  add(PARADE.x + PARADE.y + 3, <Parade key="parade" figures={parade} />);
  items.sort((a, b) => a.depth - b.depth);

  return (
    <Group>
      <Ground flooded={buildings.moat > 0} />
      <RoadTiles roads={roads} />
      <Rocks cleared={clearedRocks} rocks={rocks} />
      <Traps traps={traps} />
      {wallTier === 0 && <PlannedWall />}
      <Path path={svgPath(shadows.join(' '))} color="rgba(22, 30, 12, 0.32)">
        <BlurMask blur={2.5} style="normal" />
      </Path>
      {items.map((item) => item.node)}
      {building.map((id) => {
        const plot = plotOf(id, placements);
        return plot ? <Scaffold key={id} plot={plot} /> : null;
      })}
    </Group>
  );
}

// Seconds since the scene appeared, at up to 30 frames a second; stops while the scene is hidden.
function useCityClock(active: boolean) {
  const clock = useSharedValue(0);
  const start = useSharedValue(-1);
  useFrameCallback((frame) => {
    if (start.get() < 0) start.set(frame.timestamp);
    const now = (frame.timestamp - start.get()) / 1000;
    if (now - clock.get() >= 1 / 30) clock.set(now);
  }, active);
  return clock;
}

// ——— Geometry helpers ———

const seg = (a: P, b: P) => `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
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
function Box({ x, y, w, d, h, z = 0, m, top, outline = true }: { x: number; y: number; w: number; d: number; h: number; z?: number; m: Mat; top?: string; outline?: boolean }) {
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
function Gable({ x, y, w, d, z, rise, m, along = 'x' }: { x: number; y: number; w: number; d: number; z: number; rise: number; m: Mat; along?: 'x' | 'y' }) {
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
function Hip({ x, y, w, d, z, rise, m }: { x: number; y: number; w: number; d: number; z: number; rise: number; m: Mat }) {
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
function Crenels({ x, y, w, d, z, m }: { x: number; y: number; w: number; d: number; z: number; m: Mat }) {
  const merlons: ReactNode[] = [];
  const size = 0.22;
  for (let u = 0; u + size <= w + 0.01; u += 0.5) merlons.push(<Box key={`f${String(u)}`} x={x + u} y={y + d - size} w={size} d={size} h={3.5} z={z} m={m} />);
  for (let v = 0; v + size <= d - 0.3; v += 0.5) merlons.push(<Box key={`r${String(v)}`} x={x + w - size} y={y + v} w={size} d={size} h={3.5} z={z} m={m} />);
  return <Group>{merlons}</Group>;
}

// A round tower's body: a cylinder `r` tiles across standing at (cx, cy), lit from the left, with stone
// courses round its front and a ring of merlons on top (a walkway inside them).
function Cylinder({ cx, cy, r, h, z = 0, m, merlons = true }: { cx: number; cy: number; r: number; h: number; z?: number; m: Mat; merlons?: boolean }) {
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
function LeftFace({ x, yFront, z = 0, u0, u1, v0, v1, color }: { x: number; yFront: number; z?: number; u0: number; u1: number; v0: number; v1: number; color: string }) {
  return <Path path={svgPath(poly([iso(x + u0, yFront, z + v0), iso(x + u1, yFront, z + v0), iso(x + u1, yFront, z + v1), iso(x + u0, yFront, z + v1)]))} color={color} />;
}

/** A quad on a box's front-right wall (the face along x = xFront). */
function RightFace({ xFront, y, z = 0, u0, u1, v0, v1, color }: { xFront: number; y: number; z?: number; u0: number; u1: number; v0: number; v1: number; color: string }) {
  return <Path path={svgPath(poly([iso(xFront, y + u0, z + v0), iso(xFront, y + u1, z + v0), iso(xFront, y + u1, z + v1), iso(xFront, y + u0, z + v1)]))} color={color} />;
}

function Flag({ x, y, z, color = BANNER }: { x: number; y: number; z: number; color?: string }) {
  const base = iso(x, y, z);
  return (
    <Group>
      <Rect x={base.x - 0.6} y={base.y - 14} width={1.2} height={14} color={DARK} />
      <Rect x={base.x + 0.6} y={base.y - 14} width={8} height={5} color={color} />
    </Group>
  );
}

// ——— Backdrop: sky, mountains all round, and the river running on through them ———

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
const STONE_LIGHT = '#969886';
const STONE_DARK = '#6e7262';
function crag(base: P, w: number, h: number, dip: number, lean: number) {
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
const WATER = '#3a6a86';
// How far out the river runs past the map's ends (to the farthest ranges).
const RIVER_REACH = 12;

// The land's colours, shared by the map and the backdrop so the hold sits in its valley rather than on
// a board: the wild land all round (and the raiders' ground on the map), the town's lawn, the woods.
const LAND = '#506738';
const LAWN = '#5f7942';
const TRUNK = '#5e4630';
const CROWNS = ['#3f5f30', '#4b6d36', '#557a3c'];

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
    trunks: parsed(w.trunks),
    crowns: w.crowns.map(parsed),
    stone: { light: parsed(w.stone.light), dark: parsed(w.stone.dark), shadow: parsed(w.stone.shadow) },
  });
  return {
    ranges: BACKDROP.ranges.map((r) => ({ ...r, light: parsed(r.light), dark: parsed(r.dark), snow: r.snow ? parsed(r.snow) : null })),
    sky: parsed(BACKDROP.sky),
    river: parsed(BACKDROP.river),
    ripples: parsed(BACKDROP.ripples),
    road: parsed(BACKDROP.road),
    woods: { back: woods(WOODS.back), front: woods(WOODS.front) },
  };
}

const Backdrop = memo(function Backdrop({ part }: { part: 'back' | 'front' }) {
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

// ——— Ground ———

// Trees: a few on open town ground, and thick woods on the raiders' ground beyond the traps.
const TREES: [number, number, number][] = (() => {
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
function landRing(inset: number) {
  const a = inset;
  const b = MAP_SIZE - inset;
  const [p, q, r, t] = [iso(b, RIVER_ROWS), iso(b, b), iso(a, b), iso(a, RIVER_ROWS)];
  return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${q.x.toFixed(1)} ${q.y.toFixed(1)} L ${r.x.toFixed(1)} ${r.y.toFixed(1)} L ${t.x.toFixed(1)} ${t.y.toFixed(1)}`;
}

/** Every tile's outline: shown only while placing a building or painting tiles. */
const GRID = (() => {
  const parts: string[] = [];
  for (let i = 0; i <= MAP_SIZE; i++) {
    const [a, b, c, d] = [iso(i, 0), iso(i, MAP_SIZE), iso(0, i), iso(MAP_SIZE, i)];
    parts.push(`M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`, `M ${c.x.toFixed(1)} ${c.y.toFixed(1)} L ${d.x.toFixed(1)} ${d.y.toFixed(1)}`);
  }
  return parts.join(' ');
})();

// The tile grid, parsed once (the placement ghost draws it while placing or painting).
let gridPath: ReturnType<typeof parsed> | null = null;

// SVG path strings parsed into Skia paths once and kept: the castle image is redrawn from scratch every
// time it changes, and re-parsing the same big paths each time was most of the work.
const parsed = parseSvg;

// Free every Skia object in a (nested) set of paths.
function disposePaths(value: unknown) {
  if (!value || typeof value !== 'object') return;
  if ('dispose' in value && typeof value.dispose === 'function') {
    (value as { dispose: () => void }).dispose();
    return;
  }
  for (const inner of Object.values(value)) disposePaths(inner);
}

/** One layer's parsed paths, kept for the latest thing they show (`key`). */
type Slot<K, T> = { key?: K; value?: T };
// The paths for `key`, built once; the set they replace is freed a little later (a redraw already under
// way may still be recording with it), so Skia's memory doesn't grow with every change.
function latest<K, T>(slot: Slot<K, T>, key: K, build: () => T): T {
  if (slot.value !== undefined && slot.key === key) return slot.value;
  const old = slot.value;
  slot.key = key;
  slot.value = build();
  if (old !== undefined) setTimeout(() => disposePaths(old), 5000);
  return slot.value;
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
function groundBlob(cx: number, cy: number, r: number) {
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
  return Object.fromEntries(Object.entries(svg).map(([name, path]) => [name, parsed(path)])) as Record<keyof typeof svg, ReturnType<typeof parsed>>;
}

// The ground, rings and river. Until the moat is built its ring is a dry ditch (no bridge needed).
function Ground({ flooded }: { flooded: boolean }) {
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
function PlannedWall() {
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
const BELT = tilesPath((x, y) => zoneAt(x, y) === 'traps' && !onGateRoad(x, y));

// ——— Rocks ———

// Every rock still standing, by size: a scatter of stones, a rock, or a big boulder. Low, so they're
// drawn with the ground (under every building and tree), a few paths for all of them.
const rockSlot: Slot<readonly string[], { light: ReturnType<typeof parsed>; dark: ReturnType<typeof parsed>; shadow: ReturnType<typeof parsed> }> = {};
function Rocks({ cleared, rocks }: { cleared: readonly string[]; rocks: { x: number; y: number; size: RockSize }[] }) {
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
    return { light: parsed(light.join(' ')), dark: parsed(dark.join(' ')), shadow: parsed(shadow.join(' ')) };
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
function ClearingMarks({ orders }: { orders: ClearOrder[] }) {
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

const ROAD_COLORS: Record<RoadKind, { fill: string; mark: string }> = {
  dirt: { fill: '#b09a6a', mark: '#9a845a' },
  stone: { fill: '#a19d93', mark: '#7f7b72' },
  granite: { fill: '#c9cbcf', mark: '#8e9198' },
};

// Every road tile, by kind: dirt with a few ruts, stone as cobbles, granite as big dressed slabs.
const roadSlot: Slot<Roads, { fill: Record<RoadKind, ReturnType<typeof parsed>>; mark: Record<RoadKind, ReturnType<typeof parsed>> }> = {};
function RoadTiles({ roads }: { roads: Roads }) {
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
      fill: Object.fromEntries(Object.entries(fill).map(([kind, parts]) => [kind, parsed(parts.join(' '))])) as Record<RoadKind, ReturnType<typeof parsed>>,
      mark: Object.fromEntries(Object.entries(mark).map(([kind, parts]) => [kind, parsed(parts.join(' '))])) as Record<RoadKind, ReturnType<typeof parsed>>,
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
function raiderFigures(party: RaidParty, side: MapSide, atGate: boolean) {
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
function Traps({ traps }: { traps: Trap[] }) {
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

function RaiderFigure({ unit, x, y }: { unit: UnitId; x: number; y: number }) {
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

function Tree({ x, y, size }: { x: number; y: number; size: number }) {
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

// An empty plot: corner stakes and a rope.
function EmptyPlot({ plot }: { plot: Plot }) {
  const corners = [iso(plot.x, plot.y), iso(plot.x + plot.w, plot.y), iso(plot.x + plot.w, plot.y + plot.d), iso(plot.x, plot.y + plot.d)];
  return (
    <Group opacity={0.8}>
      <Path path={svgPath(poly(corners))} style="stroke" strokeWidth={1} color="#e0cf96" />
      {corners.map((c, index) => <Rect key={index} x={c.x - 1} y={c.y - 7} width={2} height={7} color="#6e4a2f" />)}
    </Group>
  );
}

function Selection({ plot }: { plot: Plot }) {
  const corners = [iso(plot.x, plot.y), iso(plot.x + plot.w, plot.y), iso(plot.x + plot.w, plot.y + plot.d), iso(plot.x, plot.y + plot.d)];
  const [outline] = useSvgPaths([poly(corners)]);
  return <Path path={outline} style="stroke" strokeWidth={2} color="#f3d27a" />;
}

const tileDiamonds = (tiles: { x: number; y: number }[]) =>
  tiles.map((tile) => poly([iso(tile.x, tile.y), iso(tile.x + 1, tile.y), iso(tile.x + 1, tile.y + 1), iso(tile.x, tile.y + 1)])).join(' ');

// Something being placed: its footprint on a stronger grid, green where it fits and red where it
// doesn't (and, for traps, the belt lit up).
// The belt's tiles and edges, for laying traps: parsed once.
let beltPaths: { tiles: ReturnType<typeof parsed>; edges: ReturnType<typeof parsed> } | null = null;

function PlacementGhost({ ghost }: { ghost: Ghost }) {
  const { plot } = ghost;
  const tint = ghost.valid ? 'rgba(140, 220, 120, ' : 'rgba(232, 96, 74, ';
  // The footprint and a see-through box standing on it (its two front walls and top).
  let footprint = '';
  let shell = ['', '', ''];
  if (plot) {
    const { x, y, w, d } = plot;
    const h = Math.min(30, plot.tall / 2);
    footprint = poly([iso(x, y), iso(x + w, y), iso(x + w, y + d), iso(x, y + d)]);
    const top = [iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)];
    shell = [poly([iso(x, y + d), iso(x + w, y + d), top[2], top[3]]), poly([iso(x + w, y), iso(x + w, y + d), top[2], top[1]]), poly(top)];
  }
  const tiles = ghost.tiles ?? [];
  const [area, left, right, lid, ok, bad] = useSvgPaths([
    footprint,
    ...shell,
    tiles.length > 0 ? tileDiamonds(tiles.filter((tile) => tile.ok)) : '',
    tiles.length > 0 ? tileDiamonds(tiles.filter((tile) => !tile.ok)) : '',
  ]);
  gridPath ??= parsed(GRID);
  beltPaths ??= { tiles: parsed(BELT), edges: parsed(`${landRing(3)} ${landRing(5)}`) };
  return (
    <Group>
      <Path path={gridPath} style="stroke" strokeWidth={0.8} color="rgba(255, 255, 240, 0.22)" />
      {ghost.belt && (
        <>
          <Path path={beltPaths.tiles} color="rgba(255, 232, 160, 0.3)" />
          <Path path={beltPaths.edges} style="stroke" strokeWidth={1.5} color="rgba(255, 226, 140, 0.9)" />
        </>
      )}
      {tiles.length > 0 && (
        <>
          <Path path={ok} color="rgba(140, 220, 120, 0.55)" />
          <Path path={bad} color="rgba(232, 96, 74, 0.55)" />
        </>
      )}
      {plot && (
        <>
          <Path path={area} color={`${tint}0.45)`} />
          <Path path={left} color={`${tint}0.35)`} />
          <Path path={right} color={`${tint}0.25)`} />
          <Path path={lid} color={`${tint}0.45)`} />
          <Path path={area} style="stroke" strokeWidth={2} color={ghost.valid ? '#9fe08a' : '#ff7a5c'} />
        </>
      )}
    </Group>
  );
}

// ——— Defences ———

// Which way the wall runs through a tile (along x, along y, or both at a corner).
const WALL_SET = new Set(WALL_TILES.map(([x, y]) => `${String(x)},${String(y)}`));
const wallRuns = (x: number, y: number) => ({
  alongX: WALL_SET.has(`${String(x - 1)},${String(y)}`) || WALL_SET.has(`${String(x + 1)},${String(y)}`),
  alongY: WALL_SET.has(`${String(x)},${String(y - 1)}`) || WALL_SET.has(`${String(x)},${String(y + 1)}`),
});

// One tile of the wall: a palisade of sharpened logs at first, then a continuous stone curtain wall with a
// walkway and battlements on both faces.
function WallSegment({ x, y, tier }: { x: number; y: number; tier: number }) {
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
function Tower({ x, y, tier }: { x: number; y: number; tier: number }) {
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
function Gatehouse({ tier, plot }: { tier: number; plot: Plot }) {
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

// ——— Buildings ———
// Each building fills its footprint (w × d tiles); its look changes every five levels.

function BuildingArt({ id, plot, tier, level }: { id: BuildingId; plot: Plot; tier: number; level: number }) {
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

// ——— The live layer ———

// The warehouse's piles, one per resource, growing with the stock (in steps). They change often,
// so they're drawn live instead of making the still image redraw.
const Piles = memo(function Piles({ steps, plot }: { steps: string; plot: Plot }) {
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

const LiveBits = memo(function LiveBits({ buildings, placements, clock }: { buildings: Record<BuildingId, number>; placements: Placements; clock: SharedValue<number> }) {
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

const WHEEL = iso(MINE_PLOT.x + MINE_PLOT.w / 2, MINE_PLOT.y + MINE_PLOT.d / 2, 56);

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
function Wagons({ clock, placements, roads, clearedRocks }: { clock: SharedValue<number>; placements: Placements; roads: Roads; clearedRocks: string[] }) {
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

// A small two-wheeled cart drawn at the origin, with a carter at the shaft; `load`: the colour of the goods heaped on it.
const CartArt = memo(function CartArt({ load }: { load: string | null }) {
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

// The river barges: each sails in from downriver, along the river to its berth (in the harbour or on
// the river by its mouth), waits there for its order to be filled, and sails off again — on the game
// clock (`bargePose`), smoothed between ticks. Nearer berths are drawn over farther ones.
function Barges({ clock }: { clock: SharedValue<number> }) {
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
    hull: parsed(svg.hull),
    deck: parsed(svg.deck),
    crates: parsed(svg.crates),
    cratesTop: parsed(svg.cratesTop),
    mast: svg.mast,
    sail: parsed(svg.sail),
    pennant: parsed(svg.pennant),
  };
}

// The campfire's ring of stones and logs (the flame is live).
function Campfire() {
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
function Headframe() {
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
function Scaffold({ plot }: { plot: Plot }) {
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

function ProgressBar({ job, plot }: { job: Construction; plot: Plot }) {
  const top = iso(plot.x + plot.w / 2, plot.y + plot.d / 2, 34);
  const done = Math.min(1, job.progress / job.duration);
  return (
    <Group>
      <Rect x={top.x - 16} y={top.y - 8} width={32} height={4} color="#1d211b" />
      <Rect x={top.x - 16} y={top.y - 8} width={32 * done} height={4} color="#e9c475" />
    </Group>
  );
}

// The army on parade inside the bailey: one row per kind of unit, more figures for bigger companies.
function Parade({ figures: companies }: { figures: number[] }) {
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

// ——— Peasants ———
// Every peasant above ground is one sprite in a single atlas, moved by one animation function.

const TUNICS = ['#7a5a3a', '#5d6e3a', '#8a6a4a', '#6a5a7a', '#7a4a3a'];
const LOADS = ['#1c1c1f', '#9a9da3', '#c46a2b', '#7a3427'];

/** A peasant, standing with their feet at (x, y) (tower archers, drawn into the still image). */
function Peasant({ x = 0, y = 0, tunic }: { x?: number; y?: number; tunic: string }) {
  return (
    <Group>
      <Rect x={x - 1.6} y={y - 2.5} width={1.2} height={2.5} color="#3a2a1c" />
      <Rect x={x + 0.4} y={y - 2.5} width={1.2} height={2.5} color="#3a2a1c" />
      <Rect x={x - 1.8} y={y - 6.5} width={3.6} height={4.2} color={tunic} />
      <Rect x={x - 1.2} y={y - 9} width={2.4} height={2.5} color="#e0b48a" />
    </Group>
  );
}

// The sprite sheet: one cell per tunic, then one per load (a sack drawn where a peasant carries it),
// then a hammer. Cells are 8 × 12 scene units drawn 4× larger; the feet sit at (4, 11) in every cell,
// so a load drawn with its carrier's transform lands on their shoulder.
const SPRITE_RES = 4;
const CELL_W = 8;
const CELL_H = 12;
const FEET_X = 4;
const FEET_Y = 11;
const LOAD_CELL = TUNICS.length;
const HAMMER_CELL = TUNICS.length + LOADS.length;

let spriteSheet: SkImage | null = null;
function getSpriteSheet() {
  if (spriteSheet) return spriteSheet;
  const cells = HAMMER_CELL + 1;
  const surface = Skia.Surface.Make(cells * CELL_W * SPRITE_RES, CELL_H * SPRITE_RES);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  const rect = (cell: number, x: number, y: number, w: number, h: number, color: string) => {
    paint.setColor(Skia.Color(color));
    canvas.drawRect(Skia.XYWHRect((cell * CELL_W + FEET_X + x) * SPRITE_RES, (FEET_Y + y) * SPRITE_RES, w * SPRITE_RES, h * SPRITE_RES), paint);
  };
  TUNICS.forEach((tunic, cell) => {
    rect(cell, -1.6, -2.5, 1.2, 2.5, '#3a2a1c');
    rect(cell, 0.4, -2.5, 1.2, 2.5, '#3a2a1c');
    rect(cell, -1.8, -6.5, 3.6, 4.2, tunic);
    rect(cell, -1.2, -9, 2.4, 2.5, '#e0b48a');
  });
  LOADS.forEach((load, index) => {
    paint.setColor(Skia.Color(load));
    canvas.drawCircle(((LOAD_CELL + index) * CELL_W + FEET_X + 2.2) * SPRITE_RES, (FEET_Y - 7.2) * SPRITE_RES, 2 * SPRITE_RES, paint);
  });
  rect(HAMMER_CELL, 1.6, -9, 1, 4, '#c9ccd1');
  surface.flush();
  spriteSheet = surface.makeImageSnapshot();
  return spriteSheet;
}

const WALK = 0;
const SWAY = 1;
const HAMMER = 2;
/**
 * One sprite: a walker (or the load it carries, shown one way), a swaying idler, or a hammering
 * builder. A walker goes there and back along `route` (flat tile points), reaching each point at the
 * matching `times` second (quicker on roads).
 */
type Spec = { mode: number; cell: number; route: number[]; times: number[]; speed: number; phase: number; x: number; y: number; load: boolean; carryBack: boolean };

const MAX_WALKERS = 24;
const STAFFED_SHOWN: BuildingId[] = ['houses', 'docks', 'gate', 'foundry', 'research', 'armory', 'stables', 'balloonWorks', 'monastery', 'barracks', 'guardhouse', 'archery', 'chapel', 'sanctum', 'griffinEyrie'];

function peasantSpecs(
  workforce: Workforce,
  construction: Construction[],
  clearOrders: ClearOrder[],
  buildings: Record<BuildingId, number>,
  placements: Placements,
  roads: Roads,
  clearedRocks: string[],
): Spec[] {
  const specs: Spec[] = [];
  const walker = (walk: Walk, speed: number, phase: number, cell: number, load: number, carryBack: boolean) => {
    const route = walk.points.flat();
    specs.push({ mode: WALK, cell, route, times: walk.times, speed, phase, x: 0, y: 0, load: false, carryBack });
    specs.push({ mode: WALK, cell: LOAD_CELL + load, route, times: walk.times, speed, phase, x: 0, y: 0, load: true, carryBack });
  };
  const footprint = (id: BuildingId) => {
    const spot = spotOf(id, placements);
    return spot ? { ...spot, ...FOOTPRINTS[id] } : null;
  };
  const store = footprint('warehouse');
  let walkers = 0;
  if (store) {
    // Haulers between the mine and the warehouse; building hands fetching supplies from it. They
    // take the quickest way, over the roads.
    const haul = walkBetween(MINE_SPOT, store, placements, roads, clearedRocks);
    const haulers = haul ? Math.min(8, workforce.staff.warehouse) : 0;
    for (let i = 0; i < haulers && haul; i++) walker(haul, 1.1, i / Math.max(1, haulers), i % TUNICS.length, i % LOADS.length, false);
    walkers = haulers;
    STAFFED_SHOWN.forEach((id, index) => {
      const plot = footprint(id);
      if (!plot || walkers >= MAX_WALKERS || workforce.staff[id] <= 0 || buildings[id] <= 0) return;
      const walk = walkBetween(plot, store, placements, roads, clearedRocks);
      if (!walk) return;
      walker(walk, 0.9, (index * 0.37) % 1, index % TUNICS.length, 3, true);
      walkers += 1;
    });
  }
  for (const job of construction) {
    const plot = plotOf(job.building, placements);
    if (!plot) continue;
    for (let i = 0; i < Math.min(3, job.crew); i++) {
      const at = iso(plot.x + plot.w * (0.25 + i * 0.3), plot.y + plot.d + 0.3);
      specs.push({ mode: HAMMER, cell: 2, route: [], times: [], speed: 0, phase: i * 1.7, x: at.x, y: at.y, load: false, carryBack: false });
      specs.push({ mode: HAMMER, cell: HAMMER_CELL, route: [], times: [], speed: 0, phase: i * 1.7, x: at.x, y: at.y, load: false, carryBack: false });
    }
  }
  // The clearing crew, breaking up the first rock of the current order.
  if (clearOrders.length > 0) {
    const [x, y] = clearOrders[0].tiles[0].split(',').map(Number);
    for (let i = 0; i < 2; i++) {
      const at = iso(x + 0.15 + i * 0.7, y + 1.05);
      specs.push({ mode: HAMMER, cell: 1, route: [], times: [], speed: 0, phase: i * 1.3, x: at.x, y: at.y, load: false, carryBack: false });
      specs.push({ mode: HAMMER, cell: HAMMER_CELL, route: [], times: [], speed: 0, phase: i * 1.3, x: at.x, y: at.y, load: false, carryBack: false });
    }
  }
  const idle = Math.min(12, workforce.idle);
  for (let i = 0; i < idle; i++) {
    const a = (i / Math.max(1, idle)) * Math.PI * 2;
    const at = iso(CAMPFIRE.x + Math.cos(a) * 0.9, CAMPFIRE.y + Math.sin(a) * 0.9);
    specs.push({ mode: SWAY, cell: i % TUNICS.length, route: [], times: [], speed: 0, phase: i, x: at.x, y: at.y, load: false, carryBack: false });
  }
  return specs;
}

const ORIGIN = iso(0, 0);

function PeasantAtlas({ workforce, construction, clearOrders, clock, buildings, placements, roads, clearedRocks }: {
  workforce: Workforce;
  construction: Construction[];
  clearOrders: ClearOrder[];
  clearedRocks: string[];
  clock: SharedValue<number>;
  buildings: Record<BuildingId, number>;
  placements: Placements;
  roads: Roads;
}) {
  const sheet = getSpriteSheet();
  // Only who's where matters (not every tick's numbers), so the specs are rebuilt only when that changes.
  const shape = JSON.stringify([
    Math.min(8, workforce.staff.warehouse),
    STAFFED_SHOWN.map((id) => (workforce.staff[id] > 0 && buildings[id] > 0 ? 1 : 0)),
    construction.map((job) => [job.building, Math.min(3, job.crew)]),
    Math.min(12, workforce.idle),
    placements,
    roads,
    clearedRocks.length,
    clearOrders.length > 0 ? clearOrders[0].tiles[0] : '',
  ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const specs = useMemo(() => peasantSpecs(workforce, construction, clearOrders, buildings, placements, roads, clearedRocks), [shape]);
  const sprites = useMemo(() => specs.map((spec) => Skia.XYWHRect(spec.cell * CELL_W * SPRITE_RES, 0, CELL_W * SPRITE_RES, CELL_H * SPRITE_RES)), [specs]);
  const hw = TILE_HW;
  const hh = TILE_HH;
  const ox = ORIGIN.x;
  const oy = ORIGIN.y;
  const transforms = useRSXformBuffer(specs.length, (value, index) => {
    'worklet';
    const spec = specs[index];
    const t = clock.get();
    let x = spec.x;
    let y = spec.y;
    let shown = true;
    if (spec.mode === WALK) {
      // Along the route and back, on its own timetable: where the walker is now, and which way
      // they're going.
      const flat = spec.route;
      const times = spec.times;
      const total = times.length > 0 ? times[times.length - 1] : 0;
      let s = total > 0 ? (t * spec.speed + spec.phase * total) % (2 * total) : 0;
      const out = s <= total;
      if (!out) s = 2 * total - s;
      let tx = flat[0];
      let ty = flat[1];
      for (let i = 1; i < times.length; i++) {
        if (s <= times[i]) {
          const span = times[i] - times[i - 1];
          const f = span > 0 ? (s - times[i - 1]) / span : 0;
          tx = flat[2 * i - 2] + (flat[2 * i] - flat[2 * i - 2]) * f;
          ty = flat[2 * i - 1] + (flat[2 * i + 1] - flat[2 * i - 1]) * f;
          break;
        }
        tx = flat[2 * i];
        ty = flat[2 * i + 1];
      }
      x = ox + (tx - ty) * hw;
      y = oy + (tx + ty) * hh - Math.abs(Math.sin(t * 9 + spec.phase * 7)) * 1.2;
      if (spec.load) shown = out !== spec.carryBack;
    } else if (spec.mode === SWAY) {
      x += Math.sin(t * 0.8 + spec.phase) * 0.6;
    } else {
      y -= Math.abs(Math.sin(t * 6 + spec.phase)) * 1.5;
    }
    if (shown) value.set(1 / SPRITE_RES, 0, x - FEET_X, y - FEET_Y);
    else value.set(0, 0, -100, -100);
  });
  if (!sheet || specs.length === 0) return null;
  return <Atlas image={sheet} sprites={sprites} transforms={transforms} />;
}

const styles = StyleSheet.create({
  frame: { flex: 1, overflow: 'hidden' },
  canvas: { flex: 1 },
});
