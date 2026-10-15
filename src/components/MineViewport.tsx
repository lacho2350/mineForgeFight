import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, MouseButton, type PanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { CartLoad } from '../game/state';
import { FIXED_TICK_MS, useGameStore } from '../game/gameStore';
import type { LevelCarts } from '../game/haulage';
import { RESOURCES, type Resource, type Stock } from '../game/resources';
import { checkDigStep, depositRemaining, findDigParent, isDug, parseKey, tileKey, type MineLayout } from '../game/mineLayout';
import MinePickaxe from './MinePickaxe';
import MinePileTip from './MinePileTip';
import type { DigOverlayState, MineSceneCanvasProps } from './MineSceneCanvas';
import { EXIT_PILE_STEPS, MINER_PILE_STEPS, binAt } from './MineHaulerSteps';
import { MINE_COLUMNS, MINE_MAP_WIDTH, MINE_OVERSCAN, MINE_SURFACE_ROWS, MINE_TILE_SIZE, MINE_VIEW_STEP, mineStartCamX, mineViewAt, type MineView } from './MineMapLayout';

const T = MINE_TILE_SIZE;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;
// Map drawn beyond the screen edges so panning rarely reveals undrawn rock (MineMapLayout).
const OVERSCAN = MINE_OVERSCAN;
// The visible-area state only updates when the camera crosses this many map pixels (or zoom step).
const VIEW_STEP = MINE_VIEW_STEP;

export type MineSceneProps = {
  layout: MineLayout;
  viewportHeight: number;
  /** Each resource's stockpile beside the miners, and its capacity. */
  vein: Stock;
  veinCapacity: number;
  /** Each resource's stockpile at the mine exit, and its capacity. */
  mineExit: Stock;
  mineExitCapacity: number;
  /** Each resource in the mine stockpile (for the totals shown while the mouse rests on a pile). */
  mineStock: Stock;
  /** The simulation's haul time; carts are drawn where the shared schedule puts them. */
  haulTime: number;
  /** What each cart carries, keyed by cart. */
  cartLoads: Record<string, CartLoad>;
  /** Carts working each level. */
  carts: LevelCarts;
  digPlan: string[];
  digProgress: number;
  /** While on, one finger plans tunnels; two fingers still pan and zoom. */
  digMode: boolean;
  onPlanDig: (keys: string[]) => void;
  /** Live coal taken per deposit (the layout's copy only refreshes when the map redraws). */
  depositMined: Record<string, number>;
  /** The tile the player tapped, outlined on the map. */
  selectedKey: string | null;
  onSelectTile: (key: string) => void;
  /** Tap on a stockpile bin (at the mine exit, or beside a miner): show that resource's stock. */
  onSelectBin: (resource: Resource) => void;
  /** Double tap on a deposit: put an idle miner to work on it. */
  onAssignTile: (key: string) => void;
  /** The page's gesture-handler scroll view; gestures on the map take priority over it. */
  pageScrollRef?: Parameters<PanGesture['blocksExternalGesture']>[0];
  /** Screen pixels covered by bars floating over the top and bottom of the map: the map can scroll its
   * top edge down below the top bar and its bottom edge up above the bottom one; the zoom buttons sit
   * under the top bar and the dig messages above the bottom one. */
  insetTop?: number;
  insetBottom?: number;
  /** Survey mode: the patch a survey would map round the tile under the mouse (or the last one tapped)
   * is shaded green where the surveyors can set out from, red where they can't. */
  survey?: { radius: number; canSurveyFrom: (key: string) => boolean } | null;
};

type MineViewportProps = MineSceneProps & {
  renderCanvas: (props: MineSceneCanvasProps) => ReactNode;
};

/** A tunnel being drawn; `invalid` is the tile it stopped at, red, and `reason` why. */
type Drag = { tiles: string[]; invalid: string | null; reason: string | null };
const noDrag: Drag = { tiles: [], invalid: null, reason: null };

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

