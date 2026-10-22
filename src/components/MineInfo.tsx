import { StyleSheet, Text, View } from 'react-native';
import type { GameState } from '../game/state';
import { MINE_RESOURCES, RESOURCE_INFO } from '../game/resources';
import { MINE_BUILDINGS, buildingNow } from './mineBuildingStatus';
import { GameButton, SectionLabel } from './GameUI';

const toneColor = { busy: '#9fd27a', quiet: '#e3c38a', stuck: '#f08a6e' } as const;

// The mine's pop-up in the city (tap the headframe): what the mine is for, what its buildings are doing
// now (the same lines as their cards down the mine), what it holds ready for the city, and the way down.
export default function MineInfo({ game, onGoDown }: { game: GameState; onGoDown: () => void }) {
  const held = MINE_RESOURCES.filter((resource) => game.mineStock[resource] + game.mineExit[resource] >= 1);
  return (
    <View style={styles.body}>
      <Text style={styles.role}>
        The mine under the mountain: miners cut ore at the faces, carts bring it up the lift to the exit warehouses, and haulers carry it to the mine storehouse and on to the city’s warehouse.
      </Text>
      {(['headhouse', 'cottage', 'storehouse'] as const).map((building) => {
        const { rows, status } = buildingNow(building, game);
        return (
          <View key={building} style={styles.section}>
            <Text style={styles.name}>
              {MINE_BUILDINGS[building].icon} {MINE_BUILDINGS[building].name}
            </Text>
            <Text style={[styles.status, { color: toneColor[status.tone] }]}>{status.text}</Text>
            <View style={styles.rows}>
              {rows.map((row) => (
                <View key={row.label} style={styles.row}>
                  <SectionLabel>{row.label}</SectionLabel>
                  <Text style={styles.value}>{row.value}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
      {held.length > 0 && (
        <View style={styles.section}>
          <SectionLabel>AT THE MINE (EXIT WAREHOUSES + STOREHOUSE)</SectionLabel>
          <Text style={styles.value}>
            {held.map((resource) => `${Math.floor(game.mineExit[resource] + game.mineStock[resource]).toLocaleString()} ${RESOURCE_INFO[resource].name.toLowerCase()}`).join(' · ')}
          </Text>
        </View>
      )}
      <GameButton label="GO DOWN THE MINE" detail="Dig, survey and put miners to work" onPress={onGoDown} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  role: { color: '#b9b5a6', fontSize: 13, lineHeight: 18 },
  section: { gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#2c3329' },
  name: { color: '#e7e1d0', fontFamily: 'Georgia', fontSize: 15 },
  status: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  rows: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  row: { flexGrow: 1, flexBasis: 120, gap: 2 },
  value: { color: '#ffd166', fontFamily: 'monospace', fontSize: 13, fontWeight: '700' },
});
