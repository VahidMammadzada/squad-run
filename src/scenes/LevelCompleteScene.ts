import * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { COLORS, GAME_WIDTH } from '../config';
import { Progress } from '../state/Progress';
import { createButton, createPanel, popIn, textStyle } from '../ui/widgets';

export interface LevelCompleteData {
    level: number;
    goals: number;
    coinsCollected: number;
    goalBonus: number;
    newBest: boolean;
}

/** Shown over the paused Game scene. */
export class LevelCompleteScene extends Phaser.Scene {
    private result!: LevelCompleteData;

    constructor() {
        super('LevelComplete');
    }

    init(data: LevelCompleteData): void {
        this.result = data;
    }

    create(): void {
        const cx = GAME_WIDTH / 2;
        const { level, goals, coinsCollected, goalBonus, newBest } = this.result;
        createPanel(this, 620, 800, COLORS.button);
        this.coinShower();

        this.add.text(cx, 325, `LEVEL ${level}
COMPLETE!`, textStyle(56)).setOrigin(0.5).setLineSpacing(-6);
        const goalsText = this.add.text(cx, 500, '0', textStyle(140, '#ffd21f')).setOrigin(0.5);
        popIn(this, goalsText, 150);
        this.add.text(cx, 590, goals === 1 ? 'GOAL' : 'GOALS', textStyle(40)).setOrigin(0.5);
        const coinRow = this.add.container(cx, 668, [
            this.add.image(-70, 0, TEX.coin).setScale(1.5),
            this.add.text(-40, 0, '+0', textStyle(44, '#ffd21f')).setOrigin(0, 0.5)
        ]);
        const coinsText = coinRow.list[1] as Phaser.GameObjects.Text;
        this.add.text(cx, 718, `${coinsCollected} collected + ${goalBonus} goal bonus`, textStyle(24, '#cfe3ff', false)).setOrigin(0.5);

        // Goals, then coins, count up.
        this.countUp(goalsText, goals, 150, '');
        this.countUp(coinsText, coinsCollected + goalBonus, 700, '+');
        if (newBest) {
            const best = this.add.text(cx, 776, 'NEW BEST!', textStyle(44, '#ffd21f')).setOrigin(0.5).setAngle(-4);
            popIn(this, best, 1300);
            this.tweens.add({ targets: best, angle: 4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 1650 });
        }

        createButton(this, cx, 872, 'NEXT LEVEL', () => this.scene.start('Game', { level: Progress.data.level }), {
            width: 420,
            height: 110,
            fontSize: 48,
            pulse: true
        });
        createButton(
            this,
            cx,
            988,
            'MENU',
            () => {
                this.scene.stop('Game');
                this.scene.start('Title');
            },
            { width: 260, height: 80, fontSize: 32, color: COLORS.buttonAlt }
        );
    }

    private coinShower(): void {
        for (let i = 0; i < 26; i++) {
            const coin = this.add.image(Phaser.Math.Between(30, GAME_WIDTH - 30), -40 - Math.random() * 300, TEX.coin).setScale(1.2 + Math.random());
            this.tweens.add({
                targets: coin,
                y: 1350,
                angle: Phaser.Math.Between(-360, 360),
                duration: Phaser.Math.Between(1100, 1800),
                delay: 200 + i * 35,
                ease: 'Quad.easeIn',
                onComplete: () => coin.destroy()
            });
        }
    }

    private countUp(text: Phaser.GameObjects.Text, to: number, delay: number, prefix: string): void {
        const counter = { value: 0 };
        this.tweens.add({
            targets: counter,
            value: to,
            delay,
            duration: Math.min(900, 120 + to * 25),
            ease: 'Cubic.easeOut',
            onUpdate: () => text.setText(`${prefix}${Math.round(counter.value)}`),
            onComplete: () => {
                text.setText(`${prefix}${to}`);
                this.tweens.add({ targets: text, scale: { from: 1.25, to: 1 }, duration: 250, ease: 'Back.easeOut' });
            }
        });
    }
}
