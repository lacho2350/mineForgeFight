import type { BuildingId } from '../game/buildings';
import { FORGE_IDS, type ForgeId } from '../game/forges';
import type { RoadKind } from '../game/roads';
import type { TrapKind } from '../game/traps';

/** A small picture for each building, for the build palette and lists. */
export const BUILDING_ICONS: Record<BuildingId, string> = {
  keep: '🏰',
  houses: '🏠',
  warehouse: '📦',
  foundry: '🔥',
  research: '🔭',
  armory: '🛡️',
  depot: '🛒',
  ...(Object.fromEntries(FORGE_IDS.map((id) => [id, '⚒️'])) as Record<ForgeId, string>),
  wall: '🧱',
  towers: '🗼',
  gate: '🚪',
  moat: '🌊',
  docks: '⚓',
  guardhouse: '🔱',
  archery: '🏹',
  barracks: '⚔️',
  monastery: '🔔',
  balloonWorks: '🎈',
  stables: '🐎',
  griffinEyrie: '🦅',
  chapel: '☀️',
  sanctum: '✨',
};

/** And one for each kind of trap. */
export const TRAP_ICONS: Record<TrapKind, string> = {
  spikes: '🕳️',
  pitch: '🛢️',
  snare: '🪢',
};

/** And for each road (and taking roads up). */
export const ROAD_ICONS: Record<RoadKind | 'erase', string> = {
  dirt: '🟫',
  stone: '🪨',
  granite: '⬜',
  erase: '🧹',
};
