// Peasants: every peasant above ground is one sprite in a single atlas, moved by one animation function.
import { useMemo } from 'react';
import { Atlas, Group, Rect, Skia, useRSXformBuffer, type SkImage } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import type { Construction } from '../../game/state';
import type { BuildingId } from '../../game/buildings';
import { WOODCUTTER_IDS } from '../../game/woodcutters';
import { FISHERY_IDS, ORCHARD_IDS, PASTURE_IDS } from '../../game/farms';
import { foodStore } from '../../game/homes';
import { RESOURCES, RESOURCE_INFO, type Resource } from '../../game/resources';
import { FOOTPRINTS, MINE_SPOT, spotOf, type Placements } from '../../game/cityMap';
import { FOREST_EXIT, parseSpot, standWay } from '../../game/forest';
import { cartWay, walkBetween, walkOn, type Roads, type Walk } from '../../game/roads';
import type { ClearOrder } from '../../game/rocks';
import type { Workforce } from '../../game/workforce';
import { CAMPFIRE, TILE_HH, TILE_HW, iso, plotOf } from '../GameSceneLayout';
import { ORIGIN } from './shapes';

const TUNICS = ['#7a5a3a', '#5d6e3a', '#8a6a4a', '#6a5a7a', '#7a4a3a'];
const LOADS = ['#1c1c1f', '#9a9da3', '#c46a2b', '#7a3427', '#8a5a2e', RESOURCE_INFO.fish.color, RESOURCE_INFO.mutton.color];
/** The logs woodcutters carry home. */
const LOGS_LOAD = 4;
/** The basket of fish a fishing hut's hand carries to the store, and the mutton a shepherd brings in. */
const FOOT_LOADS: Partial<Record<Resource, number>> = { fish: 5, mutton: 6 };

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
// After the peasants' cells, the carts': a handcart with its carter, then one heap per resource (drawn with
// the cart's transform, so it lands in the cart). The ground under the wheels sits at (CART_AX, CART_AY).
const CART_X0 = (HAMMER_CELL + 1) * CELL_W;
const CART_W = 18;
const CART_AX = 6;
const CART_AY = 11.5;
const cartCell = (index: number) => CART_X0 + index * CART_W;
const heapCell = (resource: Resource) => cartCell(1 + RESOURCES.indexOf(resource));

let spriteSheet: SkImage | null = null;
function getSpriteSheet() {
  if (spriteSheet) return spriteSheet;
  const surface = Skia.Surface.Make(cartCell(1 + RESOURCES.length) * SPRITE_RES, CELL_H * SPRITE_RES);
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
  // The handcart (as the depot's `CartArt`), and the heaps.
  const cartRect = (left: number, x: number, y: number, w: number, h: number, color: string) => {
    paint.setColor(Skia.Color(color));
    canvas.drawRect(Skia.XYWHRect((left + CART_AX + x) * SPRITE_RES, (CART_AY + y) * SPRITE_RES, w * SPRITE_RES, h * SPRITE_RES), paint);
  };
  const cart = cartCell(0);
  cartRect(cart, -5.5, -6.5, 11, 4, '#7a5232');
  cartRect(cart, -5.5, -6.5, 11, 1.2, '#a5774c');
  paint.setColor(Skia.Color('#3a2a1c'));
  for (const wheel of [-3, 3]) canvas.drawCircle((cart + CART_AX + wheel) * SPRITE_RES, (CART_AY - 2) * SPRITE_RES, 2 * SPRITE_RES, paint);
  cartRect(cart, 5.5, -5, 4, 1, '#6e4a2f');
  cartRect(cart, 9, -9, 2.2, 6, '#5d6e3a');
  cartRect(cart, 9.2, -11.2, 1.8, 2, '#e0b48a');
  for (const resource of RESOURCES) {
    const { color, light } = RESOURCE_INFO[resource];
    cartRect(heapCell(resource), -4.5, -9, 9, 3, color);
    cartRect(heapCell(resource), -3, -9.6, 5, 0.8, light);
  }
  surface.flush();
  spriteSheet = surface.makeImageSnapshot();
  return spriteSheet;
}

const WALK = 0;
const SWAY = 1;
const HAMMER = 2;
/**
 * One sprite: a walker or a handcart (or the load either carries, shown one way), a swaying idler, or a
 * hammering builder. A walker goes there and back along `route` (flat tile points), reaching each point
 * at the matching `times` second (quicker on roads). `sx`/`sw`: its cell in the sheet (scene units);
 * `ax`/`ay`: the point in the cell that stands on the ground; `bob`: how much it bounces as it goes.
 */
type Spec = {
  mode: number;
  sx: number;
  sw: number;
  ax: number;
  ay: number;
  bob: number;
  route: number[];
  times: number[];
  speed: number;
  phase: number;
  x: number;
  y: number;
  load: boolean;
  carryBack: boolean;
};
type Look = Pick<Spec, 'sx' | 'sw' | 'ax' | 'ay' | 'bob'>;
const person = (cell: number): Look => ({ sx: cell * CELL_W, sw: CELL_W, ax: FEET_X, ay: FEET_Y, bob: 1.2 });
const handcart = (sx: number): Look => ({ sx, sw: CART_W, ax: CART_AX, ay: CART_AY, bob: 0.35 });

