// Happiness, Stronghold-style: one number for the whole hold, 0–100, that drifts a little every second
// by what the peasants have to be glad or sorry about — in points a minute, so a bad spell can be
// weathered and a good one builds up:
//   • food: what's in store — nothing (hungry) hurts, a second and third kind of food please;
//   • homes: peasants sleeping badly (a cottage run dry or cut off, the hall with the store empty);
//   • taxes: the rate the keep sets (taxes.ts);
//   • fun, piety and the town's looks: fairgrounds, churches and gardens, each level looking after
//     PEASANTS_PER_LEVEL peasants — a bigger hold spreads them thinner (or builds another);
//   • a siege at the walls, while it lasts;
// and jumps once at the end of a battle: won, or lost.
// The hold works at a pace of 50% at 0 up to 100% at 100 (`workPaceAt`), and at 0 the peasants start
// leaving, one every LEAVE_SECONDS, with nobody new coming until it rises again. Pure TS.
import { rulesOf, type Difficulty } from './difficulty';
import { workedLevel, type BuildingId, type BuildingLevels } from './buildings';
import { FOODS } from './farms';
import { drySleepers, type Homes } from './homes';
import { MOOD_BUILDINGS, MOOD_KINDS, PEASANTS_PER_LEVEL, type MoodKind } from './moodBuildings';
import type { Stock } from './resources';
import { TAX_INFO, type TaxRate } from './taxes';
import type { TechId } from './techs';
import type { Placements } from './cityMap';
import type { Roads } from './roads';
import type { Battle } from './combat';
import type { Raid } from './state';

export const MAX_HAPPINESS = 100;
/** Where a new hold starts. */
export const STARTING_HAPPINESS = 70;

/** How fast the hold works at a happiness: half speed at 0, full at 100. */
export const workPaceAt = (happiness: number) => Math.round((0.5 + (0.5 * Math.max(0, Math.min(MAX_HAPPINESS, happiness))) / MAX_HAPPINESS) * 1000) / 1000;

/** At 0 a peasant leaves every this many seconds, and nobody new comes. */
export const LEAVE_SECONDS = 30;
/** The keep's own household: this many never leave, however wretched the hold, and a hold that has fewer
 * (an older save, say) is joined by drifters from the valley, hungry or not, until it has them again — so
 * there are always hands to build a farm and start over (an empty hold could never recover). */
export const LEAVE_FLOOR = 4;

/** Points a minute: what the store's food does, by how many kinds are in. */
export const FOOD_MOOD = [-6, 0, 2, 4] as const;
/** Points a minute taken, times the share of peasants sleeping badly. */
export const DRY_MOOD = -4;
/** Points a minute while raiders besiege the walls. */
export const SIEGE_MOOD = -3;
/** Points, once, when a battle ends. */
export const BATTLE_MOOD = { won: 10, lost: -15 } as const;
/** Points a minute each kind of building gives, looking after the whole hold. */
export const BUILDING_MOOD: Record<MoodKind, number> = { fun: 3, piety: 3, beauty: 2 };
export const MOOD_KIND_INFO: Record<MoodKind, { label: string; buildings: string }> = {
  fun: { label: 'Fun', buildings: 'fairgrounds' },
  piety: { label: 'Piety', buildings: 'churches' },
  beauty: { label: 'A fair town', buildings: 'gardens' },
};

/** One thing the peasants are glad or sorry about: what it is, and what it does, in points a minute. */
export type MoodFactor = { id: 'food' | 'homes' | 'taxes' | 'siege' | MoodKind; label: string; detail: string; perMinute: number };

export type MoodState = {
  population: number;
  buildings: BuildingLevels;
  /** The staff each building has (workforceOf(state).staff): a church with nobody in it sways no one. */
  staff: Partial<Record<BuildingId, number>>;
  techs: readonly TechId[];
  warehouse: Stock;
  hungry: boolean;
  homes: Homes;
  placements?: Placements;
  roads?: Roads;
  taxRate: TaxRate;
  raid: Raid | null;
  battle: Battle | null;
  elapsedSeconds: number;
  /** The game's difficulty: every bad thing weighs its `moodPenalty` times Normal's. */
  difficulty?: Difficulty;
};

/** Levels of a kind's buildings that are at work, all together. */
export function moodLevels(kind: MoodKind, buildings: BuildingLevels, staff: Partial<Record<BuildingId, number>>) {
  return MOOD_BUILDINGS[kind].reduce((sum, id) => sum + workedLevel(id, buildings[id], staff[id] ?? 0), 0);
}

