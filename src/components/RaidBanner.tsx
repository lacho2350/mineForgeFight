import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SIDE_NAMES } from '../game/cityMap';
import { describeParty, holdPowerOf, raidBattleKind, useGameStore } from '../game/gameStore';
import { partyValue, raidKind, raidRelief, raidSide, raidStrength } from '../game/raids';
import { trapsFacing } from '../game/traps';
import { UNIT_STATS, type ArmyUnit } from '../game/units';
import { GameButton } from './GameUI';

const clock = (seconds: number) => `${String(Math.floor(seconds / 60))}:${String(Math.max(0, seconds % 60)).padStart(2, '0')}`;

// Raid status for the top of a screen: the countdown, raiders sighted (a raiding party in the fields, or a
// siege army — which the hold can ride out to meet), a battle under way, or the result; with the
// auto-resolver (fight raids out at once) and a button to resolve a battle without opening it. In the War
// panel (`inPanel`) the panel shows the auto-resolve switch itself, so the banner leaves it out.
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
  const traps = useGameStore((state) => state.traps);
  const autoResolve = useGameStore((state) => state.autoResolveRaids);
  const { dismissRaidReport, setRideOut, setAutoResolveRaids, quickResolveBattle } = useGameStore.getState();
  const autoSwitch = inPanel ? null : (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: autoResolve }}
      accessibilityLabel="Auto-resolve raids"
      onPress={() => setAutoResolveRaids(!autoResolve)}
      hitSlop={6}
      style={styles.switch}
    >
      <Text style={[styles.switchText, autoResolve && styles.switchOn]}>{autoResolve ? '☑' : '☐'} AUTO-RESOLVE RAIDS</Text>
    </Pressable>
  );

  if (battle?.status === 'active') {
    const field = battle.kind === 'field';
    return (
      <View style={[styles.banner, styles.alarm, inPanel && styles.inPanel]}>
        <View style={styles.copy}>
          <Text style={styles.alarmTitle}>{field ? 'BATTLE IN THE FIELD' : 'RAIDERS AT THE GATE'}</Text>
          <Text style={styles.detail}>{raid ? describeParty(raid.party) : `Raid ${String(battle.raid)}`}</Text>
          <Text style={styles.detail}>{commanded ? 'Battle in progress: your orders are awaited.' : `${field ? 'The army' : 'The defence'} fights on its own in ${String(Math.max(0, deadline - elapsed))} s.`}</Text>
        </View>
        <View style={styles.action}>
          <GameButton label={commanded ? 'TO THE BATTLE' : field ? 'COMMAND THE ARMY' : 'COMMAND THE DEFENCE'} detail="" onPress={() => router.push('/battle')} />
          <View style={styles.gap} />
          <GameButton label="AUTO-RESOLVE" detail="fight it out now" onPress={quickResolveBattle} secondary />
        </View>
      </View>
    );
  }
  if (raid) {
    const side = raidSide(raid.number);
    const facing = trapsFacing(traps, side).length;
    const where = raidBattleKind(raid);
    return (
      <View style={[styles.banner, styles.warning, inPanel && styles.inPanel]}>
        <View style={styles.copy}>
          <Text style={styles.warningTitle}>
            {raid.kind === 'field' ? 'RAIDERS IN THE FIELDS' : 'SIEGE ARMY SIGHTED'} TO THE {SIDE_NAMES[side].toUpperCase()} · {where === 'field' ? 'BATTLE' : 'ATTACK'} IN {clock(raid.arrivesAt - elapsed)}
          </Text>
          <Text style={styles.detail}>
            {describeParty(raid.party)} · strength {partyValue(raid.party).toLocaleString()} vs {where === 'field' ? `your army’s ${armyPower.toLocaleString()}` : `your hold’s power ${power.toLocaleString()}`}
          </Text>
          <Text style={styles.detail}>
            {where === 'field'
              ? `${raid.kind === 'field' ? 'A raiding party: the army meets it in the open.' : 'The army rides out to meet them.'} Troops only — no walls, towers, moat or traps. Beaten, the hold loses half as much; winning pays half again the bounty.`
              : `They’ll storm the walls: walls, gate, towers, oil, moat and traps all fight. ${facing > 0 ? `${String(facing)} trap${facing === 1 ? '' : 's'} on that side of the belt.` : 'No traps on that side of the belt yet (BUILD → Traps).'}`}
          </Text>
          {autoSwitch}
        </View>
        {raid.kind === 'siege' && (
          <View style={styles.action}>
            <GameButton
              label={raid.rideOut ? 'HOLD THE WALLS' : 'RIDE OUT TO MEET THEM'}
              detail={raid.rideOut ? 'fight behind your defences' : 'fight in the field, troops only'}
              onPress={() => setRideOut(!raid.rideOut)}
              secondary
            />
          </View>
        )}
      </View>
    );
  }
  const nextField = raidKind(raidsFought + 1) === 'field';
  // When the next raid comes, what it will be and how strong (sized like the real thing: a raiding party to the army alone).
  const nextRaid = (
    <Text style={styles.detail}>
      Next raid ({String(raidsFought + 1)}) in {clock(nextRaidAt - elapsed)}: {nextField ? 'a raiding party in the fields' : 'a siege army'} · expected strength{' '}
      {raidStrength(raidsFought + 1, nextField ? armyPower : power, lostInARow).toLocaleString()} (it grows with your {nextField ? 'army' : 'hold'}
      {lostInARow > 0 ? `, ${String(Math.round((1 - raidRelief(lostInARow)) * 100))}% smaller after ${String(lostInARow)} lost in a row` : ''}) ·{' '}
      {nextField ? `your army’s ${armyPower.toLocaleString()}` : `your hold’s power ${power.toLocaleString()}`}
    </Text>
  );
  if (battle) {
    return (
      <View style={[styles.banner, inPanel && styles.inPanel]}>
        <View style={styles.copy}>
          <Text style={styles.title}>The battle is over.</Text>
          {nextRaid}
        </View>
        <View style={styles.action}>
          <GameButton label="SEE THE RESULT" detail="" onPress={() => router.push('/battle')} secondary />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.banner, inPanel && styles.inPanel]}>
      <View style={styles.copy}>
        {report ? (
          <Text style={[styles.title, report.outcome === 'lost' && styles.lost]}>
            Raid {String(report.number)}{report.kind === 'field' ? ' (in the field)' : ''}: {report.outcome === 'won' ? `victory, +${String(report.bounty)} gold` : report.outcome === 'lost' ? `defeat, ${String(report.plundered?.gold ?? 0)} gold plundered` : 'the raiders withdrew'}
            {report.trapKills ? ` · traps slew ${String(report.trapKills)}` : ''}
            {Object.keys(report.losses).length > 0
              ? ` · fallen: ${(Object.entries(report.losses) as [ArmyUnit, number][]).map(([unit, count]) => `${String(count)} ${UNIT_STATS[unit].plural.toLowerCase()}`).join(', ')}`
              : ''}
          </Text>
        ) : null}
        {nextRaid}
        {autoSwitch}
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
  gap: { height: 6 },
  inPanel: { marginBottom: 0 },
  switch: { alignSelf: 'flex-start', paddingVertical: 4 },
  switchText: { color: '#a9ad99', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  switchOn: { color: '#e9c475' },
  dismiss: { paddingHorizontal: 8, paddingVertical: 2 },
  dismissText: { color: '#a9ad99', fontFamily: 'monospace', fontSize: 16 },
});
