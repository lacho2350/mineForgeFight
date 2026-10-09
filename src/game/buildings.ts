// The stronghold's buildings: what each one does at every level (and with the techs bought for it),
// what the next level costs and how long it takes to build. Pure data + maths (no React / Skia) so the
// store and the screens share it.
import { FORGE_IDS, FORGE_KEEP, FORGE_NAMES, forgeSpeedAt, isForge, type ForgeId } from './forges';
import { HOUSE_IDS, HOUSE_KEEP, HOUSE_NAMES, MAX_PEASANTS, houseBeds, isHouse, type HouseId } from './houses';
import { APPLES_PER_LEVEL, FISHERY_IDS, FISH_PER_LEVEL, LAMBS_PER_LEVEL, ORCHARD_IDS, PASTURE_IDS, SHEEP_PER_LEVEL, farmKeep, farmName, isFarm, isFishery, isOrchard, isPasture, type FarmId } from './farms';
import { RESOURCES, type Resource } from './resources';
import { MIN_BARGE_INTERVAL } from './ship';
import { BASE_WAGON_LOAD, WAGON_SPEED } from './wagons';
import { techBonuses, type TechId, type UnitBonus } from './techs';
import { ARMY_RECRUITING, ARMY_UNITS, MUSTER_SECONDS, UNIT_STATS, unitGrowth, type ArmyUnit } from './units';

export const BUILDING_IDS = [
  'keep',
  ...HOUSE_IDS,
  'warehouse',
  'foundry',
  'research',
  'armory',
  // Carts that move goods between the warehouse and the forges.
  'depot',
  // Woodcutters fell the woods beyond the walls.
  'woodcutter',
  // Food: the granary keeps it; orchards in town, fishing huts on the river banks and sheep on the land
  // outside the walls bring it in.
  'granary',
  ...ORCHARD_IDS,
  ...FISHERY_IDS,
  ...PASTURE_IDS,
  // Where the army's gear is made, one task to a forge.
  ...FORGE_IDS,
  'wall',
  'towers',
  'gate',
  'moat',
  'docks',
  // One dwelling per unit, tier 1 → 9.
  'guardhouse',
  'archery',
  'barracks',
  'monastery',
  'balloonWorks',
  'stables',
  'griffinEyrie',
  'chapel',
  'sanctum',
] as const;
export type BuildingId = (typeof BUILDING_IDS)[number];
export type BuildingLevels = Record<BuildingId, number>;

export const MAX_BUILDING_LEVEL = 20;

/** Levels at the start of a game; 0 means the plot is empty. */
export const STARTING_BUILDINGS: BuildingLevels = {
  keep: 1,
  ...(Object.fromEntries(HOUSE_IDS.map((id) => [id, id === 'houses' ? 1 : 0])) as Record<HouseId, number>),
  warehouse: 1,
  foundry: 1,
  research: 0,
  armory: 0,
  depot: 0,
  woodcutter: 0,
  granary: 0,
  ...(Object.fromEntries([...ORCHARD_IDS, ...FISHERY_IDS, ...PASTURE_IDS].map((id) => [id, 0])) as Record<FarmId, number>),
  ...(Object.fromEntries(FORGE_IDS.map((id) => [id, 0])) as Record<ForgeId, number>),
  wall: 0,
  towers: 0,
  gate: 0,
  moat: 0,
  docks: 1,
  guardhouse: 1,
  archery: 0,
  barracks: 0,
  monastery: 0,
  balloonWorks: 0,
  stables: 0,
  griffinEyrie: 0,
  chapel: 0,
  sanctum: 0,
};

/** The unit each dwelling raises. */
export const DWELLING_UNIT: Partial<Record<BuildingId, ArmyUnit>> = Object.fromEntries(
  ARMY_UNITS.map((unit) => [ARMY_RECRUITING[unit].dwelling, unit]),
);

/** Keep level the moat needs before it can be dug and flooded. */
export const MOAT_KEEP_LEVEL = 10;

