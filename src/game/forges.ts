// Forges: where the army's gear is made, one step to a forge. The hold can build up to eight; each is set
// to one task — a part (steel bars, bronze, …) or a piece of gear (pikes, swords, …) — and its smiths keep
// making it from what's on the forge's own shelf, putting each finished piece on its rack, until the store
// holds the forge's target. Carts from the depot (wagons.ts) bring the shelf its materials from the
// warehouse and take the finished pieces back. A sword needs a forge on steel bars, one on bronze and one
// on swords (or one forge set to each in turn). Pure TS.
import { ITEM_INFO, type ItemId, type ItemStock, type Recipe } from './items';
import type { Resource, Stock } from './resources';

export const FORGE_IDS = ['forge1', 'forge2', 'forge3', 'forge4', 'forge5', 'forge6', 'forge7', 'forge8'] as const;
export type ForgeId = (typeof FORGE_IDS)[number];

export const isForge = (id: string): id is ForgeId => (FORGE_IDS as readonly string[]).includes(id);

/** Keep level each forge needs before it can be built. */
export const FORGE_KEEP: Record<ForgeId, number> = { forge1: 1, forge2: 1, forge3: 2, forge4: 3, forge5: 5, forge6: 7, forge7: 9, forge8: 12 };

/** The forges' names on the map and in the lists. */
export const FORGE_NAMES: Record<ForgeId, string> = {
  forge1: 'Forge I',
  forge2: 'Forge II',
  forge3: 'Forge III',
  forge4: 'Forge IV',
  forge5: 'Forge V',
  forge6: 'Forge VI',
  forge7: 'Forge VII',
  forge8: 'Forge VIII',
};

/** Goods on the move or on a shelf: raw resources and items. */
export type Load = { resources: Partial<Record<Resource, number>>; items: Partial<Record<ItemId, number>> };
export const emptyLoad = (): Load => ({ resources: {}, items: {} });
export const loadUnits = (load: Load) =>
  [...Object.values(load.resources), ...Object.values(load.items)].reduce<number>((sum, n) => sum + (n ?? 0), 0);
/** `a` plus `sign` × `b` (a new load; amounts that reach 0 are dropped). */
export function addLoad(a: Load, b: Load, sign = 1): Load {
  const next: Load = { resources: { ...a.resources }, items: { ...a.items } };
  for (const [resource, n] of Object.entries(b.resources) as [Resource, number][]) {
    const total = (next.resources[resource] ?? 0) + sign * n;
    if (total > 0) next.resources[resource] = total;
    else delete next.resources[resource];
  }
  for (const [item, n] of Object.entries(b.items) as [ItemId, number][]) {
    const total = (next.items[item] ?? 0) + sign * n;
    if (total > 0) next.items[item] = total;
    else delete next.items[item];
  }
  return next;
}

/** Finished pieces a forge's rack holds; full, it stops until a cart takes them. */
export const FORGE_OUTPUT_CAP = 5;
/** Pieces' worth of materials the carts try to keep on a forge's shelf. */
export const FORGE_BUFFER = 3;

/**
 * A forge's task: what it makes and how many to keep in store; its shelf (`stock`, brought by carts) and
 * its rack of finished pieces (`output`, waiting for a cart); `loaded` once it has taken the inputs for the
 * piece on the anvil, `done` seconds of work on it so far.
 */
export type ForgeTask = { item: ItemId; target: number; done: number; loaded: boolean; stock: Load; output: number };
export type ForgeTasks = Partial<Record<ForgeId, ForgeTask>>;

/** The stock targets a forge can be set to. */
export const FORGE_TARGETS = [5, 10, 25, 50] as const;
export const DEFAULT_FORGE_TARGET = 10;

/** Seconds of work a forge does each second at a (worked) level, with the forge techs' bonus. */
export function forgeSpeedAt(level: number, bonus = 0) {
  return level > 0 ? Math.round((1 + 0.15 * (level - 1)) * (1 + bonus) * 100) / 100 : 0;
}

/** What a recipe is short of in the warehouse and the parts store (empty when it can start). */
export function missingInputs(recipe: Recipe, warehouse: Stock, items: ItemStock) {
  const missing: { resources: Partial<Record<Resource, number>>; items: Partial<Record<ItemId, number>> } = { resources: {}, items: {} };
  for (const [resource, n] of Object.entries(recipe.resources) as [Resource, number][]) {
    if (Math.floor(warehouse[resource]) < n) missing.resources[resource] = n - Math.floor(warehouse[resource]);
  }
  for (const [item, n] of Object.entries(recipe.items) as [ItemId, number][]) {
    if (Math.floor(items[item]) < n) missing.items[item] = n - Math.floor(items[item]);
  }
  return missing;
}

export const nothingMissing = (missing: ReturnType<typeof missingInputs>) => Object.keys(missing.resources).length === 0 && Object.keys(missing.items).length === 0;

/** One piece's inputs as a load. */
export const recipeLoad = (item: ItemId): Load => ({ resources: { ...ITEM_INFO[item].recipe.resources }, items: { ...ITEM_INFO[item].recipe.items } });

/** What a forge's shelf is short of for its next piece (empty: it can start). */
export function shelfMissing(task: ForgeTask) {
  const recipe = ITEM_INFO[task.item].recipe;
  const missing: Load = emptyLoad();
  for (const [resource, n] of Object.entries(recipe.resources) as [Resource, number][]) {
    const have = task.stock.resources[resource] ?? 0;
    if (have < n) missing.resources[resource] = n - have;
  }
  for (const [item, n] of Object.entries(recipe.items) as [ItemId, number][]) {
    const have = task.stock.items[item] ?? 0;
    if (have < n) missing.items[item] = n - have;
  }
  return missing;
}

/** Take (or with `sign` −1… give back) one piece's inputs: mutates the warehouse and item stock passed in. */
export function takeInputs(item: ItemId, warehouse: Stock, items: ItemStock, sign = 1) {
  const { recipe } = ITEM_INFO[item];
  for (const [resource, n] of Object.entries(recipe.resources) as [Resource, number][]) warehouse[resource] = Math.round((warehouse[resource] - sign * n) * 100) / 100;
  for (const [part, n] of Object.entries(recipe.items) as [ItemId, number][]) items[part] -= sign * n;
}
