import './skiaWebFallback';
import { memo, useMemo, type ReactNode } from 'react';
import { BlurMask, Canvas, Group, Image, Paint, Path, Picture, Rect, Skia } from '@shopify/react-native-skia';
import { PixelRatio, StyleSheet, View } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { workforceOf } from '../game/hold';
import { useGameSlice } from '../game/gameStore';
import { buildingStats, towerCount, type BuildingId } from '../game/buildings';
import type { MapSide, Placements } from '../game/cityMap';
import { raidSide, type RaidParty } from '../game/raids';
import type { Roads } from '../game/roads';
import { rocksLeft } from '../game/rocks';
import type { Trap } from '../game/traps';
import { FOOD_RESOURCES, MINE_RESOURCES, RESOURCES } from '../game/resources';
import { fellingStand, forestLook } from '../game/forest';
import { FISHERY_IDS, PASTURE_IDS } from '../game/farms';
import { ARMY_UNITS } from '../game/units';
import {
  CAMPFIRE,
  CASTLE,
  DOCK_TILES,
  DOCKS_ROW,
  GATE_TILES,
  MINE_PLOT,
  PARADE,
  STILL_HEIGHT,
  STILL_TOP,
  SCENE_WIDTH as sceneWidth,
  TOWER_SPOTS,
  WALL_TILES,
  fadedBuildings,
  iso,
  plotOf,
  plotRect,
  watch,
  type Plot,
  type Watched,
} from './GameSceneLayout';
import { svgPath } from './skiaPaths';
import { poly, tierOf } from './stronghold/shapes';
import { Backdrop, ForestTrees, LAND } from './stronghold/backdrop';
import {
  ClearingMarks,
  Ground,
  PlannedWall,
  RaiderFigure,
  RoadTiles,
  Rocks,
  TREES,
  Traps,
  Tree,
  groundBlob,
  raiderFigures,
} from './stronghold/ground';
import { EmptyPlot, PlacementGhost, Selection, type Ghost } from './stronghold/overlays';
import { Gatehouse, Tower, WallSegment } from './stronghold/fortifications';
import { BuildingArt, Campfire, Headframe, Parade, Scaffold } from './stronghold/buildingArt';
import { Barges, LiveBits, ProgressBar, Wagons } from './stronghold/live';
import { Flocks } from './stronghold/flocks';
import { FishingBoats } from './stronghold/boats';
import { fishingBoat } from '../game/boats';
import { Housewives } from './stronghold/housewives';
import { PeasantAtlas } from './stronghold/peasants';
import { SLOTS_PER_RESOURCE, Stockpile, stockpilePlot, stockpileSteps } from './stronghold/stockpile';
import { useScenePicture, useStillImage } from './stronghold/stillImage';

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

// The scene, in two layers for speed. Everything that stands still (ground and grid, buildings, walls, the
// army on parade, scaffolding) is drawn once into an image and only redrawn when something visible changes.
// On top, a light live layer: every peasant in one sprite atlas moved by a single animation
// function, a few small animated bits, stockpiles, progress bars, the selection and placement ghost.

/** Parade companies change look in steps (like the stockpiles), so ordinary ticks don't redraw the castle. */
/** The warehouse's piles: everything but food, which the granary keeps. */
const STORE_RESOURCES = RESOURCES.filter((resource) => !FOOD_RESOURCES.includes(resource));

const figuresFor = (count: number) => (count <= 0 ? 0 : count >= 30 ? 3 : count >= 10 ? 2 : 1);
/** How faint a see-through building is drawn. */
const FADED_OPACITY = 0.38;

