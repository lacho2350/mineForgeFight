// On the web every Skia <Canvas> draws through a WebGL context, and browsers refuse or take one back now and
// then: a window without GPU access (a hidden or embedded browser pane, a blocklisted driver), too many GPU
// canvases on the page, a GPU reset. CanvasKit then throws ("failed to create webgl context", "Could not
// create surface") and the screen stops. So:
// - a canvas that can't get WebGL draws on the CPU instead (a 2D canvas) — slower, but the game goes on;
// - after the first failure, or a context lost, every canvas made from then on draws on the CPU, so the page
//   stops asking for GPU contexts that fail;
// - a canvas that had WebGL and lost it can't switch to 2D (a canvas element keeps the kind of context it
//   first got): it draws off-screen for the moment and asks its view to remount with a fresh element
//   (`SKIA_RESET_EVENT`, `useSkiaRemountKey` in skiaWebRemount.ts).
// Imported first by every canvas module; on iOS and Android there is no CanvasKit global and it does nothing.
import { SKIA_RESET_EVENT } from './skiaWebRemount';

type CanvasKitLike = {
  MakeWebGLCanvasSurface: (canvas: unknown, ...rest: unknown[]) => unknown;
  MakeSWCanvasSurface: (canvas: unknown) => unknown;
  __mffSoftwareFallback?: boolean;
};

let software = false;
const reset = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SKIA_RESET_EVENT));
};

const kit = (globalThis as { CanvasKit?: CanvasKitLike }).CanvasKit;
if (kit && !kit.__mffSoftwareFallback && typeof document !== 'undefined') {
  const webgl = kit.MakeWebGLCanvasSurface.bind(kit);
  const cpu = (canvas: unknown) => {
    try {
      return kit.MakeSWCanvasSurface(canvas) ?? null;
    } catch {
      return null;
    }
  };
  kit.MakeWebGLCanvasSurface = (canvas: unknown, ...rest: unknown[]) => {
    if (!software) {
      try {
        const surface = webgl(canvas, ...rest);
        if (surface) return surface;
      } catch (error) {
        console.warn('WebGL is unavailable here; drawing on the CPU instead.', error);
      }
      software = true;
    }
    const surface = cpu(canvas);
    if (surface) return surface;
    // This canvas had WebGL: draw into a spare one until its view comes back with a fresh element.
    const element = canvas as { width?: number; height?: number };
    const spare = document.createElement('canvas');
    spare.width = Math.max(1, element.width ?? 1);
    spare.height = Math.max(1, element.height ?? 1);
    reset();
    return kit.MakeSWCanvasSurface(spare);
  };
  // A GPU canvas whose context the browser took back goes blank without any call reaching us: switch to
  // the CPU and remount the views.
  document.addEventListener(
    'webglcontextlost',
    () => {
      software = true;
      reset();
    },
    true,
  );
  kit.__mffSoftwareFallback = true;
}
