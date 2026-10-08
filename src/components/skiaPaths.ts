import { Skia, type SkPath } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';

// Who owns a Skia path. On web, Skia's objects live in CanvasKit's own memory and are freed only by
// `dispose()` — nothing is garbage-collected. A <Path> given an SVG string has it parsed into a new path
// every time it's drawn, and that path is never freed: on a canvas that redraws every frame (anything
// animated), a new one 30 times a second, until CanvasKit runs out of memory and every frame fails
// ("memory access out of bounds"). So canvases here only draw parsed paths, each with an owner:
//   • `parseSvg` — built once and kept (module-level geometry that never changes);
//   • `useSvgPaths` — held by the component that draws them, freed a little after it stops;
//   • `svgPath` — for one offscreen drawing (the castle's still image), freed with it (`collectPaths`).

const EMPTY = 'M 0 0';
/** How long a path outlives its last use: the canvas may still replay the drawing that used it. */
const DISPOSE_AFTER_MS = 5000;

/** Parse an SVG path (an empty string gives an empty path). */
export const parseSvg = (svg: string): SkPath => Skia.Path.MakeFromSVGString(svg || EMPTY) ?? Skia.Path.Make();

// Path sets released by an unmount or a change, waiting to be freed; taken back if the component comes
// right back with the same set (React's strict-mode double effects, fast refresh).
const releasing = new Map<SkPath[], ReturnType<typeof setTimeout>>();
const keep = (paths: SkPath[]) => {
  const timer = releasing.get(paths);
  if (timer !== undefined) {
    clearTimeout(timer);
    releasing.delete(paths);
  }
};
const release = (paths: SkPath[]) => {
  releasing.set(
    paths,
    setTimeout(() => {
      releasing.delete(paths);
      for (const path of paths) path.dispose();
    }, DISPOSE_AFTER_MS),
  );
};

/** These SVG strings parsed, kept while they stay the same; a replaced set is freed a little later. */
export function useSvgPaths(svgs: readonly string[]): SkPath[] {
  const key = svgs.join('\n');
  // The joined key is what matters; the array itself is new on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const paths = useMemo(() => svgs.map(parseSvg), [key]);
  useEffect(() => {
    keep(paths);
    return () => release(paths);
  }, [paths]);
  return paths;
}

// The offscreen drawing being made now, if any: paths for it are collected and freed when it's done.
let collecting: SkPath[] | null = null;

let warned = false;
/** A parsed path for the offscreen drawing in progress (freed with it; outside one it's kept, and leaks). */
export function svgPath(svg: string): SkPath {
  const path = parseSvg(svg);
  if (collecting) collecting.push(path);
  else if (__DEV__ && !warned) {
    warned = true;
    console.warn('svgPath() used outside an offscreen drawing: the path is never freed. Use useSvgPaths() in live canvases.');
  }
  return path;
}

// One offscreen drawing at a time, so each one's paths are its own.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Run `draw` (which renders components that use `svgPath`) and then `finish` with its result; the paths
 * made while drawing are freed once `finish` is done. Drawings run one after another.
 */
export function collectPaths<T, R>(draw: () => Promise<T>, finish: (result: T) => R): Promise<R> {
  const run = async () => {
    const made: SkPath[] = [];
    collecting = made;
    try {
      const result = await draw();
      collecting = null;
      return finish(result);
    } finally {
      collecting = null;
      for (const path of made) path.dispose();
    }
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}
