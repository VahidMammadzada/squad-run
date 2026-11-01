import * as THREE from 'three';

interface Particle {
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    spin: THREE.Vector3;
    rot: THREE.Euler;
    life: number;
    maxLife: number;
    size: number;
    gravity: number;
}

export interface BurstOptions {
    count: number;
    /** One colour, or a palette to pick from at random. */
    colors: number | readonly number[];
    /** Initial speed, world units per second. */
    speed?: number;
    /** Extra upward speed, so bursts fountain rather than spray flat. */
    up?: number;
    /** Seconds. */
    life?: number;
    size?: number;
    gravity?: number;
    /** Random start offset around the origin. */
    spread?: number;
}

/**
 * Pooled confetti / sparkle / puff particles: one InstancedMesh, one draw call.
 * When the pool is full the oldest particle is reused.
 */
export class Particles {
    readonly mesh: THREE.InstancedMesh;
    private readonly pool: Particle[] = [];
    private next = 0;
    private readonly m = new THREE.Matrix4();
    private readonly q = new THREE.Quaternion();
    private readonly s = new THREE.Vector3();
    private readonly color = new THREE.Color();

    constructor(capacity = 400) {
        this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.25), new THREE.MeshBasicMaterial(), capacity);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        for (let i = 0; i < capacity; i++) {
            this.pool.push({
                pos: new THREE.Vector3(),
                vel: new THREE.Vector3(),
                spin: new THREE.Vector3(),
                rot: new THREE.Euler(),
                life: 0,
                maxLife: 1,
                size: 0,
                gravity: 0
            });
            this.mesh.setColorAt(i, this.color.set(0xffffff));
        }
        this.mesh.count = 0;
    }

    burst(x: number, y: number, z: number, o: BurstOptions): void {
        const palette = typeof o.colors === 'number' ? [o.colors] : o.colors;
        const speed = o.speed ?? 3;
        const spread = o.spread ?? 0.1;
        for (let n = 0; n < o.count; n++) {
            const i = this.next;
            this.next = (this.next + 1) % this.pool.length;
            const p = this.pool[i];
            p.pos.set(x + (Math.random() - 0.5) * spread * 2, y + (Math.random() - 0.5) * spread, z + (Math.random() - 0.5) * spread * 2);
            // Random direction on a sphere, then scaled.
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const v = speed * (0.5 + Math.random() * 0.5);
            p.vel.set(Math.sin(phi) * Math.cos(theta) * v, Math.abs(Math.cos(phi)) * v * 0.6 + (o.up ?? 2), Math.sin(phi) * Math.sin(theta) * v);
            p.spin.set(Math.random() * 12 - 6, Math.random() * 12 - 6, Math.random() * 12 - 6);
            p.maxLife = p.life = (o.life ?? 0.8) * (0.7 + Math.random() * 0.6);
            p.size = (o.size ?? 0.12) * (0.7 + Math.random() * 0.6);
            p.gravity = o.gravity ?? 9;
            this.mesh.setColorAt(i, this.color.set(palette[Math.floor(Math.random() * palette.length)]));
        }
        this.mesh.instanceColor!.needsUpdate = true;
    }

    update(dt: number): void {
        let highest = -1;
        const drag = Math.exp(-1.5 * dt);
        this.pool.forEach((p, i) => {
            if (p.life <= 0) {
                this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
                return;
            }
            p.life -= dt;
            p.vel.y -= p.gravity * dt;
            p.vel.multiplyScalar(drag);
            p.pos.addScaledVector(p.vel, dt);
            if (p.pos.y < 0.02) {
                p.pos.y = 0.02;
                p.vel.set(p.vel.x * 0.5, Math.abs(p.vel.y) * 0.3, p.vel.z * 0.5);
            }
            p.rot.set(p.rot.x + p.spin.x * dt, p.rot.y + p.spin.y * dt, p.rot.z + p.spin.z * dt);
            // Full size for most of the life, then shrink away.
            const size = p.size * Math.min(1, (p.life / p.maxLife) * 3);
            this.mesh.setMatrixAt(i, this.m.compose(p.pos, this.q.setFromEuler(p.rot), this.s.setScalar(Math.max(0, size))));
            highest = i;
        });
        this.mesh.count = highest + 1;
        this.mesh.instanceMatrix.needsUpdate = true;
    }
}