const MAX_WALKERS = 24;
const MAX_CARTS = 14;
const STAFFED_SHOWN: BuildingId[] = ['docks', 'gate', 'foundry', 'research', 'armory', 'stables', 'balloonWorks', 'monastery', 'barracks', 'guardhouse', 'archery', 'chapel', 'sanctum', 'griffinEyrie', 'granary'];
/** What each farm sends to the store: orchards by cart (on the roads); fishing huts' hands carry baskets of
 * fish, and shepherds bring mutton in on foot from the pastures outside the walls (no roads out there). */
const FARMS_SHOWN: { id: BuildingId; food: Resource }[] = [
  ...ORCHARD_IDS.map((id) => ({ id, food: 'apples' as Resource })),
  ...PASTURE_IDS.map((id) => ({ id, food: 'mutton' as Resource })),
  ...FISHERY_IDS.map((id) => ({ id, food: 'fish' as Resource })),
];

function peasantSpecs(
  workforce: Workforce,
  construction: Construction[],
  clearOrders: ClearOrder[],
  buildings: Record<BuildingId, number>,
  placements: Placements,
  roads: Roads,
  clearedRocks: string[],
  felling: string,
  hauled: Resource[],
  full: Resource[],
): Spec[] {
  const specs: Spec[] = [];
  const still = (look: Look, x: number, y: number, mode: number, phase: number) =>
    specs.push({ mode, ...look, route: [], times: [], speed: 0, phase, x, y, load: false, carryBack: false });
  const goer = (walk: Walk, speed: number, phase: number, body: Look, load: Look, carryBack: boolean) => {
    const route = walk.points.flat();
    specs.push({ mode: WALK, ...body, route, times: walk.times, speed, phase, x: 0, y: 0, load: false, carryBack });
    specs.push({ mode: WALK, ...load, route, times: walk.times, speed, phase, x: 0, y: 0, load: true, carryBack });
  };
  // A peasant carrying a load (one way: there, or back with `carryBack`), or a handcart heaped with a resource
  // on the way there and coming back empty.
  const walker = (walk: Walk, speed: number, phase: number, cell: number, load: number, carryBack: boolean) => goer(walk, speed, phase, person(cell), person(LOAD_CELL + load), carryBack);
  const carter = (walk: Walk, speed: number, phase: number, resource: Resource) => goer(walk, speed, phase, handcart(cartCell(0)), handcart(heapCell(resource)), false);
  let carts = 0;
  const footprint = (id: BuildingId) => {
    const spot = spotOf(id, placements);
    return spot ? { ...spot, ...FOOTPRINTS[id] } : null;
  };
  const store = footprint('warehouse');
  let walkers = 0;
  if (store) {
    // Haulers between the mine and the warehouse; building hands fetching supplies from it. They
    // take the quickest way, over the roads.
    // A third of them (up to 3) push handcarts heaped with what the mine stockpile holds, along the roads;
    // the rest carry sacks, the quickest way.
    const haul = walkBetween(MINE_SPOT, store, placements, roads, clearedRocks);
    const haulByCart = cartWay(MINE_SPOT, store, placements, roads, clearedRocks);
    const haulers = haul ? Math.min(8, workforce.staff.warehouse) : 0;
    const pushing = Math.min(3, Math.ceil(haulers / 3));
    for (let i = 0; i < haulers && haul; i++) {
      if (i < pushing && haulByCart) carter(haulByCart, 0.9, (i + 0.5) / Math.max(1, pushing), hauled.length > 0 ? hauled[i % hauled.length] : 'coal');
      else walker(haul, 1.1, i / Math.max(1, haulers), i % TUNICS.length, i % LOADS.length, false);
    }
    walkers = haulers - pushing;
    carts = pushing;
    // Each woodcutter's hut carts its logs to the warehouse (while it has room for them).
    WOODCUTTER_IDS.forEach((id, index) => {
      const hut = footprint(id);
      if (!hut || buildings[id] <= 0 || workforce.staff[id] <= 0 || carts >= MAX_CARTS || full.includes('wood')) return;
      const walk = cartWay(hut, store, placements, roads, clearedRocks);
      if (!walk) return;
      carter(walk, 0.8, (index * 0.29) % 1, 'wood');
      carts += 1;
    });
    STAFFED_SHOWN.forEach((id, index) => {
      const plot = footprint(id);
      if (!plot || walkers >= MAX_WALKERS || workforce.staff[id] <= 0 || buildings[id] <= 0) return;
      const walk = walkBetween(plot, store, placements, roads, clearedRocks);
      if (!walk) return;
      walker(walk, 0.9, (index * 0.37) % 1, index % TUNICS.length, 3, true);
      walkers += 1;
    });
  }
  // The farms send their food to the store: the granary, or the warehouse until there is one (while it has
  // room for that food).
  const larder = foodStore(buildings, placements);
  FARMS_SHOWN.forEach(({ id, food }, index) => {
    const farm = footprint(id);
    if (!larder || !farm || buildings[id] <= 0 || workforce.staff[id] <= 0 || full.includes(food)) return;
    const onFoot = FOOT_LOADS[food];
    if (onFoot !== undefined ? walkers >= MAX_WALKERS : carts >= MAX_CARTS) return;
    const walk = onFoot !== undefined ? walkBetween(farm, larder, placements, roads, clearedRocks) : cartWay(farm, larder, placements, roads, clearedRocks);
    if (!walk) return;
    if (onFoot !== undefined) {
      walker(walk, 0.9, (index * 0.41) % 1, index % TUNICS.length, onFoot, false);
      walkers += 1;
    } else {
      carter(walk, 0.75, (index * 0.41) % 1, food);
      carts += 1;
    }
  });
  // Woodcutters out through the gate and down the road to the forest, on to the stand being felled, and
  // home with logs on their shoulders.
  const stand = felling ? parseSpot(felling) : null;
  WOODCUTTER_IDS.forEach((id, index) => {
    const hut = footprint(id);
    const road = hut && buildings[id] > 0 && stand ? walkBetween(hut, { ...FOREST_EXIT, w: 1, d: 1 }, placements, roads, clearedRocks) : null;
    const fell = road && stand ? walkOn(road, standWay(stand)) : null;
    const cutters = fell ? Math.min(2, workforce.staff[id], MAX_WALKERS - walkers) : 0;
    for (let i = 0; i < cutters && fell; i++) walker(fell, 0.8, (i + index * 0.3) / Math.max(1, cutters), (i + index + 2) % TUNICS.length, LOGS_LOAD, true);
    walkers += cutters;
  });
  for (const job of construction) {
    const plot = plotOf(job.building, placements);
    if (!plot) continue;
    for (let i = 0; i < Math.min(3, job.crew); i++) {
      const at = iso(plot.x + plot.w * (0.25 + i * 0.3), plot.y + plot.d + 0.3);
      still(person(2), at.x, at.y, HAMMER, i * 1.7);
      still(person(HAMMER_CELL), at.x, at.y, HAMMER, i * 1.7);
    }
  }
  // The clearing crew, breaking up the first rock of the current order.
  if (clearOrders.length > 0) {
    const [x, y] = clearOrders[0].tiles[0].split(',').map(Number);
    for (let i = 0; i < 2; i++) {
      const at = iso(x + 0.15 + i * 0.7, y + 1.05);
      still(person(1), at.x, at.y, HAMMER, i * 1.3);
      still(person(HAMMER_CELL), at.x, at.y, HAMMER, i * 1.3);
    }
  }
  const idle = Math.min(12, workforce.idle);
  for (let i = 0; i < idle; i++) {
    const a = (i / Math.max(1, idle)) * Math.PI * 2;
    const at = iso(CAMPFIRE.x + Math.cos(a) * 0.9, CAMPFIRE.y + Math.sin(a) * 0.9);
    still(person(i % TUNICS.length), at.x, at.y, SWAY, i);
  }
  return specs;
}

