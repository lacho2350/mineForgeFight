import { memo, useMemo } from 'react';
import {
  Canvas,
  DashPathEffect,
  Group,
  PaintStyle,
  Picture,
  Rect,
  Skia,
  createPicture,
  type SkPicture,
} from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { getCartRoutes } from '../game/haulage';
import { digTime, isDug, parseKey, type MineLayout, type Site } from '../game/mineLayout';
import { MINE_SURFACE_ROWS, MINE_TILE_SIZE } from './MineMapLayout';
import { TERRAIN_CHUNKS, TERRAIN_CHUNK_COLUMNS, getChunkPicture, getSurfacePicture } from './mineTerrain';
import { ExitStockpiles, LevelCart, MinerStockpiles } from './MineHaulers';
import type { CartLoad } from '../game/gameStore';
import type { Resource } from '../game/resources';

const tileSize = MINE_TILE_SIZE;
const minerPixels = [
  '..HHHH..',
  '.HHHHHH.',
  '.HSSSSH.',
  '..SWWS..',
  '..PPPP..',
  '.PPPPPP.',
  '.PBBPPP.',
  '..BBBB..',
  '.B....B.',
  '.D....D.',
];
const minerPalette: Record<string, string> = {
  H: '#6b3f1f',
  S: '#d9a06e',
  W: '#2a1d14',
  P: '#3f6fa3',
  B: '#4a3a2c',
  D: '#241a14',
};
const outlineColor = '#241b13';
const outlineOpacity = 0.52;
const minerPixelSize = 5;

// Each miner is ~100 outlined pixels; record the sprite once and replay it as a single picture.
function createMinerPicture(): SkPicture {
  const fill = Skia.Paint();
  const stroke = Skia.Paint();
  stroke.setStyle(PaintStyle.Stroke);
  stroke.setStrokeWidth(0.7);
  stroke.setColor(Skia.Color(outlineColor));
  stroke.setAlphaf(outlineOpacity);
  const size = minerPixelSize;
  return createPicture((canvas) => {
    minerPixels.forEach((row, rowIndex) => {
      Array.from(row).forEach((pixel, columnIndex) => {
        if (pixel === '.') return;
        const x = columnIndex * size;
        const y = rowIndex * size;
        fill.setColor(Skia.Color(minerPalette[pixel]));
        canvas.drawRect(Skia.XYWHRect(x, y, size, size), fill);
        canvas.drawRect(Skia.XYWHRect(x + 0.35, y + 0.35, size - 0.7, size - 0.7), stroke);
      });
    });
  }, { width: minerPixels[0].length * size, height: minerPixels.length * size });
}

function SiteMiners({ sites, picture }: { sites: Site[]; picture: SkPicture }) {
  return sites.map((site) => (
    <Group key={`miner-${String(site.row)}-${String(site.column)}`} transform={[{ translateX: site.column * tileSize }, { translateY: site.row * tileSize }]}>
      <Picture picture={picture} />
    </Group>
  ));
}

/** The part of the map (in map pixels, with some margin) the camera can currently see. */
export type MineView = { left: number; top: number; right: number; bottom: number };

// Terrain is cached in row chunks (see mineTerrain); only chunks inside the view are drawn,
// so the cost stays the same however big the claim is.
function TerrainChunks({ view, layout }: { view: MineView; layout: MineLayout }) {
  const firstRow = Math.max(MINE_SURFACE_ROWS, Math.floor(view.top / tileSize));
  const lastRow = Math.min(layout.rows - 1, Math.ceil(view.bottom / tileSize));
  const chunkWidth = TERRAIN_CHUNK_COLUMNS * tileSize;
  const firstChunk = Math.max(0, Math.floor(view.left / chunkWidth));
  const lastChunk = Math.min(TERRAIN_CHUNKS - 1, Math.floor(view.right / chunkWidth));
  const chunks: [number, number][] = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let chunk = firstChunk; chunk <= lastChunk; chunk += 1) chunks.push([row, chunk]);
  }

  return (
    <Group>
      {view.top < MINE_SURFACE_ROWS * tileSize && <Picture picture={getSurfacePicture()} />}
      {chunks.map(([row, chunk]) => (
        <Group key={`chunk-${String(row)}-${String(chunk)}`} transform={[{ translateY: row * tileSize }]}>
          <Picture picture={getChunkPicture(row, chunk, layout)} />
        </Group>
      ))}
    </Group>
  );
}

export type DigOverlayState = {
  /** Ordered, paid-for tiles still to be dug; the first is being dug now. */
  plan: string[];
  /** Seconds spent on the first planned tile. */
  progress: number;
  /** Tiles in the drag the player is making right now. */
  preview: string[];
  /** The tile the drag tried to add that breaks a rule, if any. */
  invalid: string | null;
};

