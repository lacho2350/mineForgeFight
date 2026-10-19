import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { StyleSheet, View } from 'react-native';
import { useSkiaRemountKey } from './skiaWebRemount';
import MineViewport, { type MineSceneProps } from './MineViewport';

export default function MineScene(props: MineSceneProps) {
  const remount = useSkiaRemountKey();
  return (
    <MineViewport
      {...props}
      renderCanvas={(canvasProps) => (
        <WithSkiaWeb
          key={remount}
          getComponent={() => import('./MineSceneCanvas')}
          componentProps={canvasProps}
          opts={{ locateFile: (file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full/${file}` }}
          fallback={<View style={styles.fallback} />}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { ...StyleSheet.absoluteFill, backgroundColor: '#0d0a08' },
});
