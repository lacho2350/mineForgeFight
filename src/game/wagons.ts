// Carts: the Cart Depot's carts move goods round the hold. A forge works only from its own shelf, so a cart
// brings it materials from the warehouse (supply: depot → warehouse → forge → depot) and takes its finished
// pieces to the store (collect: depot → forge → warehouse → depot); and soldiers are raised with gear kept
// at their dwelling, so a cart takes gear from the store out to the dwellings (deliver: depot → warehouse
// → dwelling → depot). Each trip follows the roads (walkBetween, at cart speed), so roads and where the
// buildings stand all matter. Goods leave the warehouse (or the forge's rack) when the cart is sent and
// arrive when it gets there. Called "wagons" in the code, so they aren't mixed up with the mine's carts.
// Pure TS.
import type { BuildingId } from './buildings';
import { FORGE_BUFFER, addLoad, emptyLoad, loadUnits, recipeLoad, type ForgeId, type ForgeTask, type Load } from './forges';
import type { ItemId, ItemStock } from './items';
import type { Resource, Stock } from './resources';

/** Goods a cart carries before the depot's techs. */
export const BASE_WAGON_LOAD = 10;
/** How much faster than a walking peasant a cart goes, before the depot's techs. */
export const WAGON_SPEED = 1.5;

/** Gear a dwelling keeps on hand: enough for the recruits waiting, at least this many and at most that many. */
export const DWELLING_GEAR_MIN = 5;
export const DWELLING_GEAR_CAP = 20;
export const gearWanted = (waiting: number) => Math.min(DWELLING_GEAR_CAP, Math.max(DWELLING_GEAR_MIN, Math.floor(waiting)));

/** A cart out on a trip: what it's doing, for which building (a forge or a dwelling), its load and the three legs' seconds. */
export type WagonJob = {
  id: number;
  kind: 'supply' | 'collect' | 'deliver';
  site: BuildingId;
  /** The forge's task when the cart was sent (a supply for a forge that changed task comes back), or the gear delivered. */
  item: ItemId;
  load: Load;
  /** Game second it left the depot. */
  startedAt: number;
  legs: [number, number, number];
  /** Unloaded at the second stop yet. */
  dropped: boolean;
};

export const wagonDropAt = (job: WagonJob) => job.startedAt + job.legs[0] + job.legs[1];
export const wagonBackAt = (job: WagonJob) => job.startedAt + job.legs[0] + job.legs[1] + job.legs[2];

/** The four stops of a trip, by building. */
export const wagonStops = (job: Pick<WagonJob, 'kind' | 'site'>): [BuildingId, BuildingId, BuildingId, BuildingId] =>
  job.kind === 'collect' ? ['depot', job.site, 'warehouse', 'depot'] : ['depot', 'warehouse', job.site, 'depot'];

/** Materials on their way to a forge. */
export function incomingTo(jobs: readonly WagonJob[], forge: ForgeId): Load {
  return jobs.filter((job) => job.kind === 'supply' && job.site === forge && !job.dropped).reduce((sum, job) => addLoad(sum, job.load), emptyLoad());
}

/** Gear on its way to a dwelling. */
export function gearComing(jobs: readonly WagonJob[], dwelling: BuildingId) {
  return jobs.filter((job) => job.kind === 'deliver' && job.site === dwelling && !job.dropped).reduce((sum, job) => sum + loadUnits(job.load), 0);
}

/** Finished pieces on carts (to the store, or from it out to the dwellings), by item. */
export function itemsInTransit(jobs: readonly WagonJob[]): Partial<Record<ItemId, number>> {
  const carried: Partial<Record<ItemId, number>> = {};
  for (const job of jobs) {
    if (job.kind === 'supply' || job.dropped) continue;
    for (const [item, n] of Object.entries(job.load.items) as [ItemId, number][]) carried[item] = (carried[item] ?? 0) + n;
  }
  return carried;
}

/**
 * What a cart should bring a forge: enough to keep `FORGE_BUFFER` pieces' worth on its shelf (counting what's
 * already coming), as much as the warehouse has and the cart can carry. Null when nothing is needed, or when
 * not even one piece could be made from the shelf, what's coming and the warehouse together.
 */
export function supplyLoad(task: ForgeTask, incoming: Load, warehouse: Stock, items: ItemStock, capacity: number): Load | null {
  const per = recipeLoad(task.item);
  const have = addLoad(task.stock, incoming);
  const inStore = (resource: Resource) => Math.floor(warehouse[resource]);
  const itemsInStore = (item: ItemId) => Math.floor(items[item]);
  for (const [resource, n] of Object.entries(per.resources) as [Resource, number][]) if ((have.resources[resource] ?? 0) + inStore(resource) < n) return null;
  for (const [item, n] of Object.entries(per.items) as [ItemId, number][]) if ((have.items[item] ?? 0) + itemsInStore(item) < n) return null;
  for (let pieces = FORGE_BUFFER; pieces >= 1; pieces--) {
    const load = emptyLoad();
    for (const [resource, n] of Object.entries(per.resources) as [Resource, number][]) {
      const amount = Math.min(n * pieces - (have.resources[resource] ?? 0), inStore(resource));
      if (amount > 0) load.resources[resource] = amount;
    }
    for (const [item, n] of Object.entries(per.items) as [ItemId, number][]) {
      const amount = Math.min(n * pieces - (have.items[item] ?? 0), itemsInStore(item));
      if (amount > 0) load.items[item] = amount;
    }
    const units = loadUnits(load);
    if (units === 0) return null;
    if (units <= capacity) return load;
  }
  return null;
}
