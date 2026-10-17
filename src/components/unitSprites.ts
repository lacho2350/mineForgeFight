// Pixel sprites for every creature, 16 × 16, facing right, standing on the bottom row. Each character
// is a palette colour ('.' is transparent); every sprite is shaded (a darker tone for the far side and
// folds, a highlight on steel) and carries its unit's gear, so a company reads at a glance. Skia-free
// so any screen can import it.
import type { UnitId } from '../game/units';

export const SPRITE_SIZE = 16;

const BASE: Record<string, string> = {
  k: '#2a2620', // boots, outlines, eyes
  s: '#e0b48a', // skin
  t: '#b4865e', // skin in shadow
  m: '#c9ccd1', // steel
  d: '#868b94', // steel in shadow
  i: '#f4f6f8', // steel catching the light
  w: '#8c6a3c', // wood
  v: '#5e4630', // dark wood
  y: '#e2b84f', // gold
  z: '#a8842f', // gold in shadow
  e: '#ece6d4', // white cloth, feathers
  f: '#bdb6a2', // white in shadow
  o: '#7a5a3a', // leather, robes
  p: '#4f3a26', // dark leather
  h: '#4a3220', // hair
};

type Sprite = { rows: string[]; palette: Record<string, string>; lift?: number };

export const SPRITES: Record<UnitId, Sprite> = {
  // A pikeman: kettle hat, blue tabard with a gold cross, steel greaves, a long pike held upright.
  pikeman: {
    palette: { a: '#3f5f9a', b: '#2c4473' },
    rows: [
      '............i...',
      '...........imd..',
      '.....mmi....m...',
      '....dmmmmd..w...',
      '.....ssk....w...',
      '.....tss....w...',
      '....aaaaaabsw...',
      '...aaayaaa..w...',
      '...baayaab..w...',
      '...bayyyab..w...',
      '...baayaab..w...',
      '...ooooyoo..w...',
      '....bbbbb...w...',
      '....dd.dd...w...',
      '....dd.dd...v...',
      '...kkk.kkk......',
    ],
  },
  // A crossbowman: green hood, leather jerkin, a quiver of bolts on the back, the crossbow levelled.
  bowman: {
    palette: { a: '#4f7a3a', b: '#3a5c2a' },
    rows: [
      '................',
      '....aaa.........',
      '...aaaab........',
      '..eaassk........',
      '..eabtss........',
      '..oaaaab....d...',
      '..oaaoaabs..m...',
      '..oaaooabwwwmw..',
      '..oaaoaa....m...',
      '..paaaaa....d...',
      '...ooyoo........',
      '...aaaaa........',
      '...ab.ba........',
      '...pp.pp........',
      '...pp.pp........',
      '..kkk.kkk.......',
    ],
  },
  // A swordsman: great helm with its eye slit, red surcoat, a gold heater shield with a red cross, sword up.
  swordsman: {
    palette: { a: '#9a3b32', b: '#6e2822' },
    rows: [
      '...........i....',
      '...........m....',
      '.....mmmi..m....',
      '....dmmmmd.m....',
      '....dmmkkd.m....',
      '.....dmmd..m....',
      '.zzzzzaaa.yyy...',
      '.zyayzaaaasw....',
      '.zaaazbaaa......',
      '.zyayzbaaa......',
      '..zyz.oyoo......',
      '...z..aaaa......',
      '......abba......',
      '......dd.dd.....',
      '......dd.dd.....',
      '.....kkk.kkk....',
    ],
  },
  // A monk: brown habit and hood, a rope girdle, a staff crowned with a healing light.
  monk: {
    palette: { c: '#ffe08a' },
    rows: [
      '..........c.....',
      '.........cyc....',
      '.....ooo..w.....',
      '....ooooo.w.....',
      '....opssk.w.....',
      '....oopt..w.....',
      '...oooooosw.....',
      '...pooooo.w.....',
      '...peeeee.w.....',
      '...pooooo.w.....',
      '...poooeo.w.....',
      '...pooooo.w.....',
      '..ppooooo.w.....',
      '..ppooooo.w.....',
      '..ppppppp.v.....',
      '...kk..kk.......',
    ],
  },
  // A war balloon: a striped envelope with a gold band, ropes down to a wicker gondola, its bomb dropping.
  balloon: {
    palette: { a: '#b8483a', b: '#8a3328' },
    lift: 2,
    rows: [
      '.....aeaea......',
      '...aaeaeaeaa....',
      '..baeaeaeaeab...',
      '..baeaeaeaeab...',
      '..baeaeaeaeab...',
      '...baeaeaeab....',
      '....bbyyybb.....',
      '.....k...k......',
      '.....k.s.k......',
      '....wvwvwvw.....',
      '....vwvwvwv.....',
      '.....vvvvv......',
      '.......k........',
      '................',
      '................',
      '................',
    ],
  },
  // A cavalier: helm and blue surcoat on a brown charger with a gold saddle cloth, lance and pennant.
  cavalry: {
    palette: { a: '#3f5f9a', b: '#2c4473', c: '#b8483a', h: '#7a5232', g: '#5a3a24' },
    rows: [
      '...............i',
      '......m.......m.',
      '.....mmi.....wcc',
      '.....dsk....w...',
      '....aaaa...w....',
      '....abaaass..hh.',
      '...hhyaayhh.hhhg',
      '..hhhhaahhhhhhkg',
      '.ghhhhkhhhhhg...',
      'g.hhhhhhhhhg....',
      'g.hhhhhhhhh.....',
      '..hg.....hg.....',
      '..h.g...h.g.....',
      '..h.g...h.g.....',
      '..h.g...h.g.....',
      '..k.k...k.k.....',
    ],
  },
  // A griffin: an eagle's white head and orange beak, raised wings, a lion's tawny body and tail.
  griffin: {
    palette: { a: '#c9a34a', b: '#9a7a32', c: '#e08a3a' },
    lift: 1,
    rows: [
      '................',
      '....e...........',
      '...eef..........',
      '..eeffe....ee...',
      '..efffee..eeeec.',
      '...effeeeeekecc.',
      '....efeeeeeee...',
      '.....eeaaaaee...',
      'b....aaaaaaaa...',
      '.b..aaaaaaaaab..',
      '..baaabaaaaab...',
      '....aab..aab....',
      '....ab...ab.....',
      '....ab...ab.....',
      '...cc...cc......',
      '................',
    ],
  },
  // A paladin: plumed helm, white surcoat with a gold sun, plate at the arms and legs, a broadsword.
  paladin: {
    palette: { c: '#b8483a' },
    rows: [
      '....cc.....i....',
      '.....c.....m....',
      '....mmmi...m....',
      '...dmmmmd..m....',
      '...dmmkkd..m....',
      '....dmmd..yyy...',
      '..mmeeeemm.w....',
      '..deeyeedmsw....',
      '..deyyyee.......',
      '..dmeyeem.......',
      '...eeeeee.......',
      '...yyyyyy.......',
      '...eeffee.......',
      '...mm..mm.......',
      '...dd..dd.......',
      '..kkk..kkk......',
    ],
  },
  // An angel: golden halo and hair, great pale wings, a white robe, a shining sword.
  angel: {
    palette: { l: '#cfe0f5', n: '#9fb8d8', h: '#e2b84f' },
    rows: [
      '.....yyy........',
      '....y...y.......',
      '.l...hhh....l...',
      'll..hssk...ll...',
      'lll..tss..lll...',
      'nlll.ee..llln...',
      'nllleeeeellln...',
      '.nlleeeeelln.i..',
      '..nleeeeeln.m...',
      '...eeeeeeesm....',
      '...eeeffee......',
      '...eeeeeee......',
      '...eeffeee......',
      '...eeeeeee......',
      '....s...s.......',
      '...ss...ss......',
    ],
  },
  // A goblin: big ears, a leather jerkin, a crude club.
  goblin: {
    palette: { g: '#6d8f3a', j: '#4f6a2a' },
    rows: [
      '................',
      '................',
      '................',
      '................',
      '..j.ggg.j.......',
      '..jggggkgj..v...',
      '....gggg...vw...',
      '.....gg...vw....',
      '...ooooogvw.....',
      '..opooooo.......',
      '...opooo........',
      '...ppppp........',
      '....g..g........',
      '....g..g........',
      '...jg..gj.......',
      '...kk..kk.......',
    ],
  },
  // A wolf rider: a goblin with a spear on a grey wolf, teeth bared.
  wolfRider: {
    palette: { g: '#6d8f3a', j: '#4f6a2a', a: '#7a7a7e', b: '#55555a' },
    rows: [
      '................',
      '..........m.....',
      '.....ggg..w.....',
      '....jggkg.w.....',
      '.....gg..w......',
      '....ooooow......',
      '....opoog.......',
      '.b..aaaaaaa..aa.',
      'bba.aaaaaaaaaaka',
      '.bbaaaaaaaaaaaaa',
      '...baaaaaaaaab.e',
      '...ba.ba..ba.b..',
      '...b..b...b..b..',
      '...b..b...b..b..',
      '...b..b...b..b..',
      '...k..k...k..k..',
    ],
  },
  // An orc archer: tusks, a dark hide jerkin, a short recurve bow drawn.
  orcArcher: {
    palette: { g: '#5a7a32', j: '#3f5a22' },
    rows: [
      '................',
      '................',
      '....ggg.........',
      '...ggggg....w...',
      '...gggkg.....w..',
      '...jggeg.....w..',
      '...pppp.e....w..',
      '..pppppgggggew..',
      '..ppoppp.....w..',
      '..ppoppp.....w..',
      '...pppp.....w...',
      '...oyoo.........',
      '...jjjj.........',
      '...jj.jj........',
      '...jj.jj........',
      '..kkk.kkk.......',
    ],
  },
  // A harpy: a hag's face and wild hair, ragged brown wings, talons.
  harpy: {
    palette: { a: '#6a4e36', b: '#4a3424' },
    lift: 2,
    rows: [
      '................',
      '................',
      'aa.....hh.....aa',
      'aab...hssh...baa',
      '.aab..hsk...baa.',
      '.aaab.hss..baaa.',
      '..aaabbssbbaaa..',
      '...aaabsstbaa...',
      '....bbsssbb.....',
      '......ssst......',
      '......sttt......',
      '......s..t......',
      '.....kk..kk.....',
      '................',
      '................',
      '................',
    ],
  },
  // An ogre: a hulking tan brute in a loincloth, swinging a spiked club.
  ogre: {
    palette: { n: '#9a8a5a', q: '#76683f' },
    rows: [
      '...........m.m..',
      '....nnn....vwv..',
      '...nnnnn...vwv..',
      '...nnkkn....w...',
      '...nnnnn....w...',
      '..nnnnnnnn..w...',
      '.nnnnnnnnnnsw...',
      '.nqnnnnnnq......',
      '.nq.nnnnnq......',
      '.ss.nnnnn.......',
      '....ooooo.......',
      '....opopo.......',
      '...nnn.nnn......',
      '...nq...nq......',
      '...nq...nq......',
      '..kkk...kkk.....',
    ],
  },
  // A cyclops: one great eye, a hide wrap, a boulder raised to throw.
  cyclops: {
    palette: { n: '#b08a6a', q: '#8a6a4e', a: '#8e8f84', b: '#6c6d63' },
    rows: [
      '...........aa...',
      '....nnnn..aaab..',
      '...nneknn.aabb..',
      '...nnnnnn..bb...',
      '...nnnnnn...s...',
      '..nnnnnnnn.ns...',
      '.nnnnnnnnnnn....',
      '.nqnnnnnnq......',
      '.nqoooooo.......',
      '.nqopooop.......',
      '..ooopoooo......',
      '...nnn.nnn......',
      '...nnq.nnq......',
      '...nnq.nnq......',
      '...nnq.nnq......',
      '..kkkk.kkkk.....',
    ],
  },
  // A behemoth: a horned purple beast on four thick legs, ridged back, tusks and claws.
  behemoth: {
    palette: { a: '#6a4a5a', b: '#4e3442', c: '#8a6478' },
    rows: [
      '................',
      '................',
      '...........e..e.',
      '....c.c.c..ee.ee',
      '...cacacac.aaaa.',
      '..aaaaaaaaaaakaa',
      '.aaaaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaee',
      'baaaaaaaaaaaaae.',
      'bbaaaaaaaaaaab..',
      '.bbaaabbaaaabb..',
      '.bba.bb..abb....',
      '.bb..bb..bb.....',
      '.bb..bb..bb.....',
      '.bb..bb..bb.....',
      '.ee..ee..ee.....',
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

/**
 * The sprite as runs of same-coloured pixels along each row (x, y, w in sprite pixels), so it draws as a
 * few dozen rects instead of one per pixel. `mirror` flips it to face left.
 */
export function spriteRuns(unit: UnitId, mirror = false) {
  const sprite = SPRITES[unit];
  const palette = { ...BASE, ...sprite.palette };
  const runs: { x: number; y: number; w: number; color: string }[] = [];
  sprite.rows.forEach((source, y) => {
    const row = mirror ? [...source].reverse().join('') : source;
    for (let x = 0; x < row.length; ) {
      const color = palette[row[x]];
      let end = x + 1;
      while (end < row.length && row[end] === row[x]) end++;
      if (color) runs.push({ x, y: y - (sprite.lift ?? 0), w: end - x, color });
      x = end;
    }
  });
  return runs;
}
