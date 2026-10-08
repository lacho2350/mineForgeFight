// Every creature that can stand on a battlefield: the hold's nine units (each raised in its own
// building) and the raiders that attack it. Stats follow Heroes of Might and Magic III conventions:
// attack/defence change damage by 5% / 2.5% per point, damage is rolled per creature, a stack's
// health is a pool (the top creature may be wounded). Pure data, no React/Skia.
import type { BuildingId } from './buildings';

export const ARMY_UNITS = ['pikeman', 'bowman', 'swordsman', 'monk', 'balloon', 'cavalry', 'griffin', 'paladin', 'angel'] as const;
export type ArmyUnit = (typeof ARMY_UNITS)[number];

export const ENEMY_UNITS = ['goblin', 'wolfRider', 'orcArcher', 'harpy', 'ogre', 'cyclops', 'behemoth'] as const;
export type EnemyUnit = (typeof ENEMY_UNITS)[number];

export type UnitId = ArmyUnit | EnemyUnit;

export type UnitStats = {
  name: string;
  plural: string;
  attack: number;
  defence: number;
  minDamage: number;
  maxDamage: number;
  hp: number;
  speed: number;
  /** Ranged units: arrows/bolts per battle. Adjacent enemies force them to fight in melee at half damage. */
  shots?: number;
  /** Flies over walls and other stacks. */
  flying?: boolean;
  /** Can't be attacked in melee (and so is never pinned down); only shooters and towers can hurt it. */
  meleeImmune?: boolean;
  /** Instead of attacking, restores this much health per creature to a living ally (not past its starting strength). */
  heals?: number;
  /** Once per battle, restores this much health per creature to an ally, bringing back the fallen (even a destroyed stack). */
  resurrects?: number;
  /** While the stack lives, every allied stack gets this bonus. */
  aura?: { attack: number; defence: number };
  /** +5% damage for every hex moved before a melee attack. */
  joust?: boolean;
  /** +50% damage against riders. */
  antiCavalry?: boolean;
  isCavalry?: boolean;
  /** Retaliations per round (default 1). */
  retaliations?: number;
  /** Returns to where it started after a melee attack. */
  strikeAndReturn?: boolean;
  /** Ignores this share of the target's defence. */
  ignoreDefence?: number;
  /** Can batter walls and gates with its shots. */
  siege?: boolean;
  /** Double damage to walls and gates. */
  wallBreaker?: boolean;
  /** Rough fighting value of one creature, used by the AI and to size raids. */
  value: number;
  ability: string;
};

