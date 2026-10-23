// A building's miniature for the Build palette: its first-level look from the map (stronghold/buildingArt.tsx),
// on a patch of grass, drawn off screen once into a small PNG. Loaded lazily (useBuildingMiniature.ts): on
// web, Skia only exists once CanvasKit has loaded for the map.
import './skiaWebFallback';
import * as SkiaModule from '@shopify/react-native-skia';
import { Group, Path, Skia, type SkImage, type SkPicture } from '@shopify/react-native-skia';
import type { ReactElement } from 'react';
import type { BuildingId } from '../game/buildings';
import type { Placements } from '../game/cityMap';
import { plotOf, plotRect, iso } from './GameSceneLayout';
import { BuildingArt } from './stronghold/buildingArt';
import { GRASS_DARK, GRASS_LIGHT } from './stronghold/grass';
import { poly } from './stronghold/shapes';
import { svgPath } from './skiaPaths';

/** The miniature's size in pixels (shown at half that, so it stays crisp on dense screens). */
export const MINIATURE_PIXELS = 112;

type Offscreen = {
  drawAsPicture?: (element: ReactElement, bounds?: ReturnType<typeof Skia.XYWHRect>) => SkPicture | Promise<SkPicture>;
  drawAsImage?: (element: ReactElement, size: { width: number; height: number }) => SkImage | Promise<SkImage>;
};

/** The miniature of a building as a PNG data URI, or null if it can't be drawn here. */
export async function renderMiniature(id: BuildingId): Promise<string | null> {
  const size = MINIATURE_PIXELS;
  // Any spot will do: the drawing is moved to the middle of the picture.
  const plot = plotOf(id, {} as Placements, { x: 20, y: 20 });
  if (!plot) return null;
  const rect = plotRect(plot);
  const pad = 4;
  const scale = (size - pad * 2) / Math.max(rect.width, rect.height, 1);
  const ground = [iso(plot.x, plot.y), iso(plot.x + plot.w, plot.y), iso(plot.x + plot.w, plot.y + plot.d), iso(plot.x, plot.y + plot.d)];
  const element = (
    <Group
      transform={[
        { translateX: size / 2 },
        { translateY: size / 2 },
        { scale },
        { translateX: -(rect.x + rect.width / 2) },
        { translateY: -(rect.y + rect.height / 2) },
      ]}
    >
      <Path path={svgPath(poly(ground))} color={GRASS_LIGHT} />
      <Path path={svgPath(poly(ground))} color={GRASS_DARK} style="stroke" strokeWidth={1 / scale} />
      <BuildingArt id={id} plot={plot} tier={1} level={1} />
    </Group>
  );
  const offscreen = SkiaModule as unknown as Offscreen;
  let image: SkImage | null = null;
  if (offscreen.drawAsPicture) {
    // Replay the picture into a plain CPU surface (works with or without WebGL).
    const picture = await offscreen.drawAsPicture(element, Skia.XYWHRect(0, 0, size, size));
    const surface = Skia.Surface.Make(size, size);
    if (!surface) return null;
    surface.getCanvas().drawPicture(picture);
    image = surface.makeImageSnapshot();
    surface.dispose();
  } else if (offscreen.drawAsImage) {
    image = await offscreen.drawAsImage(element, { width: size, height: size });
  }
  if (!image) return null;
  const encoded = image.encodeToBase64();
  image.dispose();
  return encoded ? `data:image/png;base64,${encoded}` : null;
}
