import { BUILDING_IDS } from '../src/game/buildings';
import { workforceOf } from '../src/game/hold';
import { nextFreeSite, tileKey } from '../src/game/mineLayout';
import { selectMineLayout } from '../src/game/hold';
import { vacancies } from '../src/game/workforce';
import { build, game, newGame, run } from './support';

const idle = () => workforceOf(game()).idle;

describe('free workers', () => {
  it('wait at the campfire: nobody goes mining or into a building by themselves', () => {
    newGame({ population: 20 });
    const miners = game().sites.length;
    run(20);
    expect(game().sites.length).toBe(miners);
    expect(idle()).toBeGreaterThan(0);
  });

  it('go down the mine on AUTO-ASSIGN: every free worker to a free face', () => {
    newGame({ population: 20 });
    const before = game().sites.length;
    const waiting = idle();
    game().autoAssignMine();
    expect(game().sites.length).toBeGreaterThan(before);
    expect(game().notice).toMatch(/went down the mine/);
    // Nobody left who could take a free face (the first miner on a new level brings a pusher).
    expect(idle() < 2 || !nextFreeSite(selectMineLayout(game()))).toBe(true);
    expect(idle()).toBeLessThan(waiting);
  });

  it('fill the buildings’ empty spots on AUTO-ASSIGN in the city, highest priority first', () => {
    newGame({ population: 20 });
    build({ armory: 1, research: 1 });
    // A new building stands empty until staffed.
    useNoStaff('armory');
    expect(workforceOf(game()).staff.armory).toBe(0);
    game().autoAssignCity();
    const workforce = workforceOf(game());
    expect(workforce.staff.armory).toBe(workforce.needed.armory);
    expect(game().notice).toMatch(/took up work/);
  });

  it('come back to the campfire when a miner is released, and stay there', () => {
    newGame({ population: 20 });
    const site = game().sites[0];
    const face = tileKey(site.faceRow, site.faceColumn);
    const waiting = idle();
    game().releaseMiner(face);
    expect(game().notice).toMatch(/waiting at the campfire/);
    run(10);
    expect(game().sites.some((other) => tileKey(other.faceRow, other.faceColumn) === face)).toBe(false);
    expect(idle()).toBe(waiting + 1);
  });

  it('move one at a time with + and − on a building', () => {
    newGame({ population: 20 });
    const id = BUILDING_IDS.find((building) => workforceOf(game()).staff[building] > 0);
    if (!id) throw new Error('no staffed building');
    const staff = workforceOf(game()).staff[id];
    const waiting = idle();
    game().assignStaff(id, -1);
    expect(workforceOf(game()).staff[id]).toBe(staff - 1);
    expect(idle()).toBe(waiting + 1);
    run(5);
    // It stays one short: nobody refills it by themselves.
    expect(workforceOf(game()).staff[id]).toBe(staff - 1);
    game().assignStaff(id, 1);
    expect(workforceOf(game()).staff[id]).toBe(staff);
  });

  it('are taken off the lowest building when an order needs hands and nobody waits — and it stays short', () => {
    newGame({ population: 10 });
    const short = () => vacancies(workforceOf(game()));
    const before = short();
    // Everyone at the campfire and one more leave (as recruits would): a building goes short…
    const spare = idle();
    newGame({ ...game(), population: game().population - spare - 1 }, { keepStaffing: true });
    run(1);
    expect(short()).toBe(before + 1);
    // …and stays short when someone comes back: they wait at the campfire.
    newGame({ ...game(), population: game().population + 1 }, { keepStaffing: true });
    run(3);
    expect(short()).toBe(before + 1);
    // (A newcomer may have arrived too: they wait as well.)
    expect(idle()).toBeGreaterThanOrEqual(1);
  });
});

function useNoStaff(id: 'armory') {
  // `build` staffs buildings like a player pressing 👷 would; empty this one again to see a new building as it stands.
  game().assignStaff(id, -1);
  while (workforceOf(game()).staff[id] > 0) game().assignStaff(id, -1);
}
