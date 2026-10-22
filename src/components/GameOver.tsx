import { StyleSheet, Text, View } from 'react-native';
import type { GameState } from '../game/state';
import { CAMPAIGN_BATTLES } from '../game/campaign';
import { SectionLabel } from './GameUI';
import NewGamePanel from './NewGamePanel';
import Sheet from './Sheet';

const lasted = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${String(hours)} h ${String(minutes)} min` : `${String(minutes)} min`;
};

// A one-life (Hardcore) hold has fallen: how it ended and how far it got, and a new game. It can't be
// closed: the fallen game is over, and only a new one goes on.
export default function GameOver({ game }: { game: GameState }) {
  const { fallen } = game;
  if (!fallen) return null;
  const stats = [
    { label: 'HELD OUT FOR', value: lasted(fallen.at) },
    { label: 'RAIDS FOUGHT', value: String(fallen.raidsFought) },
    { label: 'CAMPAIGN', value: `${String(fallen.campaignWon)} of ${String(CAMPAIGN_BATTLES)} sites` },
  ];
  return (
    <Sheet title="Greyhollow has fallen" subtitle="HARDCORE · ONE LIFE, AND IT IS SPENT" onClose={() => {}}>
      <Text style={styles.reason}>{fallen.reason}</Text>
      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <SectionLabel>{stat.label}</SectionLabel>
            <Text style={styles.value}>{stat.value}</Text>
          </View>
        ))}
      </View>
      <NewGamePanel current={game.difficulty} onStart={game.resetGame} confirm={false} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  reason: { color: '#f0b4a6', fontFamily: 'Georgia', fontSize: 15, lineHeight: 21 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: 110, gap: 2 },
  value: { color: '#ffd166', fontFamily: 'monospace', fontSize: 15, fontWeight: '700' },
});
