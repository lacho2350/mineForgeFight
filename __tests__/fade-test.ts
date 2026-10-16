import { fadedBuildings, plotDepth, plotOf, watch } from '../src/components/GameSceneLayout';
import { game, newGame } from './support';

describe('see-through buildings', () => {
  it('fades what stands in front of the tapped building, never the building itself or the fortifications', () => {
    newGame();
    const { buildings, placements } = game();
    const warehouse = plotOf('warehouse', placements);
    const foundry = plotOf('foundry', placements);
    expect(warehouse && foundry).toBeTruthy();
    // On a new game the foundry stands just in front of the warehouse's yard.
    expect(plotDepth(foundry!)).toBeGreaterThan(plotDepth(warehouse!));
    const faded = fadedBuildings(buildings, placements, [watch(warehouse!, 'warehouse')]);
    expect(faded).toContain('foundry');
    expect(faded).not.toContain('warehouse');
    expect(faded).not.toContain('wall');
    expect(faded).not.toContain('towers');
    expect(faded).not.toContain('keep'); // behind it
  });

  it('fades nothing with nothing watched, and nothing that is not built', () => {
    newGame();
    const { buildings, placements } = game();
    expect(fadedBuildings(buildings, placements, [])).toEqual([]);
    const keep = plotOf('keep', placements)!;
    const faded = fadedBuildings({ ...buildings, foundry: 0, warehouse: 0 }, placements, [watch(keep, 'keep')]);
    expect(faded).not.toContain('foundry');
    expect(faded).not.toContain('warehouse');
  });
});
