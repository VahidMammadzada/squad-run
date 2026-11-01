import { describe, expect, it } from 'vitest';
import {
    clampToWalkway,
    CONCOURSE,
    headingOf,
    inTunnel,
    NO_TRIGGER,
    servePoint,
    STALL_DWELL,
    stallAt,
    STALLS,
    stepStallTrigger,
    stepToward,
    stepWalk,
    type StallId,
    type StallTrigger
} from './concourse';

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

    it('clamps a floor tap outside the walkway to the nearest walkable spot', () => {
        expect(clampToWalkway({ x: 3, z: -11 })).toEqual({ x: CONCOURSE.halfWidth, z: -11 });
        // An auto-walk to the clamped spot arrives, so it doesn't keep walking forever.
        let pos = { ...CONCOURSE.spawn };
        let arrived = false;
        for (let i = 0; i < 200 && !arrived; i++) ({ pos, arrived } = stepToward(pos, clampToWalkway({ x: 3, z: -11 }), 0.05));
        expect(arrived).toBe(true);
    });

    it('faces the direction of travel', () => {
        expect(headingOf(0, -1, 9)).toBeCloseTo(0);
        expect(headingOf(0, 0, 9)).toBe(9);
    });
});

describe('stall trigger', () => {
    const DT = 1 / 60;
    type Frame = { here: StallId | null; moved?: number; destination?: StallId | null; walking?: boolean };
    /** Runs frames through the trigger and returns the stalls opened. */
    function run(frames: Frame[], start: StallTrigger = NO_TRIGGER): { opened: StallId[]; trigger: StallTrigger } {
        let trigger = start;
        const opened: StallId[] = [];
        for (const f of frames) {
            const r = stepStallTrigger(trigger, { here: f.here, moved: f.moved ?? 0, dt: DT, destination: f.destination ?? null, walking: f.walking ?? false });
            trigger = r.trigger;
            if (r.open) opened.push(r.open);
        }
        return { opened, trigger };
    }
    const frames = (n: number, f: Frame): Frame[] => Array.from({ length: n }, () => f);

    it('opens a stall after standing still at it for STALL_DWELL, not before', () => {
        const justUnder = Math.floor(STALL_DWELL / DT) - 1;
        expect(run(frames(justUnder, { here: 'scout' })).opened).toEqual([]);
        expect(run(frames(justUnder + 3, { here: 'scout' })).opened).toEqual(['scout']);
    });

    it('never opens a stall the manager is walking past, however slowly', () => {
        expect(run(frames(120, { here: 'scout', moved: 0.01 })).opened).toEqual([]);
    });

    it('opens once per visit, and again after walking away and back', () => {
        const stay = run(frames(60, { here: 'merch' }));
        expect(stay.opened).toEqual(['merch']);
        const back = run([...frames(2, { here: null }), ...frames(30, { here: 'merch' })], stay.trigger);
        expect(back.opened).toEqual(['merch']);
    });

    it('opens an auto-walk destination at once on arrival', () => {
        expect(run([{ here: 'doctor', moved: 0.08, destination: 'doctor' }]).opened).toEqual(['doctor']);
    });

    it('keeps stalls passed on the way shut during an auto-walk', () => {
        expect(run(frames(60, { here: 'scout', moved: 0, destination: 'doctor', walking: true })).opened).toEqual([]);
    });
});
