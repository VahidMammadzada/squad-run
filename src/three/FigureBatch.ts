import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Everything needed to draw one footballer for one frame. World units. */
export interface Pose {
    x: number;
    y: number;
    z: number;
    /** 0 faces down the pitch (away from the camera); Math.PI faces the camera. */
    rotY: number;
    /** Run-cycle phase in radians. */
    phase: number;
    /** 0 = standing, 1 = full sprint. */
    run: number;
    scale: number;
    /** Sideways tilt, for keeper dives and knock-downs. */
    roll: number;
    /** 0 = arms down, 1 = arms out wide (keeper). */
    armsOut: number;
}

export function makePose(partial: Partial<Pose> = {}): Pose {
    return { x: 0, y: 0, z: 0, rotY: 0, phase: 0, run: 0, scale: 1, roll: 0, armsOut: 0, ...partial };
}

export interface FigureColors {
    shirt: number;
    shorts: number;
    skin?: number;
    hair?: number;
    socks?: number;
}

const HIP_Y = 0.46;
const SHOULDER_Y = 0.88;
const DEFAULT_SKIN = 0xe0ac69;
const DEFAULT_HAIR = 0x3e2723;
const BOOT = 0x1a1a1a;

/** Which of a figure's colours a part takes, in per-figure mode. */
type Tint = (c: FigureColors) => number;

const box = (w: number, h: number, d: number, ty = 0) => new THREE.BoxGeometry(w, h, d).translate(0, ty, 0);

/** A limb hanging down from its joint, built from coloured segments (e.g. skin, sock, boot). */
function limb(width: number, segments: [length: number, color: number][]): THREE.BufferGeometry {
    let top = 0;
    const parts = segments.map(([length, hex]) => {
        const geo = box(width, length, width, -(top + length / 2));
        top += length;
        const c = new THREE.Color(hex);
        const colors = new Float32Array(geo.attributes.position.count * 3);
        for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        return geo;
    });
    return mergeGeometries(parts);
}

/**
 * Draws up to `capacity` blocky footballers with a procedural run cycle. Each
 * body part is one InstancedMesh, so a whole crowd costs a handful of draw
 * calls. Placeholder for real character models: anything that can draw a
 * list of Poses can replace it.
 *
 * With `'perFigure'` instead of colours, every figure gets its own colours
 * (passed to draw), so differently dressed people (stadium vendors and stars)
 * still share one batch: a few more meshes, but not a batch each.
 */
export class FigureBatch {
    readonly group = new THREE.Group();

    /** One mesh per leg segment group; all segments of a limb share the joint's matrix. */
    private readonly legs: THREE.InstancedMesh[];
    private readonly arms: THREE.InstancedMesh[];
    private readonly torso: THREE.InstancedMesh;
    private readonly shorts: THREE.InstancedMesh;
    private readonly head: THREE.InstancedMesh;
    private readonly hair: THREE.InstancedMesh;
    private readonly shadow: THREE.InstancedMesh;
    /** Per-figure mode: the colour each tinted mesh takes from a figure's colours. */
    private readonly tints = new Map<THREE.InstancedMesh, Tint>();
    private readonly tint = new THREE.Color();
    /** Per-figure mode: the colours last written, so unchanged colours aren't re-uploaded every frame. */
    private lastColors: readonly FigureColors[] = [];

    // Scratch objects reused every frame.
    private readonly base = new THREE.Matrix4();
    private readonly local = new THREE.Matrix4();
    private readonly out = new THREE.Matrix4();
    private readonly rot = new THREE.Matrix4();
    private readonly q = new THREE.Quaternion();
    private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
    private readonly v = new THREE.Vector3();
    private readonly s = new THREE.Vector3();

