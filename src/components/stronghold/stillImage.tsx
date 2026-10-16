import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ClipOp, Group, Skia, drawAsPicture, type SkImage, type SkPicture } from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import { SCENE_HEIGHT, STILL_HEIGHT, STILL_TOP, SCENE_WIDTH as sceneWidth } from '../GameSceneLayout';
import { collectPaths, freeAfterDrawn } from '../skiaPaths';

// Render the still layer offscreen into an image whenever its key changes, but only while the screen
// is in view: on web a screen in the background isn't really frozen — React keeps committing, yet its
// Skia canvas keeps replaying the drawing it had, old image and all. So a replaced image is freed only
// after a commit made while the screen is in view (plus a moment's grace), and the castle isn't
// redrawn at all while hidden; it catches up when the player comes back. Images that never reached
// the screen are freed straight away.
const FREE_AFTER_MS = 2000;

// Rows of pixels drawn at a time on the CPU: about 15 ms of work each, so the game keeps moving while
// the castle is drawn anew (the whole image at once froze it for ~200 ms).
const STRIP_ROWS = 120;
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// A picture drawn into an image, on a surface that's freed straight after. Skia's own
// `drawAsImageFromPicture` makes a new GPU surface every time and never frees it; on web each one is
// a WebGL context of its own, and once a page has more than ~16 the browser drops the oldest — the
// map's canvas — and the screen goes black. So on web the image is drawn on the CPU (no context at
// all), a strip of rows per task; on iOS/Android an offscreen GPU surface shares the app's one context,
// draws it at once, and is disposed here. Null if it was `cancelled` on the way.
async function picturesToImage(pictures: SkPicture[], size: { width: number; height: number }, cancelled: () => boolean): Promise<SkImage | null> {
  const web = Platform.OS === 'web';
  const surface = web ? Skia.Surface.Make(size.width, size.height) : Skia.Surface.MakeOffscreen(size.width, size.height);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  for (let top = 0; top < size.height; top += web ? STRIP_ROWS : size.height) {
    if (top > 0) await nextTask();
    if (cancelled()) {
      surface.dispose();
      return null;
    }
    canvas.save();
    canvas.clipRect(Skia.XYWHRect(0, top, size.width, web ? STRIP_ROWS : size.height), ClipOp.Intersect, false);
    for (const picture of pictures) canvas.drawPicture(picture);
    canvas.restore();
  }
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  // A CPU copy outlives the GPU surface it came from.
  const image = Platform.OS === 'web' ? snapshot : snapshot.makeNonTextureImage();
  if (image !== snapshot) snapshot.dispose();
  surface.dispose();
  return image;
}

/**
 * The still layer as an image, made from `render`'s layers (drawn bottom to top) whenever `key` changes.
 * Each layer is recorded in a step of its own, and the image is filled in a strip at a time, so making
 * it never holds the game up for long.
 */
export function useStillImage(key: string, pixelScale: number, active: boolean, render: () => ReactElement[]) {
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
    const bounds = Skia.XYWHRect(0, 0, size.width, size.height);
    const record = (layer: ReactElement) =>
      // The paths a layer's components parse (`svgPath`) are freed once it's recorded (the picture keeps
      // what it drew). Recordings wait their turn; one already outdated by then isn't made at all.
      collectPaths(
        () => (cancelled ? Promise.resolve(null) : drawAsPicture(<Group transform={[{ scale: pixelScale }, { translateY: -STILL_TOP }]}>{layer}</Group>, bounds)),
        (picture) => picture,
      );
    void (async () => {
      const pictures: SkPicture[] = [];
      try {
        for (const layer of render()) {
          if (pictures.length > 0) await nextTask();
          const picture = await record(layer);
          if (!picture) return;
          pictures.push(picture);
        }
        const next = cancelled ? null : await picturesToImage(pictures, size, () => cancelled);
        if (!next) return;
        if (pending.current && pending.current !== shown.current) pending.current.dispose();
        pending.current = next;
        built.current = key;
        setImage(next);
      } finally {
        for (const picture of pictures) picture.dispose();
      }
    })();
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
    const cancel = freeAfterDrawn(() => {
      done = true;
      for (const old of batch) old.dispose();
    }, FREE_AFTER_MS);
    return () => {
      cancel();
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
      freeAfterDrawn(() => {
        if (mounted.current) return;
        for (const old of new Set(leftovers)) old?.dispose();
      }, FREE_AFTER_MS);
    };
  }, []);
  return image;
}

/**
 * A part of the still scene as a picture (not an image), drawn anew whenever `key` changes: for the
 * buildings drawn see-through over the castle image, which are few and replay cheaply every frame. Its
 * paths are collected and freed as the still image's are; a replaced picture is freed once the frames
 * that might still draw it are done. `render` returning null means nothing to draw.
 */
export function useScenePicture(key: string, active: boolean, render: () => ReactElement | null): SkPicture | null {
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const built = useRef('');
  const shown = useRef<SkPicture | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    if (!active || built.current === key) return;
    let cancelled = false;
    const element = render();
    const bounds = Skia.XYWHRect(0, 0, sceneWidth, SCENE_HEIGHT);
    // Nothing to draw records nothing and clears the picture (set from the same callback, so it's never
    // set from the effect itself).
    void collectPaths(
      () => (cancelled || !element ? Promise.resolve(null) : drawAsPicture(element, bounds)),
      (next) => next,
    ).then((next) => {
      if (cancelled || !mounted.current) {
        next?.dispose();
        return;
      }
      built.current = key;
      setPicture(next);
    });
    return () => {
      cancelled = true;
    };
    // `render` is a fresh closure every time; the key says what it draws.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active]);
  // The picture before this one leaves the canvas with this commit; free it once that's drawn.
  useEffect(() => {
    const previous = shown.current;
    shown.current = picture;
    if (previous && previous !== picture) freeAfterDrawn(() => previous.dispose(), FREE_AFTER_MS);
  }, [picture]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const last = shown.current;
      shown.current = null;
      if (last) freeAfterDrawn(() => last.dispose(), FREE_AFTER_MS);
    };
  }, []);
  return picture;
}
