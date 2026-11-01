import * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { COLORS, GAME_WIDTH } from '../config';
import { textStyle } from './widgets';

const DEPTH = 1000;
const BAR_WIDTH = 480;

/** In-run overlay: squad count, coins, level and progress. Fixed to the camera. */
export class Hud {
    private readonly scene: Phaser.Scene;
    private readonly squadText: Phaser.GameObjects.Text;
    private readonly coinText: Phaser.GameObjects.Text;
    private readonly progressFill: Phaser.GameObjects.Rectangle;
    private hint?: Phaser.GameObjects.Text;
    private goalsText?: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, level: number, kitColor: number) {
        this.scene = scene;
        const fix = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(obj: T): T => {
            obj.setScrollFactor(0);
            obj.setDepth(DEPTH);
            return obj;
        };

        fix(scene.add.rectangle(0, 0, GAME_WIDTH, 150, 0x000000, 0.3).setOrigin(0));
        fix(scene.add.image(56, 55, TEX.mate).setTint(kitColor).setScale(1.5));
        this.squadText = fix(scene.add.text(88, 55, '0', textStyle(42)).setOrigin(0, 0.5));
        fix(scene.add.text(GAME_WIDTH / 2, 55, `LEVEL ${level}`, textStyle(34)).setOrigin(0.5));
        fix(scene.add.image(GAME_WIDTH - 50, 55, TEX.coin).setScale(1.2));
        this.coinText = fix(scene.add.text(GAME_WIDTH - 80, 55, '0', textStyle(38)).setOrigin(1, 0.5));

        fix(scene.add.rectangle(GAME_WIDTH / 2, 118, BAR_WIDTH + 8, 24, 0x000000, 0.5));
        this.progressFill = fix(
            scene.add.rectangle((GAME_WIDTH - BAR_WIDTH) / 2, 118, BAR_WIDTH, 16, COLORS.gold).setOrigin(0, 0.5)
        );
        this.progressFill.scaleX = 0;
    }

    setSquad(count: number): void {
        this.squadText.setText(String(count));
    }

    setCoins(coins: number): void {
        this.coinText.setText(String(coins));
    }

    setProgress(fraction: number): void {
        this.progressFill.scaleX = Phaser.Math.Clamp(fraction, 0, 1);
    }

    showHint(text: string): void {
        this.hint = this.scene.add.text(GAME_WIDTH / 2, 620, text, textStyle(48)).setOrigin(0.5);
        this.hint.setScrollFactor(0).setDepth(DEPTH);
        this.scene.tweens.add({ targets: this.hint, scale: 1.08, duration: 600, yoyo: true, repeat: -1 });
    }

    hideHint(): void {
        this.hint?.destroy();
        this.hint = undefined;
    }

    showGoals(goals: number): void {
        if (!this.goalsText) {
            this.goalsText = this.scene.add.text(GAME_WIDTH / 2, 230, '', textStyle(64, '#ffeb3b')).setOrigin(0.5);
            this.goalsText.setScrollFactor(0).setDepth(DEPTH);
        }
        this.goalsText.setText(`GOALS: ${goals}`);
        this.scene.tweens.add({ targets: this.goalsText, scale: { from: 1.3, to: 1 }, duration: 200 });
    }
}
