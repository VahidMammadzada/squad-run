import type * as Phaser from 'phaser';
import * as THREE from 'three';
import { defaultManager, managerLook, type CelebrationId, type ManagerLook } from '../club/wardrobe';

export type { ManagerLook };

/** The default manager in a club tracksuit of the given kit colour. */
export function defaultLook(club: number): ManagerLook {
    return managerLook(defaultManager(), club);
}

// Same proportions as the players (FigureBatch), so the manager fits in.
const HIP_Y = 0.46;
const SHOULDER_Y = 0.88;
const STRIDE = 9;
/** Top of the head box. */
const HEAD_TOP = 1.24;

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

/**
 * The player's manager: one blocky character built from separate meshes (not
 * instanced), so hair styles, hats, accessories and outfit details can be
 * swapped by setLook(). Walks with the same swing-and-bob cycle as the players.
 */
export class ManagerView {
    readonly group = new THREE.Group();
    /** Everything above the feet that moves together; celebrations animate it. */
    readonly body = new THREE.Group();
    readonly legs: THREE.Group[] = [];
    readonly arms: THREE.Group[] = [];

    private readonly mats = {
        skin: new THREE.MeshLambertMaterial(),
        hair: new THREE.MeshLambertMaterial(),
        top: new THREE.MeshLambertMaterial(),
        trim: new THREE.MeshLambertMaterial(),
        trousers: new THREE.MeshLambertMaterial(),
        shoes: new THREE.MeshLambertMaterial()
    };
    /** Parts rebuilt by setLook. */
    private readonly styled = new THREE.Group();
    private readonly handR = new THREE.Group();
    private readonly handL = new THREE.Group();
    /** Materials reused across looks; parts rebuilt by setLook must not dispose them. */
    private readonly shared = new Set<THREE.Material>(Object.values(this.mats));
    private phase = 0;
    private run = 0;
    /** While a celebration plays, walking doesn't touch the limbs. */
    animating = false;

