import * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { Sfx } from '../audio/Sfx';
import { CONCOURSE, headingOf, inTunnel, servePoint, stallAt, STALLS, stepToward, stepWalk, type StallId, type Vec2 } from '../club/concourse';
import { crowdFill } from '../club/fans';
import { canUpgradeStadium } from '../club/office';
import { starLook } from '../club/runModifiers';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { getKit } from '../data/kits';
import { Progress } from '../state/Progress';
import { ConcourseWorld } from '../three/ConcourseWorld';
import { Stage } from '../three/Stage';
import { createButton, drawChip, textStyle } from '../ui/widgets';
import { startNextLevel } from './nextLevel';

/** Drag further than this (px) and a touch becomes the joystick. */
const DRAG_START = 14;
/** Joystick radius (px): dragging this far is full speed. */
const STICK_RADIUS = 80;
/** A touch shorter than this (ms) that didn't drag is a tap. */
const TAP_MS = 350;

/**
 * The walkable stadium: the manager walks the concourse (drag = floating
 * joystick, tap = walk there). Standing at a stall opens its menu
 * (StallPanelScene); the tunnel or PLAY starts the next level.
 */
export class StadiumScene extends Phaser.Scene {
    private world!: ConcourseWorld;
    private pos: Vec2 = { ...CONCOURSE.spawn };
    private heading = 0;
    private target: Vec2 | null = null;
    /** The stall an auto-walk is heading for; other stalls on the way don't open. */
    private targetStall: StallId | null = null;
    private stick: { origin: Phaser.Math.Vector2; vec: Vec2 } | null = null;
    private stickGfx!: Phaser.GameObjects.Graphics;
    private press: { x: number; y: number; at: number } | null = null;
    /** Stall the manager is standing at; its menu opens once per visit. */
    private atStall: StallId | null = null;
    private panelOpen = false;
    private leaving = false;
    private openOnArrival: StallId | null = null;
    private coinText!: Phaser.GameObjects.Text;
    private fanText!: Phaser.GameObjects.Text;
    private bubbles = new Map<StallId, Phaser.GameObjects.Container>();
    private keys?: Phaser.Types.Input.Keyboard.CursorKeys;

    constructor() {
        super('Stadium');
    }

    init(data: { booth?: StallId }): void {
        this.pos = { ...CONCOURSE.spawn };
        this.heading = 0;
        this.target = null;
        this.targetStall = null;
        this.stick = null;
        this.press = null;
        this.atStall = null;
        this.panelOpen = false;
        this.leaving = false;
        this.bubbles.clear();
        // Coming back from the kit shop: stand at MERCH with its menu open.
        this.openOnArrival = data.booth ?? null;
        if (data.booth) {
            this.pos = servePoint(data.booth);
            this.atStall = data.booth;
        }
    }