function GameSceneCanvas({ width, height, camX, camY, zoom, selected, ghost, active = true }: GameSceneProps) {
  const buildings = useGameSlice((state) => state.buildings, active);
  const construction = useGameSlice((state) => state.construction, active);
  const placements = useGameSlice((state) => state.placements, active);
  const traps = useGameSlice((state) => state.traps, active);
  const roads = useGameSlice((state) => state.roads, active);
  const clearedRocks = useGameSlice((state) => state.clearedRocks, active);
  const clearOrders = useGameSlice((state) => state.clearOrders, active);
  const army = useGameSlice((state) => state.army, active);
  const warehouse = useGameSlice((state) => state.warehouse, active);
  const warehouseCapacity = useGameSlice((state) => state.warehouseCapacity, active);
  const population = useGameSlice((state) => state.population, active);
  const sites = useGameSlice((state) => state.sites, active);
  const pendingSites = useGameSlice((state) => state.pendingSites, active);
  const carts = useGameSlice((state) => state.carts, active);
  const paused = useGameSlice((state) => state.paused, active);
  const staffing = useGameSlice((state) => state.staffing, active);
  const raid = useGameSlice((state) => state.raid, active);
  const forest = useGameSlice((state) => forestLook(state.forest), active);
  const felling = useGameSlice((state) => fellingStand(state.forest) ?? '', active);
  // What the mine stockpile holds (for the handcarts hauling it to the warehouse), as a short stable string.
  const hauled = useGameSlice((state) => MINE_RESOURCES.filter((resource) => state.mineStock[resource] >= 1).slice(0, 4).join(','), active);
  const flocks = useGameSlice(
    (state) =>
      PASTURE_IDS.map((id) => {
        const spot = state.placements[id];
        return spot && state.buildings[id] > 0 ? `${String(spot.x)},${String(spot.y)},${String(Math.min(30, Math.round(state.flocks[id] ?? 0)))}` : '';
      })
        .filter(Boolean)
        .join(';'),
    active,
  );
  // Each fishing hut's boat (from level 5): "x,tier;…".
  const boats = useGameSlice(
    (state) =>
      FISHERY_IDS.map((id) => {
        const spot = state.placements[id];
        const tier = fishingBoat(state.buildings[id]);
        return spot && tier ? `${String(spot.x)},${String(tier)}` : '';
      })
        .filter(Boolean)
        .join(';'),
    active,
  );
  const atGate = useGameSlice((state) => state.battle?.status === 'active', active);
  const workforce = useMemo(
    () => workforceOf({ population, sites, pendingSites, carts, construction, clearOrders, buildings, paused, staffing }),
    [population, sites, pendingSites, carts, construction, clearOrders, buildings, paused, staffing],
  );
  const clock = useCityClock(active);
  const transform = useDerivedValue(() => [{ scale: zoom.get() }, { translateX: -camX.get() }, { translateY: -camY.get() }]);

  // What the stores show, in steps: the warehouse's stockpile squares, the granary's.
  const stockpile = stockpileSteps(STORE_RESOURCES, warehouse, warehouseCapacity);
  const granaryCapacity = buildingStats(buildings).granaryCapacity;
  const foodStock = stockpileSteps(FOOD_RESOURCES, warehouse, granaryCapacity);
  // Stores with no room left: their carts and carriers stay home.
  const full = [...(warehouse.wood >= warehouseCapacity ? ['wood'] : []), ...FOOD_RESOURCES.filter((food) => warehouse[food] >= granaryCapacity)].join(',');
  const parade = ARMY_UNITS.map((unit) => figuresFor(army[unit]));
  const building = construction.map((job) => job.building).sort();
  // Raiders show up on their ground, on the side they come from, while a raid is on its way or at the gate.
  const raiders = raid ? { party: raid.party, side: raidSide(raid.number), atGate } : null;
  const warehousePlot = plotOf('warehouse', placements);
  const granaryPlot = plotOf('granary', placements);
  const selectedPlot = selected ? plotOf(selected, placements) : null;
  // See-through buildings, Stronghold-style: whatever stands in front of the tapped building, the
  // warehouse's stockpile or the building being placed — and would hide it — is left out of the castle
  // image and drawn over it, faint (`FadedBuildings`).
  const ghostPlot = ghost?.plot ?? null;
  const faded = useMemo(() => {
    const watched: Watched[] = [];
    if (selected && selectedPlot && selected !== 'wall' && selected !== 'moat') watched.push(watch(selectedPlot, selected));
    if (ghostPlot) watched.push(watch(ghostPlot));
    // A store tapped (the warehouse, the granary): it goes see-through itself, and so does anything in
    // front of its stockpile.
    const store = selected === 'warehouse' ? { plot: warehousePlot, slots: STORE_RESOURCES.length } : selected === 'granary' ? { plot: granaryPlot, slots: FOOD_RESOURCES.length } : null;
    const open = store?.plot && selected && buildings[selected] > 0 ? store.plot : null;
    if (open) watched.push(watch(stockpilePlot(open, (store?.slots ?? 0) * SLOTS_PER_RESOURCE)));
    const faded: BuildingId[] = fadedBuildings(buildings, placements, watched);
    if (open && selected && !faded.includes(selected)) faded.push(selected);
    return faded.sort();
  }, [buildings, placements, selected, selectedPlot, ghostPlot, warehousePlot, granaryPlot]);
  const key = JSON.stringify([buildings, placements, roads, clearedRocks.length, traps, parade, building, raiders, faded]);
  // In two layers, each drawn in a step of its own: the ground, then everything standing on it.
  const still = useStillImage(key, STILL_SCALE, active, () => [
    <StaticGround key="ground" buildings={buildings} roads={roads} clearedRocks={clearedRocks} traps={traps} />,
    <StaticScene key="scene" buildings={buildings} placements={placements} roads={roads} clearedRocks={clearedRocks} parade={parade} building={building} raiders={raiders} faded={faded} />,
  ]);
  const fadedKey = JSON.stringify([faded, faded.map((id) => [buildings[id], placements[id]])]);
  const fadedPicture = useScenePicture(fadedKey, active, () => (faded.length > 0 ? <FadedBuildings buildings={buildings} placements={placements} faded={faded} /> : null));
  // The faint picture is drawn through a layer (a picture ignores a group's opacity), kept to the
  // rectangle round the faded buildings so the layer stays small.
  const fadedClip = useMemo(() => {
    const rects = faded.map((id) => plotOf(id, placements)).filter((plot): plot is Plot => plot !== null).map(plotRect);
    if (rects.length === 0) return null;
    const left = Math.min(...rects.map((r) => r.x));
    const top = Math.min(...rects.map((r) => r.y));
    const right = Math.max(...rects.map((r) => r.x + r.width));
    const bottom = Math.max(...rects.map((r) => r.y + r.height));
    return Skia.XYWHRect(left - 4, top - 4, right - left + 8, bottom - top + 8);
  }, [faded, placements]);

  // Two canvases, one over the other. Below, everything that stands still — the mountains, the castle
  // image and the forest, big and costly to fill — drawn again only when the camera moves or they change.
  // Over it, see-through, what moves or changes often, redrawn with every animation frame (filling the
  // still part every frame too took a fifth of the browser's time).
  return (
    <View style={styles.frame}>
      <Canvas style={styles.canvas}>
        <Rect x={0} y={0} width={width} height={height} color={LAND} />
        <Group transform={transform}>
          <Backdrop part="back" />
          {still && <Image image={still} x={0} y={STILL_TOP} width={sceneWidth} height={STILL_HEIGHT} />}
          <Backdrop part="front" />
          <ForestTrees look={forest} />
          <Backdrop part="frontFar" />
        </Group>
      </Canvas>
      <Canvas style={styles.over}>
        <Group transform={transform}>
          {selected === 'warehouse' && warehousePlot && buildings.warehouse > 0 && <Stockpile resources={STORE_RESOURCES} steps={stockpile} plot={warehousePlot} />}
          {selected === 'granary' && granaryPlot && buildings.granary > 0 && <Stockpile resources={FOOD_RESOURCES} steps={foodStock} plot={granaryPlot} />}
          {fadedPicture && fadedClip && (
            <Group clip={fadedClip} layer={<Paint opacity={FADED_OPACITY} />}>
              <Picture picture={fadedPicture} />
            </Group>
          )}
          <Flocks look={flocks} clock={clock} />
          <LiveBits buildings={buildings} placements={placements} clock={clock} />
          <FishingBoats look={boats} clock={clock} />
          <Barges clock={clock} live={active} />
          <Wagons clock={clock} placements={placements} roads={roads} clearedRocks={clearedRocks} live={active} />
          <Housewives clock={clock} placements={placements} roads={roads} clearedRocks={clearedRocks} live={active} />
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
            felling={felling}
            hauled={hauled}
            full={full}
          />
          {selectedPlot && <Selection plot={selectedPlot} />}
          {ghost && <PlacementGhost ghost={ghost} />}
        </Group>
      </Canvas>
    </View>
  );
}

