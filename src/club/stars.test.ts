import { describe, expect, it } from 'vitest';
import { FITNESS_DRAIN, FITNESS_RECOVER, INJURY_RUNS, MAX_ROSTER, SKILL_IDS, TRANSFER_SIZE } from './balance';
import { activeStar, runModifiers } from './runModifiers';
import { canSign, fanGate, generateCandidates, isTired, maxScoutPopularity, releaseRefund, rollInjury, starPrice, tickRun, type StarPlayer } from './stars';

const NO_UPGRADES = { youth: 0, magnet: 0, fanclub: 0, finishing: 0 };

function star(over: Partial<StarPlayer> = {}): StarPlayer {
    return { id: 'a', name: 'Rico Varga', popularity: 2, skill: 'rally', fitness: 100, injuredLevels: 0, hair: 0, paid: 400, ...over };
}

describe('generateCandidates', () => {
    it('is deterministic per seed and differs between seeds', () => {
        expect(generateCandidates(5, 10)).toEqual(generateCandidates(5, 10));
        expect(generateCandidates(5, 10)).not.toEqual(generateCandidates(6, 10));
    });

    it('makes valid, fresh, uniquely-identified players within the scout limit', () => {
        for (let seed = 1; seed < 60; seed++) {
            const level = seed;
            const list = generateCandidates(seed, level);
            expect(list).toHaveLength(TRANSFER_SIZE);
            expect(new Set(list.map((s) => s.id)).size).toBe(TRANSFER_SIZE);
            for (const s of list) {
                expect(SKILL_IDS).toContain(s.skill);
                expect(s.popularity).toBeGreaterThanOrEqual(1);
                expect(s.popularity).toBeLessThanOrEqual(maxScoutPopularity(level));
                expect(s).toMatchObject({ fitness: 100, injuredLevels: 0, paid: 0 });
            }
            // There is always a cheap option.
            expect(list[0].popularity).toBe(1);
        }
    });
});

describe('signing', () => {
    it('prices and gates by popularity', () => {
        expect(starPrice(1)).toBe(100);
        expect(starPrice(5)).toBe(2200);
        expect(fanGate(3)).toBe(0);
        expect(fanGate(4)).toBe(800);
    });

    it('checks roster space, fans, then coins', () => {
        const top = star({ id: 'x', popularity: 4 });
        expect(canSign(top, 1e6, 799, [])).toBe('fans');
        expect(canSign(top, 1399, 800, [])).toBe('coins');
        expect(canSign(top, 1400, 800, [])).toBe('ok');
        const full = Array.from({ length: MAX_ROSTER }, (_, i) => star({ id: `r${i}` }));
        expect(canSign(top, 1e6, 1e6, full)).toBe('full');
        expect(canSign(star(), 1e6, 1e6, [star()])).toBe('signed');
    });

    it('refunds half on release', () => {
        expect(releaseRefund(star({ paid: 401 }))).toBe(200);
    });
});

describe('tickRun', () => {
    const roster = [star({ id: 'a', fitness: 100 }), star({ id: 'b', fitness: 40 }), star({ id: 'c', injuredLevels: 2, fitness: 90 })];

    it('tires the active star, rests the bench, counts injuries down', () => {
        const [a, b, c] = tickRun(roster, 'a', false);
        expect(a.fitness).toBe(100 - FITNESS_DRAIN);
        expect(b.fitness).toBe(40 + FITNESS_RECOVER);
        expect(c.injuredLevels).toBe(1);
        expect(c.fitness).toBe(100);
    });

    it('injures only the active star, and leaves the input untouched', () => {
        const after = tickRun(roster, 'a', true);
        expect(after[0].injuredLevels).toBe(INJURY_RUNS);
        expect(after[1].injuredLevels).toBe(0);
        expect(roster[0].injuredLevels).toBe(0);
    });

    it('an injured active star does not play, so cannot be re-injured or tire', () => {
        const [c] = tickRun([star({ id: 'c', injuredLevels: 2, fitness: 50 })], 'c', true);
        expect(c.injuredLevels).toBe(1);
        expect(c.fitness).toBe(70);
    });

    it('rolls injuries at the configured chance', () => {
        expect(rollInjury(0.29)).toBe(true);
        expect(rollInjury(0.3)).toBe(false);
    });
});

describe('star skills in the run', () => {
    const mods = (s: Partial<StarPlayer>) => runModifiers({ upgrades: NO_UPGRADES, roster: [star({ id: 'a', ...s })], activeStar: 'a' });

    it('applies each skill at full strength', () => {
        expect(mods({ skill: 'shield' }).shield).toBe('full');
        expect(mods({ skill: 'sharpshooter' }).perGoalDelta).toBe(-1);
        expect(mods({ skill: 'rally' }).startSquadBonus).toBe(3);
        expect(mods({ skill: 'magnet' }).coinReachMult).toBeCloseTo(1.3);
        expect(mods({ skill: 'showman', popularity: 2 }).fanMult).toBeCloseTo(1 + 0.2 + 0.5);
    });

    it('halves skills (rounding down) when the star is tired', () => {
        const tired = { fitness: 49 };
        expect(isTired(star(tired))).toBe(true);
        expect(mods({ skill: 'shield', ...tired }).shield).toBe('half');
        expect(mods({ skill: 'sharpshooter', ...tired }).perGoalDelta).toBe(0);
        expect(mods({ skill: 'rally', ...tired }).startSquadBonus).toBe(1);
        expect(mods({ skill: 'magnet', ...tired }).coinReachMult).toBeCloseTo(1.15);
    });

    it('ignores an injured or benched star', () => {
        expect(mods({ skill: 'rally', injuredLevels: 1 }).startSquadBonus).toBe(0);
        expect(activeStar({ upgrades: NO_UPGRADES, roster: [star()], activeStar: null })).toBeNull();
    });
});
