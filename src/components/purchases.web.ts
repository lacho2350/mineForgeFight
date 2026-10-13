// The web (and the PC build made from it) has no store: the shop lists what's for sale and says where to buy.
import type { ProductId } from '../game/shop';

export type ShopStatus = { ready: boolean; prices: Partial<Record<ProductId, string>>; message: string | null; busy: boolean };

const status: ShopStatus = { ready: false, prices: {}, message: 'Purchases are in the game installed from Google Play.', busy: false };
export const useShop = () => status;
export async function startStore() {}
export async function buy(id: ProductId) {
  void id;
}
export async function restorePurchases() {}
