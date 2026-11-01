import { describe, expect, it } from 'vitest';
import { DEFAULT_KIT } from '../data/kits';
import { defaultSave, SAVE_VERSION, sanitizeSave } from './saveData';

describe('sanitizeSave', () => {
    it('returns defaults for missing or junk data', () => {
        for (const raw of [null, undefined, 42, 'x', []]) {
            expect(sanitizeSave(raw)).toEqual(defaultSave());
        }
    });

    it('keeps valid fields', () => {
        const save = sanitizeSave({ level: 7, coins: 120, bestScore: 9, unlockedKits: ['red'], selectedKit: 'red' });
        expect(save).toMatchObject({ level: 7, coins: 120, bestScore: 9, selectedKit: 'red' });
        expect(save.unlockedKits).toEqual([DEFAULT_KIT, 'red']);
    });

    it('repairs bad values', () => {
        const save = sanitizeSave({
            level: -3,
            coins: 'lots',
            bestScore: 4.7,
            unlockedKits: ['red', 'unknown-kit', 5, 'red'],
            selectedKit: 'yellow'
        });
        expect(save.level).toBe(1);
        expect(save.coins).toBe(0);
        expect(save.bestScore).toBe(4);
        expect(save.unlockedKits).toEqual([DEFAULT_KIT, 'red']);
        // Not unlocked, so it falls back to the default kit.
        expect(save.selectedKit).toBe(DEFAULT_KIT);
    });

    it('migrates a v1 save: fans from progress, no upgrades', () => {
        const save = sanitizeSave({ version: 1, level: 11, coins: 300, bestScore: 9, unlockedKits: ['blue'], selectedKit: 'blue' });
        expect(save).toMatchObject({ version: SAVE_VERSION, level: 11, coins: 300, fans: 200, merchPending: 0 });
        expect(Object.values(save.upgrades).every((l) => l === 0)).toBe(true);
    });

    it('repairs club fields', () => {
        const save = sanitizeSave({ level: 2, fans: -5, merchPending: 'x', upgrades: { youth: 99, finishing: 1.9, bogus: 3, magnet: 'a' } });
        expect(save.fans).toBe(0);
        expect(save.merchPending).toBe(0);
        expect(save.upgrades).toEqual({ youth: 5, magnet: 0, fanclub: 0, finishing: 1 });
    });

    it('loads v1/v2 saves with no stars', () => {
        const save = sanitizeSave({ version: 2, level: 6, fans: 90, upgrades: { youth: 1 } });
        expect(save).toMatchObject({ version: SAVE_VERSION, roster: [], activeStar: null, transfer: null, scoutSeed: 1 });
    });

    it('keeps valid stars and repairs or drops bad ones', () => {
        const good = { id: 'a', name: 'Rico Varga', popularity: 9, skill: 'shield', fitness: 140, injuredLevels: -2, hair: 0x123456, paid: 400 };
        const save = sanitizeSave({
            roster: [good, { ...good }, { id: 'b', name: 'X', skill: 'flying' }, null, { id: 'c', name: 'Kemi Bolt', skill: 'rally', hair: 'red' }],
            activeStar: 'b',
            transfer: { refreshedAtLevel: 3, candidates: [good] }
        });
        expect(save.roster.map((s) => s.id)).toEqual(['a', 'c']);
        expect(save.roster[0]).toMatchObject({ popularity: 5, fitness: 100, injuredLevels: 0 });
        expect(save.roster[1]).toMatchObject({ popularity: 1, fitness: 100, paid: 0 });
        // 'b' was dropped, so nobody is active.
        expect(save.activeStar).toBeNull();
        expect(save.transfer?.candidates).toHaveLength(1);
    });

    it('loads older saves at stadium tier 1 with no campaign, and repairs v4 fields', () => {
        expect(sanitizeSave({ version: 3, level: 4 })).toMatchObject({ stadiumTier: 1, campaign: null });
        expect(sanitizeSave({ stadiumTier: 9, campaign: { id: 'fanDrive', levelsLeft: 2, extended: true } })).toMatchObject({
            stadiumTier: 5,
            campaign: { id: 'fanDrive', levelsLeft: 2, extended: true }
        });
        expect(sanitizeSave({ campaign: { id: 'bogus', levelsLeft: 2 } }).campaign).toBeNull();
        expect(sanitizeSave({ campaign: { id: 'fanDrive', levelsLeft: 0 } }).campaign).toBeNull();
    });
});
