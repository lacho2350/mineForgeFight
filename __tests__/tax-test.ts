import { buildingStats, taxPerMinute } from '../src/game/buildings';
import { game, newGame, run } from './support';

describe('taxes', () => {
  it('are the keep’s level × the peasants, in gold a minute (collected every 5 s)', () => {
    newGame({ population: 20 });
    const { keep } = game().buildings;
    expect(taxPerMinute(buildingStats(game().buildings), 20)).toBe(keep * 20);
    const gold = game().gold;
    run(5);
    expect(game().gold - gold).toBeCloseTo((keep * 20) / 12, 1);
  });

  it('grow with the people and the keep, and with the tax techs', () => {
    const stats = buildingStats({ ...game().buildings, keep: 4 });
    expect(taxPerMinute(stats, 50)).toBe(2 * taxPerMinute(stats, 25));
    expect(taxPerMinute(buildingStats({ ...game().buildings, keep: 8 }), 25)).toBe(2 * taxPerMinute(stats, 25));
    expect(taxPerMinute(buildingStats({ ...game().buildings, keep: 4 }, undefined, ['taxRolls']), 25)).toBe(125);
  });
});
