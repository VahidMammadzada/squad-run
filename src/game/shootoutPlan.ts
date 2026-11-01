import { goalsFor } from './scoring';

/** Long shootouts are batched so the sequence never drags on. */
export const MAX_SHOTS = 20;

export interface ShootoutPlan {
    goals: number;
    /** Goals each shot is worth; 0 means the keeper saves it. */
    worth: number[];
    /** Milliseconds between shots. */
    interval: number;
}

/**
 * Every `playersPerGoal` squad members score one goal; a squad too small to
 * score gets one shot that the keeper saves.
 */
export function planShootout(squadCount: number, level: number): ShootoutPlan {
    const goals = goalsFor(squadCount, level);
    const shots = goals === 0 ? 1 : Math.min(goals, MAX_SHOTS);
    const worth = Array.from({ length: shots }, (_, i) => Math.floor(goals / shots) + (i < goals % shots ? 1 : 0));
    return { goals, worth, interval: shots > 10 ? 220 : 380 };
}
