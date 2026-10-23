// The Build palette's building miniatures (buildingMiniatures.tsx), drawn once each and kept for the session.
// Until one is ready (or where it can't be drawn) the palette shows the building's icon instead. Skia-free:
// the renderer is loaded only once Skia is there (on web, when CanvasKit has loaded for the map).
import { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import type { BuildingId } from '../game/buildings';

const drawn = new Map<BuildingId, string | null>();
const drawing = new Set<BuildingId>();
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const skiaReady = () => Platform.OS !== 'web' || typeof (globalThis as { CanvasKit?: unknown }).CanvasKit !== 'undefined';

function draw(id: BuildingId, tries = 0) {
  if (drawn.has(id) || drawing.has(id)) return;
  if (!skiaReady()) {
    // The map loads CanvasKit; try again in a moment (give up after a while: the icon stays).
    if (tries < 20) setTimeout(() => draw(id, tries + 1), 500);
    return;
  }
  drawing.add(id);
  import('./buildingMiniatures')
    .then((module) => module.renderMiniature(id))
    .catch((error: unknown) => {
      console.warn(`Could not draw the ${id} miniature`, error);
      return null;
    })
    .then((uri) => {
      drawing.delete(id);
      drawn.set(id, uri);
      notify();
    });
}

/** The building's miniature as an image URI, or null while it's being drawn (or if it can't be). */
export function useBuildingMiniature(id: BuildingId): string | null {
  const uri = useSyncExternalStore(subscribe, () => drawn.get(id) ?? null);
  useEffect(() => draw(id), [id]);
  return uri;
}