// A camera over a map far larger than the screen: one finger drags it, two fingers pinch to zoom
// (the mouse wheel and the +/− buttons zoom on web). The canvas stays screen-sized; React only
// hears about the camera when it moves far enough to change which chunks of rock are drawn.
export default function MineViewport({
  layout,
  viewportHeight,
  vein,
  veinCapacity,
  mineExit,
  mineExitCapacity,
  mineStock,
  haulTime,
  cartLoads,
  carts,
  digPlan,
  digProgress,
  digMode,
  onPlanDig,
  depositMined,
  selectedKey,
  onSelectTile,
  onSelectBin,
  onAssignTile,
  pageScrollRef,
  insetTop = 0,
  insetBottom = 0,
  survey = null,
  renderCanvas,
}: MineViewportProps) {
  const mapWidth = MINE_MAP_WIDTH;
  const mapHeight = layout.rows * T;
  const [width, setWidth] = useState(0);
  const viewWidth = useSharedValue(0);
  const viewHeight = useSharedValue(viewportHeight);
  const mapHeightValue = useSharedValue(mapHeight);
  const insets = useSharedValue({ top: insetTop, bottom: insetBottom });
  const camX = useSharedValue(0);
  const camY = useSharedValue(0);
  const zoom = useSharedValue(1);
  // The first view is the one the camera starts on (the window's width stands in until the frame is
  // measured), so the first frame draws the blocks round the lift — warmed before the screen opened
  // (`warmTerrainBlocks`) — instead of nothing.
  const [view, setView] = useState<MineView>(() => {
    const guess = Dimensions.get('window').width;
    return mineViewAt(mineStartCamX(guess), -insetTop, 1, guess, viewportHeight);
  });

  useEffect(() => {
    viewHeight.set(viewportHeight);
    mapHeightValue.set(mapHeight);
  }, [viewportHeight, mapHeight, viewHeight, mapHeightValue]);
  // While the camera is at the top, keep the surface just below the top bar as the bar's height settles.
  useEffect(() => {
    const atTop = camY.get() <= 0;
    insets.set({ top: insetTop, bottom: insetBottom });
    if (atTop) camY.set(-insetTop / zoom.get());
  }, [insetTop, insetBottom, insets, camY, zoom]);

  // Start centred on the lift at the surface.
  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next <= 0 || next === width) return;
    if (width === 0) camX.set(mineStartCamX(next));
    viewWidth.set(next);
    setWidth(next);
  };

  // Keep the camera inside the map at the current zoom.
  const settle = (x: number, y: number, z: number) => {
    'worklet';
    const nextZoom = clamp(z, MIN_ZOOM, MAX_ZOOM);
    zoom.set(nextZoom);
    camX.set(clamp(x, 0, Math.max(0, mapWidth - viewWidth.get() / nextZoom)));
    const { top, bottom } = insets.get();
    camY.set(clamp(y, -top / nextZoom, Math.max(-top / nextZoom, mapHeightValue.get() - (viewHeight.get() - bottom) / nextZoom)));
  };

  // Zoom keeping the map point under (fx, fy) — a screen position in the viewport — in place.
  const zoomAround = (fx: number, fy: number, factor: number) => {
    'worklet';
    const z = zoom.get();
    const nextZoom = clamp(z * factor, MIN_ZOOM, MAX_ZOOM);
    settle(camX.get() + fx / z - fx / nextZoom, camY.get() + fy / z - fy / nextZoom, nextZoom);
  };

  useAnimatedReaction(
    () => [
      Math.floor(camX.get() / VIEW_STEP),
      Math.floor(camY.get() / VIEW_STEP),
      Math.round(zoom.get() * 20),
      viewWidth.get(),
      viewHeight.get(),
    ],
    (step, previous) => {
      if (previous && step.every((value, index) => value === previous[index])) return;
      const z = zoom.get();
      const left = Math.floor(camX.get() / VIEW_STEP) * VIEW_STEP - OVERSCAN;
      const top = Math.floor(camY.get() / VIEW_STEP) * VIEW_STEP - OVERSCAN;
      scheduleOnRN(setView, {
        left,
        top,
        right: left + VIEW_STEP + viewWidth.get() / z + OVERSCAN * 2,
        bottom: top + VIEW_STEP + viewHeight.get() / z + OVERSCAN * 2,
      });
    },
  );

  const [drag, dragActions] = useDigDrag(layout, digPlan);
  const dig = useMemo<DigOverlayState>(
    () => ({ plan: digPlan, progress: digProgress, preview: drag.tiles, invalid: drag.invalid }),
    [digPlan, digProgress, drag],
  );
  const extendAt = (mapX: number, mapY: number) => dragActions.extend(tileKey(Math.floor(mapY / T), Math.floor(mapX / T)));
  // What happened to the last drag, shown over the map for a few seconds: why it stopped, or the order's
  // result (dug for so much, or why not — gold, wood).
  const [said, setSaid] = useState<{ text: string } | null>(null);
  const say = (text: string) => setSaid({ text });
  useEffect(() => {
    if (!said) return undefined;
    const timer = setTimeout(() => setSaid(null), 4500);
    return () => clearTimeout(timer);
  }, [said]);
  const message = said?.text ?? null;
  const finishDrag = (commit: boolean) => {
    const { tiles, reason } = dragActions.finish();
    if (commit && tiles.length > 0) {
      onPlanDig(tiles);
      say([useGameStore.getState().notice, reason].filter(Boolean).join(' · Stopped: '));
    } else if (reason) say(reason);
  };

  const panBy = (dx: number, dy: number) => {
    'worklet';
    const z = zoom.get();
    settle(camX.get() - dx / z, camY.get() - dy / z, z);
  };
  // One finger / left mouse drags the map (two fingers in Dig mode, where one finger digs).
  const pan = Gesture.Pan()
    .minPointers(digMode ? 2 : 1)
    .mouseButton(MouseButton.LEFT)
    .onChange((event) => panBy(event.changeX, event.changeY));
  // Right or middle mouse drag always pans, so the map can be moved while digging.
  const mousePan = Gesture.Pan()
    .mouseButton(MouseButton.RIGHT | MouseButton.MIDDLE)
    .onChange((event) => panBy(event.changeX, event.changeY));
  const pinch = Gesture.Pinch().onChange((event) => {
    zoomAround(event.focalX, event.focalY, event.scaleChange);
  });
  const digDrag = Gesture.Pan()
    .enabled(digMode)
    .mouseButton(MouseButton.LEFT)
    .maxPointers(1)
    .minDistance(0)
    .onBegin((event) => {
      const z = zoom.get();
      scheduleOnRN(extendAt, camX.get() + event.x / z, camY.get() + event.y / z);
    })
    .onChange((event) => {
      const z = zoom.get();
      scheduleOnRN(extendAt, camX.get() + event.x / z, camY.get() + event.y / z);
    })
    .onFinalize((_event, success) => {
      scheduleOnRN(finishDrag, success);
    });
  // Outside Dig mode, a tap on a bin shows its resource's stock, any other tap selects the tile under the
  // finger, and a double tap assigns an idle miner to the deposit there. The single tap waits for the
  // double tap to fail, so a double tap never also counts as a selection toggle.
  const tileAt = (mapX: number, mapY: number) => tileKey(Math.floor(mapY / T), Math.floor(mapX / T));
  const selectAt = (mapX: number, mapY: number) => {
    if (survey) {
      // A tap (the only pointer on a touch screen) shows its patch too: red stays up if it was refused.
      setSurveyTile(tileAt(mapX, mapY));
      onSelectTile(tileAt(mapX, mapY));
      return;
    }
    const bin = binAt(layout.sites, mapX, mapY);
    if (bin) onSelectBin(bin);
    else onSelectTile(tileAt(mapX, mapY));
  };
  const assignAt = (mapX: number, mapY: number) => onAssignTile(tileAt(mapX, mapY));
  const doubleTap = Gesture.Tap()
    .enabled(!digMode)
    .numberOfTaps(2)
    .onEnd((event) => {
      const z = zoom.get();
      scheduleOnRN(assignAt, camX.get() + event.x / z, camY.get() + event.y / z);
    });
  const singleTap = Gesture.Tap()
    .enabled(!digMode)
    .onEnd((event) => {
      const z = zoom.get();
      scheduleOnRN(selectAt, camX.get() + event.x / z, camY.get() + event.y / z);
    });
  const tap = Gesture.Exclusive(doubleTap, singleTap);
  if (pageScrollRef) {
    pan.blocksExternalGesture(pageScrollRef);
    mousePan.blocksExternalGesture(pageScrollRef);
    pinch.blocksExternalGesture(pageScrollRef);
    digDrag.blocksExternalGesture(pageScrollRef);
    doubleTap.blocksExternalGesture(pageScrollRef);
    singleTap.blocksExternalGesture(pageScrollRef);
  }
  const gesture = Gesture.Simultaneous(pinch, pan, mousePan, digDrag, tap);

  // Web: the mouse wheel zooms around the pointer instead of scrolling the page, and right-click
  // drags the map rather than opening the browser menu.
  const container = useRef<View>(null);
  // The tile under the mouse while surveying (only then: tracking it re-renders the viewport).
  const [surveyTile, setSurveyTile] = useState<string | null>(null);
  // Survey mode switched on or off: start with no patch until the mouse moves or a tile is tapped.
  const [surveyWasOn, setSurveyWasOn] = useState(false);
  if (!!survey !== surveyWasOn) {
    setSurveyWasOn(!!survey);
    setSurveyTile(null);
  }
  const surveying = useRef(false);
  // The pile (a miner's bin or an exit bin) under the mouse, and where the mouse is (for its tip).
  const [pile, setPile] = useState<Resource | null>(null);
  const tipX = useSharedValue(0);
  const tipY = useSharedValue(0);
  const sites = useRef(layout.sites);
  useEffect(() => {
    surveying.current = !!survey;
    sites.current = layout.sites;
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node = container.current as unknown as HTMLElement | null;
    if (!node) return undefined;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const rect = node.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const z = zoom.get();
      const mapX = camX.get() + screenX / z;
      const mapY = camY.get() + screenY / z;
      if (surveying.current) {
        const key = tileKey(Math.floor(mapY / T), Math.floor(mapX / T));
        setSurveyTile((current) => (current === key ? current : key));
        setPile(null);
        return;
      }
      // Not while a button is held (dragging the map or digging).
      const resource = event.buttons === 0 ? binAt(sites.current, mapX, mapY) : null;
      tipX.set(screenX);
      tipY.set(screenY);
      setPile((current) => (current === resource ? current : resource));
    };
    // Off the map (onto the toolbar, say): no patch, no tip.
    const onLeave = () => {
      setSurveyTile(null);
      setPile(null);
    };
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerleave', onLeave);
    return () => {
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerleave', onLeave);
    };
    // The camera is shared values, which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node = container.current as unknown as HTMLElement | null;
    if (!node) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      zoomAround(event.clientX - rect.left, event.clientY - rect.top, Math.exp(-event.deltaY * 0.0015));
    };
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('contextmenu', onContextMenu);
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('contextmenu', onContextMenu);
    };
    // zoomAround only touches shared values, which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard (web and hardware keyboards): arrow keys / WASD pan while held, Shift pans faster,
  // and + / − zoom. Movement is applied every frame so it stays smooth.
  const keyX = useSharedValue(0);
  const keyY = useSharedValue(0);
  const keyFast = useSharedValue(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const held = new Set<string>();
    const directions: Record<string, [number, number]> = {
      arrowleft: [-1, 0], a: [-1, 0],
      arrowright: [1, 0], d: [1, 0],
      arrowup: [0, -1], w: [0, -1],
      arrowdown: [0, 1], s: [0, 1],
    };
    const sync = () => {
      let x = 0;
      let y = 0;
      for (const key of held) {
        x += directions[key][0];
        y += directions[key][1];
      }
      keyX.set(Math.sign(x));
      keyY.set(Math.sign(y));
    };
    const typing = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      return !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (typing(event) || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      keyFast.set(event.shiftKey);
      if (key in directions) {
        event.preventDefault();
        held.add(key);
        sync();
      } else if (key === '+' || key === '=') {
        zoomAround(viewWidth.get() / 2, viewHeight.get() / 2, 1.25);
      } else if (key === '-' || key === '_') {
        zoomAround(viewWidth.get() / 2, viewHeight.get() / 2, 1 / 1.25);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keyFast.set(event.shiftKey);
      held.delete(event.key.toLowerCase());
      sync();
    };
    // Letting go of everything if the window loses focus, so the map doesn't keep drifting.
    const onBlur = () => {
      held.clear();
      sync();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
    // Only shared values are touched, which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useFrameCallback((frame) => {
    const x = keyX.get();
    const y = keyY.get();
    if (x === 0 && y === 0) return;
    // Screen pixels per second, so panning feels the same at every zoom.
    const speed = keyFast.get() ? 1400 : 600;
    const step = (speed * (frame.timeSincePreviousFrame ?? 16)) / 1000;
    panBy(-x * step, -y * step);
  });

  const zoomButton = (factor: number) => zoomAround(width / 2, viewportHeight / 2, factor);

  const time = useHaulClock(haulTime);
  // Heap sizes in steps, so the canvas only re-renders when a heap visibly changes.
  const minerPileSteps = usePileSteps(vein, veinCapacity, MINER_PILE_STEPS);
  const exitPileSteps = usePileSteps(mineExit, mineExitCapacity, EXIT_PILE_STEPS);

  return (
    <View style={[styles.frame, { height: viewportHeight }]}>
    <GestureDetector gesture={gesture}>
      <View ref={container} onLayout={onLayout} style={StyleSheet.absoluteFill}>
        {width > 0 &&
          renderCanvas({
            layout,
            width,
            height: viewportHeight,
            camX,
            camY,
            zoom,
            view,
            minerPileSteps,
            exitPileSteps,
            time,
            cartLoads,
            carts,
            dig,
            selectedKey,
          })}
        <CameraLayer camX={camX} camY={camY} zoom={zoom} mapHeight={mapHeight}>
          {survey && surveyTile && <SurveyPatch tile={surveyTile} radius={survey.radius} ok={survey.canSurveyFrom(surveyTile)} />}
          <Pickaxes layout={layout} view={view} />
          <DepositLabels layout={layout} view={view} depositMined={depositMined} />
        </CameraLayer>
        {pile && !survey && <MinePileTip resource={pile} vein={vein} mineExit={mineExit} mineStock={mineStock} x={tipX} y={tipY} width={width} height={viewportHeight} />}
        {(drag.reason ?? message) && (
          <View style={[styles.digMessage, { bottom: insetBottom + 12 }, drag.reason ? styles.digMessageStop : null]}>
            <Text style={styles.digMessageText}>{drag.reason ?? message}</Text>
          </View>
        )}
      </View>
    </GestureDetector>
    <View style={[styles.zoomControls, { top: insetTop + 8 }]}>
      <ZoomButton label="+" onPress={() => zoomButton(1.4)} />
      <ZoomButton label="−" onPress={() => zoomButton(1 / 1.4)} />
    </View>
    </View>
  );
}

function ZoomButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Zoom in' : 'Zoom out'}
      onPress={onPress}
      style={({ pressed }) => [styles.zoomButton, pressed && styles.zoomButtonPressed]}
    >
      <Text style={styles.zoomButtonText}>{label}</Text>
    </Pressable>
  );
}

// The patch a survey from `tile` would map (inside the mine), with the tile itself picked out: green where
// the surveyors can set out from, red where they can't.
function SurveyPatch({ tile, radius, ok }: { tile: string; radius: number; ok: boolean }) {
  const { row, column } = parseKey(tile);
  const top = Math.max(MINE_SURFACE_ROWS, row - radius);
  const left = Math.max(0, column - radius);
  const bottom = row + radius + 1;
  const right = Math.min(MINE_COLUMNS, column + radius + 1);
  if (bottom <= top || right <= left) return null;
  return (
    <>
      <View style={[styles.surveyPatch, ok ? styles.surveyOk : styles.surveyBad, { left: left * T, top: top * T, width: (right - left) * T, height: (bottom - top) * T }]} />
      <View style={[styles.surveyCentre, ok ? styles.surveyCentreOk : styles.surveyCentreBad, { left: column * T, top: row * T, width: T, height: T }]} />
    </>
  );
}

// Native views (pickaxes, labels) placed in map coordinates and moved with the camera.
function CameraLayer({
  camX,
  camY,
  zoom,
  mapHeight,
  children,
}: {
  camX: SharedValue<number>;
  camY: SharedValue<number>;
  zoom: SharedValue<number>;
  mapHeight: number;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -camX.get() * zoom.get() }, { translateY: -camY.get() * zoom.get() }, { scale: zoom.get() }],
  }));
  return <Animated.View style={[styles.cameraLayer, { height: mapHeight }, style]}>{children}</Animated.View>;
}