/** The share of the hold a kind's buildings look after (1: everyone), by their levels. */
export const moodCoverage = (levels: number, population: number) => (population <= 0 ? 1 : Math.min(1, (levels * PEASANTS_PER_LEVEL) / population));

/** Is the hold under siege: raiders at the walls (a battle there, or a siege army arrived and about to be met)? */
export function underSiege(state: Pick<MoodState, 'raid' | 'battle' | 'elapsedSeconds'>) {
  if (state.battle?.status === 'active') return state.battle.kind === 'siege';
  return !!state.raid && state.raid.kind === 'siege' && !state.raid.rideOut && state.elapsedSeconds >= state.raid.arrivesAt;
}

const hundredths = (value: number) => Math.round(value * 100) / 100;

/** Everything moving the hold's happiness now, each in points a minute. */
export function moodFactors(state: MoodState): MoodFactor[] {
  const factors: MoodFactor[] = [];
  const kinds = FOODS.filter((food) => state.warehouse[food] >= 1).length;
  const food = state.hungry ? FOOD_MOOD[0] : FOOD_MOOD[Math.min(FOOD_MOOD.length - 1, kinds)];
  factors.push({
    id: 'food',
    label: 'Food',
    detail: state.hungry ? 'Nothing left in store: the hold is hungry.' : kinds <= 1 ? `${String(kinds)} kind in store; a second and a third kind please the peasants.` : `${String(kinds)} kinds in store.`,
    perMinute: food,
  });
  const dry = drySleepers(state);
  const dryShare = state.population > 0 ? dry / state.population : 0;
  factors.push({
    id: 'homes',
    label: 'Homes',
    detail: dry > 0 ? `${String(dry)} sleeping badly: a cottage run dry or with no road, or the hall with the store empty.` : 'Everyone sleeps with water and food in, and a road at the door.',
    perMinute: hundredths(DRY_MOOD * dryShare),
  });
  const tax = TAX_INFO[state.taxRate];
  factors.push({ id: 'taxes', label: 'Taxes', detail: `${tax.name}: ${tax.note}`, perMinute: tax.mood });
  for (const kind of MOOD_KINDS) {
    const levels = moodLevels(kind, state.buildings, state.staff);
    const coverage = moodCoverage(levels, state.population);
    const info = MOOD_KIND_INFO[kind];
    factors.push({
      id: kind,
      label: info.label,
      detail:
        levels <= 0
          ? `No ${info.buildings} at work.`
          : coverage >= 1
            ? `The ${info.buildings} (${String(levels)} level${levels === 1 ? '' : 's'}) look after the whole hold.`
            : `The ${info.buildings} (${String(levels)} level${levels === 1 ? '' : 's'}) look after ${String(levels * PEASANTS_PER_LEVEL)} of ${String(state.population)} peasants: raise them, or build another.`,
      perMinute: hundredths(BUILDING_MOOD[kind] * coverage),
    });
  }
  if (underSiege(state)) factors.push({ id: 'siege', label: 'Siege', detail: 'Raiders at the walls.', perMinute: SIEGE_MOOD });
  const penalty = rulesOf(state.difficulty).moodPenalty;
  if (penalty === 1) return factors;
  return factors.map((factor) => (factor.perMinute < 0 ? { ...factor, perMinute: hundredths(factor.perMinute * penalty) } : factor));
}

/** How happiness moves now, in points a minute. */
export const moodDrift = (factors: readonly MoodFactor[]) => hundredths(factors.reduce((sum, factor) => sum + factor.perMinute, 0));

/** Happiness a second on from `happiness`, moving by `perMinute`. */
export const driftHappiness = (happiness: number, perMinute: number) => Math.round(Math.max(0, Math.min(MAX_HAPPINESS, happiness + perMinute / 60)) * 1000) / 1000;

/** Happiness after a battle: a win cheers the hold, a loss grieves it (times the difficulty's `penalty`);
 * raiders withdrawing changes nothing. */
export const afterBattle = (happiness: number, outcome: 'won' | 'lost' | 'withdrawn', penalty = 1) =>
  outcome === 'withdrawn' ? happiness : driftHappiness(happiness, BATTLE_MOOD[outcome] * (outcome === 'lost' ? penalty : 1) * 60);

/** What the peasants say of their hold. */
export function moodWord(happiness: number) {
  if (happiness >= 80) return 'Jubilant';
  if (happiness >= 60) return 'Content';
  if (happiness >= 40) return 'Grumbling';
  if (happiness >= 20) return 'Unhappy';
  if (happiness > 0) return 'Wretched';
  return 'Leaving';
}
