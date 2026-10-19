import { memo, useMemo } from 'react';
import { Canvas, Circle, Group, Path, Rect } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { BATTLE_COLS, BATTLE_ROWS, GATE_ROW, MOAT_COL, WALL_COL, inMoat, isAlive, type Battle } from '../game/combat';
import type { UnitId } from '../game/units';
import { hexCenter, hexPath, type BoardLayout } from './battleLayout';
import { strikeFlash, strikeFlight, trackOpacity, trackPose, type Playback, type Strike, type Track } from './battlePlayback';
import { SPRITE_SIZE, spriteRuns } from './unitSprites';
import { useSvgPaths } from './skiaPaths';

export type BattleBoardProps = {
  battle: Battle;
  layout: BoardLayout;
  /** Hex keys to tint: where the active stack can move, enemies it can hit, allies it can heal. */
  moves: number[];
  targets: number[];
  helps: number[];
  /** The last action played out (`progress`: seconds into it), and whether it's still playing. */
  playback: Playback;
  progress: SharedValue<number>;
  playing: boolean;
};

const keyHex = (key: number) => ({ col: key % BATTLE_COLS, row: Math.floor(key / BATTLE_COLS) });

function BattleBoardCanvas({ battle, layout, moves, targets, helps, playback, progress, playing }: BattleBoardProps) {
  const { size, width, height, fieldWidth } = layout;
  const gridSvg = useMemo(() => {
    const parts: string[] = [];
    for (let row = 0; row < BATTLE_ROWS; row++) for (let col = 0; col < BATTLE_COLS; col++) parts.push(hexPath(size, col, row, 0.5));
    return parts.join(' ');
  }, [size]);
  const courtyard = hexCenter(size, WALL_COL, 0).x;
  const active = battle.status === 'active' && !playing ? battle.stacks.find((stack) => stack.id === battle.queue[0]) : undefined;
  const tint = (keys: number[], inset = 2) => keys.map((key) => hexPath(size, keyHex(key).col, keyHex(key).row, inset)).join(' ');
  // The flooded moat in front of the wall (and the bridge at the gate, unless it's raised).
  const moat = Array.from({ length: BATTLE_ROWS }, (_, row) => row).filter((row) => inMoat(battle, MOAT_COL, row));
  const bridge = (battle.moat ?? 0) > 0 && !battle.moatAtGate;
  // In the field: open grass all the way across, with a few bushes and stones (no courtyard or towers).
  const field = battle.kind === 'field';
  const scrubSvg = useMemo(() => {
    const parts: string[] = [];
    for (let i = 0; i < 18; i++) {
      const x = ((i * 137) % 97) / 97;
      const y = ((i * 71) % 89) / 89;
      const r = 2 + (i % 3);
      const cx = x * width;
      const cy = y * height;
      parts.push(`M ${(cx - r).toFixed(1)} ${cy.toFixed(1)} a ${String(r)} ${String(r * 0.7)} 0 1 0 ${String(2 * r)} 0 a ${String(r)} ${String(r * 0.7)} 0 1 0 ${String(-2 * r)} 0 Z`);
    }
    return parts.join(' ');
  }, [width, height]);
  // Every shape on the board as a path held here (so they're freed when the board changes; see skiaPaths).
  const standingWalls = battle.walls.filter((piece) => piece.hp > 0);
  const [grid, scrub, moatPath, bridgePath, movesPath, helpsPath, targetsPath, activePath, ...wallPaths] = useSvgPaths([
    gridSvg,
    scrubSvg,
    moat.map((row) => hexPath(size, MOAT_COL, row, 0)).join(' '),
    bridge ? hexPath(size, MOAT_COL, GATE_ROW, 3) : '',
    tint(moves),
    tint(helps),
    tint(targets),
    active ? hexPath(size, active.col, active.row, 1) : '',
    ...standingWalls.map((piece) => hexPath(size, piece.col, piece.row, 1)),
  ]);

  return (
    <View style={[styles.frame, { width, height }]}>
      <Canvas style={{ width, height }}>
        {/* A siege: field outside, paved courtyard inside, the tower strip on the right. In the field: grass all across. */}
        <Rect x={0} y={0} width={width} height={height} color="#5f7046" />
        {field ? (
          <Path path={scrub} color="#4c5d36" />
        ) : (
          <Group>
            <Rect x={courtyard} y={0} width={fieldWidth - courtyard} height={height} color="#7a7158" />
            <Rect x={fieldWidth} y={0} width={width - fieldWidth} height={height} color="#4a4535" />
          </Group>
        )}
        {moat.length > 0 && <Path path={moatPath} color="#3f6f8a" />}
        {bridge && <Path path={bridgePath} color="#8c6a3c" />}
        <Path path={grid} style="stroke" strokeWidth={1} color="rgba(20, 24, 18, 0.35)" />

        {moves.length > 0 && <Path path={movesPath} color="rgba(120, 170, 220, 0.35)" />}
        {helps.length > 0 && <Path path={helpsPath} color="rgba(150, 210, 120, 0.45)" />}
        {targets.length > 0 && <Path path={targetsPath} style="stroke" strokeWidth={2.5} color="#e8604a" />}

        {battle.walls.map((piece) => {
          const center = hexCenter(size, piece.col, piece.row);
          const standing = piece.hp > 0;
          return (
            <Group key={`${String(piece.col)}-${String(piece.row)}`}>
              {standing ? (
                <Path path={wallPaths[standingWalls.indexOf(piece)]} color={piece.gate ? '#7a5232' : '#9c9a8c'} />
              ) : (
                <Group>
                  <Rect x={center.x - size * 0.5} y={center.y} width={size * 0.4} height={size * 0.3} color="#7f7d71" />
                  <Rect x={center.x + size * 0.05} y={center.y + size * 0.1} width={size * 0.35} height={size * 0.25} color="#6c6a5f" />
                </Group>
              )}
              {standing && piece.gate && <Rect x={center.x - 1} y={center.y - size * 0.6} width={2} height={size * 1.2} color="#4a3220" />}
              {standing && !piece.gate && <Rect x={center.x - size * 0.6} y={center.y} width={size * 1.2} height={1.5} color="#6c6a5f" />}
              {standing && piece.hp < piece.maxHp && (
                <Group>
                  <Rect x={center.x - size * 0.6} y={center.y - size * 0.75} width={size * 1.2} height={3} color="#1d211b" />
                  <Rect x={center.x - size * 0.6} y={center.y - size * 0.75} width={size * 1.2 * (piece.hp / piece.maxHp)} height={3} color="#e9c475" />
                </Group>
              )}
            </Group>
          );
        })}

        {/* Towers: one per tower the hold has built */}
        {Array.from({ length: battle.towers }, (_, index) => {
          const step = height / Math.max(1, battle.towers);
          const x = fieldWidth + (width - fieldWidth) / 2 - size * 0.45;
          const y = step * index + step / 2 - size * 0.7;
          return (
            <Group key={index}>
              <Rect x={x} y={y} width={size * 0.9} height={size * 1.4} color="#9c9a8c" />
              <Rect x={x - 2} y={y - 3} width={size * 0.9 + 4} height={4} color="#7f7d71" />
              <Rect x={x + size * 0.35} y={y + size * 0.4} width={size * 0.2} height={size * 0.35} color="#2a2620" />
            </Group>
          );
        })}

        {active && <Path path={activePath} style="stroke" strokeWidth={2.5} color="#f3d27a" />}

        {/* The stacks, walking and striking as the last action plays (and those it cut down, until they fall) */}
        {battle.stacks.map((stack) => {
          const track = playback.tracks[stack.id] as Track | undefined;
          if (!track || (!isAlive(stack) && track.fallsAt === Infinity)) return null;
          return <StackSprite key={stack.id} unit={stack.unit} size={size} mirror={stack.side === 'defender'} track={track} progress={progress} />;
        })}

        {/* Shots, boulders and spells in flight, and the flash where each hit lands */}
        {playback.strikes.map((strike, index) => (
          <StrikeMark key={index} strike={strike} size={size} progress={progress} />
        ))}
      </Canvas>
    </View>
  );
}

