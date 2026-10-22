import { useEffect, useMemo, useRef, useState } from 'react';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackHandler, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GameState } from '../game/state';
import { haulWalk, minersByLevel, selectMineLayout, workforceOf } from '../game/hold';
import { TUNNEL_WOOD, cartCost, getDepthCost, techBlocker, tileDigCost, tunnelCost } from '../game/costs';
import { MAX_DEPTH, MINE_STATIONS_PER_GALLERY, VEIN_CAPACITY_PER_DEPTH, useGame, useGameStore } from '../game/gameStore';
import { surveyCooldown, surveyCost, surveyProblem, surveyRadius } from '../game/survey';
import { haulFactor } from '../game/roads';
import { buildingStats } from '../game/buildings';
import { cartsOnLevel } from '../game/haulage';
import { techsOf } from '../game/techs';
import { findDigRoute, getDepositInfo, standingTargets, tileKey } from '../game/mineLayout';
import DepositPanel from '../components/DepositPanel';
import HaulagePanel from '../components/HaulagePanel';
import BinPanel, { type BinPlace } from '../components/BinPanel';
import LeavingAlert from '../components/LeavingAlert';
import MineBuildingPanel from '../components/MineBuildingPanel';
import { stockTotal, type Resource } from '../game/resources';
import { MINE_SURFACE_ROWS, type MineSurfaceBuilding } from '../components/MineMapLayout';
import MineScene from '../components/MineScene';
import { GameButton, LiveSignal, SectionLabel } from '../components/GameUI';
import RaidBanner from '../components/RaidBanner';
import Sheet from '../components/Sheet';
import { Toast, ToolButton } from '../components/Toolbar';
import MineCartIcon from '../components/MineCartIcon';
import { adBreak } from '../components/ads';
import { TechBranchView } from '../components/TechTree';

// Drawn once, so the Carts button's memo isn't broken by a new element every tick.
const CART_ICON = <MineCartIcon />;

const clock = (seconds: number) => `${String(Math.floor(seconds / 60))}:${String(Math.max(0, seconds % 60)).padStart(2, '0')}`;

