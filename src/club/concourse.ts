// The walkable stadium concourse: layout and movement rules, in 3D world units
// (x across, z along the walkway; the tunnel to the pitch is at negative z).
// Pure, so the walking rules are unit tested; src/three/ConcourseWorld draws it.

export type StallId = 'squad' | 'scout' | 'doctor' | 'training' | 'merch' | 'office' | 'wardrobe';

export interface Vec2 {
    x: number;
    z: number;
}

export interface StallDef {
    id: StallId;
    label: string;
    /** -1 = left wall, 1 = right wall. */
    side: -1 | 1;
    z: number;
}

export const STALLS: readonly StallDef[] = [
    { id: 'squad', label: 'SQUAD ROOM', side: -1, z: -5 },
    { id: 'scout', label: 'SCOUT', side: -1, z: -11 },
    { id: 'doctor', label: 'DOCTOR', side: -1, z: -17 },
    { id: 'training', label: 'TRAINING', side: 1, z: -5 },
    { id: 'merch', label: 'MERCH', side: 1, z: -11 },
    { id: 'office', label: 'OFFICE', side: 1, z: -17 },
    // The manager's wardrobe, right by the entrance.
    { id: 'wardrobe', label: 'LOCKER ROOM', side: -1, z: 0.2 }
];

export const CONCOURSE = {
    /** Walkable area. */
    halfWidth: 1.9,
    zNear: 2,
    zFar: -23,
    /** Stall counters stand just outside the walkway, at this |x|. */
    counterX: 3.1,
    /** Where the manager stands to be served: in front of the counter. */
    serveX: 1.4,
    /** Being this close to a stall's serve point opens it. */
    serveRadius: 1.0,
    /** Past this z the manager is in the tunnel to the pitch. */
    tunnelZ: -21.5,
    tunnelHalfWidth: 1.3,
    spawn: { x: 0, z: 0.5 } as Vec2,
    /** Walking speed, units per second. */
    speed: 5
} as const;

export function stallDef(id: StallId): StallDef {
    return STALLS.find((s) => s.id === id)!;
}

/** The spot in front of a stall's counter where the manager is served. */
export function servePoint(id: StallId): Vec2 {
    const s = stallDef(id);
    return { x: s.side * CONCOURSE.serveX, z: s.z };
}

export function clampToWalkway(p: Vec2): Vec2 {
    return {
        x: Math.min(CONCOURSE.halfWidth, Math.max(-CONCOURSE.halfWidth, p.x)),
        z: Math.min(CONCOURSE.zNear, Math.max(CONCOURSE.zFar, p.z))
    };
}

/** One step of joystick walking; `input` is a direction with length 0..1. */
export function stepWalk(p: Vec2, input: Vec2, dt: number): Vec2 {
    const len = Math.hypot(input.x, input.z);
    if (len === 0) return p;
    const k = (Math.min(1, len) / len) * CONCOURSE.speed * dt;
    return clampToWalkway({ x: p.x + input.x * k, z: p.z + input.z * k });
}

/** One step of auto-walking toward `target`; `arrived` once there. */
export function stepToward(p: Vec2, target: Vec2, dt: number): { pos: Vec2; arrived: boolean } {
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const dist = Math.hypot(dx, dz);
    const step = CONCOURSE.speed * dt;
    if (dist <= step) return { pos: clampToWalkway(target), arrived: true };
    return { pos: clampToWalkway({ x: p.x + (dx / dist) * step, z: p.z + (dz / dist) * step }), arrived: false };
}

/** The stall the manager is standing at, if any. */
export function stallAt(p: Vec2): StallId | null {
    for (const s of STALLS) {
        const sp = servePoint(s.id);
        if (Math.hypot(p.x - sp.x, p.z - sp.z) <= CONCOURSE.serveRadius) return s.id;
    }
    return null;
}

export function inTunnel(p: Vec2): boolean {
    return p.z <= CONCOURSE.tunnelZ && Math.abs(p.x) <= CONCOURSE.tunnelHalfWidth;
}

/** Facing angle (radians, 0 = toward the tunnel) for a movement direction. */
export function headingOf(dx: number, dz: number, fallback: number): number {
    return Math.hypot(dx, dz) < 1e-6 ? fallback : Math.atan2(-dx, -dz);
}
