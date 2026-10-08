// The army's gear: soldiers aren't raised from raw ore but from the gear they carry. Every unit needs one
// piece of its own gear, and each tier's gear is harder to make than the last: a pike is just forged iron;
// a sword needs a steel blade and a bronze shield boss; a balloon rig needs a burner and bombs, which need
// gunpowder; an angel's relic is built from parts that between them take every resource there is. Parts
// (steel bars, bronze, …) are items too, kept in store. Every step is made at a forge set to it
// (forges.ts). Pure TS.
import type { Resource } from './resources';
import type { ArmyUnit } from './units';

export const PART_IDS = ['steel', 'bronze', 'silverwork', 'gunpowder', 'bomb', 'burner', 'tack', 'gemLure', 'mithrilBar'] as const;
export const GEAR_IDS = ['pike', 'crossbow', 'sword', 'blessedStaff', 'balloonRig', 'lance', 'harness', 'mithrilPlate', 'relic'] as const;
export const ITEM_IDS = [...PART_IDS, ...GEAR_IDS] as const;
export type ItemId = (typeof ITEM_IDS)[number];
export type ItemStock = Record<ItemId, number>;

export const emptyItems = (): ItemStock => Object.fromEntries(ITEM_IDS.map((item) => [item, 0])) as ItemStock;

/** What one item takes: raw resources from the warehouse, other items, and seconds of the armory's work. */
export type Recipe = { resources: Partial<Record<Resource, number>>; items: Partial<Record<ItemId, number>>; seconds: number };

export const ITEM_INFO: Record<ItemId, { name: string; plural: string; icon: string; recipe: Recipe }> = {
  // ——— Parts ———
  steel: { name: 'Steel bar', plural: 'Steel bars', icon: '▬', recipe: { resources: { iron: 2, coal: 1 }, items: {}, seconds: 3 } },
  bronze: { name: 'Bronze', plural: 'Bronze', icon: '◒', recipe: { resources: { copper: 1, tin: 1 }, items: {}, seconds: 3 } },
  silverwork: { name: 'Silver filigree', plural: 'Silver filigree', icon: '✧', recipe: { resources: { silver: 2, gold: 1 }, items: {}, seconds: 4 } },
  gunpowder: { name: 'Gunpowder', plural: 'Gunpowder', icon: '⁂', recipe: { resources: { sulfur: 2, coal: 1 }, items: {}, seconds: 3 } },
  bomb: { name: 'Bomb', plural: 'Bombs', icon: '💣', recipe: { resources: { iron: 1 }, items: { gunpowder: 1 }, seconds: 4 } },
  burner: { name: 'Burner', plural: 'Burners', icon: '🔥', recipe: { resources: { coal: 2 }, items: { bronze: 1 }, seconds: 4 } },
  tack: { name: 'Salted tack', plural: 'Salted tack', icon: '➰', recipe: { resources: { salt: 2, copper: 1 }, items: {}, seconds: 4 } },
  gemLure: { name: 'Gem lure', plural: 'Gem lures', icon: '💎', recipe: { resources: { emerald: 1 }, items: { silverwork: 1 }, seconds: 5 } },
  mithrilBar: { name: 'Mithril bar', plural: 'Mithril bars', icon: '▭', recipe: { resources: { mithril: 2, coal: 2 }, items: {}, seconds: 5 } },
  // ——— Gear, one per unit, tier 1 → 9 ———
  pike: { name: 'Pike', plural: 'Pikes', icon: '🔱', recipe: { resources: { iron: 2 }, items: {}, seconds: 4 } },
  crossbow: { name: 'Crossbow', plural: 'Crossbows', icon: '🏹', recipe: { resources: { iron: 1, copper: 2 }, items: {}, seconds: 5 } },
  sword: { name: 'Sword and shield', plural: 'Swords and shields', icon: '⚔️', recipe: { resources: {}, items: { steel: 1, bronze: 1 }, seconds: 6 } },
  blessedStaff: { name: 'Blessed staff', plural: 'Blessed staves', icon: '⚚', recipe: { resources: { granite: 1 }, items: { silverwork: 1, steel: 1 }, seconds: 7 } },
  balloonRig: { name: 'Balloon rig', plural: 'Balloon rigs', icon: '🎈', recipe: { resources: {}, items: { burner: 1, bomb: 2 }, seconds: 8 } },
  lance: { name: 'Lance and barding', plural: 'Lances and barding', icon: '🐎', recipe: { resources: {}, items: { pike: 1, tack: 1, steel: 2 }, seconds: 9 } },
  harness: { name: 'Griffin harness', plural: 'Griffin harnesses', icon: '🦅', recipe: { resources: {}, items: { gemLure: 1, tack: 1, steel: 1 }, seconds: 10 } },
  mithrilPlate: { name: 'Mithril plate', plural: 'Mithril plate', icon: '🛡️', recipe: { resources: {}, items: { mithrilBar: 2, sword: 1, silverwork: 1 }, seconds: 12 } },
  relic: {
    name: 'Celestial relic',
    plural: 'Celestial relics',
    icon: '✨',
    recipe: { resources: { diamond: 1, granite: 2 }, items: { mithrilPlate: 1, gemLure: 1, gunpowder: 1, tack: 1 }, seconds: 15 },
  },
};

/** The gear each unit is raised with (one piece per soldier). */
export const UNIT_GEAR: Record<ArmyUnit, ItemId> = {
  pikeman: 'pike',
  bowman: 'crossbow',
  swordsman: 'sword',
  monk: 'blessedStaff',
  balloon: 'balloonRig',
  cavalry: 'lance',
  griffin: 'harness',
  paladin: 'mithrilPlate',
  angel: 'relic',
};

export const isItemId = (value: unknown): value is ItemId => typeof value === 'string' && (ITEM_IDS as readonly string[]).includes(value);

/** A recipe as text, e.g. "1 steel bar · 1 bronze" or "2 iron · 1 coal". */
export function recipeParts(item: ItemId, resourceName: (resource: Resource) => string) {
  const { recipe } = ITEM_INFO[item];
  return [
    ...(Object.entries(recipe.items) as [ItemId, number][]).map(([part, n]) => `${String(n)} ${(n === 1 ? ITEM_INFO[part].name : ITEM_INFO[part].plural).toLowerCase()}`),
    ...(Object.entries(recipe.resources) as [Resource, number][]).map(([resource, n]) => `${String(n)} ${resourceName(resource)}`),
  ];
}
