// What each villager wears, by the job they're doing — so a smith, a fisherman or a monk is known by
// their clothes as they walk the streets. Skia-free: a look is drawn as a list of rects (scene units,
// relative to the feet), so the sprite sheet in `peasants.tsx` and any preview can paint it.
import type { BuildingId } from '../../game/buildings';
import { CHURCH_IDS, FAIRGROUND_IDS } from '../../game/moodBuildings';

type Hat = 'none' | 'cap' | 'brim' | 'hood' | 'helmet' | 'scarf' | 'straw' | 'coif' | 'tall';
type Tool = 'none' | 'axe' | 'crook' | 'net' | 'pick' | 'spear' | 'book' | 'tongs' | 'whip' | 'bell';
type Outfit = {
  /** Tunic or robe, and its shaded side. */
  tunic: string;
  shade: string;
  legs: string;
  hat: Hat;
  hatColor?: string;
  /** A long robe down to the shoes (no legs showing). */
  robe?: boolean;
  /** An apron over the front. */
  apron?: string;
  /** Stripes across the tunic. */
  stripes?: string;
  /** A tabard's badge, or a cross on a robe. */
  badge?: string;
  belt?: string;
  /** Bare arms (smiths, porters). */
  bareArms?: boolean;
  tool?: Tool;
};

const SKIN = '#e0b48a';
const SKIN_SHADE = '#b4865e';
const SHOES = '#3a2a1c';
const HAIR = '#5a3a22';
const STEEL = '#c9ccd1';
const WOOD = '#8c6a3c';

export type Job =
  | 'hauler'
  | 'woodcutter'
  | 'builder'
  | 'quarryman'
  | 'fisher'
  | 'shepherd'
  | 'smith'
  | 'scholar'
  | 'armourer'
  | 'docker'
  | 'gatekeeper'
  | 'soldier'
  | 'archer'
  | 'monk'
  | 'priest'
  | 'groom'
  | 'engineer'
  | 'falconer'
  | 'miller'
  | 'entertainer'
  | 'acolyte';

