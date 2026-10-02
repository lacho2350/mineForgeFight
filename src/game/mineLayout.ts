import {
  MINE_COLUMNS,
  MINE_ENTRANCE_ROW,
  MINE_GALLERY_COUNT,
  MINE_LEVEL_ROWS,
  MINE_SHAFT_COLUMN,
  MINE_STATIONS,
  MINE_SURFACE_ROWS,
  MINE_TILE_SIZE,
  MINE_WORK_RISE,
  getMineMapHeight,
  getTunnelRow,
  getWorkRow,
} from '../components/MineMapLayout';
import type { Resource } from './resources';

// The mine as a grid of tiles: what is dug and what each dug tile is for, where deposits lie, and
// where each miner works. The simulation, the terrain renderer and the carts all read this, so
// a tunnel the player digs is lit, walkable for carts and usable for miners at the same moment.

export type TileKind = 'lift' | 'gallery' | 'chamber' | 'ladder' | 'tunnel';
export type Deposit = Resource;

/** A miner's work site: the dug tile they stand in and the face they cut (beside, above or below it). */
export type Site = {
  row: number;
  column: number;
  faceRow: number;
  faceColumn: number;
  /** Gallery stations are generated (chamber + ladder shaft); deposit sites sit in player tunnels. */
  kind: 'station' | 'deposit';
  /** Index into MINE_STATIONS for station sites. */
  station?: number;
};

export type MineLayout = {
  version: number;
  depth: number;
  rows: number;
  sites: Site[];
  kinds: Map<string, TileKind>;
  /** Dug columns per row, for lighting. */
  dugByRow: Map<number, number[]>;
  /** Gallery tunnel extent per level. */
  spans: Map<number, { left: number; right: number }>;
  /** Coal face tiles already being worked. */
  faces: Set<string>;
  playerDug: string[];
  /** Coal taken from each deposit so far, keyed by tile. */
  depositMined: Record<string, number>;
  /** Gallery stations whose chamber and ladder shaft have been cut ("level:station"); they stay dug. */
  openedStations: Set<string>;
  /** Station sites (worked or not) for every opened station, by level. */
  stationsByLevel: Map<number, Site[]>;
};

export const stationKey = (level: number, station: number) => `${String(level)}:${String(station)}`;

export const tileKey = (row: number, column: number) => `${String(row)},${String(column)}`;

export function parseKey(key: string) {
  const [row, column] = key.split(',').map(Number);
  return { row, column };
}

