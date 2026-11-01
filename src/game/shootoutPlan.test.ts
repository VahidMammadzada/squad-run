import { describe, expect, it } from 'vitest';
import { goalsFor } from './scoring';
import { MAX_SHOTS, planShootout } from './shootoutPlan';

describe('planShootout', () => {
    it('gives a squad too small to score one saved shot', () => {
        const plan = planShootout(1, 1);
        expect(plan.goals).toBe(0);
        expect(plan.worth).toEqual([0]);
    });

    it('takes one shot per goal for small squads', () => {
        const plan = planShootout(12, 1);
        expect(plan.goals).toBe(goalsFor(12, 1));
        expect(plan.worth).toEqual(Array(plan.goals).fill(1));
        expect(plan.interval).toBe(380);
    });

    it('batches big shootouts without losing goals', () => {
        for (const level of [1, 5, 12, 30]) {
            for (let squad = 0; squad <= 1000; squad += 7) {
                const plan = planShootout(squad, level);
                expect(plan.worth.length).toBeLessThanOrEqual(MAX_SHOTS);
                expect(plan.worth.length).toBeGreaterThan(0);
                expect(plan.worth.reduce((a, b) => a + b, 0)).toBe(plan.goals);
                if (plan.goals > 0) expect(Math.min(...plan.worth)).toBeGreaterThan(0);
            }
        }
    });

    it('speeds up long shootouts', () => {
        expect(planShootout(4 * 15, 1).interval).toBe(220);
    });
});