/** Keep level needed before a building's first level can be built (dwellings of strong units need more). */
export function requiredKeep(id: BuildingId) {
  if (id === 'moat') return MOAT_KEEP_LEVEL;
  if (isForge(id)) return FORGE_KEEP[id];
  if (isHouse(id)) return HOUSE_KEEP[id];
  if (isFarm(id)) return farmKeep(id);
  const unit = DWELLING_UNIT[id];
  // Stables also pull the surface wagons, so they can be built early; cavalry still wait for the keep.
  return unit && id !== 'stables' ? ARMY_RECRUITING[unit].requiresKeep : 1;
}

/** Treasury gold plus resources taken from the warehouse. */
export type BuildCost = { gold: number; resources: Partial<Record<Resource, number>> };

// ——— Workers ———
// Every job is done by peasants from one pool. Every building but the keep, the wall and the towers
// needs staff to work: one short of staff works as if it were a lower level (in proportion); with
// nobody at all it does nothing.

/** Buildings that work without staff (the moat is part of the defensive works, like the wall). */
export const UNSTAFFED: readonly BuildingId[] = ['keep', 'wall', 'towers', 'moat'];

/** Peasants a building needs to run at a level (the keep, the wall and the towers need nobody). */
export function staffNeeded(id: BuildingId, level: number) {
  if (level <= 0 || UNSTAFFED.includes(id)) return 0;
  switch (id) {
    case 'warehouse':
      return 2 + Math.floor(level / 2); // haulers carrying goods from the mine
    case 'gate':
      return 1 + Math.floor(level / 10);
    default:
      return 1 + Math.floor(level / 5);
  }
}

/** Peasants in the crew that raises a building to `level`. */
export function crewSize(level: number) {
  return 2 + Math.floor(level / 5);
}

/** Seconds between new peasants arriving while there are free beds (before the houses' techs). */
export const PEASANT_ARRIVAL_SECONDS = 4;

/** Food of each kind the keep's larder holds without a granary, and what each granary level adds. */
export const LARDER = 60;
export const GRANARY_PER_LEVEL = 120;

/** Wood a woodcutter's hut brings in each second per (worked) level, before its techs. */
export const WOOD_PER_LEVEL = 0.25;

/** Goods one hauler carries per trip (per second) between the mine and the warehouse. */
export const HAULER_LOAD = 6;

/** The level a building works at with this many staff. */
export function workedLevel(id: BuildingId, level: number, staff: number | undefined) {
  const need = staffNeeded(id, level);
  if (need === 0 || staff === undefined) return level;
  return Math.floor((level * Math.min(staff, need)) / need);
}

/** Peasants the keep's hall sleeps, with or without houses. */
export const KEEP_BEDS = 8;

