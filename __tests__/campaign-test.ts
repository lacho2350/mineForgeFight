import { CAMPAIGN_BATTLES, CAMPAIGN_MIN_SCALE, CAMPAIGN_STAGES, campaignBlocker, campaignParty, campaignStrength, cleanCampaign, emptyCampaign, nextStage } from '../src/game/campaign';
import { mergeSave, migrateSave } from '../src/game/saveMigration';
import { useGameStore } from '../src/game/gameStore';
import { partyValue } from '../src/game/raids';
import { armyValue, emptyArmy } from '../src/game/units';
import { game, newGame, run } from './support';

// A hold with an angel (and little else), and one that could take on anything.
const angelArmy = { ...emptyArmy(), angel: 1, pikeman: 12 };
const mightyArmy = { ...emptyArmy(), angel: 60, paladin: 40, griffin: 40 };

describe('the campaign', () => {
  it('opens the moment the hold has an angel, sized to the army of the day', () => {
    newGame({ army: { ...emptyArmy(), paladin: 3 } });
    run(2);
    expect(game().campaign.unlocked).toBe(false);
    newGame({ army: angelArmy });
    run(1);
    const { campaign } = game();
    expect(campaign.unlocked).toBe(true);
    expect(campaign.scale).toBe(Math.max(CAMPAIGN_MIN_SCALE, Math.round(armyValue(angelArmy))));
    expect(nextStage(campaign)).toBe(1);
    expect(game().notice).toMatch(/road to Aldmere/);
  });

  it('has twelve sites, each stronger than the last, the Horde’s best only later on', () => {
    expect(CAMPAIGN_STAGES).toHaveLength(CAMPAIGN_BATTLES);
    const scale = 20000;
    for (let stage = 2; stage <= CAMPAIGN_BATTLES; stage++) expect(campaignStrength(stage, scale)).toBeGreaterThan(campaignStrength(stage - 1, scale));
    // Sized to the army: the pass is well under its worth, the court well over it.
    expect(campaignStrength(1, scale)).toBeLessThan(scale);
    expect(campaignStrength(CAMPAIGN_BATTLES, scale)).toBeGreaterThan(scale * 1.5);
    // A tiny army still meets a real war band.
    expect(campaignStrength(1, 100)).toBeGreaterThanOrEqual(3000);
    // The parties come out about their strength, no behemoths at the pass, always behemoths at the court.
    const first = campaignParty(1, scale);
    expect(first.some(({ unit }) => unit === 'behemoth')).toBe(false);
    expect(partyValue(first)).toBeGreaterThan(campaignStrength(1, scale) * 0.6);
    const last = campaignParty(CAMPAIGN_BATTLES, scale);
    expect(last.some(({ unit }) => unit === 'behemoth')).toBe(true);
  });

  it('won’t march before it opens, during a battle, or with raiders sighted', () => {
    newGame();
    expect(campaignBlocker(game())).toMatch(/first angel/);
    game().startCampaignBattle();
    expect(game().battle).toBeNull();
    newGame({ army: angelArmy });
    run(1);
    expect(campaignBlocker(game())).toBeNull();
    expect(campaignBlocker({ ...game(), raid: { number: 1, arrivesAt: 100, party: [], kind: 'field' } })).toMatch(/Raiders are sighted/);
  });

  it('fights the next site in the field; a win pays and opens the next, the raid clock untouched', () => {
    // Opened by a modest army (so the sites are sized small), then fought by a mighty one.
    newGame({ army: angelArmy, gold: 100 });
    run(1);
    useGameStore.setState({ army: mightyArmy });
    const before = game();
    game().startCampaignBattle();
    const { battle } = game();
    expect(battle).not.toBeNull();
    if (!battle) return;
    expect(battle.campaign).toBe(1);
    expect(battle.kind).toBe('field');
    expect(battle.walls).toHaveLength(0);
    expect(battle.towers).toBe(0);
    expect(game().battleCommanded).toBe(false);
    // The captains fight it (quick resolve), and the might of sixty angels wins.
    game().quickResolveBattle();
    const after = game();
    expect(after.battle?.status).toBe('won');
    expect(after.campaign.won).toBe(1);
    expect(after.campaign.fought).toBe(1);
    expect(nextStage(after.campaign)).toBe(2);
    expect(after.gold).toBeGreaterThan(100);
    expect(after.raidReport?.campaign).toBe(1);
    expect(after.raidReport?.outcome).toBe('won');
    expect(after.raidReport?.plundered).toBeNull();
    // Not a raid: the raid count, the losing streak and the next raid's time are as they were.
    expect(after.raidsFought).toBe(before.raidsFought);
    expect(after.nextRaidAt).toBe(before.nextRaidAt);
    expect(after.raid).toBeNull();
    expect(after.notice).toMatch(/The High Pass is won/);
    // Another march is only the next site, not the same one again.
    game().closeBattle();
    game().startCampaignBattle();
    expect(game().battle?.campaign).toBe(2);
  });

  it('losing costs the army but nothing in the hold, and the site stays to be fought again', () => {
    newGame({ army: angelArmy, gold: 500 });
    run(1);
    // The angel has gone (say): a single pikeman marches on the pass.
    useGameStore.setState({ army: { ...emptyArmy(), pikeman: 1 } });
    const warehouse = { ...game().warehouse };
    game().startCampaignBattle();
    expect(game().battle?.campaign).toBe(1);
    game().quickResolveBattle();
    const after = game();
    expect(after.battle?.status).toBe('lost');
    expect(after.army.pikeman).toBe(0);
    expect(after.campaign.won).toBe(0);
    expect(after.campaign.fought).toBe(1);
    expect(after.gold).toBe(500);
    expect(after.warehouse).toEqual(warehouse);
    expect(after.raidReport?.plundered).toBeNull();
    expect(nextStage(after.campaign)).toBe(1);
  });

  it('wins the war at the twelfth site, and the epilogue is shown once', () => {
    newGame({ army: angelArmy, gold: 0 });
    run(1);
    useGameStore.setState({ army: { ...emptyArmy(), angel: 400 } });
    for (let stage = 1; stage <= CAMPAIGN_BATTLES; stage++) {
      game().startCampaignBattle();
      expect(game().battle?.campaign).toBe(stage);
      game().quickResolveBattle();
      expect(game().battle?.status).toBe('won');
      game().closeBattle();
    }
    const { campaign, notice } = game();
    expect(campaign.won).toBe(CAMPAIGN_BATTLES);
    expect(campaign.victory).toBe(true);
    expect(campaign.victorySeen).toBe(false);
    expect(nextStage(campaign)).toBeNull();
    expect(notice).toMatch(/Red Hand is broken/);
    expect(campaignBlocker(game())).toMatch(/war is won/);
    game().seeVictory();
    expect(game().campaign.victorySeen).toBe(true);
  });

  it('is kept in the save, and older saves start with it closed', () => {
    const fresh = useGameStore.getInitialState();
    expect(mergeSave(migrateSave({ elapsedSeconds: 900 }, 6), fresh).campaign).toEqual(emptyCampaign());
    const kept = mergeSave(migrateSave({ elapsedSeconds: 900, campaign: { unlocked: true, scale: 12000, won: 3, fought: 5, victory: false, victorySeen: false } }, 6), fresh).campaign;
    expect(kept.won).toBe(3);
    expect(kept.scale).toBe(12000);
    // Damaged values fall back sensibly.
    expect(cleanCampaign({ won: 99, fought: -1 } as never)).toEqual({ ...emptyCampaign(), won: CAMPAIGN_BATTLES, fought: CAMPAIGN_BATTLES, victory: true });
  });
});
