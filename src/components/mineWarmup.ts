// Draw the mine's first terrain blocks before the mine screen opens. On Android every block is
// rasterised on the CPU as it's first seen, so the mine used to open on a moment of black rock; drawn
// while the stronghold is still showing, the blocks round the lift are ready when the screen slides in.
// Native only: Skia is loaded from the start here. The web twin (mineWarmup.web.ts) does nothing —
// there the mine's Skia (CanvasKit) is loaded lazily by the mine screen itself.
import { Dimensions } from 'react-native';
import { useGameStore } from '../game/gameStore';
import { selectMineLayout } from '../game/hold';
import { warmTerrainBlocks } from './mineTerrain';

/** Have the blocks the mine shows first drawn and cached (cheap when they are already). */
export function warmMine() {
  try {
    const { width, height } = Dimensions.get('window');
    warmTerrainBlocks(selectMineLayout(useGameStore.getState()), width, height);
  } catch (error) {
    // Only a head start: the mine draws its own blocks either way.
    console.warn('Could not draw the mine ahead of time', error);
  }
}
