// Workers' cottages: where the hold's peasants sleep. Up to 24 small one-tile cottages can be built, each
// placed and levelled on its own; together with the keep's hall they sleep at most MAX_PEASANTS. Every
// cottage is kept by a woman of its own (not one of the workers): she fetches water from the river and
// food from the store, and the peasants who sleep there live on what she brings (homes.ts). Kept free
// of imports so the map (cityMap.ts) can use the ids while the modules are still loading.

/** The first keeps the old `houses` id (saves and the houses' tech branch use it). */
export const HOUSE_IDS = [
  'houses',
  'houses2',
  'houses3',
  'houses4',
  'houses5',
  'houses6',
  'houses7',
  'houses8',
  'houses9',
  'houses10',
  'houses11',
  'houses12',
  'houses13',
  'houses14',
  'houses15',
  'houses16',
  'houses17',
  'houses18',
  'houses19',
  'houses20',
  'houses21',
  'houses22',
  'houses23',
  'houses24',
] as const;
export type HouseId = (typeof HOUSE_IDS)[number];

export const isHouse = (id: string): id is HouseId => (HOUSE_IDS as readonly string[]).includes(id);

// Six cottages from the start, then four more with each keep level up to the sixth.
const keepFor = (index: number) => (index < 6 ? 1 : Math.min(6, 2 + Math.floor((index - 6) / 4)));

/** Keep level each cottage needs before it can be built. */
export const HOUSE_KEEP = Object.fromEntries(HOUSE_IDS.map((id, index) => [id, keepFor(index)])) as Record<HouseId, number>;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV'];

/** The cottages' names on the map and in the lists. */
export const HOUSE_NAMES = Object.fromEntries(HOUSE_IDS.map((id, index) => [id, `Cottage ${ROMAN[index]}`])) as Record<HouseId, string>;

/** The most peasants the hold can sleep, however many houses it has. */
export const MAX_PEASANTS = 200;

/** Peasants one cottage sleeps at a level (before the houses' techs): 4 at first, 9 at the top level (20). */
export const houseBeds = (level: number) => (level > 0 ? 4 + Math.floor(((Math.min(level, 20) - 1) * 5) / 19) : 0);

/** Peasants one of the old (2×2) workers' houses slept at a level: saves from before the cottages. */
export const oldHouseBeds = (level: number) => (level > 0 ? 4 * level + Math.floor(level ** 2 / 2) : 0);
