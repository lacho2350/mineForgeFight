import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GameState } from '../game/state';
import { flushSave } from '../game/save';
import { BUILDING_NAMES, haulWalk, isShownBuilding, orderedRocks, workforceOf } from '../game/hold';
import { canAffordBuild, roadCostText, trapBlocker, trapCostText, upgradeBlocker } from '../game/costs';
import { useGame, useGameStore } from '../game/gameStore';
import { BUILDING_IDS, BUILDING_INFO, MAX_BUILDING_LEVEL, buildingCost, buildingStats, taxPerMinute, type BuildingId } from '../game/buildings';
import { HOUSE_IDS, isHouse, type HouseId } from '../game/houses';
import { PANTRY, errandText, hasHomeRoad, isKept, sleepers } from '../game/homes';
import { fellingStand, forestWood } from '../game/forest';
import { FOODS, isFishery, isPasture } from '../game/farms';
import { isWoodcutter } from '../game/woodcutters';
import { MAX_HAPPINESS, moodDrift, moodFactors, moodWord, workPaceAt } from '../game/happiness';
import { TAX_INFO, TAX_RATES, type TaxRate } from '../game/taxes';
import { DEFAULT_SPOTS, FOOTPRINTS, MAP_SIZE, SIDE_NAMES, buildSpots, coveredTiles, doorText, doorTiles, isOpenGround, onMainRoad, isPlaceable, nearestFreeSpot, needsRoad, placementProblem, sidesOf, tileKey, zoneAt, type Spot } from '../game/cityMap';
import { GROUND_SPEED, ROAD_INFO, ROAD_KINDS, accessRoads, haulFactor, roadProblem, type RoadKind, type Roads } from '../game/roads';
import { CLEAR_CREW, ROCK_INFO, rockAt, rockyTest, rocksLeft } from '../game/rocks';
import { BOAT_INFO, fishingBoat, nextBoat } from '../game/boats';
import { isMoored } from '../game/ship';
import { TRAP_DAMAGE, TRAP_INFO, TRAP_KINDS, TRAP_REFUND, trapAt, trapCounts, trapProblem, trapsFacing, type TrapKind } from '../game/traps';
import { BUILDING_ICONS, ROAD_ICONS, TRAP_ICONS } from '../components/buildingIcons';
import { plotOf } from '../components/GameSceneLayout';
import { vacancies, type Workforce } from '../game/workforce';
import { BuildingDetail, BuildingGrid, DefenceSummary } from '../components/BuildingsPanel';
import CityView from '../components/CityView';
import { GameButton, SectionLabel } from '../components/GameUI';
import BargesPanel from '../components/BargesPanel';
import { DepotPanel, ForgePanel, GearStore } from '../components/ForgePanel';
import { isForge } from '../game/forges';
import CombatPanel, { hireableNow } from '../components/CombatPanel';
import RaidBanner from '../components/RaidBanner';
import Sheet from '../components/Sheet';
import Prologue from '../components/Prologue';
import Victory from '../components/Victory';
import { CAMPAIGN_BATTLES, CAMPAIGN_STAGES, nextStage } from '../game/campaign';
import ShopPanel from '../components/ShopPanel';
import { adBreak } from '../components/ads';
import { warmMine } from '../components/mineWarmup';
import { Toast, ToolButton } from '../components/Toolbar';
import StockpileTable from '../components/StockpileTable';
import { TechTree, techsReady } from '../components/TechTree';

type Popup =
  | { kind: 'building'; id: BuildingId }
  | { kind: 'trap'; x: number; y: number }
  | { kind: 'road'; x: number; y: number }
  | { kind: 'ground'; x: number; y: number }
  | { kind: 'build' }
  | { kind: 'market' }
  | { kind: 'buildings' }
  | { kind: 'tech' }
  | { kind: 'menu' }
  | { kind: 'mood' }
  | { kind: 'combat' }
  | { kind: 'leave' }
  | null;
/** A building being placed and where its footprint is now. */
type Placing = { id: BuildingId; x: number; y: number } | null;
/** Painting roads (or taking them up), traps, or rocks to clear across the map, a stroke at a time. */
type Painting = { tool: 'road'; kind: RoadKind | 'erase' } | { tool: 'trap'; kind: TrapKind } | { tool: 'clear'; kind: 'rocks' };

// The tiles from one tile to another, one step at a time along the grid (so a quick stroke has no gaps).
function stepsBetween(from: Spot, to: Spot): Spot[] {
  const steps: Spot[] = [];
  let { x, y } = from;
  while (x !== to.x || y !== to.y) {
    if (Math.abs(to.x - x) >= Math.abs(to.y - y)) x += Math.sign(to.x - x);
    else y += Math.sign(to.y - y);
    steps.push({ x, y });
  }
  return steps;
}

