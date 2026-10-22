// How hard the game is: chosen when a new game starts and fixed for that game. Normal is the game as it
// was designed; every other setting scales the same knobs — the raids (when, how strong, what a lost one
// takes), what the hold starts with, what building costs, what the peasants eat, how much the bad things
// weigh on their mood and how fast they leave, the campaign's armies, and how far the surveyors see.
// Hardcore, unlocked by winning the campaign on Nightmare, is Nightmare with one life: the hold can fall
// (a lost siege with the army gone, three lost sieges in a row, or everyone gone), and the game ends there.
// Import-free data.

export const DIFFICULTIES = ['easy', 'normal', 'hard', 'nightmare', 'hardcore'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const isDifficulty = (value: unknown): value is Difficulty => (DIFFICULTIES as readonly unknown[]).includes(value);
export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

export type DifficultyRules = {
  name: string;
  blurb: string;
  /** Seconds into the game when the first raiders arrive. */
  firstRaidAt: number;
  /** Seconds between one raid and the next. */
  raidInterval: number;
  /** Raids' strength, times Normal's. */
  raidStrength: number;
  /** Share of every stockpile and the gold a lost siege takes (half that in the field). */
  plunder: number;
  /** Gold at the start. */
  startGold: number;
  /** Food, wood and coal at the start, times Normal's. */
  startStock: number;
  /** Buildings, tunnels, techs and going deeper, times Normal's price. */
  cost: number;
  /** Food each peasant eats, times Normal's. */
  food: number;
  /** Every bad thing for the mood (hunger, taxes, homes run dry, a siege, a lost battle), times Normal's. */
  moodPenalty: number;
  /** At happiness 0, a peasant leaves every this many seconds. */
  leaveSeconds: number;
  /** The keep's household: this many never leave (and drifters refill it). 0: the hold can empty. */
  leaveFloor: number;
  /** The campaign's armies, times Normal's. */
  campaign: number;
  /** Raids ease off after a losing streak (as on Normal). */
  streakRelief: boolean;
  /** Tiles added to (or taken from) the surveyors' reach. */
  surveyReach: number;
  /** One life: the hold can fall, and the game ends there. */
  oneLife: boolean;
};

export const DIFFICULTY: Record<Difficulty, DifficultyRules> = {
  easy: {
    name: 'Easy',
    blurb: 'Fewer, weaker raids that take less; more to start with, cheaper building, a forgiving mood.',
    firstRaidAt: 600,
    raidInterval: 420,
    raidStrength: 0.7,
    plunder: 0.2,
    startGold: 1500,
    startStock: 1.5,
    cost: 0.8,
    food: 0.8,
    moodPenalty: 0.7,
    leaveSeconds: 45,
    leaveFloor: 4,
    campaign: 0.85,
    streakRelief: true,
    surveyReach: 0,
    oneLife: false,
  },
  normal: {
    name: 'Normal',
    blurb: 'The game as it was meant to be played.',
    firstRaidAt: 360,
    raidInterval: 300,
    raidStrength: 1,
    plunder: 0.3,
    startGold: 1000,
    startStock: 1,
    cost: 1,
    food: 1,
    moodPenalty: 1,
    leaveSeconds: 30,
    leaveFloor: 4,
    campaign: 1,
    streakRelief: true,
    surveyReach: 0,
    oneLife: false,
  },
  hard: {
    name: 'Hard',
    blurb: 'Raids come sooner, stronger and take more; building costs more and the peasants eat more.',
    firstRaidAt: 300,
    raidInterval: 240,
    raidStrength: 1.3,
    plunder: 0.4,
    startGold: 700,
    startStock: 0.75,
    cost: 1.2,
    food: 1.2,
    moodPenalty: 1.25,
    leaveSeconds: 20,
    leaveFloor: 4,
    campaign: 1.15,
    streakRelief: true,
    surveyReach: 0,
    oneLife: false,
  },
  nightmare: {
    name: 'Nightmare',
    blurb: 'A raid every three minutes that takes half of everything, no let-up after a losing streak, a darker mine.',
    firstRaidAt: 240,
    raidInterval: 180,
    raidStrength: 1.7,
    plunder: 0.5,
    startGold: 500,
    startStock: 0.5,
    cost: 1.4,
    food: 1.4,
    moodPenalty: 1.5,
    leaveSeconds: 15,
    leaveFloor: 4,
    campaign: 1.3,
    streakRelief: false,
    surveyReach: -1,
    oneLife: false,
  },
  hardcore: {
    name: 'Hardcore',
    blurb: 'Nightmare with one life: the hold can fall, a lost campaign battle can’t be fought again, and the game ends there.',
    firstRaidAt: 240,
    raidInterval: 180,
    raidStrength: 1.7,
    plunder: 0.5,
    startGold: 500,
    startStock: 0.5,
    cost: 1.4,
    food: 1.4,
    moodPenalty: 1.5,
    leaveSeconds: 15,
    leaveFloor: 0,
    campaign: 1.3,
    streakRelief: false,
    surveyReach: -1,
    oneLife: true,
  },
};

/** A difficulty's colour on screen: calm to angry, Hardcore blood red. */
export const DIFFICULTY_TONE: Record<Difficulty, string> = { easy: '#9fd27a', normal: '#d6bb79', hard: '#e5a565', nightmare: '#e0705a', hardcore: '#ff4d3d' };

/** The rules of a game's difficulty (Normal for a game from before difficulties). */
export const rulesOf = (difficulty: Difficulty | undefined) => DIFFICULTY[difficulty ?? DEFAULT_DIFFICULTY];

/** Lost sieges in a row that bring a one-life hold down. */
export const SIEGES_TO_FALL = 3;

/** How a one-life hold fell (Hardcore): the game is over. */
export type Fallen = { reason: string; at: number; raidsFought: number; campaignWon: number };
