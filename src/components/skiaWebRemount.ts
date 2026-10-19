import { useEffect, useState } from 'react';

/** Sent when a canvas lost its GPU context (kept here, not in skiaWebFallback.ts, so importing it doesn't run
 * the fallback before CanvasKit has loaded). */
export const SKIA_RESET_EVENT = 'mff-skia-reset';

/**
 * A key for a web Skia view: it changes when a canvas lost its GPU context (skiaWebFallback.ts), so the
 * view remounts with a fresh canvas element (drawn on the CPU from then on). Remounts at most once a second.
 */
export function useSkiaRemountKey() {
  const [key, setKey] = useState(0);
  useEffect(() => {
    let last = 0;
    const onReset = () => {
      const now = Date.now();
      if (now - last < 1000) return;
      last = now;
      setKey((k) => k + 1);
    };
    window.addEventListener(SKIA_RESET_EVENT, onReset);
    return () => window.removeEventListener(SKIA_RESET_EVENT, onReset);
  }, []);
  return key;
}
