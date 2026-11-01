/** Squad size after a rewarded revive. */
export const REVIVE_SQUAD = 10;
/** Defenders this far ahead (pitch pixels) are knocked over on revive, so it can't instantly fail again. */
export const REVIVE_CLEAR_AHEAD = 500;
/** ...and this far behind, for one still overlapping the squad. */
const REVIVE_CLEAR_BEHIND = 60;

/** Indices of standing defenders to knock over when the squad revives at `dist`. */
export function defendersToClear(defenders: readonly { y: number }[], down: readonly boolean[], dist: number): number[] {
    const out: number[] = [];
    defenders.forEach((d, i) => {
        if (!down[i] && d.y >= dist - REVIVE_CLEAR_BEHIND && d.y <= dist + REVIVE_CLEAR_AHEAD) out.push(i);
    });
    return out;
}
