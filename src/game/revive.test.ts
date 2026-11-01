import { describe, expect, it } from 'vitest';
import { defendersToClear, REVIVE_CLEAR_AHEAD } from './revive';
import { COIN_MULTIPLIER, multiplierBonus } from './scoring';

describe('defendersToClear', () => {
    const defenders = [{ y: 900 }, { y: 1000 }, { y: 1000 + REVIVE_CLEAR_AHEAD }, { y: 1001 + REVIVE_CLEAR_AHEAD }, { y: 1200 }];

    it('clears standing defenders around and just ahead of the squad', () => {
        expect(defendersToClear(defenders, [false, false, false, false, false], 1000)).toEqual([1, 2, 4]);
    });

    it('skips defenders that are already down', () => {
        expect(defendersToClear(defenders, [false, true, false, false, true], 1000)).toEqual([2]);
    });
});

describe('multiplierBonus', () => {
    it('adds the missing multiples of what was earned', () => {
        expect(multiplierBonus(40)).toBe(40 * (COIN_MULTIPLIER - 1));
        expect(multiplierBonus(0)).toBe(0);
        expect(multiplierBonus(-5)).toBe(0);
    });
});
