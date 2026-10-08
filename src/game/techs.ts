// The tech tree: upgrades bought with gold, one branch per building and one for the mine. A tech is
// bought once and lasts for good. Each branch climbs in tiers (I → II → III): a tech needs the one
// before it, its building at a level (the mine: galleries opened), and sometimes a tech from another
// branch. `techBonuses` adds up what the owned techs do; buildings.ts and the store apply it. Pure TS.
import type { BuildingId } from './buildings';
import type { ArmyUnit } from './units';

/** A branch per building, but one for all the forges together. */
export type TechBranch = 'mine' | 'forges' | BuildingId;
export type Tier = 1 | 2 | 3;

/** What a branch's buildings must reach before a tier can be bought (the mine: galleries opened). */
export const TIER_LEVEL: Record<Tier, number> = { 1: 1, 2: 3, 3: 6 };
export const TIER_DEPTH: Record<Tier, number> = { 1: 1, 2: 2, 3: 4 };

export type UnitBonus = { attack: number; defence: number; shots: number };

/** Everything the owned techs add up to. */
export type TechBonuses = {
  // Multipliers, added up: 0.2 = +20%.
  minerRate: number;
  mineStock: number;
  digSpeed: number;
  tax: number;
  buildSpeed: number;
  beds: number;
  arrival: number;
  warehouse: number;
  haul: number;
  trapPower: number;
  trade: number;
  wallHp: number;
  gateHp: number;
  towerDamage: number;
  forgeSpeed: number;
  // The depot's carts: faster (0.25 = +25%).
  wagonSpeed: number;
  // Discounts, added up: 0.2 = 20% cheaper.
  digCost: number;
  depthCost: number;
  cartCost: number;
  techCost: number;
  shipCycle: number;
  // More goods the barge buys each call (0.5 = +50%).
  shipHold: number;
  // More moat damage (0.25 = +25%).
  moatDamage: number;
  // Flat additions.
  veinCapacity: number;
  cartLoad: number;
  buildSites: number;
  attack: number;
  defence: number;
  towerShots: number;
  // The depot's carts: more goods each, more carts.
  wagonLoad: number;
  wagonCount: number;
  wallOil: number;
  /** The gate's bridge is raised in battle (1 = yes). */
  drawbridge: number;
  /** Extra recruits per muster, per unit (0.25 = +25%). */
  growth: Partial<Record<ArmyUnit, number>>;
  /** Battle bonuses for one unit. */
  units: Partial<Record<ArmyUnit, UnitBonus>>;
};
type Scalar = Exclude<keyof TechBonuses, 'growth' | 'units'>;

export type Tech = {
  branch: TechBranch;
  tier: Tier;
  name: string;
  effect: string;
  gold: number;
  /** Techs needed first: the one before it in its branch, and maybe one from another branch. */
  requires: TechId[];
  bonus?: Partial<Record<Scalar, number>>;
  growth?: { unit: ArmyUnit; add: number };
  unit?: { unit: ArmyUnit } & Partial<UnitBonus>;
};

export const TECH_IDS = [
  // Mine
  'steelPicks', 'biggerBins', 'deepCarts', 'blastingPowder', 'steamDrills', 'shaftSurveys',
  // Economy
  'taxRolls', 'masterMasons', 'royalCharter',
  'bunkBeds', 'villageWell', 'stoneCottages',
  'shelving', 'handcarts', 'cellars',
  'temperedSteel', 'forgedBlades', 'blastFurnace',
  'greasedAxles', 'biggerWagons', 'draftHorses',
  'bellows', 'masterSmiths', 'waterHammers',
  'library', 'siegeEngineers', 'alchemy',
  // Defence
  'whetstones', 'chainMail', 'plateArmour',
  'mortar', 'buttresses', 'boilingOil',
  'longbows', 'fireArrows', 'ballistae',
  'ironBands', 'tollHouse', 'portcullis',
  'murkyWater', 'sharpenedStakes', 'drawbridge',
  'pilots', 'widerBarges', 'merchantGuild',
  // Dwellings
  'drillYard', 'longPikes', 'shieldWall',
  'fletchers', 'fullQuivers', 'marksmen',
  'recruitingSergeants', 'broadswords', 'towerShields',
  'novices', 'blessedBolts', 'ironVestments',
  'silkEnvelopes', 'bombRacks', 'armouredGondolas',
  'studFarm', 'lances', 'barding',
  'nestingCliffs', 'ironTalons', 'royalGriffins',
  'squires', 'sacredOaths', 'holySwords',
  'celestialChoir', 'haloes', 'flamingSwords',
] as const;
export type TechId = (typeof TECH_IDS)[number];

