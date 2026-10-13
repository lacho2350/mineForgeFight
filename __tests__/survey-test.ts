import { selectMineLayout } from '../src/game/hold';
import { depositAt, getDepositInfo, isDug, tileKey } from '../src/game/mineLayout';
import { SURVEY_SECONDS, darkTiles, surveyAt, surveyCooldown, surveyCost, surveyRadius } from '../src/game/survey';
import { game, newGame, run } from './support';

// The deposits nobody can see yet that a survey from `key` would map.
const darkDeposits = (key: string) =>
  darkTiles(selectMineLayout(game()), surveyAt(key, game().techs)).filter(({ row, column }) => depositAt(row, column));
// A tunnel tile with unseen deposits in a survey's reach.
function tunnelSpot() {
  const layout = selectMineLayout(game());
  for (let row = 2; row < 40; row++) {
    for (let column = 0; column < 300; column++) if (isDug(layout, row, column) && darkDeposits(tileKey(row, column)).length > 0) return tileKey(row, column);
  }
  throw new Error('no tunnel near dark deposits');
}
// An unseen deposit a survey from `key` would map.
function depositNear(key: string) {
  const { row, column } = darkDeposits(key)[0];
  return tileKey(row, column);
}
// A tile of dark rock (not a tunnel).
function darkRock() {
  const { row, column } = darkTiles(selectMineLayout(game()), surveyAt(tunnelSpot(), game().techs))[0];
  return tileKey(row, column);
}

describe('surveys', () => {
  it('map the dark rock round a tunnel: what was unknown shows its deposits', () => {
    newGame({ gold: 500 });
    const spot = tunnelSpot();
    const deposit = depositNear(spot);
    expect(getDepositInfo(selectMineLayout(game()), deposit).status).toBe('unknown');
    expect(getDepositInfo(selectMineLayout(game()), deposit).deposit).toBeNull();
    game().survey(spot);
    const info = getDepositInfo(selectMineLayout(game()), deposit);
    expect(info.status).not.toBe('unknown');
    expect(info.deposit).toBe(depositAt(info.row, info.column));
    expect(game().notice).toMatch(/surveyors mapped/);
  });

  it('set out only from a tunnel, not from the rock', () => {
    newGame({ gold: 500 });
    const gold = game().gold;
    game().survey(darkRock());
    expect(game().notice).toMatch(/Pick a tunnel/);
    expect(game().surveys).toEqual([]);
    expect(game().gold).toBe(gold);
  });

  it('cost gold (more the deeper) and take a long while to be ready again', () => {
    newGame({ gold: 500 });
    const spot = tunnelSpot();
    const cost = surveyCost(surveyAt(spot, []).row, game().techs);
    expect(surveyCost(60, [])).toBeGreaterThan(surveyCost(5, []));
    game().survey(spot);
    expect(game().gold).toBe(500 - cost);
    expect(game().surveyReadyAt - game().elapsedSeconds).toBe(SURVEY_SECONDS);
    // Not again until they're ready.
    game().survey(tunnelSpot());
    expect(game().surveys).toHaveLength(1);
    expect(game().notice).toMatch(/ready in/);
    run(SURVEY_SECONDS);
    game().survey(tunnelSpot());
    expect(game().surveys).toHaveLength(2);
  });

  it('are refused, free, where the rock is mapped already', () => {
    newGame({ gold: 500 });
    const spot = tunnelSpot();
    game().survey(spot);
    run(SURVEY_SECONDS);
    const gold = game().gold;
    game().survey(spot);
    expect(game().notice).toMatch(/mapped already/);
    expect(game().surveys).toHaveLength(1);
    expect(game().gold).toBe(gold);
  });

  it('get quicker, cheaper and wider with the mine’s survey techs', () => {
    expect(surveyCooldown([])).toBe(240);
    expect(surveyCooldown(['surveyLanterns'])).toBe(168);
    expect(surveyCooldown(['surveyLanterns', 'dowsingRods', 'seismicCharges'])).toBe(72);
    expect(surveyRadius([])).toBe(6);
    expect(surveyRadius(['surveyLanterns', 'dowsingRods', 'seismicCharges'])).toBe(10);
    expect(surveyCost(10, ['dowsingRods'])).toBeLessThan(surveyCost(10, []));
  });

  it('are needed before a miner can be sent into the dark', () => {
    newGame({ gold: 500, population: 20 });
    game().assignMiner(depositNear(tunnelSpot()));
    expect(game().notice).toMatch(/survey it first/);
    expect(game().digPlan).toEqual([]);
  });
});
