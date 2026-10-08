import { memo, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, MouseButton } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { BuildingId } from '../game/buildings';
import type { Placements } from '../game/cityMap';
import GameScene from './GameScene';
import type { Ghost } from './GameSceneCanvas';
import {
  MINE_PLOT,
  ORIGIN_X,
  ORIGIN_Y,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  SHAFT_RECT,
  TILE_HH,
  TILE_HW,
  groundAt,
  iso,
  plotOf,
  silhouette,
  tapTargets,
  type Plot,
} from './GameSceneLayout';

const MAX_ZOOM = 3;

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

// The map point under a scene point (`groundAt`, for worklets).
function toGround(sx: number, sy: number) {
  'worklet';
  const a = (sx - ORIGIN_X) / TILE_HW;
  const b = (sy - ORIGIN_Y) / TILE_HH;
  return [(a + b) / 2, (b - a) / 2];
}

// Is (x, y) inside the polygon? (Even-odd ray casting.)
function inside(points: { x: number; y: number }[], x: number, y: number) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** Empty plots are tapped on the ground; built ones anywhere on the building. */
const EMPTY_TALL = 8;

type Props = {
  buildings: Record<BuildingId, number>;
  placements: Placements;
  selected: BuildingId | null;
  /** A building or trap being placed: taps then place it instead of opening buildings. */
  ghost: Ghost | null;
  /** In placement mode, the map point (tile units) the player tapped. */
  onPlaceAt: (x: number, y: number) => void;
  /** In placement mode, a drag that started on the building moved its footprint here (top-left tile). */
  onDragGhost: (x: number, y: number) => void;
  /** Painting roads or traps: one finger paints tiles (two fingers or a right-drag move the map). */
  painting: boolean;
  /** The tile under the painting finger (called as it moves). */
  onPaint: (x: number, y: number) => void;
  /** The painting finger lifted (`commit`) or the stroke was cancelled. */
  onPaintEnd: (commit: boolean) => void;
  onSelect: (id: BuildingId) => void;
  /** A tap that hit no building: the map point (tile units) under it, e.g. a trap. */
  onTapGround: (x: number, y: number) => void;
  onMine: () => void;
  /** The screen is in view. */
  active: boolean;
  /** Space covered by the bars at the top and bottom, kept clear when the camera stops at the map's edge. */
  insetTop: number;
  insetBottom: number;
};

