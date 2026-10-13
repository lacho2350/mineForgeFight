import { buildingStats } from '../src/game/buildings';
import { game, newGame } from './support';

describe('the warehouse', () => {
  it('holds 300 of each resource at level 1, 30% more a level, and more with its techs', () => {
    newGame();
    const at = (level: number, techs: string[] = []) => buildingStats({ ...game().buildings, warehouse: level }, undefined, techs as never[]).warehouseCapacity;
    expect(at(1)).toBe(300);
    expect(at(2)).toBe(390);
    expect(at(1, ['shelving'])).toBe(380);
  });
});
