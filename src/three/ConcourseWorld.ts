import * as THREE from 'three';
import { CONCOURSE, STALLS, type StallId, type Vec2 } from '../club/concourse';
import type { StarPlayer } from '../club/stars';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { FigureBatch, makePose, type FigureColors, type Pose } from './FigureBatch';
import type * as Phaser from 'phaser';
import type { CelebrationId } from '../club/wardrobe';
import { defaultLook, ManagerView, type ManagerLook } from './ManagerView';
import { Particles } from './Particles';
import { Stage } from './Stage';
import { awningTexture, crowdTexture, floorTexture, pitchTexture, stallSignTexture } from './textures';

/** Awning and sign colour per stall; MERCH wears the club kit. */
const STALL_COLORS: Record<StallId, number> = {
    squad: COLORS.gold,
    scout: 0x2f8cff,
    doctor: COLORS.gateBad,
    training: COLORS.buttonAccent,
    merch: 0,
    office: 0x8e44ad,
    wardrobe: 0x00a884
};

/** Vendor shirt per stall (the doctor wears white, the coach a tracksuit...). */
const VENDOR_SHIRTS: Record<StallId, number> = {
    squad: 0x1b2a5c,
    scout: 0x6d4c41,
    doctor: 0xffffff,
    training: 0xff9f1a,
    merch: 0,
    office: 0x37474f,
    wardrobe: 0xffffff
};

/** Where signed stars hang around, near the squad room. */
const STAR_SPOTS = [
    { x: -2.3, z: -2.2 },
    { x: -2.4, z: -7.8 },
    { x: -1.7, z: -8.5 },
    { x: -2.4, z: -13.8 },
    { x: -1.7, z: -14.5 }
];
const WALL_X = CONCOURSE.counterX + 1.5;
const FLOOR_NEAR = 6;
const FLOOR_FAR = -30;
/** Follow camera: behind and above the manager, looking down the concourse. */
const CAM_HEIGHT = 5.2;
const CAM_BACK = 5.5;

export interface ConcourseOptions {
    kitColor: number;
    stadiumTier: number;
    crowdFill: number;
    stars: readonly { star: StarPlayer; look: { hair: number; socks: number } }[];
    look?: ManagerLook;
}

/**
 * The walkable stadium: a concourse with a stall per club booth, the tunnel to
 * the pitch at the far end, and the manager. Same lifecycle as World3D; the
 * walking rules live in src/club/concourse.ts.
 */
export class ConcourseWorld {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(64, GAME_WIDTH / GAME_HEIGHT, 0.1, 120);
    readonly manager: ManagerView;
    private readonly particles = new Particles(200);

    /** Vendors and signed stars: one batch with per-figure colours, so they cost a few draw calls in total. */
    private readonly people = new FigureBatch(STALLS.length + STAR_SPOTS.length, 'perFigure');
    private readonly folk: { pose: Pose; colors: FigureColors; star: boolean }[] = [];
    /** Meshes that tapping can hit, tagged with what they are. */
    private readonly pickables: THREE.Object3D[] = [];
    private readonly raycaster = new THREE.Raycaster();
    private readonly floor: THREE.Mesh;
    private readonly camTarget = new THREE.Vector3();
    private readonly v = new THREE.Vector3();
    private time = 0;
    /** Wardrobe preview: the camera faces the manager from the front. */
    private previewMode = false;

