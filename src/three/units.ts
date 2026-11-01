import { PITCH_CENTER } from '../config';

/**
 * Game logic works in "pitch pixels" (x across the pitch, distance along it).
 * The 3D world uses metres-ish units: x to the right, z negative down the pitch.
 */
export const PX_PER_UNIT = 80;

export function toWorld(x: number, dist: number): { x: number; z: number } {
    return { x: (x - PITCH_CENTER) / PX_PER_UNIT, z: -dist / PX_PER_UNIT };
}

export function units(px: number): number {
    return px / PX_PER_UNIT;
}
