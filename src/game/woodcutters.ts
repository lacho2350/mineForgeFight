// Woodcutters' huts: up to five, each placed and levelled on its own and unlocked as the keep grows; all
// their woodcutters fell the same forest (forest.ts). The first keeps the old `woodcutter` id (saves and the
// huts' tech branch use it). Kept free of imports so the map (cityMap.ts) can use the ids while the modules
// are still loading.

export const WOODCUTTER_IDS = ['woodcutter', 'woodcutter2', 'woodcutter3', 'woodcutter4', 'woodcutter5'] as const;
export type WoodcutterId = (typeof WOODCUTTER_IDS)[number];

export const isWoodcutter = (id: string): id is WoodcutterId => (WOODCUTTER_IDS as readonly string[]).includes(id);

/** Keep level each hut needs before it can be built. */
export const WOODCUTTER_KEEP: Record<WoodcutterId, number> = { woodcutter: 1, woodcutter2: 1, woodcutter3: 2, woodcutter4: 3, woodcutter5: 4 };

const ROMAN = ['', ' II', ' III', ' IV', ' V'];
export const woodcutterName = (id: WoodcutterId) => `Woodcutter’s Hut${ROMAN[WOODCUTTER_IDS.indexOf(id)]}`;