/** Everything the buildings provide, derived from their levels. */
export type BuildingStats = {
  maxLevel: number;
  /** Buildings that can be under construction at once. */
  buildSites: number;
  taxPerFiveSeconds: number;
  beds: number;
  minerRate: number;
  mineCartCapacity: number;
  warehouseCapacity: number;
  mineCapacity: number;
  /** Haulers working (the warehouse staff). */
  haulers: number;
  /** Goods moved per second on each surface leg (mine exit → mine stockpile → warehouse). */
  surfaceHaul: number;
  digSpeed: number;
  digCostFactor: number;
  tradeBonus: number;
  /** Seconds of work each forge does each second (0: not built, or no smiths). */
  forgeSpeed: Record<ForgeId, number>;
  /** Wood the woodcutters bring in each second. */
  woodPerSecond: number;
  /** Food the granary keeps, of each kind (the keep's larder without one). */
  granaryCapacity: number;
  /** Fish the fishing huts land and apples the orchards pick, each second. */
  fishPerSecond: number;
  applesPerSecond: number;
  /** The depot's carts (0: no depot, or no carters), what each carries and how fast (× walking). */
  wagons: number;
  wagonLoad: number;
  wagonSpeed: number;
  /** Added to every unit's attack and defence (the armory's arms and armour). */
  attackBonus: number;
  defenceBonus: number;
  /** Health of each wall section on the battlefield (0 = no wall). */
  wallHp: number;
  /** Health of the gate (0 = an open gap in the wall). */
  gateHp: number;
  towers: number;
  /** Damage of each tower's shot every round. */
  towerDamage: number;
  /** Trap damage multiplier (the research facility's engineers). */
  trapPower: number;
  /** Seconds between river barges coming to the docks (0: none come — no dockhands). */
  shipCycle: number;
  /** How big a barge's order is, in gold's worth at base prices. */
  shipHold: number;
  /** Shots each tower fires every round. */
  towerShots: number;
  /** Damage boiling oil does every round to each raider company beside a standing wall section. */
  wallOil: number;
  /** Damage the moat does every round to each raider company wading in it (0: no moat). */
  moatDamage: number;
  /** The bridge at the gate is raised in battle, so raiders must wade there too. */
  moatAtGate: boolean;
  /** Seconds between newcomers while there are free beds. */
  arrivalSeconds: number;
  /** Seconds of building work a crew does every second. */
  buildSpeed: number;
  /** Discounts on opening a gallery and on extra mine carts (0.25 = 25% cheaper). */
  depthDiscount: number;
  cartDiscount: number;
  /** Per-unit battle bonuses and extra recruits per muster (0.25 = +25%), from the dwellings' techs. */
  unitBonus: Partial<Record<ArmyUnit, UnitBonus>>;
  growthBonus: Partial<Record<ArmyUnit, number>>;
};

const round1 = (value: number) => Math.round(value * 10) / 10;
const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/**
 * What the buildings provide. The keep, the wall and the towers work at their built level; everything
 * else follows its staff (`staff` per building; omitted = fully staffed): houses sleep peasants, the
 * gate is barred, and so on. Only storage (warehouse and mine stockpile sizes) stays with the built
 * level, so nothing stored is lost when hands are short. The techs bought (`techs`) add their bonuses
 * on top.
 */
