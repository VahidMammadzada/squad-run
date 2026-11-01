import { DEFAULT_KIT, KITS } from '../data/kits';

/** Bump when the shape changes, and teach sanitizeSave to read the old shape. */
export const SAVE_VERSION = 1;

export interface SaveData {
    version: number;
    level: number;
    coins: number;
    /** Most goals scored in a single level. */
    bestScore: number;
    unlockedKits: string[];
    selectedKit: string;
}

export function defaultSave(): SaveData {
    return {
        version: SAVE_VERSION,
        level: 1,
        coins: 0,
        bestScore: 0,
        unlockedKits: [DEFAULT_KIT],
        selectedKit: DEFAULT_KIT
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
    return save;
}
