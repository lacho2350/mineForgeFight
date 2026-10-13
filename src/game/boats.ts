// The fishing huts' boats: from level 5 a hut fishes from a boat out on the river in front of it, and a
// better one every five levels — a rowboat, a sailing skiff, a fishing smack, a two-masted ketch. They're
// how the hut's bigger catch is made (the catch itself grows with the level, farms.ts). Pure TS.

export type BoatTier = 1 | 2 | 3 | 4;

/** Each boat: its name and the hut level it comes with. */
export const BOAT_INFO: Record<BoatTier, { name: string; level: number }> = {
  1: { name: 'Rowboat', level: 5 },
  2: { name: 'Sailing skiff', level: 10 },
  3: { name: 'Fishing smack', level: 15 },
  4: { name: 'Fishing ketch', level: 20 },
};

const TIERS: BoatTier[] = [4, 3, 2, 1];

/** The boat a fishing hut at this level fishes from, or null (below level 5: from the river wall). */
export const fishingBoat = (level: number): BoatTier | null => TIERS.find((tier) => level >= BOAT_INFO[tier].level) ?? null;

/** The next boat a hut at this level gets, or null at the best. */
export const nextBoat = (level: number): BoatTier | null => {
  const now = fishingBoat(level);
  return now === 4 ? null : now === null ? 1 : ((now + 1) as BoatTier);
};