// Builds a tunnel path as the finger moves: one tile at a time from the end of an existing tunnel,
// backing up when the finger returns over the path, and stopping at the first tile that breaks
// a digging rule (shown red) or where it runs into a tunnel and joins it.
function useDigDrag(layout: MineLayout, digPlan: string[]) {
  const [drag, setDragState] = useState<Drag>(noDrag);
  const current = useRef<Drag>(noDrag);

  const update = (next: Drag) => {
    current.current = next;
    setDragState(next);
  };

  const extend = (key: string) => {
    const { tiles } = current.current;
    const planned = new Set([...digPlan, ...tiles]);

    if (tiles.length === 0) {
      const { row, column } = parseKey(key);
      // A drag starts on a tunnel; the first tile of rock after it is where the new tunnel begins.
      if (isDug(layout, row, column) || digPlan.includes(key)) return;
      const parent = findDigParent(layout, new Set(digPlan), key);
      update(parent ? { tiles: [key], invalid: null, reason: null } : { tiles: [], invalid: key, reason: startProblem(layout, digPlan, key) });
      return;
    }
    const last = tiles[tiles.length - 1];
    if (key === last) return;
    const back = tiles.indexOf(key);
    if (back >= 0) {
      update({ tiles: tiles.slice(0, back + 1), invalid: null, reason: null });
      return;
    }

    // Walk from the end of the path toward the finger: across first, then up or down.
    const target = parseKey(key);
    const path = [...tiles];
    let invalid: string | null = null;
    let reason: string | null = null;
    let at = parseKey(last);
    while (at.row !== target.row || at.column !== target.column) {
      const next = at.column !== target.column
        ? { row: at.row, column: at.column + Math.sign(target.column - at.column) }
        : { row: at.row + Math.sign(target.row - at.row), column: at.column };
      const nextKey = tileKey(next.row, next.column);
      // The run has reached a tunnel it joins: it ends there (that's not a mistake).
      if (planned.has(nextKey) || isDug(layout, next.row, next.column)) break;
      const check = checkDigStep(layout, planned, nextKey, tileKey(at.row, at.column));
      if (!check.ok) {
        invalid = nextKey;
        reason = check.reason;
        break;
      }
      planned.add(nextKey);
      path.push(nextKey);
      at = next;
    }
    update({ tiles: path, invalid, reason });
  };

  const finish = () => {
    const { tiles, reason } = current.current;
    update(noDrag);
    return { tiles, reason };
  };

  return [drag, { extend, finish }] as const;
}

