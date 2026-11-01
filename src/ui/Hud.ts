import * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { COLORS, GAME_WIDTH } from '../config';
import { drawChip, textStyle } from './widgets';

const DEPTH = 1000;
const BAR_WIDTH = 440;
const BAR_HEIGHT = 26;
const BAR_Y = 136;
const COIN_ICON = { x: GAME_WIDTH - 152, y: 58 };

/** In-run overlay: squad count, coins, level and progress. Fixed to the camera. */
export class Hud {
    private readonly scene: Phaser.Scene;
    private readonly squadText: Phaser.GameObjects.Text;
    private readonly coinText: Phaser.GameObjects.Text;
    private readonly coinIcon: Phaser.GameObjects.Image;
    private readonly progress: Phaser.GameObjects.Graphics;
    private hint?: Phaser.GameObjects.Text;
    private goalsText?: Phaser.GameObjects.Text;
    private stamped?: Phaser.GameObjects.Text;
    private coins = 0;
    private fraction = -1;

    constructor(scene: Phaser.Scene, level: number, kitColor: number) {
        this.scene = scene;
        const fix = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(obj: T): T => {
            obj.setScrollFactor(0);
            obj.setDepth(DEPTH);
            return obj;
        };

        const chips = fix(scene.add.graphics());
        drawChip(chips, 20, 26, 170, 64);
        drawChip(chips, GAME_WIDTH - 190, 26, 170, 64);
        // White disc so any kit colour reads against the dark chip.
        chips.fillStyle(0xffffff).fillCircle(58, 58, 25);
        fix(scene.add.image(58, 58, TEX.shirt).setTint(kitColor).setScale(0.68));
        this.squadText = fix(scene.add.text(94, 58, '0', textStyle(40)).setOrigin(0, 0.5));
        fix(scene.add.text(GAME_WIDTH / 2, 58, `LEVEL ${level}`, textStyle(36)).setOrigin(0.5));
        this.coinIcon = fix(scene.add.image(COIN_ICON.x, COIN_ICON.y, TEX.coin).setScale(1.3));
        this.coinText = fix(scene.add.text(GAME_WIDTH - 40, 58, '0', textStyle(38)).setOrigin(1, 0.5));

        this.progress = fix(scene.add.graphics());
        fix(scene.add.image((GAME_WIDTH + BAR_WIDTH) / 2 + 8, BAR_Y + 4, TEX.flag).setOrigin(0.15, 0.85));
        this.setProgress(0);
    }

    setSquad(count: number): void {
        this.squadText.setText(String(count));
        this.bump(this.squadText);
    }

    setCoins(coins: number): void {
        const gained = coins > this.coins;
        this.coins = coins;
        this.coinText.setText(String(coins));
        if (gained) {
            this.bump(this.coinText);
            this.bump(this.coinIcon, 1.3);
        }
    }

    setProgress(fraction: number): void {
        const f = Phaser.Math.Clamp(fraction, 0, 1);
        // Redraw only when the fill moves by at least a pixel.
        if (Math.abs(f - this.fraction) * BAR_WIDTH < 1) return;
        this.fraction = f;
        const x = (GAME_WIDTH - BAR_WIDTH) / 2;
        const y = BAR_Y - BAR_HEIGHT / 2;
        const r = BAR_HEIGHT / 2;
        const g = this.progress.clear();
        g.fillStyle(COLORS.ink, 0.55).fillRoundedRect(x, y, BAR_WIDTH, BAR_HEIGHT, r);
        const w = Math.max(BAR_HEIGHT, BAR_WIDTH * f);
        if (f > 0) {
            g.fillStyle(COLORS.gold).fillRoundedRect(x, y, w, BAR_HEIGHT, r);
            g.fillStyle(0xffffff, 0.35).fillRoundedRect(x + 6, y + 4, w - 12, BAR_HEIGHT * 0.3, 4);
        }
        g.lineStyle(4, 0xffffff).strokeRoundedRect(x, y, BAR_WIDTH, BAR_HEIGHT, r);
    }

