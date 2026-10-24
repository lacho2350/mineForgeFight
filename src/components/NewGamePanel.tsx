import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, DIFFICULTY, DIFFICULTY_TONE, type Difficulty } from '../game/difficulty';
import { readUnlocks, subscribeUnlocks } from '../game/unlocks';
import { SectionLabel } from './GameUI';

// Starting a new game: pick how hard (difficulty.ts), then start. Hardcore stays locked until the campaign
// has been won on Nightmare (unlocks.ts). Over a game in progress, starting takes a second tap, since it
// wipes the save; after a fallen Hardcore hold there's nothing left to lose.
export default function NewGamePanel({ current, onStart, confirm = true }: { current?: Difficulty; onStart: (difficulty: Difficulty) => void; confirm?: boolean }) {
  const unlocks = useSyncExternalStore(subscribeUnlocks, readUnlocks);
  const [picked, setPicked] = useState<Difficulty>(current && (current !== 'hardcore' || unlocks.hardcore) ? current : DEFAULT_DIFFICULTY);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  const rules = DIFFICULTY[picked];
  return (
    <View style={styles.panel}>
      <SectionLabel>NEW GAME · HOW HARD?</SectionLabel>
      {unlocks.crowned && <Text style={styles.crown}>👑 Crowned: the war was won on Hardcore.</Text>}
      {DIFFICULTIES.map((difficulty) => {
        const info = DIFFICULTY[difficulty];
        const locked = difficulty === 'hardcore' && !unlocks.hardcore;
        const selected = picked === difficulty;
        return (
          <Pressable
            key={difficulty}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: locked }}
            accessibilityLabel={locked ? `${info.name}: locked. Win the campaign on Nightmare to unlock it.` : `${info.name}: ${info.blurb}`}
            disabled={locked}
            onPress={() => {
              setPicked(difficulty);
              setArmed(false);
            }}
            style={({ pressed }) => [styles.option, selected && { borderColor: DIFFICULTY_TONE[difficulty] }, locked && styles.locked, pressed && styles.pressed]}
          >
            <Text style={[styles.name, { color: locked ? '#6d7364' : DIFFICULTY_TONE[difficulty] }]}>
              {locked ? '🔒 ' : selected ? '● ' : '○ '}
              {info.name}
              {current === difficulty ? '  (this game)' : ''}
            </Text>
            {selected || locked ? <Text style={styles.blurb}>{locked ? 'Win the campaign on Nightmare.' : info.blurb}</Text> : null}
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={armed ? `Confirm: delete this game and start a new one on ${rules.name}` : `Start a new game on ${rules.name}`}
        onPress={() => {
          if (confirm && !armed) return setArmed(true);
          setArmed(false);
          onStart(picked);
        }}
        style={({ pressed }) => [styles.start, armed && styles.startArmed, pressed && styles.pressed]}
      >
        <Text style={[styles.startText, armed && styles.startTextArmed]}>
          {armed ? `TAP AGAIN TO ERASE THIS GAME AND START ON ${rules.name.toUpperCase()}` : `START A NEW GAME ON ${rules.name.toUpperCase()}`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 8 },
  crown: { color: '#e2b84f', fontSize: 13 },
  option: { gap: 2, padding: 10, borderWidth: 1, borderColor: '#2c3329', backgroundColor: '#161b15' },
  locked: { opacity: 0.6 },
  pressed: { opacity: 0.7 },
  name: { fontFamily: 'Georgia', fontSize: 15, fontWeight: 'bold' },
  blurb: { color: '#b9b5a6', fontSize: 12, lineHeight: 17 },
  start: { alignItems: 'center', padding: 12, borderWidth: 1, borderColor: '#5a6150', backgroundColor: '#1d231b' },
  startArmed: { borderColor: '#e0705a', backgroundColor: '#3a1712' },
  startText: { color: '#e7e1d0', fontFamily: 'monospace', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  startTextArmed: { color: '#ffd9d0' },
});
