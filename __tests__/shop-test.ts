import { MINE_RESOURCES } from '../src/game/resources';
import { PRODUCTS, isConsumable } from '../src/game/shop';
import { mergeSave, migrateSave } from '../src/game/saveMigration';
import { useGameStore } from '../src/game/gameStore';
import { game, newGame } from './support';

describe('the shop', () => {
  it('sells No more ads (kept) and packs of 1,000 / 10,000 / 100,000 (bought again and again) at €2, €1, €5, €20', () => {
    expect([PRODUCTS.remove_ads.price, PRODUCTS.resources_1000.price, PRODUCTS.resources_10000.price, PRODUCTS.resources_100000.price]).toEqual(['€2', '€1', '€5', '€20']);
    expect(isConsumable('remove_ads')).toBe(false);
    expect(isConsumable('resources_10000')).toBe(true);
  });

  it('delivers a pack whole: gold and every ore, past the warehouse’s limit', () => {
    newGame({ gold: 50 });
    const before = { ...game().warehouse };
    expect(game().creditPurchase('resources_1000', 'token-a')).toBe(true);
    expect(game().gold).toBe(1050);
    for (const resource of MINE_RESOURCES) expect(game().warehouse[resource]).toBe(before[resource] + 1000);
    expect(game().warehouse.coal).toBeGreaterThan(game().warehouseCapacity);
    // Wood and food are not mined: untouched.
    expect(game().warehouse.wood).toBe(before.wood);
    expect(game().warehouse.apples).toBe(before.apples);
  });

  it('credits a purchase once, however often the store hands it over', () => {
    newGame({ gold: 0 });
    game().creditPurchase('resources_10000', 'token-b');
    expect(game().creditPurchase('resources_10000', 'token-b')).toBe(false);
    expect(game().gold).toBe(10000);
    // A second purchase of the same pack (a new token) pays again.
    game().creditPurchase('resources_10000', 'token-c');
    expect(game().gold).toBe(20000);
  });

  it('removes the ads for good, and older saves start with ads and nothing credited', () => {
    newGame();
    expect(game().adsRemoved).toBe(false);
    game().creditPurchase('remove_ads', 'token-d');
    expect(game().adsRemoved).toBe(true);
    const old = mergeSave(migrateSave({ elapsedSeconds: 900 }, 5), useGameStore.getInitialState());
    expect(old.adsRemoved).toBe(false);
    expect(old.creditedPurchases).toEqual([]);
    // …and a save keeps them.
    const kept = mergeSave(migrateSave({ elapsedSeconds: 900, adsRemoved: true, creditedPurchases: ['token-d'] }, 5), useGameStore.getInitialState());
    expect(kept.adsRemoved).toBe(true);
    expect(kept.creditedPurchases).toEqual(['token-d']);
  });
});
