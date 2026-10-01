import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type MinePickaxeProps = {
  x: number;
  y: number;
  index: number;
  scale: number;
  offsetX: number;
};

export default function MinePickaxe({ x, y, index, scale, offsetX }: MinePickaxeProps) {
  const angle = useSharedValue(index % 2 === 0 ? -38 : 38);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.get()}deg` }],
  }), [angle]);

  useEffect(() => {
    angle.set(withRepeat(withTiming(-angle.get(), { duration: 420 }), -1, true));
  }, [angle]);

  return (
    <Animated.View
      testID={`miner-pickaxe-${String(index)}`}
      style={[styles.pickaxe, { left: offsetX + (x + 28) * scale, top: (y + 5) * scale }, animatedStyle]}
    >
      <View style={styles.handle} />
      <View style={styles.head} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pickaxe: { position: 'absolute', width: 18, height: 28, alignItems: 'center', transformOrigin: '50% 85%' },
  handle: { position: 'absolute', left: 8, top: 6, width: 3, height: 20, backgroundColor: '#c89857' },
  head: { position: 'absolute', left: 3, top: 5, width: 13, height: 4, backgroundColor: '#d9c18b' },
});