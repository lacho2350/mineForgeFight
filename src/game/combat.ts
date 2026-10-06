// Turn-based hex battles in the spirit of Heroes of Might and Magic III: stacks of creatures take
// turns by speed, move and strike, shooters shoot, defenders retaliate. Raiders come from the left;
// the hold's army stands on the right behind the wall, with the gate in the middle and towers
// shooting every round. Pure TS (no React/Skia), deterministic from the battle's seed.
import { ARMY_UNITS, UNIT_STATS, type Army, type ArmyUnit, type UnitId } from './units';

export const BATTLE_COLS = 13;
export const BATTLE_ROWS = 9;
export const WALL_COL = 9;
export const GATE_ROW = 4;
/** After this many rounds the raiders give up and leave. */
export const MAX_ROUNDS = 30;
/** Shots at targets further than this do half damage. */
const LONG_RANGE = 7;

export type Side = 'defender' | 'attacker';
export type Hex = { col: number; row: number };

export type Stack = {
  id: number;
  unit: UnitId;
  side: Side;
  col: number;
  row: number;
  /** Health pool: the stack has ceil(hp / unit hp) creatures, the top one possibly wounded. */
  hp: number;
  /** Pool at the start of the battle; healing never goes past it. */
  startHp: number;
  shots: number;
  retaliations: number;
  defending: boolean;
  /** Has used its once-per-battle resurrection. */
  resurrected: boolean;
};

export type WallPiece = { col: number; row: number; hp: number; maxHp: number; gate: boolean };

export type BattleEvent = {
  kind: 'round' | 'move' | 'melee' | 'shot' | 'retaliate' | 'tower' | 'heal' | 'resurrect' | 'defend' | 'wall' | 'end';
  text: string;
  actor?: number;
  target?: number;
  from?: Hex;
  to?: Hex;
  damage?: number;
};

export type BattleStatus = 'active' | 'won' | 'lost' | 'withdrawn';

export type Battle = {
  raid: number;
  rng: number;
  round: number;
  stacks: Stack[];
  walls: WallPiece[];
  towers: number;
  towerDamage: number;
  /** The armory's bonus for the hold's units. */
  bonus: { attack: number; defence: number };
  /** Stacks still to act this round; the first one is acting now. */
  queue: number[];
  status: BattleStatus;
  /** The hold's units are commanded by the AI too. */
  auto: boolean;
  /** The whole battle log, oldest first. */
  log: BattleEvent[];
  /** What the last action did (the board highlights it). */
  last: BattleEvent[];
};

export type BattleAction =
  | { type: 'move'; to: Hex }
  | { type: 'melee'; target: number; from: Hex }
  | { type: 'shoot'; target: number }
  /** Attack a wall section or the gate: in melee from `from`, or with a siege shot. */
  | { type: 'wall'; piece: number; from?: Hex }
  | { type: 'heal'; target: number }
  | { type: 'resurrect'; target: number }
  | { type: 'defend' };

// ——— Hex geometry (pointy-top hexes, odd rows shifted right) ———

export const hexKey = (col: number, row: number) => row * BATTLE_COLS + col;
const inBounds = (col: number, row: number) => col >= 0 && col < BATTLE_COLS && row >= 0 && row < BATTLE_ROWS;

export function neighbours(col: number, row: number): Hex[] {
  const odd = row & 1;
  const deltas = odd
    ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]]
    : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
  return deltas.map(([dc, dr]) => ({ col: col + dc, row: row + dr })).filter((hex) => inBounds(hex.col, hex.row));
}

export function hexDistance(a: Hex, b: Hex) {
  const ax = a.col - (a.row - (a.row & 1)) / 2;
  const bx = b.col - (b.row - (b.row & 1)) / 2;
  const dx = ax - bx;
  const dz = a.row - b.row;
  return Math.max(Math.abs(dx), Math.abs(dz), Math.abs(dx + dz));
}

const adjacent = (a: Hex, b: Hex) => hexDistance(a, b) === 1;

// ——— Small helpers ———

export const stackCount = (stack: Stack) => (stack.hp <= 0 ? 0 : Math.ceil(stack.hp / UNIT_STATS[stack.unit].hp - 1e-9));
export const isAlive = (stack: Stack) => stack.hp > 0;
const other = (side: Side): Side => (side === 'defender' ? 'attacker' : 'defender');
const living = (battle: Battle, side?: Side) => battle.stacks.filter((stack) => isAlive(stack) && (!side || stack.side === side));
const stackAt = (battle: Battle, col: number, row: number) => battle.stacks.find((stack) => isAlive(stack) && stack.col === col && stack.row === row);
const wallAt = (battle: Battle, col: number, row: number) => battle.walls.findIndex((piece) => piece.hp > 0 && piece.col === col && piece.row === row);
export const wallStanding = (battle: Battle) => battle.walls.some((piece) => piece.hp > 0);
const nameOf = (stack: Stack, count = stackCount(stack)) => `${String(count)} ${count === 1 ? UNIT_STATS[stack.unit].name : UNIT_STATS[stack.unit].plural}`;

