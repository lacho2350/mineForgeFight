// Peasants: every peasant above ground is one sprite in a single atlas, moved by one animation function.
import { useMemo } from 'react';
import { Atlas, Group, Rect, Skia, useRSXformBuffer, type SkImage } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import type { Construction } from '../../game/state';
import type { BuildingId } from '../../game/buildings';
import { HOUSE_IDS } from '../../game/houses';
import { FISHERY_IDS, ORCHARD_IDS, PASTURE_IDS } from '../../game/farms';
import { FOOTPRINTS, MINE_SPOT, spotOf, type Placements } from '../../game/cityMap';
import { FOREST_EXIT, parseSpot, standWay } from '../../game/forest';
import { walkBetween, walkOn, type Roads, type Walk } from '../../game/roads';
import type { ClearOrder } from '../../game/rocks';
import type { Workforce } from '../../game/workforce';
import { CAMPFIRE, TILE_HH, TILE_HW, iso, plotOf } from '../GameSceneLayout';
import { ORIGIN } from './shapes';

const TUNICS = ['#7a5a3a', '#5d6e3a', '#8a6a4a', '#6a5a7a', '#7a4a3a'];
const LOADS = ['#1c1c1f', '#9a9da3', '#c46a2b', '#7a3427', '#8a5a2e'];
/** The logs woodcutters carry home. */
const LOGS_LOAD = 4;

/** A peasant, standing with their feet at (x, y) (tower archers, drawn into the still image). */
export function Peasant({ x = 0, y = 0, tunic }: { x?: number; y?: number; tunic: string }) {
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
const STAFFED_SHOWN: BuildingId[] = [...HOUSE_IDS, 'docks', 'gate', 'foundry', 'research', 'armory', 'stables', 'balloonWorks', 'monastery', 'barracks', 'guardhouse', 'archery', 'chapel', 'sanctum', 'griffinEyrie', 'granary', ...ORCHARD_IDS, ...FISHERY_IDS, ...PASTURE_IDS];

function peasantSpecs(
  workforce: Workforce,
  construction: Construction[],
  clearOrders: ClearOrder[],
  buildings: Record<BuildingId, number>,
  placements: Placements,
  roads: Roads,
  clearedRocks: string[],
  felling: string,
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
  // Woodcutters out through the gate and down the road to the forest, on to the stand being felled, and
  // home with logs on their shoulders.
  const hut = footprint('woodcutter');
  const stand = felling ? parseSpot(felling) : null;
  const road = hut && buildings.woodcutter > 0 && stand ? walkBetween(hut, { ...FOREST_EXIT, w: 1, d: 1 }, placements, roads, clearedRocks) : null;
  const fell = road && stand ? walkOn(road, standWay(stand)) : null;
  const cutters = fell ? Math.min(3, workforce.staff.woodcutter, MAX_WALKERS - walkers) : 0;
  for (let i = 0; i < cutters && fell; i++) walker(fell, 0.8, i / Math.max(1, cutters), (i + 2) % TUNICS.length, LOGS_LOAD, true);
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

export function PeasantAtlas({ workforce, construction, clearOrders, clock, buildings, placements, roads, clearedRocks, felling }: {
  workforce: Workforce;
  construction: Construction[];
  clearOrders: ClearOrder[];
  clearedRocks: string[];
  clock: SharedValue<number>;
  buildings: Record<BuildingId, number>;
  placements: Placements;
  roads: Roads;
  /** The forest stand the woodcutters are felling (its key; empty if none). */
  felling: string;
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
    Math.min(3, workforce.staff.woodcutter),
    felling,
  ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const specs = useMemo(() => peasantSpecs(workforce, construction, clearOrders, buildings, placements, roads, clearedRocks, felling), [shape]);
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