export const UNIT_STATS: Record<UnitId, UnitStats> = {
  // ——— The hold's army (tier 1 → 9) ———
  pikeman: {
    name: 'Pikeman', plural: 'Pikemen', attack: 4, defence: 5, minDamage: 1, maxDamage: 3, hp: 10, speed: 4,
    antiCavalry: true, value: 80, ability: 'Set pikes: +50% damage against riders.',
  },
  bowman: {
    name: 'Crossbowman', plural: 'Crossbowmen', attack: 6, defence: 3, minDamage: 2, maxDamage: 3, hp: 10, speed: 4,
    shots: 12, value: 126, ability: 'Ranged: 12 bolts.',
  },
  swordsman: {
    name: 'Swordsman', plural: 'Swordsmen', attack: 10, defence: 12, minDamage: 6, maxDamage: 9, hp: 35, speed: 5,
    value: 445, ability: 'Heavy infantry: tough and steady.',
  },
  monk: {
    name: 'Monk', plural: 'Monks', attack: 12, defence: 7, minDamage: 10, maxDamage: 12, hp: 30, speed: 5,
    shots: 12, heals: 10, value: 520, ability: 'Ranged: 12 bolts. Or heals an ally 10 HP per monk, bringing back its fallen.',
  },
  balloon: {
    name: 'Balloon', plural: 'Balloons', attack: 12, defence: 10, minDamage: 8, maxDamage: 14, hp: 40, speed: 6,
    shots: 10, flying: true, meleeImmune: true, value: 720,
    ability: 'Ranged: 10 bombs. Floats out of reach: immune to melee and never pinned down.',
  },
  cavalry: {
    name: 'Cavalier', plural: 'Cavalry', attack: 15, defence: 15, minDamage: 15, maxDamage: 25, hp: 100, speed: 7,
    joust: true, isCavalry: true, value: 1950, ability: 'Charge: +5% damage for every hex ridden before striking.',
  },
  griffin: {
    name: 'Griffin', plural: 'Griffins', attack: 16, defence: 14, minDamage: 18, maxDamage: 26, hp: 120, speed: 9,
    flying: true, retaliations: 2, value: 2300, ability: 'Flies. Strikes back twice each round.',
  },
  paladin: {
    name: 'Paladin', plural: 'Paladins', attack: 20, defence: 22, minDamage: 25, maxDamage: 35, hp: 160, speed: 6,
    aura: { attack: 2, defence: 2 }, value: 3400, ability: 'Courage: every allied stack gets +2 attack and +2 defence while paladins stand.',
  },
  angel: {
    name: 'Angel', plural: 'Angels', attack: 22, defence: 22, minDamage: 50, maxDamage: 50, hp: 200, speed: 12,
    flying: true, resurrects: 100, value: 5500, ability: 'Flies. Once per battle resurrects an ally: 100 HP per angel, even a fallen stack.',
  },

  // ——— Raiders ———
  goblin: {
    name: 'Goblin', plural: 'Goblins', attack: 4, defence: 2, minDamage: 1, maxDamage: 2, hp: 5, speed: 5,
    value: 60, ability: 'Many and cheap.',
  },
  wolfRider: {
    name: 'Wolf Rider', plural: 'Wolf Riders', attack: 7, defence: 5, minDamage: 2, maxDamage: 4, hp: 10, speed: 6,
    isCavalry: true, value: 130, ability: 'Fast riders (pikemen hit them harder).',
  },
  orcArcher: {
    name: 'Orc Archer', plural: 'Orc Archers', attack: 8, defence: 4, minDamage: 2, maxDamage: 5, hp: 15, speed: 4,
    shots: 12, value: 190, ability: 'Ranged: 12 arrows (half damage over the wall).',
  },
  harpy: {
    name: 'Harpy', plural: 'Harpies', attack: 6, defence: 5, minDamage: 1, maxDamage: 4, hp: 14, speed: 6,
    flying: true, strikeAndReturn: true, value: 240, ability: 'Flies over the wall, strikes and flies back.',
  },
  ogre: {
    name: 'Ogre', plural: 'Ogres', attack: 13, defence: 7, minDamage: 6, maxDamage: 12, hp: 40, speed: 4,
    wallBreaker: true, value: 420, ability: 'Wall-breaker: double damage to walls and gates.',
  },
  cyclops: {
    name: 'Cyclops', plural: 'Cyclopes', attack: 17, defence: 13, minDamage: 16, maxDamage: 20, hp: 70, speed: 6,
    shots: 16, siege: true, value: 1300, ability: 'Ranged: hurls boulders, and smashes walls when they are in the way.',
  },
  behemoth: {
    name: 'Behemoth', plural: 'Behemoths', attack: 17, defence: 17, minDamage: 30, maxDamage: 50, hp: 160, speed: 6,
    ignoreDefence: 0.4, value: 1700, ability: 'Crushing claws: ignores 40% of defence.',
  },
};

/**
 * Where each unit is raised, the gold one costs, how many come per muster and the keep level they need.
 * Each soldier also takes one piece of its gear, made at the armory (`UNIT_GEAR` in items.ts).
 */
export const ARMY_RECRUITING: Record<ArmyUnit, { dwelling: BuildingId; gold: number; growth: number; requiresKeep: number }> = {
  pikeman: { dwelling: 'guardhouse', gold: 25, growth: 14, requiresKeep: 1 },
  bowman: { dwelling: 'archery', gold: 40, growth: 9, requiresKeep: 2 },
  swordsman: { dwelling: 'barracks', gold: 120, growth: 4, requiresKeep: 3 },
  monk: { dwelling: 'monastery', gold: 160, growth: 3, requiresKeep: 5 },
  balloon: { dwelling: 'balloonWorks', gold: 240, growth: 2, requiresKeep: 7 },
  cavalry: { dwelling: 'stables', gold: 400, growth: 2, requiresKeep: 9 },
  griffin: { dwelling: 'griffinEyrie', gold: 500, growth: 2, requiresKeep: 11 },
  paladin: { dwelling: 'chapel', gold: 800, growth: 1, requiresKeep: 13 },
  angel: { dwelling: 'sanctum', gold: 1200, growth: 1, requiresKeep: 15 },
};

/** Seconds between musters: each dwelling's new recruits arrive spread over this time. */
export const MUSTER_SECONDS = 120;

/** Recruits a dwelling adds per muster at a level (0 when it isn't built); `bonus` from techs (0.25 = +25%). */
export function unitGrowth(unit: ArmyUnit, dwellingLevel: number, bonus = 0) {
  if (dwellingLevel <= 0) return 0;
  return Math.round(ARMY_RECRUITING[unit].growth * (1 + 0.15 * (dwellingLevel - 1)) * (1 + bonus) * 10) / 10;
}

/** Recruits pile up for at most this many musters. */
export const MAX_MUSTERS_WAITING = 3;

export type Army = Record<ArmyUnit, number>;
export const emptyArmy = (): Army => ({ pikeman: 0, bowman: 0, swordsman: 0, monk: 0, balloon: 0, cavalry: 0, griffin: 0, paladin: 0, angel: 0 });

export const armyValue = (army: Partial<Record<UnitId, number>>) =>
  Object.entries(army).reduce((sum, [unit, count]) => sum + UNIT_STATS[unit as UnitId].value * (count ?? 0), 0);