export function buildingStats(levels: BuildingLevels, staff?: Partial<Record<BuildingId, number>>, techs: readonly TechId[] = []): BuildingStats {
  const { keep, warehouse, wall, towers, moat } = levels;
  const tech = techBonuses(techs);
  const worked = (id: BuildingId) => workedLevel(id, levels[id], staff ? (staff[id] ?? 0) : undefined);
  const foundry = worked('foundry');
  const housed = HOUSE_IDS.reduce((sum, id) => sum + houseBeds(worked(id)), 0);
  const barred = worked('gate');
  const docks = worked('docks');
  const research = worked('research');
  const armory = worked('armory');
  const stables = worked('stables');
  const mineCartCapacity = 12 + 2 * Math.max(0, foundry - 1) + tech.cartLoad;
  const haulers = staff ? (staff.warehouse ?? 0) : staffNeeded('warehouse', warehouse);
  const round2 = (value: number) => Math.round(value * 100) / 100;
  return {
    maxLevel: keep,
    buildSites: 1 + Math.floor(keep / 5) + tech.buildSites,
    taxPerFiveSeconds: round2(keep * (1 + tech.tax)),
    // The keep's hall sleeps 8 whatever happens (so a hold whose peasants are all under orders can still
    // grow and staff its houses); kept houses add the rest, up to MAX_PEASANTS.
    beds: Math.min(MAX_PEASANTS, Math.floor((KEEP_BEDS + housed) * (1 + tech.beds))),
    minerRate: round1((0.5 + 0.2 * Math.max(0, foundry - 1)) * (1 + tech.minerRate)),
    mineCartCapacity,
    warehouseCapacity: roundTo(100 * 1.3 ** Math.max(0, warehouse - 1) * (1 + tech.warehouse), 10),
    // The mine's surface piles must always fit a few cart loads, or the carts would stall.
    mineCapacity: Math.max(Math.round((50 + 25 * Math.max(0, warehouse - 1)) * (1 + tech.mineStock)), mineCartCapacity * 4),
    haulers,
    // Horses and carts from the stables let every hauler carry more.
    surfaceHaul: Math.round(haulers * HAULER_LOAD * (1 + 0.15 * stables) * (1 + tech.haul)),
    digSpeed: round1((1 + 0.1 * research) * (1 + tech.digSpeed)),
    digCostFactor: round2((round1(10 - 0.3 * research) / 10) * (1 - tech.digCost)),
    tradeBonus: round2(0.03 * docks + tech.trade),
    forgeSpeed: Object.fromEntries(FORGE_IDS.map((id) => [id, forgeSpeedAt(worked(id), tech.forgeSpeed)])) as Record<ForgeId, number>,
    woodPerSecond: round2(WOOD_PER_LEVEL * worked('woodcutter') * (1 + tech.wood)),
    // Storage follows the built level, like the warehouse.
    granaryCapacity: LARDER + GRANARY_PER_LEVEL * levels.granary,
    fishPerSecond: round2(FISH_PER_LEVEL * FISHERY_IDS.reduce((sum, id) => sum + worked(id), 0)),
    applesPerSecond: round2(APPLES_PER_LEVEL * ORCHARD_IDS.reduce((sum, id) => sum + worked(id), 0)),
    wagons: worked('depot') > 0 ? 1 + worked('depot') + tech.wagonCount : 0,
    wagonLoad: BASE_WAGON_LOAD + tech.wagonLoad,
    wagonSpeed: round2(WAGON_SPEED * (1 + tech.wagonSpeed)),
    attackBonus: Math.ceil(armory / 2) + tech.attack,
    defenceBonus: Math.floor(armory / 2) + tech.defence,
    wallHp: wall > 0 ? Math.round((15 + 12 * wall + wall ** 2) * (1 + tech.wallHp)) : 0,
    // An unmanned gate stands open.
    gateHp: wall > 0 && barred > 0 ? Math.round((20 + 15 * barred + barred ** 2) * (1 + tech.gateHp)) : 0,
    towers: towerCount(towers),
    towerDamage: towers > 0 ? Math.round((5 + 3 * towers) * (1 + tech.towerDamage)) : 0,
    trapPower: round1(1 + 0.1 * research + tech.trapPower),
    shipCycle: docks > 0 ? Math.max(MIN_BARGE_INTERVAL, Math.round((120 - 4 * (docks - 1)) * (1 - tech.shipCycle))) : 0,
    shipHold: docks > 0 ? Math.round((150 + 50 * (docks - 1)) * (1 + tech.shipHold)) : 0,
    towerShots: 1 + tech.towerShots,
    wallOil: wall > 0 ? tech.wallOil : 0,
    moatDamage: moat > 0 ? Math.round((10 + 6 * moat) * (1 + tech.moatDamage)) : 0,
    moatAtGate: moat > 0 && tech.drawbridge > 0,
    arrivalSeconds: Math.max(1, Math.round(PEASANT_ARRIVAL_SECONDS / (1 + tech.arrival))),
    buildSpeed: round2(1 + tech.buildSpeed),
    depthDiscount: tech.depthCost,
    cartDiscount: tech.cartCost,
    unitBonus: tech.units,
    growthBonus: tech.growth,
  };
}

