import type { BuildingId } from '../game/buildings';

export const SCENE_WIDTH = 600;
export const SCENE_HEIGHT = 300;

/** Ground lines in scene coordinates: the wall, then three rows of buildings (the front one by the road). */
export const WALL_BASE = 128;
export const BACK_BASE = 160;
export const MIDDLE_BASE = 214;
export const FRONT_BASE = 268;
export const WALL_LEFT = 44;
export const WALL_RIGHT = 556;

export type SceneRect = { x: number; y: number; width: number; height: number };

const plot = (x: number, top: number, width: number, base: number): SceneRect => ({ x, y: top, width, height: base - top });

/** Where each building stands (its tap area, in scene coordinates). The base is `y + height`. */
export const BUILDING_PLOTS: Record<BuildingId, SceneRect> = {
  // Back row, in front of the wall
  research: plot(56, 100, 52, BACK_BASE),
  monastery: plot(112, 92, 54, BACK_BASE),
  griffinEyrie: plot(170, 66, 52, BACK_BASE),
  keep: plot(236, 34, 128, BACK_BASE),
  sanctum: plot(376, 80, 56, BACK_BASE),
  foundry: plot(436, 84, 54, BACK_BASE),
  armory: plot(494, 104, 52, BACK_BASE),
  // Middle row: the dwellings
  guardhouse: plot(50, 168, 62, MIDDLE_BASE),
  archery: plot(120, 168, 66, MIDDLE_BASE),
  barracks: plot(194, 164, 72, MIDDLE_BASE),
  chapel: plot(274, 150, 62, MIDDLE_BASE),
  balloonWorks: plot(344, 140, 72, MIDDLE_BASE),
  stables: plot(426, 170, 82, MIDDLE_BASE),
  // Front row, by the road
  gate: plot(44, 196, 58, FRONT_BASE),
  houses: plot(112, 212, 92, FRONT_BASE),
  warehouse: plot(214, 212, 80, FRONT_BASE),
  // The wall runs along the back; the two big towers stand at either end of the hold.
  wall: plot(WALL_LEFT, 92, WALL_RIGHT - WALL_LEFT, WALL_BASE),
  towers: plot(4, 92, 38, FRONT_BASE),
};

/** Extra tap areas (drawn under the buildings): the right-hand tower. */
export const EXTRA_HOTSPOTS: { id: BuildingId; rect: SceneRect }[] = [{ id: 'towers', rect: plot(WALL_RIGHT + 2, 92, 38, FRONT_BASE) }];

// The mine headframe (see GameSceneCanvas) and its tap area.
export const HEADFRAME_X = 480;
export const SHAFT_RECT: SceneRect = { x: HEADFRAME_X + 12, y: FRONT_BASE - 34, width: 36, height: 34 };

/** The yard between the warehouse and the mine, where the army drills. */
export const YARD: SceneRect = plot(304, 226, 160, FRONT_BASE);

export type SceneLayout = {
  /** Width of the drawing (wider than the frame on narrow phones, which then scroll sideways). */
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  frameWidth: number;
};

// Fit the scene to the frame: grow a little on wide screens, but never shrink below a size where
// buildings are still easy to tap (narrow phones scroll the scene sideways instead).
export function getSceneLayout(frameWidth: number): SceneLayout {
  const frame = Math.max(1, frameWidth);
  const scale = Math.max(0.8, Math.min(frame / SCENE_WIDTH, 1.5));
  const width = Math.max(frame, SCENE_WIDTH * scale);
  return {
    width,
    height: Math.round(SCENE_HEIGHT * scale),
    scale,
    offsetX: (width - SCENE_WIDTH * scale) / 2,
    frameWidth: frame,
  };
}

/** A scene rectangle in drawing pixels, for absolutely positioned overlays. */
export function toFrameRect({ scale, offsetX }: SceneLayout, rect: SceneRect) {
  return {
    left: offsetX + rect.x * scale,
    top: rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}
