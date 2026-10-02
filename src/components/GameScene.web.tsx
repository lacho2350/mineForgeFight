import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { StyleSheet, View } from 'react-native';
import type { GameSceneProps } from './GameSceneCanvas';

export default function GameScene({ layout }: GameSceneProps) {
  return (
    <View style={[styles.viewport, { height: layout.height }]}>
      <WithSkiaWeb
        getComponent={() => import('./GameSceneCanvas')}
        componentProps={{ layout }}
        opts={{ locateFile: (file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full/${file}` }}
        fallback={<View style={styles.fallback} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { width: '100%' },
  fallback: { flex: 1, backgroundColor: '#252d23' },
});