// The mine, full screen: the map fills it; the way back to the city and the mine's numbers float over its
// top, the toolbar (Dig, Survey, Upgrades, Carts) over its bottom, and everything else opens as a pop-up —
// a tapped tile or bin as a card above the toolbar, the upgrades and the carts as sheets.
export default function MineScreen() {
  // Out of sight (under the battle), the mine skips the ticks.
  const focused = useIsFocused();
  const game = useGame(focused);
  const insets = useSafeAreaInsets();
  const layout = selectMineLayout(game);
  const [digMode, setDigMode] = useState(false);
  // Survey mode: a tap on a tunnel sends the surveyors out from there; it stays on until they set out
  // (a refusal shows as news).
  const [surveyMode, setSurveyMode] = useState(false);
  const surveyWait = Math.max(0, Math.ceil(game.surveyReadyAt - game.elapsedSeconds));
  const [popup, setPopup] = useState<'upgrades' | 'carts' | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // The resource whose bin was tapped (one card at a time: a bin or a tile).
  const [selectedBin, setSelectedBin] = useState<{ resource: Resource; place: BinPlace } | null>(null);
  // The surface building whose card is open (the headhouse, the storehouse, the cottage).
  const [selectedBuilding, setSelectedBuilding] = useState<MineSurfaceBuilding | null>(null);
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
  // The map fills the screen; the bars over it are measured so it can scroll clear of them.
  const { height: windowHeight } = useWindowDimensions();
  const [screenHeight, setScreenHeight] = useState(windowHeight);
  const [topHeight, setTopHeight] = useState(0);
  const [bottomHeight, setBottomHeight] = useState(0);
  const goToSurface = () => {
    // Going up to the city is a pause in play: an ad may show then (every few minutes).
    adBreak();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // Android's Back first leaves Dig or Survey mode, then closes the tile's or the bin's card (a sheet
  // closes itself), and only then goes up to the city.
  const back = useRef<() => boolean>(() => false);
  useEffect(() => {
    back.current = () => {
      if (!focused || popup) return false;
      if (digMode || surveyMode) {
        setDigMode(false);
        setSurveyMode(false);
        return true;
      }
      if (selectedKey || selectedBin || selectedBuilding) {
        setSelectedKey(null);
        setSelectedBin(null);
        setSelectedBuilding(null);
        return true;
      }
      return false;
    };
  });
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => back.current());
    return () => listener.remove();
  }, []);

  // Only live raids show over the map.
  const showRaid = !!game.raid || game.battle?.status === 'active';
  const mineTechsReady = techsOf('mine').filter((id) => !techBlocker(game, id)).length;
  const cartsToAdd = cartLevelsOpen(game);
  // Whoever waits at the campfire (nobody goes mining by themselves: ASSIGN sends them to the free faces).
  const waiting = workforceOf(game).idle;
  const hint = surveyMode
    ? `Tap a tunnel (green: they can set out from there, red: they can't): the surveyors map the rock ${String(surveyRadius(game.techs))} tiles all round it, from ${String(surveyCost(MINE_SURFACE_ROWS, game.techs))} gold (dearer deeper). They're then ready again after ${String(surveyCooldown(game.techs))} s.`
    : digMode
      ? `Drag from a tunnel across rock · from ${String(tileDigCost(game, 0))} gold and ${String(TUNNEL_WOOD)} wood per tile · two fingers, right-drag or arrow keys to move`
      : game.digPlan.length > 0
        ? `${String(game.digPlan.length)} tile${game.digPlan.length === 1 ? '' : 's'} left to dig`
        : null;

  return (
    <View style={styles.screen} onLayout={(event) => setScreenHeight(event.nativeEvent.layout.height)}>
      <StatusBar style="light" />
      <MineScene
        layout={layout}
        viewportHeight={screenHeight}
        insetTop={topHeight}
        insetBottom={bottomHeight}
        survey={surveyMode ? { radius: surveyRadius(game.techs), canSurveyFrom: (key) => !surveyProblem(game, layout, key) } : null}
        vein={game.vein}
        veinCapacity={game.veinCapacity}
        mineExit={game.mineExit}
        mineExitCapacity={game.mineExitCapacity}
        mineStock={game.mineStock}
        haulTime={game.haulTime}
        cartLoads={game.cartLoads}
        carts={game.carts}
        digPlan={game.digPlan}
        digProgress={game.digProgress}
        digMode={digMode}
        onPlanDig={game.planDig}
        depositMined={game.depositMined}
        selectedKey={selectedKey}
        onSelectTile={(key) => {
          setSelectedBin(null);
          setSelectedBuilding(null);
          if (surveyMode) {
            const before = useGameStore.getState().surveys.length;
            game.survey(key);
            if (useGameStore.getState().surveys.length > before) setSurveyMode(false);
            return;
          }
          setSelectedKey((current) => (current === key ? null : key));
        }}
        onSelectBin={(resource, place) => {
          setSelectedKey(null);
          setSelectedBuilding(null);
          setSelectedBin((current) => (current?.resource === resource && current.place === place ? null : { resource, place }));
        }}
        onSelectBuilding={(building) => {
          setSelectedKey(null);
          setSelectedBin(null);
          setSelectedBuilding((current) => (current === building ? null : building));
        }}
        onAssignTile={(key) => {
          setSelectedBin(null);
          setSelectedBuilding(null);
          setSelectedKey(key);
          game.assignMiner(key);
        }}
      />

      {/* Top: the mine's numbers, live raids */}
      <View
        style={[styles.top, { paddingTop: insets.top + 8, paddingLeft: insets.left + 10, paddingRight: insets.right + 10, pointerEvents: 'box-none' }]}
        onLayout={(event) => setTopHeight(event.nativeEvent.layout.height)}
      >
        <View style={[styles.topRow, { pointerEvents: 'box-none' }]}>
          <MineHud game={game} />
        </View>
        {showRaid && (
          <View style={styles.wide}>
            <RaidBanner />
          </View>
        )}
      </View>

      {/* Bottom: the tapped tile or bin, what the mode does, the latest news, and the toolbar */}
      <View
        style={[styles.bottom, { paddingBottom: insets.bottom + 8, paddingLeft: insets.left + 10, paddingRight: insets.right + 10, pointerEvents: 'box-none' }]}
        onLayout={(event) => setBottomHeight(event.nativeEvent.layout.height)}
      >
        {selected && (
          <View style={styles.wide}>
            <DepositPanel
              info={selected}
              idle={workforceOf(game).idle}
              gold={game.gold}
              wood={game.warehouse.wood}
              pending={selectedPending}
              route={selectedRoute}
              onAssign={() => game.assignMiner(selected.key)}
              onRelease={() => game.releaseMiner(selected.key)}
              onClose={() => setSelectedKey(null)}
            />
          </View>
        )}
        {selectedBin && (
          <View style={styles.wide}>
            <BinPanel
              resource={selectedBin.resource}
              place={selectedBin.place}
              amount={selectedBin.place === 'exit' ? game.mineExit[selectedBin.resource] : game.vein[selectedBin.resource]}
              capacity={selectedBin.place === 'exit' ? game.mineExitCapacity : game.veinCapacity}
              onClose={() => setSelectedBin(null)}
            />
          </View>
        )}
        {selectedBuilding && (
          <View style={styles.wide}>
            <MineBuildingPanel building={selectedBuilding} game={game} onAssign={game.autoAssignMine} onClose={() => setSelectedBuilding(null)} />
          </View>
        )}
        {hint && (
          <View style={[styles.hint, { pointerEvents: 'none' }]}>
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        )}
        <Toast notice={game.notice} fresh />
        <View style={styles.toolbar}>
          {/* Back up to the stronghold: first in the toolbar, under the thumb. */}
          <ToolButton icon="🏰" label="CITY" accessibilityLabel="Go up to the city" onPress={goToSurface} />
          <ToolButton
            icon="⛏️"
            label={digMode ? 'DIGGING' : 'DIG'}
            accessibilityLabel={digMode ? 'Stop digging and move the map' : 'Dig tunnels'}
            active={digMode}
            onPress={() => {
              setSurveyMode(false);
              setDigMode((on) => !on);
            }}
          />
          <ToolButton
            icon="🔦"
            label={surveyMode ? 'SURVEYING' : surveyWait > 0 ? clock(surveyWait) : 'SURVEY'}
            accessibilityLabel={surveyWait > 0 ? `The surveyors are ready in ${String(surveyWait)} seconds` : surveyMode ? 'Stop surveying' : 'Survey the dark rock from a tunnel'}
            active={surveyMode}
            disabled={surveyWait > 0}
            onPress={() => {
              setDigMode(false);
              setSurveyMode((on) => !on);
            }}
          />
          <ToolButton
            icon="👷"
            label="ASSIGN"
            accessibilityLabel={`Auto-assign: send the ${String(waiting)} peasants at the campfire to the free faces`}
            badge={waiting > 0 ? String(waiting) : undefined}
            onPress={game.autoAssignMine}
          />
          <ToolButton icon="📜" label="UPGRADES" badge={mineTechsReady > 0 ? String(mineTechsReady) : undefined} onPress={() => setPopup('upgrades')} />
          <ToolButton icon={CART_ICON} label="CARTS" badge={cartsToAdd > 0 ? String(cartsToAdd) : undefined} onPress={() => setPopup('carts')} />
        </View>
      </View>

      {!popup && <LeavingAlert game={game} />}
      {popup === 'upgrades' && (
        <Sheet title="Mine upgrades" subtitle="THE NEXT GALLERY · TECHS BOUGHT WITH GOLD, FOR GOOD" onClose={() => setPopup(null)}>
          <NextGallery game={game} />
          <SectionLabel>MINE TECH TREE</SectionLabel>
          <TechBranchView game={game} branch="mine" showName={false} />
        </Sheet>
      )}
      {popup === 'carts' && (
        <Sheet title="Carts and hauling" subtitle="MINE CARTS · THE HAULING CHAIN" onClose={() => setPopup(null)}>
          <HaulagePanel sites={game.sites} carts={game.carts} coal={game.warehouse.coal} gold={game.gold} techs={game.techs} onBuyCart={game.buyCart} />
          <HaulingChain game={game} />
        </Sheet>
      )}
    </View>
  );
}