export function currentStack(battle: Battle): Stack | null {
  if (battle.status !== 'active') return null;
  return battle.stacks.find((stack) => stack.id === battle.queue[0]) ?? null;
}

/** It's the player's move: one of the hold's stacks is up and auto-battle is off. */
export const isPlayerTurn = (battle: Battle) => {
  const stack = currentStack(battle);
  return !!stack && stack.side === 'defender' && !battle.auto;
};

// Deterministic randomness (mulberry32), stored in the battle so replays match.
function random(battle: Battle) {
  battle.rng = (battle.rng + 0x6d2b79f5) | 0;
  let t = battle.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function clone(battle: Battle): Battle {
  return {
    ...battle,
    stacks: battle.stacks.map((stack) => ({ ...stack })),
    walls: battle.walls.map((piece) => ({ ...piece })),
    queue: [...battle.queue],
    log: [...battle.log],
    last: [],
  };
}

function emit(battle: Battle, event: BattleEvent) {
  battle.log.push(event);
  battle.last.push(event);
}

// ——— Setting up ———

// Spread n stacks evenly over the rows of a column.
function spreadRows(count: number) {
  return Array.from({ length: count }, (_, index) => Math.min(BATTLE_ROWS - 1, Math.round(((index + 0.5) * BATTLE_ROWS) / count - 0.5)));
}

export function createBattle({
  raid,
  army,
  enemies,
  wallHp,
  gateHp,
  towers,
  towerDamage,
  attackBonus,
  defenceBonus,
}: {
  raid: number;
  army: Army;
  enemies: { unit: UnitId; count: number }[];
  wallHp: number;
  gateHp: number;
  towers: number;
  towerDamage: number;
  attackBonus: number;
  defenceBonus: number;
}): Battle {
  const stacks: Stack[] = [];
  const add = (unit: UnitId, count: number, side: Side, col: number, row: number) => {
    const stats = UNIT_STATS[unit];
    const hp = count * stats.hp;
    stacks.push({
      id: stacks.length,
      unit,
      side,
      col,
      row,
      hp,
      startHp: hp,
      shots: stats.shots ?? 0,
      retaliations: stats.retaliations ?? 1,
      defending: false,
      resurrected: false,
    });
  };
  // Each side: fighters in front, shooters behind.
  const deploy = (list: { unit: UnitId; count: number }[], side: Side, front: number, back: number) => {
    const shooters = list.filter(({ unit }) => UNIT_STATS[unit].shots);
    const fighters = list.filter(({ unit }) => !UNIT_STATS[unit].shots);
    spreadRows(fighters.length).forEach((row, index) => add(fighters[index].unit, fighters[index].count, side, front, row));
    spreadRows(shooters.length).forEach((row, index) => add(shooters[index].unit, shooters[index].count, side, back, row));
  };
  deploy(ARMY_UNITS.filter((unit) => army[unit] > 0).map((unit) => ({ unit, count: army[unit] })), 'defender', BATTLE_COLS - 2, BATTLE_COLS - 1);
  deploy(enemies.filter((enemy) => enemy.count > 0), 'attacker', 1, 0);

  const walls: WallPiece[] = [];
  if (wallHp > 0) {
    for (let row = 0; row < BATTLE_ROWS; row++) {
      if (row !== GATE_ROW) walls.push({ col: WALL_COL, row, hp: wallHp, maxHp: wallHp, gate: false });
      else if (gateHp > 0) walls.push({ col: WALL_COL, row, hp: gateHp, maxHp: gateHp, gate: true });
    }
  }

  const battle: Battle = {
    raid,
    rng: (raid * 7919 + 17) | 0,
    round: 0,
    stacks,
    walls,
    towers,
    towerDamage,
    bonus: { attack: attackBonus, defence: defenceBonus },
    queue: [],
    status: 'active',
    auto: false,
    log: [],
    last: [],
  };
  // With no army to defend it, the hold has only its towers: they get a few volleys as the raiders come.
  if (living(battle, 'defender').length === 0) {
    for (let volley = 0; volley < 3 && battle.towers > 0 && living(battle, 'attacker').length > 0; volley++) towerVolley(battle);
  }
  checkEnd(battle);
  if (battle.status === 'active') startRound(battle);
  return battle;
}

// ——— Rounds and turns ———

function startRound(battle: Battle) {
  battle.round += 1;
  if (battle.round > MAX_ROUNDS) {
    battle.status = 'withdrawn';
    emit(battle, { kind: 'end', text: 'The raiders give up and fall back.' });
    return;
  }
  emit(battle, { kind: 'round', text: `Round ${String(battle.round)}` });
  for (const stack of battle.stacks) stack.retaliations = UNIT_STATS[stack.unit].retaliations ?? 1;
  towerVolley(battle);
  checkEnd(battle);
  if (battle.status !== 'active') return;
  // Fastest first; on ties the defenders move first.
  battle.queue = living(battle)
    .sort((a, b) => UNIT_STATS[b.unit].speed - UNIT_STATS[a.unit].speed || (a.side === b.side ? a.id - b.id : a.side === 'defender' ? -1 : 1))
    .map((stack) => stack.id);
  beginTurn(battle);
}

// Every tower shoots the most dangerous raiders.
function towerVolley(battle: Battle) {
  for (let tower = 0; tower < battle.towers; tower++) {
    const target = living(battle, 'attacker').sort((a, b) => stackValue(b) - stackValue(a))[0];
    if (!target) break;
    const before = stackCount(target);
    target.hp = Math.max(0, target.hp - battle.towerDamage);
    emit(battle, {
      kind: 'tower',
      text: `A tower hits the ${UNIT_STATS[target.unit].plural.toLowerCase()} for ${String(battle.towerDamage)}${killText(before - stackCount(target))}.`,
      target: target.id,
      damage: battle.towerDamage,
    });
  }
}

function beginTurn(battle: Battle) {
  // Skip stacks that died before their turn came.
  while (battle.queue.length > 0 && !isAlive(battle.stacks[battle.queue[0]])) battle.queue.shift();
  if (battle.queue.length === 0) {
    startRound(battle);
    return;
  }
  battle.stacks[battle.queue[0]].defending = false;
}

function endTurn(battle: Battle) {
  checkEnd(battle);
  if (battle.status !== 'active') return;
  battle.queue.shift();
  beginTurn(battle);
}

function checkEnd(battle: Battle) {
  if (battle.status !== 'active') return;
  if (living(battle, 'attacker').length === 0) {
    battle.status = 'won';
    emit(battle, { kind: 'end', text: 'The raiders are beaten!' });
  } else if (living(battle, 'defender').length === 0) {
    battle.status = 'lost';
    emit(battle, { kind: 'end', text: 'The defenders have fallen. The raiders plunder the hold.' });
  }
}

const killText = (kills: number) => (kills > 0 ? `, ${String(kills)} perish` : '');
const stackValue = (stack: Stack) => UNIT_STATS[stack.unit].value * stackCount(stack);

// ——— Damage (Heroes III formula) ———

function auraOf(battle: Battle, side: Side) {
  let attack = 0;
  let defence = 0;
  for (const stack of living(battle, side)) {
    const aura = UNIT_STATS[stack.unit].aura;
    if (aura) {
      attack = Math.max(attack, aura.attack);
      defence = Math.max(defence, aura.defence);
    }
  }
  return { attack, defence };
}

export function attackOf(battle: Battle, stack: Stack) {
  const bonus = stack.side === 'defender' ? battle.bonus.attack : 0;
  return UNIT_STATS[stack.unit].attack + bonus + auraOf(battle, stack.side).attack;
}

export function defenceOf(battle: Battle, stack: Stack) {
  const bonus = stack.side === 'defender' ? battle.bonus.defence : 0;
  const base = UNIT_STATS[stack.unit].defence + bonus + auraOf(battle, stack.side).defence;
  // Defending: +30% defence until the stack's next turn.
  return stack.defending ? Math.round(base * 1.3) : base;
}

type HitOptions = { ranged: boolean; moved?: number; retaliation?: boolean };

/** Why this hit does half damage, if it does. */
function halfDamage(battle: Battle, attacker: Stack, target: Stack, options: HitOptions) {
  const stats = UNIT_STATS[attacker.unit];
  if (!options.ranged) return !!stats.shots; // shooters fight poorly in melee
  if (hexDistance(attacker, target) > LONG_RANGE) return true;
  // Raiders shooting over a standing wall at the defenders behind it.
  return attacker.side === 'attacker' && wallStanding(battle) && attacker.col < WALL_COL && target.col > WALL_COL;
}

function multiplier(battle: Battle, attacker: Stack, target: Stack, options: HitOptions) {
  const stats = UNIT_STATS[attacker.unit];
  const targetStats = UNIT_STATS[target.unit];
  const attack = attackOf(battle, attacker);
  const defence = defenceOf(battle, target) * (1 - (stats.ignoreDefence ?? 0));
  let factor = attack >= defence ? 1 + 0.05 * Math.min(attack - defence, 60) : 1 - 0.025 * Math.min(defence - attack, 28);
  if (stats.antiCavalry && targetStats.isCavalry) factor *= 1.5;
  if (stats.joust && options.moved) factor *= 1 + 0.05 * options.moved;
  if (halfDamage(battle, attacker, target, options)) factor *= 0.5;
  return factor;
}

/** Damage range of a hit, for the AI and the battle screen's preview. */
export function damageRange(battle: Battle, attacker: Stack, target: Stack, options: HitOptions) {
  const stats = UNIT_STATS[attacker.unit];
  const count = stackCount(attacker);
  const factor = multiplier(battle, attacker, target, options);
  const min = Math.max(1, Math.round(count * stats.minDamage * factor));
  const max = Math.max(1, Math.round(count * stats.maxDamage * factor));
  return { min, max, kills: { min: killsFor(target, min), max: killsFor(target, max) } };
}

function killsFor(target: Stack, damage: number) {
  const left = Math.max(0, target.hp - damage);
  return stackCount(target) - (left <= 0 ? 0 : Math.ceil(left / UNIT_STATS[target.unit].hp - 1e-9));
}

function rollBase(battle: Battle, attacker: Stack) {
  const stats = UNIT_STATS[attacker.unit];
  const count = stackCount(attacker);
  // Like Heroes III: roll for up to ten creatures and scale up for bigger stacks.
  const rolls = Math.min(count, 10);
  let sum = 0;
  for (let i = 0; i < rolls; i++) sum += stats.minDamage + Math.floor(random(battle) * (stats.maxDamage - stats.minDamage + 1));
  return (sum * count) / rolls;
}

function hit(battle: Battle, attacker: Stack, target: Stack, options: HitOptions, kind: BattleEvent['kind']) {
  const damage = Math.max(1, Math.round(rollBase(battle, attacker) * multiplier(battle, attacker, target, options)));
  const before = stackCount(target);
  const attackerName = nameOf(attacker);
  target.hp = Math.max(0, target.hp - damage);
  const verb = kind === 'shot' ? 'shoot' : kind === 'retaliate' ? 'strike back at' : 'attack';
  emit(battle, {
    kind,
    text: `${attackerName} ${verb} the ${UNIT_STATS[target.unit].plural.toLowerCase()} for ${String(damage)}${killText(before - stackCount(target))}.`,
    actor: attacker.id,
    target: target.id,
    from: { col: attacker.col, row: attacker.row },
    to: { col: target.col, row: target.row },
    damage,
  });
}

// ——— Movement ———

/** Can this stack stand on / pass through a hex? */
function passable(battle: Battle, stack: Stack, col: number, row: number, landing: boolean) {
  const occupant = stackAt(battle, col, row);
  if (occupant && occupant.id !== stack.id) return false;
  const piece = wallAt(battle, col, row);
  if (piece < 0) return true;
  // The hold's own troops may pass through their gate, but not stop in it.
  return battle.walls[piece].gate && stack.side === 'defender' && !landing && !UNIT_STATS[stack.unit].flying;
}

/** Hexes the stack can reach this turn, with the number of hexes walked to each. */
export function reachable(battle: Battle, stack: Stack): Map<number, number> {
  const stats = UNIT_STATS[stack.unit];
  const result = new Map<number, number>([[hexKey(stack.col, stack.row), 0]]);
  if (stats.flying) {
    for (let row = 0; row < BATTLE_ROWS; row++) {
      for (let col = 0; col < BATTLE_COLS; col++) {
        const distance = hexDistance(stack, { col, row });
        if (distance > 0 && distance <= stats.speed && passable(battle, stack, col, row, true)) result.set(hexKey(col, row), distance);
      }
    }
    return result;
  }
  const seen = new Map<number, number>([[hexKey(stack.col, stack.row), 0]]);
  let frontier: Hex[] = [{ col: stack.col, row: stack.row }];
  for (let step = 1; step <= stats.speed && frontier.length > 0; step++) {
    const next: Hex[] = [];
    for (const hex of frontier) {
      for (const n of neighbours(hex.col, hex.row)) {
        const key = hexKey(n.col, n.row);
        if (seen.has(key) || !passable(battle, stack, n.col, n.row, false)) continue;
        seen.set(key, step);
        next.push(n);
        if (passable(battle, stack, n.col, n.row, true)) result.set(key, step);
      }
    }
    frontier = next;
  }
  return result;
}

const keyHex = (key: number): Hex => ({ col: key % BATTLE_COLS, row: Math.floor(key / BATTLE_COLS) });

// A shooter with an enemy next to it can't shoot (balloons float free, and a balloon doesn't pin anyone).
function pinned(battle: Battle, stack: Stack) {
  if (UNIT_STATS[stack.unit].meleeImmune) return false;
  return living(battle, other(stack.side)).some((enemy) => !UNIT_STATS[enemy.unit].meleeImmune && adjacent(enemy, stack));
}

export function canShoot(battle: Battle, stack: Stack) {
  return stack.shots > 0 && !pinned(battle, stack);
}

/** Where the stack can stand to hit `target` in melee this turn (hex key → hexes walked). */
export function meleeHexes(battle: Battle, stack: Stack, target: Stack, reach = reachable(battle, stack)) {
  const result = new Map<number, number>();
  if (UNIT_STATS[target.unit].meleeImmune || target.side === stack.side) return result;
  for (const n of neighbours(target.col, target.row)) {
    const key = hexKey(n.col, n.row);
    const walked = reach.get(key);
    if (walked !== undefined) result.set(key, walked);
  }
  return result;
}

// ——— Acting ———

/** Apply one action for the stack whose turn it is. Returns a new battle (the old one is untouched). */
export function act(previous: Battle, action: BattleAction): Battle {
  const battle = clone(previous);
  const stack = currentStack(battle);
  if (!stack) return previous;
  const stats = UNIT_STATS[stack.unit];
  const reach = () => reachable(battle, stack);
  const moveTo = (to: Hex) => {
    if (to.col === stack.col && to.row === stack.row) return 0;
    const walked = reach().get(hexKey(to.col, to.row));
    if (walked === undefined) return -1;
    emit(battle, { kind: 'move', text: `${nameOf(stack)} ${stats.flying ? 'fly' : 'move'}.`, actor: stack.id, from: { col: stack.col, row: stack.row }, to });
    stack.col = to.col;
    stack.row = to.row;
    return walked;
  };

  switch (action.type) {
    case 'move':
      if (moveTo(action.to) < 0) return previous;
      break;
    case 'defend':
      stack.defending = true;
      emit(battle, { kind: 'defend', text: `${nameOf(stack)} stand their ground.`, actor: stack.id });
      break;
    case 'melee': {
      const target = battle.stacks[action.target];
      if (!target || !isAlive(target) || !meleeHexes(battle, stack, target).has(hexKey(action.from.col, action.from.row))) return previous;
      const start = { col: stack.col, row: stack.row };
      const moved = moveTo(action.from);
      hit(battle, stack, target, { ranged: false, moved }, 'melee');
      if (isAlive(target) && target.retaliations > 0 && !stats.meleeImmune) {
        target.retaliations -= 1;
        hit(battle, target, stack, { ranged: false, retaliation: true }, 'retaliate');
      }
      if (stats.strikeAndReturn && isAlive(stack) && (stack.col !== start.col || stack.row !== start.row)) {
        emit(battle, { kind: 'move', text: `${nameOf(stack)} fly back.`, actor: stack.id, from: { col: stack.col, row: stack.row }, to: start });
        stack.col = start.col;
        stack.row = start.row;
      }
      break;
    }
    case 'shoot': {
      const target = battle.stacks[action.target];
      if (!target || !isAlive(target) || target.side === stack.side || !canShoot(battle, stack)) return previous;
      stack.shots -= 1;
      hit(battle, stack, target, { ranged: true }, 'shot');
      break;
    }
    case 'wall': {
      const piece = battle.walls[action.piece] as WallPiece | undefined;
      if (!piece || piece.hp <= 0 || stack.side !== 'attacker') return previous;
      if (action.from) {
        if (moveTo(action.from) < 0 || !adjacent(stack, piece)) return previous;
      } else {
        if (!stats.siege || !canShoot(battle, stack)) return previous;
        stack.shots -= 1;
      }
      const damage = Math.max(1, Math.round(rollBase(battle, stack) * (stats.wallBreaker ? 2 : 1)));
      piece.hp = Math.max(0, piece.hp - damage);
      const what = piece.gate ? 'the gate' : 'the wall';
      emit(battle, {
        kind: 'wall',
        text: `${nameOf(stack)} ${action.from ? 'batter' : 'hurl boulders at'} ${what} for ${String(damage)}${piece.hp <= 0 ? ` — ${what} ${piece.gate ? 'is smashed' : 'crumbles'}!` : '.'}`,
        actor: stack.id,
        from: { col: stack.col, row: stack.row },
        to: { col: piece.col, row: piece.row },
        damage,
      });
      break;
    }
    case 'heal': {
      const target = battle.stacks[action.target];
      if (!stats.heals || !target || target.id === stack.id || !isAlive(target) || target.side !== stack.side || target.hp >= target.startHp) return previous;
      const before = stackCount(target);
      const amount = Math.min(target.startHp - target.hp, stats.heals * stackCount(stack));
      target.hp += amount;
      const back = stackCount(target) - before;
      emit(battle, {
        kind: 'heal',
        text: `${nameOf(stack)} heal the ${UNIT_STATS[target.unit].plural.toLowerCase()} for ${String(amount)}${back > 0 ? `, ${String(back)} get back up` : ''}.`,
        actor: stack.id,
        target: target.id,
        from: { col: stack.col, row: stack.row },
        to: { col: target.col, row: target.row },
      });
      break;
    }
    case 'resurrect': {
      const target = battle.stacks[action.target];
      if (!stats.resurrects || stack.resurrected || !target || target.id === stack.id || target.side !== stack.side || target.hp >= target.startHp) return previous;
      if (!isAlive(target)) {
        // A fallen stack rises where it fell, or on the nearest free hex.
        const spot = nearestFree(battle, target);
        if (!spot) return previous;
        target.col = spot.col;
        target.row = spot.row;
        target.shots = UNIT_STATS[target.unit].shots ?? 0;
      }
      const before = stackCount(target);
      const amount = Math.min(target.startHp - target.hp, stats.resurrects * stackCount(stack));
      target.hp += amount;
      stack.resurrected = true;
      const raised = stackCount(target) - before;
      emit(battle, {
        kind: 'resurrect',
        text: raised > 0
          ? `${nameOf(stack)} resurrect ${String(raised)} ${UNIT_STATS[target.unit].plural.toLowerCase()}!`
          : `${nameOf(stack)} restore ${String(amount)} health to the ${UNIT_STATS[target.unit].plural.toLowerCase()}.`,
        actor: stack.id,
        target: target.id,
        from: { col: stack.col, row: stack.row },
        to: { col: target.col, row: target.row },
      });
      break;
    }
  }
  endTurn(battle);
  return battle;
}

function nearestFree(battle: Battle, around: Hex): Hex | null {
  let best: Hex | null = null;
  let bestDistance = Infinity;
  for (let row = 0; row < BATTLE_ROWS; row++) {
    for (let col = 0; col < BATTLE_COLS; col++) {
      if (stackAt(battle, col, row) || wallAt(battle, col, row) >= 0) continue;
      const distance = hexDistance(around, { col, row });
      if (distance < bestDistance) {
        best = { col, row };
        bestDistance = distance;
      }
    }
  }
  return best;
}

// ——— What a tap means (the battle screen) ———

/** The action a tap on a hex means for the stack whose turn it is, if any. */
export function actionForHex(battle: Battle, hex: Hex): BattleAction | null {
  const stack = currentStack(battle);
  if (!stack) return null;
  const stats = UNIT_STATS[stack.unit];
  const target = stackAt(battle, hex.col, hex.row);
  if (target && target.side !== stack.side) {
    if (canShoot(battle, stack)) return { type: 'shoot', target: target.id };
    const spots = meleeHexes(battle, stack, target);
    if (spots.size === 0) return null;
    // Charge from as far as possible; everyone else strikes from the closest spot.
    const pick = [...spots.entries()].sort((a, b) => (stats.joust ? b[1] - a[1] : a[1] - b[1]))[0][0];
    return { type: 'melee', target: target.id, from: keyHex(pick) };
  }
  if (target && target.side === stack.side && target.id !== stack.id) {
    if (stats.resurrects && !stack.resurrected && target.hp < target.startHp) return { type: 'resurrect', target: target.id };
    if (stats.heals && target.hp < target.startHp) return { type: 'heal', target: target.id };
    return null;
  }
  if (reachable(battle, stack).has(hexKey(hex.col, hex.row)) && (hex.col !== stack.col || hex.row !== stack.row)) {
    return { type: 'move', to: hex };
  }
  return null;
}

/** Fallen stacks of the acting side that an angel could raise. */
export function fallenAllies(battle: Battle) {
  const stack = currentStack(battle);
  if (!stack || !UNIT_STATS[stack.unit].resurrects || stack.resurrected) return [];
  return battle.stacks.filter((other) => other.side === stack.side && !isAlive(other));
}

// ——— AI (raiders always; the hold's army too in auto-battle) ———

function expectedKillValue(battle: Battle, attacker: Stack, target: Stack, options: HitOptions) {
  const range = damageRange(battle, attacker, target, options);
  const average = (range.min + range.max) / 2;
  const killed = Math.min(target.hp, average) / UNIT_STATS[target.unit].hp;
  return killed * UNIT_STATS[target.unit].value;
}

// Distance-to-the-enemy field for walkers: walls count as passable but slow (by their health), so
// raiders head for the weakest point; other stacks are detours.
function approachField(battle: Battle, stack: Stack) {
  const size = BATTLE_COLS * BATTLE_ROWS;
  const cost = new Array<number>(size).fill(Infinity);
  const done = new Array<boolean>(size).fill(false);
  for (const enemy of living(battle, other(stack.side))) {
    if (UNIT_STATS[enemy.unit].meleeImmune) continue;
    for (const n of neighbours(enemy.col, enemy.row)) cost[hexKey(n.col, n.row)] = 0;
  }
  for (;;) {
    let current = -1;
    for (let key = 0; key < size; key++) if (!done[key] && cost[key] < Infinity && (current < 0 || cost[key] < cost[current])) current = key;
    if (current < 0) break;
    done[current] = true;
    const hex = keyHex(current);
    for (const n of neighbours(hex.col, hex.row)) {
      const key = hexKey(n.col, n.row);
      if (done[key]) continue;
      const occupant = stackAt(battle, n.col, n.row);
      if (occupant && occupant.side !== stack.side) continue;
      const piece = wallAt(battle, n.col, n.row);
      let step = 1;
      if (piece >= 0 && !(battle.walls[piece].gate && stack.side === 'defender')) step += battle.walls[piece].hp / 25;
      if (occupant && occupant.id !== stack.id) step += 3;
      if (cost[current] + step < cost[key]) cost[key] = cost[current] + step;
    }
  }
  return cost;
}

export function chooseAction(battle: Battle, stack: Stack): BattleAction {
  const stats = UNIT_STATS[stack.unit];
  const allies = battle.stacks.filter((ally) => ally.side === stack.side);
  const enemies = living(battle, other(stack.side));

  // Angels raise whoever lost the most.
  if (stats.resurrects && !stack.resurrected) {
    const best = allies
      .map((ally) => ({ ally, lost: ((ally.startHp - ally.hp) / UNIT_STATS[ally.unit].hp) * UNIT_STATS[ally.unit].value }))
      .filter(({ ally, lost }) => ally.id !== stack.id && lost > 0 && (isAlive(ally) || nearestFree(battle, ally)))
      .sort((a, b) => b.lost - a.lost)[0];
    if (best && best.lost >= stackValue(stack) * 0.3) return { type: 'resurrect', target: best.ally.id };
  }
  // Monks heal a badly hurt ally.
  if (stats.heals) {
    const amount = stats.heals * stackCount(stack);
    const best = allies
      .filter((ally) => ally.id !== stack.id && isAlive(ally) && ally.startHp - ally.hp >= Math.min(amount, ally.startHp * 0.25))
      .sort((a, b) => (b.startHp - b.hp) * UNIT_STATS[b.unit].value / UNIT_STATS[b.unit].hp - (a.startHp - a.hp) * UNIT_STATS[a.unit].value / UNIT_STATS[a.unit].hp)[0];
    if (best) return { type: 'heal', target: best.id };
  }
  // Shooters shoot whatever they'd hurt most (cyclopes smash the wall while it holds their friends back).
  if (canShoot(battle, stack)) {
    if (stats.siege && stack.side === 'attacker' && wallStanding(battle) && enemies.some((enemy) => enemy.col > WALL_COL)) {
      const walkers = living(battle, 'attacker').filter((ally) => !UNIT_STATS[ally.unit].flying && !UNIT_STATS[ally.unit].shots);
      if (walkers.length > 0 && !battle.walls.some((piece) => piece.hp <= 0) && !battle.walls.every((piece) => !piece.gate)) {
        const target = battle.walls.map((piece, index) => ({ piece, index })).filter(({ piece }) => piece.hp > 0).sort((a, b) => a.piece.hp - b.piece.hp)[0];
        if (target) return { type: 'wall', piece: target.index };
      }
    }
    const target = enemies
      .map((enemy) => ({ enemy, score: expectedKillValue(battle, stack, enemy, { ranged: true }) }))
      .sort((a, b) => b.score - a.score)[0];
    if (target) return { type: 'shoot', target: target.enemy.id };
  }

  // Melee: the best blow within reach.
  const reach = reachable(battle, stack);
  let best: { action: BattleAction; score: number } | null = null;
  for (const enemy of enemies) {
    for (const [key, walked] of meleeHexes(battle, stack, enemy, reach)) {
      const score = expectedKillValue(battle, stack, enemy, { ranged: false, moved: walked }) + walked * 0.01 * (stats.joust ? 1 : -1);
      if (!best || score > best.score) best = { action: { type: 'melee', target: enemy.id, from: keyHex(key) }, score };
    }
  }
  if (best) return best.action;

  // Shooters out of arrows and everyone else: close in. Defenders hold the wall while raiders come to them.
  if (stack.side === 'defender' && wallStanding(battle) && stack.col > WALL_COL) {
    const raidersComing = enemies.some((enemy) => !(UNIT_STATS[enemy.unit].shots && enemy.shots > 0));
    if (raidersComing || stats.shots) return { type: 'defend' };
  }
  if (stats.flying) {
    const targets = enemies.filter((enemy) => !UNIT_STATS[enemy.unit].meleeImmune);
    if (targets.length === 0) return { type: 'defend' };
    let move: Hex | null = null;
    let closest = Infinity;
    for (const key of reach.keys()) {
      const hex = keyHex(key);
      const distance = Math.min(...targets.map((enemy) => hexDistance(hex, enemy)));
      if (distance < closest) {
        closest = distance;
        move = hex;
      }
    }
    return move && (move.col !== stack.col || move.row !== stack.row) ? { type: 'move', to: move } : { type: 'defend' };
  }
  const field = approachField(battle, stack);
  let bestKey = hexKey(stack.col, stack.row);
  for (const key of reach.keys()) if (field[key] < field[bestKey]) bestKey = key;
  // Raiders stopped by the wall batter the section in their way.
  if (stack.side === 'attacker') {
    let wallHit: { piece: number; from: number; score: number } | null = null;
    for (const key of reach.keys()) {
      const hex = keyHex(key);
      for (const n of neighbours(hex.col, hex.row)) {
        const piece = wallAt(battle, n.col, n.row);
        if (piece < 0) continue;
        const score = field[hexKey(n.col, n.row)];
        if (!wallHit || score < wallHit.score) wallHit = { piece, from: key, score };
      }
    }
    if (wallHit && wallHit.score <= field[bestKey]) return { type: 'wall', piece: wallHit.piece, from: keyHex(wallHit.from) };
  }
  if (bestKey === hexKey(stack.col, stack.row)) return { type: 'defend' };
  return { type: 'move', to: keyHex(bestKey) };
}

/** Let the AI act if it's an AI-controlled stack's turn. */
export function stepAI(battle: Battle): Battle {
  const stack = currentStack(battle);
  if (!stack || isPlayerTurn(battle)) return battle;
  const next = act(battle, chooseAction(battle, stack));
  // A rejected action would stall the battle; fall back to standing ground.
  return next === battle ? act(battle, { type: 'defend' }) : next;
}

/** Fight the rest of the battle automatically (quick combat). */
export function resolveBattle(battle: Battle): Battle {
  let current: Battle = { ...battle, auto: true };
  for (let guard = 0; guard < 5000 && current.status === 'active'; guard++) current = stepAI(current);
  return current;
}

/** The hold's army after the battle: survivors (healed and resurrected ones included) and losses. */
export function battleOutcome(battle: Battle, before: Army) {
  const survivors: Army = { ...before };
  for (const unit of ARMY_UNITS) survivors[unit] = 0;
  for (const stack of battle.stacks) {
    if (stack.side !== 'defender') continue;
    survivors[stack.unit as ArmyUnit] += stackCount(stack);
  }
  const losses: Partial<Record<ArmyUnit, number>> = {};
  for (const unit of ARMY_UNITS) {
    const lost = before[unit] - survivors[unit];
    if (lost > 0) losses[unit] = lost;
  }
  const slain = battle.stacks
    .filter((stack) => stack.side === 'attacker')
    .reduce((sum, stack) => sum + Math.round((stack.startHp - stack.hp) / UNIT_STATS[stack.unit].hp), 0);
  return { survivors, losses, slain };
}