export const TECHS: Record<TechId, Tech> = {
  // ——— The mine ———
  steelPicks: { branch: 'mine', tier: 1, name: 'Steel picks', effect: 'Miners cut 20% faster.', gold: 120, requires: [], bonus: { minerRate: 0.2 } },
  biggerBins: { branch: 'mine', tier: 1, name: 'Bigger bins', effect: 'The miners’ bins hold 50 more of each resource.', gold: 100, requires: [], bonus: { veinCapacity: 50 } },
  deepCarts: { branch: 'mine', tier: 2, name: 'Deep carts', effect: 'Mine carts carry 6 more per load.', gold: 300, requires: ['biggerBins'], bonus: { cartLoad: 6 } },
  blastingPowder: { branch: 'mine', tier: 2, name: 'Blasting powder', effect: 'Tunnels are dug 40% faster and cost 20% less.', gold: 350, requires: ['steelPicks'], bonus: { digSpeed: 0.4, digCost: 0.2 } },
  steamDrills: { branch: 'mine', tier: 3, name: 'Steam drills', effect: 'Miners cut another 30% faster.', gold: 1400, requires: ['blastingPowder', 'temperedSteel'], bonus: { minerRate: 0.3 } },
  shaftSurveys: { branch: 'mine', tier: 3, name: 'Shaft surveys', effect: 'Opening a gallery and buying carts cost 25% less.', gold: 900, requires: ['deepCarts'], bonus: { depthCost: 0.25, cartCost: 0.25 } },

  // ——— Economy ———
  taxRolls: { branch: 'keep', tier: 1, name: 'Tax rolls', effect: 'Taxes +25%.', gold: 150, requires: [], bonus: { tax: 0.25 } },
  masterMasons: { branch: 'keep', tier: 2, name: 'Master masons', effect: 'Building crews work 25% faster.', gold: 600, requires: ['taxRolls'], bonus: { buildSpeed: 0.25 } },
  royalCharter: { branch: 'keep', tier: 3, name: 'Royal charter', effect: 'One more building site at once, and taxes +25% more.', gold: 2200, requires: ['masterMasons'], bonus: { buildSites: 1, tax: 0.25 } },

  bunkBeds: { branch: 'houses', tier: 1, name: 'Bunk beds', effect: 'Houses sleep 20% more peasants.', gold: 120, requires: [], bonus: { beds: 0.2 } },
  villageWell: { branch: 'houses', tier: 2, name: 'Village well', effect: 'Newcomers arrive twice as often.', gold: 450, requires: ['bunkBeds'], bonus: { arrival: 1 } },
  stoneCottages: { branch: 'houses', tier: 3, name: 'Stone cottages', effect: 'Houses sleep 30% more again.', gold: 1500, requires: ['villageWell'], bonus: { beds: 0.3 } },

  shelving: { branch: 'warehouse', tier: 1, name: 'Shelving', effect: 'Warehouses hold 25% more.', gold: 150, requires: [], bonus: { warehouse: 0.25 } },
  handcarts: { branch: 'warehouse', tier: 2, name: 'Handcarts', effect: 'Haulers carry 30% more per trip.', gold: 500, requires: ['shelving'], bonus: { haul: 0.3 } },
  cellars: { branch: 'warehouse', tier: 3, name: 'Cellars', effect: 'Warehouses hold 50% more again, the mine’s stockpiles 50% more.', gold: 1800, requires: ['handcarts'], bonus: { warehouse: 0.5, mineStock: 0.5 } },

  temperedSteel: { branch: 'foundry', tier: 1, name: 'Tempered steel', effect: 'Miners cut 10% faster; mine carts carry 2 more.', gold: 180, requires: [], bonus: { minerRate: 0.1, cartLoad: 2 } },
  forgedBlades: { branch: 'foundry', tier: 2, name: 'Forged blades', effect: 'Every unit +1 attack.', gold: 700, requires: ['temperedSteel'], bonus: { attack: 1 } },
  greasedAxles: { branch: 'depot', tier: 1, name: 'Greased axles', effect: 'Carts go 25% faster.', gold: 150, requires: [], bonus: { wagonSpeed: 0.25 } },
  biggerWagons: { branch: 'depot', tier: 2, name: 'Bigger wagons', effect: 'Every cart carries 6 more.', gold: 500, requires: ['greasedAxles'], bonus: { wagonLoad: 6 } },
  draftHorses: { branch: 'depot', tier: 3, name: 'Draft horses', effect: 'Carts go 50% faster again, and the depot gets 2 more.', gold: 1500, requires: ['biggerWagons', 'studFarm'], bonus: { wagonSpeed: 0.5, wagonCount: 2 } },
  bellows: { branch: 'forges', tier: 1, name: 'Bellows', effect: 'Every forge works 20% faster.', gold: 150, requires: [], bonus: { forgeSpeed: 0.2 } },
  masterSmiths: { branch: 'forges', tier: 2, name: 'Master smiths', effect: 'Every forge works 30% faster again.', gold: 600, requires: ['bellows'], bonus: { forgeSpeed: 0.3 } },
  waterHammers: { branch: 'forges', tier: 3, name: 'Water hammers', effect: 'Every forge works 50% faster again.', gold: 1800, requires: ['masterSmiths', 'temperedSteel'], bonus: { forgeSpeed: 0.5 } },
  blastFurnace: { branch: 'foundry', tier: 3, name: 'Blast furnace', effect: 'Miners cut 20% faster again; mine carts carry 4 more.', gold: 2000, requires: ['forgedBlades'], bonus: { minerRate: 0.2, cartLoad: 4 } },

  library: { branch: 'research', tier: 1, name: 'Library', effect: 'Every tech costs 10% less.', gold: 200, requires: [], bonus: { techCost: 0.1 } },
  siegeEngineers: { branch: 'research', tier: 2, name: 'Siege engineers', effect: 'Traps do 30% more damage.', gold: 600, requires: ['library'], bonus: { trapPower: 0.3 } },
  alchemy: { branch: 'research', tier: 3, name: 'Alchemy', effect: 'Barges pay 20% more for everything.', gold: 1800, requires: ['siegeEngineers'], bonus: { trade: 0.2 } },

  // ——— Defence ———
  whetstones: { branch: 'armory', tier: 1, name: 'Whetstones', effect: 'Every unit +1 attack.', gold: 200, requires: [], bonus: { attack: 1 } },
  chainMail: { branch: 'armory', tier: 2, name: 'Chain mail', effect: 'Every unit +2 defence.', gold: 750, requires: ['whetstones'], bonus: { defence: 2 } },
  plateArmour: { branch: 'armory', tier: 3, name: 'Plate armour', effect: 'Every unit +2 attack and +2 defence.', gold: 2400, requires: ['chainMail', 'temperedSteel'], bonus: { attack: 2, defence: 2 } },

  mortar: { branch: 'wall', tier: 1, name: 'Mortar', effect: 'Wall sections +25% health.', gold: 150, requires: [], bonus: { wallHp: 0.25 } },
  buttresses: { branch: 'wall', tier: 2, name: 'Buttresses', effect: 'Wall sections +50% health more.', gold: 600, requires: ['mortar'], bonus: { wallHp: 0.5 } },
  boilingOil: { branch: 'wall', tier: 3, name: 'Boiling oil', effect: 'Every round, raiders beside a standing wall section take 20 damage.', gold: 2000, requires: ['buttresses', 'siegeEngineers'], bonus: { wallOil: 20 } },

  longbows: { branch: 'towers', tier: 1, name: 'Longbows', effect: 'Towers hit 25% harder.', gold: 200, requires: [], bonus: { towerDamage: 0.25 } },
  fireArrows: { branch: 'towers', tier: 2, name: 'Fire arrows', effect: 'Towers hit 50% harder again.', gold: 700, requires: ['longbows', 'temperedSteel'], bonus: { towerDamage: 0.5 } },
  ballistae: { branch: 'towers', tier: 3, name: 'Ballista platforms', effect: 'Every tower shoots twice a round.', gold: 2500, requires: ['fireArrows'], bonus: { towerShots: 1 } },

  ironBands: { branch: 'gate', tier: 1, name: 'Iron bands', effect: 'The gate +40% health.', gold: 150, requires: [], bonus: { gateHp: 0.4 } },
  tollHouse: { branch: 'gate', tier: 2, name: 'Toll house', effect: 'Merchants pay their way in: trade prices +10%.', gold: 500, requires: ['ironBands'], bonus: { trade: 0.1 } },
  portcullis: { branch: 'gate', tier: 3, name: 'Portcullis', effect: 'The gate +100% health more.', gold: 1500, requires: ['tollHouse'], bonus: { gateHp: 1 } },

  murkyWater: { branch: 'moat', tier: 1, name: 'Murky water', effect: 'The moat does 25% more damage.', gold: 200, requires: [], bonus: { moatDamage: 0.25 } },
  sharpenedStakes: { branch: 'moat', tier: 2, name: 'Sharpened stakes', effect: 'Stakes under the water: the moat does 50% more damage again.', gold: 700, requires: ['murkyWater'], bonus: { moatDamage: 0.5 } },
  drawbridge: { branch: 'moat', tier: 3, name: 'Drawbridge', effect: 'The bridge at the gate is raised in battle: raiders must wade there too.', gold: 1800, requires: ['sharpenedStakes'], bonus: { drawbridge: 1 } },
  pilots: { branch: 'docks', tier: 1, name: 'River pilots', effect: 'Barges come 20% more often.', gold: 150, requires: [], bonus: { shipCycle: 0.2 } },
  widerBarges: { branch: 'docks', tier: 2, name: 'Wider barges', effect: 'Barges bring orders 50% bigger.', gold: 500, requires: ['pilots'], bonus: { shipHold: 0.5 } },
  merchantGuild: { branch: 'docks', tier: 3, name: 'Merchant guild', effect: 'Barges pay 15% more.', gold: 1600, requires: ['widerBarges'], bonus: { trade: 0.15 } },

  // ——— Dwellings: more recruits, then better soldiers ———
  drillYard: { branch: 'guardhouse', tier: 1, name: 'Drill yard', effect: '+25% pikemen per muster.', gold: 120, requires: [], growth: { unit: 'pikeman', add: 0.25 } },
  longPikes: { branch: 'guardhouse', tier: 2, name: 'Long pikes', effect: 'Pikemen +2 attack.', gold: 400, requires: ['drillYard'], unit: { unit: 'pikeman', attack: 2 } },
  shieldWall: { branch: 'guardhouse', tier: 3, name: 'Shield wall', effect: 'Pikemen +4 defence.', gold: 1200, requires: ['longPikes'], unit: { unit: 'pikeman', defence: 4 } },

  fletchers: { branch: 'archery', tier: 1, name: 'Fletchers', effect: '+25% crossbowmen per muster.', gold: 150, requires: [], growth: { unit: 'bowman', add: 0.25 } },
  fullQuivers: { branch: 'archery', tier: 2, name: 'Full quivers', effect: 'Crossbowmen carry 6 more bolts.', gold: 450, requires: ['fletchers'], unit: { unit: 'bowman', shots: 6 } },
  marksmen: { branch: 'archery', tier: 3, name: 'Marksmen', effect: 'Crossbowmen +3 attack.', gold: 1300, requires: ['fullQuivers'], unit: { unit: 'bowman', attack: 3 } },

  recruitingSergeants: { branch: 'barracks', tier: 1, name: 'Recruiting sergeants', effect: '+25% swordsmen per muster.', gold: 200, requires: [], growth: { unit: 'swordsman', add: 0.25 } },
  broadswords: { branch: 'barracks', tier: 2, name: 'Broadswords', effect: 'Swordsmen +3 attack.', gold: 600, requires: ['recruitingSergeants'], unit: { unit: 'swordsman', attack: 3 } },
  towerShields: { branch: 'barracks', tier: 3, name: 'Tower shields', effect: 'Swordsmen +4 defence.', gold: 1600, requires: ['broadswords'], unit: { unit: 'swordsman', defence: 4 } },

  novices: { branch: 'monastery', tier: 1, name: 'Novices', effect: '+25% monks per muster.', gold: 250, requires: [], growth: { unit: 'monk', add: 0.25 } },
  blessedBolts: { branch: 'monastery', tier: 2, name: 'Blessed bolts', effect: 'Monks +3 attack.', gold: 700, requires: ['novices'], unit: { unit: 'monk', attack: 3 } },
  ironVestments: { branch: 'monastery', tier: 3, name: 'Iron vestments', effect: 'Monks +3 defence and 4 more bolts.', gold: 1800, requires: ['blessedBolts'], unit: { unit: 'monk', defence: 3, shots: 4 } },

  silkEnvelopes: { branch: 'balloonWorks', tier: 1, name: 'Silk envelopes', effect: '+25% balloons per muster.', gold: 300, requires: [], growth: { unit: 'balloon', add: 0.25 } },
  bombRacks: { branch: 'balloonWorks', tier: 2, name: 'Bomb racks', effect: 'Balloons carry 4 more bombs.', gold: 800, requires: ['silkEnvelopes'], unit: { unit: 'balloon', shots: 4 } },
  armouredGondolas: { branch: 'balloonWorks', tier: 3, name: 'Armoured gondolas', effect: 'Balloons +4 defence.', gold: 2000, requires: ['bombRacks'], unit: { unit: 'balloon', defence: 4 } },

  studFarm: { branch: 'stables', tier: 1, name: 'Stud farm', effect: '+25% cavalry per muster.', gold: 300, requires: [], growth: { unit: 'cavalry', add: 0.25 } },
  lances: { branch: 'stables', tier: 2, name: 'Lances', effect: 'Cavalry +3 attack.', gold: 900, requires: ['studFarm'], unit: { unit: 'cavalry', attack: 3 } },
  barding: { branch: 'stables', tier: 3, name: 'Barding', effect: 'Cavalry +4 defence.', gold: 2200, requires: ['lances'], unit: { unit: 'cavalry', defence: 4 } },

  nestingCliffs: { branch: 'griffinEyrie', tier: 1, name: 'Nesting cliffs', effect: '+25% griffins per muster.', gold: 350, requires: [], growth: { unit: 'griffin', add: 0.25 } },
  ironTalons: { branch: 'griffinEyrie', tier: 2, name: 'Iron talons', effect: 'Griffins +3 attack.', gold: 1000, requires: ['nestingCliffs'], unit: { unit: 'griffin', attack: 3 } },
  royalGriffins: { branch: 'griffinEyrie', tier: 3, name: 'Royal griffins', effect: 'Griffins +3 attack and +3 defence.', gold: 2400, requires: ['ironTalons'], unit: { unit: 'griffin', attack: 3, defence: 3 } },

  squires: { branch: 'chapel', tier: 1, name: 'Squires', effect: '+25% paladins per muster.', gold: 400, requires: [], growth: { unit: 'paladin', add: 0.25 } },
  sacredOaths: { branch: 'chapel', tier: 2, name: 'Sacred oaths', effect: 'Paladins +3 defence.', gold: 1100, requires: ['squires'], unit: { unit: 'paladin', defence: 3 } },
  holySwords: { branch: 'chapel', tier: 3, name: 'Holy swords', effect: 'Paladins +4 attack.', gold: 2600, requires: ['sacredOaths'], unit: { unit: 'paladin', attack: 4 } },

  celestialChoir: { branch: 'sanctum', tier: 1, name: 'Celestial choir', effect: '+25% angels per muster.', gold: 500, requires: [], growth: { unit: 'angel', add: 0.25 } },
  haloes: { branch: 'sanctum', tier: 2, name: 'Haloes', effect: 'Angels +3 defence.', gold: 1200, requires: ['celestialChoir'], unit: { unit: 'angel', defence: 3 } },
  flamingSwords: { branch: 'sanctum', tier: 3, name: 'Flaming swords', effect: 'Angels +4 attack.', gold: 3000, requires: ['haloes'], unit: { unit: 'angel', attack: 4 } },
};

