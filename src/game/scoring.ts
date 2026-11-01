import { MIN_PLAYERS_PER_GOAL } from '../club/balance';

/**
 * Squad members needed to beat the keeper once; the keeper gets better every
 * few levels. `delta` comes from club upgrades (negative is easier).
 */
export function playersPerGoal(level: number, delta = 0): number {
    return Math.max(MIN_PLAYERS_PER_GOAL, Math.min(4 + Math.floor((level - 1) / 4), 10) + delta);
}

export function goalsFor(squad: number, level: number, delta = 0): number {
    return Math.floor(squad / playersPerGoal(level, delta));
}

export const COINS_PER_GOAL = 5;

/** The rewarded "×3 coins" offer on the level-complete screen. */
export const COIN_MULTIPLIER = 3;

/** Extra coins the multiplier adds on top of what the level already paid. */
export function multiplierBonus(earned: number): number {
    return Math.max(0, Math.floor(earned)) * (COIN_MULTIPLIER - 1);
}
