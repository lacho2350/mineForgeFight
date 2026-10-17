import { SPRITES, SPRITE_SIZE, spritePixels, spriteRuns } from '../src/components/unitSprites';
import { IDLE_OUTFITS, JOBS, OUTFITS, jobOf, outfitRects } from '../src/components/stronghold/villagerLooks';
import { ARMY_UNITS, ENEMY_UNITS } from '../src/game/units';

describe('unit sprites', () => {
  it('are a full square grid for every unit, every pixel a palette colour', () => {
    for (const unit of [...ARMY_UNITS, ...ENEMY_UNITS]) {
      const { rows } = SPRITES[unit];
      expect(rows).toHaveLength(SPRITE_SIZE);
      for (const row of rows) expect(row).toHaveLength(SPRITE_SIZE);
      const pixels = spritePixels(unit);
      const filled = rows.join('').replace(/\./g, '').length;
      // A character outside the palette would be dropped silently.
      expect(pixels).toHaveLength(filled);
    }
  });

  it('draw as runs covering the same pixels, mirrored or not', () => {
    for (const unit of [...ARMY_UNITS, ...ENEMY_UNITS]) {
      const count = spritePixels(unit).length;
      for (const mirror of [false, true]) {
        const runs = spriteRuns(unit, mirror);
        expect(runs.reduce((sum, run) => sum + run.w, 0)).toBe(count);
        expect(runs.length).toBeLessThan(count);
      }
    }
  });
});

describe('villager outfits', () => {
  it('stay inside their sprite-sheet cell (8 wide, 14 tall, feet at 4, 13)', () => {
    for (const outfit of [...IDLE_OUTFITS, ...JOBS.map((job) => OUTFITS[job])]) {
      for (const r of outfitRects(outfit)) {
        expect(r.x).toBeGreaterThanOrEqual(-4);
        expect(r.x + r.w).toBeLessThanOrEqual(4);
        expect(r.y).toBeGreaterThanOrEqual(-13);
        expect(r.y + r.h).toBeLessThanOrEqual(0);
      }
    }
  });

  it('dress each building’s staff for its work', () => {
    expect(jobOf('foundry')).toBe('smith');
    expect(jobOf('forge3')).toBe('smith');
    expect(jobOf('woodcutter2')).toBe('woodcutter');
    expect(jobOf('fishery1')).toBe('fisher');
    expect(jobOf('pasture4')).toBe('shepherd');
    expect(jobOf('monastery')).toBe('monk');
    expect(jobOf('church1')).toBe('priest');
    expect(jobOf('fairground2')).toBe('entertainer');
    expect(jobOf('docks')).toBe('docker');
  });
});
