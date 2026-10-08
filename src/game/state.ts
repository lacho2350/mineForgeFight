// The game's state: everything the game remembers (and saves), and the actions the store offers on it.
import type { LevelCarts } from './haulage';
import type { Resource, Stock } from './resources';
import type { BuildingId, BuildingLevels } from './buildings';
import type { Army, ArmyUnit } from './units';
import type { Battle, BattleAction, BattleKind } from './combat';
import type { RaidKind, RaidParty } from './raids';
import type { Barge } from './ship';
import type { ClearOrder } from './rocks';
import type { ItemId, ItemStock } from './items';
import type { ForgeId, ForgeTasks } from './forges';
import type { WagonJob } from './wagons';
import type { Placements, Spot } from './cityMap';
import type { RoadKind, Roads } from './roads';
import type { Trap, TrapKind } from './traps';
import type { TechId } from './techs';
import type { Site } from './mineLayout';

export type Cost = { coal: number; gold: number };

type TickFlow = {
  mined: number;
  toMineExit: number;
  toMineStockpile: number;
  toWarehouse: number;
};

/** A building being raised to `level`; done once `progress` reaches `duration` seconds. */
export type Construction = { building: BuildingId; level: number; progress: number; duration: number; crew: number };

/**
 * Raiders on their way: sighted at first, then at the gate (or in the fields). A siege army can be met in the
 * field instead if the hold rides out (`rideOut`).
 */
export type Raid = { number: number; arrivesAt: number; party: RaidParty; kind: RaidKind; rideOut?: boolean };

/** Where a raid will be fought: in the field (a raiding party, or a siege army the hold rides out to meet) or at the walls. */
export const raidBattleKind = (raid: Raid): BattleKind => (raid.kind === 'field' || raid.rideOut ? 'field' : 'siege');

/** What came of a raid. */
export type RaidReport = {
  number: number;
  /** Fought in the field or at the walls (missing in older reports: a siege). */
  kind?: BattleKind;
  outcome: 'won' | 'lost' | 'withdrawn';
  bounty: number;
  losses: Partial<Record<ArmyUnit, number>>;
  slain: number;
  /** Raiders the traps killed (counted in `slain` too). */
  trapKills?: number;
  plundered: { gold: number; resources: Partial<Stock> } | null;
};

/** What a level's cart is carrying. */
export type CartLoad = { resource: Resource; amount: number };

