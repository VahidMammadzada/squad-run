import { UPGRADE_IDS, type UpgradeId } from '../club/balance';
import { migratedFans } from '../club/fans';
import { maxLevel } from '../club/upgrades';
import { DEFAULT_KIT, KITS } from '../data/kits';

/** Bump when the shape changes, and teach sanitizeSave to read the old shape. */
export const SAVE_VERSION = 2;

export interface SaveData {
    version: number;
    level: number;
    coins: number;
    /** The club's progress number and the score sent to YouTube. Only goes up. */
    fans: number;
    /** Most goals scored in a single level (display only since v2). */
    bestScore: number;
    unlockedKits: string[];
    selectedKit: string;
    /** Training upgrade levels. */
    upgrades: Record<UpgradeId, number>;
    /** Merch coins waiting to be collected in the club. */
    merchPending: number;
}

function noUpgrades(): Record<UpgradeId, number> {
    return Object.fromEntries(UPGRADE_IDS.map((id) => [id, 0])) as Record<UpgradeId, number>;
}

export function defaultSave(): SaveData {
    return {
        version: SAVE_VERSION,
        level: 1,
        coins: 0,
        fans: 0,
        bestScore: 0,
        unlockedKits: [DEFAULT_KIT],
        selectedKit: DEFAULT_KIT,
        upgrades: noUpgrades(),
        merchPending: 0
    };
}

function wholeNumber(value: unknown, min: number, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.floor(value)) : fallback;
}

/**
 * Turns whatever came back from cloud save (nothing, an old version, or
 * garbage) into valid SaveData. Must never throw.
 */
export function sanitizeSave(raw: unknown): SaveData {
    const save = defaultSave();
    if (typeof raw !== 'object' || raw === null) {
        return save;
    }
    const r = raw as Record<string, unknown>;

    save.level = wholeNumber(r.level, 1, save.level);
    save.coins = wholeNumber(r.coins, 0, save.coins);
    save.bestScore = wholeNumber(r.bestScore, 0, save.bestScore);

    if (Array.isArray(r.unlockedKits)) {
        const known = new Set(KITS.map((k) => k.id));
        const ids = r.unlockedKits.filter((id): id is string => typeof id === 'string' && known.has(id));
        save.unlockedKits = [...new Set([DEFAULT_KIT, ...ids])];
    }
    if (typeof r.selectedKit === 'string' && save.unlockedKits.includes(r.selectedKit)) {
        save.selectedKit = r.selectedKit;
    }

    // v1 saves have no fans: start veterans off in proportion to their progress.
    save.fans = wholeNumber(r.fans, 0, migratedFans(save.level));
    save.merchPending = wholeNumber(r.merchPending, 0, 0);
    if (typeof r.upgrades === 'object' && r.upgrades !== null) {
        const u = r.upgrades as Record<string, unknown>;
        for (const id of UPGRADE_IDS) {
            save.upgrades[id] = Math.min(maxLevel(id), wholeNumber(u[id], 0, 0));
        }
    }
    return save;
}
