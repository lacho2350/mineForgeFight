import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { StyleSheet, View } from 'react-native';
import type { GameSceneProps } from './GameSceneCanvas';

export default function GameScene(props: GameSceneProps) {
  return (
    <View style={styles.viewport}>
      <WithSkiaWeb
        getComponent={() => import('./GameSceneCanvas')}
        componentProps={props}
        opts={{ locateFile: (file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full/${file}` }}
        fallback={<View style={styles.fallback} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1 },
  fallback: { flex: 1, backgroundColor: '#4f6a3c' },
});
