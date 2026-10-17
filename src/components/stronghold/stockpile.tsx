// The warehouse's stockpile, Stronghold-style: the floor of the warehouse is a grid of squares, two to a
// resource, each with its own place. Goods pile up on them as the stock grows — logs stacked, granite in
// blocks, ores and coal in heaps, the precious things in chests, wool in bales — a square filling before
// the next is started, so a full warehouse is a floor covered end to end. Seen when the warehouse is tapped
// (the building is then drawn see-through, GameSceneCanvas). Drawn live (the stock changes often), in steps
// so ordinary ticks don't redraw it.
import { memo } from 'react';
import { Group, Path } from '@shopify/react-native-skia';
import { RESOURCE_INFO, type Resource } from '../../game/resources';
import { iso, type Plot } from '../GameSceneLayout';
import { useSvgPaths } from '../skiaPaths';
import { poly, seg, type P } from './shapes';

/** Squares of the yard each resource gets: a resource at capacity fills both. */
export const SLOTS_PER_RESOURCE = 2;
/** A square's look changes in this many steps as it fills. */
export const STACK_STEPS = 8;
// The whole floor of the 5 × 5 plot, inside the walls (buildingArt draws the warehouse 0.15 in from its edges).
const COLUMNS = 6;
const SLOT_W = 0.78;
const SLOT_D = 0.94;
const YARD_Y = 0.15;
const MARGIN_X = 0.15;
const GROUND = 'rgba(96, 78, 52, 0.55)';
const GROUND_LINE = 'rgba(236, 222, 180, 0.35)';

type Look = 'logs' | 'blocks' | 'heap' | 'chest' | 'bale';
const LOOKS: Partial<Record<Resource, Look>> = { wood: 'logs', granite: 'blocks', wool: 'bale', gold: 'chest', silver: 'chest', diamond: 'chest', emerald: 'chest', mithril: 'chest' };
const lookOf = (resource: Resource): Look => LOOKS[resource] ?? 'heap';
const CHEST = { side: '#6e4a2f', dark: '#4a2f1c', band: '#2a2620' };

/** Where square `index` of a stockpile on `plot` stands on the map (its top-left corner, in tiles). */
export function slotAt(plot: Plot, index: number): P {
  return { x: plot.x + MARGIN_X + (index % COLUMNS) * SLOT_W, y: plot.y + YARD_Y + Math.floor(index / COLUMNS) * SLOT_D };
}

/** The yard's footprint (its goods reach `tall` pixels up), for telling what stands in front of it. */
export function stockpilePlot(plot: Plot, slots: number): Plot {
  return { x: plot.x + MARGIN_X, y: plot.y + YARD_Y, w: COLUMNS * SLOT_W, d: Math.ceil(slots / COLUMNS) * SLOT_D, tall: 16 };
}

/**
 * How full every square is, 0…STACK_STEPS, as one short string (the stockpile's memo key): a resource's
 * first square fills with its first half of the capacity, the second with the rest.
 */
export function stockpileSteps(resources: readonly Resource[], stock: Partial<Record<Resource, number>>, capacity: number): string {
  const per = Math.max(1, capacity) / SLOTS_PER_RESOURCE;
  const steps: number[] = [];
  for (const resource of resources) {
    const have = stock[resource] ?? 0;
    for (let i = 0; i < SLOTS_PER_RESOURCE; i += 1) {
      const fill = Math.min(1, Math.max(0, (have - i * per) / per));
      steps.push(fill <= 0 ? 0 : Math.max(1, Math.ceil(fill * STACK_STEPS)));
    }
  }
  return steps.join();
}

