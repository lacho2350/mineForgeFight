// Workers' houses: where the hold's peasants sleep. Up to eight can be built, each placed and levelled on
// its own; together with the keep's hall they sleep at most MAX_PEASANTS. Kept free of imports so the
// map (cityMap.ts) can use the ids while the modules are still loading.

/** The first keeps the old `houses` id (saves and the houses' tech branch use it). */
export const HOUSE_IDS = ['houses', 'houses2', 'houses3', 'houses4', 'houses5', 'houses6', 'houses7', 'houses8'] as const;
export type HouseId = (typeof HOUSE_IDS)[number];

export const isHouse = (id: string): id is HouseId => (HOUSE_IDS as readonly string[]).includes(id);

/** Keep level each house needs before it can be built. */
export const HOUSE_KEEP: Record<HouseId, number> = { houses: 1, houses2: 1, houses3: 1, houses4: 2, houses5: 3, houses6: 4, houses7: 5, houses8: 6 };

/** The houses' names on the map and in the lists. */
export const HOUSE_NAMES: Record<HouseId, string> = {
  houses: 'Workers’ Houses',
  houses2: 'Workers’ Houses II',
  houses3: 'Workers’ Houses III',
  houses4: 'Workers’ Houses IV',
  houses5: 'Workers’ Houses V',
  houses6: 'Workers’ Houses VI',
  houses7: 'Workers’ Houses VII',
  houses8: 'Workers’ Houses VIII',
};

/** The most peasants the hold can sleep, however many houses it has. */
export const MAX_PEASANTS = 200;

/** Peasants one house sleeps at a level (before the houses' techs). */
export const houseBeds = (level: number) => (level > 0 ? 4 * level + Math.floor(level ** 2 / 2) : 0);
