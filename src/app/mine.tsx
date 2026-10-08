import { useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { freeHands, haulWalk, selectMineLayout, workforceOf } from '../game/hold';
import { getDepthCost, tileDigCost, tunnelCost } from '../game/costs';
import { MAX_DEPTH, MINE_STATIONS_PER_GALLERY, VEIN_CAPACITY_PER_DEPTH, useGameStore } from '../game/gameStore';
import { haulFactor } from '../game/roads';
import { buildingStats } from '../game/buildings';
import { findDigRoute, getDepositInfo, standingTargets, tileKey } from '../game/mineLayout';
import DepositPanel from '../components/DepositPanel';
import HaulagePanel from '../components/HaulagePanel';
import StockpileTable from '../components/StockpileTable';
import { stockTotal } from '../game/resources';
import { MINE_TILE_SIZE } from '../components/MineMapLayout';
import MineScene from '../components/MineScene';
import { GameButton, LiveSignal, SectionLabel } from '../components/GameUI';
import RaidBanner from '../components/RaidBanner';
import { TechBranchView } from '../components/TechTree';

export default function MineScreen() {
  const game = useGameStore();
  const depthCost = getDepthCost(game.depth, game.techs);
  const atBedrock = game.depth >= MAX_DEPTH;
  const layout = selectMineLayout(game);
  const [digMode, setDigMode] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Deposit amounts change every tick; the cached layout only refreshes on redraw, so use live ones.
  const selected = selectedKey ? getDepositInfo({ ...layout, depositMined: game.depositMined }, selectedKey) : null;
  const selectedPending = !!selectedKey && game.pendingSites.some((site) => tileKey(site.faceRow, site.faceColumn) === selectedKey);
  const selectedStatus = selected?.status;
  const { buildings, techs } = game;
  // The tunnel diggers would cut to reach the selected deposit; only recomputed when the mine changes.
  const selectedRoute = useMemo(() => {
    if (!selectedKey || selectedStatus !== 'unreachable') return null;
    const route = findDigRoute(layout, new Set(game.digPlan), standingTargets(layout, selectedKey));
    return route ? { tiles: route.length, cost: tunnelCost({ buildings, techs }, route) } : null;
  }, [layout, selectedKey, selectedStatus, game.digPlan, buildings, techs]);
  const { height: windowHeight } = useWindowDimensions();
  const pageScrollRef = useRef<ScrollView>(null);
  // The map can be thousands of pixels tall; show a fixed window onto it and scroll inside.
  const mapViewportHeight = Math.min(layout.rows * MINE_TILE_SIZE, Math.max(320, Math.round(windowHeight * 0.6)));
  const goToSurface = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView ref={pageScrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Return to the surface stronghold"
                onPress={goToSurface}
                style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
              >
                <Text style={styles.backLink}>‹  SURFACE</Text>
              </Pressable>
              <Text style={styles.title}>The mine</Text>
            </View>
            <View style={styles.shiftStatus}><LiveSignal /><Text style={styles.shiftText}>SHIFT ACTIVE</Text></View>
          </View>

          <RaidBanner />

          <View style={styles.mineHeader}>
            <View><SectionLabel>SHAFT {String(game.depth).padStart(2, '0')}</SectionLabel><Text style={styles.mineSubheading}>{String(game.depth)} {game.depth === 1 ? 'gallery' : 'galleries'} open. Follow the lift down.</Text></View>
            <View style={styles.minerCount}><Text style={styles.minerCountValue}>{String(game.sites.length + game.pendingSites.length)}</Text><Text style={styles.minerCountLabel}>MINERS · {String(freeHands(game))} FREE PEASANTS</Text></View>
          </View>

          <View style={styles.digBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: digMode }}
              accessibilityLabel={digMode ? 'Stop digging and scroll the map' : 'Dig tunnels'}
              onPress={() => setDigMode((on) => !on)}
              style={({ pressed }) => [styles.digToggle, digMode && styles.digToggleOn, pressed && styles.backButtonPressed]}
            >
              <Text style={[styles.digToggleText, digMode && styles.digToggleTextOn]}>{digMode ? '✓ DIGGING' : '⛏ DIG'}</Text>
            </Pressable>
            <Text style={styles.digHint}>
              {digMode
                ? `Drag from a tunnel across rock · from ${String(tileDigCost(game, 0))} gold per tile · two fingers, right-drag or arrow keys to move`
                : game.digPlan.length > 0
                  ? `${String(game.digPlan.length)} tile${game.digPlan.length === 1 ? '' : 's'} left to dig`
                  : 'Drag, arrow keys or WASD to move · pinch, wheel or +/− to zoom · tap a deposit for details · double-tap to assign a miner.'}
            </Text>
          </View>

          <View style={styles.sceneFrame}>
              <MineScene
                layout={layout}
                coal={Math.floor(stockTotal(game.vein) + stockTotal(game.mineExit) + stockTotal(game.mineStock))}
                viewportHeight={mapViewportHeight}
                vein={game.vein}
                veinCapacity={game.veinCapacity}
                mineExit={game.mineExit}
                mineExitCapacity={game.mineExitCapacity}
                haulTime={game.haulTime}
                cartLoads={game.cartLoads}
                carts={game.carts}
                digPlan={game.digPlan}
                digProgress={game.digProgress}
                digMode={digMode}
                onPlanDig={game.planDig}
                pageScrollRef={pageScrollRef}
                depositMined={game.depositMined}
                selectedKey={selectedKey}
                onSelectTile={(key) => setSelectedKey((current) => (current === key ? null : key))}
                onAssignTile={(key) => {
                  setSelectedKey(key);
                  game.assignMiner(key);
                }}
              />
            <View style={styles.sceneCaption}><LiveSignal /><Text style={styles.captionText}>COAL SEAMS · {String((game.sites.length * game.minerRate).toFixed(1))} COAL / SEC</Text></View>
          </View>

          {selected && (
            <DepositPanel
              info={selected}
              idle={freeHands(game)}
              gold={game.gold}
              pending={selectedPending}
              route={selectedRoute}
              onAssign={() => game.assignMiner(selected.key)}
              onRelease={() => game.releaseMiner(selected.key)}
              onClose={() => setSelectedKey(null)}
            />
          )}

          <View style={styles.stockpiles}>
            <SectionLabel>STOCKPILES</SectionLabel>
            <StockpileTable
              stages={[
                { label: 'MINERS', stock: game.vein, capacity: game.veinCapacity },
                { label: 'MINE EXIT', stock: game.mineExit, capacity: game.mineExitCapacity },
                { label: 'MINE', stock: game.mineStock, capacity: game.mineCapacity },
                { label: 'WAREHOUSE', stock: game.warehouse, capacity: game.warehouseCapacity },
              ]}
            />
          </View>

          <View style={styles.logisticsSection}>
            <View style={styles.sectionHeading}><View><SectionLabel>HAULING CHAIN</SectionLabel><Text style={styles.mineSubheading}>Every resource keeps moving while you build.</Text></View><Text style={styles.tickLabel}>1 SEC / TICK</Text></View>
            <LogisticsStep index="01" title="Miners dig" detail={`${String(game.sites.length)} working miners · ${String(game.minerRate)} / sec each`} live />
            <LogisticsStep index="02" title="Miners → mine exit" detail={`Mine carts carry ${String(game.mineCartCapacity)} per load · ${String(game.lastFlow.toMineExit).replace(/\.0$/, '')} tipped last tick`} />
            <LogisticsStep index="03" title="Mine exit → mine stockpile" detail={`${String(Math.floor(stockTotal(game.mineExit)))} staged at the exit · ${String(game.lastFlow.toMineStockpile).replace(/\.0$/, '')} unloaded last tick`} />
            <LogisticsStep index="04" title="Mine stockpile → warehouse" detail={`${String(buildingStats(game.buildings, workforceOf(game).staff).haulers)} haulers carry ${String(game.surfaceHaul)} per trip (×${String(haulFactor(haulWalk(game)))} for the walk) · ${String(game.lastFlow.toWarehouse).replace(/\.0$/, '')} delivered last tick`} />
          </View>

          <HaulagePanel
            sites={game.sites}
            carts={game.carts}
            coal={game.warehouse.coal}
            gold={game.gold}
            techs={game.techs}
            onBuyCart={game.buyCart}
          />

          <View style={styles.techSection}>
            <SectionLabel>MINE TECH TREE</SectionLabel>
            <Text style={styles.mineSubheading}>Upgrades bought with gold, for good</Text>
            <TechBranchView game={game} branch="mine" showName={false} />
          </View>

          <View style={styles.deeperSection}>
            <View style={styles.deeperCopy}>
              <SectionLabel>OPEN THE NEXT GALLERY</SectionLabel>
              <Text style={styles.mineSubheading}>
                {atBedrock ? 'The mine has reached bedrock' : `Depth ${String(game.depth + 1)} · +${String(MINE_STATIONS_PER_GALLERY)} work stations · +${String(VEIN_CAPACITY_PER_DEPTH)} vein capacity`}
              </Text>
            </View>
            <GameButton
              label={atBedrock ? 'BEDROCK' : 'DIG DEEPER'}
              detail={atBedrock ? `depth ${String(game.depth)} · maximum` : `${String(depthCost)} gold`}
              onPress={game.digDeeper}
              disabled={atBedrock || game.gold < depthCost}
            />
          </View>

          <View style={styles.backBar}><Text style={styles.backBarText}>SURFACE WAREHOUSE</Text><Text style={styles.backBarCoal}>{String(Math.floor(game.warehouse.coal))} COAL</Text><Text style={styles.backBarGold}>{String(game.gold)} G</Text></View>
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
  digBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  digToggle: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#d2a45f' },
  digToggleOn: { backgroundColor: '#d2a45f' },
  digToggleText: { color: '#e9c475', fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
  digToggleTextOn: { color: '#20231b' },
  digHint: { flex: 1, color: '#9da28d', fontFamily: 'monospace', fontSize: 9 },
  sceneCaption: { position: 'absolute', left: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5, paddingHorizontal: 8, backgroundColor: 'rgba(25, 31, 27, 0.9)' },
  captionText: { color: '#e7dfc6', fontFamily: 'monospace', fontSize: 8 },
  stockpiles: { gap: 10, paddingVertical: 16, borderBottomWidth: 1, borderColor: '#353b32' },
  logisticsSection: { paddingTop: 22 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9 },
  tickLabel: { color: '#7f8776', fontFamily: 'monospace', fontSize: 8 },
  logisticsStep: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: '#2f352d' },
  stepIndex: { width: 23, color: '#cb905e', fontFamily: 'monospace', fontSize: 10 },
  stepCopy: { flex: 1, gap: 4 },
  stepTitle: { color: '#e7e1d0', fontFamily: 'Georgia', fontSize: 14 },
  stepDetail: { color: '#87907f', fontFamily: 'monospace', fontSize: 9 },
  techSection: { gap: 10, paddingTop: 22 },
  deeperSection: { gap: 12, paddingTop: 22, paddingBottom: 20 },
  deeperCopy: { gap: 1 },
  backBar: { minHeight: 41, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 11, backgroundColor: '#1b2019' },
  backBarText: { flex: 1, color: '#89907e', fontFamily: 'monospace', fontSize: 8 },
  backBarCoal: { color: '#d6bb79', fontFamily: 'monospace', fontSize: 9 },
  backBarGold: { color: '#e5a565', fontFamily: 'monospace', fontSize: 9 },
  notice: { color: '#838b7a', fontFamily: 'monospace', fontSize: 9, marginTop: 12 },
});