// The castle map, full screen: drag to pan, pinch / mouse wheel / the +/− buttons to zoom, tap a
// building to open it (or the headframe to go down the mine). While placing, the new building is
// dragged (or tapped) into place; while painting roads or traps, one finger paints. The camera is shared values, so moving
// it never re-renders React; level badges ride along in one transformed layer.
function CityView({
  buildings,
  placements,
  selected,
  ghost,
  onPlaceAt,
  onDragGhost,
  painting,
  onPaint,
  onPaintEnd,
  onSelect,
  onTapGround,
  onMine,
  active,
  insetTop,
  insetBottom,
}: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const camX = useSharedValue(0);
  const camY = useSharedValue(0);
  const zoom = useSharedValue(1);
  const viewW = useSharedValue(0);
  const viewH = useSharedValue(0);
  const minZoom = useSharedValue(0.3);
  const top = useSharedValue(insetTop);
  const bottom = useSharedValue(insetBottom);

  // Keep the map on screen: where it's smaller than the view, centre it in the space between the bars.
  const settle = (x: number, y: number, z: number) => {
    'worklet';
    const nextZoom = clamp(z, minZoom.get(), MAX_ZOOM);
    zoom.set(nextZoom);
    const w = viewW.get() / nextZoom;
    camX.set(w >= SCENE_WIDTH ? (SCENE_WIDTH - w) / 2 : clamp(x, 0, SCENE_WIDTH - w));
    const bandTop = top.get() / nextZoom;
    const bandBottom = (viewH.get() - bottom.get()) / nextZoom;
    camY.set(bandBottom - bandTop >= SCENE_HEIGHT ? SCENE_HEIGHT / 2 - (bandTop + bandBottom) / 2 : clamp(y, -bandTop, SCENE_HEIGHT - bandBottom));
  };
  const zoomAround = (fx: number, fy: number, factor: number) => {
    'worklet';
    const z = zoom.get();
    const nextZoom = clamp(z * factor, minZoom.get(), MAX_ZOOM);
    settle(camX.get() + fx / z - fx / nextZoom, camY.get() + fy / z - fy / nextZoom, nextZoom);
  };
  const panBy = (dx: number, dy: number) => {
    'worklet';
    const z = zoom.get();
    settle(camX.get() - dx / z, camY.get() - dy / z, z);
  };

  useEffect(() => {
    top.set(insetTop);
    bottom.set(insetBottom);
  }, [insetTop, insetBottom, top, bottom]);

  // First layout: zoom to fill the screen between the bars, with the castle in the middle.
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0 || (width === size.width && height === size.height)) return;
    const band = Math.max(1, height - insetTop - insetBottom);
    viewW.set(width);
    viewH.set(height);
    minZoom.set(Math.min(width / SCENE_WIDTH, band / SCENE_HEIGHT));
    if (size.width === 0) {
      const z = clamp(Math.max(width / SCENE_WIDTH, band / SCENE_HEIGHT), minZoom.get(), MAX_ZOOM);
      const keep = plotOf('keep', {}) as Plot;
      const castle = iso(keep.x + keep.w / 2, keep.y + keep.d / 2 + 3, 30);
      settle(castle.x - width / 2 / z, castle.y - (insetTop + band / 2) / z, z);
    } else {
      settle(camX.get(), camY.get(), zoom.get());
    }
    setSize({ width, height });
  };

  // A tap: while placing, where to put the building or trap; otherwise the front-most building whose
  // outline holds the point, the mine, or else the ground (traps lie flat on it).
  const tapAt = (x: number, y: number) => {
    const at = groundAt(x, y);
    if (ghost) return onPlaceAt(at.x, at.y);
    if (inside(silhouette(MINE_PLOT, MINE_PLOT.tall), x, y)) return onMine();
    const targets = tapTargets(placements);
    for (let index = targets.length - 1; index >= 0; index--) {
      const { id, plot } = targets[index];
      if (inside(silhouette(plot, buildings[id] > 0 ? plot.tall : EMPTY_TALL), x, y)) return onSelect(id);
    }
    onTapGround(at.x, at.y);
  };
  // The building being placed, for drags that start on it: [x, y, w, d, height in px], or [].
  const ghostBox = useSharedValue<number[]>([]);
  useEffect(() => {
    const plot = ghost?.plot;
    ghostBox.set(plot && !painting && plot.w > 1 ? [plot.x, plot.y, plot.w, plot.d, Math.min(30, plot.tall / 2) + 8] : []);
  }, [ghost, painting, ghostBox]);
  // While a drag moves the building: the finger's offset from its corner, and the spot it's at.
  const dragging = useSharedValue<number[]>([]);
  // Where the finger went down (scene units): a drag is judged by where it started.
  const pressedAt = useSharedValue<number[]>([0, 0]);

  // One finger (left mouse) drags the map, or the building being placed if the drag starts on it.
  // While painting, one finger paints and two fingers move the map.
  const pan = Gesture.Pan()
    .minDistance(6)
    .minPointers(painting ? 2 : 1)
    .mouseButton(MouseButton.LEFT)
    .onBegin((event) => {
      const z = zoom.get();
      pressedAt.set([camX.get() + event.x / z, camY.get() + event.y / z]);
    })
    .onStart(() => {
      dragging.set([]);
      const box = ghostBox.get();
      if (box.length === 0) return;
      const [sx, sy] = pressedAt.get();
      // On the footprint, or on the building standing on it.
      for (let lift = 0; lift <= box[4]; lift += 4) {
        const [gx, gy] = toGround(sx, sy + lift);
        if (gx >= box[0] - 0.2 && gx <= box[0] + box[2] + 0.2 && gy >= box[1] - 0.2 && gy <= box[1] + box[3] + 0.2) {
          dragging.set([box[0] - gx, box[1] - gy, box[0], box[1]]);
          return;
        }
      }
    })
    .onChange((event) => {
      const drag = dragging.get();
      if (drag.length === 0) {
        panBy(event.changeX, event.changeY);
        return;
      }
      const z = zoom.get();
      const [gx, gy] = toGround(camX.get() + event.x / z, camY.get() + event.y / z);
      const x = Math.round(gx + drag[0]);
      const y = Math.round(gy + drag[1]);
      if (x === drag[2] && y === drag[3]) return;
      dragging.set([drag[0], drag[1], x, y]);
      scheduleOnRN(onDragGhost, x, y);
    })
    .onFinalize(() => {
      dragging.set([]);
    });
  // Right or middle mouse drag always moves the map.
  const mousePan = Gesture.Pan()
    .mouseButton(MouseButton.RIGHT | MouseButton.MIDDLE)
    .onChange((event) => panBy(event.changeX, event.changeY));
  const pinch = Gesture.Pinch().onChange((event) => zoomAround(event.focalX, event.focalY, event.scaleChange));
  const paintAt = (x: number, y: number) => {
    const at = groundAt(x, y);
    onPaint(Math.floor(at.x), Math.floor(at.y));
  };
  const paint = Gesture.Pan()
    .enabled(painting)
    .mouseButton(MouseButton.LEFT)
    .maxPointers(1)
    .minDistance(0)
    .onBegin((event) => {
      const z = zoom.get();
      scheduleOnRN(paintAt, camX.get() + event.x / z, camY.get() + event.y / z);
    })
    .onChange((event) => {
      const z = zoom.get();
      scheduleOnRN(paintAt, camX.get() + event.x / z, camY.get() + event.y / z);
    })
    .onFinalize((_event, success) => {
      scheduleOnRN(onPaintEnd, success);
    });
  const tap = Gesture.Tap()
    .enabled(!painting)
    .maxDistance(10)
    .onEnd((event, success) => {
      if (!success) return;
      const z = zoom.get();
      scheduleOnRN(tapAt, camX.get() + event.x / z, camY.get() + event.y / z);
    });
  const gesture = Gesture.Simultaneous(pinch, pan, mousePan, paint, tap);

  // Web: if the browser ever drops the map's WebGL context (it keeps only so many per page), the canvas
  // would stay black; draw it afresh on a new one instead.
  const [canvasKey, setCanvasKey] = useState(0);
  // Web: the mouse wheel zooms around the pointer.
  const container = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node = container.current as unknown as HTMLElement | null;
    if (!node) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      zoomAround(event.clientX - rect.left, event.clientY - rect.top, Math.exp(-event.deltaY * 0.0015));
    };
    // Right-drag moves the map, so no browser menu.
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    const onContextLost = (event: Event) => {
      if (!(event.target instanceof HTMLCanvasElement)) return;
      setTimeout(() => setCanvasKey((key) => key + 1), 100);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('contextmenu', onContextMenu);
    // Context loss doesn't bubble, so listen in the capture phase.
    node.addEventListener('webglcontextlost', onContextLost, true);
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('contextmenu', onContextMenu);
      node.removeEventListener('webglcontextlost', onContextLost, true);
    };
    // zoomAround only touches shared values, which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The badge layer moves and scales with the map.
  const follow = useAnimatedStyle(() => ({
    transform: [{ translateX: -camX.get() * zoom.get() }, { translateY: -camY.get() * zoom.get() }, { scale: zoom.get() }],
  }));

  return (
    <View ref={container} style={styles.view} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <View style={styles.view}>
          {size.width > 0 && (
            <GameScene key={canvasKey} width={size.width} height={size.height} camX={camX} camY={camY} zoom={zoom} selected={selected} ghost={ghost} active={active} />
          )}
          <Animated.View pointerEvents="none" style={[styles.badges, follow]}>
            <Badges buildings={buildings} placements={placements} />
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={[styles.zoomButtons, { bottom: insetBottom + 12 }]}>
        <ZoomButton label="+" onPress={() => zoomAround(size.width / 2, size.height / 2, 1.3)} />
        <ZoomButton label="−" onPress={() => zoomAround(size.width / 2, size.height / 2, 1 / 1.3)} />
      </View>
    </View>
  );
}

