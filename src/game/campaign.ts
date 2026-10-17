// The campaign: the end game. Once the hold has raised its first angel, the lands the Horde took lie open on
// a map: twelve battle sites on the road back south from the High Pass to Aldmere, fought one after another
// in the open field (the hex engine, like a raid met in the field), each harder than the last, the last
// against the Red Hand's warlord in his court. Winning it ends the story (the victory epilogue); the hold
// plays on. Pure TS.
import { raidParty, type RaidParty } from './raids';
import type { Army } from './units';
import { armyValue } from './units';

/** Battle sites on the road to Aldmere. */
export const CAMPAIGN_BATTLES = 12;
/** A campaign battle waits this long for the player's command before the captains fight it (longer than a raid: the player chose the moment). */
export const RAID_AUTO_AFTER_CAMPAIGN = 60;

export type CampaignStage = {
  /** The site's name, and where it lies. */
  title: string;
  place: string;
  /** What's told of it before the battle. */
  text: string;
  icon: string;
  /** Where it sits on the map (0…1 across, 0…1 down; the road runs from the bottom up). */
  x: number;
  y: number;
};

export const CAMPAIGN_STAGES: readonly CampaignStage[] = [
  { title: 'The High Pass', place: 'the pass above Greyhollow', icon: '🏔️', x: 0.5, y: 0.95, text: 'The Horde keeps a watch on the pass: goblins round a fire, wolf riders in the snow. They never thought the valley would come up to meet them. Clear the pass and the road south is open.' },
  { title: 'Wolfrun Ford', place: 'the ford of the Greywater', icon: '🌊', x: 0.26, y: 0.86, text: 'The only crossing for a day in either direction. Wolf riders hold the far bank and orc archers the shallows; the water slows everyone but them.' },
  { title: 'The Burnt Mill', place: 'the Greywater valley', icon: '🔥', x: 0.68, y: 0.78, text: 'A village the Horde burned on their way north, its mill still smoking a year on. The raiders camped in the ruins are the ones who did it.' },
  { title: 'Thornback Woods', place: 'the forest road', icon: '🌲', x: 0.34, y: 0.69, text: 'Harpies nest in the dead oaks and strike from above. The road through the woods is narrow and the trees are full of eyes.' },
  { title: 'Saltmarsh Causeway', place: 'the marches', icon: '🌫️', x: 0.7, y: 0.6, text: 'A raised road over the fens, wide enough for a cart. Ogres have torn up the far end and wait on the dry ground beyond, with a war band at their backs.' },
  { title: 'Hollin Bridge', place: 'the river Hollin', icon: '🌉', x: 0.3, y: 0.52, text: 'The stone bridge the kings built. The Horde has made a fort of its gatehouse; cyclopes stand on the span and hurl boulders at anything that nears the water.' },
  { title: 'The Ash Fields', place: 'the outskirts of Harrowfield', icon: '🌾', x: 0.64, y: 0.44, text: 'The fields where the levies of Aldmere were cut down as they ran. The Horde lets nothing grow here. A great war band musters on the ash.' },
  { title: 'Harrowfield', place: 'where the line broke', icon: '⚔️', x: 0.4, y: 0.36, text: 'Here the realm was lost. The king’s banner still leans over the ford where he fell. The Horde will fight for this ground as if it were theirs — and the men of Aldmere will fight as if it were still ours.' },
  { title: 'The Iron Road', place: 'the old king’s highway', icon: '🛣️', x: 0.68, y: 0.28, text: 'The paved road to the capital, and the Horde’s supply line north. Ogre-drawn wagons, behemoths loosed from their chains, and the warlord’s own riders.' },
  { title: 'Kingsmoor', place: 'the moor before the capital', icon: '🏕️', x: 0.36, y: 0.2, text: 'The Horde’s great camp under the walls of Aldmere: tents to the horizon, pens of wolves, the fires of a hundred bands. Beat them here and the city is bared.' },
  { title: 'The Walls of Aldmere', place: 'the capital', icon: '🏰', x: 0.62, y: 0.12, text: 'The city that burned for nine days. Its walls stand, and the Horde holds them. Cyclopes on the towers, behemoths at the breach — everything the Red Hand has left.' },
  { title: 'The Red Hand’s Court', place: 'the throne hall of Aldmere', icon: '👑', x: 0.5, y: 0.04, text: 'The warlord of the Red Hand sits in the king’s hall with his bodyguard of behemoths and his champions about him. There is no one left to send. Finish it.' },
];

export type Campaign = {
  /** The first angel has been raised: the map is open. */
  unlocked: boolean;
  /** The army's worth (creature value) when the campaign opened: what the battles are sized to. */
  scale: number;
  /** Sites won so far: the next battle is `won + 1`. */
  won: number;
  /** Campaign battles fought, won or lost. */
  fought: number;
  /** The last site is won: the story is over (the hold plays on). */
  victory: boolean;
  /** The victory epilogue has been read. */
  victorySeen: boolean;
};

