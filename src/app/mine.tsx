import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDepthCost, useGameStore } from '../../gameStore';
import { MINE_MAP_HEIGHT, MINE_MAP_WIDTH, MINE_SHAFT_X, MINE_TILE_SIZE } from '../components/MineMapLayout';
import MineScene from '../components/MineScene';
import { GameButton, LiveSignal, ResourceValue, SectionLabel } from '../components/GameUI';

export default function MineScreen() {
  const game = useGameStore();
  const depthCost = getDepthCost(game.depth);
  const { width: windowWidth } = useWindowDimensions();
  const mapScrollRef = useRef<ScrollView>(null);
  const mapViewportWidth = Math.min(windowWidth - 36, 850);
  const initialMapOffset = Math.max(0, MINE_SHAFT_X + MINE_TILE_SIZE / 2 - mapViewportWidth / 2);

  useEffect(() => {
    const timeout = setTimeout(() => {
      mapScrollRef.current?.scrollTo({ x: initialMapOffset, y: 0, animated: false });
    }, 100);
    return () => clearTimeout(timeout);
  }, [initialMapOffset]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Return to the surface stronghold"
                onPress={() => router.replace('/')}
                style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
              >
                <Text style={styles.backLink}>‹  SURFACE</Text>
              </Pressable>
              <Text style={styles.title}>The mine</Text>
            </View>
            <View style={styles.shiftStatus}><LiveSignal /><Text style={styles.shiftText}>SHIFT ACTIVE</Text></View>
          </View>

          <View style={styles.mineHeader}>
            <View><SectionLabel>SHAFT {String(game.depth).padStart(2, '0')}</SectionLabel><Text style={styles.mineSubheading}>45 galleries. Follow the lift down.</Text></View>
            <View style={styles.minerCount}><Text style={styles.minerCountValue}>{String(game.miners)}</Text><Text style={styles.minerCountLabel}>MINERS</Text></View>
          </View>

          <View style={styles.sceneFrame}>
            <ScrollView
              ref={mapScrollRef}
              horizontal
              nestedScrollEnabled
              directionalLockEnabled
              showsHorizontalScrollIndicator
              onLayout={() => mapScrollRef.current?.scrollTo({ x: initialMapOffset, y: 0, animated: false })}
              onContentSizeChange={() => mapScrollRef.current?.scrollTo({ x: initialMapOffset, y: 0, animated: false })}
              style={styles.mapViewport}
              contentContainerStyle={styles.mapContent}
            >
              <MineScene
                miners={game.miners}
                depth={game.depth}
                coal={Math.floor(game.veinCoal + game.mineExitCoal + game.mineCoal)}
              />
            </ScrollView>
            <View style={styles.sceneCaption}><LiveSignal /><Text style={styles.captionText}>COAL SEAM · {String((game.miners * game.minerRate).toFixed(1))} COAL / SEC</Text></View>
          </View>

          <View style={styles.summaryRow}>
            <ResourceValue label="VEIN PILE" value={`${String(Math.floor(game.veinCoal))} / ${String(game.veinCapacity)}`} tone="#c7ce82" />
            <View style={styles.summaryRule} />
            <ResourceValue label="MINE EXIT" value={`${String(Math.floor(game.mineExitCoal))} / ${String(game.mineExitCapacity)}`} tone="#d5ae6c" />
            <View style={styles.summaryRule} />
            <ResourceValue label="MINE STOCKPILE" value={`${String(Math.floor(game.mineCoal))} / ${String(game.mineCapacity)}`} tone="#d5ae6c" />
            <View style={styles.summaryRule} />
            <ResourceValue label="WAREHOUSE" value={`${String(Math.floor(game.warehouseCoal))} / ${String(game.warehouseCapacity)}`} tone="#e4d6b1" />
          </View>

          <View style={styles.logisticsSection}>
            <View style={styles.sectionHeading}><View><SectionLabel>HAULING CHAIN</SectionLabel><Text style={styles.mineSubheading}>Coal keeps moving while you build.</Text></View><Text style={styles.tickLabel}>1 SEC / TICK</Text></View>
            <LogisticsStep index="01" title="Miners dig" detail={`${String(game.miners)} miners · ${String(game.minerRate)} coal / sec each`} live />
            <LogisticsStep index="02" title="Vein → mine exit" detail={`Mine cart carries ${String(game.mineCartCapacity)} coal · ${String(game.lastFlow.toMineExit).replace(/\.0$/, '')} moved last tick`} />
            <LogisticsStep index="03" title="Mine exit → mine stockpile" detail={`${String(Math.floor(game.mineExitCoal))} / ${String(game.mineExitCapacity)} coal staged · ${String(game.lastFlow.toMineStockpile).replace(/\.0$/, '')} unloaded last tick`} />
            <LogisticsStep index="04" title="Mine stockpile → warehouse" detail={`Surface cart carries ${String(game.warehouseCartCapacity)} coal · ${String(game.lastFlow.toWarehouse).replace(/\.0$/, '')} delivered last tick`} />
          </View>

          <View style={styles.deeperSection}>
            <View style={styles.deeperCopy}><SectionLabel>OPEN THE NEXT SHAFT</SectionLabel><Text style={styles.mineSubheading}>Depth {String(game.depth + 1)} · a longer coal vein</Text></View>
            <GameButton
              label="DIG DEEPER"
              detail={`${String(depthCost)} gold`}
              onPress={game.digDeeper}
              disabled={game.gold < depthCost}
            />
          </View>

          <View style={styles.backBar}><Text style={styles.backBarText}>SURFACE WAREHOUSE</Text><Text style={styles.backBarCoal}>{String(Math.floor(game.warehouseCoal))} COAL</Text><Text style={styles.backBarGold}>{String(game.gold)} G</Text></View>
          <Text style={styles.notice}>{game.notice}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LogisticsStep({ index, title, detail, live = false }: { index: string; title: string; detail: string; live?: boolean }) {
  return (
    <View style={styles.logisticsStep}>
      <Text style={styles.stepIndex}>{index}</Text>
      <View style={styles.stepCopy}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepDetail}>{detail}</Text></View>
      {live && <LiveSignal />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111410' },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 18, paddingTop: 22, paddingBottom: 28 },
  page: { width: '100%', maxWidth: 850 },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerTitle: { gap: 5 },
  backButton: { minHeight: 32, justifyContent: 'center', paddingRight: 12, alignSelf: 'flex-start' },
  backButtonPressed: { opacity: 0.65 },
  backLink: { color: '#d3a366', fontFamily: 'monospace', fontSize: 9 },
  title: { color: '#f0ead8', fontFamily: 'Georgia', fontSize: 27, fontWeight: 'bold' },
  shiftStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 11, borderWidth: 1, borderColor: '#394238' },
  shiftText: { color: '#b8c58a', fontFamily: 'monospace', fontSize: 9 },
  mineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  mineSubheading: { color: '#e7e2d2', fontFamily: 'Georgia', fontSize: 15, marginTop: 4 },
  minerCount: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  minerCountValue: { color: '#c3ce87', fontFamily: 'Georgia', fontSize: 23, fontWeight: 'bold' },
  minerCountLabel: { color: '#828a78', fontFamily: 'monospace', fontSize: 8 },
  sceneFrame: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: '#4b5544' },
  mapViewport: { width: '100%', height: MINE_MAP_HEIGHT },
  mapContent: { width: MINE_MAP_WIDTH },
  sceneCaption: { position: 'absolute', left: 12, top: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  captionText: { color: '#e7dfc6', fontFamily: 'monospace', fontSize: 8 },
  summaryRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 8, borderBottomWidth: 1, borderColor: '#353b32' },
  summaryRule: { width: 1, height: 30, backgroundColor: '#353b32' },
  logisticsSection: { paddingTop: 22 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9 },
  tickLabel: { color: '#7f8776', fontFamily: 'monospace', fontSize: 8 },
  logisticsStep: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: '#2f352d' },
  stepIndex: { width: 23, color: '#cb905e', fontFamily: 'monospace', fontSize: 10 },
  stepCopy: { flex: 1, gap: 4 },
  stepTitle: { color: '#e7e1d0', fontFamily: 'Georgia', fontSize: 14 },
  stepDetail: { color: '#87907f', fontFamily: 'monospace', fontSize: 9 },
  deeperSection: { gap: 12, paddingTop: 22, paddingBottom: 20 },
  deeperCopy: { gap: 1 },
  backBar: { minHeight: 41, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 11, backgroundColor: '#1b2019' },
  backBarText: { flex: 1, color: '#89907e', fontFamily: 'monospace', fontSize: 8 },
  backBarCoal: { color: '#d6bb79', fontFamily: 'monospace', fontSize: 9 },
  backBarGold: { color: '#e5a565', fontFamily: 'monospace', fontSize: 9 },
  notice: { color: '#838b7a', fontFamily: 'monospace', fontSize: 9, marginTop: 12 },
});