export type GameState = {
  elapsedSeconds: number;
  depth: number;
  gold: number;
  /** Peasants living in the hold: every miner, pusher, builder, hauler and building hand (soldiers aren't counted). */
  population: number;
  /** Buildings the player has stopped, sending their staff back to the campfire. */
  paused: BuildingId[];
  /** Where the player has put each building on the stronghold's map (the keep and defences are fixed). */
  placements: Placements;
  /** Traps laid in the trap belt. */
  traps: Trap[];
  /** Roads laid in the town (tile key → kind). */
  roads: Roads;
  /** Rock tiles cleared so far (the rocks themselves lie where rocks.ts puts them). */
  clearedRocks: string[];
  /** Rocks ordered cleared, worked through in order by the clearing crew. */
  clearOrders: ClearOrder[];
  /** The army's gear and its parts, in store. */
  items: ItemStock;
  /** What each forge is set to make (forges without a task stand idle), with its shelf and rack. */
  forgeTasks: ForgeTasks;
  /** The depot's carts out on trips (the rest wait at the depot). */
  wagonJobs: WagonJob[];
  /** Gear kept at each unit's dwelling (brought by carts): what recruiting there takes. */
  dwellingGear: Partial<Record<ArmyUnit, number>>;
  /** Cart trips sent so far (each one's id). */
  wagonSerial: number;
  /** Techs bought from the tech tree. */
  techs: TechId[];
  minerRate: number;
  /** Level of every stronghold building (0 = not built yet). */
  buildings: BuildingLevels;
  /** Buildings being raised, each by its own crew of peasants. */
  construction: Construction[];
  /** Each resource has its own stockpiles: beside the miners, at the mine exit, at the mine, in the warehouse. */
  vein: Stock;
  mineExit: Stock;
  mineStock: Stock;
  warehouse: Stock;
  /** Capacities apply to each resource's stockpile separately. */
  veinCapacity: number;
  mineExitCapacity: number;
  mineCapacity: number;
  warehouseCapacity: number;
  mineCartCapacity: number;
  /** Units the haulers move per tick on each leg (mine exit → mine → warehouse). */
  surfaceHaul: number;
  lastFlow: TickFlow;
  /** Seconds of cart movement; only advances while the mine exit has room for another load. */
  haulTime: number;
  /** Haul time up to which cart loads and tips have already been applied. */
  haulAppliedTime: number;
  /** What each cart carries, keyed by `cartKey(level, index)`. */
  cartLoads: Record<string, CartLoad>;
  /** Carts working each level (levels not listed have one). */
  carts: LevelCarts;
  /** Where each working miner works. */
  sites: Site[];
  /** Miners on their way to a deposit whose tunnel is still being dug; they start when it's done. */
  pendingSites: Site[];
  /** Units taken from each deposit so far, keyed by tile; a deposit is mined out at its total. */
  depositMined: Record<string, number>;
  /** Gallery stations that have been cut ("level:station"); their chamber and shaft stay dug. */
  openedStations: string[];
  /** Tiles the player has had dug, in the order they were finished. */
  playerDug: string[];
  /** Tiles ordered and paid for but not dug yet; the diggers work through them in order. */
  digPlan: string[];
  /** Seconds the diggers have spent on the first tile of the plan. */
  digProgress: number;
  /** Bumped whenever the dug tiles or sites change, so derived layouts and cart routes refresh. */
  layoutVersion: number;
  /** The hold's army: creatures of each unit. */
  army: Army;
  /** Recruits waiting at each dwelling (they arrive gradually, so this is fractional). */
  recruits: Record<ArmyUnit, number>;
  /** Raids fought so far. */
  raidsFought: number;
  /** Raids lost in a row (the next ones come smaller until one is won). */
  raidsLostInARow: number;
  /** Fight every raid out at once when it arrives (the auto-resolver), instead of waiting for orders. */
  autoResolveRaids: boolean;
  /** Game second the next raiders arrive. */
  nextRaidAt: number;
  /** Raiders sighted or at the gate. */
  raid: Raid | null;
  /** The battle at the gate, while it's fought and until the player leaves the battlefield. */
  battle: Battle | null;
  /** The army when the battle began (recruits joining mid-battle are kept out of it). */
  battleArmy: Army;
  /** The player took command; otherwise the battle fights itself at `battleDeadline`. */
  battleCommanded: boolean;
  battleDeadline: number;
  raidReport: RaidReport | null;
  /** Barges at the docks with their orders (and ones just sailing off, for the animation). */
  barges: Barge[];
  /** Game second the next barge may set off up the river (when a berth is free). */
  nextBargeAt: number;
  /** Barges sent so far (each one's order is drawn from it). */
  bargeSerial: number;
  notice: string;
  tick: () => void;
  /** Start building the next level of a building (paid now, finished by a crew of peasants over time). */
  upgradeBuilding: (id: BuildingId) => void;
  /** Put a new building on the map at `spot` and start building it. */
  placeBuilding: (id: BuildingId, spot: Spot) => void;
  /** Stop or restart a building: a stopped building sends its staff back to the campfire. */
  toggleBuildingPause: (id: BuildingId) => void;
  /** Lay traps on these belt tiles, in order, while they can be paid for. */
  layTraps: (kind: TrapKind, tiles: Spot[]) => void;
  /** Lay (or take up) road on these town tiles, in order, while they can be paid for. */
  layRoads: (kind: RoadKind | 'erase', tiles: Spot[]) => void;
  /** Pull a building down (any but the keep): half of everything spent on it comes back, and its plot is free again. */
  destroyBuilding: (id: BuildingId) => void;
  /** Stop building a building's next level: what it cost comes back (a building never finished leaves its plot). */
  cancelConstruction: (id: BuildingId) => void;
  /** Call a cart back: what it carries goes back where it came from. */
  recallWagon: (id: number) => void;
  /** Order the rocks on these tiles cleared (one order for the crew). */
  clearRocks: (tiles: Spot[]) => void;
  /** Take up the trap at `spot`, for part of its gold back. */
  removeTrap: (spot: Spot) => void;
  /** Buy a tech from the tech tree (gold, at once). */
  buyTech: (id: TechId) => void;
  digDeeper: () => void;
  /** Order a connected run of tiles dug; charged now, dug over time. */
  planDig: (keys: string[]) => void;
  /** Send a free peasant to mine the deposit at `key`. */
  assignMiner: (key: string) => void;
  /** Take the miner off the deposit at `key`; they go back to the campfire. */
  releaseMiner: (key: string) => void;
  /** Buy another cart and hauler for a level. */
  buyCart: (level: number) => void;
  /** Sell a moored barge whole units of what it wants, from the warehouse ('all': as much as it takes). */
  sellToBarge: (id: number, amount: number | 'all') => void;
  /** Send a barge off without trading (one still sailing in turns back), freeing its berth. */
  sendBargeAway: (id: number) => void;
  /** Set a forge to make an item (null: no task); a piece it had started is given back. */
  setForgeTask: (forge: ForgeId, item: ItemId | null) => void;
  /** How many of its item a forge keeps in store before it stops. */
  setForgeTarget: (forge: ForgeId, target: number) => void;
  /** Hire waiting recruits at a unit's dwelling. */
  recruit: (unit: ArmyUnit, amount: number | 'max') => void;
  /** Against a siege army: ride out and meet it in the field (true), or hold the walls (false). */
  setRideOut: (rideOut: boolean) => void;
  /** Turn the auto-resolver on or off: raids fought out at once when they arrive. */
  setAutoResolveRaids: (on: boolean) => void;
  /** Take command of the battle at the gate (it then waits for the player's orders). */
  commandBattle: () => void;
  /** Order the stack whose turn it is. */
  battleAct: (action: BattleAction) => void;
  /** Let the raiders (or auto-battle) make their next move. */
  battleStep: () => void;
  setBattleAuto: (auto: boolean) => void;
  /** Fight the rest of the battle at once. */
  quickResolveBattle: () => void;
  /** Leave a finished battlefield. */
  closeBattle: () => void;
  dismissRaidReport: () => void;
  /** Wipe the save and start again from the beginning. */
  resetGame: () => void;
};

/** The saved part of the state: everything but the actions. */
export type SavedState = { [K in keyof GameState as GameState[K] extends (...args: never[]) => unknown ? never : K]: GameState[K] };

export type WalkState = Pick<GameState, 'placements' | 'roads' | 'clearedRocks'>;

export type WorkforceState = Pick<GameState, 'population' | 'sites' | 'pendingSites' | 'carts' | 'construction' | 'clearOrders' | 'buildings' | 'paused'>;
