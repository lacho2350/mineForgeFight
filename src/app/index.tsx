import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GameState } from '../game/state';
import { BUILDING_NAMES, haulWalk, isShownBuilding, orderedRocks, workforceOf } from '../game/hold';
import { roadCostText, trapBlocker, trapCostText, upgradeBlocker } from '../game/costs';
import { useGameStore } from '../game/gameStore';
import { BUILDING_IDS, BUILDING_INFO, MAX_BUILDING_LEVEL, buildingCost, buildingStats, type BuildingId } from '../game/buildings';
import { DEFAULT_SPOTS, FOOTPRINTS, MAP_SIZE, SIDE_NAMES, coveredTiles, isPlaceable, nearestFreeSpot, placementProblem, sidesOf, type Spot } from '../game/cityMap';
import { ROAD_INFO, ROAD_KINDS, haulFactor, roadProblem, roadsUnder, type RoadKind } from '../game/roads';
import { CLEAR_CREW, rockAt, rockyTest, rocksLeft } from '../game/rocks';
import { isMoored } from '../game/ship';
import { TRAP_DAMAGE, TRAP_INFO, TRAP_KINDS, TRAP_REFUND, trapAt, trapCounts, trapProblem, trapsFacing, type TrapKind } from '../game/traps';
import { BUILDING_ICONS, ROAD_ICONS, TRAP_ICONS } from '../components/buildingIcons';
import { plotOf } from '../components/GameSceneLayout';
import type { Workforce } from '../game/workforce';
import { BuildingDetail, BuildingGrid, DefenceSummary } from '../components/BuildingsPanel';
import CityView from '../components/CityView';
import { GameButton, SectionLabel } from '../components/GameUI';
import BargesPanel from '../components/BargesPanel';
import { DepotPanel, ForgePanel, GearStore } from '../components/ForgePanel';
import { isForge } from '../game/forges';
import CombatPanel, { hireableNow } from '../components/CombatPanel';
import RaidBanner from '../components/RaidBanner';
import Sheet from '../components/Sheet';
import StockpileTable from '../components/StockpileTable';
import { TechTree, techsReady } from '../components/TechTree';

type Popup =
  | { kind: 'building'; id: BuildingId }
  | { kind: 'trap'; x: number; y: number }
  | { kind: 'build' }
  | { kind: 'market' }
  | { kind: 'buildings' }
  | { kind: 'tech' }
  | { kind: 'menu' }
  | { kind: 'combat' }
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

