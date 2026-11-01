import { PITCH_LEFT, PITCH_RIGHT } from '../config';
import { Rng } from '../util/random';
import type { Modifier } from './modifiers';

// All y values here are distances from the start line, in pixels.

export interface GatePairSpec {
    y: number;
    left: Modifier;
    right: Modifier;
}

export interface DefenderSpec {
    x: number;
    y: number;
    power: number;
}

export interface CoinSpec {
    x: number;
    y: number;
}

export interface LevelSpec {
    level: number;
    length: number;
    /** Forward speed in pixels per second. */
    speed: number;
    gates: GatePairSpec[];
    defenders: DefenderSpec[];
    coins: CoinSpec[];
}

/** Each section is: gate pair, coin trail, then a line of defenders. */
const SECTION = 760;
const FIRST_GATE = 600;

export function levelLength(level: number): number {
    return Math.min(3000 + (level - 1) * 350, 9000);
}

export function levelSpeed(level: number): number {
    return Math.min(420 + (level - 1) * 18, 760);
}

function goodModifier(rng: Rng, level: number): Modifier {
    if (rng.chance(level >= 2 ? 0.3 : 0.2)) {
        return { op: 'x', value: level >= 6 && rng.chance(0.25) ? 3 : 2 };
    }
    return { op: '+', value: rng.int(3, Math.min(5 + level * 2, 40)) };
}

function badModifier(rng: Rng, level: number): Modifier {
    if (level >= 2 && rng.chance(0.3)) {
        return { op: '/', value: level >= 6 && rng.chance(0.25) ? 3 : 2 };
    }
    return { op: '-', value: rng.int(2, Math.min(3 + level * 2, 40)) };
}

function gatePair(rng: Rng, level: number, first: boolean): [Modifier, Modifier] {
    // From level 3, some pairs offer only a lesser evil. Never the first pair,
    // which the squad reaches at its starting size.
    const bothBad = !first && level >= 3 && rng.chance(Math.min(0.1 + level * 0.03, 0.4));
    const bothGood = !bothBad && rng.chance(0.2);
    const pair: [Modifier, Modifier] = bothBad
        ? [badModifier(rng, level), badModifier(rng, level)]
        : bothGood
            ? [goodModifier(rng, level), goodModifier(rng, level)]
            : [goodModifier(rng, level), badModifier(rng, level)];
    return rng.chance(0.5) ? pair : [pair[1], pair[0]];
}

function defenderLine(rng: Rng, level: number, y: number): DefenderSpec[] {
    const count = Math.min(1 + Math.floor(level / 3), 4);
    // Two more slots than defenders so there is always a gap to aim for.
    const slots = count + 2;
    const slotWidth = (PITCH_RIGHT - PITCH_LEFT) / slots;
    const picked = rng.shuffle([...Array(slots).keys()]).slice(0, count);
    return picked.map((slot) => ({
        x: Math.round(PITCH_LEFT + (slot + 0.5) * slotWidth + rng.int(-15, 15)),
        y: y + rng.int(-50, 50),
        power: Math.min(1 + Math.floor(level / 3) + rng.int(0, 1), 10)
    }));
}

export function generateLevel(level: number): LevelSpec {
    const rng = new Rng(level * 7919 + 17);
    const length = levelLength(level);
    const gates: GatePairSpec[] = [];
    const defenders: DefenderSpec[] = [];
    const coins: CoinSpec[] = [];

    for (let y = FIRST_GATE; y + SECTION / 2 < length - 200; y += SECTION) {
        const [left, right] = gatePair(rng, level, y === FIRST_GATE);
        gates.push({ y, left, right });

        const coinX = rng.int(PITCH_LEFT + 60, PITCH_RIGHT - 60);
        for (let i = 0; i < 5; i++) {
            coins.push({ x: coinX, y: y + 120 + i * 45 });
        }

        // The first section of level 1 has no defenders so new players learn gates first.
        if (!(level === 1 && y === FIRST_GATE)) {
            defenders.push(...defenderLine(rng, level, y + SECTION / 2));
        }
    }

    return { level, length, speed: levelSpeed(level), gates, defenders, coins };
}
