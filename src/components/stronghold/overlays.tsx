// What's drawn over the scene while the player picks or places something: empty plots, the selection,
// and the placement ghost with its grid.
import { Group, Path, Rect } from '@shopify/react-native-skia';
import { MAP_SIZE, iso, type Plot } from '../GameSceneLayout';
import { parseSvg, svgPath, useSvgPaths } from '../skiaPaths';
import { poly } from './shapes';
import { BELT, landRing } from './ground';

/** A tile in a stroke being painted (roads or traps), and whether it can take what's painted. */
export type PaintTile = { x: number; y: number; ok: boolean };

/**
 * Something being placed: where a building's footprint would go (if anywhere yet) and whether it fits
 * there, or the tiles of a road / trap stroke; `belt` lights up the trap belt, for laying traps.
 */
export type Ghost = { plot: Plot | null; valid: boolean; belt?: boolean; tiles?: PaintTile[] };

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
let gridPath: ReturnType<typeof parseSvg> | null = null;

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
  const [area, left, right, lid, ok, bad] = useSvgPaths([
    footprint,
    ...shell,
    tiles.length > 0 ? tileDiamonds(tiles.filter((tile) => tile.ok)) : '',
    tiles.length > 0 ? tileDiamonds(tiles.filter((tile) => !tile.ok)) : '',
  ]);
  gridPath ??= parseSvg(GRID);
  beltPaths ??= { tiles: parseSvg(BELT), edges: parseSvg(`${landRing(3)} ${landRing(5)}`) };
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
