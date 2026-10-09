import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SIDE_NAMES } from '../game/cityMap';
import { raidBattleKind } from '../game/state';
import { describeParty, holdPowerOf } from '../game/hold';
import { useGameStore } from '../game/gameStore';
import { partyValue, raidKind, raidRelief, raidSide, raidStrength } from '../game/raids';
import { GameButton } from './GameUI';

const clock = (seconds: number) => `${String(Math.floor(seconds / 60))}:${String(Math.max(0, seconds % 60)).padStart(2, '0')}`;

// Raid status for the top of a screen, kept short: the countdown, raiders sighted (a raiding party in the
// fields, or a siege army — which the hold can ride out to meet), a battle under way, or the result, with a
// button to resolve a battle without opening it. The rules, the trap count and the auto-resolve switch are
// in the War panel.
export default function RaidBanner({ inPanel = false }: { inPanel?: boolean }) {
  const elapsed = useGameStore((state) => state.elapsedSeconds);
  const raid = useGameStore((state) => state.raid);
  const battle = useGameStore((state) => state.battle);
  const commanded = useGameStore((state) => state.battleCommanded);
  const deadline = useGameStore((state) => state.battleDeadline);
  const report = useGameStore((state) => state.raidReport);
  const nextRaidAt = useGameStore((state) => state.nextRaidAt);
  const raidsFought = useGameStore((state) => state.raidsFought);
  const lostInARow = useGameStore((state) => state.raidsLostInARow);
  // Raids are sized to the hold's power: a siege to the army and the defences, a raid in the fields to the army alone.
  const power = useGameStore((state) => holdPowerOf(state).total);
  const armyPower = useGameStore((state) => holdPowerOf(state).army);
  const { dismissRaidReport, setRideOut, quickResolveBattle } = useGameStore.getState();

  if (battle?.status === 'active') {
    const field = battle.kind === 'field';
    return (
      <View style={[styles.banner, styles.alarm, inPanel && styles.inPanel]}>
        <View style={styles.copy}>
          <Text style={styles.alarmTitle}>{field ? 'BATTLE IN THE FIELD' : 'RAIDERS AT THE GATE'}</Text>
          <Text style={styles.detail}>
            {raid ? describeParty(raid.party) : `Raid ${String(battle.raid)}`} · {commanded ? 'your orders' : `auto in ${String(Math.max(0, deadline - elapsed))} s`}
          </Text>
        </View>
        <View style={styles.action}>
          <GameButton label={commanded ? 'TO THE BATTLE' : 'COMMAND'} detail="" onPress={() => router.push('/battle')} />
          <View style={styles.gap} />
          <GameButton label="AUTO-RESOLVE" detail="" onPress={quickResolveBattle} secondary />
        </View>
      </View>
    );
  }
  if (raid) {
    const side = raidSide(raid.number);
    const where = raidBattleKind(raid);
    return (
      <View style={[styles.banner, styles.warning, inPanel && styles.inPanel]}>
        <View style={styles.copy}>
          <Text style={styles.warningTitle}>
            {raid.kind === 'field' ? 'RAIDERS' : 'SIEGE'} · {SIDE_NAMES[side].toUpperCase()} · {clock(raid.arrivesAt - elapsed)}
          </Text>
          <Text style={styles.detail}>
            {describeParty(raid.party)} · {partyValue(raid.party).toLocaleString()} vs {(where === 'field' ? armyPower : power).toLocaleString()}
          </Text>
        </View>
        {raid.kind === 'siege' && (
          <View style={styles.action}>
            <GameButton label={raid.rideOut ? 'HOLD THE WALLS' : 'RIDE OUT'} detail="" onPress={() => setRideOut(!raid.rideOut)} secondary />
          </View>
        )}
      </View>
    );
  }
  const nextField = raidKind(raidsFought + 1) === 'field';
  // When the next raid comes, what it will be and how strong (sized like the real thing: a raiding party to
  // the army alone). The War panel also says how much smaller raids come after a losing streak.
  const nextRaid = (
    <Text style={styles.detail}>
      Raid {String(raidsFought + 1)} in {clock(nextRaidAt - elapsed)} · {nextField ? 'raiders' : 'siege'} · ~
      {raidStrength(raidsFought + 1, nextField ? armyPower : power, lostInARow).toLocaleString()} vs {(nextField ? armyPower : power).toLocaleString()}
      {inPanel && lostInARow > 0 ? ` · ${String(Math.round((1 - raidRelief(lostInARow)) * 100))}% smaller after ${String(lostInARow)} lost` : ''}
    </Text>
  );
  if (battle) {
    return (
      <View style={[styles.banner, inPanel && styles.inPanel]}>
        <View style={styles.copy}>
          <Text style={styles.title}>Battle over</Text>
          {nextRaid}
        </View>
        <View style={styles.action}>
          <GameButton label="RESULT" detail="" onPress={() => router.push('/battle')} secondary />
        </View>
      </View>
    );
  }
  const fallen = report ? Object.values(report.losses).reduce((sum, count) => sum + (count ?? 0), 0) : 0;
  return (
    <View style={[styles.banner, inPanel && styles.inPanel]}>
      <View style={styles.copy}>
        {report ? (
          <Text style={[styles.title, report.outcome === 'lost' && styles.lost]}>
            Raid {String(report.number)}: {report.outcome === 'won' ? `won, +${String(report.bounty)} gold` : report.outcome === 'lost' ? `lost, −${String(report.plundered?.gold ?? 0)} gold` : 'they withdrew'}
            {fallen > 0 ? ` · ${String(fallen)} fallen` : ''}
          </Text>
        ) : null}
        {nextRaid}
      </View>
      {report && (
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss the raid report" onPress={dismissRaidReport} style={styles.dismiss}>
          <Text style={styles.dismissText}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: 10, marginBottom: 16, borderLeftWidth: 2, borderLeftColor: '#5f6b55', backgroundColor: '#1b2019' },
  alarm: { borderLeftColor: '#e8604a', backgroundColor: '#2a1a16' },
  warning: { borderLeftColor: '#e9c475', backgroundColor: '#25231a' },
  copy: { flex: 1, minWidth: 220, gap: 4 },
  action: { flexGrow: 1, flexBasis: 220, maxWidth: 320 },
  alarmTitle: { color: '#ff8a6c', fontFamily: 'monospace', fontSize: 15, fontWeight: '700' },
  warningTitle: { color: '#e9c475', fontFamily: 'monospace', fontSize: 15, fontWeight: '700' },
  title: { color: '#c0cd83', fontFamily: 'monospace', fontSize: 14 },
  lost: { color: '#e08a72' },
  detail: { color: '#a9ad99', fontFamily: 'monospace', fontSize: 13 },
  gap: { height: 6 },
  inPanel: { marginBottom: 0 },
  dismiss: { paddingHorizontal: 8, paddingVertical: 2 },
  dismissText: { color: '#a9ad99', fontFamily: 'monospace', fontSize: 20 },
});
