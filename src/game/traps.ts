// Traps in the trap belt (tiles 3–4 from the map's edge, on the three sides that aren't river). Each
// covers one tile and stays until it's taken up. Every raid comes from one side of the map, and the raiders on foot cross that side's
// stretch of the belt before the battle starts, springing every trap on it (fliers pass over).
// The research facility's engineers make traps deadlier. Pure TS.
import { onGateRoad, sidesOf, zoneAt, type MapSide, type Spot } from './cityMap';
import type { Resource } from './resources';

export const TRAP_KINDS = ['spikes', 'pitch', 'snare'] as const;
export type TrapKind = (typeof TRAP_KINDS)[number];
export type Trap = Spot & { kind: TrapKind };
export type TrapCounts = Record<TrapKind, number>;

/** Damage per spike pit (to one company) and per pitch ditch (to every company), before research. */
export const TRAP_DAMAGE = { spikes: 15, pitch: 5 } as const;

export const TRAP_INFO: Record<TrapKind, { name: string; plural: string; effect: string; gold: number; resources: Partial<Record<Resource, number>> }> = {
  spikes: {
    name: 'Spike pit',
    plural: 'spike pits',
    effect: `Swallows whoever falls in: ${String(TRAP_DAMAGE.spikes)} damage to one raider company on foot.`,
    gold: 30,
    resources: { coal: 10 },
  },
  pitch: {
    name: 'Pitch ditch',
    plural: 'pitch ditches',
    effect: `Set alight as the raiders cross: ${String(TRAP_DAMAGE.pitch)} damage to every raider company on foot.`,
    gold: 45,
    resources: { coal: 20 },
  },
  snare: {
    name: 'Snare',
    plural: 'snares',
    effect: 'Catches a raider company on foot: it loses its first turn of the battle.',
    gold: 50,
    resources: { copper: 3 },
  },
};

/** Share of a trap's gold paid back when it's taken up. */
export const TRAP_REFUND = 0.5;

/** How many traps of each kind are in `traps`. */
export function trapCounts(traps: Trap[]): TrapCounts {
  const counts: TrapCounts = { spikes: 0, pitch: 0, snare: 0 };
  for (const trap of traps) counts[trap.kind] += 1;
  return counts;
}

/** The traps raiders coming from `side` cross (the corners face two sides). */
export const trapsFacing = (traps: Trap[], side: MapSide) => traps.filter((trap) => sidesOf(trap.x, trap.y).includes(side));

export const trapAt = (traps: Trap[], x: number, y: number) => traps.find((trap) => trap.x === x && trap.y === y) ?? null;

/** Why a trap can't go at `spot`, or null if it can. */
export function trapProblem(spot: Spot, traps: Trap[]): string | null {
  if (zoneAt(spot.x, spot.y) !== 'traps') return 'Traps go in the trap belt, between the moat and the raiders’ ground.';
  if (onGateRoad(spot.x, spot.y)) return 'The road to the gate stays clear.';
  if (trapAt(traps, spot.x, spot.y)) return 'There’s a trap there already.';
  return null;
}
