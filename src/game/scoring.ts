/** Squad members needed to beat the keeper once; the keeper gets better every few levels. */
export function playersPerGoal(level: number): number {
    return Math.min(4 + Math.floor((level - 1) / 3), 12);
}

export function goalsFor(squad: number, level: number): number {
    return Math.floor(squad / playersPerGoal(level));
}

export const COINS_PER_GOAL = 5;
/** The rewarded "×3 coins" offer on the level-complete screen. */
export const COIN_MULTIPLIER = 3;

/** Extra coins the multiplier adds on top of what the level already paid. */
export function multiplierBonus(earned: number): number {
    return Math.max(0, Math.floor(earned)) * (COIN_MULTIPLIER - 1);
}
