import {
    FAN_CLUB_BONUS,
    FAN_DRIVE_BONUS,
    MAGNET_BONUS,
    MAGNET_REACH,
    POPULARITY_FAN_BONUS,
    RALLY_SQUAD,
    SHARPSHOOTER_DELTA,
    SHOWMAN_FANS,
    STAR_SOCKS,
    type UpgradeId
} from './balance';
import { isActive, type Campaign } from './office';
import { isAvailable, isTired, type StarPlayer } from './stars';

export interface RunModifiers {
    startSquadBonus: number;
    /** Added to players per goal (negative is easier); the floor is applied in scoring. */
    perGoalDelta: number;
    coinReachMult: number;
    /** Multiplies fans earned (Fan Club, star popularity, Showman). */
    fanMult: number;
    /** Star Shield: the first defender hit is ignored ('full') or halved ('half'). */
    shield: 'full' | 'half' | null;
}

interface ClubState {
    upgrades: Readonly<Record<UpgradeId, number>>;
    roster?: readonly StarPlayer[];
    activeStar?: string | null;
    campaign?: Campaign | null;
}

/** The active star if they can play this run (signed and not injured). */
export function activeStar(save: ClubState): StarPlayer | null {
    const star = save.roster?.find((s) => s.id === save.activeStar);
    return star && isAvailable(star) ? star : null;
}

/** How the active star looks on the pitch. */
export function starLook(star: StarPlayer): { hair: number; socks: number } {
    return { hair: star.hair, socks: STAR_SOCKS };
}

/** The only view of the club the runner gets. */
export function runModifiers(save: ClubState): RunModifiers {
    const u = save.upgrades;
    const mods: RunModifiers = {
        startSquadBonus: u.youth,
        perGoalDelta: -u.finishing,
        coinReachMult: 1 + MAGNET_BONUS * u.magnet,
        fanMult: 1 + FAN_CLUB_BONUS * u.fanclub,
        shield: null
    };
    if (isActive(save.campaign ?? null, 'fanDrive')) mods.fanMult += FAN_DRIVE_BONUS;
    const star = activeStar(save);
    if (!star) return mods;

    const tier = isTired(star) ? 1 : 0;
    mods.fanMult += POPULARITY_FAN_BONUS * star.popularity;
    switch (star.skill) {
        case 'shield':
            mods.shield = tier === 0 ? 'full' : 'half';
            break;
        case 'sharpshooter':
            mods.perGoalDelta += SHARPSHOOTER_DELTA[tier];
            break;
        case 'rally':
            mods.startSquadBonus += RALLY_SQUAD[tier];
            break;
        case 'magnet':
            mods.coinReachMult += MAGNET_REACH[tier];
            break;
        case 'showman':
            mods.fanMult += SHOWMAN_FANS[tier];
            break;
    }
    return mods;
}