// Dashed outlines for ordered tiles, a progress bar and digger on the tile being cut, and the
// live drag preview (green where the tunnel can go, red where it can't).
function DigOverlay({ layout, dig, digger }: { layout: MineLayout; dig: DigOverlayState; digger: SkPicture }) {
  const current = dig.plan[0] ? parseKey(dig.plan[0]) : null;
  // The digger stands in the dug tile next to the one being cut.
  const diggerSpot = current
    ? [[0, -1], [0, 1], [-1, 0], [1, 0]]
        .map(([dr, dc]) => ({ row: current.row + dr, column: current.column + dc }))
        .find((tile) => isDug(layout, tile.row, tile.column))
    : undefined;

  return (
    <Group>
      {dig.plan.map((key, index) => {
        const { row, column } = parseKey(key);
        return (
          <Group key={`plan-${key}`}>
            <Rect x={column * tileSize} y={row * tileSize} width={tileSize} height={tileSize} color="#ffd166" opacity={index === 0 ? 0.22 : 0.1} />
            <Rect x={column * tileSize + 2} y={row * tileSize + 2} width={tileSize - 4} height={tileSize - 4} color="#ffd166" style="stroke" strokeWidth={2}>
              <DashPathEffect intervals={[6, 4]} />
            </Rect>
          </Group>
        );
      })}
      {current && (
        <Group>
          <Rect x={current.column * tileSize + 6} y={current.row * tileSize + tileSize - 10} width={tileSize - 12} height={5} color="#0d0a08" />
          <Rect
            x={current.column * tileSize + 6}
            y={current.row * tileSize + tileSize - 10}
            width={(tileSize - 12) * Math.min(1, dig.progress / digTime(current.row))}
            height={5}
            color="#ffd166"
          />
        </Group>
      )}
      {diggerSpot && (
        <Group transform={[{ translateX: diggerSpot.column * tileSize + 4 }, { translateY: diggerSpot.row * tileSize - 4 }]}>
          <Picture picture={digger} />
        </Group>
      )}
      {dig.preview.map((key) => {
        const { row, column } = parseKey(key);
        return (
          <Group key={`preview-${key}`}>
            <Rect x={column * tileSize} y={row * tileSize} width={tileSize} height={tileSize} color="#9be37a" opacity={0.28} />
            <Rect x={column * tileSize + 1} y={row * tileSize + 1} width={tileSize - 2} height={tileSize - 2} color="#c8f5a8" style="stroke" strokeWidth={2} />
          </Group>
        );
      })}
      {dig.invalid && (
        <Rect
          x={parseKey(dig.invalid).column * tileSize}
          y={parseKey(dig.invalid).row * tileSize}
          width={tileSize}
          height={tileSize}
          color="#e5484d"
          opacity={0.45}
        />
      )}
    </Group>
  );
}

export type MineSceneCanvasProps = {
  layout: MineLayout;
  /** Screen size of the canvas. */
  width: number;
  height: number;
  /** Camera: map position at the top-left of the screen, and zoom. */
  camX: SharedValue<number>;
  camY: SharedValue<number>;
  zoom: SharedValue<number>;
  view: MineView;
  /** Heap step (0–MINER_PILE_STEPS) for each resource's bins beside the miners. */
  minerPileSteps: Record<Resource, number>;
  /** Heap step (0–EXIT_PILE_STEPS) for each resource's bin at the mine exit. */
  exitPileSteps: Record<Resource, number>;
  /** Smoothed haul time that drives the carts (see MineViewport's useHaulClock). */
  time: SharedValue<number>;
  /** What each level's cart carries, keyed by level. */
  cartLoads: Record<number, CartLoad>;
  dig: DigOverlayState;
  /** Tile the player tapped, outlined. */
  selectedKey: string | null;
};

// A screen-sized canvas: the camera moves the map under it on the UI thread, while React only
// re-renders when the visible area, the layout or the dig overlay changes.
function MineSceneCanvas({
  layout,
  width,
  height,
  camX,
  camY,
  zoom,
  view,
  minerPileSteps,
  exitPileSteps,
  time,
  cartLoads,
  dig,
  selectedKey,
}: MineSceneCanvasProps) {
  const minerPicture = useMemo(() => createMinerPicture(), []);
  const transform = useDerivedValue(() => [
    { scale: zoom.get() },
    { translateX: -camX.get() },
    { translateY: -camY.get() },
  ]);
  const visibleSites = layout.sites.filter((site) => {
    const x = site.column * tileSize;
    const y = site.row * tileSize;
    return x + tileSize >= view.left && x <= view.right && y + tileSize >= view.top && y <= view.bottom;
  });
  // Carts ride the main lift to the surface, so every cart is drawn, not just on-screen ones.
  const routes = [...getCartRoutes(layout)];

  return (
    // Skia's web Canvas hands `style` straight to the DOM, so it must be a plain object, not an array.
    <Canvas style={{ ...styles.canvas, width, height }}>
      <Rect x={0} y={0} width={width} height={height} color="#0d0a08" />
      <Group transform={transform}>
        <TerrainChunks view={view} layout={layout} />
        {view.top < MINE_SURFACE_ROWS * tileSize && <ExitStockpiles steps={exitPileSteps} />}
        {routes.map(([level, route]) => (
          <LevelCart key={`cart-${String(level)}`} route={route} time={time} load={cartLoads[level] as CartLoad | undefined} />
        ))}
        <SiteMiners sites={visibleSites} picture={minerPicture} />
        <MinerStockpiles sites={visibleSites} steps={minerPileSteps} />
        <DigOverlay layout={layout} dig={dig} digger={minerPicture} />
        {selectedKey && (
          <Rect
            x={parseKey(selectedKey).column * tileSize + 1}
            y={parseKey(selectedKey).row * tileSize + 1}
            width={tileSize - 2}
            height={tileSize - 2}
            color="#ffffff"
            style="stroke"
            strokeWidth={2}
          />
        )}
      </Group>
    </Canvas>
  );
}

export default memo(MineSceneCanvas);

const styles = StyleSheet.create({
  canvas: { position: 'absolute', left: 0, top: 0 },
});
