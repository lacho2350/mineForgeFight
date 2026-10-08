import { createBattle, resolveBattle } from '../src/game/combat';
import { emptyArmy } from '../src/game/units';

const defences = {
  raid: 20,
  enemies: [{ unit: 'goblin' as const, count: 10 }],
  wallHp: 200,
  gateHp: 150,
  towers: 4,
  towerDamage: 20,
  attackBonus: 0,
  defenceBonus: 0,
  traps: { spikes: 3, pitch: 2, snare: 1 },
  trapPower: 1,
  wallOil: 10,
  moatDamage: 20,
};
const army = { ...emptyArmy(), pikeman: 20, bowman: 10 };

describe('battles', () => {
  it('fights a siege with the walls, gate, towers, oil, moat and traps', () => {
    const battle = createBattle({ ...defences, army });
    expect(battle.kind).toBe('siege');
    expect(battle.walls.length).toBeGreaterThan(0);
    expect(battle.towers).toBe(4);
    expect(battle.moat).toBe(20);
    expect(battle.wallOil).toBe(10);
    expect(battle.trapKills ?? 0).toBeGreaterThan(0);
  });

  it('fights a field battle with troops only', () => {
    const battle = createBattle({ ...defences, army, kind: 'field' });
    expect(battle.kind).toBe('field');
    expect(battle.walls).toHaveLength(0);
    expect(battle.towers).toBe(0);
    expect(battle.moat).toBe(0);
    expect(battle.wallOil).toBe(0);
    expect(battle.trapKills ?? 0).toBe(0);
  });

  it('comes out the same every time (seeded by the raid)', () => {
    const a = resolveBattle(createBattle({ ...defences, army, kind: 'field' }));
    const b = resolveBattle(createBattle({ ...defences, army, kind: 'field' }));
    expect(a.status).toBe(b.status);
    expect(a.stacks.map((stack) => stack.hp)).toEqual(b.stacks.map((stack) => stack.hp));
  });

  it('is won by a decent army against a few goblins', () => {
    expect(resolveBattle(createBattle({ ...defences, army, kind: 'field' })).status).toBe('won');
  });

  it('is lost at once with nobody to fight it', () => {
    expect(createBattle({ ...defences, army: emptyArmy(), kind: 'field' }).status).toBe('lost');
  });
});