    constructor(capacity: number, colors: FigureColors | 'perFigure') {
        const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });
        const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, count: number, tint?: Tint) => {
            const m = new THREE.InstancedMesh(geo, mat, count);
            m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            m.frustumCulled = false;
            m.count = 0;
            this.group.add(m);
            if (tint) this.tints.set(m, tint);
            return m;
        };
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
        this.shadow = mesh(new THREE.CircleGeometry(0.26, 12).rotateX(-Math.PI / 2), shadowMat, capacity);

        if (colors === 'perFigure') {
            // White parts tinted per instance; limb segments are separate meshes so each can take its own colour.
            const skin: Tint = (c) => c.skin ?? DEFAULT_SKIN;
            const shirt: Tint = (c) => c.shirt;
            const segment = (width: number, top: number, length: number) => box(width, length, width, -(top + length / 2));
            this.legs = [
                mesh(segment(0.13, 0, 0.17), lambert(0xffffff), capacity * 2, skin),
                mesh(segment(0.13, 0.17, 0.22), lambert(0xffffff), capacity * 2, (c) => c.socks ?? c.shirt),
                mesh(segment(0.13, 0.39, 0.06), lambert(BOOT), capacity * 2)
            ];
            this.arms = [mesh(segment(0.1, 0, 0.14), lambert(0xffffff), capacity * 2, shirt), mesh(segment(0.1, 0.14, 0.22), lambert(0xffffff), capacity * 2, skin)];
            this.torso = mesh(box(0.34, 0.38, 0.2), lambert(0xffffff), capacity, shirt);
            this.shorts = mesh(box(0.32, 0.16, 0.21), lambert(0xffffff), capacity, (c) => c.shorts);
            this.head = mesh(box(0.24, 0.24, 0.24), lambert(0xffffff), capacity, skin);
            this.hair = mesh(box(0.26, 0.09, 0.26), lambert(0xffffff), capacity, (c) => c.hair ?? DEFAULT_HAIR);
            return;
        }

        const skinColor = colors.skin ?? DEFAULT_SKIN;
        const vertexColored = new THREE.MeshLambertMaterial({ vertexColors: true });
        // Limbs hang from their joint, so geometry starts at the origin and goes down.
        const legGeo = limb(0.13, [[0.17, skinColor], [0.22, colors.socks ?? colors.shirt], [0.06, BOOT]]);
        this.legs = [mesh(legGeo, vertexColored, capacity * 2)];
        this.arms = [mesh(limb(0.1, [[0.14, colors.shirt], [0.22, skinColor]]), vertexColored, capacity * 2)];
        this.torso = mesh(box(0.34, 0.38, 0.2), lambert(colors.shirt), capacity);
        this.shorts = mesh(box(0.32, 0.16, 0.21), lambert(colors.shorts), capacity);
        this.head = mesh(box(0.24, 0.24, 0.24), lambert(skinColor), capacity);
        this.hair = mesh(box(0.26, 0.09, 0.26), lambert(colors.hair ?? DEFAULT_HAIR), capacity);
    }

    /** `colors[i]` dresses `poses[i]`; required for a `'perFigure'` batch, ignored otherwise. */
    draw(poses: readonly Pose[], colors?: readonly FigureColors[]): void {
        const n = poses.length;
        if (this.tints.size > 0 && (!colors || colors.length < n)) {
            throw new Error(`FigureBatch: a 'perFigure' batch needs colours for all ${n} figures, got ${colors?.length ?? 0}`);
        }
        for (let i = 0; i < n; i++) {
            const p = poses[i];
            const swing = Math.sin(p.phase) * 0.85 * p.run;
            const bob = Math.abs(Math.cos(p.phase)) * 0.06 * p.run;
            // Lean into the run.
            this.e.set(-0.2 * p.run, p.rotY, p.roll);
            this.q.setFromEuler(this.e);
            this.base.compose(this.v.set(p.x, p.y + bob, p.z), this.q, this.s.setScalar(p.scale));

            this.put(this.torso, i, 0, 0.74, 0, 0, 0);
            this.put(this.shorts, i, 0, 0.5, 0, 0, 0);
            this.put(this.head, i, 0, 1.06, 0, 0, 0);
            this.put(this.hair, i, 0, 1.2, 0.01, 0, 0);
            for (const leg of this.legs) {
                this.put(leg, i * 2, -0.085, HIP_Y, 0, swing, 0);
                this.put(leg, i * 2 + 1, 0.085, HIP_Y, 0, -swing, 0);
            }
            for (const arm of this.arms) {
                this.put(arm, i * 2, -0.22, SHOULDER_Y, 0, -swing * 0.8, -p.armsOut * 1.3);
                this.put(arm, i * 2 + 1, 0.22, SHOULDER_Y, 0, swing * 0.8, p.armsOut * 1.3);
            }

            // The shadow stays flat on the ground.
            this.out.makeTranslation(p.x, 0.01, p.z).scale(this.s.setScalar(p.scale * (1 - p.y * 0.3)));
            this.shadow.setMatrixAt(i, this.out);
        }
        for (const m of [this.torso, this.shorts, this.head, this.hair, this.shadow]) {
            m.count = n;
            m.instanceMatrix.needsUpdate = true;
        }
        for (const m of [...this.legs, ...this.arms]) {
            m.count = n * 2;
            m.instanceMatrix.needsUpdate = true;
        }
        if (colors && this.tints.size > 0 && !this.sameColors(colors, n)) {
            for (const [m, tint] of this.tints) {
                const perFigure = m.count / Math.max(1, n);
                for (let i = 0; i < m.count; i++) m.setColorAt(i, this.tint.setHex(tint(colors[Math.floor(i / perFigure)])));
                if (m.instanceColor) m.instanceColor.needsUpdate = true;
            }
            this.lastColors = colors.slice(0, n);
        }
    }

    /** True if the first `n` colours are the same objects as last time (callers reuse their colour objects). */
    private sameColors(colors: readonly FigureColors[], n: number): boolean {
        if (this.lastColors.length !== n) return false;
        for (let i = 0; i < n; i++) if (this.lastColors[i] !== colors[i]) return false;
        return true;
    }

    /** Places one part: offset from the figure's feet, then rotated about its joint. */
    private put(mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, rx: number, rz: number): void {
        this.local.makeTranslation(x, y, z);
        if (rx !== 0) this.local.multiply(this.rot.makeRotationX(rx));
        if (rz !== 0) this.local.multiply(this.rot.makeRotationZ(rz));
        this.out.multiplyMatrices(this.base, this.local);
        mesh.setMatrixAt(index, this.out);
    }

    dispose(): void {
        this.group.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();
                (obj.material as THREE.Material).dispose();
            }
        });
    }
}
