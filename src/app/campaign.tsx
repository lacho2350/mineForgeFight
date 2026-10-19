// The campaign map: the road back south from Greyhollow to Aldmere, twelve battle sites on it (campaign.ts).
// Won sites are gilded, the next one lit, the rest locked. A tapped site shows what's told of it, who holds it
// and how strong they are against the army, and — for the next one — MARCH, which starts the battle and
// opens the battle screen. Plain views, no Skia: it has to open at once on every platform.
import { useEffect, useMemo, useRef, useState } from 'react';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CAMPAIGN_BATTLES, CAMPAIGN_STAGES, campaignBlocker, campaignBounty, campaignParty, campaignStrength, nextStage } from '../game/campaign';
import { describeParty } from '../game/hold';
import { useGame } from '../game/gameStore';
import { partyValue } from '../game/raids';
import { armyValue } from '../game/units';
import { GameButton, SectionLabel } from '../components/GameUI';

const MAP_RATIO = 1.45; // height / width of the map
const NODE = 44;

export default function CampaignScreen() {
  const game = useGame(useIsFocused());
  const insets = useSafeAreaInsets();
  const { campaign } = game;
  const next = nextStage(campaign);
  const [picked, setPicked] = useState<number>(next ?? CAMPAIGN_BATTLES);
  const [mapWidth, setMapWidth] = useState(0);
  // After a battle the next site is the one to look at: when it changes, the pick follows it (set during the
  // render, as React has it for state that follows a prop).
  const [followed, setFollowed] = useState(next);
  if (next !== followed) {
    setFollowed(next);
    if (next) setPicked(next);
  }
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const back = useRef(leave);
  useEffect(() => {
    back.current = leave;
  });
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      back.current();
      return true;
    });
    return () => listener.remove();
  }, []);

  const stage = CAMPAIGN_STAGES[picked - 1];
  const party = useMemo(() => campaignParty(picked, campaign.scale), [picked, campaign.scale]);
  const strength = partyValue(party);
  const army = Math.round(armyValue(game.army));
  const blocker = campaignBlocker(game);
  const state = picked <= campaign.won ? 'won' : picked === next ? 'next' : 'locked';
  const fighting = game.battle?.status === 'active' && game.battle.campaign === picked;
  const mapHeight = mapWidth * MAP_RATIO;
  const at = (index: number) => {
    const site = CAMPAIGN_STAGES[index];
    return { x: 24 + site.x * (mapWidth - 48), y: 24 + site.y * (mapHeight - 48) };
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={leave} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <Text style={styles.backText}>‹  HOLD</Text>
          </Pressable>
          <View style={styles.titles}>
            <Text style={styles.title}>The road to Aldmere</Text>
            <Text style={styles.subtitle}>
              {campaign.victory ? 'THE RED HAND IS BROKEN · THE WAR IS WON' : `${String(campaign.won)} / ${String(CAMPAIGN_BATTLES)} SITES WON · ARMY ${army.toLocaleString()}`}
            </Text>
          </View>
        </View>

        {/* The map: parchment, the road, the sites. */}
        <View style={styles.map} onLayout={(event) => setMapWidth(event.nativeEvent.layout.width)}>
          {mapWidth > 0 && (
            <View style={{ height: mapHeight }}>
              <Text style={[styles.landmark, { right: 14, bottom: 6 }]}>GREYHOLLOW ↓</Text>
              <Text style={[styles.landmark, { left: 14, top: 6 }]}>↑ ALDMERE</Text>
              {CAMPAIGN_STAGES.slice(0, -1).map((_, index) => {
                const a = at(index);
                const b = at(index + 1);
                const length = Math.hypot(b.x - a.x, b.y - a.y);
                const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
                const done = index + 1 <= campaign.won;
                return (
                  <View
                    key={index}
                    style={[
                      styles.road,
                      done && styles.roadDone,
                      { width: length, left: a.x, top: a.y - 1.5, transform: [{ translateX: -length / 2 }, { rotate: `${String(angle)}deg` }, { translateX: length / 2 }] },
                    ]}
                  />
                );
              })}
              {CAMPAIGN_STAGES.map((site, index) => {
                const number = index + 1;
                const point = at(index);
                const nodeState = number <= campaign.won ? 'won' : number === next ? 'next' : 'locked';
                return (
                  <Pressable
                    key={site.title}
                    accessibilityRole="button"
                    accessibilityLabel={`${site.title}, site ${String(number)}, ${nodeState}`}
                    onPress={() => setPicked(number)}
                    style={({ pressed }) => [
                      styles.node,
                      nodeState === 'won' && styles.nodeWon,
                      nodeState === 'next' && styles.nodeNext,
                      nodeState === 'locked' && styles.nodeLocked,
                      picked === number && styles.nodePicked,
                      pressed && styles.pressed,
                      { left: point.x - NODE / 2, top: point.y - NODE / 2 },
                    ]}
                  >
                    <Text style={styles.nodeIcon}>{nodeState === 'locked' ? '🔒' : nodeState === 'won' ? '✓' : site.icon}</Text>
                    <Text style={[styles.nodeNumber, nodeState === 'won' && styles.nodeNumberWon]}>{String(number)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* The picked site. */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardIcon}>{stage.icon}</Text>
            <View style={styles.cardTitles}>
              <Text style={styles.cardTitle}>
                {String(picked)}. {stage.title}
              </Text>
              <Text style={styles.cardPlace}>{stage.place.toUpperCase()} · {state === 'won' ? 'WON' : state === 'next' ? 'THE NEXT BATTLE' : 'BEYOND THE NEXT BATTLE'}</Text>
            </View>
          </View>
          <Text style={styles.text}>{stage.text}</Text>
          <View style={styles.block}>
            <SectionLabel>THE HORDE HERE</SectionLabel>
            <Text style={styles.body}>
              {describeParty(party)} · strength {strength.toLocaleString()} vs your army {army.toLocaleString()}
              {army > 0 ? ` (${String(Math.round((strength / Math.max(1, army)) * 100))}% of it)` : ''} · bounty {campaignBounty(campaignStrength(picked, campaign.scale)).toLocaleString()} gold
            </Text>
            <Text style={styles.note}>
              Fought in the open field: the army alone, with the armory’s and the dwellings’ bonuses — no walls, towers or traps. Survivors come home; the fallen don’t. Losing costs no plunder: the army simply falls back, to try again when it’s stronger.
            </Text>
          </View>
          {state === 'next' && !fighting && (
            <GameButton
              label="MARCH"
              detail={blocker ?? `fight for ${stage.title}`}
              disabled={!!blocker}
              onPress={() => {
                game.startCampaignBattle();
                router.push('/battle');
              }}
            />
          )}
          {fighting && <GameButton label="TO THE BATTLE" detail={`${stage.title} is being fought`} onPress={() => router.push('/battle')} />}
          {state === 'won' && picked === CAMPAIGN_BATTLES && <Text style={styles.won}>The Red Hand is broken. Aldmere is free, and Greyhollow stands. The hold plays on.</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f120e', paddingHorizontal: 12 },
  scroll: { alignSelf: 'center', width: '100%', maxWidth: 560, gap: 12, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#394238' },
  backText: { color: '#c6cdaf', fontFamily: 'monospace', fontSize: 10 },
  pressed: { opacity: 0.7 },
  titles: { flex: 1, gap: 2 },
  title: { color: '#f0ead8', fontFamily: 'Georgia', fontSize: 22, fontWeight: 'bold' },
  subtitle: { color: '#d2a45f', fontFamily: 'monospace', fontSize: 9 },
  map: { borderWidth: 1, borderColor: '#5a4a2c', backgroundColor: '#2a2418', overflow: 'hidden' },
  landmark: { position: 'absolute', color: '#a08a5c', fontFamily: 'monospace', fontSize: 9, letterSpacing: 1 },
  road: { position: 'absolute', height: 3, backgroundColor: '#6b5a3a', opacity: 0.9 },
  roadDone: { backgroundColor: '#d2a45f' },
  node: { position: 'absolute', width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  nodeWon: { borderColor: '#d2a45f', backgroundColor: '#3a3220' },
  nodeNext: { borderColor: '#e8604a', backgroundColor: '#3a2016' },
  nodeLocked: { borderColor: '#4a4536', backgroundColor: '#201d16' },
  // A glow round the picked site (`boxShadow`: the shadow* props are deprecated on the web, and this draws the same everywhere).
  nodePicked: { borderColor: '#f3d27a', boxShadow: '0 0 6px rgba(243, 210, 122, 0.6)' },
  nodeIcon: { fontSize: 16, lineHeight: 20 },
  nodeNumber: { position: 'absolute', bottom: -7, right: -4, minWidth: 16, textAlign: 'center', paddingHorizontal: 3, backgroundColor: '#1b1810', color: '#c9c4b2', fontFamily: 'monospace', fontSize: 9, fontWeight: '700', borderRadius: 3 },
  nodeNumberWon: { backgroundColor: '#d2a45f', color: '#20231b' },
  card: { gap: 12, padding: 14, borderWidth: 1, borderColor: '#4a5240', backgroundColor: '#141813' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { fontSize: 30, lineHeight: 36 },
  cardTitles: { flex: 1, gap: 2 },
  cardTitle: { color: '#f0ead8', fontFamily: 'Georgia', fontSize: 20, fontWeight: 'bold' },
  cardPlace: { color: '#d2a45f', fontFamily: 'monospace', fontSize: 9 },
  text: { color: '#d9d3c0', fontFamily: 'Georgia', fontSize: 15, lineHeight: 23 },
  block: { gap: 6 },
  body: { color: '#c9c4b2', fontFamily: 'monospace', fontSize: 10, lineHeight: 15 },
  note: { color: '#858d7c', fontFamily: 'monospace', fontSize: 8, lineHeight: 12 },
  won: { color: '#c0cd83', fontFamily: 'Georgia', fontSize: 15, lineHeight: 23 },
});
