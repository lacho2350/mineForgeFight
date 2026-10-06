// The stronghold's buildings: what each one does at every level, what the next level costs and how
// long it takes to build. Pure data + maths (no React / Skia) so the store and the screens share it.
import { RESOURCES, type Resource } from './resources';
import { ARMY_RECRUITING, ARMY_UNITS, MUSTER_SECONDS, UNIT_STATS, unitGrowth, type ArmyUnit } from './units';

export const BUILDING_IDS = [
  'keep',
  'houses',
  'warehouse',
  'foundry',
  'research',
  'armory',
  'wall',
  'towers',
  'gate',
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
  houses: 1,
  warehouse: 1,
  foundry: 1,
  research: 0,
  armory: 0,
  wall: 0,
  towers: 0,
  gate: 0,
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

/** Keep level needed before a building's first level can be built (dwellings of strong units need more). */
export function requiredKeep(id: BuildingId) {
  const unit = DWELLING_UNIT[id];
  // Stables also pull the surface wagons, so they can be built early; cavalry still wait for the keep.
  return unit && id !== 'stables' ? ARMY_RECRUITING[unit].requiresKeep : 1;
}

/** Treasury gold plus resources taken from the warehouse. */
export type BuildCost = { gold: number; resources: Partial<Record<Resource, number>> };

/** Everything the buildings provide, derived from their levels. */
export type BuildingStats = {
  maxLevel: number;
  builders: number;
  taxPerFiveSeconds: number;
  beds: number;
  minerRate: number;
  mineCartCapacity: number;
  warehouseCapacity: number;
  mineCapacity: number;
  surfaceHaul: number;
  digSpeed: number;
  digCostFactor: number;
  tradeBonus: number;
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
};

const round1 = (value: number) => Math.round(value * 10) / 10;
const roundTo = (value: number, step: number) => Math.round(value / step) * step;

export function buildingStats(levels: BuildingLevels): BuildingStats {
  const { keep, houses, warehouse, foundry, research, armory, stables, wall, towers, gate } = levels;
  const mineCartCapacity = 12 + 2 * Math.max(0, foundry - 1);
  return {
    maxLevel: keep,
    builders: 1 + Math.floor(keep / 5),
    taxPerFiveSeconds: keep,
    beds: 2 * houses + Math.floor(houses ** 2 / 4),
    minerRate: round1(0.5 + 0.2 * Math.max(0, foundry - 1)),
    mineCartCapacity,
    warehouseCapacity: roundTo(100 * 1.3 ** Math.max(0, warehouse - 1), 10),
    // The mine's surface piles must always fit a few cart loads, or the carts would stall.
    mineCapacity: Math.max(50 + 25 * Math.max(0, warehouse - 1), mineCartCapacity * 4),
    surfaceHaul: 12 + 10 * stables,
    digSpeed: round1(1 + 0.1 * research),
    digCostFactor: round1(10 - 0.3 * research) / 10,
    tradeBonus: 0.03 * gate,
    attackBonus: Math.ceil(armory / 2),
    defenceBonus: Math.floor(armory / 2),
    wallHp: wall > 0 ? 15 + 12 * wall + wall ** 2 : 0,
    gateHp: wall > 0 && gate > 0 ? 20 + 15 * gate + gate ** 2 : 0,
    towers: towerCount(towers),
    towerDamage: towers > 0 ? 5 + 3 * towers : 0,
  };
}

/** Each building's effect lines at a level, shown as "now → next" in the construction panel. */
export function buildingEffects(id: BuildingId, level: number): { label: string; value: string }[] {
  // The wall's and gate's numbers depend on each other; show them with the other one built.
  const levels = { ...STARTING_BUILDINGS, wall: 1, gate: 1, [id]: level };
  const stats = buildingStats(levels);
  const unit = DWELLING_UNIT[id];
  const recruits = unit
    ? [{ label: `${UNIT_STATS[unit].plural} per ${String(MUSTER_SECONDS / 60)} min`, value: String(unitGrowth(unit, level)) }]
    : [];
  switch (id) {
    case 'keep':
      return [
        { label: 'Building level cap', value: String(stats.maxLevel) },
        { label: 'Builders', value: String(stats.builders) },
        { label: 'Taxes', value: `${String(stats.taxPerFiveSeconds * 12)} gold / min` },
      ];
    case 'houses':
      return [{ label: 'Miners housed', value: String(stats.beds) }];
    case 'warehouse':
      return [
        { label: 'Warehouse, each resource', value: stats.warehouseCapacity.toLocaleString() },
        { label: 'Mine stockpiles', value: String(stats.mineCapacity) },
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
      ];
    case 'armory':
      return [
        { label: 'Attack, every unit', value: `+${String(stats.attackBonus)}` },
        { label: 'Defence, every unit', value: `+${String(stats.defenceBonus)}` },
      ];
    case 'wall':
      return [{ label: 'Health of each wall section', value: String(stats.wallHp) }];
    case 'gate':
      return [
        { label: 'Gate health', value: String(stats.gateHp) },
        { label: 'Trade prices', value: `+${String(Math.round(stats.tradeBonus * 100))}%` },
      ];
    case 'towers':
      return [
        { label: 'Towers', value: String(stats.towers) },
        { label: 'Damage per shot, every round', value: String(stats.towerDamage) },
      ];
    case 'stables':
      return [...recruits, { label: 'Surface wagons haul', value: `${String(stats.surfaceHaul)} / s` }];
    default:
      return recruits;
  }
}

/** How many towers stand on the wall at a towers level (2 to start, more as it grows). */
export function towerCount(level: number) {
  return level <= 0 ? 0 : 2 + Math.floor(level / 5);
}

export const BUILDING_INFO: Record<BuildingId, { name: string; role: string }> = {
  keep: { name: 'Central Keep', role: 'Seat of the hold. Its level caps every other building, unlocks stronger units, adds builders and collects taxes.' },
  houses: { name: 'Workers’ Houses', role: 'Homes for miners. Every new bed brings a miner, who goes straight to work.' },
  warehouse: { name: 'Warehouses', role: 'Store more of each resource, here and at the mine.' },
  foundry: { name: 'Foundry', role: 'Forges better pickaxes and bigger mine carts.' },
  research: { name: 'Research Facility', role: 'Surveyors and engineers: faster, cheaper tunnelling.' },
  armory: { name: 'Armory', role: 'Arms and armour: more attack and defence for every unit in battle.' },
  wall: { name: 'Wall', role: 'Raiders on foot must break through it; arrows over it do half damage.' },
  towers: { name: 'Towers', role: 'Each tower shoots the strongest raiders every round of a battle.' },
  gate: { name: 'Gate', role: 'Closes the gap in the wall (your troops can still use it). Caravans pay more at a strong gate.' },
  guardhouse: { name: 'Guardhouse', role: 'Raises pikemen: cheap, sturdy spear infantry.' },
  archery: { name: 'Archery Range', role: 'Raises bowmen: ranged support.' },
  barracks: { name: 'Barracks', role: 'Raises swordsmen: heavy melee infantry.' },
  monastery: { name: 'Monastery', role: 'Raises monks: ranged, and healers of the wounded.' },
  balloonWorks: { name: 'Balloon Works', role: 'Raises war balloons: bombers that melee cannot touch.' },
  stables: { name: 'Stables', role: 'Raises cavalry (keep level 9) and keeps horses for the surface wagons.' },
  griffinEyrie: { name: 'Griffin Eyrie', role: 'Raises griffins: fliers that strike back twice.' },
  chapel: { name: 'Paladin Chapel', role: 'Raises paladins: elite knights whose courage strengthens the whole army.' },
  sanctum: { name: 'Celestial Sanctum', role: 'Raises angels: fliers who can resurrect the fallen.' },
};

// Building costs: treasury gold for every level, then warehouse resources. Coal is needed from the
// start; each ore joins the bill from a later level, so early levels need only what the first seams give.
const GROWTH = 1.3;
const RESOURCE_START: Record<Resource, number> = { coal: 1, granite: 3, copper: 5, iron: 7, gold: 11, diamond: 15 };
const RESOURCE_BASE: Record<Resource, number> = { coal: 25, granite: 30, copper: 20, iron: 20, gold: 10, diamond: 5 };
// Per building: treasury gold at level 1, and how much of each resource it uses (1 = the base amount).
const COST_MIX: Record<BuildingId, { treasury: number; uses: Partial<Record<Resource, number>> }> = {
  keep: { treasury: 60, uses: { coal: 1, granite: 1.5, copper: 0.5, iron: 1, gold: 0.8, diamond: 1 } },
  houses: { treasury: 30, uses: { coal: 0.6, granite: 0.8, copper: 0.3, iron: 0.3 } },
  warehouse: { treasury: 30, uses: { coal: 1, granite: 1, copper: 0.3, iron: 0.4 } },
  foundry: { treasury: 45, uses: { coal: 1.2, granite: 0.8, copper: 0.6, iron: 1, gold: 0.5, diamond: 0.8 } },
  research: { treasury: 50, uses: { coal: 0.8, granite: 0.6, copper: 1.2, iron: 0.6, gold: 1, diamond: 1 } },
  armory: { treasury: 45, uses: { coal: 1, granite: 0.4, copper: 0.8, iron: 1.4, gold: 0.4, diamond: 0.6 } },
  wall: { treasury: 35, uses: { coal: 0.4, granite: 1.6, iron: 0.6, diamond: 0.3 } },
  towers: { treasury: 40, uses: { coal: 0.4, granite: 1.2, copper: 0.3, iron: 0.8, gold: 0.2, diamond: 0.4 } },
  gate: { treasury: 40, uses: { coal: 0.5, granite: 1.2, copper: 0.5, iron: 1, gold: 0.5, diamond: 0.5 } },
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
    const use = mix.uses[resource] ?? 0;
    if (use <= 0 || level < RESOURCE_START[resource]) continue;
    resources[resource] = Math.max(1, Math.round(use * RESOURCE_BASE[resource] * GROWTH ** (level - RESOURCE_START[resource])));
  }
  return { gold: Math.round(mix.treasury * GROWTH ** (level - 1)), resources };
}

/** Seconds of building work to raise a building to `level`. */
export function buildingTime(level: number) {
  return Math.round(6 + 2 * level ** 1.6);
}
