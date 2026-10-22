import { useSyncExternalStore } from 'react';
import { create, type StoreApi } from 'zustand';
import { persist } from 'zustand/middleware';
import { MINE_GALLERY_COUNT, MINE_STATIONS } from '../components/MineMapLayout';
import { cartsOnLevel } from './haulage';
import { RESOURCES, RESOURCE_INFO, STARTING_WOOD, emptyStock } from './resources';
import { startingForest } from './forest';
import { STARTING_APPLES, STARTING_FISH } from './farms';
import { fullHome } from './homes';
import { DEFAULT_DIFFICULTY, rulesOf } from './difficulty';
import { campaignWonOn } from './unlocks';
import { STARTING_HAPPINESS } from './happiness';
import { DEFAULT_TAX_RATE, TAX_INFO, isTaxRate } from './taxes';
import { BUILDING_INFO, DWELLING_UNIT, STARTING_BUILDINGS, buildingCostAt, buildingStats, staffNeeded } from './buildings';
import { ARMY_RECRUITING, UNIT_STATS, emptyArmy } from './units';
import { act, createBattle, resolveBattle, stepAI } from './combat';
import { FIRST_RAID_AT } from './raids';
import { CAMPAIGN_STAGES, RAID_AUTO_AFTER_CAMPAIGN, campaignBlocker, campaignParty, emptyCampaign, nextStage } from './campaign';
import { SAVE_KEY, SAVE_VERSION, createSaveStorage } from './save';
import { isMoored, isWaiting } from './ship';
import { CLEAR_CREW, ROCK_INFO, rockAt, rockyTest, startingRock } from './rocks';
import { ITEM_INFO, UNIT_GEAR, emptyItems } from './items';
import { DEFAULT_FORGE_TARGET, FORGE_NAMES, FORGE_TARGETS, emptyLoad, isForge } from './forges';
import { coveredTiles, fillPlacements, isPlaceable, onMainRoad, placementProblem, tileKey as mapTileKey } from './cityMap';
import { ROAD_INFO, accessRoads, haulFactor, joinBuildings, roadProblem, startingRoads } from './roads';
import { TRAP_INFO, TRAP_REFUND, trapAt } from './traps';
import { TECHS, techCost } from './techs';
import {
  checkDigStep,
  findDigParent,
  findDigRoute,
  standingTargets,
  getDepositInfo,
  tileKey,
  parseKey,
  stationKey,
  stationSite,
  depositAt,
  depositRemaining,
  nextFreeSite,
  type Site,
} from './mineLayout';
import { creditPurchase } from './shop';
import { STAFF_PRIORITY, vacancies } from './workforce';
import { darkTiles, surveyAt, surveyCooldown, surveyCost, surveyProblem } from './survey';
import type { GameState, SavedState } from './state';
import {
  BUILDING_NAMES,
  affordableRecruits,
  fillStaffing,
  freeHands,
  haulWalk,
  loadText,
  minerCrew,
  minersByLevel,
  orderedRocks,
  selectMineLayout,
  siteResource,
  unitAvailable,
  workforceOf,
} from './hold';
import {
  TUNNEL_WOOD,
  bargeBlocker,
  canAfford,
  canAffordBuild,
  cartCost,
  destroyRefund,
  getDepthCost,
  techBlocker,
  tileDigCost,
  trapBlocker,
  tunnelCost,
  upgradeBlocker,
} from './costs';
import {
  buildingFields,
  returnForgeGoods,
  roundCoal,
  settleBattle,
  startBuilding,
  turnBack,
  undoWagonTrip,
  withArticle,
  withBattle,
  withSite,
} from './updates';
import { tickGame } from './tick';
import { mergeSave, migrateSave } from './saveMigration';

export const FIXED_TICK_MS = 1000;
export const MAX_DEPTH = MINE_GALLERY_COUNT;
export const VEIN_CAPACITY_PER_DEPTH = 25;
export const MINE_STATIONS_PER_GALLERY = MINE_STATIONS.length;

const startingSites = [stationSite(-1, 0), stationSite(-1, 1)];
const startingPlacements = fillPlacements(STARTING_BUILDINGS, [], {}, BUILDING_NAMES);
// The first roads, and from the first buildings' doors to them.
const startingWays = joinBuildings(startingPlacements, startingRoads(startingPlacements));
const startingStats = buildingStats(STARTING_BUILDINGS);

const saveStorage = createSaveStorage<SavedState>();

