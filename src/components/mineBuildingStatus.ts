// What each of the mine's surface buildings is for, and what it's doing now (the card a tap on one shows,
// MineBuildingPanel). Plain TS, so it can be tested without React Native.
import type { GameState } from '../game/state';
import { MAX_DEPTH } from '../game/gameStore';
import { minersByLevel, siteResource, workforceOf } from '../game/hold';
import { cartsOnLevel } from '../game/haulage';
import { MINE_RESOURCES, RESOURCE_INFO, type Resource } from '../game/resources';
import type { MineSurfaceBuilding } from './MineMapLayout';

export const MINE_BUILDINGS: Record<MineSurfaceBuilding, { icon: string; name: string; role: string }> = {
  headhouse: {
    icon: '⚙️',
    name: 'Headhouse',
    role: 'Covers the top of the main lift. Carts come up from every gallery and are pushed out to the exit warehouses, one for each resource, six either side, and tipped there.',
  },
  storehouse: {
    icon: '📦',
    name: 'Mine Storehouse',
    role: 'The mine stockpile. Haulers bring each resource here from the exit warehouses, and carry it on up the road to the warehouse in the city.',
  },
  cottage: {
    icon: '🏠',
    name: 'Mine Captain’s Cottage',
    role: 'Where the mine’s crew is mustered: miners at the faces, cart pushers on the galleries, diggers cutting new tunnels and the surveyors mapping the rock.',
  },
};

const names = (resources: readonly Resource[]) => resources.map((resource) => RESOURCE_INFO[resource].name.toLowerCase()).join(', ');
const whole = (amount: number) => Math.floor(amount).toLocaleString();

export type BuildingRow = { label: string; value: string };
export type BuildingStatus = { tone: 'busy' | 'quiet' | 'stuck'; text: string };

/** What a surface building is doing now: a few numbers, and one line on how it's going. */
export function buildingNow(building: MineSurfaceBuilding, game: GameState): { rows: BuildingRow[]; status: BuildingStatus } {
  const workforce = workforceOf(game);
  const mined = [...new Set(game.sites.map(siteResource))];
  if (building === 'headhouse') {
    const levels = [...minersByLevel(game.sites).keys()];
    const carts = levels.reduce((sum, level) => sum + cartsOnLevel(game.carts, level), 0);
    const fullExits = MINE_RESOURCES.filter((resource) => mined.includes(resource) && game.mineExit[resource] >= game.mineExitCapacity);
    const rows = [
      { label: 'GALLERIES OPEN', value: `${String(game.depth)} of ${String(MAX_DEPTH)}` },
      { label: 'CARTS WORKING', value: `${String(carts)} on ${String(levels.length)} level${levels.length === 1 ? '' : 's'}` },
      { label: 'CART PUSHERS', value: String(workforce.pushers) },
    ];
    if (game.sites.length === 0) return { rows, status: { tone: 'quiet', text: 'Quiet: nobody is mining yet. ASSIGN sends the peasants at the campfire to the faces.' } };
    if (fullExits.length > 0) return { rows, status: { tone: 'stuck', text: `Held up: the ${names(fullExits)} exit warehouse${fullExits.length === 1 ? ' is' : 's are'} full, so carts for ${fullExits.length === 1 ? 'it' : 'them'} wait.` } };
    return { rows, status: { tone: 'busy', text: `Busy: carts bringing up ${names(mined)} from ${String(game.sites.length)} miner${game.sites.length === 1 ? '' : 's'}.` } };
  }
  if (building === 'storehouse') {
    const held = MINE_RESOURCES.filter((resource) => game.mineStock[resource] >= 1).sort((a, b) => game.mineStock[b] - game.mineStock[a]);
    const total = held.reduce((sum, resource) => sum + game.mineStock[resource], 0);
    const cityFull = held.filter((resource) => game.warehouse[resource] >= game.warehouseCapacity);
    const full = held.filter((resource) => game.mineStock[resource] >= game.mineCapacity);
    const rows = [
      { label: 'HOLDING', value: total > 0 ? held.slice(0, 3).map((resource) => `${whole(game.mineStock[resource])} ${RESOURCE_INFO[resource].name.toLowerCase()}`).join(' · ') + (held.length > 3 ? ' …' : '') : 'nothing' },
      { label: 'ROOM', value: `${whole(game.mineCapacity)} of each` },
      { label: 'HAULERS', value: `up to ${String(game.surfaceHaul)} of each a second` },
    ];
    if (cityFull.length > 0) return { rows, status: { tone: 'stuck', text: `Held up: the city’s warehouse is full of ${names(cityFull)}, so it stays here.` } };
    if (full.length > 0) return { rows, status: { tone: 'stuck', text: `Full of ${names(full)}: it backs up into the exit warehouses until the city takes more.` } };
    if (total > 0) return { rows, status: { tone: 'busy', text: `Busy: carrying ${names(held)} up to the city.` } };
    return { rows, status: { tone: 'quiet', text: 'Quiet: waiting for loads from the exit warehouses.' } };
  }
  const surveyWait = Math.max(0, Math.ceil(game.surveyReadyAt - game.elapsedSeconds));
  const rows = [
    { label: 'MINERS AT WORK', value: game.pendingSites.length > 0 ? `${String(game.sites.length)} (+${String(game.pendingSites.length)} on their way)` : String(game.sites.length) },
    { label: 'CART PUSHERS', value: String(workforce.pushers) },
    { label: 'AT THE CAMPFIRE', value: String(workforce.idle) },
    { label: 'TUNNEL LEFT TO DIG', value: `${String(game.digPlan.length)} tile${game.digPlan.length === 1 ? '' : 's'}` },
    { label: 'SURVEYORS', value: surveyWait > 0 ? `back in ${String(surveyWait)} s` : 'ready' },
  ];
  if (workforce.idle > 0) return { rows, status: { tone: 'quiet', text: `${String(workforce.idle)} peasant${workforce.idle === 1 ? ' is' : 's are'} idle at the campfire: ASSIGN sends them to the free faces.` } };
  if (game.digPlan.length > 0) return { rows, status: { tone: 'busy', text: 'Busy: the crew is at the faces and the diggers are cutting tunnel.' } };
  return { rows, status: { tone: 'busy', text: game.sites.length > 0 ? 'Busy: everyone is at work.' : 'Quiet: nobody is at the mine.' } };
}