    showHint(text: string): void {
        this.hint = this.scene.add.text(GAME_WIDTH / 2, 620, text, textStyle(48)).setOrigin(0.5);
        this.hint.setScrollFactor(0).setDepth(DEPTH);
        this.scene.tweens.add({ targets: this.hint, scale: 1.08, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    hideHint(): void {
        const hint = this.hint;
        this.hint = undefined;
        if (!hint) return;
        this.scene.tweens.killTweensOf(hint);
        this.scene.tweens.add({ targets: hint, alpha: 0, scale: 1.4, duration: 200, onComplete: () => hint.destroy() });
    }

    showGoals(goals: number): void {
        if (!this.goalsText) {
            this.goalsText = this.scene.add.text(GAME_WIDTH / 2, 240, '', textStyle(68, '#ffd21f')).setOrigin(0.5);
            this.goalsText.setScrollFactor(0).setDepth(DEPTH);
        }
        this.goalsText.setText(`GOALS: ${goals}`);
        this.bump(this.goalsText, 1, 1.35);
    }

    /** A coin flies from a screen point into the HUD counter, then `onArrive` runs. */
    flyCoin(x: number, y: number, onArrive: () => void): void {
        const coin = this.scene.add.image(x, y, TEX.coin).setScale(1.6).setDepth(DEPTH + 1).setScrollFactor(0);
        this.scene.tweens.add({
            targets: coin,
            x: COIN_ICON.x,
            y: COIN_ICON.y,
            scale: 1.1,
            duration: 420,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                coin.destroy();
                onArrive();
            }
        });
    }

    /** Big number that pops up at a screen point and floats away, e.g. "+9" after a gate. */
    popText(text: string, x: number, y: number, color: string, size = 72): void {
        // Keep it fully on screen when the squad hugs a touchline.
        const t = this.scene.add.text(Phaser.Math.Clamp(x, size * 1.5, GAME_WIDTH - size * 1.5), y, text, textStyle(size, color)).setOrigin(0.5).setDepth(DEPTH - 1).setScrollFactor(0).setScale(0);
        this.scene.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
        this.scene.tweens.add({ targets: t, y: y - 150, duration: 800, ease: 'Cubic.easeOut' });
        this.scene.tweens.add({ targets: t, alpha: 0, delay: 500, duration: 300, onComplete: () => t.destroy() });
    }

    /** Full-screen colour flash, e.g. red when the squad takes a hit. */
    flash(color: number, alpha = 0.3): void {
        const r = this.scene.add.rectangle(0, 0, GAME_WIDTH, 1280, color, alpha).setOrigin(0).setDepth(DEPTH - 2).setScrollFactor(0);
        this.scene.tweens.add({ targets: r, alpha: 0, duration: 260, onComplete: () => r.destroy() });
    }

    /** Huge word that slams onto the screen, e.g. "GOAL!". Replaces the previous one. */
    stamp(text: string, color: string, y = 400): void {
        if (this.stamped) {
            this.scene.tweens.killTweensOf(this.stamped);
            this.stamped.destroy();
        }
        const t = (this.stamped = this.scene.add.text(GAME_WIDTH / 2, y, text, textStyle(130, color)).setOrigin(0.5).setDepth(DEPTH + 2).setScrollFactor(0));
        t.setScale(3).setAlpha(0).setAngle(Phaser.Math.Between(-8, 8));
        this.scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
        this.scene.tweens.add({ targets: t, scale: 1.15, alpha: 0, delay: 520, duration: 220, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
    }

    private bump(target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, base = 1, peak = base * 1.3): void {
        this.scene.tweens.killTweensOf(target);
        this.scene.tweens.add({ targets: target, scale: { from: peak, to: base }, duration: 220, ease: 'Back.easeOut' });
    }
}
