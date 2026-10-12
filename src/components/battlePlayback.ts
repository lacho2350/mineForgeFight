// How the battle screen plays an action out: stacks walk their paths hex by hex (fliers glide), lunge at
// whoever they strike, shots, boulders and spells fly, and every hit flashes where it lands — at the
// engine's pace (`BATTLE_PACE`), so the screen shows what an unwatched battle takes in the game too.
// Skia-free: the board and the labels read poses from it every frame (the `'worklet'` helpers).
import { BATTLE_PACE, eventSeconds, hexDistance, type Battle, type Hex } from '../game/combat';
import { hexCenter, type BoardLayout } from './battleLayout';

/**
 * A stack's way over the board while the action plays: board points `[x0, y0, x1, y1, …]` at `times`,
 * lunges `[start, end, dx, dy, …]` (seconds, then the lunge's reach), and when it falls (Infinity: it lives).
 */
export type Track = { points: number[]; times: number[]; lunges: number[]; fallsAt: number };
/** A blow, shot or spell: flying from (x0, y0) from `start` (if it `flies`), landing at (x1, y1) at `land`. */
export type Strike = { heal: boolean; flies: boolean; x0: number; y0: number; x1: number; y1: number; start: number; land: number; damage?: number };
export type Playback = { total: number; tracks: Record<number, Track>; strikes: Strike[] };

/** How far a lunge reaches towards its target, in hex sizes. */
const LUNGE = 0.45;
/** Share of a strike's time a shot is in the air, and when a blow lands (the top of the lunge). */
const FLIGHT = 0.6;
const BLOW = 0.4;

/** A playback that's already over: every stack where it stands. */
export const SETTLED = 1e9;

/** Lay the battle's last action out in time, on a board of `layout`. */
export function battlePlayback(battle: Battle, layout: BoardLayout): Playback {
  const { size, width, fieldWidth, height } = layout;
  const center = (hex: Hex) => hexCenter(size, hex.col, hex.row);
  const events = battle.last;
  // Where every stack stands when the action begins: where it ends, or where it set off from.
  const where = new Map<number, Hex>(battle.stacks.map((stack) => [stack.id, { col: stack.col, row: stack.row }]));
  for (const event of [...events].reverse()) if (event.kind === 'move' && event.actor !== undefined && event.from) where.set(event.actor, event.from);
  const tracks: Record<number, Track> = {};
  const track = (id: number) => {
    const hex = where.get(id) ?? { col: 0, row: 0 };
    const start = center(hex);
    tracks[id] ??= { points: [start.x, start.y], times: [0], lunges: [], fallsAt: Infinity };
    return tracks[id];
  };
  for (const stack of battle.stacks) if (stack.hp > 0) track(stack.id);

  const strikes: Strike[] = [];
  const hitAt = new Map<number, number>();
  let towerShot = 0;
  let t = 0;
  for (const event of events) {
    const seconds = eventSeconds(event);
    const actor = event.actor;
    const target = event.target;
    const to = event.to ?? (target !== undefined ? where.get(target) : undefined);
    if (event.kind === 'move' && actor !== undefined && event.to) {
      const path = event.path && event.path.length > 1 ? event.path : [event.from ?? event.to, event.to];
      const way = track(actor);
      const step = seconds / (path.length - 1);
      way.points.push(center(path[0]).x, center(path[0]).y);
      way.times.push(t);
      path.slice(1).forEach((hex, index) => {
        const point = center(hex);
        way.points.push(point.x, point.y);
        way.times.push(t + step * (index + 1));
      });
      where.set(actor, event.to);
    } else if (to && seconds > 0 && event.kind !== 'round' && event.kind !== 'defend') {
      const heal = event.kind === 'heal' || event.kind === 'resurrect';
      const land = center(to);
      const from = actor !== undefined ? where.get(actor) : undefined;
      // Blows struck from beside the target: the striker lunges at it.
      const blow = (event.kind === 'melee' || event.kind === 'retaliate' || event.kind === 'wall') && from && hexDistance(from, to) <= 1;
      let source: { x: number; y: number } | null = from ? center(from) : null;
      if (event.kind === 'tower') {
        const towers = Math.max(1, battle.towers);
        const step = height / towers;
        source = { x: fieldWidth + (width - fieldWidth) / 2, y: step * (towerShot++ % towers) + step / 2 - size * 0.4 };
      }
      if (blow && actor !== undefined && source) {
        const reach = Math.hypot(land.x - source.x, land.y - source.y) || 1;
        track(actor).lunges.push(t, t + seconds * 0.8, ((land.x - source.x) / reach) * size * LUNGE, ((land.y - source.y) / reach) * size * LUNGE);
      }
      const flies = !blow && !!source && event.kind !== 'oil' && event.kind !== 'moat' && event.kind !== 'trap';
      const landsAt = t + seconds * (flies ? FLIGHT : BLOW);
      strikes.push({ heal, flies, x0: source?.x ?? land.x, y0: source?.y ?? land.y, x1: land.x, y1: land.y, start: t, land: landsAt, damage: event.damage });
      if (target !== undefined && !heal) hitAt.set(target, landsAt);
    }
    t += seconds;
  }
  // Stacks cut down in this action stay on the board until the blow that fells them lands.
  for (const stack of battle.stacks) {
    const fell = hitAt.get(stack.id);
    if (stack.hp <= 0 && fell !== undefined) track(stack.id).fallsAt = fell;
  }
  return { total: t + BATTLE_PACE.beat, tracks, strikes };
}

/** Where a stack is drawn `t` seconds into the action. */
export function trackPose(track: Track, t: number): number[] {
  'worklet';
  const { points, times, lunges } = track;
  let x = points[points.length - 2];
  let y = points[points.length - 1];
  for (let i = 0; i < times.length; i++) {
    if (t > times[i]) continue;
    if (i === 0) {
      x = points[0];
      y = points[1];
    } else {
      const span = times[i] - times[i - 1];
      const f = span > 0 ? (t - times[i - 1]) / span : 1;
      x = points[2 * i - 2] + (points[2 * i] - points[2 * i - 2]) * f;
      y = points[2 * i - 1] + (points[2 * i + 1] - points[2 * i - 1]) * f;
    }
    break;
  }
  for (let i = 0; i < lunges.length; i += 4) {
    if (t <= lunges[i] || t >= lunges[i + 1]) continue;
    const reach = Math.sin((Math.PI * (t - lunges[i])) / (lunges[i + 1] - lunges[i]));
    x += lunges[i + 2] * reach;
    y += lunges[i + 3] * reach;
  }
  return [x, y];
}

/** A stack fades out as the blow that fells it lands. */
export function trackOpacity(track: Track, t: number) {
  'worklet';
  return t < track.fallsAt ? 1 : Math.max(0, 1 - (t - track.fallsAt) / 0.4);
}

/** Where a shot or spell is in flight, and whether it's in the air: [x, y, shown]. */
export function strikeFlight(strike: Strike, t: number): number[] {
  'worklet';
  if (!strike.flies || t < strike.start || t >= strike.land) return [strike.x1, strike.y1, 0];
  const f = (t - strike.start) / (strike.land - strike.start);
  // Arrows and boulders arc a little.
  return [strike.x0 + (strike.x1 - strike.x0) * f, strike.y0 + (strike.y1 - strike.y0) * f - Math.sin(Math.PI * f) * 14, 1];
}

/** How bright a hit's flash is (it fades over a moment after landing). */
export function strikeFlash(strike: Strike, t: number) {
  'worklet';
  return t < strike.land ? 0 : Math.max(0, 1 - (t - strike.land) / 0.45);
}

