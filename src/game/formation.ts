import { MAX_VISIBLE_MATES } from '../config';

/** Where each squad mate runs relative to the leader, in pitch pixels, packed in a sunflower spiral. */
export const SLOTS = Array.from({ length: MAX_VISIBLE_MATES }, (_, i) => {
    const r = 30 + 14 * Math.sqrt(i);
    const a = i * 2.39996;
    // y is distance behind the leader (positive = further back).
    return { x: r * Math.cos(a), y: r * Math.sin(a) * 0.85 + 6 };
});

/** Mates actually drawn for a squad of `count` (the leader is not a mate). */
export function visibleMates(count: number): number {
    return Math.max(0, Math.min(count - 1, MAX_VISIBLE_MATES));
}

/** How far from the leader the crowd reaches, in pitch pixels. */
export function crowdRadius(count: number): number {
    const n = visibleMates(count);
    return n === 0 ? 20 : 42 + 14 * Math.sqrt(n - 1);
}

/**
 * Whether something at (x, y) with radius `reach` touches the squad, whose
 * leader is at (squadX, dist). The crowd counts, not just the leader.
 * All values in pitch pixels.
 */
export function touchesSquad(x: number, y: number, squadX: number, dist: number, count: number, reach: number): boolean {
    return Math.hypot(x - squadX, y - dist) <= crowdRadius(count) + reach;
}
