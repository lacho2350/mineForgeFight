// The mine's surface buildings: where a tap lands, and what each one's card says it's doing.
import { MINE_COTTAGE_X, MINE_GROUND_Y, MINE_HEADHOUSE_X, MINE_STOREHOUSE_X, getExitBinX, surfaceBuildingAt } from '../src/components/MineMapLayout';
import { MINE_BUILDINGS, buildingNow } from '../src/components/mineBuildingStatus';
import { MINE_RESOURCES } from '../src/game/resources';
import { game, newGame } from './support';

describe('the mine’s surface buildings', () => {
  it('are found where they stand, and not on the exit warehouses, the sky or underground', () => {
    expect(surfaceBuildingAt(MINE_HEADHOUSE_X + 30, MINE_GROUND_Y - 20)).toBe('headhouse');
    expect(surfaceBuildingAt(MINE_STOREHOUSE_X + 40, MINE_GROUND_Y - 10)).toBe('storehouse');
    expect(surfaceBuildingAt(MINE_COTTAGE_X + 20, MINE_GROUND_Y - 10)).toBe('cottage');
    for (const index of MINE_RESOURCES.keys()) expect(surfaceBuildingAt(getExitBinX(index) + 20, MINE_GROUND_Y - 10)).toBeNull();
    expect(surfaceBuildingAt(MINE_HEADHOUSE_X + 30, 1)).toBeNull();
    expect(surfaceBuildingAt(MINE_HEADHOUSE_X + 30, MINE_GROUND_Y + 60)).toBeNull();
  });

  it('each have a name and say what they are for', () => {
    for (const info of Object.values(MINE_BUILDINGS)) {
      expect(info.name.length).toBeGreaterThan(3);
      expect(info.role.length).toBeGreaterThan(40);
    }
  });

  it('say the lift is quiet with nobody mining, and held up when an exit warehouse is full', () => {
    newGame({ sites: [], pendingSites: [] });
    expect(buildingNow('headhouse', game()).status.tone).toBe('quiet');
    const site = { row: 6, column: 152, faceRow: 6, faceColumn: 153 };
    newGame({ sites: [site], pendingSites: [] });
    const { status } = buildingNow('headhouse', game());
    expect(status.tone).toBe('busy');
    newGame({ sites: [site], pendingSites: [], mineExit: { ...game().mineExit, ...Object.fromEntries(MINE_RESOURCES.map((r) => [r, game().mineExitCapacity])) } });
    expect(buildingNow('headhouse', game()).status.tone).toBe('stuck');
  });

  it('say what the storehouse holds and when the city’s warehouse is full', () => {
    newGame({ mineStock: { ...game().mineStock, coal: 40, granite: 10 } });
    const busy = buildingNow('storehouse', game());
    expect(busy.status.tone).toBe('busy');
    expect(busy.rows[0].value).toMatch(/40 coal/);
    newGame({ mineStock: { ...game().mineStock, coal: 40 }, warehouse: { ...game().warehouse, coal: game().warehouseCapacity } });
    expect(buildingNow('storehouse', game()).status.text).toMatch(/full of coal/);
    newGame({ mineStock: { ...game().mineStock, ...Object.fromEntries(MINE_RESOURCES.map((r) => [r, 0])) } });
    expect(buildingNow('storehouse', game()).status.tone).toBe('quiet');
  });

  it('say how the crew is spread at the cottage, and point at the idle', () => {
    newGame({}, { keepStaffing: true });
    const { rows, status } = buildingNow('cottage', game());
    expect(rows.map((row) => row.label)).toEqual(['MINERS AT WORK', 'CART PUSHERS', 'AT THE CAMPFIRE', 'TUNNEL LEFT TO DIG', 'SURVEYORS']);
    expect(status.text.length).toBeGreaterThan(10);
  });
});
