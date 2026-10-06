import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWindowDimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  COAL_REQUEST_SIZE,
  coalRequestReward,
  idleMiners,
  sellPrice,
  useGameStore,
} from '../game/gameStore';
import { BUILDING_IDS, BUILDING_INFO, buildingStats, type BuildingId } from '../game/buildings';
import { RESOURCES, type Resource } from '../game/resources';
import GameScene from '../components/GameScene';
import {
  BUILDING_PLOTS,
  EXTRA_HOTSPOTS,
  SCENE_WIDTH,
  SHAFT_RECT,
  getSceneLayout,
  toFrameRect,
  type SceneRect,
} from '../components/GameSceneLayout';
import BuildingsPanel from '../components/BuildingsPanel';
import RaidBanner from '../components/RaidBanner';
import { GameButton, LiveSignal, ResourceValue, SectionLabel } from '../components/GameUI';
import MarketPanel from '../components/MarketPanel';
import StockpileTable from '../components/StockpileTable';

// Tap areas over the scene, back to front: wall and towers first so the buildings in front win.
const HOTSPOTS: { id: BuildingId; rect: SceneRect }[] = [
  { id: 'wall', rect: BUILDING_PLOTS.wall },
  { id: 'towers', rect: BUILDING_PLOTS.towers },
  ...EXTRA_HOTSPOTS,
  ...BUILDING_IDS.filter((id) => id !== 'wall' && id !== 'towers').map((id) => ({ id, rect: BUILDING_PLOTS[id] })),
];

