import * as Phaser from 'phaser';
import * as THREE from 'three';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, MAX_VISIBLE_MATES, PITCH_CENTER, PITCH_LEFT, PITCH_RIGHT } from '../config';
import type { LevelSpec } from '../game/levelGen';
import { isGood, modifierLabel, type Modifier } from '../game/modifiers';
import { FigureBatch, makePose, type Pose } from './FigureBatch';
import { SquadView } from './SquadView';
import { Stage } from './Stage';
import { badgeTexture, ballTexture, checkerTexture, gateTexture, netTexture, pitchTexture } from './textures';
import { toWorld, units } from './units';

/** Half the width of the goal mouth, in pitch pixels. */
export const GOAL_HALF_WIDTH = 140;
const GOAL_HEIGHT = 1.3;
const GOAL_DEPTH = 0.9;
const PITCH_HALF = units(PITCH_RIGHT - PITCH_LEFT) / 2;

interface GateView {
    panels: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[];
}

interface DefenderView {
    pose: Pose;
    badge: THREE.Sprite;
    down: boolean;
}

interface CoinView {
    x: number;
    y: number;
    z: number;
    scale: number;
}

/**
 * Everything 3D for one level: pitch, gates, defenders, coins, goal, keeper,
 * squad and camera. Positions come in as pitch pixels / distance (see units.ts).
 * Animations run on the Phaser scene's tweens, so they pause with the game.
 */
export class World3D {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(55, GAME_WIDTH / GAME_HEIGHT, 0.1, 120);
    readonly squad: SquadView;
    /** Distance of the goal line from the start, in pitch pixels. */
    readonly goalDist: number;

    private readonly tweens: Phaser.Tweens.TweenManager;
    private readonly gates: GateView[] = [];
    private readonly defenders: DefenderView[] = [];
    private readonly defenderBatch: FigureBatch;
    private readonly coins: CoinView[];
    private readonly coinMesh: THREE.InstancedMesh;
    private readonly keeperBatch: FigureBatch;
    private readonly keeper: Pose;
    private readonly net: THREE.MeshBasicMaterial;
    /** Net materials that flash when a goal goes in. */
    private netFlash: THREE.MeshBasicMaterial[] = [];
    private readonly ballMaterial: THREE.MeshLambertMaterial;
    private keeperBusy = false;
    private time = 0;
    private camX = 0;
    private shakeLeft = 0;

    // Scratch objects reused every frame.
    private readonly m = new THREE.Matrix4();
    private readonly q = new THREE.Quaternion();
    private readonly v = new THREE.Vector3();
    private readonly s = new THREE.Vector3();
    private readonly up = new THREE.Vector3(0, 1, 0);

