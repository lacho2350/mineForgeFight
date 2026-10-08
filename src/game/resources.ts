// Everything the mine can produce. Each resource keeps its own stockpiles all the way from the
// miner's bin to the warehouse. Skia-free so screens and the simulation can both use it. The first six
// are the old ores (buildings use them); the six after them each raise one unit (tin swordsmen, silver
// monks, sulfur balloons, salt cavalry, emeralds griffins, mithril paladins), and angels need them all.

export const RESOURCES = ['coal', 'granite', 'copper', 'iron', 'gold', 'diamond', 'tin', 'silver', 'sulfur', 'salt', 'emerald', 'mithril'] as const;
export type Resource = (typeof RESOURCES)[number];

/** An amount of each resource. */
export type Stock = Record<Resource, number>;

export const emptyStock = (): Stock => Object.fromEntries(RESOURCES.map((resource) => [resource, 0])) as Stock;

export const stockTotal = (stock: Stock) => RESOURCES.reduce((sum, resource) => sum + stock[resource], 0);

/** Gold the river barge pays per unit (before the docks' and the techs' bonuses). */
export const RESOURCE_PRICE: Record<Resource, number> = {
  coal: 1, granite: 1, copper: 3, iron: 4, gold: 12, diamond: 30, tin: 3, silver: 8, sulfur: 5, salt: 4, emerald: 20, mithril: 40,
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
};