export const OUTFITS: Record<Job, Outfit> = {
  // Miners' haulers: a grimy smock, a leather cap, dark breeches.
  hauler: { tunic: '#6e5a48', shade: '#544434', legs: '#3d3a36', hat: 'cap', hatColor: '#4f3a26', belt: '#3a2a1c' },
  // Woodcutters: a green jerkin, a red hood, an axe at the belt.
  woodcutter: { tunic: '#4f7a3a', shade: '#3a5c2a', legs: '#5e4630', hat: 'hood', hatColor: '#a33b2e', belt: '#3a2a1c', tool: 'axe' },
  // Builders: a straw hat, an ochre shirt under a leather apron (the hammer is drawn as they work).
  builder: { tunic: '#c9a35a', shade: '#a5844a', legs: '#5e4630', hat: 'straw', hatColor: '#e2c470', apron: '#7a5a3a' },
  // Rock-breakers: a grey shirt, a headscarf, a pick.
  quarryman: { tunic: '#8a8a80', shade: '#6c6c64', legs: '#4f3a26', hat: 'scarf', hatColor: '#c9b48a', bareArms: true, tool: 'pick' },
  // Fishermen: a blue smock, a wide oilskin hat, a net over the shoulder.
  fisher: { tunic: '#3f6f8a', shade: '#2c5068', legs: '#6e5a48', hat: 'brim', hatColor: '#c9a35a', tool: 'net' },
  // Shepherds: a white wool smock, a felt hat, a crook.
  shepherd: { tunic: '#e8e0c8', shade: '#bdb6a2', legs: '#7a5a3a', hat: 'brim', hatColor: '#6e5236', belt: '#7a5a3a', tool: 'crook' },
  // Smiths and founders: bare arms, a black leather apron, tongs.
  smith: { tunic: '#5a4a3e', shade: '#443830', legs: '#3d3a36', hat: 'none', apron: '#2a2620', bareArms: true, tool: 'tongs' },
  // Scholars: a long blue gown with a gold trim, a flat cap, a book.
  scholar: { tunic: '#3a4f8a', shade: '#2a3a68', legs: '#3a4f8a', hat: 'cap', hatColor: '#2a2620', robe: true, badge: '#e2b84f', tool: 'book' },
  // Armourers: a mail coif and a leather apron.
  armourer: { tunic: '#7a6a5a', shade: '#5e5044', legs: '#3d3a36', hat: 'coif', hatColor: STEEL, apron: '#6e4a2f' },
  // Dockers: a striped shirt, a knitted cap, bare arms.
  docker: { tunic: '#e8e0c8', shade: '#bdb6a2', legs: '#3f4f6a', hat: 'cap', hatColor: '#a33b2e', stripes: '#3f6f8a', bareArms: true },
  // Gatekeepers: a steel cap and a blue tabard with a gold badge, a spear.
  gatekeeper: { tunic: '#3f5f9a', shade: '#2c4473', legs: '#5e5e64', hat: 'helmet', badge: '#e2b84f', belt: '#3a2a1c', tool: 'spear' },
  // Men-at-arms (guardhouse, barracks): a steel cap, a red tabard with a gold badge, a spear.
  soldier: { tunic: '#9a3b32', shade: '#6e2822', legs: '#5e5e64', hat: 'helmet', badge: '#e2b84f', belt: '#3a2a1c', tool: 'spear' },
  // Archers: a green hood and a red tabard.
  archer: { tunic: '#9a3b32', shade: '#6e2822', legs: '#4f7a3a', hat: 'hood', hatColor: '#4f7a3a', belt: '#3a2a1c' },
  // Monks: a brown habit and hood, a rope girdle.
  monk: { tunic: '#7a5a3a', shade: '#5a4028', legs: '#7a5a3a', hat: 'hood', hatColor: '#6a4a2e', robe: true, belt: '#e8e0c8' },
  // Priests (the church): a black cassock with a gold cross, a bell.
  priest: { tunic: '#2e2a30', shade: '#1e1b20', legs: '#2e2a30', hat: 'none', robe: true, badge: '#e2b84f', tool: 'bell' },
  // Acolytes (the paladin chapel, the sanctum): a white robe with a red cross.
  acolyte: { tunic: '#ece6d4', shade: '#bdb6a2', legs: '#ece6d4', hat: 'none', robe: true, badge: '#b8483a' },
  // Grooms: a brown jerkin over a green shirt, a whip.
  groom: { tunic: '#7a5232', shade: '#5a3a24', legs: '#4f7a3a', hat: 'cap', hatColor: '#4f7a3a', belt: '#3a2a1c', tool: 'whip' },
  // Balloon-wrights: an oiled red coat, a tall hat, a spanner (the pick's place).
  engineer: { tunic: '#b8483a', shade: '#8a3328', legs: '#3d3a36', hat: 'tall', hatColor: '#2a2620', belt: '#e2b84f' },
  // Griffin keepers: a tawny leather coat, a gold-feathered cap.
  falconer: { tunic: '#c9a34a', shade: '#9a7a32', legs: '#5e4630', hat: 'cap', hatColor: '#6e4a2f', belt: '#3a2a1c', apron: '#7a5a3a' },
  // Millers and granary hands: floury white, a white cap.
  miller: { tunic: '#e8e0c8', shade: '#c9c0a8', legs: '#c9c0a8', hat: 'coif', hatColor: '#f4f0e4', apron: '#f4f0e4' },
  // Fairground folk: motley in red and gold.
  entertainer: { tunic: '#b8483a', shade: '#8a3328', legs: '#e2b84f', hat: 'tall', hatColor: '#e2b84f', stripes: '#e2b84f' },
};

