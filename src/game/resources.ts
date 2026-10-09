// Every resource the hold keeps. The mine produces the first twelve, each with its own stockpiles all the
// way from the miner's bin to the warehouse; wood comes from the woodcutters, wool from the sheep (both to
// the warehouse), and food — fish, apples, mutton — from the farms to the granary.
// Skia-free so screens and the simulation can both use it. The first six are the old ores (buildings use
// them); the six after them each raise one unit (tin swordsmen, silver monks, sulfur balloons, salt
// cavalry, emeralds griffins, mithril paladins), and angels need them all. Wood goes into gear, buildings
// (from level 2) and the pit props of every tunnel.

export const RESOURCES = ['coal', 'granite', 'copper', 'iron', 'gold', 'diamond', 'tin', 'silver', 'sulfur', 'salt', 'emerald', 'mithril', 'wood', 'fish', 'apples', 'mutton', 'wool'] as const;
export type Resource = (typeof RESOURCES)[number];

/** What the mine produces: its bins, deposits and carts. The rest come from the land above it. */
export const MINE_RESOURCES: readonly Resource[] = ['coal', 'granite', 'copper', 'iron', 'gold', 'diamond', 'tin', 'silver', 'sulfur', 'salt', 'emerald', 'mithril'];

/** Food, kept in the granary (farms.ts): fish, apples and mutton. */
export const FOOD_RESOURCES: readonly Resource[] = ['fish', 'apples', 'mutton'];
export const isFood = (resource: Resource) => FOOD_RESOURCES.includes(resource);

/** Wood in the warehouse at the start of a game (older saves get it too): enough for the first tunnels. */
export const STARTING_WOOD = 30;

/** An amount of each resource. */
export type Stock = Record<Resource, number>;

export const emptyStock = (): Stock => Object.fromEntries(RESOURCES.map((resource) => [resource, 0])) as Stock;

export const stockTotal = (stock: Stock) => RESOURCES.reduce((sum, resource) => sum + stock[resource], 0);

/** Gold the river barge pays per unit (before the docks' and the techs' bonuses). */
export const RESOURCE_PRICE: Record<Resource, number> = {
  coal: 1, granite: 1, copper: 3, iron: 4, gold: 12, diamond: 30, tin: 3, silver: 8, sulfur: 5, salt: 4, emerald: 20, mithril: 40, wood: 1, fish: 2, apples: 1, mutton: 2, wool: 3,
};

export const RESOURCE_INFO: Record<Resource, { name: string; deposit: string; unit: string; color: string; light: string; dark: string; tint: string }> = {
  coal: { name: 'Coal', deposit: 'Coal seam', unit: 'COAL', color: '#1c1c1f', light: '#4b4b52', dark: '#0b0b0d', tint: '#000000' },
  granite: { name: 'Granite', deposit: 'Granite outcrop', unit: 'GRANITE', color: '#9a9da3', light: '#c9ccd1', dark: '#5f6268', tint: '#b9bcc2' },
  copper: { name: 'Copper', deposit: 'Copper ore', unit: 'COPPER', color: '#c46a2b', light: '#f0a060', dark: '#7d3d14', tint: '#e07a32' },
  iron: { name: 'Iron', deposit: 'Iron ore', unit: 'IRON', color: '#7a3427', light: '#c0c4c9', dark: '#4a1c14', tint: '#8f2f1f' },
  gold: { name: 'Gold', deposit: 'Gold vein', unit: 'GOLD', color: '#f2c230', light: '#fff4b0', dark: '#a87b0c', tint: '#ffd23f' },
  diamond: { name: 'Diamonds', deposit: 'Diamond pipe', unit: 'DIAMONDS', color: '#9fefff', light: '#ffffff', dark: '#3aa7cf', tint: '#4d5d7a' },
  tin: { name: 'Tin', deposit: 'Tin lode', unit: 'TIN', color: '#5f6f7a', light: '#b9c6cf', dark: '#33404a', tint: '#6f8291' },
  silver: { name: 'Silver', deposit: 'Silver vein', unit: 'SILVER', color: '#d4d9e2', light: '#ffffff', dark: '#7d8594', tint: '#e6ebf2' },
  sulfur: { name: 'Sulfur', deposit: 'Sulfur crust', unit: 'SULFUR', color: '#d8d23a', light: '#fbf59a', dark: '#857f12', tint: '#c9c230' },
  salt: { name: 'Salt', deposit: 'Salt bed', unit: 'SALT', color: '#ead2d2', light: '#fff7f7', dark: '#a8888a', tint: '#e6c4c6' },
  emerald: { name: 'Emeralds', deposit: 'Emerald pocket', unit: 'EMERALDS', color: '#2fb36e', light: '#a2f2c6', dark: '#156b3e', tint: '#26985a' },
  mithril: { name: 'Mithril', deposit: 'Mithril seam', unit: 'MITHRIL', color: '#8fb8ec', light: '#eaf4ff', dark: '#3c66a0', tint: '#6d9edf' },
  wood: { name: 'Wood', deposit: 'Woods', unit: 'WOOD', color: '#8a5a2e', light: '#c08a52', dark: '#553519', tint: '#a26a36' },
  fish: { name: 'Fish', deposit: 'Fishing water', unit: 'FISH', color: '#7f9cab', light: '#c9dce5', dark: '#4d6674', tint: '#8fb3c4' },
  apples: { name: 'Apples', deposit: 'Orchard', unit: 'APPLES', color: '#c0392b', light: '#f07a6a', dark: '#7d2016', tint: '#d9483a' },
  mutton: { name: 'Mutton', deposit: 'Pasture', unit: 'MUTTON', color: '#b5645a', light: '#e3a198', dark: '#743a33', tint: '#c97a70' },
  wool: { name: 'Wool', deposit: 'Pasture', unit: 'WOOL', color: '#ece6d6', light: '#ffffff', dark: '#b8b0a0', tint: '#f3eee2' },
};
