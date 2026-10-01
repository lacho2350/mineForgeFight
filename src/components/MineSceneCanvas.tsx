import { useState } from 'react';
import { Canvas, Circle, Group, Rect as SkiaRect } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import MinePickaxe from './MinePickaxe';
import {
  MINE_COLUMNS,
  MINE_GALLERY_COUNT,
  MINE_GALLERY_START,
  MINE_GALLERY_STEP,
  MINE_MAP_HEIGHT,
  MINE_MAP_WIDTH,
  MINE_SHAFT_X,
  MINE_STATIONS,
  MINE_TILE_SIZE,
} from './MineMapLayout';
import { useGameStore } from '../../gameStore';

const tileSize = MINE_TILE_SIZE;
const width = MINE_MAP_WIDTH;
const height = MINE_MAP_HEIGHT;
const galleryCount = MINE_GALLERY_COUNT;
const galleryStart = MINE_GALLERY_START;
const galleryStep = MINE_GALLERY_STEP;
const gallerySoils = ['#604a34', '#655039', '#56432f', '#6b5438'];
const minerPixels = [
  '..HHHH..',
  '.HHHHHH.',
  '.HSSSSH.',
  '..SWWS..',
  '..PPPP..',
  '.PPPPPP.',
  '.PBBPPP.',
  '..BBBB..',
  '.B....B.',
  '.D....D.',
];
const minerPalette: Record<string, string> = {
  H: '#edaa59',
  S: '#503c31',
  W: '#f6e8bd',
  P: '#789277',
  B: '#594739',
  D: '#332f29',
};

type TileRectProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity?: number;
};

function Rect({ x, y, width, height, color, opacity = 1 }: TileRectProps) {
  const outline = width <= 200 || height <= 24;

  return (
    <Group>
      <SkiaRect x={x} y={y} width={width} height={height} color={color} opacity={opacity} />
      {outline && width > 1 && height > 1 && (
        <SkiaRect
          x={x + 0.35}
          y={y + 0.35}
          width={width - 0.7}
          height={height - 0.7}
          color="#241b13"
          style="stroke"
          strokeWidth={0.7}
          opacity={0.52 * opacity}
        />
      )}
    </Group>
  );
}

const minerPositions = [
  ...MINE_STATIONS.map((station) => ({ x: station.minerColumn * tileSize, y: tileSize * 2 })),
  ...Array.from({ length: galleryCount * MINE_STATIONS.length }, (_, index) => {
    const station = MINE_STATIONS[index % MINE_STATIONS.length];
    const level = Math.floor(index / MINE_STATIONS.length);
    return {
      x: station.minerColumn * tileSize,
      y: galleryStart + level * galleryStep,
    };
  }),
];

function PixelMiner({ x, y }: { x: number; y: number }) {
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]}>
      {minerPixels.flatMap((row, rowIndex) =>
        Array.from(row).map((pixel, columnIndex) =>
          pixel === '.' ? null : (
            <Rect
              key={`${rowIndex}-${columnIndex}`}
              x={columnIndex * 5}
              y={rowIndex * 5}
              width={5}
              height={5}
              color={minerPalette[pixel]}
            />
          ),
        ),
      )}
    </Group>
  );
}

function OreDeposit({ x, y, level }: { x: number; y: number; level: number }) {
  const coalTones = ['#c5a46a', '#d0b47a', '#b9965e', '#d6bd83'];
  const coalTone = coalTones[level % coalTones.length];

  return (
    <Group>
      <Rect x={x} y={y} width={tileSize} height={tileSize} color={gallerySoils[level % gallerySoils.length]} />
      <Rect x={x + 4} y={y + 4} width={tileSize - 8} height={tileSize - 8} color="#1b2220" />
      <Rect x={x + 8} y={y + 8} width={12} height={10} color={coalTone} />
      <Rect x={x + 24} y={y + 13} width={14} height={10} color="#111817" />
      <Rect x={x + 15} y={y + 29} width={18} height={10} color={coalTone} />
      <Rect x={x + 5} y={y + 22} width={7} height={12} color="#34403a" />
    </Group>
  );
}

