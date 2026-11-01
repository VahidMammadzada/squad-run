import { CROWD_MIN, CROWD_PER_DECADE, FANS_PER_GOAL, MIGRATED_FANS_PER_LEVEL } from './balance';

/** Fans a completed level earns; `fanMult` comes from runModifiers. */
export function fansForLevel(goals: number, fanMult = 1): number {
    // Rounded first so 1.1 × 30 doesn't become 32.999... → 32.
    return Math.max(0, Math.floor(Math.round(goals * FANS_PER_GOAL * fanMult * 1000) / 1000));
}

/** Share of stand seats filled (0..1) for the 3D crowd. */
export function crowdFill(fans: number): number {
    return Math.min(1, Math.max(CROWD_MIN, CROWD_MIN + CROWD_PER_DECADE * Math.log10(Math.max(0, fans) + 1)));
}

/** Starting fans for a save from before fans existed, so veterans don't start at zero. */
export function migratedFans(level: number): number {
    return Math.max(0, (level - 1) * MIGRATED_FANS_PER_LEVEL);
}
