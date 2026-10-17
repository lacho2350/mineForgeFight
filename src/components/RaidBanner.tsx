import { router, useIsFocused } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SIDE_NAMES } from '../game/cityMap';
import { raidBattleKind } from '../game/state';
import { describeParty, holdPowerOf } from '../game/hold';
import { useGame } from '../game/gameStore';
import { partyValue, raidKind, raidRelief, raidSide, raidStrength } from '../game/raids';
import { GameButton } from './GameUI';
import { CAMPAIGN_STAGES } from '../game/campaign';

const clock = (seconds: number) => `${String(Math.floor(seconds / 60))}:${String(Math.max(0, seconds % 60)).padStart(2, '0')}`;

// Raid status for the top of a screen, kept short: the countdown, raiders sighted (a raiding party in the
// fields, or a siege army — which the hold can ride out to meet), a battle under way, or the result, with a
// button to settle a battle at once without opening it. The rules, the trap count and the instant-battles
// switch are in the War panel.
export default function RaidBanner({ inPanel = false }: { inPanel?: boolean }) {
  // The clock changes every tick, so this follows the whole game (while its screen is in sight).
  const game = useGame(useIsFocused());
  const { elapsedSeconds: elapsed, raid, battle, battleCommanded: commanded, battleDeadline: deadline, raidReport: report, nextRaidAt, raidsFought } = game;
  const lostInARow = game.raidsLostInARow;
  // Raids are sized to the hold's power: a siege to the army and the defences, a raid in the fields to the army alone.
  const { total: power, army: armyPower } = holdPowerOf(game);
  const { dismissRaidReport, setRideOut, quickResolveBattle } = game;

  if (battle?.status === 'active') {
    const field = battle.kind === 'field';
    const site = battle.campaign ? CAMPAIGN_STAGES[battle.campaign - 1] : null;
    return (
      <View style={[styles.banner, styles.alarm, inPanel && styles.inPanel]}>
        <View style={styles.copy}>
          <Text style={styles.alarmTitle}>{site ? `THE ARMY FIGHTS AT ${site.title.toUpperCase()}` : field ? 'BATTLE IN THE FIELD' : 'RAIDERS AT THE GATE'}</Text>
          <Text style={styles.detail}>
            {site ? 'the campaign' : raid ? describeParty(raid.party) : `Raid ${String(battle.raid)}`} ·{' '}
            {commanded ? 'your orders' : battle.auto ? `round ${String(battle.round)}, the captains fight it` : `the captains take over in ${String(Math.max(0, Math.ceil(deadline - elapsed)))} s`}
          </Text>
        </View>
        <View style={styles.action}>
          <GameButton label={commanded ? 'TO THE BATTLE' : battle.auto ? 'WATCH' : 'COMMAND'} detail="" onPress={() => router.push('/battle')} />
          <View style={styles.gap} />
          <GameButton label="RESOLVE NOW" detail="" onPress={quickResolveBattle} secondary />
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
            {report.campaign ? (CAMPAIGN_STAGES[report.campaign - 1]?.title ?? 'The campaign') : `Raid ${String(report.number)}`}:{' '}
            {report.outcome === 'won' ? `won, +${String(report.bounty)} gold` : report.outcome === 'lost' ? (report.campaign ? 'the army fell back' : `lost, −${String(report.plundered?.gold ?? 0)} gold`) : report.campaign ? 'a stand-off' : 'they withdrew'}
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