// Why a dig can't start on `key`: the rule its nearest tunnel breaks, or that there's no tunnel beside it.
function startProblem(layout: MineLayout, digPlan: string[], key: string) {
  const { row, column } = parseKey(key);
  const planned = new Set(digPlan);
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const parent = tileKey(row + dr, column + dc);
    if (!isDug(layout, row + dr, column + dc) && !planned.has(parent)) continue;
    const check = checkDigStep(layout, planned, key, parent);
    if (!check.ok) return check.reason;
  }
  return 'Start a tunnel from the end of one already dug: drag from it out across rock.';
}

function pileStep(fill: number, steps: number) {
  return Math.min(steps, Math.ceil(Math.max(0, fill) * steps));
}

// Per-resource heap steps, kept as the same object until a step actually changes.
function usePileSteps(stock: Stock, capacity: number, steps: number) {
  const key = RESOURCES.map((resource) => pileStep(capacity > 0 ? stock[resource] / capacity : 0, steps)).join(',');
  return useMemo(() => {
    const values = key.split(',').map(Number);
    return Object.fromEntries(RESOURCES.map((resource, index) => [resource, values[index]])) as Record<Resource, number>;
  }, [key]);
}

// Smooth haul time for the renderer. The simulation applies loads and tips for the second that
// ends at `haulTime`, so the renderer plays that same second (haulTime - 1 → haulTime) and then
// holds there until the next tick; when carts are blocked, haulTime stops and so do they.
function useHaulClock(haulTime: number) {
  const anchor = useSharedValue(haulTime);
  const elapsed = useSharedValue(1);
  const time = useSharedValue(haulTime);

  useEffect(() => {
    anchor.set(haulTime);
    elapsed.set(0);
  }, [haulTime, anchor, elapsed]);

  useFrameCallback((frame) => {
    // Only write while the clock is moving: an unchanged value would still make the canvas redraw.
    const before = elapsed.get();
    if (before >= 1 && time.get() === anchor.get()) return;
    elapsed.set(Math.min(1, before + (frame.timeSincePreviousFrame ?? 16) / FIXED_TICK_MS));
    time.set(anchor.get() - 1 + elapsed.get());
  });

  return time;
}

