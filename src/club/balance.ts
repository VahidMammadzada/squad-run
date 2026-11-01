// Every club number in one place, so the economy test and tuning touch one file.

export type UpgradeId = 'youth' | 'finishing' | 'magnet' | 'fanclub';

export interface UpgradeDef {
    id: UpgradeId;
    name: string;
    /** What one level does, shown in the Training booth. */
    effect: string;
    /** Price of each level; the length is the max level. */
    prices: readonly number[];
}

export const UPGRADES: readonly UpgradeDef[] = [
    { id: 'youth', name: 'Youth Academy', effect: '+1 starting player', prices: [60, 120, 220, 380, 600] },
    { id: 'magnet', name: 'Coin Magnet', effect: '+10% coin reach', prices: [80, 200, 400] },
    { id: 'fanclub', name: 'Fan Club', effect: '+10% fans', prices: [120, 280, 550, 950, 1600] },
    { id: 'finishing', name: 'Finishing', effect: '-1 player per goal', prices: [200, 500, 1000] }
];

export const UPGRADE_IDS: readonly UpgradeId[] = UPGRADES.map((u) => u.id);

/** Fans earned per goal, before the Fan Club bonus. */
export const FANS_PER_GOAL = 10;
export const FAN_CLUB_BONUS = 0.1;
export const MAGNET_BONUS = 0.1;
/** Finishing can never bring players per goal below this. */
export const MIN_PLAYERS_PER_GOAL = 2;

/** Merch income per completed level: a share of fans, with a floor. */
export const MERCH_RATE = 0.04;
export const MERCH_MIN = 5;
/** Uncollected merch stops growing after this many levels' worth. */
export const MERCH_CAP_LEVELS = 10;
/** The rewarded "collect ×2" is only offered for at least this much: an ad for a few coins feels cheap. */
export const MERCH_DOUBLE_MIN = 20;

/** Existing (v1) players start with this many fans per level already beaten. */
export const MIGRATED_FANS_PER_LEVEL = 20;

/** Share of stand seats filled: grows with fans on a log scale. */
export const CROWD_MIN = 0.35;
export const CROWD_PER_DECADE = 0.15;

// --- Star players (M2) ---

export type SkillId = 'shield' | 'sharpshooter' | 'rally' | 'magnet' | 'showman';

export interface SkillDef {
    id: SkillId;
    name: string;
    /** Full-strength effect, shown on cards. */
    effect: string;
}

export const SKILLS: readonly SkillDef[] = [
    { id: 'shield', name: 'Shield', effect: 'Ignores the first defender hit' },
    { id: 'sharpshooter', name: 'Sharpshooter', effect: '-1 player per goal' },
    { id: 'rally', name: 'Rally', effect: '+3 starting players' },
    { id: 'magnet', name: 'Magnet', effect: '+30% coin reach' },
    { id: 'showman', name: 'Showman', effect: '+50% fans' }
];

export const SKILL_IDS: readonly SkillId[] = SKILLS.map((s) => s.id);

export const MAX_ROSTER = 5;
export const MAX_POPULARITY = 5;
/** Fans bonus per popularity point while the star plays. */
export const POPULARITY_FAN_BONUS = 0.1;
/** Signing price by popularity (index 1..5). */
export const STAR_PRICES = [0, 100, 400, 800, 1400, 2200] as const;
/** Fans the club needs before it can sign a star of this popularity (hard gate). */
export const STAR_FAN_GATES = [0, 0, 0, 0, 800, 2000] as const;
export const RELEASE_REFUND = 0.5;

export const TRANSFER_SIZE = 3;
/** A fresh transfer list arrives every this many levels. */
export const TRANSFER_REFRESH_LEVELS = 5;

export const FITNESS_MAX = 100;
/** Fitness the active star loses per run, and benched stars regain. */
export const FITNESS_DRAIN = 15;
export const FITNESS_RECOVER = 20;
/** Below this the star's skill is half as strong. */
export const TIRED_BELOW = 50;

export const INJURY_CHANCE = 0.3;
export const INJURY_RUNS = 3;
export const HEAL_PRICE = 120;
export const REST_PRICE = 40;

// Skill strengths: [full, tired].
export const RALLY_SQUAD = [3, 1] as const;
export const MAGNET_REACH = [0.3, 0.15] as const;
export const SHOWMAN_FANS = [0.5, 0.25] as const;
export const SHARPSHOOTER_DELTA = [-1, 0] as const;

/** Made-up name parts; combinations are random, never real players. */
export const FIRST_NAMES = [
    'Rico', 'Tavo', 'Kemi', 'Jory', 'Nilo', 'Bastu', 'Femi', 'Lazo', 'Ottie', 'Remy', 'Sandi', 'Vito',
    'Ziggy', 'Amari', 'Dario', 'Ezra', 'Gino', 'Ikki', 'Juno', 'Kofi', 'Luca', 'Mika', 'Nuno', 'Pepe'
];
export const LAST_NAMES = [
    'Varga', 'Bolt', 'Pimenta', 'Okoro', 'Lindqvist', 'Marlo', 'Quade', 'Rossetti', 'Sorba', 'Tamsin',
    'Ulloa', 'Vekko', 'Wendt', 'Yarrow', 'Zabo', 'Brisk', 'Corvo', 'Dunmore', 'Falco', 'Gallo'
];
/** Star hair colours on the pitch. */
export const HAIR_COLORS = [0x3e2723, 0x1a1a1a, 0xf2c94c, 0xd35400, 0x8e5a2b, 0xeeeeee, 0x2f6fed, 0xe91e63];
/** Stars wear gold socks so they stand out from their mates. */
export const STAR_SOCKS = 0xffd21f;
