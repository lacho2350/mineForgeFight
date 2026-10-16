// The buildings that keep the peasants happy (happiness.ts): churches (piety), fairgrounds (fun) and
// gardens (the town's looks). Up to four of each, placed and levelled on their own and unlocked as the
// keep grows, like the farms. Each level of one looks after PEASANTS_PER_LEVEL peasants: a bigger hold
// needs higher levels, or a second one. Kept free of imports so the map (cityMap.ts) can use the ids
// while the modules are still loading.

export const CHURCH_IDS = ['church1', 'church2', 'church3', 'church4'] as const;
export const FAIRGROUND_IDS = ['fairground1', 'fairground2', 'fairground3', 'fairground4'] as const;
export const GARDENS_IDS = ['gardens1', 'gardens2', 'gardens3', 'gardens4'] as const;
export type ChurchId = (typeof CHURCH_IDS)[number];
export type FairgroundId = (typeof FAIRGROUND_IDS)[number];
export type GardensId = (typeof GARDENS_IDS)[number];
export type MoodBuildingId = ChurchId | FairgroundId | GardensId;

export const isChurch = (id: string): id is ChurchId => (CHURCH_IDS as readonly string[]).includes(id);
export const isFairground = (id: string): id is FairgroundId => (FAIRGROUND_IDS as readonly string[]).includes(id);
export const isGardens = (id: string): id is GardensId => (GARDENS_IDS as readonly string[]).includes(id);
export const isMoodBuilding = (id: string): id is MoodBuildingId => isChurch(id) || isFairground(id) || isGardens(id);

/** What each kind of building gives the peasants. */
export type MoodKind = 'piety' | 'fun' | 'beauty';
export const MOOD_KINDS: readonly MoodKind[] = ['fun', 'piety', 'beauty'];
export const moodKindOf = (id: MoodBuildingId): MoodKind => (isChurch(id) ? 'piety' : isFairground(id) ? 'fun' : 'beauty');
/** The buildings of each kind. */
export const MOOD_BUILDINGS: Record<MoodKind, readonly MoodBuildingId[]> = { fun: FAIRGROUND_IDS, piety: CHURCH_IDS, beauty: GARDENS_IDS };

/** Every kind, in the order they're offered. */
export const MOOD_SERIES: readonly (readonly MoodBuildingId[])[] = [FAIRGROUND_IDS, CHURCH_IDS, GARDENS_IDS];

/** Keep level the n-th building of a kind needs (the first from the start). */
const SERIES_KEEP = [1, 4, 8, 12];
export const moodKeep = (id: MoodBuildingId) => SERIES_KEEP[Number(id.replace(/\D/g, '')) - 1];

const ROMAN = ['I', 'II', 'III', 'IV'];
export function moodName(id: MoodBuildingId) {
  const n = ROMAN[Number(id.replace(/\D/g, '')) - 1];
  if (isChurch(id)) return `Church ${n}`;
  if (isFairground(id)) return `Fairground ${n}`;
  return `Gardens ${n}`;
}

/** Peasants one level of a church, fairground or gardens looks after; beyond that its effect is shared out thinner. */
export const PEASANTS_PER_LEVEL = 50;
