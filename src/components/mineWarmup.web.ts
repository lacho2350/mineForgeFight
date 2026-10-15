// On the web the mine screen loads Skia (CanvasKit) lazily and draws its blocks on the GPU as it opens,
// so nothing is drawn ahead of time (and nothing here may touch Skia at module load).
export function warmMine() {}
