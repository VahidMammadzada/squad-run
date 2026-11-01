import * as Phaser from 'phaser';
import { Sfx } from '../audio/Sfx';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';

const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;

/** Mixes `color` toward black (amount < 0) or white (amount > 0). */
export function shade(color: number, amount: number): number {
    const c = Phaser.Display.Color.IntegerToColor(color);
    const target = amount < 0 ? 0 : 255;
    const t = Math.abs(amount);
    return Phaser.Display.Color.GetColor(
        Math.round(c.red + (target - c.red) * t),
        Math.round(c.green + (target - c.green) * t),
        Math.round(c.blue + (target - c.blue) * t)
    );
}

/** Chunky outlined text with a drop shadow. Pass `outline: false` for text on light cards. */
export function textStyle(size: number, color = '#ffffff', outline = true): Phaser.Types.GameObjects.Text.TextStyle {
    const navy = css(COLORS.ink);
    return {
        fontFamily: FONT,
        fontSize: `${size}px`,
        color,
        align: 'center',
        ...(outline
            ? {
                  stroke: navy,
                  strokeThickness: Math.max(4, Math.round(size / 6)),
                  shadow: { offsetX: 0, offsetY: Math.max(3, Math.round(size / 14)), color: navy, blur: 0, fill: true, stroke: true }
              }
            : {})
    };
}

/** Rounded candy shape: darker bevel underneath, gloss band on the top half. */
export function drawCandy(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, radius = h * 0.3): void {
    const bevel = Math.max(6, Math.round(h * 0.09));
    g.fillStyle(COLORS.ink, 0.25).fillRoundedRect(x, y + bevel + 4, w, h, radius);
    g.fillStyle(shade(color, -0.3)).fillRoundedRect(x, y + bevel, w, h, radius);
    g.fillStyle(color).fillRoundedRect(x, y, w, h, radius);
    g.fillStyle(0xffffff, 0.22).fillRoundedRect(x + 8, y + 6, w - 16, h * 0.42, Math.min(radius, h * 0.21));
}

interface ButtonOptions {
    width?: number;
    height?: number;
    color?: number;
    fontSize?: number;
    /** Gently pulses to draw the thumb, for the main call to action. */
    pulse?: boolean;
}

export function createButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    { width = 360, height = 100, color = COLORS.button, fontSize = 40, pulse = false }: ButtonOptions = {}
): Phaser.GameObjects.Container {
    const g = scene.add.graphics();
    drawCandy(g, -width / 2, -height / 2, width, height, color);
    const text = scene.add.text(0, -3, label, textStyle(fontSize)).setOrigin(0.5);

    const button = scene.add.container(x, y, [g, text]).setSize(width, height);
    button.setInteractive({ useHandCursor: true });
    const idle = pulse ? scene.tweens.add({ targets: button, scale: 1.06, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }) : null;
    const release = () => {
        scene.tweens.add({ targets: button, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut', onComplete: () => idle?.resume() });
    };
    button.on('pointerdown', () => {
        idle?.pause();
        scene.tweens.killTweensOf(button);
        button.setScale(1.04, 0.9);
    });
    button.on('pointerout', release);
    button.on('pointerup', release);
    onTap(button, () => {
        Sfx.play('click');
        onClick();
    });
    return button;
}

/**
 * Calls `handler` when a press that started on `target` is released on it.
 * A finger that was already down when the object appeared (a stall sheet
 * sliding in under a joystick drag) or that slid onto it does nothing, so a
 * stray release can't buy or close anything.
 */
export function onTap(target: Phaser.GameObjects.GameObject, handler: () => void): void {
    let armed = false;
    target.on('pointerdown', () => (armed = true));
    target.on('pointerout', () => (armed = false));
    target.on('pointerup', () => {
        if (!armed) return;
        armed = false;
        handler();
    });
}

/**
 * Dims whatever is underneath and draws a centred navy card with a coloured
 * header band (`headerHeight` px tall). The whole scene springs in.
 */
export function createPanel(scene: Phaser.Scene, width: number, height: number, headerColor: number = COLORS.buttonAlt, headerHeight = 170): void {
    scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.ink, 0.55).setOrigin(0).setInteractive();
    const x = (GAME_WIDTH - width) / 2;
    const y = (GAME_HEIGHT - height) / 2;
    const r = 40;
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(x, y + 14, width, height, r);
    g.fillStyle(COLORS.panel).fillRoundedRect(x, y, width, height, r);
    g.fillStyle(headerColor).fillRoundedRect(x, y, width, headerHeight, { tl: r, tr: r, bl: 0, br: 0 });
    g.fillStyle(0xffffff, 0.18).fillRoundedRect(x + 12, y + 10, width - 24, headerHeight * 0.4, 24);
    g.lineStyle(8, 0xffffff).strokeRoundedRect(x, y, width, height, r);

    const cam = scene.cameras.main;
    cam.setZoom(0.85).fadeIn(160, 27, 42, 92);
    scene.tweens.add({ targets: cam, zoom: 1, duration: 380, ease: 'Back.easeOut' });
}

export function popIn(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, delay = 0): void {
    target.setScale(0);
    scene.tweens.add({ targets: target, scale: 1, duration: 350, delay, ease: 'Back.easeOut' });
}

/** Full-screen bright blue backdrop with soft diagonal stripes, for menus without 3D. */
export function drawBackdrop(scene: Phaser.Scene): void {
    const g = scene.add.graphics();
    g.fillGradientStyle(COLORS.skyTop, COLORS.skyTop, COLORS.buttonAlt, COLORS.buttonAlt, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0xffffff, 0.06);
    for (let i = -GAME_HEIGHT; i < GAME_WIDTH; i += 120) {
        g.fillPoints([
            new Phaser.Math.Vector2(i, 0),
            new Phaser.Math.Vector2(i + 60, 0),
            new Phaser.Math.Vector2(i + 60 + GAME_HEIGHT, GAME_HEIGHT),
            new Phaser.Math.Vector2(i + GAME_HEIGHT, GAME_HEIGHT)
        ], true);
    }
}

/** Rounded translucent chip, e.g. behind a HUD counter. */
export function drawChip(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.fillStyle(COLORS.ink, 0.45).fillRoundedRect(x, y, w, h, h / 2);
    g.lineStyle(4, 0xffffff, 0.85).strokeRoundedRect(x, y, w, h, h / 2);
}
