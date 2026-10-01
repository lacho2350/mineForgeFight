import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { StyleSheet, View } from 'react-native';

export default function GameScene() {
  return (
    <View style={styles.viewport}>
      <WithSkiaWeb
        getComponent={() => import('./GameSceneCanvas')}
        opts={{ locateFile: (file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full/${file}` }}
        fallback={<View style={styles.fallback} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { height: 244, width: '100%' },
  fallback: { flex: 1, backgroundColor: '#252d23' },
});