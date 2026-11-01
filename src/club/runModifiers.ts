import { MAGNET_BONUS, type UpgradeId } from './balance';

export interface RunModifiers {
    startSquadBonus: number;
    /** Added to players per goal (negative is easier); the floor is applied in scoring. */
    perGoalDelta: number;
    coinReachMult: number;
    /** Fan Club level; fansForLevel turns it into the bonus. */
    fanClubLevel: number;
}

/** The only view of the club the runner gets. */
export function runModifiers(save: { upgrades: Readonly<Record<UpgradeId, number>> }): RunModifiers {
    const u = save.upgrades;
    return {
        startSquadBonus: u.youth,
        perGoalDelta: -u.finishing,
        coinReachMult: 1 + MAGNET_BONUS * u.magnet,
        fanClubLevel: u.fanclub
    };
}
