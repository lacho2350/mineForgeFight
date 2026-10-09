import { MINE_SHAFT_COLUMN, getTunnelRow } from '../src/components/MineMapLayout';
import { selectMineLayout } from '../src/game/hold';
import { checkDigStep, isDug, tileKey } from '../src/game/mineLayout';
import { game, newGame } from './support';

beforeEach(() => newGame({ gold: 10_000 }));

const LIFT = MINE_SHAFT_COLUMN;
const ENTRANCE_RAIL = getTunnelRow(-1);
const GALLERY_0_RAIL = getTunnelRow(0);

// Dig a straight run from `from` (a dug tile), one step at a time; returns how far it got and why it stopped.
function digRun(from: [number, number], step: [number, number], tiles: number) {
  const layout = selectMineLayout(game());
  const planned = new Set<string>();
  let [row, column] = from;
  for (let i = 0; i < tiles; i++) {
    const next = tileKey(row + step[0], column + step[1]);
    const check = checkDigStep(layout, planned, next, tileKey(row, column));
    if (!check.ok) return { dug: i, reason: check.reason };
    planned.add(next);
    row += step[0];
    column += step[1];
  }
  return { dug: tiles, reason: null };
}

describe('the main tunnels', () => {
  it('reach two tiles past the lift on every gallery', () => {
    const layout = selectMineLayout(game());
    for (const row of [ENTRANCE_RAIL, GALLERY_0_RAIL]) {
      for (let column = LIFT - 2; column <= LIFT + 2; column++) expect(isDug(layout, row, column)).toBe(true);
    }
  });
});

describe('digging under a main tunnel', () => {
  it('goes straight down from the end of the entrance tunnel and joins the gallery below', () => {
    const run = digRun([ENTRANCE_RAIL, LIFT - 2], [1, 0], GALLERY_0_RAIL - ENTRANCE_RAIL - 1);
    expect(run).toEqual({ dug: GALLERY_0_RAIL - ENTRANCE_RAIL - 1, reason: null });
    // The store takes the same run, and the drag ends against the gallery.
    const keys = Array.from({ length: GALLERY_0_RAIL - ENTRANCE_RAIL - 1 }, (_, i) => tileKey(ENTRANCE_RAIL + 1 + i, LIFT - 2));
    game().planDig(keys);
    expect(game().digPlan).toEqual(keys);
  });

  it('carries on below the deepest gallery from its end', () => {
    expect(digRun([GALLERY_0_RAIL, LIFT - 2], [1, 0], 3).dug).toBe(3);
  });

  it('still keeps the rock beside the lift', () => {
    expect(digRun([ENTRANCE_RAIL, LIFT - 1], [1, 0], 1)).toEqual({ dug: 0, reason: 'Keep the rock beside the lift clear.' });
  });

  it('never joins the side of the lift', () => {
    // From a tunnel two tiles out, digging toward the lift between galleries.
    const layout = selectMineLayout(game());
    const row = ENTRANCE_RAIL + 2;
    const planned = new Set([tileKey(ENTRANCE_RAIL + 1, LIFT - 2), tileKey(row, LIFT - 2)]);
    expect(checkDigStep(layout, planned, tileKey(row, LIFT - 1), tileKey(row, LIFT - 2))).toEqual({ ok: false, reason: 'Keep a tile of rock between tunnels.' });
  });

  it('never runs a tunnel alongside another', () => {
    // A shaft dug down from the entrance tunnel, and a second one started right beside it.
    const layout = selectMineLayout(game());
    const shaft = [1, 2, 3].map((down) => tileKey(ENTRANCE_RAIL + down, LIFT - 2));
    const planned = new Set([...shaft, tileKey(ENTRANCE_RAIL, LIFT - 3)]);
    const beside = checkDigStep(layout, planned, tileKey(ENTRANCE_RAIL + 1, LIFT - 3), tileKey(ENTRANCE_RAIL, LIFT - 3));
    expect(beside).toEqual({ ok: false, reason: 'Keep a tile of rock between tunnels.' });
  });
});
