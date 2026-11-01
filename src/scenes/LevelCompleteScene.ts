import * as Phaser from 'phaser';
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
        createPanel(this, 620, 760);

        this.add.text(cx, 330, `LEVEL ${level}\nCOMPLETE!`, textStyle(56)).setOrigin(0.5);
        const goalsText = this.add.text(cx, 500, `${goals}`, textStyle(140, '#ffeb3b')).setOrigin(0.5);
        popIn(this, goalsText, 150);
        this.add.text(cx, 590, goals === 1 ? 'GOAL' : 'GOALS', textStyle(40)).setOrigin(0.5);
        this.add
            .text(cx, 670, `+${coinsCollected + goalBonus} COINS\n(${coinsCollected} collected + ${goalBonus} goal bonus)`, textStyle(28))
            .setOrigin(0.5);
        if (newBest) {
            const best = this.add.text(cx, 750, 'NEW BEST!', textStyle(40, '#ffeb3b')).setOrigin(0.5);
            popIn(this, best, 400);
        }

        createButton(this, cx, 860, 'NEXT LEVEL', () => this.scene.start('Game', { level: Progress.data.level }), {
            width: 420,
            height: 110,
            fontSize: 48
        });
        createButton(
            this,
            cx,
            985,
            'MENU',
            () => {
                this.scene.stop('Game');
                this.scene.start('Title');
            },
            { width: 260, height: 80, fontSize: 32, color: COLORS.buttonAlt }
        );
    }
}
