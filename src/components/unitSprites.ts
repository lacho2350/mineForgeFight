// Pixel sprites for every creature, 12 × 12, facing right. Each character is a palette colour
// ('.' is transparent). Skia-free so any screen can import it.
import type { UnitId } from '../game/units';

export const SPRITE_SIZE = 12;

const BASE: Record<string, string> = {
  k: '#2a2620', // boots, outlines
  s: '#e0b48a', // skin
  m: '#c9ccd1', // steel
  w: '#8c6a3c', // wood
  y: '#e2b84f', // gold
  e: '#ece6d4', // white cloth
  o: '#7a5a3a', // leather, robes
};

type Sprite = { rows: string[]; palette: Record<string, string>; lift?: number };

export const SPRITES: Record<UnitId, Sprite> = {
  pikeman: {
    palette: { b: '#3f5f9a' },
    rows: [
      '..........m.',
      '..........m.',
      '...mm.....w.',
      '..mmmm....w.',
      '...ss.....w.',
      '..bbbb...sw.',
      '.bbbbbbb..w.',
      '.bbbbb....w.',
      '..bbbb....w.',
      '..bb.bb...w.',
      '..k...k.....',
      '.kk...kk....',
    ],
  },
  bowman: {
    palette: { g: '#4f7a3a', l: '#e8e0c8' },
    rows: [
      '............',
      '...gg.......',
      '..gggg..w...',
      '...ss..w.l..',
      '..gggg.w.l..',
      '.ggggggw.l..',
      '.ggggg.w.l..',
      '..gggg..w...',
      '..gggg......',
      '..gg.gg.....',
      '..k...k.....',
      '.kk...kk....',
    ],
  },
  swordsman: {
    palette: { r: '#9a3b32', h: '#c9a34a' },
    rows: [
      '............',
      '...mm....m..',
      '..mmmm...m..',
      '...ss....m..',
      '.hrrrr..sm..',
      'hhrrrrrr....',
      'hhrrrr......',
      '.hrrrr......',
      '..rrrr......',
      '..rr.rr.....',
      '..k...k.....',
      '.kk...kk....',
    ],
  },
  monk: {
    palette: { y: '#ffe08a' },
    rows: [
      '........y...',
      '...oo...w...',
      '..oooo..w...',
      '...ss...w...',
      '..oooo.sw...',
      '.oooooo.w...',
      '.oooooo.w...',
      '.oooooo.w...',
      '.oooooo.w...',
      '.oooooo.w...',
      '..oooo..w...',
      '.kk..kk.....',
    ],
  },
  balloon: {
    palette: { r: '#b8483a' },
    lift: 3,
    rows: [
      '...rerer....',
      '..rererer...',
      '.rererere...',
      '.rererere...',
      '..rerere....',
      '...rere.....',
      '....k.k.....',
      '....k.k.....',
      '...wwww.....',
      '...wwww.....',
      '............',
      '............',
    ],
  },
  cavalry: {
    palette: { h: '#7a5232', b: '#3f5f9a' },
    rows: [
      '....mm.....m',
      '....mm....m.',
      '...bbb...m..',
      '...bbbb.m...',
      '...bbbbm.hh.',
      '..hhhhhhhhh.',
      '.hhhhhhhhh..',
      'h.hhhhhhh...',
      '..h.....h...',
      '..h.....h...',
      '..k.....k...',
      '............',
    ],
  },
  griffin: {
    palette: { y: '#c9a34a', b: '#e08a3a' },
    rows: [
      '............',
      '..ee........',
      '.eeee...ee..',
      'eeeeee.eeeb.',
      '.eeeeeyyee..',
      '..eyyyyyy...',
      '...yyyyyyy..',
      '...yyyyyyy..',
      '...y.y..y.y.',
      '...k.k..k.k.',
      '............',
      '............',
    ],
  },
  paladin: {
    palette: { r: '#b8483a' },
    rows: [
      '....r.......',
      '...mmm...m..',
      '...mmm...m..',
      '...ss....m..',
      '..eyye..sm..',
      '.meeeeem.m..',
      '.meeeeem....',
      '..eyyye.....',
      '..eeeee.....',
      '..mm.mm.....',
      '..mm.mm.....',
      '.kk...kk....',
    ],
  },
  angel: {
    palette: { l: '#cfe0f5' },
    rows: [
      '....yyy.....',
      '.l..ss...l..',
      'll..ss..ll..',
      'lll.ee.lll..',
      'llleeeeelll.',
      '.lleeeeell..',
      '..eeeeee..m.',
      '..eeeeeesm..',
      '..eeeeee....',
      '...eeee.....',
      '...e..e.....',
      '..ss..ss....',
    ],
  },
  goblin: {
    palette: { g: '#6d8f3a' },
    rows: [
      '............',
      '............',
      '............',
      '....gg......',
      '...gggg..w..',
      '....gg..w...',
      '...oooogw...',
      '..oooooo....',
      '...oooo.....',
      '...g..g.....',
      '..gg..gg....',
      '............',
    ],
  },
  wolfRider: {
    palette: { g: '#6d8f3a', a: '#6f6f72' },
    rows: [
      '............',
      '............',
      '.....gg.....',
      '....gggg....',
      '.....oo.w...',
      '....oooow...',
      '.a..aaaaaaa.',
      'aaaaaaaaaaaa',
      '..aaaaaaa.ak',
      '..a.a..a.a..',
      '..k.k..k.k..',
      '............',
    ],
  },
  orcArcher: {
    palette: { g: '#5a7a32' },
    rows: [
      '............',
      '....gg......',
      '...gggg..w..',
      '...gggg...w.',
      '..oooo.g..w.',
      '.oooooo...w.',
      '.oooooo..w..',
      '..oooo......',
      '..oooo......',
      '..oo.oo.....',
      '..k...k.....',
      '.kk...kk....',
    ],
  },
  harpy: {
    palette: {},
    lift: 2,
    rows: [
      '............',
      '............',
      'oo.......oo.',
      'ooo..ss..oo.',
      'oooo.ss.ooo.',
      '.oooossoooo.',
      '..ooossooo..',
      '....ssss....',
      '....s..s....',
      '....k..k....',
      '............',
      '............',
    ],
  },
  ogre: {
    palette: { n: '#9a8a5a' },
    rows: [
      '....nnn.....',
      '...nnnnn....',
      '...nnnnn..w.',
      '..nnnnnnn.ww',
      '.nnnnnnnnnww',
      '.nnnnnnnn.w.',
      '.nnoooonn...',
      '..oooooo....',
      '..nnnnnn....',
      '..nnn.nnn...',
      '..nn...nn...',
      '.kkk...kkk..',
    ],
  },
  cyclops: {
    palette: { p: '#b08a6a', a: '#8e8f84' },
    rows: [
      '....pppp....',
      '...ppekpp...',
      '...pppppp.aa',
      '..pppppppaaa',
      '.pppppppp.aa',
      '.ppoooopp...',
      '..oooooo....',
      '..pppppp....',
      '..ppp.ppp...',
      '..pp...pp...',
      '..pp...pp...',
      '.kkk...kkk..',
    ],
  },
  behemoth: {
    palette: { v: '#6a4a5a' },
    rows: [
      '............',
      '.......e..e.',
      '.......vv.vv',
      '..vvvvvvvvv.',
      '.vvvvvvvvekv',
      'vvvvvvvvvvvv',
      'vvvvvvvvvvee',
      '.vvvvvvvvvv.',
      '.vv.vvvv.vv.',
      '.vv.vv.v.vv.',
      '.ee.ee...ee.',
      '............',
    ],
  },
};

/** The sprite as a list of coloured pixels (x, y in sprite pixels). */
export function spritePixels(unit: UnitId) {
  const sprite = SPRITES[unit];
  const palette = { ...BASE, ...sprite.palette };
  const pixels: { x: number; y: number; color: string }[] = [];
  sprite.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (color) pixels.push({ x, y: y - (sprite.lift ?? 0), color });
    }
  });
  return pixels;
}