export function PeasantAtlas({ workforce, construction, clearOrders, clock, buildings, placements, roads, clearedRocks, felling, hauled, full }: {
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
  /** What the mine stockpile holds, for the mine's handcarts ("coal,iron"; empty if nothing). */
  hauled: string;
  /** Wood and foods whose store is full ("wood,fish"): their carts and carriers stay home. */
  full: string;
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
    WOODCUTTER_IDS.map((id) => (buildings[id] > 0 ? Math.min(2, workforce.staff[id]) : 0)),
    felling,
    FARMS_SHOWN.map(({ id }) => (workforce.staff[id] > 0 && buildings[id] > 0 ? 1 : 0)),
    buildings.granary > 0,
    hauled,
    full,
  ]);
  const specs = useMemo(
    () => {
      const list = (text: string) => (text ? (text.split(',') as Resource[]) : []);
      return peasantSpecs(workforce, construction, clearOrders, buildings, placements, roads, clearedRocks, felling, list(hauled), list(full));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shape],
  );
  const sprites = useMemo(() => specs.map((spec) => Skia.XYWHRect(spec.sx * SPRITE_RES, 0, spec.sw * SPRITE_RES, CELL_H * SPRITE_RES)), [specs]);
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
      y = oy + (tx + ty) * hh - Math.abs(Math.sin(t * 9 + spec.phase * 7)) * spec.bob;
      if (spec.load) shown = out !== spec.carryBack;
    } else if (spec.mode === SWAY) {
      x += Math.sin(t * 0.8 + spec.phase) * 0.6;
    } else {
      y -= Math.abs(Math.sin(t * 6 + spec.phase)) * 1.5;
    }
    if (shown) value.set(1 / SPRITE_RES, 0, x - spec.ax, y - spec.ay);
    else value.set(0, 0, -100, -100);
  });
  if (!sheet || specs.length === 0) return null;
  return <Atlas image={sheet} sprites={sprites} transforms={transforms} />;
}