// The stronghold, full screen: the castle map under a resource bar, a toolbar at the bottom, and
// pop-ups for buildings, the market, the building list and the menu.
export default function StrongholdScreen() {
  const game = useGameStore();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [popup, setPopup] = useState<Popup>(null);
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
  const openMine = useCallback(() => router.push('/mine'), []);
  const close = () => setPopup(null);

  // Placement: start at the building's usual spot (or the nearest free one), move it with taps.
  const startPlacing = (id: BuildingId) => {
    const preferred = DEFAULT_SPOTS[id] ?? { x: MAP_SIZE / 2, y: MAP_SIZE - 6 };
    const rocky = rockyTest(game.clearedRocks);
    const spot = placementProblem(id, preferred, game.placements, BUILDING_NAMES, rocky) ? nearestFreeSpot(id, preferred, game.placements, BUILDING_NAMES, rocky) : preferred;
    setPopup(null);
    setPlacing({ id, ...(spot ?? preferred) });
  };
  const startPainting = (next: Painting) => {
    setPopup(null);
    setPainting(next);
    setPaintResult(null);
  };
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
  const tapGround = useCallback((x: number, y: number) => {
    const trap = trapAt(useGameStore.getState().traps, Math.floor(x), Math.floor(y));
    if (trap) setPopup({ kind: 'trap', x: trap.x, y: trap.y });
  }, []);
  const spotProblem = placing ? placementProblem(placing.id, placing, game.placements, BUILDING_NAMES, rockyTest(game.clearedRocks)) : null;
  const covered = useMemo(() => coveredTiles(game.placements), [game.placements]);
  const { roads, traps, clearedRocks, clearOrders } = game;
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
    return placing ? { plot: plotOf(placing.id, {}, placing), valid: !spotProblem } : null;
  }, [painting, stroke, roads, traps, clearedRocks, clearOrders, covered, placing, spotProblem]);
  const confirmPlacing = () => {
    if (!placing) return;
    game.placeBuilding(placing.id, { x: placing.x, y: placing.y });
    if (useGameStore.getState().placements[placing.id]) setPlacing(null);
  };
  // Only live raids show over the map; the last battle's result is in the menu.
  const showRaid = !!game.raid || game.battle?.status === 'active';
  const hireable = hireableNow(game, workforce);

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
        onMine={openMine}
        active={focused}
        insetTop={hudHeight}
        insetBottom={barHeight}
      />

      {/* Top: resources, peasants, the raid clock */}
      <View style={[styles.top, { paddingTop: insets.top + 8, pointerEvents: 'box-none' }]} onLayout={(event) => setHudHeight(event.nativeEvent.layout.height)}>
        <Hud game={game} workforce={workforce} />
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
            onPress={() => setPopup({ kind: 'combat' })}
            alarm={!!game.raid || game.battle?.status === 'active'}
            badge={hireable > 0 ? String(hireable) : undefined}
          />
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
            spot={placing}
            problem={spotProblem ?? upgradeBlocker(game, placing.id, workforce)}
            onConfirm={confirmPlacing}
            onCancel={() => setPlacing(null)}
          />
        ) : (
          <>
            <Toast notice={game.notice} />
            <View style={styles.toolbar}>
              <ToolButton icon="⛏" label="MINE" onPress={openMine} />
              <ToolButton icon="🔨" label="BUILD" onPress={() => setPopup({ kind: 'build' })} />
              <ToolButton icon="🏰" label="BUILDINGS" onPress={() => setPopup({ kind: 'buildings' })} badge={game.construction.length > 0 ? String(game.construction.length) : undefined} />
              <ToolButton icon="📜" label="TECH" onPress={() => setPopup({ kind: 'tech' })} badge={techReady > 0 ? String(techReady) : undefined} />
              <ToolButton icon="⚓" label="DOCKS" onPress={() => setPopup({ kind: 'market' })} badge={moored > 0 ? String(moored) : undefined} />
              <ToolButton icon="☰" label="MENU" onPress={() => setPopup({ kind: 'menu' })} />
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
          {popup.id === 'keep' && <DefenceSummary game={game} workforce={workforce} />}
          {popup.id === 'warehouse' && <Stockpiles game={game} />}
          {popup.id === 'docks' && <BargesPanel game={game} />}
          {popup.id === 'armory' && <GearStore game={game} />}
          {isForge(popup.id) && <ForgePanel game={game} forge={popup.id} />}
          {popup.id === 'depot' && <DepotPanel game={game} />}
        </Sheet>
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
          <Menu game={game} workforce={workforce} />
        </Sheet>
      )}
    </View>
  );
}

// ——— The resource bar ———

function Hud({ game, workforce }: { game: GameState; workforce: Workforce }) {
  const beds = buildingStats(game.buildings, workforce.staff, game.techs).beds;
  const raidIn = game.raid ? null : game.nextRaidAt - game.elapsedSeconds;
  return (
    <View style={styles.hud}>
      <View style={styles.hudRow}>
        <Stat label="GOLD" value={Math.floor(game.gold).toLocaleString()} tone="#e5a565" />
        <Stat label={`PEASANTS · ${String(workforce.idle)} IDLE`} value={`${String(game.population)}/${String(beds)}`} tone="#c0cd83" />
        {raidIn !== null && <Stat label={`RAID ${String(game.raidsFought + 1)}`} value={clock(raidIn)} tone="#e08a72" />}
      </View>
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

// The latest notice, shown for a few seconds whenever it changes.
function Toast({ notice }: { notice: string }) {
  const [expired, setExpired] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setExpired(notice), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (expired === notice) return null;
  return (
    <Animated.View key={notice} entering={FadeIn.duration(150)} exiting={FadeOut.duration(300)} style={[styles.toast, { pointerEvents: 'none' }]}>
      <Text style={styles.toastText}>{notice}</Text>
    </Animated.View>
  );
}

function ToolButton({ icon, label, onPress, badge }: { icon: string; label: string; onPress: () => void; badge?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
      <Text style={styles.toolIcon}>{icon}</Text>
      <Text style={styles.toolLabel}>{label}</Text>
      {badge && <Text style={styles.toolBadge}>{badge}</Text>}
    </Pressable>
  );
}

// A round button on the side of the map; `alarm` lights it red with a "!" (raiders sighted or a battle
// waiting), otherwise `badge` shows a count.
function SideButton({ icon, label, onPress, alarm, badge }: { icon: string; label: string; onPress: () => void; alarm: boolean; badge?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.sideButton, alarm && styles.sideAlarm, pressed && styles.pressed]}>
      <Text style={styles.sideIcon}>{icon}</Text>
      {alarm ? <Text style={[styles.sideBadge, styles.sideBadgeAlarm]}>!</Text> : badge && <Text style={styles.sideBadge}>{badge}</Text>}
    </Pressable>
  );
}

