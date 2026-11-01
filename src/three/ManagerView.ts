import * as THREE from 'three';

/** Everything that decides how the manager looks. S2's wardrobe fills this from the save. */
export interface ManagerLook {
    skin: number;
    hair: number;
    /** Jacket / top colour. */
    top: number;
    /** Trim on the top (collar, stripes). */
    trim: number;
    trousers: number;
    shoes: number;
}

export const DEFAULT_LOOK: ManagerLook = {
    skin: 0xe0ac69,
    hair: 0x3e2723,
    top: 0x2f6fed,
    trim: 0xffffff,
    trousers: 0x1b2a5c,
    shoes: 0x1a1a1a
};

// Same proportions as the players (FigureBatch), so the manager fits in.
const HIP_Y = 0.46;
const SHOULDER_Y = 0.88;
const STRIDE = 9;

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

/**
 * The player's manager: one blocky character built from separate meshes (not
 * instanced), so parts like hair, hats and accessories can be swapped. Walks
 * with the same swing-and-bob cycle as the players.
 */
export class ManagerView {
    readonly group = new THREE.Group();

    private readonly body = new THREE.Group();
    private readonly legs: THREE.Group[] = [];
    private readonly arms: THREE.Group[] = [];
    private readonly mats = {
        skin: new THREE.MeshLambertMaterial(),
        hair: new THREE.MeshLambertMaterial(),
        top: new THREE.MeshLambertMaterial(),
        trim: new THREE.MeshLambertMaterial(),
        trousers: new THREE.MeshLambertMaterial(),
        shoes: new THREE.MeshLambertMaterial()
    };
    private phase = 0;
    private run = 0;

    constructor(look: ManagerLook = DEFAULT_LOOK) {
        const { skin, hair, top, trim, trousers, shoes } = this.mats;
        const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, z);
            parent.add(m);
            return m;
        };

        // Legs and arms hang from their joints, so they swing around the hip/shoulder.
        for (const side of [-1, 1]) {
            const leg = new THREE.Group();
            leg.position.set(side * 0.09, HIP_Y, 0);
            add(leg, box(0.14, 0.4, 0.15), trousers, 0, -0.2, 0);
            add(leg, box(0.15, 0.07, 0.22), shoes, 0, -0.42, -0.03);
            this.legs.push(leg);
            this.body.add(leg);

            const arm = new THREE.Group();
            arm.position.set(side * 0.24, SHOULDER_Y, 0);
            add(arm, box(0.11, 0.3, 0.12), top, 0, -0.15, 0);
            add(arm, box(0.1, 0.09, 0.1), skin, 0, -0.34, 0);
            this.arms.push(arm);
            this.body.add(arm);
        }
        add(this.body, box(0.38, 0.44, 0.22), top, 0, 0.7, 0);
        // Collar and zip in the trim colour.
        add(this.body, box(0.3, 0.06, 0.23), trim, 0, 0.9, 0);
        add(this.body, box(0.04, 0.36, 0.01), trim, 0, 0.7, -0.115);
        add(this.body, box(0.34, 0.08, 0.2), trousers, 0, 0.47, 0);
        add(this.body, box(0.1, 0.06, 0.1), skin, 0, 0.95, 0);
        add(this.body, box(0.26, 0.26, 0.26), skin, 0, 1.11, 0);
        add(this.body, box(0.28, 0.08, 0.28), hair, 0, 1.27, 0.01);
        add(this.body, box(0.28, 0.12, 0.06), hair, 0, 1.19, 0.12);
        // Eyes, so it's clear which way the manager faces.
        const eyes = new THREE.MeshBasicMaterial({ color: 0x1b2a5c });
        add(this.body, box(0.04, 0.05, 0.01), eyes, -0.06, 1.13, -0.131);
        add(this.body, box(0.04, 0.05, 0.01), eyes, 0.06, 1.13, -0.131);

        const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(0.3, 14).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })
        );
        shadow.position.y = 0.01;
        this.group.add(this.body, shadow);
        this.group.scale.setScalar(1.08);
        this.setLook(look);
    }

    setLook(look: ManagerLook): void {
        for (const key of Object.keys(this.mats) as (keyof ManagerLook)[]) this.mats[key].color.setHex(look[key]);
    }

    /**
     * @param x,z world position on the floor
     * @param heading facing angle (0 = towards -z)
     * @param speed 0 = standing, 1 = full walking speed
     */
    update(dt: number, x: number, z: number, heading: number, speed: number): void {
        this.run += (speed - this.run) * (1 - Math.exp(-12 * dt));
        this.phase += dt * STRIDE * Math.max(this.run, 0.0001);
        const swing = Math.sin(this.phase) * 0.7 * this.run;
        this.legs[0].rotation.x = swing;
        this.legs[1].rotation.x = -swing;
        this.arms[0].rotation.x = -swing * 0.8;
        this.arms[1].rotation.x = swing * 0.8;
        this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.05 * this.run;
        this.group.position.set(x, 0, z);
        // Turn smoothly towards the walking direction.
        let d = heading - this.group.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.group.rotation.y += d * (1 - Math.exp(-14 * dt));
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
