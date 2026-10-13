// The web (and the PC build made from it) shows no ads: the Google Mobile Ads module is native only.
export async function startAds() {}
export function adBreak() {}
export const privacyChoices = (): (() => Promise<unknown>) | null => null;
