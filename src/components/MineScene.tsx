import { StyleSheet, View } from 'react-native';
import MineSceneCanvas from './MineSceneCanvas';
import MineSceneReadout, { type MineSceneProps } from './MineSceneReadout';
import { MINE_MAP_HEIGHT, MINE_MAP_WIDTH } from './MineMapLayout';

export default function MineScene({ miners, depth, coal }: MineSceneProps) {
  return (
    <View style={styles.frame}>
      <MineSceneCanvas />
      <MineSceneReadout miners={miners} depth={depth} coal={coal} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: MINE_MAP_HEIGHT, width: MINE_MAP_WIDTH, overflow: 'hidden', backgroundColor: '#55432f' },
});