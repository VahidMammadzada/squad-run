import * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { getKit } from '../data/kits';
import { Playables } from '../sdk/Playables';
import { Progress } from '../state/Progress';
import { createButton, textStyle } from '../ui/widgets';

export class TitleScene extends Phaser.Scene {
    private bg!: Phaser.GameObjects.TileSprite;

    constructor() {
        super('Title');
    }

    create(): void {
        const cx = GAME_WIDTH / 2;
        const { level, bestScore, coins, selectedKit } = Progress.data;
        const kit = getKit(selectedKit);

        this.bg = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, TEX.pitch).setOrigin(0);
        this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.25).setOrigin(0);

        this.add.image(GAME_WIDTH - 50, 55, TEX.coin).setScale(1.2);
        this.add.text(GAME_WIDTH - 80, 55, String(coins), textStyle(38)).setOrigin(1, 0.5);

        this.add.text(cx, 250, 'SQUAD\nRUN', textStyle(120)).setOrigin(0.5).setLineSpacing(-24);

        // Squad preview in the equipped kit.
        const py = 590;
        for (let i = 0; i < 14; i++) {
            const r = 30 + 14 * Math.sqrt(i);
            const a = i * 2.39996;
            this.add.image(cx + r * Math.cos(a), py + r * Math.sin(a) * 0.85, TEX.mate).setTint(kit.shirt);
        }
        this.add.image(cx, py, TEX.leader).setTint(kit.shirt);
        this.add.image(cx, py - 30, TEX.ball);

        this.add.text(cx, 790, `LEVEL ${level}`, textStyle(48)).setOrigin(0.5);
        this.add.text(cx, 850, `BEST: ${bestScore} GOALS`, textStyle(32, '#ffeb3b')).setOrigin(0.5);

        createButton(this, cx, 990, 'PLAY', () => this.scene.start('Game', { level: Progress.data.level }), {
            width: 420,
            height: 120,
            fontSize: 60
        });
        createButton(this, cx, 1140, 'SHOP', () => this.scene.start('Shop'), { color: COLORS.buttonAlt });

        // Fine to call every time the title shows; only the first call goes through.
        Playables.gameReady();
    }

    update(_time: number, deltaMs: number): void {
        this.bg.tilePositionY -= deltaMs * 0.15;
    }
}