    constructor(look: ManagerLook) {
        const { skin, top, trim, trousers, shoes } = this.mats;
        // Legs and arms hang from their joints, so they swing around the hip/shoulder.
        for (const side of [-1, 1]) {
            const leg = new THREE.Group();
            leg.position.set(side * 0.09, HIP_Y, 0);
            this.add(leg, box(0.14, 0.4, 0.15), trousers, 0, -0.2, 0);
            this.add(leg, box(0.15, 0.07, 0.22), shoes, 0, -0.42, -0.03);
            this.legs.push(leg);
            this.body.add(leg);

            const arm = new THREE.Group();
            arm.position.set(side * 0.24, SHOULDER_Y, 0);
            this.add(arm, box(0.11, 0.3, 0.12), top, 0, -0.15, 0);
            this.add(arm, box(0.1, 0.09, 0.1), skin, 0, -0.34, 0);
            const hand = side === 1 ? this.handR : this.handL;
            hand.position.set(0, -0.38, 0);
            arm.add(hand);
            this.arms.push(arm);
            this.body.add(arm);
        }
        this.add(this.body, box(0.38, 0.44, 0.22), top, 0, 0.7, 0);
        this.add(this.body, box(0.3, 0.06, 0.23), trim, 0, 0.9, 0);
        this.add(this.body, box(0.34, 0.08, 0.2), trousers, 0, 0.47, 0);
        this.add(this.body, box(0.1, 0.06, 0.1), skin, 0, 0.95, 0);
        this.add(this.body, box(0.26, 0.26, 0.26), skin, 0, 1.11, 0);
        // Eyes, so it's clear which way the manager faces.
        const eyes = new THREE.MeshBasicMaterial({ color: 0x1b2a5c });
        this.add(this.body, box(0.04, 0.05, 0.01), eyes, -0.06, 1.13, -0.131);
        this.add(this.body, box(0.04, 0.05, 0.01), eyes, 0.06, 1.13, -0.131);
        this.body.add(this.styled);

        const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(0.3, 14).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })
        );
        shadow.position.y = 0.01;
        this.group.add(this.body, shadow);
        this.group.scale.setScalar(1.08);
        this.setLook(look);
    }

    private add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        parent.add(m);
        return m;
    }

    /** Recolours the body and rebuilds hair, hat, accessory and outfit details. */
    setLook(look: ManagerLook): void {
        this.mats.skin.color.setHex(look.skin);
        this.mats.hair.color.setHex(look.hair);
        this.mats.top.color.setHex(look.top);
        this.mats.trim.color.setHex(look.trim);
        this.mats.trousers.color.setHex(look.trousers);
        this.mats.shoes.color.setHex(look.shoes);

        for (const g of [this.styled, this.handR, this.handL]) {
            for (const child of [...g.children]) {
                g.remove(child);
                disposeTree(child, this.shared);
            }
        }
        const mat = (color: number) => new THREE.MeshLambertMaterial({ color });
        const s = this.styled;
        const hair = this.mats.hair;
        const hatOn = look.hat !== 'none' && look.hat !== 'headset';

        // Hair (a hat hides the top, so only the sides and back show).
        switch (look.hairStyle) {
            case 'short':
                if (!hatOn) this.add(s, box(0.28, 0.08, 0.28), hair, 0, HEAD_TOP + 0.03, 0.01);
                this.add(s, box(0.28, 0.12, 0.06), hair, 0, 1.19, 0.12);
                break;
            case 'buzz':
                if (!hatOn) this.add(s, box(0.27, 0.03, 0.27), hair, 0, HEAD_TOP + 0.01, 0);
                break;
            case 'curly':
                if (!hatOn) {
                    for (const [x, z] of [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]]) this.add(s, box(0.15, 0.12, 0.15), hair, x, HEAD_TOP + 0.04, z);
                }
                this.add(s, box(0.3, 0.14, 0.08), hair, 0, 1.18, 0.12);
                break;
            case 'long':
                if (!hatOn) this.add(s, box(0.29, 0.08, 0.29), hair, 0, HEAD_TOP + 0.03, 0.01);
                this.add(s, box(0.3, 0.34, 0.08), hair, 0, 1.06, 0.13);
                this.add(s, box(0.04, 0.2, 0.2), hair, -0.14, 1.12, 0.03);
                this.add(s, box(0.04, 0.2, 0.2), hair, 0.14, 1.12, 0.03);
                break;
            case 'mohawk':
                if (!hatOn) this.add(s, box(0.07, 0.16, 0.3), hair, 0, HEAD_TOP + 0.07, 0.01);
                break;
            case 'bald':
                break;
        }

        // Outfit details.
        if (look.outfit === 'suit' || look.outfit === 'gold') {
            this.add(s, box(0.14, 0.3, 0.01), mat(0xffffff), 0, 0.76, -0.112);
            this.add(s, box(0.05, 0.24, 0.01), mat(look.outfit === 'gold' ? 0x1b2a5c : look.club), 0, 0.74, -0.118);
        } else if (look.outfit === 'coat') {
            this.add(s, box(0.4, 0.3, 0.24), this.mats.top, 0, 0.36, 0);
            this.add(s, box(0.3, 0.1, 0.26), mat(look.club), 0, 0.92, 0);
        } else if (look.outfit === 'hoodie') {
            this.add(s, box(0.3, 0.16, 0.08), mat(look.trim), 0, 1.02, 0.13);
            this.add(s, box(0.3, 0.08, 0.01), mat(look.trim), 0, 0.62, -0.112);
        } else {
            // Tracksuit / retro: a zip line and stripes down the sleeves.
            this.add(s, box(0.04, 0.36, 0.01), this.mats.trim, 0, 0.7, -0.115);
        }

        // Hats.
        const club = mat(look.club);
        switch (look.hat) {
            case 'cap':
                this.add(s, box(0.29, 0.1, 0.29), club, 0, HEAD_TOP + 0.05, 0);
                this.add(s, box(0.26, 0.03, 0.14), club, 0, HEAD_TOP + 0.01, -0.19);
                break;
            case 'beanie':
                this.add(s, box(0.3, 0.14, 0.3), club, 0, HEAD_TOP + 0.05, 0);
                this.add(s, box(0.31, 0.05, 0.31), mat(0xffffff), 0, HEAD_TOP - 0.02, 0);
                this.add(s, box(0.08, 0.08, 0.08), mat(0xffffff), 0, HEAD_TOP + 0.15, 0);
                break;
            case 'flatcap':
                this.add(s, box(0.3, 0.06, 0.32), mat(0x6d4c41), 0, HEAD_TOP + 0.03, 0.01);
                this.add(s, box(0.26, 0.03, 0.1), mat(0x6d4c41), 0, HEAD_TOP + 0.01, -0.18);
                break;
            case 'headset': {
                const black = mat(0x263238);
                this.add(s, box(0.3, 0.04, 0.06), black, 0, HEAD_TOP + 0.03, 0);
                this.add(s, box(0.05, 0.1, 0.1), black, -0.15, 1.12, 0);
                this.add(s, box(0.05, 0.1, 0.1), black, 0.15, 1.12, 0);
                this.add(s, box(0.02, 0.02, 0.14), black, -0.15, 1.05, -0.08);
                break;
            }
            case 'tophat': {
                const black = mat(0x1a1a1a);
                this.add(s, box(0.38, 0.03, 0.38), black, 0, HEAD_TOP + 0.01, 0);
                this.add(s, box(0.24, 0.3, 0.24), black, 0, HEAD_TOP + 0.17, 0);
                this.add(s, box(0.25, 0.05, 0.25), club, 0, HEAD_TOP + 0.06, 0);
                break;
            }
            case 'none':
                break;
        }

        // Accessories.
        switch (look.accessory) {
            case 'whistle':
                this.add(s, box(0.02, 0.2, 0.01), mat(look.club), 0, 0.84, -0.115);
                this.add(s, box(0.06, 0.04, 0.05), mat(0xc0c7d2), 0, 0.73, -0.13);
                break;
            case 'clipboard':
                this.add(this.handR, box(0.04, 0.24, 0.18), mat(0x8d6e63), 0, -0.02, -0.08);
                this.add(this.handR, box(0.045, 0.18, 0.14), mat(0xffffff), 0, -0.02, -0.08);
                break;
            case 'sunglasses':
                this.add(s, box(0.24, 0.06, 0.02), mat(0x111111), 0, 1.13, -0.135);
                break;
            case 'scarf':
                this.add(s, box(0.3, 0.08, 0.26), club, 0, 0.93, 0);
                this.add(s, box(0.08, 0.3, 0.03), club, 0.08, 0.76, -0.125);
                this.add(s, box(0.08, 0.04, 0.035), mat(0xffffff), 0.08, 0.68, -0.125);
                break;
            case 'trophy': {
                const gold = mat(0xffd21f);
                this.add(this.handL, box(0.1, 0.03, 0.1), gold, 0, -0.05, -0.04);
                this.add(this.handL, new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), gold, 0, 0.0, -0.04);
                this.add(this.handL, new THREE.CylinderGeometry(0.1, 0.05, 0.14, 10), gold, 0, 0.11, -0.04);
                break;
            }
            case 'none':
                break;
        }
    }

    /**
     * Plays a celebration (about a second) with the scene's tweens, so it pauses
     * with the game. Walking leaves the limbs alone until it's done.
     */
    celebrate(tweens: Phaser.Tweens.TweenManager, id: CelebrationId, onDone?: () => void): void {
        if (this.animating) return;
        this.animating = true;
        this.resetPose();
        const [armL, armR] = this.arms;
        const [legL, legR] = this.legs;
        const body = this.body;
        type Step = { targets: object; duration: number; ease?: string; yoyo?: boolean; repeat?: number } & Record<string, unknown>;
        const steps: Step[] = [];
        const UP = 2.8;
        switch (id) {
            case 'fistpump':
                steps.push(
                    { targets: armR.rotation, z: UP, duration: 160, ease: 'Back.easeOut' },
                    { targets: armR.rotation, z: 1.9, duration: 140, yoyo: true, repeat: 2 },
                    { targets: body.position, y: 0.18, duration: 160, yoyo: true, ease: 'Quad.easeOut' }
                );
                break;
            case 'jump':
                steps.push(
                    { targets: [armL.rotation, armR.rotation], z: (_t: unknown, _k: string, _v: number, i: number) => (i === 0 ? -UP : UP), duration: 150 },
                    { targets: body.position, y: 0.55, duration: 220, yoyo: true, repeat: 1, ease: 'Quad.easeOut' }
                );
                break;
            case 'spin':
                steps.push(
                    { targets: [armL.rotation, armR.rotation], z: (_t: unknown, _k: string, _v: number, i: number) => (i === 0 ? -1.5 : 1.5), duration: 150 },
                    { targets: body.rotation, y: Math.PI * 2, duration: 700, ease: 'Cubic.easeInOut' }
                );
                break;
            case 'dance':
                steps.push(
                    { targets: [armL.rotation, armR.rotation], z: (_t: unknown, _k: string, _v: number, i: number) => (i === 0 ? -2.2 : 0.4), duration: 160 },
                    { targets: body.rotation, z: 0.25, duration: 170, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' },
                    { targets: [armL.rotation, armR.rotation], z: (_t: unknown, _k: string, _v: number, i: number) => (i === 0 ? -0.4 : 2.2), duration: 160 },
                    { targets: body.rotation, z: -0.25, duration: 170, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' }
                );
                break;
            case 'kneeslide':
                steps.push(
                    { targets: [armL.rotation, armR.rotation], z: (_t: unknown, _k: string, _v: number, i: number) => (i === 0 ? -UP : UP), duration: 150 },
                    { targets: [legL.rotation, legR.rotation], x: (_t: unknown, _k: string, _v: number, i: number) => (i === 0 ? -1.5 : 1.2), duration: 160 },
                    { targets: body.position, y: -0.22, z: -0.9, duration: 500, ease: 'Quad.easeOut' },
                    { targets: body.rotation, x: 0.35, duration: 250, yoyo: true }
                );
                break;
            case 'backflip':
                steps.push(
                    { targets: [armL.rotation, armR.rotation], z: (_t: unknown, _k: string, _v: number, i: number) => (i === 0 ? -UP : UP), duration: 140 },
                    { targets: body.position, y: 0.95, duration: 330, yoyo: true, ease: 'Quad.easeOut' }
                );
                // The flip itself turns alongside the jump.
                tweens.add({ targets: body.rotation, x: Math.PI * 2, delay: 140, duration: 640, ease: 'Sine.easeInOut' });
                break;
        }
        steps.push({ targets: body.position, y: body.position.y, duration: 220 });
        tweens.chain({
            tweens: steps as unknown as Phaser.Types.Tweens.TweenBuilderConfig[],
            onComplete: () => {
                this.resetPose();
                this.animating = false;
                onDone?.();
            }
        });
    }

    /** Back to standing: body square, limbs hanging. */
    private resetPose(): void {
        this.body.position.set(0, 0, 0);
        this.body.rotation.set(0, 0, 0);
        for (const limb of [...this.arms, ...this.legs]) limb.rotation.set(0, 0, 0);
    }

    /**
     * @param x,z world position on the floor
     * @param heading facing angle (0 = towards -z)
     * @param speed 0 = standing, 1 = full walking speed
     */
    update(dt: number, x: number, z: number, heading: number, speed: number): void {
        this.group.position.set(x, 0, z);
        // Turn smoothly towards the walking direction.
        let d = heading - this.group.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.group.rotation.y += d * (1 - Math.exp(-14 * dt));
        if (this.animating) return;

        this.run += (speed - this.run) * (1 - Math.exp(-12 * dt));
        this.phase += dt * STRIDE * Math.max(this.run, 0.0001);
        const swing = Math.sin(this.phase) * 0.7 * this.run;
        this.legs[0].rotation.x = swing;
        this.legs[1].rotation.x = -swing;
        this.arms[0].rotation.x = -swing * 0.8;
        this.arms[1].rotation.x = swing * 0.8;
        this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.05 * this.run;
    }

    dispose(): void {
        disposeTree(this.group);
        for (const m of Object.values(this.mats)) m.dispose();
    }
}

function disposeTree(root: THREE.Object3D, keep?: Set<THREE.Material>): void {
    root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const m = obj.material as THREE.Material;
            if (!keep?.has(m)) m.dispose();
        }
    });
}
