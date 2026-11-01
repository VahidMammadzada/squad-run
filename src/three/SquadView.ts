import * as THREE from 'three';
import { SLOTS, visibleMates } from '../game/formation';
import { FigureBatch, makePose, type Pose } from './FigureBatch';
import type { Particles } from './Particles';
import { toWorld } from './units';

/** Stride frequency at full speed, radians per second. */
const STRIDE = 13;
const POP_TIME = 0.2;
/** New mates hop as they burst out of the leader. */
const HOP_TIME = 0.35;
const HOP_HEIGHT = 0.45;
const MATE_SCALE = 0.8;

interface Mate {
    pose: Pose;
    /** Seconds since joining (grows in) or since leaving (shrinks out). */
    t: number;
}

/** Draws the squad: the leader dribbling the ball, and mates holding formation around them. */
export class SquadView {
    readonly group = new THREE.Group();

    private readonly leaderBatch: FigureBatch;
    private readonly mateBatch: FigureBatch;
    private readonly ball: THREE.Mesh;
    private readonly leader = makePose({ scale: 0.95 });
    private readonly mates: Mate[] = [];
    private readonly leaving: Mate[] = [];
    private readonly poses: Pose[] = [];
    private visible = true;

    constructor(shirt: number, ballMaterial: THREE.Material, capacity: number, private readonly particles?: Particles) {
        this.leaderBatch = new FigureBatch(1, { shirt, shorts: 0xffffff });
        this.mateBatch = new FigureBatch(capacity, { shirt, shorts: 0xffffff });
        this.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), ballMaterial);
        this.group.add(this.leaderBatch.group, this.mateBatch.group, this.ball);
    }

    get ballPosition(): THREE.Vector3 {
        return this.ball.position;
    }

    get leaderPosition(): THREE.Vector3 {
        return new THREE.Vector3(this.leader.x, this.leader.y, this.leader.z);
    }

    hideBall(): void {
        this.ball.visible = false;
    }

    /** Game over: the squad disappears. */
    wipeOut(): void {
        this.visible = false;
        this.ball.visible = false;
        this.leaving.push(...this.mates.splice(0).map((m) => ({ pose: m.pose, t: 0 })));
    }

    /** Undoes wipeOut; mates pop back in on the next update. */
    revive(): void {
        this.visible = true;
        this.ball.visible = true;
    }

    /**
     * @param x leader position across the pitch, pitch pixels
     * @param dist distance run, pitch pixels
     */
    update(dt: number, x: number, dist: number, count: number, running: boolean): void {
        const run = running ? 1 : 0;
        const leaderPos = toWorld(x, dist);
        Object.assign(this.leader, { x: leaderPos.x, z: leaderPos.z, run });
        this.leader.phase += dt * STRIDE * run;

        // New mates appear at the leader and run out to their slot; lost ones shrink away.
        const target = this.visible ? visibleMates(count) : 0;
        while (this.mates.length < target) {
            this.mates.push({ pose: makePose({ x: this.leader.x, z: this.leader.z, phase: Math.random() * 6, scale: 0 }), t: 0 });
        }
        while (this.mates.length > target) {
            this.leaving.push({ pose: this.mates.pop()!.pose, t: 0 });
        }

        const k = 1 - Math.exp(-10 * dt);
        this.poses.length = 0;
        this.mates.forEach((mate, i) => {
            const slot = toWorld(x + SLOTS[i].x, dist - SLOTS[i].y);
            const p = mate.pose;
            p.x += (slot.x - p.x) * k;
            p.z += (slot.z - p.z) * k;
            p.run = run;
            p.phase += dt * STRIDE * run;
            mate.t += dt;
            p.scale = backOut(Math.min(1, mate.t / POP_TIME)) * MATE_SCALE;
            p.y = mate.t < HOP_TIME ? Math.sin((mate.t / HOP_TIME) * Math.PI) * HOP_HEIGHT : 0;
            this.poses.push(p);
        });
        for (let i = this.leaving.length - 1; i >= 0; i--) {
            const mate = this.leaving[i];
            // Leaving mates go out in a little white poof.
            if (mate.t === 0) this.particles?.burst(mate.pose.x, 0.5, mate.pose.z, { count: 4, colors: [0xffffff, 0xe3e8f0], speed: 1.6, up: 1.2, life: 0.45, size: 0.15 });
            mate.t += dt;
            mate.pose.scale = Math.max(0, 1 - mate.t / POP_TIME) * MATE_SCALE;
            if (mate.pose.scale === 0) this.leaving.splice(i, 1);
            else this.poses.push(mate.pose);
        }

        this.mateBatch.draw(this.poses);
        this.leaderBatch.draw(this.visible ? [this.leader] : []);

        if (this.ball.visible) {
            const bounce = Math.abs(Math.sin(this.leader.phase)) * 0.12;
            this.ball.position.set(this.leader.x, 0.13 + bounce, this.leader.z - 0.45);
            this.ball.rotation.x -= dt * 12 * run;
        }
    }

    dispose(): void {
        this.leaderBatch.dispose();
        this.mateBatch.dispose();
        this.ball.geometry.dispose();
    }
}

/** Ease with a small overshoot, for pop-ins. */
function backOut(t: number): number {
    const c = 1.70158;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}
