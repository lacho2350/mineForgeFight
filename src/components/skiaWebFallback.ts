// On the web every Skia <Canvas> asks the browser for a WebGL context. Browsers refuse one now and then —
// a window without GPU access (a hidden or embedded browser pane, a blocklisted driver, too many contexts
// at once) — and CanvasKit then throws "failed to create webgl context", which stops the screen dead.
// Fall back to drawing on the CPU (a 2D canvas) instead: slower, but the game keeps running.
// Imported first by every canvas module; on iOS and Android there is no CanvasKit global and it does nothing.
type CanvasKitLike = {
  MakeWebGLCanvasSurface: (canvas: unknown, ...rest: unknown[]) => unknown;
  MakeSWCanvasSurface: (canvas: unknown) => unknown;
  __mffSoftwareFallback?: boolean;
};

const kit = (globalThis as { CanvasKit?: CanvasKitLike }).CanvasKit;
if (kit && !kit.__mffSoftwareFallback) {
  const webgl = kit.MakeWebGLCanvasSurface.bind(kit);
  kit.MakeWebGLCanvasSurface = (canvas: unknown, ...rest: unknown[]) => {
    try {
      const surface = webgl(canvas, ...rest);
      if (surface) return surface;
    } catch (error) {
      console.warn('WebGL is unavailable here; drawing on the CPU instead.', error);
    }
    return kit.MakeSWCanvasSurface(canvas);
  };
  kit.__mffSoftwareFallback = true;
}

export {};