export const emptyCampaign = (): Campaign => ({ unlocked: false, scale: 0, won: 0, fought: 0, victory: false, victorySeen: false });

/** A saved campaign cleaned up (missing or damaged fields get their defaults). */
export function cleanCampaign(saved: Partial<Campaign> | undefined): Campaign {
  const fresh = emptyCampaign();
  if (!saved || typeof saved !== 'object') return fresh;
  const number = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback);
  const won = Math.min(CAMPAIGN_BATTLES, number(saved.won, 0));
  return {
    unlocked: saved.unlocked === true,
    scale: number(saved.scale, 0),
    won,
    fought: Math.max(won, number(saved.fought, 0)),
    victory: saved.victory === true || won >= CAMPAIGN_BATTLES,
    victorySeen: saved.victorySeen === true,
  };
}

/** Whoever has an angel can march: the campaign opens the moment the first one is raised. */
export const campaignOpens = (army: Army) => army.angel > 0;

/** The smallest an army can be and still be worth campaigning with (one angel's worth): what the sizing starts from at least. */
export const CAMPAIGN_MIN_SCALE = 5500;

/** The share of the army's worth (at unlock) the Horde fields at each site: 60% at the pass, 200% at the court. */
export const campaignShare = (stage: number) => 0.6 + ((Math.min(CAMPAIGN_BATTLES, Math.max(1, stage)) - 1) * 1.4) / (CAMPAIGN_BATTLES - 1);

/** A floor under each site, so a small army still meets a real war band: 3,000 at the pass, 25,000 at the court. */
export const campaignFloor = (stage: number) => 3000 + ((Math.min(CAMPAIGN_BATTLES, Math.max(1, stage)) - 1) * 22000) / (CAMPAIGN_BATTLES - 1);

/** The strength (total creature value) the Horde fields at site `stage` of a campaign sized to `scale`. */
export function campaignStrength(stage: number, scale: number) {
  return Math.round(Math.max(campaignFloor(stage), Math.max(CAMPAIGN_MIN_SCALE, scale) * campaignShare(stage)));
}

// Who stands at each site: the raid roster (`raidParty`, every kind of raider — ogres and cyclopes march with
// an army, siege or not), drawn as for raid 1 + 2 × stage, so the stronger raiders join as the road goes on:
// goblins, wolf riders and archers at the pass, harpies and ogres from the second site, cyclopes from the
// fourth, behemoths from the fifth, and more companies the further south.
const stageRoster = (stage: number) => 1 + stage * 2;

/** The Horde's force at site `stage`, for a campaign of this `scale`. */
export function campaignParty(stage: number, scale: number): RaidParty {
  const strength = campaignStrength(stage, scale);
  const party = raidParty(stageRoster(stage), strength, 'siege');
  if (stage < CAMPAIGN_BATTLES) return party;
  // The warlord's court: his bodyguard of behemoths always stands there.
  const behemoths = party.find((stack) => stack.unit === 'behemoth');
  return behemoths ? party : [...party, { unit: 'behemoth', count: Math.max(2, Math.round(strength / 1700 / 6)) }];
}

/** Gold for a site won: half the force's worth (more than a raid's bounty — the Horde's camps are rich). */
export const campaignBounty = (strength: number) => Math.round(strength * 0.5);

/** The next site to fight (1-based), or null once the court has fallen. */
export const nextStage = (campaign: Campaign) => (campaign.victory || campaign.won >= CAMPAIGN_BATTLES ? null : campaign.won + 1);

/** The campaign as it opens, sized to the army of the day. */
export function openCampaign(campaign: Campaign, army: Army): Campaign {
  return { ...campaign, unlocked: true, scale: Math.max(CAMPAIGN_MIN_SCALE, Math.round(armyValue(army))) };
}

/** The campaign after site `stage` was fought: a win opens the next site (the last one wins the war). */
export function afterCampaignBattle(campaign: Campaign, stage: number, won: boolean): Campaign {
  const next = { ...campaign, fought: campaign.fought + 1 };
  if (!won || stage !== campaign.won + 1) return next;
  next.won = stage;
  if (stage >= CAMPAIGN_BATTLES) next.victory = true;
  return next;
}

/** Why a campaign battle can't start now, or null if it can. */
export function campaignBlocker(state: { campaign: Campaign; army: Army; battle: { status: string } | null; raid: unknown }): string | null {
  if (!state.campaign.unlocked) return 'The campaign opens when the hold raises its first angel.';
  if (nextStage(state.campaign) === null) return 'The war is won: the Red Hand is broken.';
  if (state.battle?.status === 'active') return 'A battle is being fought already.';
  if (state.raid && typeof state.raid === 'object' && 'arrivesAt' in state.raid) return 'Raiders are sighted: the army stays to meet them first.';
  if (armyValue(state.army) <= 0) return 'There is no army to march.';
  return null;
}