/** Who staffs each building, as seen walking about. */
export function jobOf(id: BuildingId): Job {
  switch (id) {
    case 'warehouse':
      return 'hauler';
    case 'foundry':
      return 'smith';
    case 'research':
      return 'scholar';
    case 'armory':
      return 'armourer';
    case 'docks':
      return 'docker';
    case 'gate':
      return 'gatekeeper';
    case 'guardhouse':
    case 'barracks':
      return 'soldier';
    case 'archery':
      return 'archer';
    case 'monastery':
      return 'monk';
    case 'chapel':
    case 'sanctum':
      return 'acolyte';
    case 'stables':
      return 'groom';
    case 'balloonWorks':
      return 'engineer';
    case 'griffinEyrie':
      return 'falconer';
    case 'granary':
      return 'miller';
    default:
      if ((FAIRGROUND_IDS as readonly string[]).includes(id)) return 'entertainer';
      if ((CHURCH_IDS as readonly string[]).includes(id)) return 'priest';
      if (id.startsWith('woodcutter')) return 'woodcutter';
      if (id.startsWith('fishery')) return 'fisher';
      if (id.startsWith('pasture')) return 'shepherd';
      if (id.startsWith('forge')) return 'smith';
      return 'hauler';
  }
}

export const JOBS = Object.keys(OUTFITS) as Job[];

/** Idle villagers round the campfire: plain tunics in a few colours, hair showing. */
export const IDLE_TUNICS = ['#7a5a3a', '#5d6e3a', '#8a6a4a', '#6a5a7a', '#7a4a3a'];
const shadeOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v * 0.75).toString(16).padStart(2, '0');
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
};
export const IDLE_OUTFITS: Outfit[] = IDLE_TUNICS.map((tunic, index) => ({
  tunic,
  shade: shadeOf(tunic),
  legs: index % 2 ? '#5e4630' : '#4a4038',
  hat: index === 2 ? 'straw' : index === 4 ? 'cap' : 'none',
  hatColor: index === 2 ? '#e2c470' : '#4f3a26',
  belt: '#3a2a1c',
}));

export type LookRect = { x: number; y: number; w: number; h: number; color: string };

/**
 * A villager in an outfit, as rects relative to the feet (x right, y up negative), facing right: about
 * 4 units wide and 10 tall. Drawn back to front.
 */