// The game: its starting state and every action, bound to a store's `set`.
const gameState = (set: StoreApi<GameState>['setState']): GameState => ({
  elapsedSeconds: 0,
  depth: 1,
  gold: 1000,
  population: 10,
  paused: [],
  placements: startingPlacements,
  roads: startingWays.roads,
  // The ground under the first buildings' roads to the main road starts clear.
  clearedRocks: Object.keys(startingWays.roads).filter((key) => {
    const [x, y] = key.split(',').map(Number);
    return startingRock(x, y) > 0;
  }),
  clearOrders: [],
  items: emptyItems(),
  forgeTasks: {},
  wagonJobs: [],
  wagonSerial: 0,
  // A few pikes at the guardhouse to start with, so it can raise pikemen before there are forges and carts.
  dwellingGear: { pikeman: 10 },
  traps: [],
  techs: [],
  minerRate: startingStats.minerRate,
  buildings: STARTING_BUILDINGS,
  construction: [],
  vein: emptyStock(),
  mineExit: emptyStock(),
  mineStock: emptyStock(),
  warehouse: { ...emptyStock(), coal: 16, wood: STARTING_WOOD, apples: STARTING_APPLES, fish: STARTING_FISH },
  veinCapacity: 50,
  mineExitCapacity: startingStats.mineCapacity,
  mineCapacity: startingStats.mineCapacity,
  warehouseCapacity: startingStats.warehouseCapacity,
  mineCartCapacity: startingStats.mineCartCapacity,
  surfaceHaul: startingStats.surfaceHaul,
  lastFlow: { mined: 0, toMineExit: 0, toMineStockpile: 0, toWarehouse: 0 },
  haulTime: 0,
  haulAppliedTime: 0,
  cartLoads: {},
  carts: {},
  sites: startingSites,
  pendingSites: [],
  // A new game's buildings start staffed; from then on the player staffs them.
  staffing: fillStaffing({ population: 10, sites: startingSites, pendingSites: [], carts: {}, construction: [], clearOrders: [], buildings: STARTING_BUILDINGS, paused: [], staffing: {} }),
  forest: startingForest(),
  forestSerial: 0,
  flocks: {},
  hungry: false,
  homes: { houses: fullHome() },
  happiness: STARTING_HAPPINESS,
  taxRate: DEFAULT_TAX_RATE,
  difficulty: DEFAULT_DIFFICULTY,
  fallen: null,
  discovered: ['coal', 'wood', 'apples'],
  depositMined: {},
  openedStations: [stationKey(-1, 0), stationKey(-1, 1)],
  playerDug: [],
  digPlan: [],
  digProgress: 0,
  surveys: [],
  surveyReadyAt: 0,
  layoutVersion: 0,
  army: { ...emptyArmy(), pikeman: 12 },
  raidsFought: 0,
  raidsLostInARow: 0,
  autoResolveRaids: false,
  prologueSeen: false,
  campaign: emptyCampaign(),
  adsRemoved: false,
  creditedPurchases: [],
  recruits: { ...emptyArmy(), pikeman: 7 },
  nextRaidAt: FIRST_RAID_AT,
  raid: null,
  battle: null,
  battleArmy: emptyArmy(),
  battleCommanded: false,
  battleDeadline: 0,
  raidReport: null,
  barges: [],
  nextBargeAt: 5,
  bargeSerial: 0,
  notice: 'Two miners are already working the first seam.',

  tick: () => set((state) => (state.fallen ? {} : tickGame(state))),

  assignMiner: (key) => set((state) => {
    // Miners come from the campfire only (building staff stay where the player put them).
    const free = workforceOf(state).idle;
    if (free <= 0) return { notice: 'Nobody is waiting at the campfire: take someone off a building (− in its pop-up), release a miner, or wait for newcomers.' };
    const info = getDepositInfo(selectMineLayout(state), key);
    if (info.status === 'unknown') return { notice: 'Nobody knows what’s in that dark rock yet: survey it first from a tunnel near it (🔦 SURVEY), or dig closer.' };
    if (info.status === 'empty') return { notice: 'Nothing to mine there.' };
    if (info.status === 'depleted') return { notice: 'That deposit is mined out.' };
    if (info.status === 'worked') return { notice: 'A miner is already working that deposit.' };
    if (state.pendingSites.some((site) => tileKey(site.faceRow, site.faceColumn) === key)) {
      return { notice: 'A miner is already on the way to that deposit.' };
    }
    if (!info.standing) {
      // Nothing to stand on yet: order the shortest tunnel to it and send a miner along.
      const layout = selectMineLayout(state);
      const route = findDigRoute(layout, new Set(state.digPlan), standingTargets(layout, key));
      if (!route) return { notice: 'There’s no way to tunnel to that deposit from here.' };
      const cost = tunnelCost(state, route);
      const wood = route.length * TUNNEL_WOOD;
      if (state.gold < cost) return { notice: `Tunnelling to that deposit costs ${String(cost)} gold (${String(route.length)} tiles).` };
      if (state.warehouse.wood < wood) return { notice: `Tunnelling to that deposit takes ${String(wood)} wood for pit props: raise your Woodcutter’s Hut or build another.` };
      const stand = parseKey(route[route.length - 1]);
      const pending: Site = { row: stand.row, column: stand.column, faceRow: info.row, faceColumn: info.column, kind: 'deposit' };
      const crew = minerCrew(state, pending);
      if (free < crew) return { notice: 'The first miner on a level needs a cart pusher too: 2 peasants waiting at the campfire.' };
      return {
        gold: state.gold - cost,
        warehouse: { ...state.warehouse, wood: roundCoal(state.warehouse.wood - wood) },
        digPlan: [...state.digPlan, ...route],
        pendingSites: [...state.pendingSites, pending],
        notice: `Digging ${String(route.length)} tile${route.length === 1 ? '' : 's'} to the ${RESOURCE_INFO[info.deposit ?? 'coal'].deposit.toLowerCase()} for ${String(cost)} gold and ${String(wood)} wood. A miner will start when it’s through.`,
      };
    }
    if (free < minerCrew(state, info.standing)) return { notice: 'The first miner on a level needs a cart pusher too: 2 peasants waiting at the campfire.' };
    return {
      ...withSite(state, info.standing),
      notice: `A miner is now working ${withArticle(RESOURCE_INFO[siteResource(info.standing)].deposit.toLowerCase())} with ${info.remaining.toLocaleString()} ${RESOURCE_INFO[siteResource(info.standing)].unit.toLowerCase()} left.`,
    };
  }),

  releaseMiner: (key) => set((state) => {
    const { row, column } = parseKey(key);
    // A miner still waiting on a tunnel just stays idle (the tunnel is still dug).
    // The miner goes back to the campfire and waits there (nobody is sent anywhere by themselves).
    const pendingSites = state.pendingSites.filter((site) => !(site.faceRow === row && site.faceColumn === column));
    if (pendingSites.length !== state.pendingSites.length) {
      return { pendingSites, notice: 'The miner won’t wait for that tunnel and went back to the campfire.' };
    }
    const sites = state.sites.filter((site) => !(site.faceRow === row && site.faceColumn === column));
    if (sites.length === state.sites.length) return {};
    return { sites, layoutVersion: state.layoutVersion + 1, notice: 'The miner left the deposit and is waiting at the campfire.' };
  }),

  buyCart: (level) => set((state) => {
    const current = cartsOnLevel(state.carts, level);
    const miners = minersByLevel(state.sites).get(level) ?? 0;
    if (current >= miners) {
      return { notice: 'That level already has a cart for every miner. Add miners first.' };
    }
    const cost = cartCost(current, state.techs);
    if (!canAfford(state, cost)) {
      return { notice: `Another cart costs ${String(cost.coal)} coal and ${String(cost.gold)} gold.` };
    }
    if (workforceOf(state).idle <= 0) return { notice: 'A new cart needs a peasant from the campfire to push it.' };
    return {
      warehouse: { ...state.warehouse, coal: roundCoal(state.warehouse.coal - cost.coal) },
      gold: state.gold - cost.gold,
      carts: { ...state.carts, [level]: current + 1 },
      notice: `A new cart and hauler joined ${level < 0 ? 'the entrance level' : `gallery ${String(level + 1)}`} (${String(current + 1)} carts).`,
    };
  }),

  sellToBarge: (id, amount) => set((state) => {
    const barge = state.barges.find((other) => other.id === id);
    if (!barge) return {};
    const blocker = bargeBlocker(state, barge);
    if (blocker) return { notice: blocker };
    const stock = Math.floor(state.warehouse[barge.resource]);
    const units = Math.min(barge.wants, stock, amount === 'all' ? stock : Math.floor(amount));
    if (units <= 0) return {};
    const earned = Math.floor(units * barge.price);
    const wants = barge.wants - units;
    const name = RESOURCE_INFO[barge.resource].name.toLowerCase();
    return {
      warehouse: { ...state.warehouse, [barge.resource]: roundCoal(state.warehouse[barge.resource] - units) },
      gold: state.gold + earned,
      // A barge whose order is filled sails off downriver.
      barges: state.barges.map((other) => (other.id === id ? { ...other, wants, ...(wants <= 0 ? { leftAt: state.elapsedSeconds } : {}) } : other)),
      notice: `Sold ${units.toLocaleString()} ${name} to a barge for ${earned.toLocaleString()} gold.${wants <= 0 ? ' Its order is filled: it sails off downriver.' : ` It wants ${wants.toLocaleString()} more.`}`,
    };
  }),

  sendBargeAway: (id) => set((state) => {
    const barge = state.barges.find((other) => other.id === id);
    if (!barge || !isWaiting(barge)) return {};
    const moored = isMoored(barge, state.elapsedSeconds);
    return {
      barges: state.barges.map((other) => (other.id === id ? turnBack(other, state.elapsedSeconds) : other)),
      notice: `The barge wanting ${RESOURCE_INFO[barge.resource].name.toLowerCase()} ${moored ? 'sails off downriver empty' : 'turns back downriver'}; its berth is free for the next one.`,
    };
  }),

  recallWagon: (id) => set((state) => {
    const job = state.wagonJobs.find((other) => other.id === id);
    if (!job) return {};
    const warehouse = { ...state.warehouse };
    const items = { ...state.items };
    const forgeTasks = { ...state.forgeTasks };
    const where = undoWagonTrip(job, { warehouse, items, forgeTasks, buildings: state.buildings, before: state.warehouse, capacity: state.warehouseCapacity });
    return {
      warehouse,
      items,
      forgeTasks,
      wagonJobs: state.wagonJobs.filter((other) => other.id !== id),
      notice: job.dropped ? 'The cart is back at the depot.' : `The cart turns back: ${loadText(job.load)} ${where}.`,
    };
  }),

  setForgeTask: (forge, item) => set((state) => {
    const name = FORGE_NAMES[forge];
    if (state.buildings[forge] < 1) return { notice: `${name} isn’t built yet.` };
    const old = state.forgeTasks[forge];
    if (old?.item === item) return {};
    // What the forge holds goes back to the store: its shelf, the piece on the anvil and its rack.
    const warehouse = { ...state.warehouse };
    const items = { ...state.items };
    if (old) returnForgeGoods(old, warehouse, items, state.warehouse, state.warehouseCapacity);
    const forgeTasks = { ...state.forgeTasks };
    if (item) forgeTasks[forge] = { item, target: old?.target ?? DEFAULT_FORGE_TARGET, done: 0, loaded: false, stock: emptyLoad(), output: 0 };
    else delete forgeTasks[forge];
    return {
      warehouse,
      items,
      forgeTasks,
      notice: item ? `${name} now makes ${ITEM_INFO[item].plural.toLowerCase()} (up to ${String(forgeTasks[forge]?.target)} in store).` : `${name} stands idle.`,
    };
  }),

  setForgeTarget: (forge, target) => set((state) => {
    const task = state.forgeTasks[forge];
    if (!task || !(FORGE_TARGETS as readonly number[]).includes(target)) return {};
    return { forgeTasks: { ...state.forgeTasks, [forge]: { ...task, target } } };
  }),

  recruit: (unit, amount) => set((state) => {
    const stats = UNIT_STATS[unit];
    if (!unitAvailable(state, unit)) return { notice: `${stats.plural} can't be recruited yet.` };
    const waiting = Math.floor(state.recruits[unit]);
    const free = freeHands(state);
    const count = Math.min(waiting, affordableRecruits(state, unit), free, amount === 'max' ? Infinity : amount);
    if (count <= 0) {
      if (waiting <= 0) return { notice: `No ${stats.plural.toLowerCase()} are waiting to be recruited.` };
      if (free <= 0) return { notice: 'Every soldier is a peasant first, and none are free. Wait for more, or pause a building.' };
      return { notice: `You can't afford any ${stats.plural.toLowerCase()}.` };
    }
    return {
      gold: state.gold - ARMY_RECRUITING[unit].gold * count,
      dwellingGear: { ...state.dwellingGear, [unit]: (state.dwellingGear[unit] ?? 0) - count },
      army: { ...state.army, [unit]: state.army[unit] + count },
      // Soldiers leave the peasant pool (and its beds) for good.
      population: state.population - count,
      recruits: { ...state.recruits, [unit]: state.recruits[unit] - count },
      notice: `Recruited ${String(count)} ${(count === 1 ? stats.name : stats.plural).toLowerCase()}.`,
    };
  }),

  commandBattle: () => set((state) => (state.battle?.status === 'active' ? { battleCommanded: true } : {})),

  // Leaving the battlefield mid-battle hands it to the captains: it's fought on at the battlefield's pace
  // (still waiting out the 30 s for orders if those haven't run out).
  releaseBattle: () =>
    set((state) => (state.battle?.status === 'active' && state.battleCommanded ? { battleCommanded: false, battleDeadline: Math.max(state.battleDeadline, state.elapsedSeconds) } : {})),

  battleAct: (action) => set((state) => (state.battle ? withBattle(state, act(state.battle, action)) : {})),

  battleStep: () => set((state) => (state.battle ? withBattle(state, stepAI(state.battle)) : {})),

  setBattleAuto: (auto) => set((state) => (state.battle ? { battle: { ...state.battle, auto } } : {})),

  quickResolveBattle: () => set((state) => (state.battle ? withBattle(state, resolveBattle(state.battle)) : {})),

  closeBattle: () => set((state) => (state.battle && state.battle.status !== 'active' ? { battle: null } : {})),

  dismissRaidReport: () => set({ raidReport: null }),

  setAutoResolveRaids: (on) => set({
    autoResolveRaids: on,
    notice: on
      ? 'Battles: instant. Every raid is settled the moment it arrives.'
      : 'Battles: fought out. Command each battle, or after 30 s the captains fight it, march by march.',
  }),

  seePrologue: () => set({ prologueSeen: true }),

  // The campaign (campaign.ts): march on the next site. The battle is one in the field — the hold's defences
  // stay home — and runs like a raid's: command it on the battle screen, or the captains fight it from
  // RAID_AUTO_AFTER_CAMPAIGN on. Settling it (updates.ts) pays the bounty and opens the next site.
  startCampaignBattle: () => set((state) => {
    const blocker = campaignBlocker(state);
    const stage = nextStage(state.campaign);
    if (blocker || stage === null) return { notice: blocker ?? '' };
    const workforce = workforceOf(state);
    const stats = buildingStats(state.buildings, workforce.staff, state.techs);
    const created = createBattle({
      kind: 'field',
      raid: 1000 + stage,
      campaign: stage,
      army: state.army,
      enemies: campaignParty(stage, state.campaign.scale * rulesOf(state.difficulty).campaign),
      wallHp: 0,
      gateHp: 0,
      towers: 0,
      towerDamage: 0,
      attackBonus: stats.attackBonus,
      defenceBonus: stats.defenceBonus,
      unitBonus: stats.unitBonus,
    });
    const site = CAMPAIGN_STAGES[stage - 1];
    if (created.status !== 'active') {
      // Decided before it began (nothing could stand): settled at once, the result left on the battlefield.
      return { battle: created, battleArmy: state.army, battleCommanded: false, ...settleBattle({ ...state, battleArmy: state.army }, created) };
    }
    return {
      battle: created,
      battleArmy: state.army,
      battleCommanded: false,
      battleDeadline: state.elapsedSeconds + RAID_AUTO_AFTER_CAMPAIGN,
      notice: `The army marches on ${site.title}. Take command, or the captains fight it in ${String(RAID_AUTO_AFTER_CAMPAIGN)} s.`,
    };
  }),

  seeVictory: () => set((state) => ({ campaign: { ...state.campaign, victorySeen: true } })),

  creditPurchase: (id, key) => {
    const change = creditPurchase(useGameStore.getState(), id, key);
    if (change) set(change);
    return change !== null;
  },

  setRideOut: (rideOut) => set((state) => {
    const { raid } = state;
    if (!raid || raid.kind !== 'siege' || state.battle?.status === 'active' || !!raid.rideOut === rideOut) return {};
    return {
      raid: { ...raid, rideOut },
      notice: rideOut
        ? 'The army will ride out and meet the siege army in the field: no walls or towers, but half the losses if beaten and half again the bounty if it wins.'
        : 'The army will hold the walls: walls, gate, towers, oil, moat and traps all fight.',
    };
  }),

  resetGame: (difficulty = DEFAULT_DIFFICULTY) => set((state) => {
    const fresh = useGameStore.getInitialState();
    const rules = rulesOf(difficulty);
    // What the hold starts with follows the difficulty: the gold, and the food, wood and coal in store.
    const warehouse = { ...fresh.warehouse };
    for (const resource of ['coal', 'wood', 'apples', 'fish'] as const) warehouse[resource] = Math.round(fresh.warehouse[resource] * rules.startStock);
    return {
      ...fresh,
      difficulty,
      gold: rules.startGold,
      warehouse,
      nextRaidAt: rules.firstRaidAt,
      // Keep counting up, so caches keyed by the layout version never mistake the new mine for the old one.
      layoutVersion: state.layoutVersion + 1,
      notice: `A new game begins on ${rules.name}. Two miners are already working the first seam.`,
    };
  }),

  toggleBuildingPause: (id) => set((state) => {
    const { name } = BUILDING_INFO[id];
    if (state.paused.includes(id)) {
      // Restarted with whoever waits at the campfire (its old staff went there when it stopped).
      const paused = state.paused.filter((other) => other !== id);
      const take = Math.min(staffNeeded(id, state.buildings[id]), workforceOf(state).idle);
      return {
        paused,
        staffing: { ...state.staffing, [id]: take },
        notice: `The ${name} is back at work with ${String(take)} of its ${String(staffNeeded(id, state.buildings[id]))} staff.`,
      };
    }
    if (staffNeeded(id, state.buildings[id]) === 0) return { notice: `The ${name} needs no staff.` };
    return { paused: [...state.paused, id], notice: `The ${name} is stopped; its staff went back to the campfire.` };
  }),

  assignStaff: (id, change) => set((state) => {
    const { name } = BUILDING_INFO[id];
    const workforce = workforceOf(state);
    const now = workforce.staff[id];
    if (change < 0) {
      if (now <= 0) return {};
      return { staffing: { ...state.staffing, [id]: now - 1 }, notice: `A worker from the ${name} went back to the campfire.` };
    }
    if (state.paused.includes(id)) return { notice: `The ${name} is stopped: restart it first.` };
    if (now >= workforce.needed[id]) return { notice: workforce.needed[id] === 0 ? `The ${name} needs no staff.` : `The ${name} has all the staff it can take.` };
    if (workforce.idle <= 0) return { notice: 'Nobody is waiting at the campfire: release a miner or take staff off another building first.' };
    return { staffing: { ...state.staffing, [id]: now + 1 }, notice: `A peasant took up work at the ${name}.` };
  }),

  setTaxRate: (rate) => set((state) => (isTaxRate(rate) && rate !== state.taxRate ? { taxRate: rate, notice: `${rate === 'none' ? 'No more taxes' : `${TAX_INFO[rate].name} taxes`}: ${TAX_INFO[rate].note}` } : {})),

  autoAssignCity: () => set((state) => {
    const workforce = workforceOf(state);
    if (workforce.idle <= 0) return { notice: 'Nobody is waiting at the campfire.' };
    if (vacancies(workforce) <= 0) return { notice: 'Every building has all the staff it can take.' };
    const staffing = { ...state.staffing };
    let left = workforce.idle;
    for (const id of STAFF_PRIORITY) {
      const take = Math.min(workforce.needed[id] - workforce.staff[id], left);
      if (take <= 0) continue;
      staffing[id] = workforce.staff[id] + take;
      left -= take;
    }
    const sent = workforce.idle - left;
    return { staffing, notice: `${String(sent)} peasant${sent === 1 ? '' : 's'} took up work in the buildings${left > 0 ? `; ${String(left)} still wait at the campfire` : ''}.` };
  }),

  autoAssignMine: () => set((state) => {
    if (workforceOf(state).idle <= 0) return { notice: 'Nobody is waiting at the campfire.' };
    let next: GameState = state;
    let sent = 0;
    // Each free face in turn (coal first, then gallery stations) while there are hands for it (the first
    // miner on a level brings a cart pusher too).
    for (let i = 0; i < 400; i++) {
      const site = nextFreeSite(selectMineLayout(next));
      if (!site || workforceOf(next).idle < minerCrew(next, site)) break;
      next = { ...next, ...withSite(next, site) };
      sent += 1;
    }
    if (sent === 0) return { notice: 'No free face to send anyone to: dig to more ore, or open the next gallery.' };
    return {
      sites: next.sites,
      openedStations: next.openedStations,
      layoutVersion: next.layoutVersion,
      notice: `${String(sent)} peasant${sent === 1 ? '' : 's'} went down the mine to work the free faces.`,
    };
  }),

  upgradeBuilding: (id) => set((state) => {
    const blocker = upgradeBlocker(state, id);
    const { name } = BUILDING_INFO[id];
    if (blocker) return { notice: `${name}: ${blocker}` };
    if (state.buildings[id] === 0 && isPlaceable(id) && !state.placements[id]) return { notice: `Choose where to build the ${name} first.` };
    return startBuilding(state, id);
  }),

  placeBuilding: (id, spot) => set((state) => {
    const { name } = BUILDING_INFO[id];
    if (state.buildings[id] > 0 || state.construction.some((job) => job.building === id)) return { notice: `The ${name} is already built.` };
    const onRoad = (x: number, y: number) => !!state.roads[mapTileKey(x, y)];
    const problem = placementProblem(id, spot, state.placements, BUILDING_NAMES, rockyTest(state.clearedRocks), onRoad, accessRoads(state.roads)) ?? upgradeBlocker(state, id);
    if (problem) return { notice: `${name}: ${problem}` };
    return { ...startBuilding(state, id), placements: { ...state.placements, [id]: spot } };
  }),

  clearRocks: (tiles) => set((state) => {
    const ordered = orderedRocks(state.clearOrders);
    const keys: string[] = [];
    let work = 0;
    for (const { x, y } of tiles) {
      const key = mapTileKey(x, y);
      const size = rockAt(state.clearedRocks, x, y);
      if (!size || ordered.has(key) || keys.includes(key)) continue;
      keys.push(key);
      work += ROCK_INFO[size].seconds;
    }
    if (keys.length === 0) return { notice: 'No rocks there to clear (or they’re already ordered).' };
    work = Math.ceil(work);
    const queued = state.clearOrders.reduce((sum, order) => sum + order.work - order.done, 0);
    return {
      clearOrders: [...state.clearOrders, { tiles: keys, work, done: 0 }],
      notice: `Ordered ${String(keys.length)} rock${keys.length === 1 ? '' : 's'} cleared: ${String(work)} s of work for a crew of ${String(CLEAR_CREW)}${queued > 0 ? `, after ${String(Math.ceil(queued))} s already ordered` : ''}.`,
    };
  }),

  cancelConstruction: (id) => set((state) => {
    const job = state.construction.find((other) => other.building === id);
    if (!job) return {};
    const { name } = BUILDING_INFO[id];
    const cost = buildingCostAt(id, job.level, state.difficulty);
    const warehouse = { ...state.warehouse };
    const lost: string[] = [];
    for (const resource of RESOURCES) {
      const amount = cost.resources[resource] ?? 0;
      const room = Math.max(0, state.warehouseCapacity - warehouse[resource]);
      if (amount > room) lost.push(RESOURCE_INFO[resource].name.toLowerCase());
      warehouse[resource] = roundCoal(warehouse[resource] + Math.min(amount, room));
    }
    // A building that was never finished leaves its plot.
    const placements = { ...state.placements };
    const unbuilt = state.buildings[id] === 0 && isPlaceable(id);
    if (unbuilt) delete placements[id];
    return {
      gold: state.gold + cost.gold,
      warehouse,
      placements,
      construction: state.construction.filter((other) => other.building !== id),
      notice: `Stopped building the ${name}${unbuilt ? '' : ` (level ${String(job.level)})`}: its ${String(cost.gold)} gold and materials are back${lost.length > 0 ? `, but the warehouses had no room for all the ${lost.join(', ')}` : ''}.`,
    };
  }),

  destroyBuilding: (id) => set((state) => {
    const { name } = BUILDING_INFO[id];
    if (id === 'keep') return { notice: 'The Central Keep is the seat of the hold: it can’t be pulled down.' };
    const building = state.construction.some((job) => job.building === id);
    if (state.buildings[id] === 0 && !building) return { notice: `There is no ${name} to destroy.` };
    const refund = destroyRefund(state, id);
    const warehouse = { ...state.warehouse };
    const lost: string[] = [];
    for (const resource of RESOURCES) {
      const amount = refund.resources[resource] ?? 0;
      const room = Math.max(0, state.warehouseCapacity - warehouse[resource]);
      if (amount > room) lost.push(RESOURCE_INFO[resource].name.toLowerCase());
      warehouse[resource] = roundCoal(warehouse[resource] + Math.min(amount, room));
    }
    const placements = { ...state.placements };
    delete placements[id];
    // A forge's task goes with it; the piece on its anvil goes back to the stores.
    const forgeTasks = { ...state.forgeTasks };
    const items = { ...state.items };
    if (isForge(id)) {
      const task = forgeTasks[id];
      if (task) returnForgeGoods(task, warehouse, items, state.warehouse, state.warehouseCapacity);
      delete forgeTasks[id];
    }
    // A dwelling's gear goes back to the store.
    const dwellingGear = { ...state.dwellingGear };
    const dwelt = DWELLING_UNIT[id];
    if (dwelt) {
      items[UNIT_GEAR[dwelt]] += Math.floor(dwellingGear[dwelt] ?? 0);
      delete dwellingGear[dwelt];
    }
    // Without the depot every cart turns back; without the docks every barge leaves.
    let { wagonJobs, barges } = state;
    if (id === 'depot') {
      for (const job of wagonJobs) undoWagonTrip(job, { warehouse, items, forgeTasks, buildings: state.buildings, before: state.warehouse, capacity: state.warehouseCapacity });
      wagonJobs = [];
    }
    if (id === 'docks') barges = barges.map((barge) => (isWaiting(barge) ? turnBack(barge, state.elapsedSeconds) : barge));
    const back = [`${String(refund.gold)} gold`, ...RESOURCES.filter((resource) => refund.resources[resource]).map((resource) => `${String(refund.resources[resource])} ${RESOURCE_INFO[resource].name.toLowerCase()}`)];
    return {
      buildings: { ...state.buildings, [id]: 0 },
      construction: state.construction.filter((job) => job.building !== id),
      placements,
      paused: state.paused.filter((other) => other !== id),
      gold: state.gold + refund.gold,
      warehouse,
      items,
      forgeTasks,
      wagonJobs,
      barges,
      dwellingGear,
      notice: `The ${name} was pulled down: ${back.join(', ')} back.${lost.length > 0 ? ` The warehouses had no room for all the ${lost.join(', ')}.` : ''}`,
    };
  }),

  layTraps: (kind, tiles) => set((state) => {
    const info = TRAP_INFO[kind];
    let { gold, traps } = state;
    const warehouse = { ...state.warehouse };
    let laid = 0;
    let reason = '';
    for (const spot of tiles) {
      const blocker = trapBlocker({ gold, warehouse, traps }, kind, spot);
      if (blocker === 'Not enough resources.') {
        reason = ' Not enough resources for more.';
        break;
      }
      if (blocker) {
        reason = ` ${blocker}`;
        continue;
      }
      gold -= info.gold;
      for (const resource of RESOURCES) warehouse[resource] = roundCoal(warehouse[resource] - (info.resources[resource] ?? 0));
      traps = [...traps, { kind, x: spot.x, y: spot.y }];
      laid += 1;
    }
    if (laid === 0) return { notice: `${info.name}:${reason || ' nowhere to lay it.'}` };
    return {
      gold,
      warehouse,
      traps,
      notice: `${laid === 1 ? `${info.name} laid` : `${String(laid)} ${info.plural} laid`} in the trap belt.${reason}`,
    };
  }),

  layRoads: (kind, tiles) => set((state) => {
    const covered = coveredTiles(state.placements);
    const roads = { ...state.roads };
    let gold = state.gold;
    const warehouse = { ...state.warehouse };
    let done = 0;
    let reason = '';
    // Main-road tiles the stroke crossed while taking roads up (they stay).
    let kept = 0;
    for (const spot of tiles) {
      const problem = roadProblem(spot, kind, roads, covered, state.clearedRocks);
      if (problem) {
        if (kind === 'erase' && onMainRoad(spot.x, spot.y)) kept += 1;
        continue;
      }
      const key = mapTileKey(spot.x, spot.y);
      if (kind === 'erase') {
        delete roads[key];
        done += 1;
        continue;
      }
      const cost = ROAD_INFO[kind];
      if (!canAffordBuild({ gold, warehouse }, cost)) {
        reason = ' Not enough resources for more.';
        break;
      }
      gold -= cost.gold;
      for (const resource of RESOURCES) warehouse[resource] = roundCoal(warehouse[resource] - (cost.resources[resource] ?? 0));
      roads[key] = kind;
      done += 1;
    }
    if (done === 0) {
      if (kind === 'erase') return { notice: kept > 0 ? 'The main road from the keep to the gate stays: it can’t be taken up.' : 'No roads there to take up.' };
      return { notice: reason ? `${ROAD_INFO[kind].name}:${reason}` : 'No road can go there: roads go on open ground inside the wall.' };
    }
    if (kind === 'erase') return { roads, notice: `Took up ${String(done)} road tile${done === 1 ? '' : 's'}.${kept > 0 ? ' The main road from the keep to the gate stays.' : ''}` };
    return {
      roads,
      gold,
      warehouse,
      notice: `Laid ${String(done)} tile${done === 1 ? '' : 's'} of ${ROAD_INFO[kind].name.toLowerCase()} for ${String(state.gold - gold)} gold${ROAD_INFO[kind].resources.granite ? ` and ${String(done * (ROAD_INFO[kind].resources.granite ?? 0))} granite` : ''}.${reason}`,
    };
  }),

  removeTrap: (spot) => set((state) => {
    const trap = trapAt(state.traps, spot.x, spot.y);
    if (!trap) return {};
    const refund = Math.floor(TRAP_INFO[trap.kind].gold * TRAP_REFUND);
    return {
      gold: state.gold + refund,
      traps: state.traps.filter((other) => other !== trap),
      notice: `${TRAP_INFO[trap.kind].name} taken up: ${String(refund)} gold back.`,
    };
  }),

  buyTech: (id) => set((state) => {
    const tech = TECHS[id];
    const blocker = techBlocker(state, id);
    if (blocker) return { notice: `${tech.name}: ${blocker}` };
    const techs = [...state.techs, id];
    return {
      gold: state.gold - techCost(state.techs, id, state.difficulty),
      techs,
      // Bigger bins are added to the miners' bins straight away (they also grow with depth).
      veinCapacity: state.veinCapacity + (tech.bonus?.veinCapacity ?? 0),
      ...buildingFields(state.buildings, workforceOf(state).staff, techs, haulFactor(haulWalk(state))),
      notice: `Researched ${tech.name}: ${tech.effect}`,
    };
  }),

  digDeeper: () => set((state) => {
    if (state.depth >= MAX_DEPTH) return { notice: 'The mine has reached bedrock.' };
    const goldCost = getDepthCost(state.depth, state.techs, state.difficulty);
    if (state.gold < goldCost) {
      return { notice: `The next shaft costs ${String(goldCost)} gold.` };
    }
    const depth = state.depth + 1;
    return {
      depth,
      gold: state.gold - goldCost,
      veinCapacity: state.veinCapacity + VEIN_CAPACITY_PER_DEPTH,
      layoutVersion: state.layoutVersion + 1,
      notice: `The miners opened gallery ${String(depth)}: room for ${String(MINE_STATIONS_PER_GALLERY)} more miners and a longer vein.`,
    };
  }),

  survey: (key) => set((state) => {
    const layout = selectMineLayout(state);
    const problem = surveyProblem(state, layout, key);
    if (problem) return { notice: problem };
    const area = surveyAt(key, state.techs, state.difficulty);
    const cost = surveyCost(area.row, state.techs);
    // What the surveyors found in the dark: the deposits there, by kind.
    const found = new Map<string, number>();
    for (const { row, column } of darkTiles(layout, area)) {
      const deposit = depositAt(row, column);
      if (!deposit || depositRemaining(layout, row, column) <= 0) continue;
      const name = RESOURCE_INFO[deposit].deposit.toLowerCase();
      found.set(name, (found.get(name) ?? 0) + 1);
    }
    const list = [...found].map(([name, tiles]) => `${name}${tiles > 1 ? ` (${String(tiles)} tiles)` : ''}`).join(', ');
    const cooldown = surveyCooldown(state.techs);
    return {
      surveys: [...state.surveys, area],
      layoutVersion: state.layoutVersion + 1,
      gold: roundCoal(state.gold - cost),
      surveyReadyAt: state.elapsedSeconds + cooldown,
      notice: `The surveyors mapped the rock round row ${String(area.row)}, column ${String(area.column)} for ${String(cost)} gold: ${list || 'nothing but rock'}. Ready again in ${String(cooldown)} s.`,
    };
  }),

  planDig: (keys) => set((state) => {
    // Re-check the whole run against the current mine, and stop at the first tile that breaks the
    // rock rule or can't be paid for.
    const layout = selectMineLayout(state);
    const planned = new Set(state.digPlan);
    const accepted: string[] = [];
    let gold = state.gold;
    let wood = state.warehouse.wood;
    let reason = '';
    for (const [index, key] of keys.entries()) {
      const parent = index === 0 ? findDigParent(layout, planned, key) : keys[index - 1];
      const check = parent ? checkDigStep(layout, planned, key, parent) : { ok: false as const, reason: 'Dig from the end of a tunnel.' };
      if (!check.ok) {
        reason = check.reason;
        break;
      }
      const cost = tileDigCost(state, parseKey(key).row);
      if (gold < cost) {
        reason = 'Not enough gold for the rest of the tunnel.';
        break;
      }
      if (wood < TUNNEL_WOOD) {
        reason = 'Not enough wood for pit props: raise your Woodcutter’s Hut or build another.';
        break;
      }
      gold -= cost;
      wood = roundCoal(wood - TUNNEL_WOOD);
      planned.add(key);
      accepted.push(key);
    }
    if (accepted.length === 0) return { notice: reason || 'Nothing to dig.' };
    const spent = state.gold - gold;
    return {
      gold,
      warehouse: { ...state.warehouse, wood },
      digPlan: [...state.digPlan, ...accepted],
      notice: `Ordered ${String(accepted.length)} tile${accepted.length === 1 ? '' : 's'} dug for ${String(spent)} gold and ${String(accepted.length * TUNNEL_WOOD)} wood.${reason ? ` ${reason}` : ''}`,
    };
  }),
});

