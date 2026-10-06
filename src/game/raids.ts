// Raiders: when they come and who comes. Each raid is stronger than the last. Pure TS.
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

/** Total fighting value of raid number `n` (1, 2, …). */
export function raidValue(n: number) {
  return Math.round(600 * 1.3 ** (n - 1));
}

/** Gold bounty for beating raid `n`. */
export function raidBounty(n: number) {
  return Math.round(raidValue(n) * 0.3);
}

// Raid number from which each raider joins in.
const JOINS_AT: Record<EnemyUnit, number> = { goblin: 1, wolfRider: 2, orcArcher: 2, harpy: 4, ogre: 5, cyclops: 8, behemoth: 11 };

/** Who comes on raid `n`: a few stacks sharing the raid's value, stronger raiders as raids go on. */
export function raidParty(n: number): RaidParty {
  let seed = Math.imul(n, 2654435761) | 0;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const allowed = (Object.keys(JOINS_AT) as EnemyUnit[]).filter((unit) => n >= JOINS_AT[unit]);
  const stacks = Math.min(7, 2 + Math.floor((n - 1) / 2));
  const share = raidValue(n) / stacks;
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
