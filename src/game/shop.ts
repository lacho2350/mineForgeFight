// The shop: what the game sells through the store (Google Play Billing on Android) and what each buys.
// - No more ads (€2, once): the ad shown at a pause every few minutes stops, for good.
// - Packs of resources (€1 / €5 / €20, as often as wanted): gold and every ore the mine yields.
// Prices are set in the store (Play Console); the ones here are only shown where the store can't be
// reached. A pack is delivered whole, even past the warehouse's limit (it fills nothing else up until
// the stock is used). Each purchase is credited once: its store token is kept in `creditedPurchases`, so
// a purchase the store hands over again (after a restart, say) pays nothing twice. Pure TS.
import { MINE_RESOURCES } from './resources';
import type { GameState } from './state';

export const PRODUCT_IDS = ['remove_ads', 'resources_1000', 'resources_10000', 'resources_100000'] as const;
export type ProductId = (typeof PRODUCT_IDS)[number];
export const isProductId = (id: string): id is ProductId => (PRODUCT_IDS as readonly string[]).includes(id);

/** Each product: its name and what it gives, the price it's sold at (euro, for when the store can't say), and
 * the resources a pack holds (none: no more ads). */
export const PRODUCTS: Record<ProductId, { name: string; detail: string; price: string; amount: number }> = {
  remove_ads: { name: 'No more ads', detail: 'stops the ad between moments of play, for good', price: '€2', amount: 0 },
  resources_1000: { name: '1,000 of everything', detail: '1,000 gold and 1,000 of every ore the mine yields', price: '€1', amount: 1000 },
  resources_10000: { name: '10,000 of everything', detail: '10,000 gold and 10,000 of every ore', price: '€5', amount: 10000 },
  resources_100000: { name: '100,000 of everything', detail: '100,000 gold and 100,000 of every ore', price: '€20', amount: 100000 },
};

/** Packs are bought again and again (consumed); No more ads is kept. */
export const isConsumable = (id: ProductId) => PRODUCTS[id].amount > 0;

/** The least time between two ads, in seconds (shown at the next pause after it). */
export const AD_INTERVAL_SECONDS = 180;

/** Store tokens of purchases already credited, newest last (enough to catch a repeat). */
const KEEP_CREDITED = 100;

type ShopState = Pick<GameState, 'gold' | 'warehouse' | 'adsRemoved' | 'creditedPurchases'>;

/**
 * What crediting a purchase changes (nothing if that token was credited before). `key`: the store's
 * purchase token (or transaction id) — the same purchase handed over again has the same one.
 */
export function creditPurchase(state: ShopState, id: ProductId, key: string): Partial<GameState> | null {
  if (state.creditedPurchases.includes(key)) return null;
  const creditedPurchases = [...state.creditedPurchases, key].slice(-KEEP_CREDITED);
  const { amount, name } = PRODUCTS[id];
  if (amount === 0) {
    return { adsRemoved: true, creditedPurchases, notice: 'No more ads: thank you for supporting Greyhollow!' };
  }
  const warehouse = { ...state.warehouse };
  for (const resource of MINE_RESOURCES) warehouse[resource] += amount;
  return {
    gold: state.gold + amount,
    warehouse,
    creditedPurchases,
    notice: `${name} arrived: ${amount.toLocaleString()} gold, and ${amount.toLocaleString()} of every ore in the warehouse. Thank you!`,
  };
}
