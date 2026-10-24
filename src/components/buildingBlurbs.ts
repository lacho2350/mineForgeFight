// One line on what each building is for, shown first in its pop-up; the full role (BUILDING_INFO) sits behind
// EXPLAIN ME. Buildings whose role is already one short line have no entry and show it as it is.
import { BUILDING_INFO, type BuildingId } from '../game/buildings';

const BLURBS: Record<string, string> = {
  keep: 'Seat of the hold: caps every building, collects taxes.',
  houses: 'Sleeps 4–9 peasants; its woman fetches water and food.',
  warehouse: 'Stores resources; its haulers bring them up from the mine.',
  depot: 'Carts that keep the forges supplied.',
  granary: 'Stores the food. None left: the hold goes hungry.',
  orchard: 'Grows apples for the granary.',
  fishery: 'Lands fish for the granary.',
  pasture: 'Sheep outside the walls: mutton and wool.',
  fairground: 'Fun for 50 peasants a level.',
  church: 'Ministers to 50 peasants a level.',
  gardens: 'Pleases 50 peasants a level; needs no staff.',
  woodcutter: 'Fells the forest for wood.',
  forge: 'Makes one part or piece of gear at a time.',
  armory: 'More attack and defence for the whole army.',
  gate: 'Closes the gap in the wall while manned.',
  moat: 'Raiders who wade in take damage every round.',
  docks: 'River barges buy your goods at a premium.',
};

/** The building's one-line purpose: its own blurb, or its role when that is already short. */
export function blurbOf(id: BuildingId): string {
  const kind = id.replace(/\d+$/, '');
  return BLURBS[id] ?? BLURBS[kind] ?? BUILDING_INFO[id].role;
}
