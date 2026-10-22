import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { GameState } from '../game/state';
import { workforceOf } from '../game/hold';
import { useGameStore } from '../game/gameStore';
import { moodFactors } from '../game/happiness';
import { rulesOf } from '../game/difficulty';
import { TAX_INFO } from '../game/taxes';
import { GameButton, SectionLabel } from './GameUI';
import Sheet from './Sheet';

// The moment the hold's happiness hits 0 and peasants start leaving, a pop-up says so — once each time it
// happens (it comes back only after happiness has climbed to RECOVERED and fallen to 0 again), on the city
// or down the mine, whichever is open: what is dragging the mood down, and what would help.
const RECOVERED = 5;
let warned = false;
const listeners = new Set<() => void>();
const setWarned = (value: boolean) => {
  if (warned === value) return;
  warned = value;
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
// Ready to warn again once the hold has cheered up.
useGameStore.subscribe((state) => {
  if (state.happiness >= RECOVERED) setWarned(false);
});

/** Are peasants leaving now (happiness 0, and more than the keep's household left)? */
const peasantsLeaving = (game: Pick<GameState, 'happiness' | 'population' | 'difficulty'>) => game.happiness <= 0 && game.population > rulesOf(game.difficulty).leaveFloor;

export default function LeavingAlert({ game, onSeeMood }: { game: GameState; onSeeMood?: () => void }) {
  const dismissed = useSyncExternalStore(subscribe, () => warned);
  if (!peasantsLeaving(game) || dismissed) return null;
  const dismiss = () => setWarned(true);
  const hurting = moodFactors({ ...game, staff: workforceOf(game).staff })
    .filter((factor) => factor.perMinute < 0)
    .sort((a, b) => a.perMinute - b.perMinute);
  const taxes = TAX_INFO[game.taxRate];
  const rules = rulesOf(game.difficulty);
  return (
    <Sheet title="Peasants are leaving!" subtitle={`HAPPINESS 0 · ${String(game.population)} PEASANTS LEFT`} onClose={dismiss}>
      <Text style={styles.body}>
        Nobody stays in a hold this wretched: a peasant leaves every {String(rules.leaveSeconds)} seconds — miners and workers too —{' '}
        {rules.leaveFloor > 0 ? `until only the keep’s household of ${String(rules.leaveFloor)} remains` : 'until nobody is left, and on Hardcore an empty hold has fallen'}, and nobody new comes while it lasts.
      </Text>
      {hurting.length > 0 && (
        <View style={styles.list}>
          <SectionLabel>WHAT’S HURTING (POINTS A MINUTE)</SectionLabel>
          {hurting.map((factor) => (
            <Text key={factor.id} style={styles.item}>
              <Text style={styles.points}>{String(factor.perMinute)}</Text> {factor.label}: {factor.detail}
            </Text>
          ))}
        </View>
      )}
      <Text style={styles.body}>
        {game.hungry ? 'Fill the store first: build an orchard or a fishing hut and staff it. ' : ''}Lower the taxes, and build fairgrounds, churches or gardens to lift the mood.
      </Text>
      {taxes.mood <= 0 && (
        <GameButton
          label="NO TAXES"
          detail={`+${String(TAX_INFO.none.mood - taxes.mood)} a minute (now ${taxes.name.toLowerCase()})`}
          onPress={() => {
            game.setTaxRate('none');
            dismiss();
          }}
        />
      )}
      {onSeeMood && (
        <GameButton
          label="SEE HAPPINESS"
          detail="everything moving the mood"
          secondary
          onPress={() => {
            dismiss();
            onSeeMood();
          }}
        />
      )}
      <GameButton label="OK" detail="back to the hold" secondary onPress={dismiss} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { color: '#c9c4b3', fontSize: 13, lineHeight: 19 },
  list: { gap: 4 },
  item: { color: '#c9c4b3', fontSize: 12, lineHeight: 17 },
  points: { color: '#f08a6e', fontFamily: 'monospace', fontWeight: '700' },
});