export default function StrongholdScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const game = useGameStore();
  const [sceneLayout, setSceneLayout] = useState(() => getSceneLayout(SCENE_WIDTH));
  const [selected, setSelected] = useState<BuildingId>('keep');
  const sceneScrollRef = useRef<ScrollView>(null);
  const idle = idleMiners(game);
  const beds = buildingStats(game.buildings).beds;
  const prices = Object.fromEntries(RESOURCES.map((resource) => [resource, sellPrice(game, resource)])) as Record<Resource, number>;
  const reward = coalRequestReward(game);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>MINEFORGE <Text style={styles.brandDivider}>/</Text> FRONTIER 01</Text>
              <Text style={styles.title}>The foothold</Text>
            </View>
            <View style={styles.shiftStatus}><LiveSignal /><Text style={styles.shiftText}>SHIFT ACTIVE</Text></View>
          </View>

          <View style={styles.resourceBar}>
            <ResourceValue label="WAREHOUSE COAL" value={`${String(Math.floor(game.warehouse.coal))} / ${String(game.warehouseCapacity)}`} tone="#d6bb79" />
            <View style={styles.resourceRule} />
            <ResourceValue label="TREASURY" value={`${String(game.gold)} G`} tone="#e5a565" />
            <View style={styles.resourceRule} />
            <ResourceValue label={`WORKERS · ${String(idle)} IDLE`} value={`${String(game.miners)} / ${String(beds)}`} tone="#c0cd83" />
          </View>

          <RaidBanner />

          <View style={[styles.columns, wide && styles.columnsWide]}>
            <View style={[styles.worldColumn, wide && styles.worldColumnWide]}>
              <View style={styles.sectionHeader}>
                <View><SectionLabel>YOUR STRONGHOLD</SectionLabel><Text style={styles.subheading}>A small start. A deep future.</Text></View>
                <Text style={styles.worldCoord}>SURFACE · 01</Text>
              </View>
              <View
                style={styles.sceneFrame}
                onLayout={({ nativeEvent }) => {
                  // A screen hidden under the mine reports width 0; keep the last real layout.
                  if (nativeEvent.layout.width <= 0) return;
                  const next = getSceneLayout(nativeEvent.layout.width);
                  if (next.frameWidth !== sceneLayout.frameWidth) setSceneLayout(next);
                }}
              >
                {/* Narrow phones: the town is wider than the screen and scrolls sideways. */}
                <ScrollView
                  ref={sceneScrollRef}
                  horizontal
                  scrollEnabled={sceneLayout.width > sceneLayout.frameWidth}
                  showsHorizontalScrollIndicator={false}
                  // Start with the keep in the middle.
                  onContentSizeChange={(contentWidth) => sceneScrollRef.current?.scrollTo({ x: Math.max(0, (contentWidth - sceneLayout.frameWidth) / 2), animated: false })}
                >
                  <View style={{ width: sceneLayout.width, height: sceneLayout.height }}>
                    <GameScene layout={sceneLayout} />
                    {HOTSPOTS.map(({ id, rect }, index) => (
                      <Pressable
                        key={`${id}-${String(index)}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${BUILDING_INFO[id].name}, level ${String(game.buildings[id])}`}
                        onPress={() => setSelected(id)}
                        style={({ pressed }) => [styles.buildingHotspot, toFrameRect(sceneLayout, rect), id === selected && styles.buildingSelected, pressed && styles.hotspotPressed]}
                      >
                        <Text style={[styles.levelBadge, game.buildings[id] === 0 && styles.levelBadgeEmpty]}>{game.buildings[id] === 0 ? '+' : String(game.buildings[id])}</Text>
                      </Pressable>
                    ))}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Descend into the coal shaft"
                      onPress={() => router.push('/mine')}
                      style={({ pressed }) => [styles.mineHotspot, toFrameRect(sceneLayout, SHAFT_RECT), pressed && styles.hotspotPressed]}
                    >
                      <Text style={styles.hotspotArrow}>↓</Text>
                      <Text style={styles.hotspotText}>MINE</Text>
                    </Pressable>
                  </View>
                </ScrollView>
                <View style={styles.sceneCaption}><LiveSignal /><Text style={styles.captionText}>TAP A BUILDING TO BUILD OR UPGRADE</Text></View>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/mine')}
                style={({ pressed }) => [styles.enterMine, pressed && styles.hotspotPressed]}
              >
                <Text style={styles.enterMineTitle}>Coal mine <Text style={styles.enterMineArrow}>↗</Text></Text>
                <Text style={styles.enterMineDetail}>SHAFT {String(game.depth).padStart(2, '0')} · {String(game.miners)} MINERS WORKING</Text>
              </Pressable>

              <BuildingsPanel
                buildings={game.buildings}
                construction={game.construction}
                warehouse={game.warehouse}
                warehouseCapacity={game.warehouseCapacity}
                gold={game.gold}
                selected={selected}
                onSelect={setSelected}
                onUpgrade={game.upgradeBuilding}
                army={game.army}
                recruits={game.recruits}
                onRecruit={game.recruit}
              />
            </View>

            <View style={[styles.operationsColumn, wide && styles.operationsColumnWide]}>
              <View style={styles.tradingSection}>
                <View style={styles.sectionHeader}>
                  <View><SectionLabel>TRADING POST</SectionLabel><Text style={styles.subheading}>Coal contracts and an ore market</Text></View>
                  <Text style={styles.openTag}>OPEN</Text>
                </View>
                <View style={styles.contractLine}>
                  <View style={styles.contractMark}><Text style={styles.contractMarkText}>C</Text></View>
                  <View style={styles.contractCopy}>
                    <Text style={styles.contractTitle}>Furnace supply</Text>
                    <Text style={styles.contractDetail}>{String(COAL_REQUEST_SIZE)} coal  ×  {String(reward / COAL_REQUEST_SIZE)} gold</Text>
                  </View>
                  <Text style={styles.reward}>+{String(reward)} G</Text>
                </View>
                <GameButton
                  label="FULFILL REQUEST"
                  detail={`${String(COAL_REQUEST_SIZE)} warehouse coal`}
                  onPress={game.fulfillCoalRequest}
                  disabled={game.warehouse.coal < COAL_REQUEST_SIZE}
                />
                <MarketPanel warehouse={game.warehouse} prices={prices} onSell={game.sellResource} />
              </View>

              <View style={styles.stockpileSection}>
                <View style={styles.stockpileHeader}>
                  <SectionLabel>HAUL ROUTE</SectionLabel>
                  <Text style={styles.routeNote}>LIVE · {String(game.lastFlow.toWarehouse).replace(/\.0$/, '')} DELIVERED / TICK</Text>
                </View>
                <StockpileTable
                  stages={[
                    { label: 'MINERS', stock: game.vein, capacity: game.veinCapacity },
                    { label: 'MINE EXIT', stock: game.mineExit, capacity: game.mineExitCapacity },
                    { label: 'MINE', stock: game.mineStock, capacity: game.mineCapacity },
                    { label: 'WAREHOUSE', stock: game.warehouse, capacity: game.warehouseCapacity },
                  ]}
                />
                <View style={styles.cartRow}>
                  <Text style={styles.cartNote}>MINE CART · {String(game.mineCartCapacity)} PER LOAD</Text>
                  <Text style={styles.cartNote}>WAGONS · {String(game.surfaceHaul)} PER TRIP</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.noticeBar}><Text style={styles.noticeMark}>›</Text><Text style={styles.noticeText}>{game.notice}</Text></View>
          <Text style={styles.footer}>DIG BELOW. BUILD ABOVE.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111410' },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 18, paddingTop: 22, paddingBottom: 26 },
  page: { width: '100%', maxWidth: 1120 },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  brand: { color: '#c6cdaf', fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.3 },
  brandDivider: { color: '#c98959' },
  title: { color: '#f0ead8', fontFamily: 'Georgia', fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  shiftStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 11, borderWidth: 1, borderColor: '#394238' },
  shiftText: { color: '#b8c58a', fontFamily: 'monospace', fontSize: 9 },
  resourceBar: { minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 12, paddingHorizontal: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#353b32', marginBottom: 21 },
  resourceRule: { width: 1, height: 34, backgroundColor: '#353b32' },
  columns: { gap: 26 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  // Flex only side by side: stacked on phones, each column takes its content's height.
  worldColumn: { minWidth: 0 },
  worldColumnWide: { flex: 1.1 },
  operationsColumn: { minWidth: 0, gap: 22 },
  operationsColumnWide: { flex: 0.9 },
  sectionHeader: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  subheading: { color: '#e7e2d2', fontFamily: 'Georgia', fontSize: 16, marginTop: 4 },
  worldCoord: { color: '#777f70', fontFamily: 'monospace', fontSize: 8 },
  sceneFrame: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: '#657052' },
  mineHotspot: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#edc779', backgroundColor: 'rgba(31, 38, 29, 0.6)' },
  hotspotPressed: { opacity: 0.7 },
  buildingHotspot: { position: 'absolute', borderWidth: 1, borderColor: 'transparent' },
  buildingSelected: { borderColor: '#edc779', backgroundColor: 'rgba(237, 199, 121, 0.12)' },
  levelBadge: { position: 'absolute', left: 1, bottom: 1, minWidth: 14, paddingHorizontal: 2, backgroundColor: 'rgba(23, 28, 22, 0.85)', color: '#edc779', fontFamily: 'monospace', fontSize: 8, fontWeight: '700', textAlign: 'center' },
  levelBadgeEmpty: { color: '#c0cd83' },
  hotspotArrow: { color: '#e9c475', fontFamily: 'monospace', fontSize: 15, lineHeight: 17 },
  hotspotText: { color: '#f1e7cf', fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  sceneCaption: { position: 'absolute', left: 12, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  captionText: { color: '#f0ead6', fontFamily: 'monospace', fontSize: 8 },
  enterMine: { minHeight: 53, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderColor: '#374035' },
  enterMineTitle: { color: '#eee9d8', fontFamily: 'Georgia', fontSize: 16 },
  enterMineArrow: { color: '#e4b36f' },
  enterMineDetail: { color: '#919786', fontFamily: 'monospace', fontSize: 8 },
  stockpileSection: { paddingTop: 18 },
  stockpileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 },
  routeNote: { color: '#858d7c', fontFamily: 'monospace', fontSize: 8, textAlign: 'right' },
  cartRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 3 },
  cartNote: { color: '#70786a', fontFamily: 'monospace', fontSize: 7 },
  tradingSection: { paddingBottom: 19, borderBottomWidth: 1, borderColor: '#353b32' },
  openTag: { color: '#bac785', fontFamily: 'monospace', fontSize: 8 },
  contractLine: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  contractMark: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#393d2f' },
  contractMarkText: { color: '#e4bd79', fontFamily: 'Georgia', fontSize: 16, fontWeight: 'bold' },
  contractCopy: { flex: 1, gap: 4 },
  contractTitle: { color: '#e8e3d1', fontFamily: 'Georgia', fontSize: 14 },
  contractDetail: { color: '#898f7e', fontFamily: 'monospace', fontSize: 9 },
  reward: { color: '#e5ae69', fontFamily: 'monospace', fontSize: 12, fontWeight: '700' },
  noticeBar: { minHeight: 37, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 22, paddingHorizontal: 11, borderLeftWidth: 2, borderLeftColor: '#c98959', backgroundColor: '#1b2019' },
  noticeMark: { color: '#d0a468', fontFamily: 'monospace', fontSize: 14 },
  noticeText: { flex: 1, color: '#a9ad99', fontFamily: 'monospace', fontSize: 9 },
  footer: { color: '#626b5d', fontFamily: 'monospace', fontSize: 8, textAlign: 'center', marginTop: 17 },
});