// While placing: what's being built, whether it fits here, and Build / Cancel.
function PlacementBar({ game, id, spot, problem, onConfirm, onCancel }: {
  game: GameState;
  id: BuildingId;
  spot: Spot;
  problem: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { w, d } = FOOTPRINTS[id];
  const cost = buildingCost(id, 1);
  const under = roadsUnder({ ...spot, w, d }, game.roads).length;
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
              `Drag it where it should go, or tap there. ${String(cost.gold)} gold${cost.resources.coal ? ` · ${String(cost.resources.coal)} coal` : ''}.${under > 0 ? ` Takes up ${String(under)} road tile${under === 1 ? '' : 's'}.` : ''}`}
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
function BuildPalette({ game, onPick, onPaint }: { game: GameState; onPick: (id: BuildingId) => void; onPaint: (painting: Painting) => void }) {
  const workforce = workforceOf(game);
  const options = BUILDING_IDS.filter((id) => isPlaceable(id) && game.buildings[id] === 0 && !game.construction.some((job) => job.building === id) && isShownBuilding(game, id));
  const laid = trapCounts(game.traps);
  return (
    <>
      <SectionLabel>BUILDINGS</SectionLabel>
      {options.length === 0 && <Text style={styles.body}>Every building is on the map. Tap one to upgrade it.</Text>}
      <View style={styles.palette}>
        {options.map((id) => {
          const { w, d } = FOOTPRINTS[id];
          const cost = buildingCost(id, 1);
          const blocker = upgradeBlocker(game, id, workforce);
          return (
            <Pressable
              key={id}
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
        })}
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
              {String(rocksLeft(game.clearedRocks).length)} rocks left · a crew of {String(CLEAR_CREW)} peasants · free
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

// ——— Pop-up contents ———

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

function Menu({ game, workforce }: { game: GameState; workforce: Workforce }) {
  const beds = buildingStats(game.buildings, workforce.staff, game.techs).beds;
  const unkept = workforce.staff.houses < workforce.needed.houses;
  return (
    <>
      <View style={styles.block}>
        <SectionLabel>PEASANTS {String(game.population)}/{String(beds)}</SectionLabel>
        <Text style={styles.body}>
          {String(workforce.miners)} mining · {String(workforce.pushers)} pushing carts · {String(workforce.builders)} building · {String(workforce.staffTotal)} staffing buildings · {String(workforce.idle)} at the campfire
          {game.population < beds ? ' · a newcomer every few seconds' : unkept ? ' · the houses are short of housekeepers' : ' · houses full'}
        </Text>
      </View>
      <View style={styles.block}>
        <SectionLabel>RAIDS</SectionLabel>
        <Text style={styles.body}>Raids, the army, recruiting, auto-resolve and the defences: the ⚔️ button on the side of the map.</Text>
      </View>
      <Stockpiles game={game} />
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
  toast: { width: '100%', maxWidth: 720, paddingHorizontal: 12, paddingVertical: 8, borderLeftWidth: 2, borderLeftColor: '#c98959', backgroundColor: 'rgba(27, 32, 25, 0.92)' },
  toastText: { color: '#d8d2c0', fontFamily: 'monospace', fontSize: 10 },
  toolbar: { flexDirection: 'row', width: '100%', maxWidth: 720, gap: 6 },
  tool: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderWidth: 1, borderColor: '#3a4439', backgroundColor: 'rgba(17, 20, 16, 0.92)' },
  toolIcon: { fontSize: 18, lineHeight: 22 },
  toolLabel: { color: '#e6dfcb', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  toolBadge: { position: 'absolute', top: 4, right: 6, minWidth: 16, paddingHorizontal: 3, textAlign: 'center', backgroundColor: '#d2a45f', color: '#20231b', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  side: { position: 'absolute', right: 12 },
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
