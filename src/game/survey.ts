// Surveys: the surveyors set out from a tunnel tile and map the dark rock round it for gold, so the
// deposits in it show (and can be dug to) further out than the miners can see. They take a long while to
// be ready again at first; the mine's survey techs (Survey lanterns, Dowsing rods, Seismic charges) make
// them quicker, cheaper and wider. Pure TS.
import { rulesOf, type Difficulty } from './difficulty';
import { MINE_COLUMNS, MINE_SURFACE_ROWS } from '../components/MineMapLayout';
import { isDug, isRevealed, parseKey, type MineLayout, type Survey } from './mineLayout';
import { techBonuses, type TechId } from './techs';

/** Seconds before the surveyors are ready again, before the techs. */
export const SURVEY_SECONDS = 240;
/** Tiles mapped all round the tunnel tile surveyed from (a 13 × 13 patch), before the techs. The rock
 * 3 tiles round a tunnel shows anyway (`FOG_REACH`), so a survey sees 3 tiles further. */
export const SURVEY_RADIUS = 6;

/** Seconds until the surveyors are ready again after a survey. */
export const surveyCooldown = (techs: readonly TechId[]) => Math.round(SURVEY_SECONDS * Math.max(0.2, 1 - techBonuses(techs).surveyTime));
/** Tiles a survey maps all round its centre. */
/** How far the surveyors see: their techs widen it, Nightmare and Hardcore narrow it (difficulty.ts). */
export const surveyRadius = (techs: readonly TechId[], difficulty?: Difficulty) => Math.max(1, SURVEY_RADIUS + techBonuses(techs).surveyRadius + rulesOf(difficulty).surveyReach);
/** Gold a survey costs: dearer the deeper it goes. */
export const surveyCost = (row: number, techs: readonly TechId[]) =>
  Math.round((25 + Math.floor(Math.max(0, row - MINE_SURFACE_ROWS) / 2)) * (1 - techBonuses(techs).surveyCost));

type SurveyState = { elapsedSeconds: number; surveyReadyAt: number; gold: number; techs: readonly TechId[]; difficulty?: Difficulty };

/** The survey made from the tunnel tile `key` (centre and reach). */
export const surveyAt = (key: string, techs: readonly TechId[], difficulty?: Difficulty): Survey => ({ ...parseKey(key), radius: surveyRadius(techs, difficulty) });

/** The tiles of `area` nobody can see yet (what a survey there would map); stops at `limit` of them. */
export function darkTiles(layout: MineLayout, area: Survey, limit = Infinity) {
  const dark: { row: number; column: number }[] = [];
  for (let row = Math.max(MINE_SURFACE_ROWS, area.row - area.radius); row <= area.row + area.radius; row++) {
    for (let column = Math.max(0, area.column - area.radius); column <= Math.min(MINE_COLUMNS - 1, area.column + area.radius); column++) {
      if (isRevealed(layout, row, column)) continue;
      dark.push({ row, column });
      if (dark.length >= limit) return dark;
    }
  }
  return dark;
}

/** Why the surveyors can't map the rock round the tile `key` now, or null if they can. */
export function surveyProblem(state: SurveyState, layout: MineLayout, key: string): string | null {
  const { row, column } = parseKey(key);
  if (row < MINE_SURFACE_ROWS || column < 0 || column >= MINE_COLUMNS || !isDug(layout, row, column)) {
    return 'Pick a tunnel: the surveyors set out from dug ground and map the rock round it.';
  }
  const wait = state.surveyReadyAt - state.elapsedSeconds;
  if (wait > 0) return `The surveyors are still out: ready in ${String(Math.ceil(wait))} s.`;
  const cost = surveyCost(row, state.techs);
  if (state.gold < cost) return `A survey there costs ${String(cost)} gold.`;
  if (darkTiles(layout, surveyAt(key, state.techs, state.difficulty), 1).length === 0) return 'The rock round there is mapped already: pick a tunnel nearer the dark rock.';
  return null;
}
