import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  actionForHex,
  attackOf,
  currentStack,
  damageRange,
  defenceOf,
  fallenAllies,
  hexKey,
  isAlive,
  isPlayerTurn,
  reachable,
  stackCount,
  type Battle,
  type Stack,
} from '../game/combat';
import { useGameStore, type RaidReport } from '../game/gameStore';
import { UNIT_STATS, type ArmyUnit } from '../game/units';
import BattleBoard from '../components/BattleBoard';
import { boardLayout, hexAt, hexCenter } from '../components/battleLayout';
import { GameButton, SectionLabel } from '../components/GameUI';

// What the active stack could do: tinted hexes and the damage it would deal to each target.
function playerOptions(battle: Battle) {
  const stack = currentStack(battle);
  const empty = { moves: [] as number[], targets: [] as number[], helps: [] as number[], previews: new Map<number, string>() };
  if (!stack || !isPlayerTurn(battle)) return empty;
  const reach = reachable(battle, stack);
  const result = { ...empty, moves: [...reach.keys()].filter((key) => key !== hexKey(stack.col, stack.row)) };
  for (const other of battle.stacks.filter(isAlive)) {
    const action = actionForHex(battle, other);
    if (!action) continue;
    const key = hexKey(other.col, other.row);
    if (action.type === 'heal' || action.type === 'resurrect') {
      result.helps.push(key);
    } else if (action.type === 'shoot' || action.type === 'melee') {
      result.targets.push(key);
      const moved = action.type === 'melee' ? reach.get(hexKey(action.from.col, action.from.row)) : 0;
      const range = damageRange(battle, stack, other, { ranged: action.type === 'shoot', moved });
      const span = (min: number, max: number) => (min === max ? String(min) : `${String(min)}–${String(max)}`);
      result.previews.set(other.id, `${span(range.min, range.max)} · ☠${span(range.kills.min, range.kills.max)}`);
    }
  }
  return result;
}