/** Levels where a cart could be added now (fewer carts than miners, and the coal and gold for one). */
function cartLevelsOpen(game: GameState) {
  let open = 0;
  for (const [level, miners] of minersByLevel(game.sites)) {
    const current = cartsOnLevel(game.carts, level);
    const cost = cartCost(current, game.techs);
    if (current < miners && game.warehouse.coal >= cost.coal && game.gold >= cost.gold) open++;
  }
  return open;
}

// The mine's numbers over the top of the map: gold and wood (what digging costs), the miners and the
// peasants free to join them, the coal they cut, and the raid clock.
function MineHud({ game }: { game: GameState }) {
  const raidIn = game.raid ? null : game.nextRaidAt - game.elapsedSeconds;
  return (
    <View style={styles.hud}>
      <Stat label="GOLD" value={Math.floor(game.gold).toLocaleString()} tone="#e5a565" />
      <Stat label="WOOD" value={Math.floor(game.warehouse.wood).toLocaleString()} tone="#d6bb79" />
      <Stat label={`MINERS · ${String(workforceOf(game).idle)} WAITING`} value={String(game.sites.length + game.pendingSites.length)} tone="#c0cd83" />
      {raidIn !== null && <Stat label={`RAID ${String(game.raidsFought + 1)}`} value={clock(Math.ceil(raidIn))} tone="#e08a72" />}
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
    </View>
  );
}

// Dig Deeper: the next gallery, at the top of the upgrades sheet.
function NextGallery({ game }: { game: GameState }) {
  const depthCost = getDepthCost(game.depth, game.techs);
  const atBedrock = game.depth >= MAX_DEPTH;
  return (
    <View style={styles.deeper}>
      <SectionLabel>OPEN THE NEXT GALLERY</SectionLabel>
      <Text style={styles.subheading}>
        {String(game.depth)} {game.depth === 1 ? 'gallery' : 'galleries'} open.{' '}
        {atBedrock ? 'The mine has reached bedrock.' : `Gallery ${String(game.depth + 1)}: +${String(MINE_STATIONS_PER_GALLERY)} work stations, +${String(VEIN_CAPACITY_PER_DEPTH)} vein capacity.`}
      </Text>
      <GameButton
        label={atBedrock ? 'BEDROCK' : 'DIG DEEPER'}
        detail={atBedrock ? `depth ${String(game.depth)} · maximum` : `${String(depthCost)} gold`}
        onPress={game.digDeeper}
        disabled={atBedrock || game.gold < depthCost}
      />
    </View>
  );
}

