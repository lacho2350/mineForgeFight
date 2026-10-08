import { raidFloor, raidKind, raidParty, raidRelief, raidShare, raidStrength } from '../src/game/raids';

describe('raid sizing', () => {
  it('has a small floor that stops growing at 400', () => {
    expect(raidFloor(1)).toBe(150);
    expect(raidFloor(26)).toBe(400);
    expect(raidFloor(300)).toBe(400);
  });

  it('never brings more than 90% of the hold’s power', () => {
    expect(raidShare(1)).toBe(0.5);
    expect(raidShare(1000)).toBe(0.9);
    expect(raidStrength(500, 10_000)).toBe(9000);
  });

  it('comes smaller after raids lost in a row, down to 40%', () => {
    expect(raidRelief(0)).toBe(1);
    expect(raidRelief(1)).toBe(0.75);
    expect(raidRelief(10)).toBe(0.4);
    expect(raidStrength(30, 0, 1)).toBe(300);
  });
});

describe('raid kinds', () => {
  it('starts with two raiding parties, then about half each', () => {
    expect(raidKind(1)).toBe('field');
    expect(raidKind(2)).toBe('field');
    const sieges = Array.from({ length: 100 }, (_, i) => raidKind(i + 3)).filter((kind) => kind === 'siege').length;
    expect(sieges).toBeGreaterThan(30);
    expect(sieges).toBeLessThan(70);
  });

  it('brings wall-breakers only with a siege army', () => {
    for (let n = 5; n <= 60; n++) {
      const field = raidParty(n, 3000, 'field').map((stack) => stack.unit);
      expect(field).not.toContain('ogre');
      expect(field).not.toContain('cyclops');
    }
    expect(raidParty(40, 3000, 'siege').map((stack) => stack.unit)).toContain('ogre');
  });
});
