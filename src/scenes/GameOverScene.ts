import * as Phaser from 'phaser';
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
        createPanel(this, 600, 600);

        this.add.text(cx, 420, 'SQUAD\nLOST!', textStyle(72, '#ef5350')).setOrigin(0.5);
        this.add.text(cx, 560, `LEVEL ${this.result.level}`, textStyle(36)).setOrigin(0.5);
        this.add.text(cx, 620, `+${this.result.coins} COINS KEPT`, textStyle(30, '#ffeb3b')).setOrigin(0.5);

        createButton(this, cx, 740, 'RETRY', () => this.scene.start('Game', { level: this.result.level }), {
            width: 400,
            height: 110,
            fontSize: 52
        });
        createButton(
            this,
            cx,
            865,
            'MENU',
            () => {
                this.scene.stop('Game');
                this.scene.start('Title');
            },
            { width: 260, height: 80, fontSize: 32, color: COLORS.buttonAlt }
        );
    }
}
