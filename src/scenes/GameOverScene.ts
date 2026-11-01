import * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { COLORS, GAME_WIDTH } from '../config';
import { createButton, createPanel, textStyle } from '../ui/widgets';

export interface GameOverData {
    level: number;
    coins: number;
}

/** Shown over the paused Game scene when the squad is wiped out. */
export class GameOverScene extends Phaser.Scene {
    private result!: GameOverData;

    constructor() {
        super('GameOver');
    }

    init(data: GameOverData): void {
        this.result = data;
    }

    create(): void {
        const cx = GAME_WIDTH / 2;
        createPanel(this, 600, 620, COLORS.gateBad, 190);

        this.add.text(cx, 425, 'SQUAD\nLOST!', textStyle(68)).setOrigin(0.5).setLineSpacing(-8);
        this.add.text(cx, 565, `LEVEL ${this.result.level}`, textStyle(36)).setOrigin(0.5);
        this.add.container(cx, 625, [
            this.add.image(-150, 0, TEX.coin).setScale(1.3),
            this.add.text(-125, 0, `+${this.result.coins} COINS KEPT`, textStyle(32, '#ffd21f')).setOrigin(0, 0.5)
        ]);

        createButton(this, cx, 748, 'RETRY', () => this.scene.start('Game', { level: this.result.level }), {
            width: 400,
            height: 110,
            fontSize: 52,
            pulse: true
        });
        createButton(
            this,
            cx,
            866,
            'MENU',
            () => {
                this.scene.stop('Game');
                this.scene.start('Title');
            },
            { width: 260, height: 80, fontSize: 32, color: COLORS.buttonAlt }
        );
    }
}