/** The branches in the order the tree shows them. */
export const TECH_BRANCHES: TechBranch[] = [
  'mine',
  'keep',
  'houses',
  'warehouse',
  'foundry',
  'research',
  'armory',
  'depot',
  'forges',
  'wall',
  'towers',
  'gate',
  'moat',
  'docks',
  'guardhouse',
  'archery',
  'barracks',
  'monastery',
  'balloonWorks',
  'stables',
  'griffinEyrie',
  'chapel',
  'sanctum',
];

export const techsOf = (branch: TechBranch) => TECH_IDS.filter((id) => TECHS[id].branch === branch);

const ROMAN: Record<Tier, string> = { 1: 'I', 2: 'II', 3: 'III' };
export const tierName = (tier: Tier) => ROMAN[tier];

export const isTechId = (id: unknown): id is TechId => typeof id === 'string' && (TECH_IDS as readonly string[]).includes(id);

/** What the owned techs add up to. */
export function techBonuses(owned: readonly TechId[] = []): TechBonuses {
  const total: TechBonuses = {
    minerRate: 0, mineStock: 0, digSpeed: 0, tax: 0, buildSpeed: 0, beds: 0, arrival: 0, warehouse: 0, haul: 0,
    trapPower: 0, trade: 0, wallHp: 0, gateHp: 0, towerDamage: 0, forgeSpeed: 0, wagonSpeed: 0, wagonLoad: 0, wagonCount: 0,
    digCost: 0, depthCost: 0, cartCost: 0, techCost: 0, shipCycle: 0, shipHold: 0, moatDamage: 0,
    veinCapacity: 0, cartLoad: 0, buildSites: 0, attack: 0, defence: 0, towerShots: 0, wallOil: 0, drawbridge: 0,
    growth: {},
    units: {},
  };
  for (const id of owned) {
    const tech = TECHS[id] as Tech | undefined;
    if (!tech) continue;
    for (const [key, value] of Object.entries(tech.bonus ?? {}) as [Scalar, number][]) total[key] += value;
    if (tech.growth) total.growth[tech.growth.unit] = (total.growth[tech.growth.unit] ?? 0) + tech.growth.add;
    if (tech.unit) {
      const current = total.units[tech.unit.unit] ?? { attack: 0, defence: 0, shots: 0 };
      total.units[tech.unit.unit] = {
        attack: current.attack + (tech.unit.attack ?? 0),
        defence: current.defence + (tech.unit.defence ?? 0),
        shots: current.shots + (tech.unit.shots ?? 0),
      };
    }
  }
  return total;
}

/** Gold a tech costs, after the library's discount. */
export function techCost(owned: readonly TechId[], id: TechId) {
  return Math.round(TECHS[id].gold * (1 - techBonuses(owned).techCost));
}