// A stack on the board: its creature where its track has it now, fading as it falls.
const StackSprite = memo(function StackSprite({ unit, size, mirror, track, progress }: { unit: UnitId; size: number; mirror: boolean; track: Track; progress: SharedValue<number> }) {
  const transform = useDerivedValue(() => {
    const [x, y] = trackPose(track, progress.get());
    return [{ translateX: x }, { translateY: y }];
  }, [track]);
  const opacity = useDerivedValue(() => trackOpacity(track, progress.get()), [track]);
  return (
    <Group transform={transform} opacity={opacity}>
      <UnitSprite unit={unit} size={size} mirror={mirror} />
    </Group>
  );
});

// A shot or spell flying to its target (gold arrows and boulders, green healing), then the hit's flash.
const StrikeMark = memo(function StrikeMark({ strike, size, progress }: { strike: Strike; size: number; progress: SharedValue<number> }) {
  const flight = useDerivedValue(() => strikeFlight(strike, progress.get()), [strike]);
  const cx = useDerivedValue(() => flight.get()[0]);
  const cy = useDerivedValue(() => flight.get()[1]);
  const flying = useDerivedValue(() => flight.get()[2]);
  const flash = useDerivedValue(() => strikeFlash(strike, progress.get()) * 0.8, [strike]);
  const color = strike.heal ? '#9fe08a' : '#f3d27a';
  return (
    <Group>
      {strike.flies && <Circle cx={cx} cy={cy} r={Math.max(2, size * 0.13)} color={color} opacity={flying} />}
      <Circle cx={strike.x1} cy={strike.y1 - size * 0.2} r={size * 0.62} color={strike.heal ? '#9fe08a' : '#ff5a3c'} opacity={flash} />
    </Group>
  );
});

// A creature drawn as pixels, standing on the origin (its hex centre). The hold's units face left (towards
// the raiders).
const UnitSprite = memo(function UnitSprite({ unit, size, mirror }: { unit: UnitId; size: number; mirror: boolean }) {
  const pixel = (size * 1.45) / SPRITE_SIZE;
  const left = -(SPRITE_SIZE / 2) * pixel;
  const top = -SPRITE_SIZE * 0.62 * pixel;
  const runs = useMemo(() => spriteRuns(unit, mirror), [unit, mirror]);
  return (
    <Group>
      {runs.map((run, index) => (
        <Rect key={index} x={left + run.x * pixel} y={top + run.y * pixel} width={run.w * pixel + 0.3} height={pixel + 0.3} color={run.color} />
      ))}
    </Group>
  );
});

export default memo(BattleBoardCanvas);

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
});
