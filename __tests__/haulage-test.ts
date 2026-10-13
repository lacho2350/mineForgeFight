import { selectMineLayout } from '../src/game/hold';
import { depositAt, getDepositInfo, tileKey, type Site } from '../src/game/mineLayout';
import { emptyStock, type Resource } from '../src/game/resources';
import { game, newGame, run, warehouseWith } from './support';

// A miner's place at a reachable deposit of `resource` near the entrance, in a new game.
function minerAt(resource: Resource): Site {
  const layout = selectMineLayout(game());
  for (let row = 2; row < 14; row++) {
    for (let column = 100; column < 200; column++) {
      if (depositAt(row, column) !== resource) continue;
      const info = getDepositInfo(layout, tileKey(row, column));
      if (info.status === 'available' && info.standing) return info.standing;
    }
  }
  throw new Error(`no ${resource} deposit within reach`);
}

describe('the carts', () => {
  it('keep hauling the other ores when one is backed up all the way from a full warehouse', () => {
    newGame();
    const granite = minerAt('granite');
    const { veinCapacity, mineExitCapacity, mineCapacity, warehouseCapacity } = game();
    // Coal fills the warehouse, the mine stockpile and nearly the exit; a granite miner's bin is full.
    newGame({
      sites: [...game().sites, granite],
      layoutVersion: game().layoutVersion + 1,
      warehouse: warehouseWith({ coal: warehouseCapacity, apples: 100 }),
      mineStock: { ...emptyStock(), coal: mineCapacity },
      mineExit: { ...emptyStock(), coal: mineExitCapacity - 5 },
      vein: { ...emptyStock(), coal: veinCapacity, granite: veinCapacity },
    });
    for (let second = 0; second < 90; second++) {
      run(1);
      // The full coal bin at the exit never overflows…
      expect(game().mineExit.coal).toBeLessThanOrEqual(mineExitCapacity);
    }
    // …and the granite still gets up to the warehouse.
    expect(game().warehouse.granite).toBeGreaterThan(0);
    expect(game().warehouse.coal).toBe(warehouseCapacity);
  });
});
