import { bargeOrder } from '../src/game/ship';
import { emptyStock } from '../src/game/resources';
import { game, newGame, run, warehouseWith } from './support';

describe('barges', () => {
  it('only order what the hold has mined or made', () => {
    const stock = { ...emptyStock(), coal: 50, fish: 20, silver: 30 };
    for (let serial = 0; serial < 50; serial++) {
      const order = bargeOrder(serial, stock, 200, 0, [], ['coal', 'fish']);
      expect(['coal', 'fish']).toContain(order?.resource);
    }
  });

  it('don’t come for anything the warehouse is out of', () => {
    expect(bargeOrder(1, { ...emptyStock(), coal: 0.5 }, 200, 0, [], ['coal', 'fish'])).toBeNull();
    for (let serial = 0; serial < 30; serial++) expect(bargeOrder(serial, { ...emptyStock(), fish: 5 }, 200, 0, [], ['coal', 'fish'])?.resource).toBe('fish');
  });

  it('learn of a resource once it reaches a stockpile', () => {
    newGame({ warehouse: warehouseWith({ apples: 100, silver: 3 }) });
    expect(game().discovered).not.toContain('silver');
    run(1);
    expect(game().discovered).toContain('silver');
    expect(game().discovered).not.toContain('mithril');
  });
});
