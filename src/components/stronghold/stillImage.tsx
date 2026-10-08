import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Group, Skia, drawAsPicture, type SkImage, type SkPicture } from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import { STILL_HEIGHT, STILL_TOP, SCENE_WIDTH as sceneWidth } from '../GameSceneLayout';
import { collectPaths } from '../skiaPaths';

// Render the still layer offscreen into an image whenever its key changes, but only while the screen
// is in view: on web a screen in the background isn't really frozen — React keeps committing, yet its
// Skia canvas keeps replaying the drawing it had, old image and all. So a replaced image is freed only
// after a commit made while the screen is in view (plus a moment's grace), and the castle isn't
// redrawn at all while hidden; it catches up when the player comes back. Images that never reached
// the screen are freed straight away.
const FREE_AFTER_MS = 2000;

// A picture drawn into an image, on a surface that's freed straight after. Skia's own
// `drawAsImageFromPicture` makes a new GPU surface every time and never frees it; on web each one is
// a WebGL context of its own, and once a page has more than ~16 the browser drops the oldest — the
// map's canvas — and the screen goes black. So on web the image is drawn on the CPU (no context at
// all); on iOS/Android an offscreen GPU surface shares the app's one context, and is disposed here.
function pictureToImage(picture: SkPicture, size: { width: number; height: number }): SkImage | null {
  const surface = Platform.OS === 'web' ? Skia.Surface.Make(size.width, size.height) : Skia.Surface.MakeOffscreen(size.width, size.height);
  if (!surface) return null;
  surface.getCanvas().drawPicture(picture);
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  // A CPU copy outlives the GPU surface it came from.
  const image = Platform.OS === 'web' ? snapshot : snapshot.makeNonTextureImage();
  if (image !== snapshot) snapshot.dispose();
  surface.dispose();
  return image;
}

export function useStillImage(key: string, pixelScale: number, active: boolean, render: () => ReactElement) {
  const [image, setImage] = useState<SkImage | null>(null);
  const built = useRef(''); // key of the image in `image`
  const shown = useRef<SkImage | null>(null); // committed to the canvas
  const pending = useRef<SkImage | null>(null); // set in state, not committed yet
  const retiring = useRef<SkImage[]>([]); // replaced, waiting for a commit in view
  const mounted = useRef(true);
  useEffect(() => {
    if (!active || built.current === key) return;
    let cancelled = false;
    // The image starts below the sky (nothing still is drawn up there), so it stays the same size.
    const size = { width: Math.ceil(sceneWidth * pixelScale), height: Math.ceil(STILL_HEIGHT * pixelScale) };
    const scene = <Group transform={[{ scale: pixelScale }, { translateY: -STILL_TOP }]}>{render()}</Group>;
    // The paths the scene's components parse (`svgPath`) are freed once the image is made.
    void collectPaths(
      // Drawings wait their turn; one already outdated by then isn't made at all.
      () => (cancelled ? Promise.resolve(null) : drawAsPicture(scene, Skia.XYWHRect(0, 0, size.width, size.height))),
      (picture) => {
        if (!picture) return;
        const next = cancelled ? null : pictureToImage(picture, size);
        picture.dispose();
        if (!next) return;
        if (pending.current && pending.current !== shown.current) pending.current.dispose();
        pending.current = next;
        built.current = key;
        setImage(next);
      },
    );
    return () => {
      cancelled = true;
    };
    // The key captures everything the still layer shows; `render` is a fresh closure every time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active]);
  // After the commit that put `image` on the canvas, the previous one retires…
  useEffect(() => {
    const previous = shown.current;
    shown.current = image;
    if (pending.current === image) pending.current = null;
    if (previous && previous !== image) retiring.current.push(previous);
  }, [image]);
  // …and is freed once that commit was made with the screen in view.
  useEffect(() => {
    const queue = retiring.current; // one array, changed in place
    if (!active || queue.length === 0) return;
    const batch = queue.splice(0);
    let done = false;
    const timer = setTimeout(() => {
      done = true;
      for (const old of batch) old.dispose();
    }, FREE_AFTER_MS);
    return () => {
      clearTimeout(timer);
      if (!done) queue.push(...batch);
    };
  }, [image, active]);
  // Free everything when the scene goes away for good (a hot reload re-runs this effect at once,
  // which cancels it).
  useEffect(() => {
    mounted.current = true;
    const queue = retiring.current;
    return () => {
      mounted.current = false;
      const leftovers = [shown.current, pending.current, ...queue];
      setTimeout(() => {
        if (mounted.current) return;
        for (const old of new Set(leftovers)) old?.dispose();
      }, FREE_AFTER_MS);
    };
  }, []);
  return image;
}