function DeepGallery({ level }: { level: number }) {
  const top = galleryStart + level * galleryStep;
  const soil = gallerySoils[level % gallerySoils.length];
  const cartX = MINE_SHAFT_X + (level % 2 === 0 ? tileSize : -tileSize);

  return (
    <Group>
      <Rect x={0} y={top} width={width} height={galleryStep} color={soil} />
      <Rect x={0} y={top + tileSize} width={width} height={tileSize} color="#292722" />
      <Rect x={0} y={top + tileSize - 4} width={width} height={4} color="#8a7651" />

      {MINE_STATIONS.map((station, index) => (
        <OreDeposit
          key={`ore-${index}`}
          x={station.oreColumn * tileSize}
          y={top}
          level={level + index}
        />
      ))}

      {Array.from({ length: MINE_COLUMNS }, (_, column) => (
        <Rect key={`tie-${column}`} x={column * tileSize + 20} y={top + tileSize + 22} width={8} height={24} color="#514738" />
      ))}
      <Rect x={0} y={top + tileSize + 32} width={width} height={3} color="#9c8056" />
      <Rect x={0} y={top + tileSize + 40} width={width} height={3} color="#806946" />

      <Rect x={cartX} y={top + tileSize + 9} width={tileSize} height={16} color="#795b3d" />
      <Rect x={cartX - 3} y={top + tileSize + 5} width={tileSize + 6} height={4} color="#c19459" />
      <Rect x={cartX + 7} y={top + tileSize + 12} width={10} height={7} color="#171d1b" />
      <Rect x={cartX + 25} y={top + tileSize + 12} width={12} height={7} color="#212824" />
      <Circle cx={cartX + 8} cy={top + tileSize + 28} r={4} color="#282721" />
      <Circle cx={cartX + 40} cy={top + tileSize + 28} r={4} color="#282721" />
    </Group>
  );
}

