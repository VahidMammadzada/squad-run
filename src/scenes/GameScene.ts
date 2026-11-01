import * as Phaser from 'phaser';
import { Sfx } from '../audio/Sfx';
import { COLORS, PITCH_CENTER, START_SQUAD } from '../config';
import { getKit } from '../data/kits';
import { generateLevel, type LevelSpec } from '../game/levelGen';
import { touchesSquad } from '../game/formation';
import { applyModifier, modifierLabel } from '../game/modifiers';
import { COINS_PER_GOAL } from '../game/scoring';
import { runShootout } from '../game/shootout';
import { Squad } from '../game/Squad';
import { Progress } from '../state/Progress';
import { Stage } from '../three/Stage';
import { World3D } from '../three/World3D';
import { Hud } from '../ui/Hud';
import { textStyle } from '../ui/widgets';
import type { GameOverData } from './GameOverScene';
import type { LevelCompleteData } from './LevelCompleteScene';

type State = 'ready' | 'run' | 'charge' | 'shoot' | 'over' | 'done';

const STEER_GAIN = 1.4;
const KEY_STEER_SPEED = 700;
/** Coin pickup radius, pitch pixels. Generous: a near miss should still count. */
const COIN_RADIUS = 40;
const DEFENDER_RADIUS = 22;
/** Coins picked up within this many ms of each other count as a chain (rising pitch). */
const COIN_CHAIN_MS = 450;
const RED = '#ff5a5a';
const BLUE = '#5ab4ff';
const GOLD = '#ffd21f';
/** Goal line distance past the finish, and how far in front of it the squad stops to shoot. */
export const GOAL_DISTANCE = 900;
const SHOOT_DISTANCE = 560;

/**
 * Gameplay. All rules run in pitch pixels (x across, dist along the pitch);
 * World3D draws them in 3D underneath the Phaser HUD.
 */
export class GameScene extends Phaser.Scene {
    private level = 1;
    private state: State = 'ready';
    /** Distance run from the start line, in pitch pixels. */
    private dist = 0;
    private runCoins = 0;
    /** Coins shown in the HUD; lags runCoins while coins fly to the counter. */
    private shownCoins = 0;
    private coinChain = 0;
    private lastCoinAt = 0;
    private kitColor = 0;
    private spec!: LevelSpec;
    private squad!: Squad;
    private gatesPassed: boolean[] = [];
    private defendersDown: boolean[] = [];
    private coinsTaken: boolean[] = [];
    private world!: World3D;
    private hud!: Hud;
    private squadLabel!: Phaser.GameObjects.Text;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private dragStartX = 0;
    private dragStartTarget = 0;

    constructor() {
        super('Game');
    }

    init(data: { level?: number }): void {
        this.level = data.level ?? Progress.data.level;
        this.state = 'ready';
        this.dist = 0;
        this.runCoins = 0;
        this.shownCoins = 0;
        this.coinChain = 0;
        // The tween manager outlives restarts; undo a hit-stop that was cut short.
        this.tweens.timeScale = 1;
    }

