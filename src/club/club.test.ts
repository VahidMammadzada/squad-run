import { describe, expect, it } from 'vitest';
import { goalsFor, playersPerGoal } from '../game/scoring';
import { CROWD_MIN, MERCH_CAP_LEVELS, MERCH_MIN } from './balance';
import { crowdFill, fansForLevel, migratedFans } from './fans';
import { accrueMerch, merchCap, merchPerLevel } from './merch';
import { runModifiers } from './runModifiers';
import { canBuy, isMaxed, maxLevel, nextPrice } from './upgrades';

describe('upgrades', () => {
    it('prices each level, then stops at max', () => {
        expect(nextPrice('youth', 0)).toBe(60);
        expect(nextPrice('youth', 4)).toBe(600);
        expect(nextPrice('youth', maxLevel('youth'))).toBeNull();
        expect(isMaxed('finishing', 3)).toBe(true);
    });

    it('can only buy what the player can afford', () => {
        expect(canBuy('youth', 0, 59)).toBe(false);
        expect(canBuy('youth', 0, 60)).toBe(true);
        expect(canBuy('youth', 5, 1e9)).toBe(false);
    });
});

describe('fans', () => {
    it('scales with goals and Fan Club', () => {
        expect(fansForLevel(3, 0)).toBe(30);
        expect(fansForLevel(3, 5)).toBe(45);
        expect(fansForLevel(0, 5)).toBe(0);
    });

    it('fills the crowd on a log scale, within bounds', () => {
        expect(crowdFill(0)).toBe(CROWD_MIN);
        expect(crowdFill(1000)).toBeGreaterThan(crowdFill(100));
        expect(crowdFill(1e12)).toBe(1);
    });

    it('starts migrated players in proportion to their level', () => {
        expect(migratedFans(1)).toBe(0);
        expect(migratedFans(11)).toBe(200);
    });
});

describe('merch', () => {
    it('earns at least the minimum, more with fans, and stops at the cap', () => {
        expect(merchPerLevel(0)).toBe(MERCH_MIN);
        expect(merchPerLevel(1000)).toBe(40);
        let pending = 0;
        for (let i = 0; i < 50; i++) pending = accrueMerch(pending, 1000);
        expect(pending).toBe(merchCap(1000));
        expect(merchCap(1000)).toBe(40 * MERCH_CAP_LEVELS);
    });
});

describe('runModifiers', () => {
    it('turns upgrade levels into run effects', () => {
        const mods = runModifiers({ upgrades: { youth: 2, finishing: 1, magnet: 3, fanclub: 4 } });
        expect(mods).toMatchObject({ startSquadBonus: 2, perGoalDelta: -1, fanClubLevel: 4 });
        expect(mods.coinReachMult).toBeCloseTo(1.3);
    });

    it('Finishing never brings players per goal below 2', () => {
        expect(playersPerGoal(1, -3)).toBe(2);
        expect(playersPerGoal(1)).toBe(4);
        expect(goalsFor(12, 1, -1)).toBe(4);
    });
});
