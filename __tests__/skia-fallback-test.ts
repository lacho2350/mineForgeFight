// The web Skia fallback (src/components/skiaWebFallback.ts): when the browser refuses or takes back a WebGL
// context, canvases draw on the CPU instead of stopping the game. CanvasKit, the page and its window are
// stood in for here; each test loads a fresh copy of the module, since it patches CanvasKit once on load.
import { SKIA_RESET_EVENT } from '../src/components/skiaWebRemount';

type Kit = {
  MakeWebGLCanvasSurface: jest.Mock;
  MakeSWCanvasSurface: jest.Mock;
  __mffSoftwareFallback?: boolean;
};

const globals = globalThis as Record<string, unknown>;
const saved = new Map<string, PropertyDescriptor | undefined>();
const stub = (name: string, value: unknown) => {
  if (!saved.has(name)) saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
};

let kit: Kit;
let pageListeners: Record<string, () => void>;
let resets: number;
let spares: { name: string; width?: number; height?: number }[];

beforeEach(() => {
  pageListeners = {};
  resets = 0;
  spares = [];
  kit = {
    MakeWebGLCanvasSurface: jest.fn(() => ({ kind: 'gpu' })),
    MakeSWCanvasSurface: jest.fn((canvas: { name?: string }) => ({ kind: 'cpu', canvas })),
  };
  stub('CanvasKit', kit);
  stub('document', {
    addEventListener: (type: string, listener: () => void) => void (pageListeners[type] = listener),
    createElement: () => {
      const spare: { name: string; width?: number; height?: number } = { name: 'spare' };
      spares.push(spare);
      return spare;
    },
  });
  stub('window', {
    dispatchEvent: (event: { type: string }) => {
      if (event.type === SKIA_RESET_EVENT) resets += 1;
      return true;
    },
  });
  if (typeof globals.Event === 'undefined') {
    stub(
      'Event',
      class {
        constructor(public type: string) {}
      },
    );
  }
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globals[name];
  }
  saved.clear();
  jest.restoreAllMocks();
});

/** A fresh copy of the fallback, run against the stand-ins. */
function loadFallback() {
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../src/components/skiaWebFallback');
  });
}

describe('the web Skia fallback', () => {
  it('leaves WebGL alone while the browser gives it', () => {
    const gpu = kit.MakeWebGLCanvasSurface;
    loadFallback();
    expect(kit.__mffSoftwareFallback).toBe(true);
    const surface = kit.MakeWebGLCanvasSurface({ name: 'board' }, 'extra');
    expect(surface).toEqual({ kind: 'gpu' });
    expect(gpu).toHaveBeenCalledWith({ name: 'board' }, 'extra');
    expect(kit.MakeSWCanvasSurface).not.toHaveBeenCalled();
    expect(resets).toBe(0);
  });

  it('draws on the CPU when WebGL throws, and stops asking for WebGL after that', () => {
    const gpu = kit.MakeWebGLCanvasSurface;
    gpu.mockImplementation(() => {
      throw new Error('failed to create webgl context: err 0');
    });
    loadFallback();
    const first = kit.MakeWebGLCanvasSurface({ name: 'city' });
    expect(first).toEqual({ kind: 'cpu', canvas: { name: 'city' } });
    expect(console.warn).toHaveBeenCalledTimes(1);
    // A second canvas goes straight to the CPU.
    gpu.mockClear();
    const second = kit.MakeWebGLCanvasSurface({ name: 'mine' });
    expect(second).toEqual({ kind: 'cpu', canvas: { name: 'mine' } });
    expect(gpu).not.toHaveBeenCalled();
    expect(resets).toBe(0);
  });

  it('draws on the CPU when WebGL just returns nothing', () => {
    kit.MakeWebGLCanvasSurface.mockImplementation(() => null);
    loadFallback();
    expect(kit.MakeWebGLCanvasSurface({ name: 'battle' })).toEqual({ kind: 'cpu', canvas: { name: 'battle' } });
  });

  it('gives a canvas that already had WebGL a spare surface and asks its view to remount', () => {
    kit.MakeWebGLCanvasSurface.mockImplementation(() => null);
    // A canvas that had a GPU context can't be given a 2D one: CanvasKit returns null (or throws) for it.
    kit.MakeSWCanvasSurface.mockImplementation((canvas: { name?: string }) => (canvas.name === 'spare' ? { kind: 'cpu', canvas } : null));
    loadFallback();
    const surface = kit.MakeWebGLCanvasSurface({ name: 'mine', width: 320, height: 0 });
    expect(surface).toEqual({ kind: 'cpu', canvas: spares[0] });
    expect(spares).toHaveLength(1);
    expect(spares[0]).toMatchObject({ width: 320, height: 1 });
    expect(resets).toBe(1);
  });

  it('survives the CPU surface throwing, too', () => {
    kit.MakeWebGLCanvasSurface.mockImplementation(() => null);
    kit.MakeSWCanvasSurface.mockImplementation((canvas: { name?: string }) => {
      if (canvas.name !== 'spare') throw new Error('Could not create surface');
      return { kind: 'cpu', canvas };
    });
    loadFallback();
    expect(() => kit.MakeWebGLCanvasSurface({ name: 'city' })).not.toThrow();
    expect(resets).toBe(1);
  });

  it('switches to the CPU and remounts the views when the page loses a WebGL context', () => {
    const gpu = kit.MakeWebGLCanvasSurface;
    loadFallback();
    expect(kit.MakeWebGLCanvasSurface({ name: 'city' })).toEqual({ kind: 'gpu' });
    expect(pageListeners.webglcontextlost).toBeDefined();
    pageListeners.webglcontextlost();
    expect(resets).toBe(1);
    gpu.mockClear();
    expect(kit.MakeWebGLCanvasSurface({ name: 'city again' })).toEqual({ kind: 'cpu', canvas: { name: 'city again' } });
    expect(gpu).not.toHaveBeenCalled();
  });

  it('patches CanvasKit only once', () => {
    loadFallback();
    const patched = kit.MakeWebGLCanvasSurface;
    loadFallback();
    expect(kit.MakeWebGLCanvasSurface).toBe(patched);
  });

  it('does nothing where there is no CanvasKit (iOS and Android)', () => {
    stub('CanvasKit', undefined);
    expect(() => loadFallback()).not.toThrow();
    expect(pageListeners.webglcontextlost).toBeUndefined();
  });
});