/** Each building's effect lines at a level (with the techs bought), shown as "now → next" in the construction panel. */
export function buildingEffects(id: BuildingId, level: number, techs: readonly TechId[] = []): { label: string; value: string }[] {
  const round2 = (value: number) => Math.round(value * 100) / 100;
  // The wall's and gate's numbers depend on each other; show them with the other one built.
  const levels = { ...STARTING_BUILDINGS, wall: 1, gate: 1, [id]: level };
  const stats = buildingStats(levels, undefined, techs);
  const unit = DWELLING_UNIT[id];
  const recruits = unit
    ? [{ label: `${UNIT_STATS[unit].plural} per ${String(MUSTER_SECONDS / 60)} min`, value: String(unitGrowth(unit, level, stats.growthBonus[unit])) }]
    : [];
  if (isForge(id)) return [{ label: 'Working speed', value: `×${String(stats.forgeSpeed[id])}` }];
  if (isHouse(id)) {
    return [{ label: `Peasants it sleeps (the hold: at most ${String(MAX_PEASANTS)})`, value: String(Math.floor(houseBeds(level) * (1 + techBonuses(techs).beds))) }];
  }
  if (id === 'woodcutter') return [{ label: 'Wood cut', value: `${String(stats.woodPerSecond)} / s` }];
  if (id === 'granary') return [{ label: 'Food kept, each kind', value: String(stats.granaryCapacity) }];
  if (isOrchard(id)) return [{ label: 'Apples picked', value: `${String(round2(APPLES_PER_LEVEL * level))} / s` }];
  if (isFishery(id)) return [{ label: 'Fish landed', value: `${String(round2(FISH_PER_LEVEL * level))} / s` }];
  if (isPasture(id)) {
    return [
      { label: 'Sheep it grazes', value: String(SHEEP_PER_LEVEL * level) },
      { label: 'Lambs', value: `${String(round2(LAMBS_PER_LEVEL * level * 60))} / min` },
    ];
  }
  if (id === 'depot') {
    return [
      { label: 'Carts', value: String(stats.wagons) },
      { label: 'Each carries', value: String(stats.wagonLoad) },
      { label: 'Cart speed (× walking)', value: `×${String(stats.wagonSpeed)}` },
    ];
  }
  switch (id) {
    case 'keep':
      return [
        { label: 'Building level cap', value: String(stats.maxLevel) },
        { label: 'Buildings under construction at once', value: String(stats.buildSites) },
        { label: 'Taxes', value: `${String(stats.taxPerFiveSeconds * 12)} gold / min` },
      ];
    case 'warehouse':
      return [
        { label: 'Warehouse, each resource', value: stats.warehouseCapacity.toLocaleString() },
        { label: 'Mine stockpiles', value: String(stats.mineCapacity) },
        { label: 'Haulers (staff)', value: `${String(stats.haulers)} · ${String(stats.surfaceHaul)} / s` },
      ];
    case 'foundry':
      return [
        { label: 'Pickaxes: mined per miner', value: `${String(stats.minerRate)} / s` },
        { label: 'Mine cart load', value: String(stats.mineCartCapacity) },
      ];
    case 'research':
      return [
        { label: 'Digging speed', value: `×${String(stats.digSpeed)}` },
        { label: 'Tunnel cost', value: `${String(Math.round(stats.digCostFactor * 100))}%` },
        { label: 'Trap damage', value: `×${String(stats.trapPower)}` },
      ];
    case 'armory':
      return [
        { label: 'Attack, every unit', value: `+${String(stats.attackBonus)}` },
        { label: 'Defence, every unit', value: `+${String(stats.defenceBonus)}` },
      ];
    case 'wall':
      return [{ label: 'Health of each wall section', value: String(stats.wallHp) }];
    case 'gate':
      return [{ label: 'Gate health', value: String(stats.gateHp) }];
    case 'moat':
      return [{ label: 'Damage each round to raiders wading in it', value: String(stats.moatDamage) }];
    case 'docks':
      return [
        { label: 'A barge comes every (up to 5 wait)', value: `${String(stats.shipCycle)} s` },
        { label: 'Orders worth (at base prices)', value: `~${String(stats.shipHold)} gold` },
        { label: 'Prices', value: `+${String(Math.round(stats.tradeBonus * 100))}%` },
      ];
    case 'towers':
      return [
        { label: 'Towers', value: String(stats.towers) },
        { label: 'Damage per shot, every round', value: String(stats.towerDamage) },
      ];
    case 'stables':
      return [...recruits, { label: 'Hauler load (carts)', value: `×${String(Math.round((1 + 0.15 * level) * 100) / 100)}` }];
    default:
      return recruits;
  }
}

/** How many towers stand on the wall at a towers level (2 to start, more as it grows). */
export function towerCount(level: number) {
  return level <= 0 ? 0 : 2 + Math.floor(level / 5);
}

