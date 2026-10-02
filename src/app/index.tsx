import { useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWindowDimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  COAL_REQUEST_REWARD,
  COAL_REQUEST_SIZE,
  COSTS,
  MAX_PICKAXE_LEVEL,
  canAfford,
  idleMiners,
  useGameStore,
} from '../game/gameStore';
import GameScene from '../components/GameScene';
import { SCENE_WIDTH, getSceneLayout, getShaftHotspot } from '../components/GameSceneLayout';
import { GameButton, LiveSignal, ResourceValue, SectionLabel } from '../components/GameUI';
import MarketPanel from '../components/MarketPanel';
import StockpileTable from '../components/StockpileTable';

export default function StrongholdScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const game = useGameStore();
  const [sceneLayout, setSceneLayout] = useState(() => getSceneLayout(SCENE_WIDTH));
  const pickaxesMaxed = game.pickaxeLevel >= MAX_PICKAXE_LEVEL;
  const idle = idleMiners(game);

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
            <ResourceValue label="WORKERS" value={`${String(game.miners)} MINERS`} tone="#c0cd83" />
          </View>

          <View style={[styles.columns, wide && styles.columnsWide]}>
            <View style={styles.worldColumn}>
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
                  if (next.width !== sceneLayout.width) setSceneLayout(next);
                }}
              >
                <GameScene layout={sceneLayout} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Descend into the coal shaft"
                  onPress={() => router.push('/mine')}
                  style={({ pressed }) => [styles.mineHotspot, getShaftHotspot(sceneLayout), pressed && styles.hotspotPressed]}
                >
                  <Text style={styles.hotspotArrow}>↓</Text>
                  <Text style={styles.hotspotText}>SHAFT</Text>
                </Pressable>
                <View style={styles.sceneCaption}><LiveSignal /><Text style={styles.captionText}>{String(game.miners)} MINERS ON SHIFT</Text></View>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/mine')}
                style={({ pressed }) => [styles.enterMine, pressed && styles.hotspotPressed]}
              >
                <Text style={styles.enterMineTitle}>Coal mine <Text style={styles.enterMineArrow}>↗</Text></Text>
                <Text style={styles.enterMineDetail}>SHAFT {String(game.depth).padStart(2, '0')} · {String(game.miners)} MINERS WORKING</Text>
              </Pressable>

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
                  <Text style={styles.cartNote}>CART B · {String(game.warehouseCartCapacity)} PER TRIP</Text>
                </View>
              </View>
            </View>

            <View style={styles.operationsColumn}>
              <View style={styles.tradingSection}>
                <View style={styles.sectionHeader}>
                  <View><SectionLabel>TRADING POST</SectionLabel><Text style={styles.subheading}>Coal contracts and an ore market</Text></View>
                  <Text style={styles.openTag}>OPEN</Text>
                </View>
                <View style={styles.contractLine}>
                  <View style={styles.contractMark}><Text style={styles.contractMarkText}>C</Text></View>
                  <View style={styles.contractCopy}>
                    <Text style={styles.contractTitle}>Furnace supply</Text>
                    <Text style={styles.contractDetail}>{String(COAL_REQUEST_SIZE)} coal  ×  {String(COAL_REQUEST_REWARD / COAL_REQUEST_SIZE)} gold</Text>
                  </View>
                  <Text style={styles.reward}>+{String(COAL_REQUEST_REWARD)} G</Text>
                </View>
                <GameButton
                  label="FULFILL REQUEST"
                  detail={`${String(COAL_REQUEST_SIZE)} warehouse coal`}
                  onPress={game.fulfillCoalRequest}
                  disabled={game.warehouse.coal < COAL_REQUEST_SIZE}
                />
                <MarketPanel warehouse={game.warehouse} onSell={game.sellResource} />
              </View>

              <View style={styles.developmentSection}>
                <View style={styles.sectionHeader}>
                  <View><SectionLabel>GROW THE HOLD</SectionLabel><Text style={styles.subheading}>Coal builds the next shift</Text></View>
                  <Text style={styles.ownedTag}>{String(game.huts)} HUT{game.huts === 1 ? '' : 'S'}</Text>
                </View>
                <GameButton
                  label="BUILD MINER HUT"
                  detail={`${costLabel(COSTS.minerHut)} · +1 miner${idle > 0 ? ` · ${String(idle)} idle` : ''}`}
                  onPress={game.buildMinerHut}
                  disabled={!canAfford(game, COSTS.minerHut)}
                />
                <GameButton
                  label={pickaxesMaxed ? 'PICKAXES FULLY FORGED' : 'FORGE BETTER PICKS'}
                  detail={pickaxesMaxed ? `level ${String(game.pickaxeLevel)} · maximum` : `${costLabel(COSTS.pickaxe)} · +0.25 coal/s each`}
                  onPress={game.forgePickaxe}
                  disabled={pickaxesMaxed || !canAfford(game, COSTS.pickaxe)}
                  secondary
                />
                <GameButton
                  label="EXPAND WAREHOUSE"
                  detail={`${costLabel(COSTS.warehouse)} · +50 storage`}
                  onPress={game.expandWarehouse}
                  disabled={!canAfford(game, COSTS.warehouse)}
                  secondary
                />
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

function costLabel(cost: { coal: number; gold: number }) {
  return `${String(cost.coal)} coal · ${String(cost.gold)} gold`;
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
  worldColumn: { flex: 1.1, minWidth: 0 },
  operationsColumn: { flex: 0.9, minWidth: 0, gap: 22 },
  sectionHeader: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  subheading: { color: '#e7e2d2', fontFamily: 'Georgia', fontSize: 16, marginTop: 4 },
  worldCoord: { color: '#777f70', fontFamily: 'monospace', fontSize: 8 },
  sceneFrame: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: '#657052' },
  mineHotspot: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#edc779', backgroundColor: 'rgba(31, 38, 29, 0.88)' },
  hotspotPressed: { opacity: 0.7 },
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
  developmentSection: { gap: 8 },
  ownedTag: { color: '#8d947e', fontFamily: 'monospace', fontSize: 8 },
  noticeBar: { minHeight: 37, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 22, paddingHorizontal: 11, borderLeftWidth: 2, borderLeftColor: '#c98959', backgroundColor: '#1b2019' },
  noticeMark: { color: '#d0a468', fontFamily: 'monospace', fontSize: 14 },
  noticeText: { flex: 1, color: '#a9ad99', fontFamily: 'monospace', fontSize: 9 },
  footer: { color: '#626b5d', fontFamily: 'monospace', fontSize: 8, textAlign: 'center', marginTop: 17 },
});