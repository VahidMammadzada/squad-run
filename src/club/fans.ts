import { CROWD_MIN, CROWD_PER_DECADE, FAN_CLUB_BONUS, FANS_PER_GOAL, MIGRATED_FANS_PER_LEVEL } from './balance';

/** Fans a completed level earns. */
export function fansForLevel(goals: number, fanClubLevel: number): number {
    return Math.max(0, Math.floor(goals * FANS_PER_GOAL * (1 + FAN_CLUB_BONUS * fanClubLevel)));
}

/** Share of stand seats filled (0..1) for the 3D crowd. */
export function crowdFill(fans: number): number {
    return Math.min(1, Math.max(CROWD_MIN, CROWD_MIN + CROWD_PER_DECADE * Math.log10(Math.max(0, fans) + 1)));
}

/** Starting fans for a save from before fans existed, so veterans don't start at zero. */
export function migratedFans(level: number): number {
    return Math.max(0, (level - 1) * MIGRATED_FANS_PER_LEVEL);
}