    create(): void {
        const { selectedKit, stadiumTier, fans, roster } = Progress.data;
        const kit = getKit(selectedKit);
        this.world = new ConcourseWorld({
            kitColor: kit.shirt,
            stadiumTier,
            crowdFill: crowdFill(fans),
            stars: roster.map((star) => ({ star, look: starLook(star) }))
        });
        this.world.snapCamera(this.pos);
        Stage.show();
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scene.stop('StallPanel');
            this.world.dispose();
            Stage.hide();
        });

        this.createHud();
        this.stickGfx = this.add.graphics().setDepth(40);
        for (const s of STALLS) this.bubbles.set(s.id, this.add.container(0, 0).setDepth(30));
        this.refreshHud();

        this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
            if (over.length > 0 || this.panelOpen || this.leaving) return;
            this.press = { x: p.x, y: p.y, at: this.time.now };
        });
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (!this.press || !p.isDown) return;
            const dx = p.x - this.press.x;
            const dy = p.y - this.press.y;
            if (!this.stick && Math.hypot(dx, dy) > DRAG_START) {
                this.stick = { origin: new Phaser.Math.Vector2(this.press.x, this.press.y), vec: { x: 0, z: 0 } };
                this.target = null;
            }
            if (this.stick) {
                const len = Math.min(STICK_RADIUS, Math.hypot(dx, dy));
                const a = Math.atan2(dy, dx);
                // Screen up is down the concourse (-z); screen right is +x.
                this.stick.vec = { x: (Math.cos(a) * len) / STICK_RADIUS, z: (Math.sin(a) * len) / STICK_RADIUS };
            }
        });
        this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
            const press = this.press;
            this.press = null;
            if (this.stick) {
                this.stick = null;
                return;
            }
            if (press && this.time.now - press.at < TAP_MS) this.tap(p.x, p.y);
        });
        this.keys = this.input.keyboard?.createCursorKeys();
    }

    private createHud(): void {
        const g = this.add.graphics().setDepth(20);
        drawChip(g, GAME_WIDTH - 190, 26, 170, 64);
        drawChip(g, 20, 26, 190, 64);
        this.add.image(GAME_WIDTH - 152, 58, TEX.coin).setScale(1.3).setDepth(21);
        this.coinText = this.add.text(GAME_WIDTH - 40, 58, '', textStyle(36)).setOrigin(1, 0.5).setDepth(21);
        this.add.image(58, 58, TEX.fan).setScale(1.25).setDepth(21);
        this.fanText = this.add.text(190, 58, '', textStyle(36, '#ff8fb6')).setOrigin(1, 0.5).setDepth(21);
        this.add.text(GAME_WIDTH / 2, 132, 'MY STADIUM', textStyle(44)).setOrigin(0.5).setDepth(21).setAngle(-2);

        createButton(this, 120, 1192, 'MENU', () => this.leave(() => this.scene.start('Title')), {
            width: 180,
            height: 84,
            fontSize: 32,
            color: COLORS.buttonAlt
        }).setDepth(25);
        createButton(this, 450, 1180, `PLAY LEVEL ${Progress.data.level}`, () => this.play(), {
            width: 470,
            height: 112,
            fontSize: 46,
            pulse: true
        }).setDepth(25);
    }

    /** Coin target for flying-coin effects in stall panels. */
    get coinTarget(): { x: number; y: number } {
        return { x: GAME_WIDTH - 152, y: 58 };
    }

    bumpCoins(): void {
        this.refreshHud();
        this.tweens.add({ targets: this.coinText, scale: { from: 1.3, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    }

    /** Coin and fan counters, and the vendors' speech bubbles (things waiting for you). */
    refreshHud(): void {
        const { coins, fans, merchPending, roster, stadiumTier } = Progress.data;
        this.coinText.setText(String(coins));
        this.fanText.setText(String(fans));
        const injured = roster.filter((s) => s.injuredLevels > 0).length;
        const notes: Partial<Record<StallId, string>> = {
            merch: merchPending > 0 ? `+${merchPending}` : undefined,
            doctor: injured > 0 ? `${injured} HURT` : undefined,
            office: canUpgradeStadium(stadiumTier, coins, fans) === 'ok' ? 'UPGRADE!' : undefined,
            scout: roster.length === 0 ? 'NEW!' : undefined
        };
        for (const [id, bubble] of this.bubbles) {
            bubble.removeAll(true);
            const text = notes[id];
            if (!text) continue;
            const label = this.add.text(0, -4, text, textStyle(24, '#1b2a5c', false)).setOrigin(0.5);
            const w = label.width + 28;
            const g = this.add.graphics();
            g.fillStyle(COLORS.ink, 0.3).fillRoundedRect(-w / 2, -24, w, 44, 20);
            g.fillStyle(0xffffff).fillRoundedRect(-w / 2, -28, w, 44, 20);
            g.fillTriangle(-8, 14, 8, 14, 0, 26);
            g.lineStyle(3, COLORS.gateBad).strokeRoundedRect(-w / 2, -28, w, 44, 20);
            bubble.add([g, label]);
        }
    }

    private leave(go: () => void): void {
        if (this.leaving) return;
        this.leaving = true;
        go();
    }

    private play(): void {
        if (this.panelOpen) return;
        Sfx.play('click');
        this.leave(() => void startNextLevel(this));
    }

    /** Tap: a stall or the tunnel walks you there; the floor walks you to that spot. */
    private tap(x: number, y: number): void {
        const hit = this.world.pick(x, y);
        if (!hit) return;
        if ('stall' in hit) {
            if (hit.stall === 'tunnel') this.setTarget({ x: 0, z: CONCOURSE.zFar }, null);
            else this.walkTo(hit.stall);
        } else {
            this.setTarget(hit.floor, null);
        }
    }

    /** Auto-walks to a stall; its menu opens on arrival. */
    walkTo(stall: StallId): void {
        this.setTarget(servePoint(stall), stall);
        // Re-open even if we're already standing there.
        if (this.atStall === stall) this.atStall = null;
    }

    private setTarget(target: Vec2 | null, stall: StallId | null): void {
        this.target = target;
        this.targetStall = stall;
    }

    /** Called by StallPanelScene once its sheet has gone. */
    panelClosed(): void {
        this.panelOpen = false;
        this.refreshHud();
    }

    private openPanel(stall: StallId): void {
        this.panelOpen = true;
        this.setTarget(null, null);
        this.stick = null;
        Sfx.play('coin', 1.3);
        this.scene.launch('StallPanel', { stall });
    }

    update(_time: number, deltaMs: number): void {
        const dt = Math.min(deltaMs, 50) / 1000;
        const before = this.pos;

        if (!this.panelOpen && !this.leaving) {
            const keyDir = this.keys
                ? { x: (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0), z: (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0) }
                : { x: 0, z: 0 };
            if (this.stick || keyDir.x !== 0 || keyDir.z !== 0) {
                this.setTarget(null, null);
                this.pos = stepWalk(this.pos, this.stick?.vec ?? keyDir, dt);
            } else if (this.target) {
                const step = stepToward(this.pos, this.target, dt);
                this.pos = step.pos;
                if (step.arrived) this.target = null;
            }

            // Stall menus open when you arrive, once per visit. While auto-walking
            // to a stall, the ones passed on the way stay shut.
            let here = stallAt(this.pos);
            if (this.target && this.targetStall && here !== this.targetStall) here = null;
            if (here !== this.atStall) {
                this.atStall = here;
                if (here) this.openPanel(here);
            }
            if (this.openOnArrival) {
                const stall = this.openOnArrival;
                this.openOnArrival = null;
                this.atStall = stall;
                this.openPanel(stall);
            }
            if (inTunnel(this.pos)) this.play();
        }

        const dx = this.pos.x - before.x;
        const dz = this.pos.z - before.z;
        const moved = Math.hypot(dx, dz);
        this.heading = headingOf(dx, dz, this.heading);
        this.world.update(dt, this.pos, this.heading, moved > 0 ? Math.min(1, moved / (CONCOURSE.speed * dt)) : 0);
        this.drawStick();
        this.placeBubbles();
    }

    private drawStick(): void {
        const g = this.stickGfx;
        g.clear();
        if (!this.stick) return;
        const { origin, vec } = this.stick;
        g.fillStyle(0xffffff, 0.18).fillCircle(origin.x, origin.y, STICK_RADIUS);
        g.lineStyle(5, 0xffffff, 0.6).strokeCircle(origin.x, origin.y, STICK_RADIUS);
        g.fillStyle(0xffffff, 0.85).fillCircle(origin.x + vec.x * STICK_RADIUS, origin.y + vec.z * STICK_RADIUS, 34);
    }

    private placeBubbles(): void {
        const bob = Math.sin(this.time.now / 250) * 4;
        for (const [id, bubble] of this.bubbles) {
            const h = this.world.vendorHead(id);
            const p = this.world.project(h.x, h.y + 1.4, h.z);
            bubble.setVisible(p !== null && !this.panelOpen && p.y > 170 && p.y < GAME_HEIGHT - 180);
            if (p) bubble.setPosition(p.x, p.y + bob);
        }
    }
}
