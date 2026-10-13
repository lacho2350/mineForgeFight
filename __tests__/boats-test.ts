import { BOAT_INFO, fishingBoat, nextBoat } from '../src/game/boats';

describe('fishing huts’ boats', () => {
  it('come at levels 5, 10, 15 and 20, each better than the last', () => {
    expect(fishingBoat(4)).toBeNull();
    expect(nextBoat(4)).toBe(1);
    expect([5, 9, 10, 14, 15, 19, 20].map(fishingBoat)).toEqual([1, 1, 2, 2, 3, 3, 4]);
    expect(nextBoat(12)).toBe(3);
    expect(nextBoat(20)).toBeNull();
    expect(BOAT_INFO[fishingBoat(20) ?? 1].name).toBe('Fishing ketch');
  });
});