const clock = (seconds: number) => `${String(Math.floor(Math.max(0, seconds) / 60))}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;

/** Tells whether a road runs over a tile (buildings can't stand on roads). */
const roadTest = (roads: Roads) => (x: number, y: number) => !!roads[tileKey(x, y)];

// The stronghold, full screen: the castle map under a resource bar, a toolbar at the bottom, and
// pop-ups for buildings, the market, the building list and the menu.
export default function StrongholdScreen() {
  const focused = useIsFocused();
  // Out of sight (under the mine or the battle), the stronghold skips the ticks.
  const game = useGame(focused);
  const insets = useSafeAreaInsets();
  const [popup, setPopup] = useState<Popup>(null);
  // The prologue: before a new game, and again from the menu. The victory epilogue: again from the menu.
  const [replaying, setReplaying] = useState(false);
  const [replayingVictory, setReplayingVictory] = useState(false);
  const [placing, setPlacing] = useState<Placing>(null);
  const [painting, setPainting] = useState<Painting | null>(null);
  const [stroke, setStroke] = useState<Spot[]>([]);
  const [paintResult, setPaintResult] = useState<string | null>(null);
  // The stroke as the finger moves (state lags behind the gesture's calls).
  const strokeRef = useRef<Spot[]>([]);
  const [hudHeight, setHudHeight] = useState(110);
  const [barHeight, setBarHeight] = useState(70);
  const workforce = workforceOf(game);
  const techReady = techsReady(game);
  const moored = game.barges.filter((barge) => isMoored(barge, game.elapsedSeconds)).length;

  const openBuilding = useCallback((id: BuildingId) => setPopup({ kind: 'building', id }), []);
  const openWar = useCallback(() => setPopup({ kind: 'combat' }), []);
  // Where a building picked from the palette starts: its usual spot, or the open ground tapped (Build here).
  const buildHere = useRef<Spot | null>(null);
  const openBuild = useCallback(() => {
    buildHere.current = null;
    setPopup({ kind: 'build' });
  }, []);
  const openBuildings = useCallback(() => setPopup({ kind: 'buildings' }), []);
  const openTech = useCallback(() => setPopup({ kind: 'tech' }), []);
  const openDocks = useCallback(() => setPopup({ kind: 'market' }), []);
  const openMenu = useCallback(() => setPopup({ kind: 'menu' }), []);
  const openMood = useCallback(() => setPopup({ kind: 'mood' }), []);
  // Going down the mine and closing a pop-up are pauses in play: an ad may show then (every few minutes).
  // The mine's first blocks are drawn before the screen opens, so it doesn't open on black rock.
  const openMine = useCallback(() => {
    adBreak();
    warmMine();
    router.push('/mine');
  }, []);
  const close = () => {
    setPopup(null);
    adBreak();
  };

  // Placement: start at the building's usual spot (or the nearest free one), move it with taps.
  const startPlacing = useCallback((id: BuildingId) => {
    const { clearedRocks, roads, placements } = useGameStore.getState();
    const { w, d } = FOOTPRINTS[id];
    const tapped = buildHere.current;
    buildHere.current = null;
    const preferred = tapped
      ? { x: Math.min(MAP_SIZE - w, Math.max(0, tapped.x - Math.floor(w / 2))), y: Math.min(MAP_SIZE - d, Math.max(0, tapped.y - Math.floor(d / 2))) }
      : (DEFAULT_SPOTS[id] ?? { x: Math.floor(MAP_SIZE / 2), y: MAP_SIZE - 6 });
    const rocky = rockyTest(clearedRocks);
    const road = roadTest(roads);
    // The nearest spot that fits (with a road at the door), else the nearest one off the roads and rocks,
    // to be moved to a road from there.
    const access = accessRoads(roads);
    const spot = placementProblem(id, preferred, placements, BUILDING_NAMES, rocky, road, access)
      ? (nearestFreeSpot(id, preferred, placements, BUILDING_NAMES, rocky, road, access) ?? nearestFreeSpot(id, preferred, placements, BUILDING_NAMES, rocky, road))
      : preferred;
    setPopup(null);
    setPlacing({ id, ...(spot ?? preferred) });
  }, []);
  const startPainting = useCallback((next: Painting) => {
    setPopup(null);
    setPainting(next);
    setPaintResult(null);
  }, []);
  // Painting: every tile the finger crosses joins the stroke; lifting it lays (or takes up) the lot.
  const paintTile = useCallback((x: number, y: number) => {
    const current = strokeRef.current;
    const last = current[current.length - 1];
    const steps = last ? stepsBetween(last, { x, y }) : [{ x, y }];
    const fresh = steps.filter((step) => !current.some((tile) => tile.x === step.x && tile.y === step.y));
    if (fresh.length === 0) return;
    strokeRef.current = [...current, ...fresh];
    setStroke(strokeRef.current);
  }, []);
  // Android's Back cancels placing or painting (an open pop-up closes itself, see Sheet).
  const busy = !!placing || !!painting;
  useEffect(() => {
    if (!busy || !focused) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      setPlacing(null);
      setPainting(null);
      return true;
    });
    return () => back.remove();
  }, [busy, focused]);
  // On the bare map, Android's Back would leave the app at once: ask first ("Leave Greyhollow?", a pop-up
  // like any other, so Back on it just stays). The prologue listens for itself while it's showing.
  const storyShowing = !game.prologueSeen || replaying || (game.campaign.victory && !game.campaign.victorySeen) || replayingVictory;
  const bare = !busy && !popup && focused && !storyShowing && Platform.OS === 'android';
  useEffect(() => {
    if (!bare) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      setPopup({ kind: 'leave' });
      return true;
    });
    return () => back.remove();
  }, [bare]);
  const finishStroke = useCallback((commit: boolean) => {
    const tiles = strokeRef.current;
    strokeRef.current = [];
    setStroke([]);
    if (!commit || !painting || tiles.length === 0) return;
    const state = useGameStore.getState();
    if (painting.tool === 'road') state.layRoads(painting.kind, tiles);
    else if (painting.tool === 'trap') state.layTraps(painting.kind, tiles);
    else state.clearRocks(tiles);
    setPaintResult(useGameStore.getState().notice);
  }, [painting]);
  // Dragging the new building: its footprint's corner follows the finger, kept on the map.
  const dragGhost = useCallback((x: number, y: number) => {
    setPlacing((current) => {
      if (!current) return current;
      const { w, d } = FOOTPRINTS[current.id];
      return { ...current, x: Math.min(MAP_SIZE - w, Math.max(0, x)), y: Math.min(MAP_SIZE - d, Math.max(0, y)) };
    });
  }, []);
  const placeAt = useCallback((x: number, y: number) => {
    setPlacing((current) => {
      if (!current) return current;
      const { w, d } = FOOTPRINTS[current.id];
      // Centre the footprint on the tapped point, kept on the map.
      return {
        ...current,
        x: Math.min(MAP_SIZE - w, Math.max(0, Math.round(x - w / 2))),
        y: Math.min(MAP_SIZE - d, Math.max(0, Math.round(y - d / 2))),
      };
    });
  }, []);
  // A tap on the ground opens what lies there: a trap, a road, rocks, or open ground inside the wall.
  const tapGround = useCallback((x: number, y: number) => {
    const state = useGameStore.getState();
    const tile = { x: Math.floor(x), y: Math.floor(y) };
    const trap = trapAt(state.traps, tile.x, tile.y);
    if (trap) setPopup({ kind: 'trap', x: trap.x, y: trap.y });
    else if (state.roads[tileKey(tile.x, tile.y)]) setPopup({ kind: 'road', ...tile });
    else if (zoneAt(tile.x, tile.y) === 'town' && isOpenGround(tile.x, tile.y) && !coveredTiles(state.placements).has(tileKey(tile.x, tile.y))) {
      setPopup({ kind: 'ground', ...tile });
    }
  }, []);
  const { roads, traps, clearedRocks, clearOrders, placements } = game;
  const spotProblem = placing ? placementProblem(placing.id, placing, placements, BUILDING_NAMES, rockyTest(clearedRocks), roadTest(roads), accessRoads(roads)) : null;
  const covered = useMemo(() => coveredTiles(placements), [placements]);
  // Where the building being placed may go: lit while placing, yellow where rocks must be cleared first.
  const placingId = placing?.id;
  const spots = useMemo(() => (placingId ? buildSpots(placingId, placements, roadTest(roads), rockyTest(clearedRocks)) : null), [placingId, placements, roads, clearedRocks]);
  const ghost = useMemo(() => {
    if (painting) {
      const ordered = orderedRocks(clearOrders);
      const ok = (tile: Spot) => {
        if (painting.tool === 'road') return !roadProblem(tile, painting.kind, roads, covered, clearedRocks);
        if (painting.tool === 'trap') return !trapProblem(tile, traps);
        return rockAt(clearedRocks, tile.x, tile.y) > 0 && !ordered.has(`${String(tile.x)},${String(tile.y)}`);
      };
      return { plot: null, valid: true, belt: painting.tool === 'trap', tiles: stroke.map((tile) => ({ ...tile, ok: ok(tile) })) };
    }
    if (!placing) return null;
    // The tiles in front of the door, green where a road joined to the keep and the gate reaches them.
    const access = accessRoads(roads);
    const doors = needsRoad(placing.id) ? doorTiles(placing.id, placing).map((tile) => ({ ...tile, ok: access.has(tileKey(tile.x, tile.y)) })) : undefined;
    return { plot: plotOf(placing.id, {}, placing), valid: !spotProblem, allowed: spots?.clear, rocky: spots?.rocky, water: isFishery(placing.id), doors };
  }, [painting, stroke, roads, traps, clearedRocks, clearOrders, covered, placing, spotProblem, spots]);
  const confirmPlacing = () => {
    if (!placing) return;
    game.placeBuilding(placing.id, { x: placing.x, y: placing.y });
    if (useGameStore.getState().placements[placing.id]) setPlacing(null);
  };
  // Only live raids show over the map; the last battle's result is in the menu.
  const showRaid = !!game.raid || game.battle?.status === 'active';
  const hireable = hireableNow(game, workforce);
  // Peasants at the campfire who'd fill empty spots in the buildings.
  const staffable = Math.min(workforce.idle, vacancies(workforce));

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <CityView
        buildings={game.buildings}
        placements={game.placements}
        ghost={ghost}
        onPlaceAt={placeAt}
        onDragGhost={dragGhost}
        painting={!!painting}
        onPaint={paintTile}
        onPaintEnd={finishStroke}
        selected={popup?.kind === 'building' ? popup.id : null}
        onSelect={openBuilding}
        onTapGround={tapGround}
        active={focused}
        insetTop={hudHeight}
        insetBottom={barHeight}
      />

      {/* Top: resources, peasants, the raid clock */}
      <View style={[styles.top, { paddingTop: insets.top + 8, pointerEvents: 'box-none' }]} onLayout={(event) => setHudHeight(event.nativeEvent.layout.height)}>
        <Hud game={game} workforce={workforce} onMood={openMood} />
        {showRaid && (
          <View style={styles.raid}>
            <RaidBanner />
          </View>
        )}
      </View>

      {/* The War button on the side: raids, the army and the defences */}
      {!placing && !painting && (
        <View style={[styles.side, { top: hudHeight + 12 }]}>
          <SideButton
            icon="⚔️"
            label="War: raids, the army and the defences"
            onPress={openWar}
            alarm={!!game.raid || game.battle?.status === 'active'}
            badge={hireable > 0 ? String(hireable) : undefined}
          />
          {/* Staff the buildings: whoever waits at the campfire fills their empty spots (nobody goes by themselves). */}
          <SideButton
            icon="👷"
            label="Auto-assign: staff the buildings from the campfire"
            onPress={game.autoAssignCity}
            alarm={false}
            badge={staffable > 0 ? String(staffable) : undefined}
          />
          {/* The campaign (campaign.ts): the road to Aldmere, once the first angel is raised; the badge is the next site. */}
          {game.campaign.unlocked && (
            <SideButton
              icon="🗺️"
              label="The campaign: the road to Aldmere"
              onPress={() => router.push('/campaign')}
              alarm={game.battle?.status === 'active' && !!game.battle.campaign}
              badge={game.campaign.victory ? '★' : `${String(game.campaign.won)}/${String(CAMPAIGN_BATTLES)}`}
            />
          )}
        </View>
      )}

      {/* Bottom: the latest news and the toolbar */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 8, pointerEvents: 'box-none' }]} onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)}>
        {painting ? (
          <PaintBar game={game} painting={painting} result={paintResult} onPick={startPainting} onDone={() => setPainting(null)} />
        ) : placing ? (
          <PlacementBar
            game={game}
            id={placing.id}
            problem={spotProblem ?? upgradeBlocker(game, placing.id, workforce)}
            onConfirm={confirmPlacing}
            onCancel={() => setPlacing(null)}
          />
        ) : (
          <>
            <Toast notice={game.notice} />
            <View style={styles.toolbar}>
              <ToolButton icon="⛏️" label="MINE" onPress={openMine} />
              <ToolButton icon="🔨" label="BUILD" onPress={openBuild} />
              <ToolButton icon="🏰" label="BUILDINGS" onPress={openBuildings} badge={game.construction.length > 0 ? String(game.construction.length) : undefined} />
              <ToolButton icon="📜" label="TECH" onPress={openTech} badge={techReady > 0 ? String(techReady) : undefined} />
              <ToolButton icon="⚓" label="DOCKS" onPress={openDocks} badge={moored > 0 ? String(moored) : undefined} />
              <ToolButton icon="☰" label="MENU" onPress={openMenu} />
            </View>
          </>
        )}
      </View>

      {popup?.kind === 'building' && (
        <Sheet
          title={BUILDING_INFO[popup.id].name}
          subtitle={`LEVEL ${String(game.buildings[popup.id])} / ${String(MAX_BUILDING_LEVEL)}`}
          onClose={close}
        >
          <BuildingDetail
            game={game}
            workforce={workforce}
            id={popup.id}
            bare
            onChooseSpot={isPlaceable(popup.id) && !game.placements[popup.id] ? () => startPlacing(popup.id) : undefined}
            onDestroyed={close}
          />
          {popup.id === 'keep' && <TaxStatus game={game} />}
          {popup.id === 'keep' && <DefenceSummary game={game} workforce={workforce} />}
          {popup.id === 'warehouse' && <Stockpiles game={game} />}
          {isWoodcutter(popup.id) && <ForestStatus game={game} />}
          {isHouse(popup.id) && game.buildings[popup.id] > 0 && <HomeStatus game={game} id={popup.id} />}
          {isFishery(popup.id) && <BoatStatus level={game.buildings[popup.id]} />}
          {popup.id === 'docks' && <BargesPanel game={game} />}
          {popup.id === 'armory' && <GearStore game={game} />}
          {isForge(popup.id) && <ForgePanel game={game} forge={popup.id} />}
          {popup.id === 'depot' && <DepotPanel game={game} />}
        </Sheet>
      )}
      {popup?.kind === 'road' && (
        <RoadSheet
          game={game}
          x={popup.x}
          y={popup.y}
          onClose={close}
          onClearMore={() => {
            close();
            startPainting({ tool: 'road', kind: 'erase' });
          }}
        />
      )}
      {popup?.kind === 'ground' && (
        <GroundSheet
          game={game}
          x={popup.x}
          y={popup.y}
          onClose={close}
          onPaint={startPainting}
          onBuild={() => {
            buildHere.current = { x: popup.x, y: popup.y };
            setPopup({ kind: 'build' });
          }}
        />
      )}
      {popup?.kind === 'trap' && (
        <TrapSheet game={game} x={popup.x} y={popup.y} onClose={close} />
      )}
      {popup?.kind === 'build' && (
        <Sheet title="Build" subtitle="PICK A BUILDING OR A TRAP, THEN TAP THE MAP" onClose={close}>
          <BuildPalette game={game} onPick={startPlacing} onPaint={startPainting} />
        </Sheet>
      )}
      {popup?.kind === 'market' && (
        <Sheet title="Docks" subtitle="BARGES WAIT AT THE DOCKS UNTIL THEIR ORDERS ARE FILLED" onClose={close}>
          <BargesPanel game={game} />
        </Sheet>
      )}
      {popup?.kind === 'buildings' && (
        <Sheet title="Buildings" subtitle="TAP ONE TO OPEN IT" onClose={close}>
          <DefenceSummary game={game} workforce={workforce} />
          <BuildingGrid game={game} workforce={workforce} selected={null} onSelect={openBuilding} />
        </Sheet>
      )}
      {popup?.kind === 'tech' && (
        <Sheet title="Tech tree" subtitle="UPGRADES FOR EVERY BUILDING AND THE MINE · PAID IN GOLD" onClose={close}>
          <TechTree game={game} />
        </Sheet>
      )}
      {popup?.kind === 'combat' && (
        <Sheet title="War" subtitle="RAIDS, THE ARMY AND THE DEFENCES" onClose={close}>
          <CombatPanel
            game={game}
            workforce={workforce}
            onOpenBuilding={openBuilding}
            onLayTraps={() => startPainting({ tool: 'trap', kind: 'spikes' })}
          />
        </Sheet>
      )}
      {popup?.kind === 'menu' && (
        <Sheet title="The hold" subtitle="PEASANTS, STOCKPILES AND THE GAME" onClose={close}>
          <Menu
            game={game}
            workforce={workforce}
            onPrologue={() => {
              setPopup(null);
              setReplaying(true);
            }}
            onVictory={() => {
              setPopup(null);
              setReplayingVictory(true);
            }}
          />
        </Sheet>
      )}
      {popup?.kind === 'mood' && (
        <Sheet title="Happiness" subtitle={`${moodWord(game.happiness).toUpperCase()} · THE HOLD WORKS AT ${String(Math.round(workPaceAt(game.happiness) * 100))}%`} onClose={close}>
          <MoodPanel game={game} workforce={workforce} />
        </Sheet>
      )}
      {popup?.kind === 'leave' && (
        <Sheet title="Leave Greyhollow?" subtitle="THE HOLD IS SAVED AS IT STANDS" onClose={() => setPopup(null)}>
          <Text style={styles.body}>The game is saved on this device and goes on from here when you come back. The mine and the hold rest while you are away.</Text>
          <GameButton label="STAY" detail="back to the hold" onPress={() => setPopup(null)} secondary />
          <GameButton
            label="LEAVE"
            detail="close the game"
            onPress={() => {
              flushSave();
              BackHandler.exitApp();
            }}
          />
        </Sheet>
      )}
      {(!game.prologueSeen || replaying) && (
        <Prologue
          onDone={() => {
            setReplaying(false);
            if (!game.prologueSeen) game.seePrologue();
          }}
        />
      )}
      {/* The war is won: the epilogue, once (and again from the Menu). */}
      {game.prologueSeen && !replaying && ((game.campaign.victory && !game.campaign.victorySeen) || replayingVictory) && (
        <Victory
          onDone={() => {
            setReplayingVictory(false);
            if (!game.campaign.victorySeen) game.seeVictory();
          }}
        />
      )}
    </View>
  );
}

// ——— The resource bar ———

function Hud({ game, workforce, onMood }: { game: GameState; workforce: Workforce; onMood: () => void }) {
  const beds = buildingStats(game.buildings, workforce.staff, game.techs).beds;
  const happiness = Math.round(game.happiness);
  const raidIn = game.raid ? null : game.nextRaidAt - game.elapsedSeconds;
  // Cottages out of water or food, or with no road to the keep and the gate: their sleepers work slower.
  const dry = HOUSE_IDS.filter((id) => game.buildings[id] > 0 && !isKept(game.homes[id])).length;
  const cutOff = HOUSE_IDS.filter((id) => game.buildings[id] > 0 && !hasHomeRoad(id, game)).length;
  return (
    <View style={styles.hud}>
      <View style={styles.hudRow}>
        <Stat label="GOLD" value={Math.floor(game.gold).toLocaleString()} tone="#e5a565" />
        <Stat
          label={cutOff > 0 ? `PEASANTS · ${String(cutOff)} HOME${cutOff === 1 ? '' : 'S'} NO ROAD` : `PEASANTS · ${String(workforce.idle)} IDLE`}
          value={`${String(game.population)}/${String(beds)}`}
          tone={cutOff > 0 ? '#e08a72' : '#c0cd83'}
        />
        <Stat
          label={game.hungry ? 'FOOD · HUNGRY' : dry > 0 ? `FOOD · ${String(dry)} HOME${dry === 1 ? '' : 'S'} DRY` : 'FOOD'}
          value={Math.floor(FOODS.reduce((sum, food) => sum + game.warehouse[food], 0)).toLocaleString()}
          tone={game.hungry || dry > 0 ? '#e08a72' : '#d6bb79'}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={`Happiness ${String(happiness)}: ${moodWord(game.happiness)}`} onPress={onMood} style={({ pressed }) => pressed && styles.pressed}>
          <Stat label={`MOOD · ${moodWord(game.happiness).toUpperCase()}`} value={String(happiness)} tone={moodTone(game.happiness)} />
        </Pressable>
        {raidIn !== null && <Stat label={`RAID ${String(game.raidsFought + 1)}`} value={clock(raidIn)} tone="#e08a72" />}
      </View>
    </View>
  );
}

/** The colour of a happiness: green while content, amber while grumbling, red once the peasants are unhappy. */
const moodTone = (happiness: number) => (happiness >= 60 ? '#c0cd83' : happiness >= 40 ? '#d6bb79' : '#e08a72');

// The happiness sheet: the number, everything moving it, in points a minute, and the keep's tax rate.
function MoodPanel({ game, workforce }: { game: GameState; workforce: Workforce }) {
  const factors = moodFactors({ ...game, staff: workforce.staff });
  const drift = moodDrift(factors);
  const sign = (value: number) => (value > 0 ? `+${String(value)}` : String(value));
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <Text style={[styles.moodValue, { color: moodTone(game.happiness) }]}>{String(Math.round(game.happiness))} / {String(MAX_HAPPINESS)}</Text>
        <Text style={[styles.body, { color: drift >= 0 ? '#c0cd83' : '#e08a72' }]}>{sign(drift)} A MINUTE</Text>
      </View>
      <Text style={styles.body}>
        The peasants work at half speed at 0 and full speed at 100. At 0 one of them leaves every half minute, and nobody new comes until the hold cheers up.
      </Text>
      {factors.map((factor) => (
        <View key={factor.id} style={styles.moodRow}>
          <View style={styles.moodCopy}>
            <Text style={styles.moodLabel}>{factor.label.toUpperCase()}</Text>
            <Text style={styles.note}>{factor.detail}</Text>
          </View>
          <Text style={[styles.moodPoints, { color: factor.perMinute > 0 ? '#c0cd83' : factor.perMinute < 0 ? '#e08a72' : '#858d7c' }]}>{sign(factor.perMinute)}</Text>
        </View>
      ))}
      <TaxRateChips game={game} />
    </View>
  );
}

// The keep's tax rate: no taxes to cruel, each with what it brings in and what the peasants think of it.
function TaxRateChips({ game }: { game: GameState }) {
  const stats = buildingStats(game.buildings, undefined, game.techs);
  const onPick = (rate: TaxRate) => game.setTaxRate(rate);
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <SectionLabel>TAXES</SectionLabel>
        <Text style={styles.note}>{taxPerMinute(stats, game.population, game.taxRate).toLocaleString()} GOLD / MIN</Text>
      </View>
      <View style={styles.trapKinds}>
        {TAX_RATES.map((rate) => {
          const on = rate === game.taxRate;
          const info = TAX_INFO[rate];
          return (
            <Pressable
              key={rate}
              accessibilityRole="button"
              accessibilityLabel={`${info.name} taxes`}
              accessibilityState={{ selected: on }}
              onPress={() => onPick(rate)}
              style={({ pressed }) => [styles.trapKind, on && styles.trapKindOn, pressed && styles.pressed]}
            >
              <Text style={[styles.trapKindLabel, on && styles.trapKindLabelOn]} numberOfLines={1}>
                {(rate === 'none' ? 'NONE' : info.name).toUpperCase()}
              </Text>
              <Text style={[styles.note, { color: info.mood > 0 ? '#c0cd83' : info.mood < 0 ? '#e08a72' : '#858d7c' }]}>
                {info.mood > 0 ? `+${String(info.mood)}` : String(info.mood)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.note}>{TAX_INFO[game.taxRate].note.toUpperCase()} · ×{String(TAX_INFO[game.taxRate].gold)} GOLD, {TAX_INFO[game.taxRate].mood >= 0 ? '+' : ''}{String(TAX_INFO[game.taxRate].mood)} HAPPINESS A MINUTE</Text>
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
    </View>
  );
}


// ——— News and the toolbar ———

// A round button on the side of the map; `alarm` lights it red with a "!" (raiders sighted or a battle
// waiting), otherwise `badge` shows a count.
const SideButton = memo(function SideButton({ icon, label, onPress, alarm, badge }: { icon: string; label: string; onPress: () => void; alarm: boolean; badge?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.sideButton, alarm && styles.sideAlarm, pressed && styles.pressed]}>
      <Text style={styles.sideIcon}>{icon}</Text>
      {alarm ? <Text style={[styles.sideBadge, styles.sideBadgeAlarm]}>!</Text> : badge && <Text style={styles.sideBadge}>{badge}</Text>}
    </Pressable>
  );
});

// While placing: what's being built, whether it fits here, and Build / Cancel.
function PlacementBar({ game, id, problem, onConfirm, onCancel }: {
  game: GameState;
  id: BuildingId;
  problem: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { w, d } = FOOTPRINTS[id];
  const cost = buildingCost(id, 1);
  return (
    <View style={styles.placement}>
      <View style={styles.placementHead}>
        <Text style={styles.placementIcon}>{BUILDING_ICONS[id]}</Text>
        <View style={styles.placementCopy}>
          <Text style={styles.placementTitle}>
            {BUILDING_INFO[id].name} · {String(w)}×{String(d)}
          </Text>
          <Text style={[styles.placementHint, problem && styles.placementProblem]}>
            {problem ??
              `${isFishery(id) ? 'It goes right next to the river, along the river wall inside the town. ' : isPasture(id) ? 'It grazes outside the walls. ' : ''}Lit: where it can go (yellow: rocks to clear first; never on roads)${needsRoad(id) ? `; its door (${doorText(id)}, marked) needs a road joined to the keep and the main gate` : ''}. Drag it there, or tap. ${String(cost.gold)} gold${cost.resources.coal ? ` · ${String(cost.resources.coal)} coal` : ''}.`}
          </Text>
        </View>
      </View>
      <View style={styles.placementButtons}>
        <View style={styles.placementButton}>
          <GameButton label="CANCEL" detail="" onPress={onCancel} secondary />
        </View>
        <View style={styles.placementButton}>
          <GameButton label="BUILD HERE" detail={game.gold >= cost.gold ? '' : 'not enough gold'} onPress={onConfirm} disabled={!!problem} />
        </View>
      </View>
    </View>
  );
}

// Everything that can still be built: icon, size, first-level cost, and why not if it can't yet; then
// the traps for the belt.
// A building in the palette: redrawn only when what stops it being built changes.
const PaletteBuilding = memo(function PaletteBuilding({ id, blocker, onPick }: { id: BuildingId; blocker: string | null; onPick: (id: BuildingId) => void }) {
  const { w, d } = FOOTPRINTS[id];
  const cost = buildingCost(id, 1);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Build the ${BUILDING_INFO[id].name}`}
      onPress={() => onPick(id)}
      style={({ pressed }) => [styles.paletteItem, pressed && styles.pressed]}
    >
      <Text style={styles.paletteIcon}>{BUILDING_ICONS[id]}</Text>
      <View style={styles.paletteCopy}>
        <Text style={styles.paletteName}>{BUILDING_INFO[id].name}</Text>
        <Text style={styles.paletteDetail}>
          {String(w)}×{String(d)} · {String(cost.gold)} gold{cost.resources.coal ? ` · ${String(cost.resources.coal)} coal` : ''}
        </Text>
        <Text style={[styles.paletteStatus, blocker ? styles.placementProblem : styles.paletteReady]} numberOfLines={2}>
          {blocker ?? 'Ready to build'}
        </Text>
      </View>
    </Pressable>
  );
});

