// Everything the mine can produce. Each resource keeps its own stockpiles all the way from the
// miner's bin to the warehouse. Skia-free so screens and the simulation can both use it.

export const RESOURCES = ['coal', 'granite', 'copper', 'iron', 'gold', 'diamond'] as const;
export type Resource = (typeof RESOURCES)[number];

/** An amount of each resource. */
export type Stock = Record<Resource, number>;

export const emptyStock = (): Stock => ({ coal: 0, granite: 0, copper: 0, iron: 0, gold: 0, diamond: 0 });

export const stockTotal = (stock: Stock) => RESOURCES.reduce((sum, resource) => sum + stock[resource], 0);

/** Gold paid per unit at the trading post market. */
export const RESOURCE_PRICE: Record<Resource, number> = { coal: 1, granite: 1, copper: 3, iron: 4, gold: 12, diamond: 30 };

export const RESOURCE_INFO: Record<Resource, { name: string; deposit: string; unit: string; color: string; light: string; dark: string; tint: string }> = {
  coal: { name: 'Coal', deposit: 'Coal seam', unit: 'COAL', color: '#1c1c1f', light: '#4b4b52', dark: '#0b0b0d', tint: '#000000' },
  granite: { name: 'Granite', deposit: 'Granite outcrop', unit: 'GRANITE', color: '#9a9da3', light: '#c9ccd1', dark: '#5f6268', tint: '#b9bcc2' },
  copper: { name: 'Copper', deposit: 'Copper ore', unit: 'COPPER', color: '#c46a2b', light: '#f0a060', dark: '#7d3d14', tint: '#e07a32' },
  iron: { name: 'Iron', deposit: 'Iron ore', unit: 'IRON', color: '#7a3427', light: '#c0c4c9', dark: '#4a1c14', tint: '#8f2f1f' },
  gold: { name: 'Gold', deposit: 'Gold vein', unit: 'GOLD', color: '#f2c230', light: '#fff4b0', dark: '#a87b0c', tint: '#ffd23f' },
  diamond: { name: 'Diamonds', deposit: 'Diamond pipe', unit: 'DIAMONDS', color: '#9fefff', light: '#ffffff', dark: '#3aa7cf', tint: '#4d5d7a' },
};
