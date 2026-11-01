import { describe, expect, it } from 'vitest';
import { CONCOURSE, headingOf, inTunnel, servePoint, stallAt, STALLS, stepToward, stepWalk } from './concourse';

describe('concourse walking', () => {
    it('walks at full speed in the input direction, capped at length 1', () => {
        const p = stepWalk({ x: 0, z: 0 }, { x: 0, z: -2 }, 0.5);
        expect(p.z).toBeCloseTo(-CONCOURSE.speed * 0.5);
        expect(p.x).toBe(0);
    });

    it('stays inside the walkway', () => {
        const p = stepWalk({ x: 1.8, z: 1.9 }, { x: 1, z: 1 }, 10);
        expect(p).toEqual({ x: CONCOURSE.halfWidth, z: CONCOURSE.zNear });
        expect(stepWalk({ x: 0, z: -22.9 }, { x: 0, z: -1 }, 10).z).toBe(CONCOURSE.zFar);
    });

    it('does nothing without input', () => {
        const p = { x: 1, z: -3 };
        expect(stepWalk(p, { x: 0, z: 0 }, 1)).toBe(p);
    });

    it('auto-walks to a target and reports arrival', () => {
        const target = servePoint('merch');
        let pos = { ...CONCOURSE.spawn };
        let arrived = false;
        for (let i = 0; i < 200 && !arrived; i++) ({ pos, arrived } = stepToward(pos, target, 0.05));
        expect(arrived).toBe(true);
        expect(pos).toEqual(target);
    });

    it('every serve point is reachable inside the walkway', () => {
        for (const s of STALLS) {
            const sp = servePoint(s.id);
            expect(Math.abs(sp.x)).toBeLessThanOrEqual(CONCOURSE.halfWidth);
            expect(sp.z).toBeLessThanOrEqual(CONCOURSE.zNear);
            expect(sp.z).toBeGreaterThanOrEqual(CONCOURSE.zFar);
        }
    });
});

describe('concourse triggers', () => {
    it('opens the stall you stand at, and none in the middle of the walkway', () => {
        for (const s of STALLS) expect(stallAt(servePoint(s.id))).toBe(s.id);
        expect(stallAt({ x: 0, z: -8 })).toBeNull();
        expect(stallAt(CONCOURSE.spawn)).toBeNull();
    });

    it('detects the tunnel only at the far end, in the middle', () => {
        expect(inTunnel({ x: 0, z: -22 })).toBe(true);
        expect(inTunnel({ x: 1.8, z: -22 })).toBe(false);
        expect(inTunnel({ x: 0, z: -15 })).toBe(false);
    });

    it('faces the direction of travel', () => {
        expect(headingOf(0, -1, 9)).toBeCloseTo(0);
        expect(headingOf(0, 0, 9)).toBe(9);
    });
});
