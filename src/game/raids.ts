// Raiders: when they come, from where, and who comes. Each raid is sized to the hold: a share of what
// the hold can field (its army and, at half their worth, its defences), a share that grows raid by raid
// but stays below the hold's own power — and never below a small floor, so an undefended hold is still
// raided. A hold that keeps losing gets smaller raids until it wins again, so it can recover. Pure TS.
import { RAID_SIDES, type MapSide } from './cityMap';
import { UNIT_STATS, type EnemyUnit } from './units';

/** Game second the first raiders reach the gate. */
export const FIRST_RAID_AT = 360;
/** Seconds from the end of one raid to the arrival of the next. */
export const RAID_INTERVAL = 300;
/** Raiders are sighted this many seconds before they arrive. */
export const RAID_WARNING = 60;
/** Once at the gate, the battle fights itself if nobody takes command within this many seconds. */
export const RAID_AUTO_AFTER = 30;
/** Share of the treasury and of each warehouse resource the raiders carry off if they win. */
export const PLUNDER_SHARE = 0.3;

export type RaidParty = { unit: EnemyUnit; count: number }[];

/** What the hold can field against raiders, in the same units as a raid's strength (creature values). */
export type HoldPower = { army: number; defences: number; total: number };

// A raider's value per point of health (goblins 12, ogres 10.5, behemoths 10.6), and the rounds a
// typical battle lasts: what the defences are measured by.
const VALUE_PER_HP = 11;
const TYPICAL_ROUNDS = 5;
/** Defences count at half their worth: they can't chase raiders, and building them should pay off. */
const DEFENCE_WEIGHT = 0.5;

/**
 * The hold's power: the army's value, plus the defences measured as the raiders they'd destroy or hold
 * back in a typical battle — tower shots, wall and gate health, the moat, and the traps on an average side.
 */
export function holdPower({ army, towers, towerDamage, towerShots, wallHp, gateHp, trapDamage, moatDamage = 0 }: {
  army: number;
  towers: number;
  towerDamage: number;
  towerShots: number;
  wallHp: number;
  gateHp: number;
  /** Damage the traps on an average side of the belt do to a raid. */
  trapDamage: number;
  /** Damage the moat does each round to a company wading in it. */
  moatDamage?: number;
}): HoldPower {
  const shooting = towers * towerDamage * towerShots * TYPICAL_ROUNDS * VALUE_PER_HP;
  const walls = wallHp * 8 + gateHp;
  // The moat catches a few companies on foot for a couple of rounds each.
  const moat = moatDamage * 3 * 2;
  const defences = Math.round((shooting + walls + (trapDamage + moat) * VALUE_PER_HP) * DEFENCE_WEIGHT);
  return { army: Math.round(army), defences, total: Math.round(army) + defences };
}

/** The smallest raid `n` can be, whatever the hold: 150 (a few goblins), growing to 400 by raid 26. */
export const raidFloor = (n: number) => Math.min(400, 150 + 10 * (n - 1));
/** Raid `n` brings this share of the hold's power: half at first, 1% more each raid, up to 90%. */
export const raidShare = (n: number) => Math.min(0.9, 0.5 + 0.01 * (n - 1));
/** After raids lost in a row the next one comes smaller: a quarter less for each loss, down to 40%. */
export const raidRelief = (lostInARow: number) => Math.max(0.4, 0.75 ** Math.max(0, lostInARow));

/** The strength (total creature value) of raid `n` against a hold of this power that has lost the last `lostInARow` raids. */
export function raidStrength(n: number, power: number, lostInARow = 0) {
  return Math.round(Math.max(raidFloor(n), power * raidShare(n)) * raidRelief(lostInARow));
}

/** A party's total creature value. */
export const partyValue = (party: RaidParty) => party.reduce((sum, { unit, count }) => sum + UNIT_STATS[unit].value * count, 0);

/** Gold bounty for beating raiders of this strength. */
export function raidBounty(strength: number) {
  return Math.round(strength * 0.3);
}

/** The side of the map raid `n` comes from: the first at the gate (south-west), later ones from any side but the river's. */
export function raidSide(n: number): MapSide {
  if (n <= 1) return 'southWest';
  let h = Math.imul(n ^ 0x5bd1e995, 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return RAID_SIDES[(h >>> 0) % RAID_SIDES.length];
}

// Raid number from which each raider joins in.
const JOINS_AT: Record<EnemyUnit, number> = { goblin: 1, wolfRider: 2, orcArcher: 2, harpy: 4, ogre: 5, cyclops: 8, behemoth: 11 };

/** Who comes on raid `n` of this strength: a few stacks sharing it, stronger raiders as raids go on. */
export function raidParty(n: number, strength: number): RaidParty {
  let seed = Math.imul(n, 2654435761) | 0;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const allowed = (Object.keys(JOINS_AT) as EnemyUnit[]).filter((unit) => n >= JOINS_AT[unit]);
  const stacks = Math.min(7, 2 + Math.floor((n - 1) / 2));
  const share = strength / stacks;
  const party = new Map<EnemyUnit, number>();
  for (let i = 0; i < stacks; i++) {
    // Lean towards the strongest raiders that fit the stack's share.
    const fitting = allowed.filter((unit) => UNIT_STATS[unit].value <= share);
    const pool = fitting.length > 0 ? fitting : [allowed[0]];
    const unit = pool[Math.min(pool.length - 1, Math.floor(random() ** 0.6 * pool.length))];
    party.set(unit, (party.get(unit) ?? 0) + Math.max(1, Math.round(share / UNIT_STATS[unit].value)));
  }
  return [...party.entries()].map(([unit, count]) => ({ unit, count }));
}