const createGameStore = () => create<GameState>()(persist<GameState, [], [], SavedState>((set) => gameState(set), {
  name: SAVE_KEY,
  version: SAVE_VERSION,
  storage: saveStorage,
  // Only a game that loaded the save (or found none) may write it; one that failed keeps its hands off.
  onRehydrateStorage: () => (_state, error) => {
    if (!error) {
      saveStorage.markLoaded();
      return;
    }
    console.error('Could not load the saved game; it is kept as it was and this game will not be saved.', error);
    useGameStore.setState({ notice: 'Your saved game couldn’t be loaded. It’s kept safe: this game won’t be saved over it.' });
  },
  // The app entry loads the save once storage is ready (see `loadGame`).
  skipHydration: true,
  partialize: (state) => Object.fromEntries(Object.entries(state).filter(([, value]) => typeof value !== 'function')) as SavedState,
  // The merge below fills in anything a migrated save lacks.
  migrate: (persisted, version) => migrateSave(persisted as Partial<SavedState> | undefined, version) as SavedState,
  merge: (persisted, current) => mergeSave(persisted as Partial<SavedState> | undefined, current),
}));

// In development, Fast Refresh re-runs this module after an edit to the game logic. A store made then
// would start blank — it never loads the save or ticks — and the screens froze on it while the running
// game carried on unseen behind it (its writes are kept off the save, so nothing was lost). So the running
// store and its clock are kept across a refresh, and handed the edited actions (save migrations still
// only run when the app loads). Tests load fresh copies of the store on purpose, so they always get a new one.
const running = globalThis as { mineforgeStore?: ReturnType<typeof createGameStore>; mineforgeClock?: ReturnType<typeof setInterval> };
const keepAcrossRefresh = __DEV__ && typeof jest === 'undefined';
/** Records keyed by fixed ids (every building, resource, unit, item): a refresh may add entries to them. */
const FIXED_RECORDS = ['buildings', 'warehouse', 'vein', 'mineExit', 'mineStock', 'army', 'recruits', 'items'];