    constructor(phaserScene: Phaser.Scene, spec: LevelSpec, kitColor: number, goalDistance: number) {
        this.tweens = phaserScene.tweens;
        this.goalDist = spec.length + goalDistance;
        const goalZ = -units(this.goalDist);

        this.scene.background = new THREE.Color(0x8fd3ff);
        this.scene.fog = new THREE.Fog(0x8fd3ff, 25, 70);
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x4a7a4a, 2.2));
        const sun = new THREE.DirectionalLight(0xffffff, 1.6);
        sun.position.set(4, 10, 6);
        this.scene.add(sun);

        this.buildStadium(goalZ);
        this.buildFinishLine(-units(spec.length));
        this.ballMaterial = new THREE.MeshLambertMaterial({ map: ballTexture() });

        for (const g of spec.gates) this.gates.push(this.buildGate(g.y, [g.left, g.right]));

        this.defenderBatch = new FigureBatch(spec.defenders.length, { shirt: COLORS.defender, shorts: 0x111111, socks: 0x111111 });
        this.scene.add(this.defenderBatch.group);
        for (const d of spec.defenders) {
            const p = toWorld(d.x, d.y);
            const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture(`−${d.power}`, 0xd32f2f), depthTest: false }));
            badge.scale.set(0.7, 0.35, 1);
            badge.position.set(p.x, 1.6, p.z);
            this.scene.add(badge);
            this.defenders.push({ pose: makePose({ x: p.x, z: p.z, rotY: Math.PI, phase: Math.random() * 6, scale: 0.9 }), badge, down: false });
        }

        this.coins = spec.coins.map((c) => ({ ...toWorld(c.x, c.y), y: 0.45, scale: 1 }));
        this.coinMesh = new THREE.InstancedMesh(
            new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20).rotateX(Math.PI / 2),
            new THREE.MeshLambertMaterial({ color: COLORS.coin, emissive: 0x6d4c00 }),
            Math.max(1, this.coins.length)
        );
        this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.coinMesh.frustumCulled = false;
        this.scene.add(this.coinMesh);

        this.net = new THREE.MeshBasicMaterial({ map: netTexture(), transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
        this.buildGoal(goalZ);
        this.keeperBatch = new FigureBatch(1, { shirt: 0x111111, shorts: 0x111111, socks: 0x111111 });
        this.keeper = makePose({ z: goalZ + 0.4, rotY: Math.PI, armsOut: 0.45 });
        this.scene.add(this.keeperBatch.group);

        this.squad = new SquadView(kitColor, this.ballMaterial, MAX_VISIBLE_MATES);
        this.scene.add(this.squad.group);
    }

    private buildStadium(goalZ: number): void {
        const start = 25;
        const end = goalZ - 20;
        const length = start - end;
        const midZ = (start + end) / 2;

        const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, length + 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2f7d32 }));
        ground.position.set(0, -0.02, midZ);
        this.scene.add(ground);

        const tex = pitchTexture();
        tex.repeat.set(1, length / 6);
        const pitch = new THREE.Mesh(new THREE.PlaneGeometry(PITCH_HALF * 2 + 0.2, length).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex }));
        pitch.position.set(0, 0, midZ);
        this.scene.add(pitch);

        // Advertising boards and a stand on each side.
        const boardMat = new THREE.MeshLambertMaterial({ color: 0x1565c0 });
        const standMat = new THREE.MeshLambertMaterial({ color: 0x546e7a });
        for (const side of [-1, 1]) {
            const board = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, length), boardMat);
            board.position.set(side * (PITCH_HALF + 1.2), 0.25, midZ);
            const stand = new THREE.Mesh(new THREE.BoxGeometry(6, 3, length), standMat);
            stand.position.set(side * (PITCH_HALF + 5), 1.2, midZ);
            stand.rotation.z = side * 0.35;
            this.scene.add(board, stand);
        }
    }

    private buildFinishLine(z: number): void {
        const tex = checkerTexture(16, 2);
        const line = new THREE.Mesh(new THREE.PlaneGeometry(PITCH_HALF * 2, 0.6).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex }));
        line.position.set(0, 0.01, z);
        this.scene.add(line);
    }

    private buildGate(dist: number, mods: [Modifier, Modifier]): GateView {
        const z = -units(dist);
        const width = PITCH_HALF - 0.1;
        const height = 1.5;
        const panels = mods.map((mod, side) => {
            const mat = new THREE.MeshBasicMaterial({
                map: gateTexture(modifierLabel(mod), isGood(mod) ? COLORS.gateGood : COLORS.gateBad),
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
            panel.position.set((side === 0 ? -1 : 1) * (PITCH_HALF / 2), height / 2, z);
            this.scene.add(panel);
            return panel;
        });
        const postMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        for (const x of [-PITCH_HALF, 0, PITCH_HALF]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, height + 0.1, 0.1), postMat);
            post.position.set(x, (height + 0.1) / 2, z);
            this.scene.add(post);
        }
        return { panels };
    }

    private buildGoal(lineZ: number): void {
        const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const halfW = units(GOAL_HALF_WIDTH);

        // Goal line, penalty box and six-yard box, as thin strips on the grass.
        const strip = (x: number, z: number, w: number, d: number) => {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), lineMat);
            m.position.set(x, 0.015, z);
            this.scene.add(m);
        };
        const rect = (w: number, d: number) => {
            strip(-w / 2, lineZ + d / 2, 0.07, d);
            strip(w / 2, lineZ + d / 2, 0.07, d);
            strip(0, lineZ + d, w, 0.07);
        };
        strip(0, lineZ, PITCH_HALF * 2, 0.07);
        rect(units(440), units(300));
        rect(units(240), units(110));

        // Frame.
        const post = new THREE.CylinderGeometry(0.06, 0.06, GOAL_HEIGHT, 8);
        for (const x of [-halfW, halfW]) {
            const p = new THREE.Mesh(post, white);
            p.position.set(x, GOAL_HEIGHT / 2, lineZ);
            this.scene.add(p);
        }
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, halfW * 2 + 0.12, 8).rotateZ(Math.PI / 2), white);
        bar.position.set(0, GOAL_HEIGHT, lineZ);
        this.scene.add(bar);

        // Net: back, top and sides.
        const netPlane = (w: number, h: number, repeatX: number, repeatY: number): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> => {
            const mat = this.net.clone();
            mat.map = this.net.map!.clone();
            mat.map.repeat.set(repeatX, repeatY);
            mat.map.needsUpdate = true;
            return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        };
        const back = netPlane(halfW * 2, GOAL_HEIGHT, 14, 6);
        back.position.set(0, GOAL_HEIGHT / 2, lineZ - GOAL_DEPTH);
        const top = netPlane(halfW * 2, GOAL_DEPTH, 14, 4);
        top.rotation.x = Math.PI / 2;
        top.position.set(0, GOAL_HEIGHT, lineZ - GOAL_DEPTH / 2);
        this.scene.add(back, top);
        for (const x of [-halfW, halfW]) {
            const side = netPlane(GOAL_DEPTH, GOAL_HEIGHT, 4, 6);
            side.rotation.y = Math.PI / 2;
            side.position.set(x, GOAL_HEIGHT / 2, lineZ - GOAL_DEPTH / 2);
            this.scene.add(side);
        }
        this.netFlash = [back.material, top.material];
    }

    /**
     * @param squadX leader position, pitch pixels
     * @param dist distance run, pitch pixels
     */
    update(dt: number, squadX: number, dist: number, count: number, running: boolean): void {
        this.time += dt;
        this.squad.update(dt, squadX, dist, count, running);

        for (const d of this.defenders) {
            if (!d.down) d.pose.phase += dt * 2;
            // A slow side-to-side shuffle while waiting.
            d.pose.run = d.down ? 0 : 0.12;
        }
        this.defenderBatch.draw(this.defenders.map((d) => d.pose));

        this.q.setFromAxisAngle(this.up, this.time * 3);
        this.coins.forEach((c, i) => {
            this.m.compose(this.v.set(c.x, c.y + Math.sin(this.time * 3 + i) * 0.05, c.z), this.q, this.s.setScalar(c.scale));
            this.coinMesh.setMatrixAt(i, this.m);
        });
        this.coinMesh.count = this.coins.length;
        this.coinMesh.instanceMatrix.needsUpdate = true;

        if (!this.keeperBusy) {
            this.keeper.x = Math.sin(this.time * 1.8) * 0.5;
            this.keeper.phase += dt * 3;
            this.keeper.run = 0.1;
        }
        this.keeperBatch.draw([this.keeper]);

        // Camera rides behind and above the squad, drifting a little with it sideways.
        const leader = toWorld(squadX, dist);
        this.camX += (leader.x * 0.35 - this.camX) * (1 - Math.exp(-4 * dt));
        this.camera.position.set(this.camX, 7.6, leader.z + 8.2);
        this.camera.lookAt(this.camX * 0.6, 0, leader.z - 7.5);
        if (this.shakeLeft > 0) {
            this.shakeLeft -= dt;
            this.camera.position.x += (Math.random() - 0.5) * 0.25;
            this.camera.position.y += (Math.random() - 0.5) * 0.25;
        }

        Stage.render(this.scene, this.camera);
    }

    shake(seconds: number): void {
        this.shakeLeft = seconds;
    }

    /** Projects a world point to Phaser game coordinates; null when behind the camera. */
    project(x: number, y: number, z: number): { x: number; y: number } | null {
        const p = this.v.set(x, y, z).project(this.camera);
        if (p.z > 1) return null;
        return { x: ((p.x + 1) / 2) * GAME_WIDTH, y: ((1 - p.y) / 2) * GAME_HEIGHT };
    }

    triggerGate(index: number, side: 0 | 1): void {
        const { panels } = this.gates[index];
        this.tweens.add({ targets: panels[side].scale, x: 1.15, y: 1.15, duration: 250 });
        this.tweens.add({ targets: panels[side].material, opacity: 0, duration: 250 });
        this.tweens.add({ targets: panels[1 - side].material, opacity: 0.3, duration: 250 });
    }

    knockDefender(index: number, fromX: number): void {
        const d = this.defenders[index];
        d.down = true;
        const dir = d.pose.x < units(fromX - PITCH_CENTER) ? -1 : 1;
        this.tweens.add({ targets: d.pose, x: d.pose.x + dir * 2.2, z: d.pose.z - 1, roll: -dir * 1.6, duration: 450, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: d.pose, y: 0.9, duration: 220, yoyo: true, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: d.pose, scale: 0, delay: 350, duration: 200 });
        this.tweens.add({ targets: d.badge.material, opacity: 0, duration: 200 });
    }

    collectCoin(index: number): void {
        const c = this.coins[index];
        this.tweens.add({ targets: c, y: 1.6, scale: 0, duration: 260, ease: 'Quad.easeOut' });
    }

    // --- Shootout ---

    keeperTo(x: number, duration: number, dive: boolean): void {
        this.keeperBusy = true;
        const wx = units(x - PITCH_CENTER);
        this.tweens.killTweensOf(this.keeper);
        this.tweens.add({
            targets: this.keeper,
            x: wx,
            roll: dive ? (wx < this.keeper.x ? 1 : -1) * 1.1 : 0,
            y: dive ? 0.3 : 0,
            armsOut: 1,
            duration,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.tweens.add({ targets: this.keeper, roll: 0, y: 0, armsOut: 0.45, delay: 120, duration: 200 });
            }
        });
    }

    /** Fires a ball from the leader at `x` (pitch pixels) on the goal line. */
    shoot(x: number, isGoal: boolean, onArrive: () => void): void {
        const from = this.squad.ballPosition.clone();
        const lineZ = -units(this.goalDist);
        const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), this.ballMaterial);
        ball.position.copy(from);
        this.scene.add(ball);
        const pos = ball.position;
        const remove = () => {
            this.scene.remove(ball);
            ball.geometry.dispose();
        };
        this.tweens.add({
            targets: pos,
            x: units(x - PITCH_CENTER),
            y: Phaser.Math.FloatBetween(0.3, GOAL_HEIGHT - 0.3),
            z: lineZ - (isGoal ? GOAL_DEPTH * 0.7 : -0.3),
            duration: 320,
            ease: 'Quad.easeOut',
            onComplete: () => {
                onArrive();
                if (isGoal) {
                    this.tweens.add({ targets: pos, y: 0.13, duration: 250, ease: 'Bounce.easeOut', onComplete: () => this.tweens.add({ targets: ball.scale, x: 0, y: 0, z: 0, delay: 300, duration: 200, onComplete: remove }) });
                } else {
                    this.tweens.add({ targets: pos, x: pos.x + Phaser.Math.FloatBetween(-3, 3), z: pos.z + 3, y: 0.13, duration: 450, ease: 'Quad.easeOut' });
                    this.tweens.add({ targets: ball.scale, x: 0, y: 0, z: 0, delay: 300, duration: 200, onComplete: remove });
                }
            }
        });
    }

    flashNet(): void {
        for (const mat of this.netFlash) {
            this.tweens.add({ targets: mat, opacity: { from: 1, to: 0.6 }, duration: 300 });
            this.tweens.add({ targets: mat.color, r: { from: 1, to: 1 }, g: { from: 0.9, to: 1 }, b: { from: 0.2, to: 1 }, duration: 300 });
        }
    }

    dispose(): void {
        this.tweens.killTweensOf([this.keeper, ...this.coins, ...this.defenders.map((d) => d.pose)]);
        this.scene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            const mats = mesh.material ? ([] as THREE.Material[]).concat(mesh.material) : [];
            for (const mat of mats) {
                (mat as THREE.MeshBasicMaterial).map?.dispose();
                mat.dispose();
            }
        });
    }
}