export default function MineSceneCanvas() {
  const [viewportWidth, setViewportWidth] = useState(width);
  const miners = useGameStore((state) => state.miners);
  const shaftX = MINE_SHAFT_X;
  const scale = Math.min(viewportWidth / width, 1);
  const offsetX = (viewportWidth - width * scale) / 2;

  return (
    <View onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)} style={styles.frame}>
      <Canvas __destroyWebGLContextAfterRender style={{ flex: 1 }}>
        <Rect x={0} y={0} width={viewportWidth} height={height} color="#55432f" />
        <Group transform={[{ translateX: offsetX }, { scale }]}>
          <Rect x={0} y={0} width={width} height={height} color="#55432f" />
          <Rect x={0} y={0} width={width} height={galleryStart} color="#55432f" />
          {Array.from({ length: galleryStart / tileSize }, (_, row) => (
            <Rect key={`entrance-strata-${row}`} x={0} y={row * tileSize + 35} width={width} height={6} color={gallerySoils[row % gallerySoils.length]} />
          ))}
          {Array.from({ length: MINE_COLUMNS * 4 }, (_, index) => (
            <Rect
              key={`entrance-earth-${index}`}
              x={(index % MINE_COLUMNS) * tileSize + 5 + (index % 3) * 7}
              y={Math.floor(index / MINE_COLUMNS) * tileSize + 12 + (index % 3) * 6}
              width={8 + (index % 4) * 3}
              height={3 + (index % 3) * 2}
              color={['#745a3b', '#4a3b2b', '#685138', '#796044'][index % 4]}
              opacity={0.8}
            />
          ))}
          <Rect x={shaftX} y={0} width={tileSize} height={galleryStart} color="#171d1b" />
          <Rect x={shaftX} y={0} width={5} height={galleryStart} color="#98794d" />
          <Rect x={shaftX + tileSize - 5} y={0} width={5} height={galleryStart} color="#98794d" />
          <Rect x={shaftX - 8} y={0} width={tileSize + 16} height={8} color="#b58a55" />
          {Array.from({ length: galleryStart / tileSize - 1 }, (_, row) => (
            <Rect key={`entrance-rung-${row}`} x={shaftX + 8} y={(row + 1) * tileSize} width={tileSize - 16} height={3} color="#554937" />
          ))}

          {MINE_STATIONS.map((station, index) => (
            <OreDeposit
              key={`entrance-ore-${index}`}
              x={station.oreColumn * tileSize}
              y={tileSize * 2}
              level={index}
            />
          ))}

          {minerPositions.slice(0, Math.min(miners, minerPositions.length)).map((position, index) => (
            <PixelMiner key={`miner-${index}`} x={position.x} y={position.y} />
          ))}

          <Rect x={0} y={galleryStart - tileSize} width={width} height={tileSize} color="#292b26" />
          <Rect x={0} y={galleryStart - tileSize} width={width} height={4} color="#878064" />
          <Rect x={0} y={galleryStart - 32} width={width} height={3} color="#705e46" />
          <Rect x={0} y={galleryStart - 12} width={width} height={3} color="#705e46" />
          {Array.from({ length: MINE_COLUMNS }, (_, index) => (
            <Rect key={`tie-${index}`} x={index * tileSize + 20} y={galleryStart - 40} width={8} height={28} color="#514738" />
          ))}

          <Rect x={shaftX - tileSize} y={galleryStart - 34} width={tileSize} height={16} color="#75563d" />
          <Rect x={shaftX - tileSize - 3} y={galleryStart - 38} width={tileSize + 6} height={4} color="#bd8a51" />
          <Rect x={shaftX - tileSize + 8} y={galleryStart - 31} width={12} height={8} color="#171e1d" />
          <Rect x={shaftX - tileSize + 27} y={galleryStart - 31} width={12} height={8} color="#202827" />
          <Circle cx={shaftX - tileSize + 8} cy={galleryStart - 14} r={4} color="#242621" />
          <Circle cx={shaftX - 8} cy={galleryStart - 14} r={4} color="#242621" />

          {Array.from({ length: galleryCount }, (_, level) => (
            <DeepGallery key={`gallery-${level}`} level={level} />
          ))}
          <Rect x={shaftX} y={0} width={tileSize} height={height} color="#171d1b" />
          <Rect x={shaftX} y={0} width={5} height={height} color="#98794d" />
          <Rect x={shaftX + tileSize - 5} y={0} width={5} height={height} color="#98794d" />
          {Array.from({ length: height / tileSize }, (_, row) => (
            <Rect key={`lift-rung-${row}`} x={shaftX + 8} y={row * tileSize + 12} width={tileSize - 16} height={3} color="#554937" />
          ))}
          {Array.from({ length: galleryCount }, (_, level) => (
            <Rect
              key={`lift-landing-${level}`}
              x={shaftX}
              y={galleryStart + level * galleryStep + tileSize - 4}
              width={tileSize}
              height={4}
              color="#b58a55"
            />
          ))}
          <Group opacity={0.24}>
            {Array.from({ length: width / tileSize + 1 }, (_, index) => (
              <Rect key={`grid-column-${index}`} x={index * tileSize} y={0} width={1} height={height} color="#21170f" />
            ))}
            {Array.from({ length: height / tileSize + 1 }, (_, index) => (
              <Rect key={`grid-row-${index}`} x={0} y={index * tileSize} width={width} height={1} color="#21170f" />
            ))}
          </Group>
        </Group>
      </Canvas>
      <View style={styles.pickaxeLayer}>
        {minerPositions.slice(0, Math.min(miners, minerPositions.length)).map((position, index) => (
          <MinePickaxe
            key={`pickaxe-${index}`}
            x={position.x}
            y={position.y}
            index={index}
            scale={scale}
            offsetX={offsetX}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height, width: '100%', overflow: 'hidden', position: 'relative' },
  pickaxeLayer: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
});
