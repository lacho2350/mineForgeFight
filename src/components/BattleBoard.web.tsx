import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { StyleSheet, View } from 'react-native';
import type { BattleBoardProps } from './BattleBoardCanvas';

// On web, Skia (CanvasKit) loads lazily before the board can draw.
export default function BattleBoard(props: BattleBoardProps) {
  return (
    <View style={{ width: props.layout.width, height: props.layout.height }}>
      <WithSkiaWeb
        getComponent={() => import('./BattleBoardCanvas')}
        componentProps={props}
        opts={{ locateFile: (file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full/${file}` }}
        fallback={<View style={styles.fallback} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, backgroundColor: '#5f7046' },
});