function Pickaxes({ layout, view }: { layout: MineLayout; view: MineView }) {
  return layout.sites.map((site, index) => {
    const x = site.column * T;
    const y = site.row * T;
    if (x + T < view.left || x > view.right || y + T < view.top || y > view.bottom) return null;
    return <MinePickaxe key={`pickaxe-${String(site.row)}-${String(site.column)}-${String(site.faceRow)}-${String(site.faceColumn)}`} x={x} y={y} index={index} scale={1} offsetX={0} />;
  });
}

// How much coal is left in each deposit being worked, shown just above the seam.
function DepositLabels({ layout, view, depositMined }: { layout: MineLayout; view: MineView; depositMined: Record<string, number> }) {
  return layout.sites.map((site) => {
    const x = site.faceColumn * T;
    const y = site.faceRow * T;
    if (x + T < view.left || x > view.right || y + T < view.top || y > view.bottom) return null;
    const left = depositRemaining({ depositMined }, site.faceRow, site.faceColumn);
    return (
      <View key={`label-${String(site.faceRow)}-${String(site.faceColumn)}`} style={[styles.depositLabel, { left: x + 2, top: y + 2 }]}>
        <Text style={styles.depositLabelText}>{Math.floor(left).toLocaleString()}</Text>
      </View>
    );
  });
}