export const BUILDING_INFO: Record<BuildingId, { name: string; role: string }> = {
  keep: { name: 'Central Keep', role: 'Seat of the hold. Its level caps every other building, unlocks stronger units, adds builders and collects taxes. Its hall sleeps 8 peasants.' },
  ...(Object.fromEntries(HOUSE_IDS.map((id) => [id, {
    name: HOUSE_NAMES[id],
    role: `Homes for peasants, kept by housekeepers: without them nobody sleeps here and only the keep’s hall (8 beds) is left. New peasants arrive at the campfire while there are free beds. Build up to ${String(HOUSE_IDS.length)} houses, as the keep grows; the hold sleeps at most ${String(MAX_PEASANTS)} peasants.`,
  }])) as Record<HouseId, { name: string; role: string }>),
  warehouse: { name: 'Warehouses', role: 'Store more of each resource. Its haulers carry everything up from the mine.' },
  foundry: { name: 'Foundry', role: 'Forges better pickaxes and bigger mine carts.' },
  research: { name: 'Research Facility', role: 'Surveyors and engineers: faster, cheaper tunnelling, and deadlier traps.' },
  armory: { name: 'Armory', role: 'Arms and armour: more attack and defence for every unit in battle. Shows the forges, the carts and the gear store.' },
  depot: { name: 'Cart Depot', role: 'Carts and their carters. The forges work only from their own shelves: carts bring each one its materials from the warehouse and take its finished pieces back to the store, along the roads. More levels, more carts. Needs carters.' },
  granary: { name: 'Granary', role: 'Keeps the hold’s food: fish, apples and mutton. Without it only the keep’s larder (60 of each) is left. Every peasant eats one food every two minutes; with none left the hold goes hungry — no newcomers, and everyone works slower (the farms still bring food in at full speed).' },
  ...(Object.fromEntries([...ORCHARD_IDS, ...FISHERY_IDS, ...PASTURE_IDS].map((id) => [id, {
    name: farmName(id),
    role: isOrchard(id)
      ? 'Rows of apple trees in town; its pickers bring the apples to the granary. Build up to eight, as the keep grows.'
      : isFishery(id)
        ? 'A fishing hut on the river bank outside the walls, where the river meets the map’s ends; its fishermen land fish for the granary (barges buy fish too). Raiders who win on its side burn it down a level. Build up to eight, as the keep grows.'
        : 'Sheep grazing on the raiders’ ground outside the walls: the flock grows to 10 sheep a level and gives mutton for the granary and wool (barges buy it). Every raid from its side drives off a tenth of the flock — three tenths if the raiders win. Build up to eight, as the keep grows.',
  }])) as Record<FarmId, { name: string; role: string }>),
  woodcutter: { name: 'Woodcutter’s Hut', role: 'Woodcutters walk out through the gate and the pass to the forest on the mountains, fell the stand nearest the road (about 100 wood each) and carry the logs home to the warehouse; every stand cut down grows back elsewhere on the mountains. Wood goes into gear, into every building from level 2, and into the pit props of every tunnel. Higher levels cut more; needs woodcutters.' },
  ...(Object.fromEntries(FORGE_IDS.map((id) => [id, {
    name: FORGE_NAMES[id],
    role: 'A forge for one task at a time: set it to a part or a piece of gear and its smiths keep making it, from the warehouse and the parts store, until the stock reaches its target. Higher levels work faster. Each step of a recipe needs a forge of its own (or a forge set to each in turn).',
  }])) as Record<ForgeId, { name: string; role: string }>),
  wall: { name: 'Wall', role: 'Raiders on foot must break through it; arrows over it do half damage.' },
  towers: { name: 'Towers', role: 'Each tower shoots the strongest raiders every round of a battle. Needs no staff.' },
  gate: { name: 'Gate', role: 'Closes the gap in the wall (your troops can still use it) while gatekeepers man it.' },
  moat: { name: 'Moat', role: 'Floods the ditch round the walls from the river. Raiders on foot who wade in must stop there and take damage every round; the bridge at the gate stays dry. Needs the Central Keep at level 10.' },
  docks: { name: 'Docks', role: 'A quay at the back of the walled harbour on the river. River barges come and wait here — up to five — each with an order for one of your goods at a premium; fill it and the barge sails off. Bigger docks bring barges more often, with bigger orders and better prices. Needs dockhands.' },
  guardhouse: { name: 'Guardhouse', role: 'Raises pikemen: cheap, sturdy spear infantry.' },
  archery: { name: 'Archery Range', role: 'Raises crossbowmen: ranged support.' },
  barracks: { name: 'Barracks', role: 'Raises swordsmen: heavy melee infantry.' },
  monastery: { name: 'Monastery', role: 'Raises monks: ranged, and healers of the wounded.' },
  balloonWorks: { name: 'Balloon Works', role: 'Raises war balloons: bombers that melee cannot touch.' },
  stables: { name: 'Stables', role: 'Raises cavalry (keep level 9) and lends the haulers horses and carts.' },
  griffinEyrie: { name: 'Griffin Eyrie', role: 'Raises griffins: fliers that strike back twice.' },
  chapel: { name: 'Paladin Chapel', role: 'Raises paladins: elite knights whose courage strengthens the whole army.' },
  sanctum: { name: 'Celestial Sanctum', role: 'Raises angels: fliers who can resurrect the fallen.' },
};

