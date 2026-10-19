import { DEFAULT_SPOTS, type Placements } from '../src/game/cityMap';
import { HOUSE_IDS } from '../src/game/houses';
import { iso, pickBuilding, tapHeight, tapTargets } from '../src/components/GameSceneLayout';

// A street of cottages beside the starting buildings, nothing in front of them.
const placements: Placements = { ...DEFAULT_SPOTS };
const levels: Partial<Record<string, number>> = { keep: 6, houses: 1, warehouse: 8, foundry: 12, guardhouse: 3 };
HOUSE_IDS.slice(1, 7).forEach((id, i) => {
  placements[id] = { x: 20 + i, y: 40 };
  levels[id] = 1 + i * 3;
});

describe('tapping a building', () => {
  it('picks the building drawn under the finger, not a neighbour whose box reaches over it', () => {
    let right = 0;
    let wrong = 0;
    for (const { id, plot } of tapTargets(placements)) {
      const level = levels[id];
      if (id === 'wall' || id === 'moat' || level === undefined) continue;
      const tall = tapHeight(plot, level);
      // Its walls, its roof and its front base.
      for (const [fx, fy, fz] of [[0.5, 0.5, 0.35], [0.5, 0.5, 0.8], [0.6, 0.95, 0.05]]) {
        const point = iso(plot.x + plot.w * fx, plot.y + plot.d * fy, tall * fz);
        if (pickBuilding(placements, levels as never, point.x, point.y) === id) right += 1;
        else wrong += 1;
      }
    }
    // Every cottage in the street and every starting building, from every angle but where something really stands in front.
    expect(wrong).toBeLessThanOrEqual(1);
    expect(right).toBeGreaterThan(30);
  });

  it('gives the ground to taps on open ground, and an empty sky to nobody', () => {
    const open = iso(10, 30, 0);
    expect(pickBuilding(placements, levels as never, open.x, open.y)).toBeNull();
    // High above a cottage, where nothing is drawn.
    const plot = { ...placements.houses2!, w: 1, d: 1 };
    const sky = iso(plot.x + 0.5, plot.y + 0.5, 200);
    expect(pickBuilding(placements, levels as never, sky.x, sky.y)).toBeNull();
  });
});
