import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SIDE_NAMES } from '../game/cityMap';
import { describeParty, holdPowerOf, useGameStore } from '../game/gameStore';
import { partyValue, raidRelief, raidSide, raidStrength } from '../game/raids';
import { trapsFacing } from '../game/traps';
import { UNIT_STATS, type ArmyUnit } from '../game/units';
import { GameButton } from './GameUI';

const clock = (seconds: number) => `${String(Math.floor(seconds / 60))}:${String(Math.max(0, seconds % 60)).padStart(2, '0')}`;

// Raid status for the top of a screen: the countdown, raiders sighted, a battle at the gate, or the result.
export default function RaidBanner() {
  const elapsed = useGameStore((state) => state.elapsedSeconds);
  const raid = useGameStore((state) => state.raid);
  const battle = useGameStore((state) => state.battle);
  const commanded = useGameStore((state) => state.battleCommanded);
  const deadline = useGameStore((state) => state.battleDeadline);
  const report = useGameStore((state) => state.raidReport);
  const nextRaidAt = useGameStore((state) => state.nextRaidAt);
  const raidsFought = useGameStore((state) => state.raidsFought);
  const lostInARow = useGameStore((state) => state.raidsLostInARow);
  // Raids are sized to the hold's power (army + defences).
  const power = useGameStore((state) => holdPowerOf(state).total);
  const traps = useGameStore((state) => state.traps);
  const dismissRaidReport = useGameStore((state) => state.dismissRaidReport);

  if (battle?.status === 'active') {
    return (
      <View style={[styles.banner, styles.alarm]}>
        <View style={styles.copy}>
          <Text style={styles.alarmTitle}>RAIDERS AT THE GATE</Text>
          <Text style={styles.detail}>{raid ? describeParty(raid.party) : `Raid ${String(battle.raid)}`}</Text>
          <Text style={styles.detail}>{commanded ? 'Battle in progress: your orders are awaited.' : `The defence fights on its own in ${String(Math.max(0, deadline - elapsed))} s.`}</Text>
        </View>
        <View style={styles.action}>
          <GameButton label={commanded ? 'TO THE BATTLE' : 'COMMAND THE DEFENCE'} detail="" onPress={() => router.push('/battle')} />
        </View>
      </View>
    );
  }
  if (raid) {
    const side = raidSide(raid.number);
    const facing = trapsFacing(traps, side).length;
    return (
      <View style={[styles.banner, styles.warning]}>
        <View style={styles.copy}>
          <Text style={styles.warningTitle}>
            RAIDERS SIGHTED TO THE {SIDE_NAMES[side].toUpperCase()} · ATTACK IN {clock(raid.arrivesAt - elapsed)}
          </Text>
          <Text style={styles.detail}>
            {describeParty(raid.party)} · strength {partyValue(raid.party).toLocaleString()} vs your hold’s power {power.toLocaleString()}
          </Text>
          <Text style={styles.detail}>
            {facing > 0 ? `${String(facing)} trap${facing === 1 ? '' : 's'} on that side of the belt.` : 'No traps on that side of the belt yet (BUILD → Traps).'}
          </Text>
        </View>
      </View>
    );
  }
  if (battle) {
    return (
      <View style={styles.banner}>
        <Text style={[styles.title, styles.copy]}>The battle is over.</Text>
        <View style={styles.action}>
          <GameButton label="SEE THE RESULT" detail="" onPress={() => router.push('/battle')} secondary />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.banner}>
      <View style={styles.copy}>
        {report ? (
          <Text style={[styles.title, report.outcome === 'lost' && styles.lost]}>
            Raid {String(report.number)}: {report.outcome === 'won' ? `victory, +${String(report.bounty)} gold` : report.outcome === 'lost' ? `defeat, ${String(report.plundered?.gold ?? 0)} gold plundered` : 'the raiders withdrew'}
            {report.trapKills ? ` · traps slew ${String(report.trapKills)}` : ''}
            {Object.keys(report.losses).length > 0
              ? ` · fallen: ${(Object.entries(report.losses) as [ArmyUnit, number][]).map(([unit, count]) => `${String(count)} ${UNIT_STATS[unit].plural.toLowerCase()}`).join(', ')}`
              : ''}
          </Text>
        ) : null}
        <Text style={styles.detail}>
          Next raid ({String(raidsFought + 1)}) in {clock(nextRaidAt - elapsed)} · expected strength {raidStrength(raidsFought + 1, power, lostInARow).toLocaleString()} (it grows with your hold
          {lostInARow > 0 ? `, ${String(Math.round((1 - raidRelief(lostInARow)) * 100))}% smaller after ${String(lostInARow)} lost in a row` : ''}) · your hold’s power {power.toLocaleString()}
        </Text>
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
  copy: { flex: 1, minWidth: 220, gap: 3 },
  action: { flexGrow: 1, flexBasis: 220, maxWidth: 320 },
  alarmTitle: { color: '#ff8a6c', fontFamily: 'monospace', fontSize: 11, fontWeight: '700' },
  warningTitle: { color: '#e9c475', fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
  title: { color: '#c0cd83', fontFamily: 'monospace', fontSize: 10 },
  lost: { color: '#e08a72' },
  detail: { color: '#a9ad99', fontFamily: 'monospace', fontSize: 9 },
  dismiss: { paddingHorizontal: 8, paddingVertical: 2 },
  dismissText: { color: '#a9ad99', fontFamily: 'monospace', fontSize: 16 },
});