    constructor(opts: ConcourseOptions) {
        const colors = { ...STALL_COLORS, merch: opts.kitColor };
        this.scene.background = new THREE.Color(COLORS.skyTop);
        this.scene.fog = new THREE.Fog(COLORS.skyHorizon, 30, 70);
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb4d0, 2.4));
        const sun = new THREE.DirectionalLight(0xfff2d6, 1.4);
        sun.position.set(3, 10, 4);
        this.scene.add(sun);

        // Floor.
        const ftex = floorTexture();
        ftex.repeat.set((WALL_X * 2) / 2.5, (FLOOR_NEAR - FLOOR_FAR) / 2.5);
        this.floor = new THREE.Mesh(new THREE.PlaneGeometry(WALL_X * 2, FLOOR_NEAR - FLOOR_FAR).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: ftex }));
        this.floor.position.set(0, 0, (FLOOR_NEAR + FLOOR_FAR) / 2);
        this.scene.add(this.floor);
        // A club-colour carpet down the middle, leading to the tunnel.
        const carpet = new THREE.Mesh(new THREE.PlaneGeometry(1.1, FLOOR_NEAR - CONCOURSE.tunnelZ + 2).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: opts.kitColor }));
        carpet.position.set(0, 0.01, (FLOOR_NEAR + CONCOURSE.tunnelZ - 2) / 2);
        this.scene.add(carpet);

        this.scene.add(this.people.group);
        this.buildWalls(opts);
        for (const s of STALLS) this.buildStall(s.id, s.side, s.z, colors[s.id], s.id === 'merch' ? opts.kitColor : VENDOR_SHIRTS[s.id]);
        this.buildTunnel(opts.kitColor);
        this.buildStars(opts.stars);

        this.manager = new ManagerView(opts.look ?? defaultLook(opts.kitColor));
        this.scene.add(this.manager.group, this.particles.mesh);
    }

    /** The manager celebrates, with a burst of confetti. */
    celebrate(tweens: Phaser.Tweens.TweenManager, id: CelebrationId): void {
        const p = this.manager.group.position;
        this.particles.burst(p.x, 1.6, p.z, { count: 50, colors: [0xff3b3b, 0xffd21f, 0x2f8cff, 0x3ddc4a, 0xff5c9e, 0xffffff], speed: 4, up: 5, life: 1.4, gravity: 6, size: 0.12 });
        this.manager.celebrate(tweens, id);
    }

    /** Walls under the stands, with the stands rising behind them in the club's colours. */
    private buildWalls(opts: ConcourseOptions): void {
        const length = FLOOR_NEAR - FLOOR_FAR;
        const midZ = (FLOOR_NEAR + FLOOR_FAR) / 2;
        const tier = opts.stadiumTier;
        const clubShare = [0, 0, 0.2, 0.5, 0.7, 0.85][Math.min(5, tier)];
        const crowd = crowdTexture({ fill: opts.crowdFill, club: tier >= 2 ? opts.kitColor : undefined, clubShare });
        for (const side of [-1, 1]) {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, length), new THREE.MeshLambertMaterial({ color: 0x3d5a99 }));
            wall.position.set(side * WALL_X, 1.6, midZ);
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.35, length), new THREE.MeshLambertMaterial({ color: opts.kitColor }));
            stripe.position.set(side * WALL_X, 2.9, midZ);
            const tex = crowd.clone();
            tex.repeat.set(1, length / 6);
            tex.needsUpdate = true;
            const stand = new THREE.Mesh(new THREE.PlaneGeometry(9, length).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex }));
            stand.rotation.z = side * 0.6;
            stand.position.set(side * (WALL_X + 3.6), 3.2 + 2.5, midZ);
            this.scene.add(wall, stripe, stand);
        }
        // The entrance behind the manager.
        const back = new THREE.Mesh(new THREE.BoxGeometry(WALL_X * 2, 3.2, 0.4), new THREE.MeshLambertMaterial({ color: 0x3d5a99 }));
        back.position.set(0, 1.6, FLOOR_NEAR);
        this.scene.add(back);
    }

    private buildStall(id: StallId, side: -1 | 1, z: number, color: number, vendorShirt: number): void {
        const x = side * CONCOURSE.counterX;
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.userData.stall = id;

        // Counter: base in the stall colour with a white top.
        const counter = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 3), new THREE.MeshLambertMaterial({ color }));
        counter.position.y = 0.5;
        const top = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 3.2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
        top.position.y = 1.06;
        // Back wall of the booth, posts and a striped awning sloping towards the walkway.
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 3.4), new THREE.MeshLambertMaterial({ color: 0xf4f7fb }));
        backWall.position.set(side * 1.25, 1.3, 0);
        const awning = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 3.6), [
            ...Array(2).fill(new THREE.MeshLambertMaterial({ color })),
            new THREE.MeshLambertMaterial({ map: awningTexture(color) }),
            new THREE.MeshLambertMaterial({ map: awningTexture(color) }),
            ...Array(2).fill(new THREE.MeshLambertMaterial({ color }))
        ]);
        awning.position.set(side * 0.45, 2.55, 0);
        awning.rotation.z = side * 0.28;
        const postMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        group.add(counter, top, backWall, awning);
        for (const pz of [-1.6, 1.6]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5, 0.12), postMat);
            post.position.set(-side * 0.4, 1.25, pz);
            group.add(post);
        }
        // Sign facing the walkway, above the awning.
        const signLabel = STALLS.find((s) => s.id === id)!.label;
        // Faces down the concourse towards the camera, turned a little to the walkway.
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: stallSignTexture(signLabel, color), transparent: true }));
        sign.position.set(-side * 0.45, 3.1, 1.5);
        sign.rotation.y = -side * 0.55;
        group.add(sign);
        this.scene.add(group);
        this.pickables.push(group);

        // The vendor behind the counter, facing the walkway.
        this.folk.push({
            pose: makePose({ x: side * (CONCOURSE.counterX + 0.65), z, rotY: side * (Math.PI / 2), phase: Math.random() * 6 }),
            colors: { shirt: vendorShirt, shorts: 0x1b2a5c, hair: [0x3e2723, 0x1a1a1a, 0xd35400, 0xf2c94c][this.folk.length % 4] },
            star: false
        });
    }

    private buildTunnel(kitColor: number): void {
        const z = CONCOURSE.tunnelZ - 2;
        const mat = new THREE.MeshLambertMaterial({ color: 0x3d5a99 });
        const group = new THREE.Group();
        group.userData.stall = 'tunnel';
        for (const side of [-1, 1]) {
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(WALL_X - CONCOURSE.tunnelHalfWidth - 0.2, 4.2, 0.8), mat);
            pillar.position.set(side * (CONCOURSE.tunnelHalfWidth + 0.1 + (WALL_X - CONCOURSE.tunnelHalfWidth - 0.2) / 2), 2.1, z);
            group.add(pillar);
        }
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(WALL_X * 2, 1.2, 0.8), mat);
        lintel.position.set(0, 3.6, z);
        group.add(lintel);
        // Through the tunnel: a glimpse of the green pitch in sunlight.
        const tex = pitchTexture();
        tex.repeat.set(1, 2);
        const pitch = new THREE.Mesh(new THREE.PlaneGeometry(CONCOURSE.tunnelHalfWidth * 2 + 0.2, 3).rotateY(0), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
        pitch.position.set(0, 1.5, z - 1.5);
        group.add(pitch);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshBasicMaterial({ map: stallSignTexture('TO THE PITCH', kitColor), transparent: true }));
        sign.position.set(0, 3.65, z + 0.42);
        group.add(sign);
        this.scene.add(group);
        this.pickables.push(group);
    }

    /** Signed stars hang around near the squad room, in their own looks. */
    private buildStars(stars: ConcourseOptions['stars']): void {
        stars.slice(0, STAR_SPOTS.length).forEach(({ look }, i) => {
            this.folk.push({
                pose: makePose({ ...STAR_SPOTS[i], rotY: -Math.PI / 2 + (i % 2) * 0.6, phase: i, scale: 0.95 }),
                colors: { shirt: 0xffffff, shorts: 0x1b2a5c, hair: look.hair, socks: look.socks },
                star: true
            });
        });
    }

    update(dt: number, pos: Vec2, heading: number, speed: number): void {
        this.time += dt;
        this.manager.update(dt, pos.x, pos.z, heading, speed);
        this.particles.update(dt);

        // Vendors and stars sway gently while they wait.
        this.folk.forEach(({ pose: p, star }, i) => {
            if (star) {
                p.y = Math.abs(Math.sin(this.time * 2.5 + p.phase)) * 0.04;
            } else {
                p.y = Math.abs(Math.sin(this.time * 2 + i)) * 0.03;
                p.armsOut = 0.15 + Math.sin(this.time * 1.5 + i) * 0.1;
            }
        });
        this.people.draw(
            this.folk.map((f) => f.pose),
            this.folk.map((f) => f.colors)
        );

        if (this.previewMode) {
            // In front of the manager, low, aimed below them so they sit in the top half
            // of the screen above the wardrobe sheet.
            this.camTarget.set(pos.x, 1.45, pos.z - 5);
            this.camera.position.lerp(this.camTarget, 1 - Math.exp(-8 * dt));
            this.camera.lookAt(pos.x, -0.15, pos.z);
        } else {
            // High three-quarter camera behind the manager, eased.
            this.camTarget.set(pos.x * 0.4, CAM_HEIGHT, Math.min(pos.z + CAM_BACK, FLOOR_NEAR + 1));
            this.camera.position.lerp(this.camTarget, 1 - Math.exp(-6 * dt));
            this.camera.lookAt(this.camera.position.x * 0.5, 0.9, this.camera.position.z - CAM_BACK - 5);
        }
        Stage.render(this.scene, this.camera);
    }

    setPreview(on: boolean): void {
        this.previewMode = on;
    }

    /** Puts the camera straight at its resting spot (no ease), e.g. on arrival. */
    snapCamera(pos: Vec2): void {
        this.camera.position.set(pos.x * 0.4, CAM_HEIGHT, Math.min(pos.z + CAM_BACK, FLOOR_NEAR + 1));
    }

    /** Projects a world point to Phaser game coordinates; null when behind the camera. */
    project(x: number, y: number, z: number): { x: number; y: number } | null {
        const p = this.v.set(x, y, z).project(this.camera);
        if (p.z > 1) return null;
        return { x: ((p.x + 1) / 2) * GAME_WIDTH, y: ((1 - p.y) / 2) * GAME_HEIGHT };
    }

    /** Head-height point above a stall's vendor, for speech bubbles. */
    vendorHead(id: StallId): { x: number; y: number; z: number } {
        const s = STALLS.find((st) => st.id === id)!;
        return { x: s.side * (CONCOURSE.counterX + 0.65), y: 2.1, z: s.z };
    }

    /** What a tap at a screen point hits: a stall, the tunnel, or a floor point. */
    pick(screenX: number, screenY: number): { stall: StallId | 'tunnel' } | { floor: Vec2 } | null {
        const ndc = new THREE.Vector2((screenX / GAME_WIDTH) * 2 - 1, -(screenY / GAME_HEIGHT) * 2 + 1);
        this.raycaster.setFromCamera(ndc, this.camera);
        const hits = this.raycaster.intersectObjects([...this.pickables, this.floor], true);
        for (const hit of hits) {
            let o: THREE.Object3D | null = hit.object;
            while (o && o.userData.stall === undefined) o = o.parent;
            if (o) return { stall: o.userData.stall as StallId | 'tunnel' };
            if (hit.object === this.floor) return { floor: { x: hit.point.x, z: hit.point.z } };
        }
        return null;
    }

    dispose(): void {
        this.manager.dispose();
        this.people.dispose();
        this.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                for (const m of mats) {
                    (m as THREE.MeshBasicMaterial).map?.dispose();
                    m.dispose();
                }
            }
        });
    }
}
