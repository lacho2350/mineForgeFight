import { BUILDING_IDS } from '../src/game/buildings';
import { workforceOf } from '../src/game/hold';
import { tileKey } from '../src/game/mineLayout';
import { game, newGame, run } from './support';

const staffShort = () => {
  const workforce = workforceOf(game());
  return BUILDING_IDS.reduce((sum, id) => sum + workforce.needed[id], 0) - workforce.staffTotal;
};
const manualMiners = () => game().sites.filter((site) => !game().autoMiners.includes(tileKey(site.row, site.column)));

describe('idle peasants', () => {
  it('go mining once every building has its staff', () => {
    newGame({ population: 20 });
    const before = game().sites.length;
    run(20);
    expect(game().autoMiners.length).toBeGreaterThan(0);
    expect(game().sites.length).toBe(before + game().autoMiners.length);
    // At most one is left: the first miner on a new level needs a cart pusher too.
    expect(workforceOf(game()).idle).toBeLessThan(2);
    expect(staffShort()).toBe(0);
  });

  it('come back to the campfire when the buildings need hands, and leave the player’s miners alone', () => {
    newGame({ population: 20 });
    run(20);
    const mine = manualMiners();
    const sent = game().autoMiners.length;
    // Peasants leave (as recruits would): the buildings are short until miners come back.
    newGame({ ...game(), population: game().population - 4 });
    run(10);
    expect(staffShort()).toBe(0);
    expect(game().autoMiners.length).toBeLessThan(sent);
    expect(manualMiners()).toEqual(mine);
  });

  it('don’t go while a building is short of staff', () => {
    newGame({ population: 6 });
    run(10);
    expect(game().autoMiners).toEqual([]);
  });
});