    create(): void {
        this.spec = generateLevel(this.level);
        const kit = getKit(Progress.data.selectedKit);
        this.kitColor = kit.shirt;

        this.squad = new Squad(PITCH_CENTER, START_SQUAD);
        this.gatesPassed = this.spec.gates.map(() => false);
        this.defendersDown = this.spec.defenders.map(() => false);
        this.coinsTaken = this.spec.coins.map(() => false);

        this.world = new World3D(this, this.spec, kit.shirt, GOAL_DISTANCE);
        Stage.show();
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.world.dispose();
            Stage.hide();
        });

        this.squadLabel = this.add.text(0, 0, '', textStyle(58)).setOrigin(0.5).setDepth(50);
        this.hud = new Hud(this, this.level, kit.shirt);
        this.hud.setCoins(Progress.data.coins);
        this.hud.showHint('DRAG TO STEER');
        this.setSquadCount(START_SQUAD);

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.dragStartX = pointer.x;
            this.dragStartTarget = this.squad.targetX;
            this.beginRun();
        });
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.isDown || this.state !== 'run') return;
            this.squad.targetX = Squad.clampX(this.dragStartTarget + (pointer.x - this.dragStartX) * STEER_GAIN);
        });
        this.cursors = this.input.keyboard?.createCursorKeys();
    }

    update(_time: number, deltaMs: number): void {
        // Clamp so a hitch can't teleport the squad through a gate or defender.
        const dt = Math.min(deltaMs, 50) / 1000;

        if (this.cursors && (this.state === 'ready' || this.state === 'run')) {
            const dir = (this.cursors.right.isDown ? 1 : 0) - (this.cursors.left.isDown ? 1 : 0);
            if (dir !== 0) {
                this.beginRun();
                this.squad.targetX = Squad.clampX(this.squad.targetX + dir * KEY_STEER_SPEED * dt);
            }
        }

        if (this.state === 'run' || this.state === 'charge') {
            this.advance(dt);
        }
        this.squad.update(dt);
        const running = this.state === 'run' || this.state === 'charge';
        this.world.update(dt, this.squad.x, this.dist, this.squad.count, running);
        this.placeSquadLabel();
    }

    private beginRun(): void {
        if (this.state !== 'ready') return;
        this.state = 'run';
        this.hud.hideHint();
    }

    private placeSquadLabel(): void {
        const leader = this.world.squad.leaderPosition;
        const pos = this.world.project(leader.x, 1.9, leader.z);
        this.squadLabel.setVisible(pos !== null && this.state !== 'over');
        if (pos) this.squadLabel.setPosition(pos.x, pos.y);
    }

    private advance(dt: number): void {
        this.dist += this.spec.speed * dt;

        if (this.state === 'charge') {
            const stop = this.world.goalDist - SHOOT_DISTANCE;
            this.squad.targetX = PITCH_CENTER;
            if (this.dist >= stop) {
                this.dist = stop;
                this.startShootout();
            }
            return;
        }

        this.checkGates();
        this.checkDefenders();
        this.checkCoins();
        this.hud.setProgress(this.dist / this.spec.length);
        if (this.state === 'run' && this.dist >= this.spec.length) {
            this.state = 'charge';
            this.world.setBoost(true);
            this.world.confetti(this.spec.length);
            Sfx.play('win');
        }
    }

    private checkGates(): void {
        this.spec.gates.forEach((gate, i) => {
            if (this.gatesPassed[i] || this.dist < gate.y || this.state !== 'run') return;
            this.gatesPassed[i] = true;
            const side = this.squad.x < PITCH_CENTER ? 0 : 1;
            this.world.triggerGate(i, side);
            const mod = side === 0 ? gate.left : gate.right;
            const before = this.squad.count;
            const after = applyModifier(before, mod);
            const label = this.squadLabel;
            if (after >= before) {
                Sfx.play('gateGood');
                this.hud.popText(modifierLabel(mod), label.x, label.y - 40, BLUE);
                this.world.squadBurst(this.kitColor);
            } else {
                Sfx.play('gateBad');
                this.hud.popText(modifierLabel(mod), label.x, label.y - 40, RED);
                this.hud.flash(COLORS.gateBad, 0.2);
            }
            this.setSquadCount(after);
        });
    }

    private checkDefenders(): void {
        this.spec.defenders.forEach((d, i) => {
            if (this.defendersDown[i] || this.state !== 'run') return;
            if (!touchesSquad(d.x, d.y, this.squad.x, this.dist, this.squad.count, DEFENDER_RADIUS)) return;
            this.defendersDown[i] = true;
            this.world.knockDefender(i, this.squad.x);
            Sfx.play('hit');
            this.world.shake(0.18, 0.35);
            this.hud.flash(COLORS.gateBad, 0.25);
            this.hud.popText(`−${d.power}`, this.squadLabel.x, this.squadLabel.y - 40, RED, 60);
            this.setSquadCount(this.squad.count - d.power);
        });
    }

    private checkCoins(): void {
        this.spec.coins.forEach((coin, i) => {
            if (this.coinsTaken[i]) return;
            if (!touchesSquad(coin.x, coin.y, this.squad.x, this.dist, this.squad.count, COIN_RADIUS)) return;
            this.coinsTaken[i] = true;
            const at = this.world.coinPosition(i);
            const screen = this.world.project(at.x, at.y, at.z);
            this.world.collectCoin(i);
            this.runCoins++;
            this.coinChain = this.time.now - this.lastCoinAt < COIN_CHAIN_MS ? Math.min(this.coinChain + 1, 10) : 0;
            this.lastCoinAt = this.time.now;
            Sfx.play('coin', 1 + this.coinChain * 0.06);
            const arrive = () => {
                this.shownCoins++;
                this.hud.setCoins(Progress.data.coins + this.shownCoins);
            };
            if (screen) this.hud.flyCoin(screen.x, screen.y, arrive);
            else arrive();
        });
    }

    private setSquadCount(count: number): void {
        count = Math.max(0, count);
        this.squad.count = count;
        this.hud.setSquad(count);
        this.squadLabel.setText(String(count));
        this.tweens.add({ targets: this.squadLabel, scale: { from: 1.35, to: 1 }, duration: 180 });
        if (count === 0) this.gameOver();
    }

    private startShootout(): void {
        this.state = 'shoot';
        this.hud.setProgress(1);
        this.hud.showGoals(0);
        this.world.setBoost(false);
        this.hud.stamp('SHOOT!', GOLD);
        runShootout(this, this.world, this.squad.count, this.level, {
            onSquad: (count) => this.setSquadCount(count),
            onScore: (goals) => {
                this.hud.showGoals(goals);
                this.hud.stamp('GOAL!', GOLD);
                this.world.shake(0.15, 0.2);
                // Hit-stop: tweens (ball, keeper) nearly freeze for a moment.
                this.tweens.timeScale = 0.15;
                this.time.delayedCall(130, () => (this.tweens.timeScale = 1));
            },
            onDone: (goals) => this.finishLevel(goals)
        });
    }

    private finishLevel(goals: number): void {
        this.state = 'done';
        const goalBonus = goals * COINS_PER_GOAL;
        const { newBest } = Progress.completeLevel(goals, this.runCoins + goalBonus);
        Sfx.play('win');
        const data: LevelCompleteData = { level: this.level, goals, coinsCollected: this.runCoins, goalBonus, newBest };
        this.scene.pause();
        this.scene.launch('LevelComplete', data);
    }

    private gameOver(): void {
        if (this.state === 'over') return;
        this.state = 'over';
        this.world.squad.wipeOut();
        // Coins picked up before losing are kept.
        Progress.addCoins(this.runCoins);
        Sfx.play('lose');
        this.time.delayedCall(700, () => {
            const data: GameOverData = { level: this.level, coins: this.runCoins };
            this.scene.pause();
            this.scene.launch('GameOver', data);
        });
    }
}
