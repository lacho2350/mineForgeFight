export const SCENE_WIDTH = 360;
export const SCENE_HEIGHT = 244;

// Position of the mine headframe in scene coordinates (see GameSceneCanvas).
const SHAFT_HOTSPOT = { x: 278, y: 120, width: 60, height: 50 };

export type SceneLayout = {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
};

// Fit the 360×244 pixel scene to the frame: shrink on narrow phones,
// center (without upscaling) on wider screens.
export function getSceneLayout(frameWidth: number): SceneLayout {
  const width = Math.max(1, frameWidth);
  const scale = Math.min(width / SCENE_WIDTH, 1);
  return {
    width,
    height: Math.round(SCENE_HEIGHT * scale),
    scale,
    offsetX: (width - SCENE_WIDTH * scale) / 2,
  };
}

export function getShaftHotspot({ scale, offsetX }: SceneLayout) {
  return {
    left: offsetX + SHAFT_HOTSPOT.x * scale,
    top: SHAFT_HOTSPOT.y * scale,
    width: SHAFT_HOTSPOT.width * scale,
    height: SHAFT_HOTSPOT.height * scale,
  };
}
