import {
    CAMPAIGN_IDS,
    FITNESS_MAX,
    HAIR_COLORS,
    MAX_POPULARITY,
    MAX_ROSTER,
    MAX_STADIUM_TIER,
    SKILL_IDS,
    TRANSFER_SIZE,
    UPGRADE_IDS,
    type CampaignId,
    type SkillId,
    type UpgradeId
} from '../club/balance';
import { migratedFans } from '../club/fans';
import type { Campaign } from '../club/office';
import type { StarPlayer } from '../club/stars';
import { maxLevel } from '../club/upgrades';
import { defaultManager, sanitizeManager, type ManagerState } from '../club/wardrobe';
import { DEFAULT_KIT, KITS } from '../data/kits';

/** Bump when the shape changes, and teach sanitizeSave to read the old shape. */
export const SAVE_VERSION = 5;

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
    /** Signed star players (max 5). */
    roster: StarPlayer[];
    /** Id of the star leading the squad, or null for the default leader. */
    activeStar: string | null;
    /** The scout's current list; null means generate a fresh one. */
    transfer: TransferList | null;
    /** Seed for the next generated transfer list. */
    scoutSeed: number;
    /** Stadium tier 1-5: merch bonus and a bigger 3D stadium. */
    stadiumTier: number;
    /** Running marketing campaign, if any. */
    campaign: Campaign | null;
    /** The manager's look and bought wardrobe items. */
    manager: ManagerState;
}

export interface TransferList {
    refreshedAtLevel: number;
    candidates: StarPlayer[];
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
        merchPending: 0,
        roster: [],
        activeStar: null,
        transfer: null,
        scoutSeed: 1,
        stadiumTier: 1,
        campaign: null,
        manager: defaultManager()
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

    // v3: star players. Older saves have none, so these fall back to defaults.
    save.roster = sanitizeStars(r.roster, MAX_ROSTER);
    save.activeStar = typeof r.activeStar === 'string' && save.roster.some((p) => p.id === r.activeStar) ? r.activeStar : null;
    save.scoutSeed = wholeNumber(r.scoutSeed, 1, save.scoutSeed);
    if (typeof r.transfer === 'object' && r.transfer !== null) {
        const t = r.transfer as Record<string, unknown>;
        const candidates = sanitizeStars(t.candidates, TRANSFER_SIZE);
        if (candidates.length > 0) save.transfer = { refreshedAtLevel: wholeNumber(t.refreshedAtLevel, 1, 1), candidates };
    }

    // v4: stadium and marketing. Older saves start at tier 1 with no campaign.
    save.stadiumTier = Math.min(MAX_STADIUM_TIER, wholeNumber(r.stadiumTier, 1, 1));
    if (typeof r.campaign === 'object' && r.campaign !== null) {
        const c = r.campaign as Record<string, unknown>;
        const levelsLeft = wholeNumber(c.levelsLeft, 0, 0);
        if (CAMPAIGN_IDS.includes(c.id as CampaignId) && levelsLeft > 0) {
            save.campaign = { id: c.id as CampaignId, levelsLeft, extended: c.extended === true };
        }
    }

    // v5: the manager. Older saves get the default look.
    save.manager = sanitizeManager(r.manager);
    return save;
}

/** Keeps only well-formed stars with unique ids, repairing out-of-range numbers. */
function sanitizeStars(raw: unknown, max: number): StarPlayer[] {
    if (!Array.isArray(raw)) return [];
    const out: StarPlayer[] = [];
    for (const item of raw) {
        if (out.length >= max || typeof item !== 'object' || item === null) continue;
        const s = item as Record<string, unknown>;
        if (typeof s.id !== 'string' || !s.id || out.some((p) => p.id === s.id)) continue;
        if (typeof s.name !== 'string' || !SKILL_IDS.includes(s.skill as SkillId)) continue;
        out.push({
            id: s.id,
            name: s.name.slice(0, 24),
            popularity: Math.min(MAX_POPULARITY, wholeNumber(s.popularity, 1, 1)),
            skill: s.skill as SkillId,
            fitness: Math.min(FITNESS_MAX, wholeNumber(s.fitness, 0, FITNESS_MAX)),
            injuredLevels: wholeNumber(s.injuredLevels, 0, 0),
            hair: typeof s.hair === 'number' && Number.isInteger(s.hair) && s.hair >= 0 && s.hair <= 0xffffff ? s.hair : HAIR_COLORS[0],
            paid: wholeNumber(s.paid, 0, 0)
        });
    }
    return out;
}