export function hash(row: number, column: number, salt = 0) {
  let h = (row * 73856093) ^ (column * 19349663) ^ (salt * 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Which level a row belongs to (-1 is the entrance level) and how far above its rail tunnel it is. */
export function levelOfRow(row: number) {
  const level = Math.ceil((row - MINE_ENTRANCE_ROW) / MINE_LEVEL_ROWS) - 1;
  return { level, rise: getTunnelRow(level) - row };
}

export function lastTunnelRow(depth: number) {
  return getTunnelRow(Math.min(depth, MINE_GALLERY_COUNT) - 1);
}

/** The coal seam beside a gallery station, if this tile is one. */
export function stationSeamAt(row: number, column: number): { level: number; station: number } | null {
  const { level, rise } = levelOfRow(row);
  if (rise !== MINE_WORK_RISE || level < -1 || level >= MINE_GALLERY_COUNT) return null;
  const station = MINE_STATIONS.findIndex((candidate) => candidate.oreColumn === column);
  return station >= 0 ? { level, station } : null;
}

// ——— Deposits ———
// About 30% of the rock is deposits, in clusters of 1–15 tiles. The map is split into 5×5 cells and
// each cell may seed one cluster, grown tile by tile inside the cell's top-left 4×4, so a line of
// rock always separates clusters and none can merge past 15 tiles. Everything is derived from the
// tile position, so the mine is the same every game, and clusters are only worked out for the parts
// of the map that are actually looked at.

const CLUSTER_CELL = 5;
const CLUSTER_AREA = CLUSTER_CELL - 1;
const CLUSTER_SPAWN_PERCENT = 100;
const CLUSTER_MAX_TILES = 15;
const MAP_ROWS = Math.round(getMineMapHeight(MINE_GALLERY_COUNT) / MINE_TILE_SIZE);

type Cluster = { tiles: Set<string>; type: Deposit };
const clusterCache = new Map<string, Cluster | null>();

// Tiles kept clear of deposits: the lift and its rock buffer, every gallery rail row near the lift,
// and the chamber and ladder shafts of every possible gallery station.
function isReservedTile(row: number, column: number) {
  if (row < MINE_SURFACE_ROWS || row >= MAP_ROWS || column < 0 || column >= MINE_COLUMNS) return true;
  if (Math.abs(column - MINE_SHAFT_COLUMN) <= 1) return true;
  const { level, rise } = levelOfRow(row);
  if (level < -1 || level >= MINE_GALLERY_COUNT) return false;
  const reach = Math.max(...MINE_STATIONS.map((station) => Math.abs(station.minerColumn - MINE_SHAFT_COLUMN))) + 1;
  if (rise === 0 && Math.abs(column - MINE_SHAFT_COLUMN) <= reach) return true;
  return rise >= 1 && rise <= MINE_WORK_RISE && MINE_STATIONS.some((station) => station.minerColumn === column);
}

// Deeper rock holds more of the precious ores.
function pickDepositType(row: number, roll: number): Deposit {
  const depth = Math.min(1, row / MAP_ROWS);
  const weights: [Deposit, number][] = [
    ['coal', 38],
    ['granite', 22],
    ['copper', 16],
    ['iron', 14 + 6 * depth],
    ['gold', row > 12 ? 3 + 9 * depth : 0],
    ['diamond', row > 30 ? 0.6 + 7 * depth * depth : 0],
  ];
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let pick = (roll / 0xffffffff) * total;
  for (const [type, weight] of weights) {
    pick -= weight;
    if (pick < 0) return type;
  }
  return 'coal';
}

function cellCluster(cellRow: number, cellColumn: number): Cluster | null {
  const key = `${String(cellRow)}:${String(cellColumn)}`;
  const known = clusterCache.get(key);
  if (known !== undefined) return known;

  let cluster: Cluster | null = null;
  if (hash(cellRow, cellColumn, 60) % 100 < CLUSTER_SPAWN_PERCENT) {
    const size = 1 + (hash(cellRow, cellColumn, 61) % CLUSTER_MAX_TILES);
    const top = cellRow * CLUSTER_CELL;
    const left = cellColumn * CLUSTER_CELL;
    const startRow = top + (hash(cellRow, cellColumn, 62) % CLUSTER_AREA);
    const startColumn = left + (hash(cellRow, cellColumn, 63) % CLUSTER_AREA);
    const inBounds = (row: number, column: number) =>
      row >= top && row < top + CLUSTER_AREA && column >= left && column < left + CLUSTER_AREA && !isReservedTile(row, column);
    if (inBounds(startRow, startColumn)) {
      const placed: [number, number][] = [[startRow, startColumn]];
      const tiles = new Set([tileKey(startRow, startColumn)]);
      const steps = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (let attempt = 0; placed.length < size && attempt < size * 6; attempt += 1) {
        const [row, column] = placed[hash(cellRow * 31 + attempt, cellColumn, 64) % placed.length];
        const [dr, dc] = steps[hash(cellRow, cellColumn * 31 + attempt, 65) % 4];
        const next = tileKey(row + dr, column + dc);
        if (tiles.has(next) || !inBounds(row + dr, column + dc)) continue;
        tiles.add(next);
        placed.push([row + dr, column + dc]);
      }
      cluster = { tiles, type: pickDepositType(startRow, hash(cellRow, cellColumn, 66)) };
    }
  }
  clusterCache.set(key, cluster);
  return cluster;
}

// Natural deposit on a tile (if any), plus a coal seam beside every gallery station.
export function depositAt(row: number, column: number): Deposit | null {
  if (stationSeamAt(row, column)) return 'coal';
  if (isReservedTile(row, column)) return null;
  const cluster = cellCluster(Math.floor(row / CLUSTER_CELL), Math.floor(column / CLUSTER_CELL));
  return cluster?.tiles.has(tileKey(row, column)) ? cluster.type : null;
}

// Units each deposit holds when untouched: thousands for every type, fewer for the precious ones.
const DEPOSIT_SIZE: Record<Deposit, [number, number]> = {
  coal: [1000, 5000],
  granite: [1000, 5000],
  copper: [1000, 4000],
  iron: [1000, 4000],
  gold: [1000, 2500],
  diamond: [1000, 2000],
};

/** How much a deposit holds when untouched. */
export function depositTotal(row: number, column: number) {
  const deposit = depositAt(row, column);
  if (!deposit) return 0;
  const [min, max] = DEPOSIT_SIZE[deposit];
  return min + (hash(row, column, 7) % (max - min + 1));
}

export function depositRemaining(layout: Pick<MineLayout, 'depositMined'>, row: number, column: number) {
  return Math.max(0, depositTotal(row, column) - (layout.depositMined[tileKey(row, column)] ?? 0));
}

/** Coal left as a step 0–4 (0 = mined out), used to redraw deposits as they shrink. */
export function depositStep(total: number, remaining: number) {
  return remaining <= 0 || total <= 0 ? 0 : Math.ceil((remaining / total) * 4);
}

export function stationSite(level: number, station: number): Site {
  const { minerColumn, oreColumn } = MINE_STATIONS[station];
  return { row: getWorkRow(level), column: minerColumn, faceRow: getWorkRow(level), faceColumn: oreColumn, kind: 'station', station };
}

function stationFootprint(level: number, station: number) {
  const site = stationSite(level, station);
  const tiles: [number, number][] = [];
  for (let row = site.row; row < getTunnelRow(level); row += 1) tiles.push([row, site.column]);
  return tiles;
}

/** The level a site's cart belongs to. */
export function siteLevel(site: Site) {
  return levelOfRow(site.row).level;
}

let cached: MineLayout | null = null;

export function buildMineLayout(input: {
  version: number;
  depth: number;
  sites: Site[];
  playerDug: string[];
  depositMined: Record<string, number>;
  openedStations: string[];
}): MineLayout {
  if (cached && cached.version === input.version) return cached;
  const { depth, sites, playerDug, depositMined } = input;
  const openedStations = new Set(input.openedStations);
  const stationsByLevel = new Map<number, Site[]>();
  for (const key of openedStations) {
    const [level, station] = key.split(':').map(Number);
    const list = stationsByLevel.get(level) ?? [];
    list.push(stationSite(level, station));
    stationsByLevel.set(level, list);
  }
  const kinds = new Map<string, TileKind>();
  const spans = new Map<number, { left: number; right: number }>();

  for (let row = MINE_SURFACE_ROWS; row <= lastTunnelRow(depth); row += 1) kinds.set(tileKey(row, MINE_SHAFT_COLUMN), 'lift');

  for (let level = -1; level < Math.min(depth, MINE_GALLERY_COUNT); level += 1) {
    let left = MINE_SHAFT_COLUMN - 1;
    let right = MINE_SHAFT_COLUMN + 1;
    for (const site of stationsByLevel.get(level) ?? []) {
      left = Math.min(left, site.column);
      right = Math.max(right, site.column);
    }
    spans.set(level, { left, right });
    const row = getTunnelRow(level);
    for (let column = left; column <= right; column += 1) {
      if (column !== MINE_SHAFT_COLUMN) kinds.set(tileKey(row, column), 'gallery');
    }
  }

  for (const [level, stations] of stationsByLevel) {
    for (const site of stations) {
      if (site.station === undefined) continue;
      stationFootprint(level, site.station).forEach(([row, column], index) => {
        kinds.set(tileKey(row, column), index === 0 ? 'chamber' : 'ladder');
      });
    }
  }

  for (const key of playerDug) if (!kinds.has(key)) kinds.set(key, 'tunnel');

  const dugByRow = new Map<number, number[]>();
  for (const key of kinds.keys()) {
    const { row, column } = parseKey(key);
    const list = dugByRow.get(row);
    if (list) list.push(column);
    else dugByRow.set(row, [column]);
  }

  cached = {
    version: input.version,
    depth,
    // The whole claim exists from the start as unexplored rock; galleries open as the mine deepens.
    rows: Math.round(getMineMapHeight(MINE_GALLERY_COUNT) / MINE_TILE_SIZE),
    sites,
    kinds,
    dugByRow,
    spans,
    faces: new Set(sites.map((site) => tileKey(site.faceRow, site.faceColumn))),
    playerDug,
    depositMined,
    openedStations,
    stationsByLevel,
  };
  return cached;
}

export const isDug = (layout: MineLayout, row: number, column: number) => layout.kinds.has(tileKey(row, column));

// ——— Miner sites ———

// Faces a miner standing at (row, column) can cut: either side first, then below and above.
function faceNeighbours(row: number, column: number): [number, number][] {
  return [[row, column - 1], [row, column + 1], [row + 1, column], [row - 1, column]];
}

function freeDepositSites(layout: MineLayout): Site[] {
  const taken = new Set(layout.sites.map((site) => tileKey(site.row, site.column)));
  const faces = new Set(layout.faces);
  const result: Site[] = [];
  for (const key of layout.playerDug) {
    if (taken.has(key)) continue;
    const { row, column } = parseKey(key);
    for (const [faceRow, faceColumn] of faceNeighbours(row, column)) {
      const faceKey = tileKey(faceRow, faceColumn);
      if (faceColumn < 0 || faceColumn >= MINE_COLUMNS || faces.has(faceKey) || isDug(layout, faceRow, faceColumn)) continue;
      if (!depositAt(faceRow, faceColumn) || depositRemaining(layout, faceRow, faceColumn) <= 0) continue;
      result.push({ row, column, faceRow, faceColumn, kind: 'deposit' });
      faces.add(faceKey);
      taken.add(key);
      break;
    }
  }
  // Coal keeps the mine running, so new miners take coal faces before other ores.
  return result.sort((a, b) => Number(depositAt(a.faceRow, a.faceColumn) !== 'coal') - Number(depositAt(b.faceRow, b.faceColumn) !== 'coal'));
}

function freeStationSites(layout: MineLayout): Site[] {
  const taken = new Set(layout.sites.filter((site) => site.kind === 'station').map((site) => tileKey(site.row, site.column)));
  const player = new Set(layout.playerDug);
  // Player tiles in a gallery's own rail row just extend the gallery, so stations may connect to them.
  const touchesPlayer = (row: number, column: number, railRow: number) =>
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(
      ([dr, dc]) => row + dr !== railRow && player.has(tileKey(row + dr, column + dc)),
    );
  const result: Site[] = [];
  for (let level = -1; level < Math.min(layout.depth, MINE_GALLERY_COUNT); level += 1) {
    for (let station = 0; station < MINE_STATIONS.length; station += 1) {
      const site = stationSite(level, station);
      if (taken.has(tileKey(site.row, site.column)) || depositRemaining(layout, site.faceRow, site.faceColumn) <= 0) continue;
      // A station can't be cut where the player's tunnels would end up touching it (opened ones are already cut).
      const blocked = !layout.openedStations.has(stationKey(level, station)) && stationFootprint(level, station).some(([row, column]) => touchesPlayer(row, column, getTunnelRow(level))) ||
        player.has(tileKey(site.faceRow, site.faceColumn));
      if (!blocked) result.push(site);
    }
  }
  return result;
}

export type DepositInfo = {
  key: string;
  row: number;
  column: number;
  deposit: Deposit | null;
  total: number;
  remaining: number;
  /** The miner working this deposit, if any. */
  worker: Site | null;
  /** Where a miner would stand to work it, if it can be worked right now. */
  standing: Site | null;
  status: 'worked' | 'available' | 'unreachable' | 'depleted' | 'empty';
};

// Where a miner could stand to work the coal face at (row, column): the station chamber for a
// gallery seam, otherwise a dug tile right beside the deposit.
function standingSiteFor(layout: MineLayout, row: number, column: number): Site | null {
  const seam = stationSeamAt(row, column);
  if (seam && seam.level < layout.depth) {
    return freeStationSites(layout).find((site) => site.faceRow === row && site.faceColumn === column) ?? null;
  }
  const taken = new Set(layout.sites.map((site) => tileKey(site.row, site.column)));
  // Stand beside the deposit, or in a tunnel right above or below it.
  for (const [standRow, standColumn] of faceNeighbours(row, column)) {
    const kind = layout.kinds.get(tileKey(standRow, standColumn));
    if (!kind || kind === 'lift' || taken.has(tileKey(standRow, standColumn))) continue;
    return { row: standRow, column: standColumn, faceRow: row, faceColumn: column, kind: 'deposit' };
  }
  return null;
}

/** Everything the player needs to know about the deposit on a tile, for the info panel. */
export function getDepositInfo(layout: MineLayout, key: string): DepositInfo {
  const { row, column } = parseKey(key);
  const deposit = isDug(layout, row, column) ? null : depositAt(row, column);
  const total = depositTotal(row, column);
  const remaining = deposit ? depositRemaining(layout, row, column) : 0;
  const worker = layout.sites.find((site) => site.faceRow === row && site.faceColumn === column) ?? null;
  const base = { key, row, column, deposit, total, remaining, worker, standing: null };
  if (!deposit) return { ...base, status: 'empty' };
  if (remaining <= 0) return { ...base, status: 'depleted' };
  if (worker) return { ...base, status: 'worked' };
  const standing = standingSiteFor(layout, row, column);
  return { ...base, standing, status: standing ? 'available' : 'unreachable' };
}

/** Where the next hired miner goes: a deposit the player dug to (coal first), else the next free gallery station. */
export function nextFreeSite(layout: MineLayout): Site | null {
  return freeDepositSites(layout)[0] ?? freeStationSites(layout)[0] ?? null;
}


// ——— Digging ———

export function digTime(row: number) {
  return 2 + row * 0.04; // seconds per tile; deeper rock is harder
}

export function digCost(row: number) {
  return 3 + Math.floor(row / 10); // gold per tile
}

export type DigCheck = { ok: true } | { ok: false; reason: string };

/**
 * Whether `key` can be dug as the next step from `parentKey` (an existing or planned tile).
 * The rock rule: a new tunnel only meets other tunnels end-on, so apart from its parent no
 * neighbouring tile may be dug, except diagonals that belong to the parent's own tunnel.
 * Deposit tiles can't be dug at all; miners work them from a tunnel beside them.
 */
export function checkDigStep(layout: MineLayout, planned: ReadonlySet<string>, key: string, parentKey: string): DigCheck {
  const { row, column } = parseKey(key);
  const parent = parseKey(parentKey);
  const open = (r: number, c: number) => isDug(layout, r, c) || planned.has(tileKey(r, c));
  if (row < MINE_SURFACE_ROWS) return { ok: false, reason: 'Too close to the surface.' };
  if (row >= layout.rows || column < 0 || column >= MINE_COLUMNS) return { ok: false, reason: 'Outside the mine.' };
  if (column === MINE_SHAFT_COLUMN) return { ok: false, reason: 'The lift shaft is reserved.' };
  // The columns beside the lift stay rock (the lift grows down as the mine deepens); tunnels may
  // only cross them sideways, branching off the lift or a gallery.
  if (Math.abs(column - MINE_SHAFT_COLUMN) === 1 && parent.row !== row) {
    return { ok: false, reason: 'Keep the rock beside the lift clear.' };
  }
  if (open(row, column)) return { ok: false, reason: 'Already dug.' };
  // Deposits are solid: tunnels go around them (a mined-out hollow can be dug through).
  if (depositAt(row, column) && depositRemaining(layout, row, column) > 0) {
    return { ok: false, reason: 'Deposits can’t be dug through. Dig around them.' };
  }
  if (Math.abs(parent.row - row) + Math.abs(parent.column - column) !== 1 || !open(parent.row, parent.column)) {
    return { ok: false, reason: 'Dig from the end of a tunnel.' };
  }
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const r = row + dr;
    const c = column + dc;
    if (r === parent.row && c === parent.column) continue;
    if (open(r, c)) return { ok: false, reason: 'Keep a tile of rock between tunnels.' };
  }
  for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const r = row + dr;
    const c = column + dc;
    if (!open(r, c)) continue;
    const besideParent = Math.abs(r - parent.row) + Math.abs(c - parent.column) === 1;
    if (!besideParent) return { ok: false, reason: 'Keep a tile of rock between tunnels.' };
  }
  return { ok: true };
}