const kept = keepAcrossRefresh ? running.mineforgeStore : undefined;
export const useGameStore = kept ?? createGameStore();

// Winning the campaign on Nightmare opens Hardcore, and on Hardcore earns the crown (kept across games).
useGameStore.subscribe((state, previous) => {
  if (state.campaign.victory && !previous.campaign.victory) campaignWonOn(state.difficulty);
});
if (kept) {
  // A refresh hands the kept store the edited actions, bound to it, so changed game logic runs at once. One
  // that added state (a new feature) also hands it the new fields' starting values — and new entries in the
  // records keyed by fixed ids (a new building, resource, unit or item) — so screens built for them don't
  // break on it.
  const fresh = gameState(kept.setState) as unknown as Record<string, unknown>;
  const current = kept.getState() as unknown as Record<string, unknown>;
  const added: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fresh)) {
    if (typeof value === 'function') {
      added[key] = value;
      continue;
    }
    if (!(key in current)) {
      // Staffing (2026-10-13) follows the running game's own buildings, not a new game's.
      added[key] = key === 'staffing' ? fillStaffing(current as unknown as GameState) : value;
      continue;
    }
    if (!FIXED_RECORDS.includes(key)) continue;
    const now = current[key] as Record<string, unknown>;
    const missing = Object.entries(value as Record<string, unknown>).filter(([entry]) => !(entry in now));
    if (missing.length > 0) added[key] = { ...Object.fromEntries(missing), ...now };
  }
  if (Object.keys(added).length > 0) kept.setState(added as Partial<GameState>);
}
if (keepAcrossRefresh) running.mineforgeStore = useGameStore;

