import { mergeSave, migrateSave } from '../src/game/saveMigration';
import { useGameStore } from '../src/game/gameStore';
import { game, newGame } from './support';

describe('the prologue', () => {
  it('opens a new game, once: read or skipped, it stays seen (until a new game)', () => {
    newGame();
    expect(game().prologueSeen).toBe(false);
    game().seePrologue();
    expect(game().prologueSeen).toBe(true);
    game().resetGame();
    expect(game().prologueSeen).toBe(false);
  });

  it('isn’t forced on a hold from before it (it’s in the menu), but a saved unread one still shows', () => {
    const fresh = useGameStore.getInitialState();
    expect(mergeSave(migrateSave({ elapsedSeconds: 5000 }, 4), fresh).prologueSeen).toBe(true);
    expect(mergeSave(migrateSave({ elapsedSeconds: 5, prologueSeen: false }, 5), fresh).prologueSeen).toBe(false);
  });
});
