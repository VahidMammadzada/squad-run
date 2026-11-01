/** Squad members needed to beat the keeper once; the keeper gets better every few levels. */
export function playersPerGoal(level: number): number {
    return Math.min(4 + Math.floor((level - 1) / 3), 12);
}

export function goalsFor(squad: number, level: number): number {
    return Math.floor(squad / playersPerGoal(level));
}

export const COINS_PER_GOAL = 5;
