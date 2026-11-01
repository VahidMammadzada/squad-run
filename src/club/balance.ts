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