/** A dug or planned tile next to `key` that a dig there could start from, if any. */
export function findDigParent(layout: MineLayout, planned: ReadonlySet<string>, key: string): string | null {
  const { row, column } = parseKey(key);
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const parentKey = tileKey(row + dr, column + dc);
    if (checkDigStep(layout, planned, key, parentKey).ok) return parentKey;
  }
  return null;
}

/** Tiles a miner could stand on to work the deposit at `faceKey`: rock beside, above or below it, not yet dug. */
export function standingTargets(layout: MineLayout, faceKey: string): string[] {
  const { row, column } = parseKey(faceKey);
  return faceNeighbours(row, column)
    .filter(([standRow, standColumn]) => standColumn >= 0 && standColumn < MINE_COLUMNS && !isDug(layout, standRow, standColumn))
    .map(([standRow, standColumn]) => tileKey(standRow, standColumn));
}

const ROUTE_SEARCH_RADIUS = 30;
const ROUTE_MAX_TILES = 40;

/**
 * The shortest tunnel (in dig order) from any dug or planned tile to one of `targets`, obeying the
 * same rules as digging by hand. Searches a box around the target so it stays quick on a huge map.
 */
export function findDigRoute(layout: MineLayout, planned: ReadonlySet<string>, targets: string[]): string[] | null {
  if (targets.length === 0) return null;
  const targetSet = new Set(targets);
  const centre = parseKey(targets[0]);
  const inBox = (row: number, column: number) =>
    Math.abs(row - centre.row) <= ROUTE_SEARCH_RADIUS && Math.abs(column - centre.column) <= ROUTE_SEARCH_RADIUS;

  const parent = new Map<string, string | null>();
  const length = new Map<string, number>();
  const queue: string[] = [];
  for (const key of [...layout.kinds.keys(), ...planned]) {
    const { row, column } = parseKey(key);
    if (!inBox(row, column) || parent.has(key)) continue;
    parent.set(key, null);
    length.set(key, 0);
    queue.push(key);
  }
  const pathTo = (key: string) => {
    const path: string[] = [];
    for (let at: string | null = key; at && (length.get(at) ?? 0) > 0; at = parent.get(at) ?? null) path.push(at);
    return path.reverse();
  };

  for (let i = 0; i < queue.length; i += 1) {
    const key = queue[i];
    const depth = length.get(key) ?? 0;
    if (depth >= ROUTE_MAX_TILES) continue;
    const { row, column } = parseKey(key);
    // The rock rule depends on what this route itself has dug so far.
    const dugSoFar = new Set([...planned, ...pathTo(key)]);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = tileKey(row + dr, column + dc);
      if (parent.has(next) || !inBox(row + dr, column + dc)) continue;
      if (!checkDigStep(layout, dugSoFar, next, key).ok) continue;
      parent.set(next, key);
      length.set(next, depth + 1);
      if (targetSet.has(next)) return pathTo(next);
      queue.push(next);
    }
  }
  return null;
}

export function routeCost(route: string[]) {
  return route.reduce((sum, key) => sum + digCost(parseKey(key).row), 0);
}
