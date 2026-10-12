// What's drawn over the scene while the player picks or places something: empty plots, the selection,
// and the placement ghost with its grid.
import { useMemo } from 'react';
import { Group, Path, Rect } from '@shopify/react-native-skia';
import { MAP_SIZE, iso, zoneAt, type Plot } from '../GameSceneLayout';
import { parseSvg, svgPath, useSvgPaths } from '../skiaPaths';
import { poly } from './shapes';
import { BELT, landRing } from './ground';

/** A tile in a stroke being painted (roads or traps), and whether it can take what's painted. */
export type PaintTile = { x: number; y: number; ok: boolean };

/**
 * Something being placed: where a building's footprint would go (if anywhere yet) and whether it fits
 * there, or the tiles of a road / trap stroke; `belt` lights up the trap belt, for laying traps. For a
 * building, `allowed` and `rocky` light the ground it may go on (rocky: to clear first), and `water`
 * shows the grid on the river too (fishing huts).
 */
type Tile = { x: number; y: number };
export type Ghost = { plot: Plot | null; valid: boolean; belt?: boolean; tiles?: PaintTile[]; allowed?: Tile[]; rocky?: Tile[]; water?: boolean };
const NO_TILES: Tile[] = [];

/**
 * The tiles' outlines on land (`water` false) or on the river and the harbour (true): an edge is on the
 * water when the tiles either side of it are both water (or one is off the map). Shown only while placing
 * a building or painting tiles — the water's only while placing a fishing hut.
 */
function gridLines(water: boolean) {
  const parts: string[] = [];
  const wet = (x: number, y: number) => (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE ? null : zoneAt(x, y) === 'water');
  const onWater = (a: boolean | null, b: boolean | null) => !!((a ?? b) && (b ?? a));
  const line = (from: { x: number; y: number }, to: { x: number; y: number }) => `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  for (let i = 0; i <= MAP_SIZE; i++) {
    // Along the line y = i, then x = i, in runs of edges on the right ground.
    let alongX = -1;
    let alongY = -1;
    for (let j = 0; j <= MAP_SIZE; j++) {
      const x = j < MAP_SIZE && onWater(wet(j, i - 1), wet(j, i)) === water;
      if (x && alongX < 0) alongX = j;
      if (!x && alongX >= 0) {
        parts.push(line(iso(alongX, i), iso(j, i)));
        alongX = -1;
      }
      const y = j < MAP_SIZE && onWater(wet(i - 1, j), wet(i, j)) === water;
      if (y && alongY < 0) alongY = j;
      if (!y && alongY >= 0) {
        parts.push(line(iso(i, alongY), iso(i, j)));
        alongY = -1;
      }
    }
  }
  return parts.join(' ');
}

// The land's and the water's grids, parsed once (the placement ghost draws them while placing or painting).
let gridPaths: { land: ReturnType<typeof parseSvg>; water: ReturnType<typeof parseSvg> } | null = null;

// An empty plot: corner stakes and a rope.
export function EmptyPlot({ plot }: { plot: Plot }) {
  const corners = [iso(plot.x, plot.y), iso(plot.x + plot.w, plot.y), iso(plot.x + plot.w, plot.y + plot.d), iso(plot.x, plot.y + plot.d)];
  return (
    <Group opacity={0.8}>
      <Path path={svgPath(poly(corners))} style="stroke" strokeWidth={1} color="#e0cf96" />
      {corners.map((c, index) => <Rect key={index} x={c.x - 1} y={c.y - 7} width={2} height={7} color="#6e4a2f" />)}
    </Group>
  );
}

export function Selection({ plot }: { plot: Plot }) {
  const corners = [iso(plot.x, plot.y), iso(plot.x + plot.w, plot.y), iso(plot.x + plot.w, plot.y + plot.d), iso(plot.x, plot.y + plot.d)];
  const [outline] = useSvgPaths([poly(corners)]);
  return <Path path={outline} style="stroke" strokeWidth={2} color="#f3d27a" />;
}

const tileDiamonds = (tiles: { x: number; y: number }[]) =>
  tiles.map((tile) => poly([iso(tile.x, tile.y), iso(tile.x + 1, tile.y), iso(tile.x + 1, tile.y + 1), iso(tile.x, tile.y + 1)])).join(' ');

// Many tiles as few shapes: each row's runs of neighbouring tiles as one strip.
function tileRuns(tiles: readonly Tile[]) {
  const rows = new Map<number, number[]>();
  for (const { x, y } of tiles) {
    const row = rows.get(y) ?? [];
    row.push(x);
    rows.set(y, row);
  }
  const parts: string[] = [];
  for (const [y, xs] of rows) {
    xs.sort((a, b) => a - b);
    let start = xs[0];
    for (let i = 1; i <= xs.length; i++) {
      if (i < xs.length && xs[i] === xs[i - 1] + 1) continue;
      const end = xs[i - 1] + 1;
      parts.push(poly([iso(start, y), iso(end, y), iso(end, y + 1), iso(start, y + 1)]));
      if (i < xs.length) start = xs[i];
    }
  }
  return parts.join(' ');
}

// Something being placed: its footprint on a stronger grid, green where it fits and red where it
// doesn't (and, for traps, the belt lit up).
// The belt's tiles and edges, for laying traps: parsed once.
let beltPaths: { tiles: ReturnType<typeof parseSvg>; edges: ReturnType<typeof parseSvg> } | null = null;

export function PlacementGhost({ ghost }: { ghost: Ghost }) {
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
  const allowed = ghost.allowed ?? NO_TILES;
  const rocky = ghost.rocky ?? NO_TILES;
  // The lit ground only changes with what's placed, not as the footprint is dragged about.
  const allowedSvg = useMemo(() => tileRuns(allowed), [allowed]);
  const rockySvg = useMemo(() => tileRuns(rocky), [rocky]);
  const [area, left, right, lid, ok, bad, ground, rocks] = useSvgPaths([
    footprint,
    ...shell,
    tiles.length > 0 ? tileDiamonds(tiles.filter((tile) => tile.ok)) : '',
    tiles.length > 0 ? tileDiamonds(tiles.filter((tile) => !tile.ok)) : '',
    allowedSvg,
    rockySvg,
  ]);
  gridPaths ??= { land: parseSvg(gridLines(false)), water: parseSvg(gridLines(true)) };
  beltPaths ??= { tiles: parseSvg(BELT), edges: parseSvg(`${landRing(3)} ${landRing(5)}`) };
  return (
    <Group>
      <Path path={gridPaths.land} style="stroke" strokeWidth={0.8} color="rgba(255, 255, 240, 0.22)" />
      {ghost.water && <Path path={gridPaths.water} style="stroke" strokeWidth={0.8} color="rgba(255, 255, 240, 0.22)" />}
      {/* Where this building may go: clear ground lit blue, ground under rocks (to clear first) yellow. */}
      {allowed.length > 0 && (
        <>
          <Path path={ground} color="rgba(150, 230, 255, 0.26)" />
          <Path path={ground} style="stroke" strokeWidth={0.8} color="rgba(170, 236, 255, 0.6)" />
        </>
      )}
      {rocky.length > 0 && (
        <>
          <Path path={rocks} color="rgba(255, 210, 80, 0.3)" />
          <Path path={rocks} style="stroke" strokeWidth={0.8} color="rgba(255, 222, 120, 0.6)" />
        </>
      )}
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