export default function BattleScreen() {
  const battle = useGameStore((state) => state.battle);
  const report = useGameStore((state) => state.raidReport);
  const { commandBattle, battleAct, battleStep, setBattleAuto, quickResolveBattle, closeBattle } = useGameStore.getState();
  const [frameWidth, setFrameWidth] = useState(0);
  // Hexes stay big enough to tap; small phones scroll the field sideways.
  const layout = boardLayout(frameWidth || 360, 34, 17);
  const small = layout.size < 22;

  // Opening the battlefield takes command: the battle now waits for orders.
  useEffect(() => {
    commandBattle();
  }, [commandBattle]);

  // The raiders (and the hold's army in auto-battle) act on their own, one move at a time.
  useEffect(() => {
    if (!battle || battle.status !== 'active' || isPlayerTurn(battle)) return;
    const timer = setTimeout(battleStep, battle.auto ? 200 : 550);
    return () => clearTimeout(timer);
  }, [battle, battleStep]);

  const options = useMemo(() => (battle ? playerOptions(battle) : null), [battle]);
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd((event) => {
          const current = useGameStore.getState().battle;
          if (!current || !isPlayerTurn(current)) return;
          const hex = hexAt(layout.size, event.x, event.y);
          const action = hex && actionForHex(current, hex);
          if (action) battleAct(action);
        }),
    [layout.size, battleAct],
  );

  const leave = () => {
    closeBattle();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const stack = battle ? currentStack(battle) : null;
  const playerTurn = !!battle && isPlayerTurn(battle);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.page} onLayout={({ nativeEvent }) => nativeEvent.layout.width > 0 && setFrameWidth(nativeEvent.layout.width)}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.back}>
              <Text style={styles.backText}>‹  HOLD</Text>
            </Pressable>
            <Text style={styles.title}>{battle ? `Raid ${String(battle.raid)}` : 'The gate'}</Text>
            <Text style={styles.round}>{battle && battle.status === 'active' ? `ROUND ${String(battle.round)}` : ''}</Text>
          </View>

          {!battle ? (
            <View style={styles.card}>
              {report ? <ReportCard report={report} /> : <Text style={styles.cardText}>No raiders at the gate.</Text>}
              <GameButton label="RETURN TO THE HOLD" detail="" onPress={leave} />
            </View>
          ) : (
            <>
              <ScrollView horizontal scrollEnabled={layout.width > frameWidth} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boardScroll}>
              <GestureDetector gesture={tap}>
                <View style={[styles.board, { width: layout.width, height: layout.height }]}>
                  <BattleBoard battle={battle} layout={layout} moves={options?.moves ?? []} targets={options?.targets ?? []} helps={options?.helps ?? []} />
                  {battle.stacks.filter(isAlive).map((item) => (
                    <StackLabel key={item.id} stack={item} size={layout.size} small={small} preview={options?.previews.get(item.id)} />
                  ))}
                  {battle.last.map((event, index) => {
                    if (event.target === undefined || !event.to || (event.damage === undefined && event.kind !== 'heal' && event.kind !== 'resurrect')) return null;
                    const center = hexCenter(layout.size, event.to.col, event.to.row);
                    const healing = event.kind === 'heal' || event.kind === 'resurrect';
                    return (
                      <Text
                        key={`${String(battle.log.length)}-${String(index)}`}
                        pointerEvents="none"
                        style={[styles.floater, { left: center.x - 30, top: center.y - layout.size * 1.6 - index * 12 }, healing && styles.floaterHeal]}
                      >
                        {healing ? '✚' : `−${String(event.damage)}`}
                      </Text>
                    );
                  })}
                </View>
              </GestureDetector>
              </ScrollView>

              {battle.status === 'active' ? (
                <View style={styles.controls}>
                  <View style={styles.turn}>
                    <Text style={[styles.turnText, playerTurn ? styles.turnYours : styles.turnTheirs]}>
                      {playerTurn ? 'YOUR MOVE' : battle.auto ? 'AUTO-BATTLE' : 'RAIDERS MOVE…'}
                    </Text>
                    {playerTurn && <Text style={styles.hint}>Tap a blue hex to move, a red-ringed enemy to attack{stack && (UNIT_STATS[stack.unit].heals || UNIT_STATS[stack.unit].resurrects) ? ', a green ally to heal' : ''}.</Text>}
                  </View>
                  {stack && <StackCard battle={battle} stack={stack} />}
                  <View style={styles.buttons}>
                    {playerTurn && (
                      <View style={styles.button}>
                        <GameButton label="DEFEND" detail="+30% defence" onPress={() => battleAct({ type: 'defend' })} secondary />
                      </View>
                    )}
                    {playerTurn && fallenAllies(battle).map((fallen) => (
                      <View key={fallen.id} style={styles.button}>
                        <GameButton label={`RAISE ${UNIT_STATS[fallen.unit].plural.toUpperCase()}`} detail="resurrect" onPress={() => battleAct({ type: 'resurrect', target: fallen.id })} secondary />
                      </View>
                    ))}
                    <View style={styles.button}>
                      <GameButton label={battle.auto ? 'TAKE COMMAND' : 'AUTO-BATTLE'} detail={battle.auto ? 'give orders' : 'AI commands'} onPress={() => setBattleAuto(!battle.auto)} secondary />
                    </View>
                    <View style={styles.button}>
                      <GameButton label="QUICK RESOLVE" detail="finish now" onPress={quickResolveBattle} secondary />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.card}>
                  {report && <ReportCard report={report} />}
                  <GameButton label="RETURN TO THE HOLD" detail="" onPress={leave} />
                </View>
              )}

              <View style={styles.log}>
                <SectionLabel>BATTLE LOG</SectionLabel>
                {battle.log.slice(-8).reverse().map((event, index) => (
                  <Text
                    key={battle.log.length - index}
                    style={[styles.logLine, event.kind === 'round' && styles.logRound, (event.kind === 'trap' || event.kind === 'oil' || event.kind === 'moat') && styles.logTrap, index === 0 && styles.logLatest]}
                  >
                    {event.text}
                  </Text>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Count badge under each stack (blue for the hold, red for raiders), and the damage preview over targets.
function StackLabel({ stack, size, small, preview }: { stack: Stack; size: number; small: boolean; preview?: string }) {
  const center = hexCenter(size, stack.col, stack.row);
  return (
    <>
      <Text
        pointerEvents="none"
        style={[styles.count, stack.side === 'defender' ? styles.countHold : styles.countRaider, { left: center.x - 2, top: center.y + size * 0.35 }]}
      >
        {String(stackCount(stack))}
      </Text>
      {preview && (
        <Text pointerEvents="none" style={[styles.preview, small && styles.previewSmall, { left: Math.max(0, center.x - (small ? 28 : 40)), top: center.y - size * 1.25 }]}>
          {preview}
        </Text>
      )}
    </>
  );
}

function StackCard({ battle, stack }: { battle: Battle; stack: Stack }) {
  const stats = UNIT_STATS[stack.unit];
  const count = stackCount(stack);
  const topHp = stack.hp - (count - 1) * stats.hp;
  return (
    <View style={styles.stackCard}>
      <View style={styles.stackHeader}>
        <Text style={styles.stackName}>
          {String(count)} {count === 1 ? stats.name : stats.plural}
        </Text>
        <Text style={[styles.stackSide, stack.side === 'defender' ? styles.sideHold : styles.sideRaider]}>{stack.side === 'defender' ? 'THE HOLD' : 'RAIDERS'}</Text>
      </View>
      <Text style={styles.stackStats}>
        ATK {String(attackOf(battle, stack))} · DEF {String(defenceOf(battle, stack))} · DMG {String(stats.minDamage)}–{String(stats.maxDamage)} · HP {String(topHp)}/{String(stats.hp)} · SPD {String(stats.speed)}
        {stats.shots ? ` · SHOTS ${String(stack.shots)}` : ''}
      </Text>
      <Text style={styles.ability}>{stats.ability}</Text>
    </View>
  );
}

function ReportCard({ report }: { report: RaidReport }) {
  const title = report.outcome === 'won' ? 'Victory!' : report.outcome === 'lost' ? 'The hold has fallen' : 'The raiders withdrew';
  const losses = Object.entries(report.losses) as [ArmyUnit, number][];
  return (
    <View style={styles.report}>
      <Text style={[styles.reportTitle, report.outcome === 'lost' && styles.reportLost]}>{title}</Text>
      <Text style={styles.cardText}>
        Raiders slain: {String(report.slain)}
        {report.trapKills ? ` (${String(report.trapKills)} by traps)` : ''}
      </Text>
      {report.bounty > 0 && <Text style={styles.cardText}>Bounty: +{String(report.bounty)} gold</Text>}
      {report.plundered && <Text style={styles.cardText}>Plundered: {String(report.plundered.gold)} gold and 30% of every stockpile</Text>}
      <Text style={styles.cardText}>
        {losses.length === 0 ? 'No losses.' : `Fallen: ${losses.map(([unit, count]) => `${String(count)} ${(count === 1 ? UNIT_STATS[unit].name : UNIT_STATS[unit].plural).toLowerCase()}`).join(', ')}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111410' },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 12, paddingTop: 16, paddingBottom: 26 },
  page: { width: '100%', maxWidth: 1000, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#394238' },
  backText: { color: '#c6cdaf', fontFamily: 'monospace', fontSize: 10 },
  title: { flex: 1, color: '#f0ead8', fontFamily: 'Georgia', fontSize: 24, fontWeight: 'bold' },
  round: { color: '#d2a45f', fontFamily: 'monospace', fontSize: 10 },
  board: { position: 'relative', alignSelf: 'center', borderWidth: 1, borderColor: '#657052' },
  count: {
    position: 'absolute',
    minWidth: 20,
    paddingHorizontal: 3,
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    color: '#f0ead8',
  },
  countHold: { backgroundColor: 'rgba(40, 70, 120, 0.92)' },
  countRaider: { backgroundColor: 'rgba(130, 40, 32, 0.92)' },
  preview: {
    position: 'absolute',
    width: 80,
    textAlign: 'center',
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    color: '#ffe3d6',
    backgroundColor: 'rgba(60, 20, 16, 0.85)',
  },
  previewSmall: { width: 56, fontSize: 7 },
  boardScroll: { flexGrow: 1, justifyContent: 'center' },
  floater: { position: 'absolute', width: 60, textAlign: 'center', fontFamily: 'monospace', fontSize: 13, fontWeight: '700', color: '#ff7a5c' },
  floaterHeal: { color: '#9fe08a' },
  controls: { gap: 10 },
  turn: { gap: 4 },
  turnText: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700' },
  turnYours: { color: '#c0cd83' },
  turnTheirs: { color: '#e08a72' },
  hint: { color: '#a3a893', fontFamily: 'monospace', fontSize: 9 },
  stackCard: { gap: 4, padding: 10, borderWidth: 1, borderColor: '#4a5240', backgroundColor: '#171c16' },
  stackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  stackName: { color: '#f0ead8', fontFamily: 'Georgia', fontSize: 16, fontWeight: 'bold' },
  stackSide: { fontFamily: 'monospace', fontSize: 9 },
  sideHold: { color: '#8fb0e0' },
  sideRaider: { color: '#e08a72' },
  stackStats: { color: '#c9c4b2', fontFamily: 'monospace', fontSize: 9 },
  ability: { color: '#a3a893', fontFamily: 'Georgia', fontSize: 12 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { flexGrow: 1, flexBasis: 160 },
  card: { gap: 12, padding: 14, borderWidth: 1, borderColor: '#4a5240', backgroundColor: '#171c16' },
  cardText: { color: '#c9c4b2', fontFamily: 'monospace', fontSize: 10 },
  report: { gap: 6 },
  reportTitle: { color: '#c0cd83', fontFamily: 'Georgia', fontSize: 22, fontWeight: 'bold' },
  reportLost: { color: '#e08a72' },
  log: { gap: 4, paddingTop: 6 },
  logLine: { color: '#8d947e', fontFamily: 'monospace', fontSize: 9 },
  logRound: { color: '#d2a45f' },
  logTrap: { color: '#c9a66b' },
  logLatest: { color: '#e6dfcb' },
});