export default memo(CityView);

// A level badge at the front corner of every building plot, and a sign at the mine.
const Badges = memo(function Badges({ buildings, placements }: { buildings: Record<BuildingId, number>; placements: Placements }) {
  return (
    <>
      {(Object.keys(buildings) as BuildingId[]).map((id) => {
        const plot = plotOf(id, placements);
        if (!plot) return null;
        const at = iso(plot.x + plot.w, plot.y + plot.d);
        const level = buildings[id];
        return (
          <Text key={id} style={[styles.badge, level === 0 && styles.badgeEmpty, { left: at.x - 8, top: at.y - 6 }]}>
            {level === 0 ? '+' : String(level)}
          </Text>
        );
      })}
      <Text style={[styles.mineSign, { left: SHAFT_RECT.x + SHAFT_RECT.width / 2 - 18, top: SHAFT_RECT.y + SHAFT_RECT.height - 10 }]}>↓ MINE</Text>
    </>
  );
});

function ZoomButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Zoom in' : 'Zoom out'}
      onPress={onPress}
      style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed]}
    >
      <Text style={styles.zoomText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  view: { flex: 1, overflow: 'hidden' },
  badges: { position: 'absolute', left: 0, top: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT, transformOrigin: 'left top' },
  badge: {
    position: 'absolute',
    minWidth: 16,
    paddingHorizontal: 2,
    textAlign: 'center',
    backgroundColor: 'rgba(23, 28, 22, 0.85)',
    color: '#edc779',
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
  },
  badgeEmpty: { color: '#c0cd83' },
  mineSign: {
    position: 'absolute',
    width: 36,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#edc779',
    backgroundColor: 'rgba(31, 38, 29, 0.85)',
    color: '#f1e7cf',
    fontFamily: 'monospace',
    fontSize: 6,
    fontWeight: '700',
  },
  zoomButtons: { position: 'absolute', right: 12, gap: 8 },
  zoomButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4a5240',
    backgroundColor: 'rgba(17, 20, 16, 0.85)',
  },
  zoomText: { color: '#e6dfcb', fontFamily: 'monospace', fontSize: 20, lineHeight: 22 },
  pressed: { opacity: 0.7 },
});