// The shapes of one square's goods at `fill` (0…1): four SVG strings — the lit faces, the shaded faces,
// the top, and the lines drawn over them (log ends, mortar, the chest's band).
function goods(look: Look, at: P, fill: number): [string, string, string, string] {
  const [x0, y0] = [at.x + 0.06, at.y + 0.06];
  const [w, d] = [SLOT_W - 0.12, SLOT_D - 0.12];
  const box = (x: number, y: number, bw: number, bd: number, z: number, h: number): [string, string, string] => {
    const [A, B, C, D] = [iso(x, y, z + h), iso(x + bw, y, z + h), iso(x + bw, y + bd, z + h), iso(x, y + bd, z + h)];
    return [
      poly([iso(x, y + bd, z), iso(x + bw, y + bd, z), C, D]), // the left (lit) wall
      poly([iso(x + bw, y, z), iso(x + bw, y + bd, z), C, B]), // the right (shaded) wall
      poly([A, B, C, D]),
    ];
  };
  switch (look) {
    case 'heap': {
      // A heap: a low mound that rises and spreads as it fills.
      const spread = 0.55 + 0.45 * fill;
      const [hw, hd] = [(w / 2) * spread, (d / 2) * spread];
      const [cx, cy] = [x0 + w / 2, y0 + d / 2];
      const [A, B, C, D] = [iso(cx - hw, cy - hd), iso(cx + hw, cy - hd), iso(cx + hw, cy + hd), iso(cx - hw, cy + hd)];
      const apex = iso(cx, cy, 2 + 11 * fill);
      return [`${poly([A, D, apex])} ${poly([D, C, apex])}`, `${poly([A, B, apex])} ${poly([B, C, apex])}`, '', ''];
    }
    case 'logs': {
      // Logs stacked along the square, their ends showing on the right face.
      const h = 2 + 11 * fill;
      const [lit, shade, top] = box(x0, y0, w, d, 0, h);
      const lines: string[] = [];
      for (let z = 2.2; z < h - 0.5; z += 2.2) lines.push(seg(iso(x0, y0 + d, z), iso(x0 + w, y0 + d, z)));
      for (let u = 0.12; u < d; u += 0.15) lines.push(seg(iso(x0 + w, y0 + u, 0), iso(x0 + w, y0 + u, h)));
      return [lit, shade, top, lines.join(' ')];
    }
    case 'blocks': {
      // Dressed blocks in courses, the joints staggered.
      const h = 2 + 10 * fill;
      const [lit, shade, top] = box(x0, y0, w, d, 0, h);
      const lines: string[] = [];
      let course = 0;
      for (let z = 2.5; z < h - 0.5; z += 2.5, course += 1) {
        lines.push(seg(iso(x0, y0 + d, z), iso(x0 + w, y0 + d, z)), seg(iso(x0 + w, y0 + d, z), iso(x0 + w, y0, z)));
        for (let u = (course % 2) * 0.1 + 0.1; u < w; u += 0.2) lines.push(seg(iso(x0 + u, y0 + d, z), iso(x0 + u, y0 + d, Math.min(h, z + 2.5))));
      }
      return [lit, shade, top, lines.join(' ')];
    }
    case 'bale': {
      // Bales of wool, two by two, a layer more as it fills.
      const layers = Math.max(1, Math.ceil(fill * 3));
      const parts: [string[], string[], string[]] = [[], [], []];
      for (let layer = 0; layer < layers; layer += 1) {
        for (const [bx, by] of [[0, 0], [w / 2, 0], [0, d / 2], [w / 2, d / 2]]) {
          const [lit, shade, top] = box(x0 + bx + 0.03, y0 + by + 0.03, w / 2 - 0.06, d / 2 - 0.06, layer * 3.6, 3.4);
          parts[0].push(lit);
          parts[1].push(shade);
          parts[2].push(top);
        }
      }
      return [parts[0].join(' '), parts[1].join(' '), parts[2].join(' '), ''];
    }
    case 'chest': {
      // Chests, up to four to a square, stacked two high when it's past half full.
      const count = Math.max(1, Math.ceil(fill * 4));
      const parts: [string[], string[], string[], string[]] = [[], [], [], []];
      for (let i = 0; i < Math.min(4, count); i += 1) {
        const bx = (i % 2) * (w / 2);
        const by = d * 0.25;
        const bz = i < 2 ? 0 : 4.4;
        const [lit, shade, top] = box(x0 + bx + 0.04, y0 + by, w / 2 - 0.08, d * 0.5, bz, 4);
        parts[0].push(lit);
        parts[1].push(shade);
        parts[2].push(top);
        parts[3].push(seg(iso(x0 + bx + 0.04, y0 + by + d * 0.5, bz + 2), iso(x0 + bx + w / 2 - 0.04, y0 + by + d * 0.5, bz + 2)));
      }
      return [parts[0].join(' '), parts[1].join(' '), parts[2].join(' '), parts[3].join(' ')];
    }
  }
}

/** The warehouse's stockpile: `steps` from `stockpileSteps`, on the warehouse's `plot`. */
export const Stockpile = memo(function Stockpile({ resources, steps, plot }: { resources: readonly Resource[]; steps: string; plot: Plot }) {
  const fills = steps.split(',').map(Number);
  const slots = resources.length * SLOTS_PER_RESOURCE;
  // The squares themselves: packed earth, outlined.
  const squares = Array.from({ length: slots }, (_, index) => {
    const at = slotAt(plot, index);
    return poly([iso(at.x, at.y), iso(at.x + SLOT_W, at.y), iso(at.x + SLOT_W, at.y + SLOT_D), iso(at.x, at.y + SLOT_D)]);
  }).join(' ');
  const svgs = [squares];
  const drawn: { resource: Resource; index: number }[] = [];
  for (let index = 0; index < slots; index += 1) {
    const step = fills[index] ?? 0;
    if (step <= 0) continue;
    const resource = resources[Math.floor(index / SLOTS_PER_RESOURCE)];
    drawn.push({ resource, index });
    svgs.push(...goods(lookOf(resource), slotAt(plot, index), step / STACK_STEPS));
  }
  const paths = useSvgPaths(svgs);
  return (
    <Group>
      <Path path={paths[0]} color={GROUND} />
      <Path path={paths[0]} style="stroke" strokeWidth={0.8} color={GROUND_LINE} />
      {drawn.map(({ resource, index }, i) => {
        const look = lookOf(resource);
        const info = RESOURCE_INFO[resource];
        const [lit, shade, top, lines] = [paths[1 + i * 4], paths[2 + i * 4], paths[3 + i * 4], paths[4 + i * 4]];
        // Chests are wood with the goods' colour on the lid; everything else is the goods themselves.
        const colors = look === 'chest' ? { lit: CHEST.side, shade: CHEST.dark, top: info.color, lines: CHEST.band } : { lit: info.color, shade: info.dark, top: info.light, lines: info.dark };
        return (
          <Group key={index}>
            <Path path={lit} color={colors.lit} />
            <Path path={shade} color={colors.shade} />
            {svgs[3 + i * 4] ? <Path path={top} color={colors.top} /> : null}
            {svgs[4 + i * 4] ? <Path path={lines} style="stroke" strokeWidth={0.6} color={colors.lines} /> : null}
          </Group>
        );
      })}
    </Group>
  );
});