// How the ore gets from the miners to the warehouse, step by step, with last tick's flow.
function HaulingChain({ game }: { game: GameState }) {
  return (
    <View>
      <View style={styles.sectionHeading}>
        <View><SectionLabel>HAULING CHAIN</SectionLabel><Text style={styles.subheading}>Every resource keeps moving while you build.</Text></View>
        <Text style={styles.tickLabel}>1 SEC / TICK</Text>
      </View>
      <LogisticsStep index="01" title="Miners dig" detail={`${String(game.sites.length)} working miners · ${String(game.minerRate)} / sec each`} live />
      <LogisticsStep index="02" title="Miners → mine exit" detail={`Mine carts carry ${String(game.mineCartCapacity)} per load · ${String(game.lastFlow.toMineExit).replace(/\.0$/, '')} tipped last tick`} />
      <LogisticsStep index="03" title="Mine exit → mine stockpile" detail={`${String(Math.floor(stockTotal(game.mineExit)))} staged at the exit · ${String(game.lastFlow.toMineStockpile).replace(/\.0$/, '')} unloaded last tick`} />
      <LogisticsStep index="04" title="Mine stockpile → warehouse" detail={`${String(buildingStats(game.buildings, workforceOf(game).staff).haulers)} haulers carry ${String(game.surfaceHaul)} per trip (×${String(haulFactor(haulWalk(game)))} for the walk) · ${String(game.lastFlow.toWarehouse).replace(/\.0$/, '')} delivered last tick`} />
      <View style={styles.warehouseBar}><Text style={styles.warehouseText}>SURFACE WAREHOUSE</Text><Text style={styles.warehouseCoal}>{String(Math.floor(game.warehouse.coal))} COAL</Text><Text style={styles.warehouseGold}>{String(Math.floor(game.gold))} G</Text></View>
    </View>
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
  screen: { flex: 1, backgroundColor: '#0d0a08' },
  pressed: { opacity: 0.7 },
  wide: { alignSelf: 'center', width: '100%', maxWidth: 720 },

  top: { position: 'absolute', left: 0, right: 0, top: 0, gap: 8 },
  topRow: { alignSelf: 'center', width: '100%', maxWidth: 720, flexDirection: 'row', gap: 8 },
  hud: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 8, padding: 10, borderWidth: 1, borderColor: '#3a4439', backgroundColor: 'rgba(17, 20, 16, 0.88)' },
  stat: { flexShrink: 1, gap: 2 },
  statLabel: { color: '#89907f', fontFamily: 'monospace', fontSize: 8 },
  statValue: { fontFamily: 'Georgia', fontSize: 17, fontWeight: 'bold' },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 8, alignItems: 'center' },
  hint: { width: '100%', maxWidth: 720, paddingHorizontal: 12, paddingVertical: 8, borderLeftWidth: 2, borderLeftColor: '#d2a45f', backgroundColor: 'rgba(17, 20, 16, 0.92)' },
  hintText: { color: '#e9c475', fontFamily: 'monospace', fontSize: 10 },
  toolbar: { flexDirection: 'row', width: '100%', maxWidth: 720, gap: 6 },

  subheading: { color: '#e7e2d2', fontFamily: 'Georgia', fontSize: 15, marginTop: 4 },
  deeper: { gap: 10, paddingBottom: 8 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9 },
  tickLabel: { color: '#7f8776', fontFamily: 'monospace', fontSize: 8 },
  logisticsStep: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: '#2f352d' },
  stepIndex: { width: 23, color: '#cb905e', fontFamily: 'monospace', fontSize: 10 },
  stepCopy: { flex: 1, gap: 4 },
  stepTitle: { color: '#e7e1d0', fontFamily: 'Georgia', fontSize: 14 },
  stepDetail: { color: '#87907f', fontFamily: 'monospace', fontSize: 9 },
  warehouseBar: { minHeight: 41, flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 12, paddingHorizontal: 11, backgroundColor: '#1b2019' },
  warehouseText: { flex: 1, color: '#89907e', fontFamily: 'monospace', fontSize: 8 },
  warehouseCoal: { color: '#d6bb79', fontFamily: 'monospace', fontSize: 9 },
  warehouseGold: { color: '#e5a565', fontFamily: 'monospace', fontSize: 9 },
});