// Building costs: treasury gold for every level, then warehouse resources. Coal is needed from the
// start; each ore joins the bill from a later level, so early levels need only what the first seams give.
// Buildings use only the first six resources (the newer ores go to the army).
const GROWTH = 1.3;
const RESOURCE_START: Partial<Record<Resource, number>> = { coal: 1, granite: 3, copper: 5, iron: 7, gold: 11, diamond: 15, wood: 2 };
const RESOURCE_BASE: Partial<Record<Resource, number>> = { coal: 25, granite: 30, copper: 20, iron: 20, gold: 10, diamond: 5, wood: 15 };
// Timber for frames and scaffolding: every building takes wood from level 2 — the stone works less, the
// keep more, the woodcutter's hut none.
const WOOD_USE: Partial<Record<BuildingId, number>> = { keep: 1.4, woodcutter: 0, wall: 0.4, towers: 0.5, gate: 0.6, moat: 0.3 };
// Per building: treasury gold at level 1, and how much of each resource it uses (1 = the base amount).
const COST_MIX: Record<BuildingId, { treasury: number; uses: Partial<Record<Resource, number>> }> = {
  keep: { treasury: 60, uses: { coal: 1, granite: 1.5, copper: 0.5, iron: 1, gold: 0.8, diamond: 1 } },
  ...(Object.fromEntries(HOUSE_IDS.map((id) => [id, { treasury: 30, uses: { coal: 0.6, granite: 0.8, copper: 0.3, iron: 0.3 } }])) as Record<HouseId, { treasury: number; uses: Partial<Record<Resource, number>> }>),
  warehouse: { treasury: 30, uses: { coal: 1, granite: 1, copper: 0.3, iron: 0.4 } },
  foundry: { treasury: 45, uses: { coal: 1.2, granite: 0.8, copper: 0.6, iron: 1, gold: 0.5, diamond: 0.8 } },
  research: { treasury: 50, uses: { coal: 0.8, granite: 0.6, copper: 1.2, iron: 0.6, gold: 1, diamond: 1 } },
  armory: { treasury: 45, uses: { coal: 1, granite: 0.4, copper: 0.8, iron: 1.4, gold: 0.4, diamond: 0.6 } },
  depot: { treasury: 35, uses: { coal: 0.6, granite: 0.8, copper: 0.3, iron: 0.5, gold: 0.2 } },
  granary: { treasury: 35, uses: { coal: 0.5, granite: 1, iron: 0.3 } },
  ...(Object.fromEntries(ORCHARD_IDS.map((id) => [id, { treasury: 25, uses: { coal: 0.3, granite: 0.3 } }])) as Record<FarmId, { treasury: number; uses: Partial<Record<Resource, number>> }>),
  ...(Object.fromEntries(FISHERY_IDS.map((id) => [id, { treasury: 20, uses: { coal: 0.3, granite: 0.2, iron: 0.2 } }])) as Record<FarmId, { treasury: number; uses: Partial<Record<Resource, number>> }>),
  ...(Object.fromEntries(PASTURE_IDS.map((id) => [id, { treasury: 25, uses: { coal: 0.3, granite: 0.2 } }])) as Record<FarmId, { treasury: number; uses: Partial<Record<Resource, number>> }>),
  // The hut takes no wood, so a hold without any can always start cutting.
  woodcutter: { treasury: 25, uses: { coal: 0.4, granite: 0.5, iron: 0.3 } },
  ...(Object.fromEntries(FORGE_IDS.map((id) => [id, { treasury: 40, uses: { coal: 1, granite: 0.8, iron: 0.5, copper: 0.3, gold: 0.2 } }])) as Record<ForgeId, { treasury: number; uses: Partial<Record<Resource, number>> }>),
  wall: { treasury: 35, uses: { coal: 0.4, granite: 1.6, iron: 0.6, diamond: 0.3 } },
  towers: { treasury: 40, uses: { coal: 0.4, granite: 1.2, copper: 0.3, iron: 0.8, gold: 0.2, diamond: 0.4 } },
  gate: { treasury: 40, uses: { coal: 0.5, granite: 1.2, copper: 0.5, iron: 1, gold: 0.5, diamond: 0.5 } },
  moat: { treasury: 70, uses: { coal: 0.8, granite: 1.4, copper: 0.3, iron: 0.6, gold: 0.4, diamond: 0.4 } },
  docks: { treasury: 45, uses: { coal: 0.8, granite: 1, copper: 0.6, iron: 0.6, gold: 0.4, diamond: 0.3 } },
  guardhouse: { treasury: 30, uses: { coal: 0.6, granite: 0.6, iron: 0.4 } },
  archery: { treasury: 35, uses: { coal: 0.6, granite: 0.5, copper: 0.4, iron: 0.4 } },
  barracks: { treasury: 40, uses: { coal: 0.8, granite: 0.8, copper: 0.3, iron: 0.6, gold: 0.3, diamond: 0.3 } },
  monastery: { treasury: 50, uses: { coal: 0.7, granite: 1, copper: 0.6, iron: 0.4, gold: 0.6, diamond: 0.4 } },
  balloonWorks: { treasury: 55, uses: { coal: 1, granite: 0.4, copper: 1.2, iron: 0.5, gold: 0.3, diamond: 0.4 } },
  stables: { treasury: 35, uses: { coal: 0.6, granite: 0.6, copper: 0.3, iron: 0.6, gold: 0.2, diamond: 0.2 } },
  griffinEyrie: { treasury: 65, uses: { coal: 0.6, granite: 1.4, copper: 0.4, iron: 0.6, gold: 0.5, diamond: 0.5 } },
  chapel: { treasury: 75, uses: { coal: 0.8, granite: 1.2, copper: 0.5, iron: 1, gold: 0.8, diamond: 0.6 } },
  sanctum: { treasury: 90, uses: { coal: 0.8, granite: 1, copper: 0.8, iron: 0.8, gold: 1, diamond: 1 } },
};

/** What it costs to raise a building to `level`. */
export function buildingCost(id: BuildingId, level: number): BuildCost {
  const mix = COST_MIX[id];
  const resources: Partial<Record<Resource, number>> = {};
  for (const resource of RESOURCES) {
    const use = resource === 'wood' ? (WOOD_USE[id] ?? 1) : (mix.uses[resource] ?? 0);
    const start = RESOURCE_START[resource];
    const base = RESOURCE_BASE[resource];
    if (use <= 0 || start === undefined || base === undefined || level < start) continue;
    resources[resource] = Math.max(1, Math.round(use * base * GROWTH ** (level - start)));
  }
  return { gold: Math.round(mix.treasury * GROWTH ** (level - 1)), resources };
}

/** Seconds of building work to raise a building to `level`. */
export function buildingTime(level: number) {
  return Math.round(6 + 2 * level ** 1.6);
}
