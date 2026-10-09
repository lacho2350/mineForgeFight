import { Group, Picture, Skia, createPicture, type SkCanvas, type SkPicture } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { CART_HEIGHT, CART_WIDTH, cartPose, type CartRoute } from '../game/haulage';
import type { CartLoad } from '../game/state';
import { depositAt, type Site } from '../game/mineLayout';
import { MINE_RESOURCES, RESOURCES, RESOURCE_INFO, type Resource } from '../game/resources';
import { MINE_EXIT_BIN_WIDTH, MINE_GROUND_Y, MINE_TILE_SIZE, getExitBinX } from './MineMapLayout';
import { EXIT_BIN_HEIGHT, EXIT_PILE_STEPS, HEAP_RISE, MINER_BIN_HEIGHT, MINER_BIN_WIDTH, MINER_PILE_STEPS, minerBinX } from './MineHaulerSteps';

const T = MINE_TILE_SIZE;
// Hauler sprite: 8×10 pixels at 4px, feet at y = WORKER_HEIGHT.
const WORKER_PIXEL = 4;
const WORKER_WIDTH = 8 * WORKER_PIXEL;
const WORKER_HEIGHT = 10 * WORKER_PIXEL;

const colors = {
  wood: '#7c4d2a',
  woodDark: '#5a361d',
  iron: '#8d939b',
  ironDark: '#5d636b',
  wheel: '#141416',
};

// Facing right, arms reaching forward to push.
const workerPixels = [
  '..HHH...',
  '.HHHHH..',
  '..SSS...',
  '..SWS...',
  '.PPPPAA.',
  '.PPPP...',
  '.PPPP...',
  '..BBB...',
  '..B.B...',
  '.DD.DD..',
];
const workerPalette: Record<string, string> = {
  H: '#5a3a1e',
  S: '#d9a06e',
  W: '#2a1d14',
  P: '#a5462f',
  A: '#d9a06e',
  B: '#3d3128',
  D: '#241a14',
};

function rect(canvas: SkCanvas, x: number, y: number, w: number, h: number, color: string) {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(color));
  canvas.drawRect(Skia.XYWHRect(x, y, w, h), paint);
}

// One lump of a resource, in that resource's colours (see RESOURCE_INFO).
function lump(canvas: SkCanvas, resource: Resource, x: number, y: number, size: number) {
  const { color, light, dark } = RESOURCE_INFO[resource];
  rect(canvas, x, y, size, size - 1, color);
  rect(canvas, x, y + size - 3, size, 2, dark);
  rect(canvas, x + 1, y + 1, Math.max(2, size / 3), 2, light);
}

type HaulerPictures = {
  cart: SkPicture;
  /** Load heaped on the cart, per resource. */
  cartLoads: Record<Resource, SkPicture>;
  worker: SkPicture;
  /** Miner bins and mine exit bins, per resource: the bin behind the heap, a full heap, and the front plank. */
  minerBins: Record<Resource, BinPictures>;
  exitBins: Record<Resource, BinPictures>;
};
type BinPictures = { back: SkPicture; heap: SkPicture; front: SkPicture };

const byResource = <T,>(make: (resource: Resource) => T) =>
  Object.fromEntries(RESOURCES.map((resource) => [resource, make(resource)])) as Record<Resource, T>;

// A wooden stockpile bin, origin at its bottom-left on the floor, in three layers: the bin behind, a full
// heap (rows of lumps narrowing toward the top, rising above the rim), and the front plank over the heap's
// base, with a stripe in the resource's colour so the bin reads even when empty. A part-full heap is the
// full one cut off at its height (`Bin`), so it rises and sinks smoothly with the stock.
function drawBinBack(canvas: SkCanvas, width: number, height: number) {
  rect(canvas, 0, -height, 3, height, colors.woodDark);
  rect(canvas, width - 3, -height, 3, height, colors.woodDark);
  rect(canvas, 0, -3, width, 3, colors.woodDark);
}

function drawHeap(canvas: SkCanvas, resource: Resource, width: number, height: number, seed: number) {
  for (let y = 0; y < height + HEAP_RISE; y += 5) {
    const inset = Math.round((y / (height + HEAP_RISE)) * width * 0.35);
    for (let x = 3 + inset; x < width - 3 - inset; x += 6) {
      const jitter = ((x * 7 + y * 13 + seed) % 3) - 1;
      lump(canvas, resource, x, -3 - y - 6 + jitter, 6 + ((x + y + seed) % 2));
    }
  }
}

function drawBinFront(canvas: SkCanvas, resource: Resource, width: number, height: number) {
  rect(canvas, 0, -Math.min(8, height), width, 4, colors.wood);
  rect(canvas, 0, -Math.min(8, height) + 4, width, 1, colors.woodDark);
  rect(canvas, 3, -Math.min(8, height) + 1, width - 6, 2, RESOURCE_INFO[resource].tint);
}

function binPictures(resource: Resource, width: number, height: number, seed: number, sign: boolean): BinPictures {
  return {
    back: createPicture((canvas) => {
      drawBinBack(canvas, width, height);
      if (!sign) return;
      // A small sign showing which resource the bin holds.
      rect(canvas, width / 2 - 1, -40, 3, 18, colors.woodDark);
      rect(canvas, width / 2 - 9, -46, 19, 10, '#e3c38a');
      lump(canvas, resource, width / 2 - 4, -45, 8);
    }),
    heap: createPicture((canvas) => drawHeap(canvas, resource, width, height, seed)),
    front: createPicture((canvas) => drawBinFront(canvas, resource, width, height)),
  };
}

