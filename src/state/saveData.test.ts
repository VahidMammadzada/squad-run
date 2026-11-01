import { describe, expect, it } from 'vitest';
import { DEFAULT_KIT } from '../data/kits';
import { defaultSave, sanitizeSave } from './saveData';

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
});
