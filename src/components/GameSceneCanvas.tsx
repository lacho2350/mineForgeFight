import { useState } from 'react';
import { Canvas, Circle, Group, Rect } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import { useGameStore } from '../../gameStore';

const sceneWidth = 360;
const sceneHeight = 244;

export default function GameSceneCanvas() {
  const [width, setWidth] = useState(sceneWidth);
  const depth = useGameStore((state) => state.depth);
  const miners = useGameStore((state) => state.miners);
  const scale = Math.min(width / sceneWidth, 1);
  const offsetX = (width - sceneWidth * scale) / 2;

  return (
    <View onLayout={({ nativeEvent }) => setWidth(Math.max(sceneWidth, nativeEvent.layout.width))} style={styles.frame}>
      <Canvas __destroyWebGLContextAfterRender style={styles.canvas}>
        <Rect x={0} y={0} width={width} height={sceneHeight} color="#9dad85" />
        <Rect x={0} y={125} width={width} height={119} color="#64754d" />
        <Rect x={0} y={184} width={width} height={60} color="#4a4535" />
        <Rect x={0} y={181} width={width} height={5} color="#9a8155" />
        <Group transform={[{ translateX: offsetX }, { scale }]}>
          <Circle cx={293} cy={43} r={20} color="#e7c47e" />
          <Rect x={29} y={45} width={32} height={8} color="#d4d0aa" />
          <Rect x={40} y={37} width={20} height={8} color="#d4d0aa" />
          <Rect x={213} y={51} width={49} height={7} color="#d4d0aa" />
          <Rect x={226} y={43} width={27} height={8} color="#d4d0aa" />
          <Rect x={0} y={125} width={sceneWidth} height={119} color="#64754d" />
          <Rect x={0} y={118} width={82} height={10} color="#73845a" />
          <Rect x={272} y={113} width={88} height={15} color="#718153" />

          <Rect x={120} y={80} width={106} height={50} color="#b5865d" />
          <Rect x={109} y={71} width={128} height={14} color="#d0a873" />
          <Rect x={127} y={59} width={17} height={13} color="#b5865d" />
          <Rect x={153} y={59} width={17} height={13} color="#b5865d" />
          <Rect x={179} y={59} width={17} height={13} color="#b5865d" />
          <Rect x={205} y={59} width={17} height={13} color="#b5865d" />
          <Rect x={137} y={91} width={12} height={13} color="#46513e" />
          <Rect x={196} y={91} width={12} height={13} color="#46513e" />
          <Rect x={163} y={103} width={21} height={27} color="#564436" />
          <Rect x={171} y={107} width={3} height={3} color="#d2a45f" />

          <Rect x={296} y={104} width={24} height={11} color="#493b2a" />
          <Rect x={305} y={88} width={6} height={16} color="#705139" />
          <Rect x={286} y={106} width={44} height={6} color="#c28d52" />
          <Rect x={282} y={112} width={7} height={70} color="#805a3c" />
          <Rect x={327} y={112} width={7} height={70} color="#805a3c" />
          <Rect x={278} y={121} width={60} height={8} color="#bd8d55" />
          <Rect x={295} y={129} width={26} height={48} color="#171d1b" />
          <Rect x={301} y={136} width={14} height={36} color="#232822" />
          <Rect x={306} y={136} width={3} height={36} color="#bd8d55" />

          <Rect x={21} y={108} width={54} height={27} color="#d1ad76" />
          <Rect x={17} y={101} width={62} height={8} color="#825942" />
          <Rect x={29} y={115} width={11} height={20} color="#43513f" />
          <Rect x={54} y={115} width={11} height={12} color="#43513f" />
          <Rect x={74} y={137} width={207} height={5} color="#ceb377" />

          <Rect x={0} y={184} width={sceneWidth} height={60} color="#4a4535" />
          <Rect x={0} y={181} width={sceneWidth} height={5} color="#9a8155" />
          {Array.from({ length: 9 }, (_, index) => (
            <Rect key={index} x={index * 45 + 8} y={199 + (index % 2) * 12} width={18} height={5} color="#605942" />
          ))}
          <Rect x={244} y={166} width={34} height={4} color="#4f4434" />
          <Rect x={250} y={160} width={5} height={18} color="#443c30" />
          <Rect x={268} y={160} width={5} height={18} color="#443c30" />
          <Rect x={252} y={155} width={5} height={5} color="#33372a" />
          <Rect x={259} y={151} width={5} height={9} color="#33372a" />
          <Rect x={266} y={156} width={5} height={5} color="#33372a" />
          <Rect x={0} y={229} width={sceneWidth} height={15} color="#3b3d30" />
          <Rect x={278} y={178} width={60} height={66} color="#222720" />
          <Rect x={276} y={176} width={64} height={8} color="#bd8d55" />
          <Rect x={282} y={184} width={7} height={54} color="#805a3c" />
          <Rect x={327} y={184} width={7} height={54} color="#805a3c" />
          <Rect x={294} y={185} width={28} height={59} color="#151b19" />
          <Rect x={298} y={193} width={20} height={3} color="#9f8154" />
          <Rect x={298} y={210} width={20} height={3} color="#9f8154" />
          <Rect x={298} y={227} width={20} height={3} color="#9f8154" />
          <Rect x={306} y={189} width={3} height={40} color="#d2ae70" />
          <Rect x={8} y={230} width={92} height={14} color="#c8d18a" opacity={0.12} />
          <Rect x={15} y={234} width={38} height={3} color="#e3d9b6" opacity={0.72} />
          <Rect x={57} y={234} width={24} height={3} color="#c98a59" opacity={0.85} />
          <Rect x={88} y={234} width={miners * 4} height={3} color="#c8d18a" />
          <Rect x={307} y={231} width={20} height={12} color="#dcbd78" />
          <Rect x={314} y={222} width={6} height={10} color="#dfc57c" />
          <Rect x={310} y={217} width={14} height={5} color="#e2c780" />
          <Rect x={14} y={25} width={65} height={15} color="#26352c" opacity={0.85} />
          <Rect x={20} y={30} width={5} height={5} color="#c8d18a" />
          <Rect x={30} y={29} width={43} height={3} color="#e4dec9" />
          <Rect x={30} y={34} width={27} height={2} color="#b7b497" />
          {depth > 1 && <Rect x={sceneWidth - 28} y={28} width={14} height={14} color="#c98a59" />}
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', height: sceneHeight, overflow: 'hidden' },
  canvas: { flex: 1 },
});