// A bin with its heap shown up to `fill` (0–1) of a full one.
function Bin({ pictures, width, height, fill }: { pictures: BinPictures; width: number; height: number; fill: number }) {
  const heapHeight = (height + HEAP_RISE) * Math.max(0, Math.min(1, fill));
  return (
    <Group>
      <Picture picture={pictures.back} />
      {heapHeight > 0 && (
        <Group clip={Skia.XYWHRect(0, -3 - heapHeight - 4, width, heapHeight + 8)}>
          <Picture picture={pictures.heap} />
        </Group>
      )}
      <Picture picture={pictures.front} />
    </Group>
  );
}

let pictures: HaulerPictures | null = null;

// Recorded lazily: on web, Skia only exists once CanvasKit has loaded, which is before this renders.
function getPictures(): HaulerPictures {
  if (pictures) return pictures;
  pictures = {
    cart: createPicture((canvas) => {
      rect(canvas, 2, 2, 36, 13, colors.woodDark);
      rect(canvas, 2, 6, 36, 2, colors.wood);
      rect(canvas, 0, 0, CART_WIDTH, 4, colors.iron);
      rect(canvas, 0, 14, CART_WIDTH, 2, colors.ironDark);
      const wheel = Skia.Paint();
      wheel.setColor(Skia.Color(colors.wheel));
      canvas.drawCircle(9, 18, 4, wheel);
      canvas.drawCircle(31, 18, 4, wheel);
    }),
    cartLoads: byResource((resource) =>
      createPicture((canvas) => {
        lump(canvas, resource, 4, -6, 9);
        lump(canvas, resource, 13, -9, 11);
        lump(canvas, resource, 25, -5, 9);
      }),
    ),
    worker: createPicture((canvas) => {
      workerPixels.forEach((row, rowIndex) => {
        Array.from(row).forEach((pixel, columnIndex) => {
          if (pixel === '.') return;
          rect(canvas, columnIndex * WORKER_PIXEL, rowIndex * WORKER_PIXEL, WORKER_PIXEL, WORKER_PIXEL, workerPalette[pixel]);
        });
      });
    }),
    minerBins: byResource((resource) => binPictures(resource, MINER_BIN_WIDTH, MINER_BIN_HEIGHT, 1, false)),
    exitBins: byResource((resource) => binPictures(resource, MINE_EXIT_BIN_WIDTH, EXIT_BIN_HEIGHT, 2, true)),
  };
  return pictures;
}

// One cart and its hauler per gallery level, following the shared haulage schedule (the same
// one the simulation uses to move coal), so it loads and tips exactly when the numbers change.
export function LevelCart({ route, time, load }: { route: CartRoute; time: SharedValue<number>; load: CartLoad | undefined }) {
  const { cart, cartLoads, worker } = getPictures();
  const { trips, cycle, offset, liftX } = route;

  const pose = useDerivedValue(() => cartPose(time.get(), trips, cycle, offset, liftX));
  const cartTransform = useDerivedValue(() => [{ translateX: pose.get().x }, { translateY: pose.get().y }]);
  const workerTransform = useDerivedValue(() => {
    const { x, y, pushing, facing } = pose.get();
    // Pushing: walk behind the cart with a little step bob. Hoisting: ride on top of it.
    const bob = pushing && Math.sin(time.get() * 14) > 0 ? -1 : 0;
    const left = pushing ? (facing > 0 ? x - WORKER_WIDTH + 6 : x + CART_WIDTH - 6) : x + (CART_WIDTH - WORKER_WIDTH) / 2;
    const top = pushing ? y + CART_HEIGHT - WORKER_HEIGHT + bob : y - WORKER_HEIGHT + 12;
    return facing > 0
      ? [{ translateX: left }, { translateY: top }]
      : [{ translateX: left + WORKER_WIDTH }, { translateY: top }, { scaleX: -1 }];
  });

  return (
    <Group>
      <Group transform={cartTransform}>
        <Picture picture={cart} />
        {load && load.amount > 0 && <Picture picture={cartLoads[load.resource]} />}
      </Group>
      <Group transform={workerTransform}>
        <Picture picture={worker} />
      </Group>
    </Group>
  );
}

// Each miner's stockpile bin on the floor beside them, holding their deposit's resource: filled
// from that resource's stockpile and emptied by the cart.
export function MinerStockpiles({ sites, steps }: { sites: Site[]; steps: Record<Resource, number> }) {
  const { minerBins } = getPictures();

  return sites.map((site) => {
    const resource = depositAt(site.faceRow, site.faceColumn) ?? 'coal';
    return (
      <Group key={`stockpile-${String(site.row)}-${String(site.column)}`} transform={[{ translateX: minerBinX(site) }, { translateY: site.row * T + T }]}>
        <Bin pictures={minerBins[resource]} width={MINER_BIN_WIDTH} height={MINER_BIN_HEIGHT} fill={steps[resource] / MINER_PILE_STEPS} />
      </Group>
    );
  });
}

// The mine exit stockpiles on the surface: one bin per mined resource, where carts tip their loads.
export function ExitStockpiles({ steps }: { steps: Record<Resource, number> }) {
  const { exitBins } = getPictures();
  return MINE_RESOURCES.map((resource, index) => (
    <Group key={`exit-${resource}`} transform={[{ translateX: getExitBinX(index) }, { translateY: MINE_GROUND_Y }]}>
      <Bin pictures={exitBins[resource]} width={MINE_EXIT_BIN_WIDTH} height={EXIT_BIN_HEIGHT} fill={steps[resource] / EXIT_PILE_STEPS} />
    </Group>
  ));
}
