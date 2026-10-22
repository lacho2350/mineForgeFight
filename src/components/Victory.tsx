import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameButton } from './GameUI';

// The epilogue: the war is won. Shown once, when the last campaign site falls (campaign.ts), and again from
// the menu — a page at a time, like the prologue. The hold plays on afterwards.
const PAGES: { icon: string; title: string; text: string }[] = [
  {
    icon: '👑',
    title: 'The Red Hand falls',
    text:
      'The warlord died in the king’s hall with his behemoths heaped about him, and the Horde of the Red Hand died with him. Those that could run, ran — north, east, into the hills, scattered bands with no one to gather them. The Horde had been a hand; now it was fingers, and the fingers would not close again.',
  },
  {
    icon: '🏰',
    title: 'Aldmere',
    text:
      'The city that burned for nine days was quiet. Grass grew in the throne room; swallows nested in the burned-out halls. The survivors of Harrowfield came down from the woods and marshes where they had hidden for years, and found the banners of Greyhollow on the walls — a mining town’s colours, coal-black and gold, flying over the capital of the realm.',
  },
  {
    icon: '⛏️',
    title: 'What the mountain gave',
    text:
      'They asked what had done it: what army, what king. And the answer was a town that should not have lived. Peasants who dug coal in the dark and carried it up on their backs. Smiths who forged pikes out of iron ore and, in the end, mithril plate out of stones no one in Aldmere had a name for. Cottages kept in water and bread. A wall built one stone at a time while the wolves howled beyond the traps.',
  },
  {
    icon: '🕊️',
    title: 'Greyhollow stands',
    text:
      'Some went home to Aldmere. More stayed: the mountain had fed them, and the valley was theirs now in a way the lowlands had never been. The forges did not go cold. The miners went down the shaft the next morning as they always had. Barges came up the river for coal and iron, and sailed off laden. Raiders still came over the hills now and then — bands without a Horde — and found the walls manned.',
  },
  {
    icon: '🏆',
    title: 'Victory',
    text:
      'You led them from a rockfall and a leaning headframe to the throne hall of a kingdom. The story of the hold is told; the hold itself goes on, and so may you — dig deeper, build higher, and keep the walls. Aldmere is free. Greyhollow is yours.',
  },
];

/** The last line a Hardcore victory adds: the war won with one life. */
const HARDCORE_LINE = 'And it was won on Hardcore, with one life and no second chances: the valley will sing of Greyhollow’s keep for as long as there is a valley. 👑';

export default function Victory({ onDone, hardcore = false }: { onDone: () => void; hardcore?: boolean }) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;
  const { icon, title, text: pageText } = PAGES[page];
  const text = last && hardcore ? `${pageText}\n\n${HARDCORE_LINE}` : pageText;
  // Android's Back turns back a page (on the first, it closes the epilogue).
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
        <Text style={styles.label}>VICTORY · {String(page + 1)} / {String(PAGES.length)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip the epilogue" onPress={onDone} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
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
            <GameButton label={last ? 'KEEP PLAYING' : 'NEXT'} detail={last ? 'back to the hold' : ''} onPress={() => (last ? onDone() : setPage(page + 1))} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0d0f0c', paddingHorizontal: 20 },
  top: { alignSelf: 'center', width: '100%', maxWidth: 620, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: '#e9c475', fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
  skip: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#3a4439' },
  skipText: { color: '#a9b09a', fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  middle: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  page: { alignSelf: 'center', width: '100%', maxWidth: 620, alignItems: 'center', gap: 18 },
  medallion: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#e9c475', backgroundColor: '#1d1a12' },
  icon: { fontSize: 40, lineHeight: 48 },
  title: { color: '#f3e7c6', fontFamily: 'Georgia', fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
  text: { color: '#d9d3c0', fontFamily: 'Georgia', fontSize: 17, lineHeight: 27, textAlign: 'left' },
  bottom: { alignSelf: 'center', width: '100%', maxWidth: 620, gap: 14 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3a4439' },
  dotOn: { backgroundColor: '#e9c475' },
  buttons: { flexDirection: 'row', gap: 10 },
  backButton: { flex: 1 },
  nextButton: { flex: 2 },
});