export default memo(GameSceneCanvas);

// The ground that doesn't move: grass, roads, rocks, traps and, until it's built, the wall's line.
function StaticGround({ buildings, roads, clearedRocks, traps }: { buildings: Record<BuildingId, number>; roads: Roads; clearedRocks: string[]; traps: Trap[] }) {
  return (
    <Group>
      <Ground flooded={buildings.moat > 0} />
      <RoadTiles roads={roads} />
      <Rocks cleared={clearedRocks} rocks={rocksLeft(clearedRocks)} />
      <Traps traps={traps} />
      {tierOf(buildings.wall) === 0 && <PlannedWall />}
    </Group>
  );
}

// Everything standing on it that doesn't move.
function StaticScene({ buildings, placements, roads, clearedRocks, parade, building, raiders, faded }: {
  buildings: Record<BuildingId, number>;
  placements: Placements;
  roads: Roads;
  clearedRocks: string[];
  parade: number[];
  building: BuildingId[];
  raiders: { party: RaidParty; side: MapSide; atGate: boolean } | null;
  /** Buildings left out (drawn see-through over the image instead, `FadedBuildings`); their shadows stay. */
  faded: BuildingId[];
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
    if (tier > 0 && faded.includes(id)) continue;
    add(front(plot), tier === 0 ? <EmptyPlot key={id} plot={plot} /> : <BuildingArt key={id} id={id} plot={plot} tier={tier} level={buildings[id]} />);
  }

  add(front(MINE_PLOT), <Headframe key="mine" />);
  if (raiders) raiderFigures(raiders.party, raiders.side, raiders.atGate).forEach((figure, index) => add(figure.x + figure.y, <RaiderFigure key={`raider-${String(index)}`} {...figure} />));
  add(CAMPFIRE.x + CAMPFIRE.y + 1, <Campfire key="fire" />);
  add(PARADE.x + PARADE.y + 3, <Parade key="parade" figures={parade} />);
  items.sort((a, b) => a.depth - b.depth);

  return (
    <Group>
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

// The see-through buildings, back to front, as the still image would draw them (recorded into a picture
// by `useScenePicture` and drawn faint over the castle image).
function FadedBuildings({ buildings, placements, faded }: { buildings: Record<BuildingId, number>; placements: Placements; faded: BuildingId[] }) {
  const items = faded
    .map((id) => ({ id, plot: plotOf(id, placements) }))
    .filter((item): item is { id: BuildingId; plot: Plot } => item.plot !== null)
    .sort((a, b) => a.plot.x + a.plot.w + a.plot.y + a.plot.d - (b.plot.x + b.plot.w + b.plot.y + b.plot.d));
  return (
    <Group>
      {items.map(({ id, plot }) => (
        <BuildingArt key={id} id={id} plot={plot} tier={tierOf(buildings[id])} level={buildings[id]} />
      ))}
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

const styles = StyleSheet.create({
  frame: { flex: 1, overflow: 'hidden' },
  canvas: { flex: 1 },
  over: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
});
