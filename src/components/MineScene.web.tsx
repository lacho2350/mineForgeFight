import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { StyleSheet, View } from 'react-native';
import MineSceneReadout, { type MineSceneProps } from './MineSceneReadout';
import { MINE_MAP_HEIGHT, MINE_MAP_WIDTH } from './MineMapLayout';

export default function MineScene({ miners, depth, coal }: MineSceneProps) {
  return (
    <View style={styles.frame}>
      <WithSkiaWeb
        getComponent={() => import('./MineSceneCanvas')}
        opts={{ locateFile: (file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full/${file}` }}
        fallback={<View style={styles.fallback} />}
      />
      <MineSceneReadout miners={miners} depth={depth} coal={coal} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: MINE_MAP_HEIGHT, width: MINE_MAP_WIDTH, overflow: 'hidden', backgroundColor: '#55432f' },
  fallback: { flex: 1, backgroundColor: '#55432f' },
});