export function outfitRects(o: Outfit): LookRect[] {
  const r: LookRect[] = [];
  const rect = (x: number, y: number, w: number, h: number, color: string) => r.push({ x, y, w, h, color });
  // Tools carried behind the body.
  if (o.tool === 'axe') {
    rect(-2.6, -7.2, 0.5, 4.6, WOOD);
    rect(-3.3, -7.4, 1.0, 1.3, STEEL);
  }
  if (o.tool === 'spear') {
    rect(2.3, -11.5, 0.45, 11.3, WOOD);
    rect(2.15, -12.4, 0.75, 1.1, STEEL);
  }
  if (o.tool === 'crook') {
    rect(2.3, -10.6, 0.45, 10.4, WOOD);
    rect(2.3, -11.2, 1.4, 0.5, WOOD);
    rect(3.25, -11.2, 0.45, 1.3, WOOD);
  }
  if (o.tool === 'pick') {
    rect(-2.6, -8.4, 0.45, 6.0, WOOD);
    rect(-3.7, -8.8, 2.6, 0.6, '#868b94');
  }
  if (o.tool === 'net') {
    rect(-2.9, -8.0, 1.3, 4.5, '#bfae84');
    rect(-2.9, -6.6, 1.3, 0.3, '#8a7a56');
    rect(-2.9, -5.2, 1.3, 0.3, '#8a7a56');
  }
  // Legs and shoes (a robe covers the legs).
  if (!o.robe) {
    rect(-1.5, -2.6, 1.15, 2.2, o.legs);
    rect(0.35, -2.6, 1.15, 2.2, shadeOf(o.legs));
  }
  rect(-1.7, -0.5, 1.4, 0.5, SHOES);
  rect(0.3, -0.5, 1.4, 0.5, SHOES);
  // Body: lit left two thirds, shaded right; a robe falls to the shoes.
  const bottom = o.robe ? -0.5 : -2.4;
  rect(-1.8, -6.6, 3.6, 6.6 + bottom, o.tunic);
  rect(0.7, -6.6, 1.1, 6.6 + bottom, o.shade);
  if (o.robe) rect(-2.0, -1.6, 4.0, 1.1, o.tunic);
  if (o.stripes) for (const y of [-5.9, -4.7, -3.5]) rect(-1.8, y, 3.6, 0.5, o.stripes);
  if (o.apron) rect(-1.1, -5.6, 2.4, o.robe ? 4.6 : 3.4, o.apron);
  if (o.badge) {
    rect(-0.2, -5.8, 0.6, 2.2, o.badge);
    rect(-0.8, -5.1, 1.8, 0.6, o.badge);
  }
  if (o.belt) rect(-1.8, -3.6, 3.6, 0.5, o.belt);
  // Arms: sleeves (or bare), hands.
  const arm = o.bareArms ? SKIN : o.shade;
  rect(-2.3, -6.3, 0.6, 2.6, o.bareArms ? SKIN_SHADE : o.tunic);
  rect(1.7, -6.3, 0.6, 2.6, arm);
  rect(-2.3, -3.7, 0.6, 0.6, SKIN);
  rect(1.7, -3.7, 0.6, 0.6, SKIN);
  // Hand tools, held in front.
  if (o.tool === 'book') {
    rect(1.8, -4.6, 1.3, 1.5, '#7a2e26');
    rect(2.0, -4.4, 0.9, 0.3, '#e2b84f');
  }
  if (o.tool === 'tongs') {
    rect(2.0, -3.4, 0.35, 2.6, '#3d4148');
    rect(2.5, -3.4, 0.35, 2.4, '#3d4148');
    rect(1.9, -1.0, 1.1, 0.6, '#f08a3a');
  }
  if (o.tool === 'whip') {
    rect(2.0, -4.6, 0.35, 1.6, '#3a2a1c');
    rect(2.3, -5.4, 1.4, 0.3, '#3a2a1c');
  }
  if (o.tool === 'bell') {
    rect(2.0, -3.0, 0.3, 0.6, WOOD);
    rect(1.8, -2.5, 0.8, 0.8, '#e2b84f');
  }
  // Head: face, its shaded side, an eye looking right, hair.
  rect(-1.2, -9.0, 2.4, 2.5, SKIN);
  rect(0.6, -9.0, 0.6, 2.5, SKIN_SHADE);
  rect(0.35, -8.3, 0.4, 0.45, '#2a2620');
  const hat = o.hatColor ?? HAIR;
  switch (o.hat) {
    case 'none':
      rect(-1.3, -9.4, 2.6, 0.8, HAIR);
      rect(-1.3, -8.8, 0.6, 1.4, HAIR);
      break;
    case 'cap':
      rect(-1.4, -9.8, 2.8, 1.1, hat);
      rect(1.2, -9.0, 1.0, 0.4, hat);
      rect(-1.3, -8.8, 0.5, 1.0, HAIR);
      break;
    case 'brim':
      rect(-1.1, -10.6, 2.2, 1.5, hat);
      rect(-2.4, -9.2, 4.8, 0.6, hat);
      rect(-1.1, -9.4, 2.2, 0.3, '#2a2620');
      break;
    case 'straw':
      rect(-0.9, -10.3, 1.8, 1.2, hat);
      rect(-2.2, -9.2, 4.4, 0.55, hat);
      rect(-0.9, -9.4, 1.8, 0.3, '#b8483a');
      break;
    case 'hood':
      rect(-1.6, -9.9, 3.0, 1.2, hat);
      rect(-1.6, -9.0, 1.1, 2.6, hat);
      rect(-1.9, -7.0, 3.6, 0.7, hat);
      break;
    case 'helmet':
      rect(-1.4, -10.0, 2.8, 1.4, STEEL);
      rect(-1.6, -8.8, 3.2, 0.4, '#868b94');
      rect(-0.9, -9.8, 0.6, 0.5, '#f4f6f8');
      break;
    case 'scarf':
      rect(-1.4, -9.7, 2.8, 1.0, hat);
      rect(-2.0, -9.2, 0.7, 1.3, hat);
      break;
    case 'coif':
      rect(-1.5, -9.8, 3.0, 1.1, hat);
      rect(-1.5, -9.0, 0.9, 2.4, hat);
      break;
    case 'tall':
      rect(-1.1, -11.6, 2.2, 2.6, hat);
      rect(-1.8, -9.2, 3.6, 0.5, hat);
      break;
  }
  return r;
}