function BuildPalette({ game, onPick, onPaint }: { game: GameState; onPick: (id: BuildingId) => void; onPaint: (painting: Painting) => void }) {
  const workforce = workforceOf(game);
  const options = BUILDING_IDS.filter((id) => isPlaceable(id) && game.buildings[id] === 0 && !game.construction.some((job) => job.building === id) && isShownBuilding(game, id));
  const laid = trapCounts(game.traps);
  const rocks = useMemo(() => rocksLeft(game.clearedRocks).length, [game.clearedRocks]);
  return (
    <>
      <SectionLabel>BUILDINGS</SectionLabel>
      {options.length === 0 && <Text style={styles.body}>Every building is on the map. Tap one to upgrade it.</Text>}
      <View style={styles.palette}>
        {options.map((id) => (
          <PaletteBuilding key={id} id={id} blocker={upgradeBlocker(game, id, workforce)} onPick={onPick} />
        ))}
      </View>
      <SectionLabel>LAND · THE TOWN STARTS UNDER ROCKS</SectionLabel>
      <Text style={styles.note}>BUILDINGS AND ROADS NEED CLEAR GROUND, AND PEASANTS ARE SLOW OVER ROCKS. CLEARED STONE BECOMES GRANITE.</Text>
      <View style={styles.palette}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear rocks"
          onPress={() => onPaint({ tool: 'clear', kind: 'rocks' })}
          style={({ pressed }) => [styles.paletteItem, pressed && styles.pressed]}
        >
          <Text style={styles.paletteIcon}>⛏</Text>
          <View style={styles.paletteCopy}>
            <Text style={styles.paletteName}>Clear rocks</Text>
            <Text style={styles.paletteDetail}>
              {String(rocks)} rocks left · a crew of {String(CLEAR_CREW)} peasants · free
            </Text>
            <Text style={[styles.paletteStatus, styles.paletteReady]}>
              {game.clearOrders.length > 0 ? `Clearing: ${String(clearingLeft(game))} s of work ordered` : 'Drag across rocks to order them cleared'}
            </Text>
          </View>
        </Pressable>
      </View>
      <SectionLabel>ROADS · PEASANTS WALK FASTER ON THEM</SectionLabel>
      <Text style={styles.note}>QUICKER WALKS MEAN MORE HAULED FROM THE MINE AND FASTER BUILDING. DRAG ACROSS THE MAP TO LAY THEM.</Text>
      <View style={styles.palette}>
        {[...ROAD_KINDS, 'erase' as const].map((kind) => (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={kind === 'erase' ? 'Take up roads' : `Lay ${ROAD_INFO[kind].name.toLowerCase()}`}
            onPress={() => onPaint({ tool: 'road', kind })}
            style={({ pressed }) => [styles.paletteItem, pressed && styles.pressed]}
          >
            <Text style={styles.paletteIcon}>{ROAD_ICONS[kind]}</Text>
            <View style={styles.paletteCopy}>
              <Text style={styles.paletteName}>{kind === 'erase' ? 'Take up roads' : ROAD_INFO[kind].name}</Text>
              <Text style={styles.paletteDetail}>{kind === 'erase' ? 'Free · no refund' : `${roadCostText(kind)} a tile · walking ×${String(ROAD_INFO[kind].speed)}`}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <SectionLabel>TRAPS · FOR THE BELT OUTSIDE THE MOAT</SectionLabel>
      <Text style={styles.note}>RAIDERS ON FOOT SPRING EVERY TRAP ON THE SIDE THEY COME FROM. FLIERS PASS OVER.</Text>
      <View style={styles.palette}>
        {TRAP_KINDS.map((kind) => {
          const blocker = trapBlocker(game, kind);
          return (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={`Lay ${TRAP_INFO[kind].plural}`}
              onPress={() => onPaint({ tool: 'trap', kind })}
              style={({ pressed }) => [styles.paletteItem, pressed && styles.pressed]}
            >
              <Text style={styles.paletteIcon}>{TRAP_ICONS[kind]}</Text>
              <View style={styles.paletteCopy}>
                <Text style={styles.paletteName}>{TRAP_INFO[kind].name}</Text>
                <Text style={styles.paletteDetail}>1×1 · {trapCostText(kind)} · {String(laid[kind])} laid</Text>
                <Text style={styles.paletteDetail}>{TRAP_INFO[kind].effect}</Text>
                <Text style={[styles.paletteStatus, blocker ? styles.placementProblem : styles.paletteReady]}>{blocker ?? 'Ready to lay'}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

/** Seconds of clearing work still ordered. */
const clearingLeft = (game: GameState) => Math.ceil(game.clearOrders.reduce((sum, order) => sum + order.work - order.done, 0));

// While painting roads, traps or rocks to clear: which kind (switchable), how the last stroke went, and Done.
function PaintBar({ game, painting, result, onPick, onDone }: {
  game: GameState;
  painting: Painting;
  result: string | null;
  onPick: (painting: Painting) => void;
  onDone: () => void;
}) {
  const options: Painting[] =
    painting.tool === 'road'
      ? [...ROAD_KINDS.map((kind) => ({ tool: 'road' as const, kind })), { tool: 'road', kind: 'erase' }]
      : painting.tool === 'trap'
        ? TRAP_KINDS.map((kind) => ({ tool: 'trap' as const, kind }))
        : [painting];
  const label = (option: Painting) =>
    option.tool === 'clear' ? 'Clear rocks' : option.tool === 'trap' ? TRAP_INFO[option.kind].name : option.kind === 'erase' ? 'Take up' : ROAD_INFO[option.kind].name;
  const icon = (option: Painting) => (option.tool === 'clear' ? '⛏' : option.tool === 'trap' ? TRAP_ICONS[option.kind] : ROAD_ICONS[option.kind]);
  let title: string;
  let hint: string;
  let short: string | null = null;
  if (painting.tool === 'clear') {
    const left = clearingLeft(game);
    title = `Clearing rocks · ${String(rocksLeft(game.clearedRocks).length)} left`;
    hint = `Drag across rocks (or tap one): a crew of ${String(CLEAR_CREW)} peasants clears each order, and its stone goes to the warehouse as granite.${left > 0 ? ` ${String(left)} s of work ordered.` : ''}`;
  } else if (painting.tool === 'trap') {
    title = `${TRAP_INFO[painting.kind].name} · ${String(trapCounts(game.traps)[painting.kind])} laid`;
    hint = `Drag along the lit belt (or tap) to lay them: ${trapCostText(painting.kind)} each.`;
    short = trapBlocker(game, painting.kind);
  } else if (painting.kind === 'erase') {
    title = `Taking up roads · ${String(Object.keys(game.roads).length)} road tiles`;
    hint = 'Drag across roads to take them up (no refund).';
  } else {
    const info = ROAD_INFO[painting.kind];
    title = `${info.name} · walking ×${String(info.speed)}`;
    hint = `Drag across open ground inside the wall: ${roadCostText(painting.kind)} a tile. Laying it over another road replaces it.`;
  }
  return (
    <View style={styles.placement}>
      <View style={styles.trapKinds}>
        {options.map((option) => {
          const on = option.kind === painting.kind;
          return (
            <Pressable
              key={option.kind}
              accessibilityRole="button"
              accessibilityLabel={label(option)}
              accessibilityState={{ selected: on }}
              onPress={() => onPick(option)}
              style={({ pressed }) => [styles.trapKind, on && styles.trapKindOn, pressed && styles.pressed]}
            >
              <Text style={styles.trapKindIcon}>{icon(option)}</Text>
              <Text style={[styles.trapKindLabel, on && styles.trapKindLabelOn]} numberOfLines={1}>
                {label(option).toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.placementCopy}>
        <Text style={styles.placementTitle}>{title}</Text>
        <Text style={[styles.placementHint, short && styles.placementProblem]}>{short ?? result ?? hint}</Text>
        <Text style={styles.note}>TWO FINGERS OR RIGHT-DRAG MOVE THE MAP</Text>
      </View>
      <GameButton label="DONE" detail="" onPress={onDone} />
    </View>
  );
}

// A trap in the belt: what it does, which side it guards, and taking it up.
function TrapSheet({ game, x, y, onClose }: { game: GameState; x: number; y: number; onClose: () => void }) {
  const trap = trapAt(game.traps, x, y);
  if (!trap) return null;
  const info = TRAP_INFO[trap.kind];
  const sides = sidesOf(x, y);
  const power = buildingStats(game.buildings, workforceOf(game).staff, game.techs).trapPower;
  const damage = trap.kind === 'snare' ? null : Math.round(TRAP_DAMAGE[trap.kind] * power);
  const refund = Math.floor(info.gold * TRAP_REFUND);
  return (
    <Sheet title={info.name} subtitle={`TRAP BELT · GUARDS THE ${sides.map((side) => SIDE_NAMES[side].toUpperCase()).join(' AND ')}`} onClose={onClose}>
      <Text style={styles.body}>{info.effect}</Text>
      {damage !== null && (
        <Text style={styles.body}>
          With your research and techs: {String(damage)} damage{power > 1 ? ` (×${String(power)})` : ''}.
        </Text>
      )}
      {sides.map((side) => {
        const facing = trapCounts(trapsFacing(game.traps, side));
        return (
          <Text key={side} style={styles.note}>
            {SIDE_NAMES[side].toUpperCase()} SIDE · {String(facing.spikes)} SPIKE PITS · {String(facing.pitch)} PITCH DITCHES · {String(facing.snare)} SNARES
          </Text>
        );
      })}
      <GameButton
        label="TAKE IT UP"
        detail={`+${String(refund)} gold`}
        onPress={() => {
          game.removeTrap({ x, y });
          onClose();
        }}
        secondary
      />
    </Sheet>
  );
}

// A road tile: how much faster it is to walk on, and clearing it (this tile, or more with the eraser).
function RoadSheet({ game, x, y, onClose, onClearMore }: { game: GameState; x: number; y: number; onClose: () => void; onClearMore: () => void }) {
  const kind = game.roads[tileKey(x, y)];
  if (!kind) return null;
  const info = ROAD_INFO[kind];
  const main = onMainRoad(x, y);
  return (
    <Sheet title={info.name} subtitle={`${main ? 'THE MAIN ROAD' : 'ROAD'} · WALKING ${String(info.speed)} TILES/S`} onClose={onClose}>
      <Text style={styles.body}>
        Peasants, haulers and carts go {String(info.speed)} tiles a second along it (off the roads, {String(GROUND_SPEED)}).{' '}
        {main ? 'The main road from the keep to the gate stays: it can be paved better, but never taken up.' : 'Clearing it is free, but nothing is paid back.'}
      </Text>
      {!main && (
        <GameButton
          label="CLEAR ROAD"
          detail="this tile · free"
          onPress={() => {
            game.layRoads('erase', [{ x, y }]);
            onClose();
          }}
        />
      )}
      <GameButton label="CLEAR MORE…" detail="drag over the road tiles to clear" onPress={onClearMore} secondary />
    </Sheet>
  );
}

// A tapped tile of the town that isn't built on: rocks (order them cleared) or open ground (lay a road on
// it, or build there). Ordered rocks stay until the crew clears them; then the tile shows as open ground.
function GroundSheet({ game, x, y, onClose, onPaint, onBuild }: {
  game: GameState;
  x: number;
  y: number;
  onClose: () => void;
  onPaint: (painting: Painting) => void;
  onBuild: () => void;
}) {
  const size = rockAt(game.clearedRocks, x, y);
  if (size) {
    const info = ROCK_INFO[size];
    const ordered = orderedRocks(game.clearOrders).has(tileKey(x, y));
    return (
      <Sheet title={info.name[0].toUpperCase() + info.name.slice(1)} subtitle={`ROCKS · ${String(info.seconds)} S OF CLEARING · +${String(info.granite)} GRANITE`} onClose={onClose}>
        <Text style={styles.body}>
          Nothing can be built or paved here until it’s cleared, and peasants pick their way over it slowly. A crew of {String(CLEAR_CREW)}{' '}
          clears it for {String(info.granite)} granite.
        </Text>
        {ordered ? (
          <Text style={styles.note}>ORDERED · THE CLEARING CREW WILL GET TO IT</Text>
        ) : (
          <GameButton
            label="CLEAR ROCK"
            detail={`${String(info.seconds)} s of work · free`}
            onPress={() => {
              game.clearRocks([{ x, y }]);
              onClose();
            }}
          />
        )}
        <GameButton label="CLEAR MORE…" detail="drag over the rocks to clear" onPress={() => onPaint({ tool: 'clear', kind: 'rocks' })} secondary />
      </Sheet>
    );
  }
  return (
    <Sheet title="Open ground" subtitle="INSIDE THE WALL · LAY A ROAD OR BUILD HERE" onClose={onClose}>
      <Text style={styles.body}>A road here speeds up everyone walking over it; or put a building here.</Text>
      {ROAD_KINDS.map((kind) => (
        <GameButton
          key={kind}
          label={`LAY ${ROAD_INFO[kind].name.toUpperCase()}`}
          detail={`${roadCostText(kind)} · walking ×${String(ROAD_INFO[kind].speed)}`}
          disabled={!canAffordBuild(game, ROAD_INFO[kind])}
          onPress={() => {
            game.layRoads(kind, [{ x, y }]);
            onClose();
          }}
          secondary
        />
      ))}
      <GameButton label="LAY MORE ROAD…" detail="drag to lay road tiles" onPress={() => onPaint({ tool: 'road', kind: 'dirt' })} secondary />
      <GameButton label="BUILD HERE…" detail="pick a building; it starts on this spot" onPress={onBuild} />
    </Sheet>
  );
}

// ——— Pop-up contents ———

// The forest beyond the gate the woodcutters fell (see game/forest.ts).
// A cottage's home: who sleeps there, the water and food in, and what its woman is doing.
function HomeStatus({ game, id }: { game: GameState; id: HouseId }) {
  const home = game.homes[id];
  const { residents, beds } = sleepers(game, !game.hungry);
  const store = game.buildings.granary > 0 ? 'granary' : 'warehouse';
  const dry = !isKept(home);
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <SectionLabel>THE HOME</SectionLabel>
        <Text style={styles.note}>
          {String(residents[id])} / {String(beds[id])} SLEEP HERE
        </Text>
      </View>
      <Text style={styles.note}>
        WATER {String(Math.floor(home?.water ?? 0))} / {String(PANTRY.water)} · FOOD {String(Math.floor(home?.food ?? 0))} / {String(PANTRY.food)}
      </Text>
      <Text style={styles.body}>Its woman: {errandText(home?.errand ?? null, game.elapsedSeconds, store)}</Text>
      {dry && (
        <Text style={[styles.body, styles.placementProblem]}>
          {(home?.water ?? 0) <= 0 ? 'No water' : 'No food'} in: whoever sleeps here works slower, and nobody new moves in until she brings some.
          {(home?.food ?? 0) <= 0 && game.hungry ? ' The store has no food either.' : ''}
        </Text>
      )}
      {hasHomeRoad(id, game) ? (
        <Text style={styles.note}>ROAD · AT ITS DOOR, JOINED TO THE KEEP AND THE GATE</Text>
      ) : (
        <Text style={[styles.body, styles.placementProblem]}>
          No road at its door ({doorText(id)}) joined to the keep and the main gate: its people are unhappy — they work slower, and nobody new moves in until one is laid.
        </Text>
      )}
    </View>
  );
}

// The keep's taxes: every peasant pays the keep's level in gold a minute (× the tax techs), at the rate set here.
function TaxStatus({ game }: { game: GameState }) {
  const stats = buildingStats(game.buildings, undefined, game.techs);
  const boost = stats.taxPerPeasant / Math.max(1, game.buildings.keep);
  return (
    <View style={styles.block}>
      <TaxRateChips game={game} />
      <Text style={styles.note}>
        KEEP LEVEL {String(game.buildings.keep)} × {String(game.population)} PEASANTS{boost > 1 ? ` × ${String(Math.round(boost * 100) / 100)} (TAX TECHS)` : ''} × THE RATE · MORE PEOPLE, MORE TAX
      </Text>
    </View>
  );
}

// A fishing hut's boat (from level 5), and the next one it gets.
function BoatStatus({ level }: { level: number }) {
  const boat = fishingBoat(level);
  const next = nextBoat(level);
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <SectionLabel>ITS BOAT</SectionLabel>
        <Text style={styles.note}>{boat ? BOAT_INFO[boat].name.toUpperCase() : 'FISHING FROM THE RIVER WALL'}</Text>
      </View>
      <Text style={styles.note}>
        {next ? `${BOAT_INFO[next].name.toUpperCase()} AT LEVEL ${String(BOAT_INFO[next].level)}` : 'THE BEST BOAT ON THE RIVER'} · ROWBOAT, SAILING SKIFF, FISHING SMACK, KETCH AT LEVELS 5, 10, 15, 20
      </Text>
    </View>
  );
}

function ForestStatus({ game }: { game: GameState }) {
  const stand = fellingStand(game.forest);
  const left = stand ? Math.floor(game.forest[stand] ?? 0) : 0;
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <SectionLabel>THE FOREST</SectionLabel>
        <Text style={styles.note}>{Math.floor(game.warehouse.wood).toLocaleString()} / {game.warehouseCapacity.toLocaleString()} WOOD IN THE WAREHOUSE</Text>
      </View>
      <Text style={styles.note}>
        {Object.keys(game.forest).length.toLocaleString()} STANDS ON THE MOUNTAINS · {Math.floor(forestWood(game.forest)).toLocaleString()} WOOD STANDING · FELLING ONE WITH {left.toLocaleString()} LEFT · EVERY STAND CUT DOWN GROWS BACK ELSEWHERE
      </Text>
    </View>
  );
}

function Stockpiles({ game }: { game: GameState }) {
  const walk = haulWalk(game);
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <SectionLabel>HAUL ROUTE</SectionLabel>
        <Text style={styles.note}>{String(game.lastFlow.toWarehouse).replace(/\.0$/, '')} DELIVERED / TICK</Text>
      </View>
      <StockpileTable
        stages={[
          { label: 'MINERS', stock: game.vein, capacity: game.veinCapacity },
          { label: 'MINE EXIT', stock: game.mineExit, capacity: game.mineExitCapacity },
          { label: 'MINE', stock: game.mineStock, capacity: game.mineCapacity },
          { label: 'WAREHOUSE', stock: game.warehouse, capacity: game.warehouseCapacity },
        ]}
      />
      <Text style={styles.note}>
        MINE CART · {String(game.mineCartCapacity)} PER LOAD · HAULERS · {String(game.surfaceHaul)} PER TRIP
      </Text>
      <Text style={styles.note}>
        {walk
          ? `WALK FROM THE MINE · ${String(walk.time)} S · HAULING ×${String(haulFactor(walk))} (LAY ROADS OR MOVE THE WAREHOUSE CLOSER FOR MORE)`
          : 'NO WAY THROUGH FROM THE MINE TO THE WAREHOUSE · HAULING ×0.5'}
      </Text>
    </View>
  );
}

function Menu({ game, workforce, onPrologue, onVictory }: { game: GameState; workforce: Workforce; onPrologue: () => void; onVictory: () => void }) {
  const stage = nextStage(game.campaign);
  const beds = buildingStats(game.buildings, workforce.staff, game.techs).beds;
  const dry = HOUSE_IDS.filter((id) => game.buildings[id] > 0 && !isKept(game.homes[id])).length;
  const cutOff = HOUSE_IDS.filter((id) => game.buildings[id] > 0 && !hasHomeRoad(id, game)).length;
  return (
    <>
      <View style={styles.block}>
        <SectionLabel>PEASANTS {String(game.population)}/{String(beds)}</SectionLabel>
        <Text style={styles.body}>
          {String(workforce.miners)} mining · {String(workforce.pushers)} pushing carts · {String(workforce.builders)} building · {String(workforce.staffTotal)} staffing buildings · {String(workforce.idle)} at the campfire (nobody goes anywhere by themselves: 👷 on the side staffs the buildings, ASSIGN in the mine sends them mining)
          {dry > 0 ? ` · ${String(dry)} cottage${dry === 1 ? '' : 's'} out of water or food` : game.population < beds ? ' · a newcomer every few seconds' : ' · cottages full'}
          {cutOff > 0 ? ` · ${String(cutOff)} cottage${cutOff === 1 ? '' : 's'} with no road to the keep and the gate (unhappy: slower, nobody new moves in)` : ''}
        </Text>
      </View>
      <View style={styles.block}>
        <SectionLabel>RAIDS</SectionLabel>
        <Text style={styles.body}>Raids, the army, recruiting, instant or fought-out battles and the defences: the ⚔️ button on the side of the map.</Text>
      </View>
      <View style={styles.block}>
        <SectionLabel>THE CAMPAIGN</SectionLabel>
        <Text style={styles.body}>
          {!game.campaign.unlocked
            ? 'The end game: when the hold raises its first angel, the lands the Horde took open on a map — twelve battles down the road to Aldmere, the last against the Red Hand’s warlord.'
            : game.campaign.victory
              ? 'The war is won: the Red Hand is broken and Aldmere is free. The hold plays on; the road is on the 🗺️ button.'
              : `${String(game.campaign.won)} of ${String(CAMPAIGN_BATTLES)} sites won; next: ${stage ? CAMPAIGN_STAGES[stage - 1].title : ''}. The map is on the 🗺️ button on the side of the map.`}
        </Text>
      </View>
      <Stockpiles game={game} />
      <ShopPanel adsRemoved={game.adsRemoved} />
      <GameButton label="THE STORY SO FAR" detail="the prologue: how Greyhollow came to be" onPress={onPrologue} secondary />
      {game.campaign.victory && <GameButton label="THE VICTORY" detail="the epilogue: how the war was won" onPress={onVictory} secondary />}
      <NewGameButton onConfirm={game.resetGame} />
      <Text style={styles.footer}>DIG BELOW. BUILD ABOVE. · PROGRESS SAVES AUTOMATICALLY</Text>
    </>
  );
}

// Starting over wipes the save, so it takes a second tap to confirm.
function NewGameButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={armed ? 'Confirm: delete this game and start a new one' : 'Start a new game'}
      onPress={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
      style={({ pressed }) => [styles.newGame, armed && styles.newGameArmed, pressed && styles.pressed]}
    >
      <Text style={[styles.newGameText, armed && styles.newGameTextArmed]}>
        {armed ? 'TAP AGAIN TO ERASE THIS GAME AND START OVER' : 'START A NEW GAME'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111410' },
  pressed: { opacity: 0.7 },

  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 10, gap: 8 },
  hud: { alignSelf: 'center', width: '100%', maxWidth: 720, gap: 8, padding: 10, borderWidth: 1, borderColor: '#3a4439', backgroundColor: 'rgba(17, 20, 16, 0.88)' },
  hudRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  stat: { gap: 2 },
  statLabel: { color: '#89907f', fontFamily: 'monospace', fontSize: 8 },
  statValue: { fontFamily: 'Georgia', fontSize: 18, fontWeight: 'bold' },
  raid: { alignSelf: 'center', width: '100%', maxWidth: 720 },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 10, gap: 8, alignItems: 'center' },
  toolbar: { flexDirection: 'row', width: '100%', maxWidth: 720, gap: 6 },
  side: { position: 'absolute', right: 12, gap: 10 },
  sideButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#5a6150',
    backgroundColor: 'rgba(17, 20, 16, 0.88)',
  },
  sideAlarm: { borderColor: '#e8604a', backgroundColor: 'rgba(58, 22, 18, 0.92)' },
  sideIcon: { fontSize: 22, lineHeight: 26 },
  sideBadge: { position: 'absolute', top: -6, right: -6, minWidth: 18, paddingHorizontal: 3, textAlign: 'center', backgroundColor: '#d2a45f', color: '#20231b', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  sideBadgeAlarm: { backgroundColor: '#e8604a', color: '#fff4ee' },

  block: { gap: 8 },
  moodValue: { color: '#f0ead8', fontFamily: 'Georgia', fontSize: 22, fontWeight: 'bold' },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#2a3028' },
  moodCopy: { flex: 1, gap: 2 },
  moodLabel: { color: '#e8e3d1', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  moodPoints: { fontFamily: 'Georgia', fontSize: 16, fontWeight: 'bold', minWidth: 44, textAlign: 'right' },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  note: { color: '#858d7c', fontFamily: 'monospace', fontSize: 8 },
  body: { color: '#c9c4b2', fontFamily: 'monospace', fontSize: 10, lineHeight: 15 },
  footer: { color: '#626b5d', fontFamily: 'monospace', fontSize: 8, textAlign: 'center' },
  placement: { width: '100%', maxWidth: 720, gap: 10, padding: 12, borderWidth: 1, borderColor: '#4a5240', backgroundColor: 'rgba(17, 20, 16, 0.94)' },
  placementHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  placementIcon: { fontSize: 26 },
  placementCopy: { flex: 1, gap: 3 },
  placementTitle: { color: '#f0ead8', fontFamily: 'Georgia', fontSize: 16, fontWeight: 'bold' },
  placementHint: { color: '#c0cd83', fontFamily: 'monospace', fontSize: 9 },
  placementProblem: { color: '#e08a72' },
  placementButtons: { flexDirection: 'row', gap: 8 },
  placementButton: { flex: 1 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trapKinds: { flexDirection: 'row', gap: 6 },
  trapKind: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2, paddingVertical: 6, borderWidth: 1, borderColor: '#3a4439', backgroundColor: '#1a211b' },
  trapKindOn: { borderColor: '#d2a45f', backgroundColor: '#2a2a1c' },
  trapKindIcon: { fontSize: 18, lineHeight: 22 },
  trapKindLabel: { color: '#a9ad99', fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  trapKindLabelOn: { color: '#f0ead8' },
  paletteItem: { flexGrow: 1, flexBasis: 200, flexDirection: 'row', gap: 10, padding: 10, borderWidth: 1, borderColor: '#3a4439', backgroundColor: '#1a211b' },
  paletteIcon: { fontSize: 26, lineHeight: 32 },
  paletteCopy: { flex: 1, gap: 3 },
  paletteName: { color: '#e8e3d1', fontFamily: 'Georgia', fontSize: 14 },
  paletteDetail: { color: '#a9ad99', fontFamily: 'monospace', fontSize: 9 },
  paletteStatus: { fontFamily: 'monospace', fontSize: 8 },
  paletteReady: { color: '#c0cd83' },
  newGame: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#353b32' },
  newGameArmed: { borderColor: '#e8604a', backgroundColor: '#2a1a16' },
  newGameText: { color: '#7f8776', fontFamily: 'monospace', fontSize: 8 },
  newGameTextArmed: { color: '#ff8a6c' },
});
