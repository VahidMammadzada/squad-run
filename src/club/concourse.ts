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
    /** Standing within this box around a stall's serve point opens it (wide across the walkway, tight along it). */
    serveHalfX: 0.9,
    serveHalfZ: 0.6,
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
        if (Math.abs(p.x - sp.x) <= CONCOURSE.serveHalfX && Math.abs(p.z - sp.z) <= CONCOURSE.serveHalfZ) return s.id;
    }
    return null;
}

/** Seconds to stand still at a stall before its menu opens, so walking past doesn't open it. */
export const STALL_DWELL = 0.25;
/** Moving less than this (units) in a frame counts as standing still. */
const STILL_EPSILON = 1e-4;

/** Stall-trigger state: the stall whose menu already opened this visit, and how long the manager has stood still. */
export interface StallTrigger {
    at: StallId | null;
    still: number;
}

export const NO_TRIGGER: StallTrigger = { at: null, still: 0 };

/**
 * One frame of the stall trigger. `here` is the stall under the manager,
 * `moved` the distance walked this frame, `destination` the stall an auto-walk
 * was sent to and `walking` whether that auto-walk is still under way. A menu
 * opens once per visit: at once when an auto-walk arrives, otherwise after
 * standing still for STALL_DWELL. Stalls passed during an auto-walk stay shut.
 */
export function stepStallTrigger(
    t: StallTrigger,
    f: { here: StallId | null; moved: number; dt: number; destination: StallId | null; walking: boolean }
): { trigger: StallTrigger; open: StallId | null } {
    const here = f.walking && f.destination && f.here !== f.destination ? null : f.here;
    if (here === null) return { trigger: NO_TRIGGER, open: null };
    if (here === t.at) return { trigger: { at: here, still: 0 }, open: null };
    if (here === f.destination) return { trigger: { at: here, still: 0 }, open: here };
    const still = f.moved > STILL_EPSILON ? 0 : t.still + f.dt;
    if (still >= STALL_DWELL) return { trigger: { at: here, still: 0 }, open: here };
    return { trigger: { at: t.at, still }, open: null };
}

export function inTunnel(p: Vec2): boolean {
    return p.z <= CONCOURSE.tunnelZ && Math.abs(p.x) <= CONCOURSE.tunnelHalfWidth;
}

/** Facing angle (radians, 0 = toward the tunnel) for a movement direction. */
export function headingOf(dx: number, dz: number, fallback: number): number {
    return Math.hypot(dx, dz) < 1e-6 ? fallback : Math.atan2(-dx, -dz);
}
