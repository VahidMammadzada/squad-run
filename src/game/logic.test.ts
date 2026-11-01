import { describe, expect, it } from 'vitest';
import { MAX_SQUAD, PITCH_LEFT, PITCH_RIGHT } from '../config';
import { crowdRadius, touchesSquad } from './formation';
import { generateLevel } from './levelGen';
import { applyModifier, isGood, modifierLabel, type Modifier } from './modifiers';
import { goalsFor, playersPerGoal } from './scoring';

describe('applyModifier', () => {
    it('applies each operator', () => {
        expect(applyModifier(10, { op: '+', value: 5 })).toBe(15);
        expect(applyModifier(10, { op: '-', value: 3 })).toBe(7);
        expect(applyModifier(10, { op: 'x', value: 2 })).toBe(20);
        expect(applyModifier(7, { op: '/', value: 2 })).toBe(3);
    });

    it('clamps to 0 and MAX_SQUAD', () => {
        expect(applyModifier(2, { op: '-', value: 5 })).toBe(0);
        expect(applyModifier(1, { op: '/', value: 2 })).toBe(0);
        expect(applyModifier(800, { op: 'x', value: 3 })).toBe(MAX_SQUAD);
    });

    it('labels', () => {
        expect(modifierLabel({ op: 'x', value: 2 })).toBe('×2');
        expect(modifierLabel({ op: '/', value: 3 })).toBe('÷3');
    });
});

describe('generateLevel', () => {
    it('is deterministic per level', () => {
        expect(generateLevel(4)).toEqual(generateLevel(4));
        expect(generateLevel(4)).not.toEqual(generateLevel(5));
    });

    it('gets longer and faster', () => {
        expect(generateLevel(10).length).toBeGreaterThan(generateLevel(1).length);
        expect(generateLevel(10).speed).toBeGreaterThan(generateLevel(1).speed);
    });

    it('keeps everything on the pitch and before the finish', () => {
        for (let level = 1; level <= 40; level++) {
            const spec = generateLevel(level);
            expect(spec.gates.length).toBeGreaterThanOrEqual(3);
            for (const thing of [...spec.gates, ...spec.defenders, ...spec.coins]) {
                expect(thing.y).toBeGreaterThan(0);
                expect(thing.y).toBeLessThan(spec.length);
            }
            for (const d of spec.defenders) {
                expect(d.x).toBeGreaterThanOrEqual(PITCH_LEFT);
                expect(d.x).toBeLessThanOrEqual(PITCH_RIGHT);
                expect(d.power).toBeGreaterThan(0);
            }
        }
    });

    const hasGoodOption = (gate: { left: Modifier; right: Modifier }) => isGood(gate.left) || isGood(gate.right);

    it('never offers two bad gates on levels 1-2', () => {
        for (const level of [1, 2]) {
            expect(generateLevel(level).gates.every(hasGoodOption)).toBe(true);
        }
    });

    it('always opens a level with a good option', () => {
        for (let level = 1; level <= 60; level++) {
            expect(hasGoodOption(generateLevel(level).gates[0])).toBe(true);
        }
    });

    it('has no defenders in the first section of level 1', () => {
        const spec = generateLevel(1);
        expect(spec.defenders.every((d) => d.y > spec.gates[1].y - 400)).toBe(true);
    });
});

describe('scoring', () => {
    it('needs more players per goal as levels rise', () => {
        expect(playersPerGoal(1)).toBe(4);
        expect(playersPerGoal(30)).toBeGreaterThan(playersPerGoal(1));
        expect(goalsFor(9, 1)).toBe(2);
        expect(goalsFor(3, 1)).toBe(0);
    });
});

describe('touchesSquad', () => {
    it('reaches anything inside the crowd, not just near the leader', () => {
        // 13 players: the crowd spreads well past the leader on both sides.
        const edge = crowdRadius(13) - 5;
        expect(touchesSquad(300 + edge, 1000, 300, 1000, 13, 0)).toBe(true);
        expect(touchesSquad(300 - edge, 1000, 300, 1000, 13, 0)).toBe(true);
    });

    it('adds the object radius and misses things beyond it', () => {
        const r = crowdRadius(13);
        expect(touchesSquad(300 + r + 20, 1000, 300, 1000, 13, 22)).toBe(true);
        expect(touchesSquad(300 + r + 30, 1000, 300, 1000, 13, 22)).toBe(false);
        expect(touchesSquad(300, 1000 + r + 30, 300, 1000, 13, 22)).toBe(false);
    });

    it('a lone leader only touches what is close', () => {
        expect(touchesSquad(340, 1000, 300, 1000, 1, 22)).toBe(true);
        expect(touchesSquad(360, 1000, 300, 1000, 1, 22)).toBe(false);
    });
});