// A store subscription that's off: a screen out of sight keeps what it last showed.
const stayPut = () => () => {};

// On web, while the page itself is hidden (another tab, a minimised window) nothing on screen needs
// updating: the game goes on ticking, but its changes are passed on to the screens only once the page
// is shown again.
const page = typeof document === 'undefined' ? null : document;
function subscribeShown(onChange: () => void) {
  const unsubscribe = useGameStore.subscribe(() => {
    if (!page?.hidden) onChange();
  });
  const onVisibility = () => {
    if (!page?.hidden) onChange();
  };
  page?.addEventListener('visibilitychange', onVisibility);
  return () => {
    unsubscribe();
    page?.removeEventListener('visibilitychange', onVisibility);
  };
}

/**
 * The whole game for a screen, kept up to date only while it's `live`: a screen out of sight (the
 * stronghold under the mine or the battle) skips the ticks instead of re-rendering on every one, and
 * catches up when it's shown again — as do all of them while the page is hidden.
 */
export function useGame(live = true): GameState {
  return useSyncExternalStore(live ? subscribeShown : stayPut, useGameStore.getState);
}

/** One slice of the game (a state field, or a value worked out from it that compares equal while unchanged), while `live`. */
export function useGameSlice<T>(selector: (state: GameState) => T, live = true): T {
  return useSyncExternalStore(live ? subscribeShown : stayPut, () => selector(useGameStore.getState()));
}

/** Load the saved game (call once storage is ready, before the simulation starts); only the first call loads. */
export function loadGame() {
  return useGameStore.persist.hasHydrated() ? Promise.resolve() : useGameStore.persist.rehydrate();
}

export function startSimulation() {
  if (running.mineforgeClock) return () => {};

  running.mineforgeClock = setInterval(() => {
    useGameStore.getState().tick();
  }, FIXED_TICK_MS);

  return () => {
    if (running.mineforgeClock) clearInterval(running.mineforgeClock);
    running.mineforgeClock = undefined;
  };
}
