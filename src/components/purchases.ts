// The store (Google Play Billing on Android, through expo-iap): prices, buying, and crediting what was
// bought. A purchase is credited only once the store says it's paid, once per store token
// (`creditPurchase`), then finished with the store — packs consumed so they can be bought again, No more
// ads kept. At start-up, purchases paid but not yet credited (a crash mid-purchase, a reinstall) are
// collected. Expo Go and the web can't buy (`purchases.web.ts`).
import { useSyncExternalStore } from 'react';
import { requireOptionalNativeModule } from 'expo';
import { useGameStore } from '../game/gameStore';
import { PRODUCT_IDS, isConsumable, isProductId, type ProductId } from '../game/shop';

type IapModule = typeof import('expo-iap');
type Purchase = import('expo-iap').Purchase;

/** What the shop can do now: whether the store is reachable, its prices, what to tell the player, and a purchase under way. */
export type ShopStatus = { ready: boolean; prices: Partial<Record<ProductId, string>>; message: string | null; busy: boolean };

let status: ShopStatus = { ready: false, prices: {}, message: null, busy: false };
const listeners = new Set<() => void>();
function update(change: Partial<ShopStatus>) {
  status = { ...status, ...change };
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
/** The shop's status, for the shop panel. */
export const useShop = () => useSyncExternalStore(subscribe, () => status, () => status);

let iap: IapModule | null | undefined;
function iapModule(): IapModule | null {
  if (iap !== undefined) return iap;
  // Only where the native module is in the app: Expo Go doesn't have it, and the shop says it can't buy there.
  if (!requireOptionalNativeModule('ExpoIap')) return (iap = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    iap = require('expo-iap') as IapModule;
  } catch {
    iap = null;
  }
  return iap;
}

// Credit a purchase the store reports, then finish it with the store.
async function deliver(purchase: Purchase) {
  const sdk = iapModule();
  const id = purchase.productId;
  if (!sdk || !isProductId(id)) return;
  if (purchase.purchaseState === 'pending') {
    update({ busy: false, message: 'Payment pending: the goods arrive as soon as it clears.' });
    return;
  }
  if (purchase.purchaseState !== 'purchased') return;
  useGameStore.getState().creditPurchase(id, purchase.purchaseToken ?? purchase.transactionId ?? purchase.id);
  try {
    await sdk.finishTransaction({ purchase, isConsumable: isConsumable(id) });
  } catch {
    // Finished at the next start-up instead (it's credited already, so it won't pay twice).
  }
  update({ busy: false, message: null });
}

let started = false;
/** Connect to the store, get the prices and collect anything paid but not credited (once). */
export async function startStore() {
  if (started) return;
  started = true;
  const sdk = iapModule();
  if (!sdk) {
    update({ message: 'Purchases work in the game installed from Google Play (not in Expo Go).' });
    return;
  }
  try {
    await sdk.initConnection();
    sdk.purchaseUpdatedListener((purchase) => void deliver(purchase));
    sdk.purchaseErrorListener((error) => {
      update({ busy: false, message: sdk.isUserCancelledError(error) ? null : `The purchase didn't go through: ${error.message}` });
    });
    const products = (await sdk.fetchProducts({ skus: [...PRODUCT_IDS], type: 'in-app' })) ?? [];
    const prices: Partial<Record<ProductId, string>> = {};
    for (const product of products as { id: string; displayPrice: string }[]) if (isProductId(product.id)) prices[product.id] = product.displayPrice;
    update({ ready: true, prices });
    for (const purchase of await sdk.getAvailablePurchases()) await deliver(purchase);
  } catch {
    update({ message: 'The store can’t be reached right now. Try again later.' });
  }
}

/** Start buying a product; the store's own screen takes over, and the result comes back to `deliver`. */
export async function buy(id: ProductId) {
  const sdk = iapModule();
  if (!sdk || !status.ready || status.busy) return;
  update({ busy: true, message: null });
  try {
    await sdk.requestPurchase({ request: { apple: { sku: id }, google: { skus: [id] } }, type: 'in-app' });
  } catch (error) {
    update({ busy: false, message: sdk.isUserCancelledError(error) ? null : 'The store couldn’t start the purchase.' });
  }
}

/** Collect purchases the store still holds (No more ads bought before, or anything not yet credited). */
export async function restorePurchases() {
  const sdk = iapModule();
  if (!sdk || !status.ready) return;
  try {
    for (const purchase of await sdk.getAvailablePurchases()) await deliver(purchase);
    update({ message: useGameStore.getState().adsRemoved ? 'Restored: No more ads.' : 'Nothing to restore.' });
  } catch {
    update({ message: 'The store can’t be reached right now. Try again later.' });
  }
}