const styles = StyleSheet.create({
  digMessage: { pointerEvents: 'none', position: 'absolute', left: 12, right: 12, padding: 10, backgroundColor: 'rgba(25, 31, 27, 0.92)', borderLeftWidth: 3, borderLeftColor: '#c3ce87' },
  digMessageStop: { borderLeftColor: '#e5484d' },
  digMessageText: { color: '#f0ead8', fontFamily: 'monospace', fontSize: 13 },
  depositLabel: { position: 'absolute', minWidth: T - 4, paddingHorizontal: 2, backgroundColor: 'rgba(13, 10, 8, 0.75)' },
  depositLabelText: { color: '#ffd166', fontFamily: 'monospace', fontSize: 8, textAlign: 'center' },
  frame: { width: '100%', overflow: 'hidden', backgroundColor: '#0d0a08' },
  cameraLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: MINE_MAP_WIDTH,
    transformOrigin: 'left top',
    pointerEvents: 'none',
  },
  zoomControls: { position: 'absolute', right: 8, gap: 6 },
  surveyPatch: { position: 'absolute', borderWidth: 2 },
  surveyOk: { borderColor: 'rgba(132, 226, 120, 0.9)', backgroundColor: 'rgba(96, 200, 90, 0.24)' },
  surveyBad: { borderColor: 'rgba(240, 104, 88, 0.9)', backgroundColor: 'rgba(214, 70, 56, 0.24)' },
  surveyCentre: { position: 'absolute', borderWidth: 2 },
  surveyCentreOk: { borderColor: '#b6f0a4', backgroundColor: 'rgba(96, 200, 90, 0.4)' },
  surveyCentreBad: { borderColor: '#ffb0a4', backgroundColor: 'rgba(214, 70, 56, 0.4)' },
  zoomButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d2a45f',
    backgroundColor: 'rgba(25, 31, 27, 0.9)',
  },
  zoomButtonPressed: { opacity: 0.7 },
  zoomButtonText: { color: '#e9c475', fontFamily: 'monospace', fontSize: 18, lineHeight: 20 },
});
