// Food: fishing huts on the river banks outside the walls, sheep grazing on the land outside them, and
// apple orchards in town feed the peasants; the granary stores it. Up to eight of each kind of farm, each
// placed and levelled on its own and unlocked as the keep grows; one granary. Every peasant eats; with no
// food left the hold goes hungry: no newcomers, and the peasants work slower (food itself is still made at
// full speed, so a hungry hold can always feed itself again). Kept free of imports so the map
// (cityMap.ts) can use the ids while the modules are still loading.

export const FISHERY_IDS = ['fishery1', 'fishery2', 'fishery3', 'fishery4', 'fishery5', 'fishery6', 'fishery7', 'fishery8'] as const;
export const PASTURE_IDS = ['pasture1', 'pasture2', 'pasture3', 'pasture4', 'pasture5', 'pasture6', 'pasture7', 'pasture8'] as const;
export const ORCHARD_IDS = ['orchard1', 'orchard2', 'orchard3', 'orchard4', 'orchard5', 'orchard6', 'orchard7', 'orchard8'] as const;
export type FisheryId = (typeof FISHERY_IDS)[number];
export type PastureId = (typeof PASTURE_IDS)[number];
export type OrchardId = (typeof ORCHARD_IDS)[number];
export type FarmId = FisheryId | PastureId | OrchardId;

export const isFishery = (id: string): id is FisheryId => (FISHERY_IDS as readonly string[]).includes(id);
export const isPasture = (id: string): id is PastureId => (PASTURE_IDS as readonly string[]).includes(id);
export const isOrchard = (id: string): id is OrchardId => (ORCHARD_IDS as readonly string[]).includes(id);
export const isFarm = (id: string): id is FarmId => isFishery(id) || isPasture(id) || isOrchard(id);

/** Every kind of farm, in the order they're offered. */
export const FARM_SERIES: readonly (readonly FarmId[])[] = [ORCHARD_IDS, FISHERY_IDS, PASTURE_IDS];

/** Keep level the n-th farm of a kind needs (the first from the start). */
const SERIES_KEEP = [1, 1, 2, 3, 4, 5, 6, 7];
export const farmKeep = (id: FarmId) => SERIES_KEEP[Number(id.replace(/\D/g, '')) - 1];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
export function farmName(id: FarmId) {
  const n = ROMAN[Number(id.replace(/\D/g, '')) - 1];
  if (isFishery(id)) return `Fishing Hut ${n}`;
  if (isPasture(id)) return `Sheep Pasture ${n}`;
  return `Apple Orchard ${n}`;
}

/** What the peasants eat. */
export const FOODS = ['fish', 'apples', 'mutton'] as const;
export type Food = (typeof FOODS)[number];

/** Food a peasant eats each second (one every two minutes). */
export const FOOD_PER_PEASANT = 1 / 120;
/** How fast hungry peasants work. */
export const HUNGRY_WORK = 0.7;
/** Apples in store at the start of a game (older saves get them too). */
export const STARTING_APPLES = 150;

/** Fish a fishing hut lands each second, per worked level. */
export const FISH_PER_LEVEL = 0.12;
/** Apples an orchard picks each second, per worked level. */
export const APPLES_PER_LEVEL = 0.1;
/** Sheep a pasture grazes, per level; new lambs a second while below that, per worked level. */
export const SHEEP_PER_LEVEL = 10;
export const LAMBS_PER_LEVEL = 0.02;
/** Mutton and wool each sheep gives a second. */
export const MUTTON_PER_SHEEP = 0.01;
export const WOOL_PER_SHEEP = 0.006;
/** Share of a pasture's flock raiders from its side drive off: each raid, and more if they win. */
export const RAID_SHEEP_TAKEN = 0.1;
export const LOST_RAID_SHEEP_TAKEN = 0.3;
