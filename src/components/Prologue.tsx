import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameButton } from './GameUI';

// The prologue: how the hold came to be — a realm lost to the Horde, its last people fleeing north into the
// mountains to an abandoned mining town. Shown before a new game (and from the menu), a page at a time.
const PAGES: { icon: string; title: string; text: string }[] = [
  {
    icon: '⚔️',
    title: 'The war is lost',
    text:
      'For three summers the realm of Aldmere held the line against the Horde of the Red Hand. In the fourth, the line broke at Harrowfield: goblins by the thousand, wolf riders at their flanks, ogres swinging tree-trunk clubs, and cyclopes who tore the gates from the walls with their bare hands. The king fell beneath his banner. The capital burned for nine days.',
  },
  {
    icon: '🏔️',
    title: 'North, into the mountains',
    text:
      'Those who could, ran. A captain with no army left to command, and the few pikemen who would not leave him. Miners from the lowland pits. A smith who carried his hammer and nothing else. Farmers, fishers, mothers with children on their backs. They went north over the high pass, where the snow lies all year and the Horde’s wolves would not follow. Not yet.',
  },
  {
    icon: '⛏️',
    title: 'Greyhollow',
    text:
      'Beyond the pass, by a cold, fast river, they found it: a mining town, empty for sixty years. A keep of black timber still stood. A headframe leaned over the old shaft. Rockfalls had buried the streets, the forges were cold, and the walls lay half sunk in rubble. No one had lived there since the last shift came up. It was not safe. But it was hidden, and it would have to do.',
  },
  {
    icon: '💎',
    title: 'What the mountain kept',
    text:
      'The old miners had not taken everything. Coal still ran black in the first seams. Deeper, the foreman read in the town’s crumbling ledgers, lay copper and iron, then gold, and below them stones no one in Aldmere had a name for. “This mountain fed a town once,” he said. “It can feed us. Dig, and we eat. Forge, and we fight.”',
  },
  {
    icon: '🐺',
    title: 'The Horde does not forget',
    text:
      'On the eighth day a harpy circled over the river, and was gone. The Red Hand had found the valley. The raiders will come: small bands at first, testing the walls, then sieges with ogres and worse. Whatever this town is to become, it must become it quickly: a wall and a moat, traps in the ground beyond them, and steel in every hand that can hold it.',
  },
  {
    icon: '🏰',
    title: 'The hold is yours',
    text:
      'They chose you to lead them. Clear the rocks and lay the roads. Send miners down the shaft and haul up what they cut. Light the forges, keep the cottages in water and bread, drill the pikemen. And when the Horde comes up the valley, hold the walls. Aldmere is gone. Greyhollow is not — not while you stand.',
  },
];

export default function Prologue({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;
  const { icon, title, text } = PAGES[page];
  // Android's Back turns back a page (on the first, it closes the prologue).
  const back = useRef<() => boolean>(() => false);
  useEffect(() => {
    back.current = () => {
      if (page > 0) setPage(page - 1);
      else onDone();
      return true;
    };
  });
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => back.current());
    return () => listener.remove();
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.top}>
        <Text style={styles.label}>PROLOGUE · {String(page + 1)} / {String(PAGES.length)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip the prologue" onPress={onDone} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
          <Text style={styles.skipText}>SKIP</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.middle} showsVerticalScrollIndicator={false}>
        <Animated.View key={page} entering={FadeIn.duration(450)} style={styles.page}>
          <View style={styles.medallion}>
            <Text style={styles.icon}>{icon}</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.text}>{text}</Text>
        </Animated.View>
      </ScrollView>
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {PAGES.map((_, index) => (
            <View key={index} style={[styles.dot, index === page && styles.dotOn]} />
          ))}
        </View>
        <View style={styles.buttons}>
          {page > 0 && (
            <View style={styles.backButton}>
              <GameButton label="BACK" detail="" onPress={() => setPage(page - 1)} secondary />
            </View>
          )}
          <View style={styles.nextButton}>
            <GameButton label={last ? 'BEGIN' : 'NEXT'} detail={last ? 'to Greyhollow' : ''} onPress={() => (last ? onDone() : setPage(page + 1))} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0d0f0c', paddingHorizontal: 20 },
  top: { alignSelf: 'center', width: '100%', maxWidth: 620, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: '#d2a45f', fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
  skip: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#3a4439' },
  skipText: { color: '#a9b09a', fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  middle: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  page: { alignSelf: 'center', width: '100%', maxWidth: 620, alignItems: 'center', gap: 18 },
  medallion: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d2a45f', backgroundColor: '#171b15' },
  icon: { fontSize: 40, lineHeight: 48 },
  title: { color: '#f0ead8', fontFamily: 'Georgia', fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
  text: { color: '#d9d3c0', fontFamily: 'Georgia', fontSize: 17, lineHeight: 27, textAlign: 'left' },
  bottom: { alignSelf: 'center', width: '100%', maxWidth: 620, gap: 14 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3a4439' },
  dotOn: { backgroundColor: '#d2a45f' },
  buttons: { flexDirection: 'row', gap: 10 },
  backButton: { flex: 1 },
  nextButton: { flex: 2 },
});
