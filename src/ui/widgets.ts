import * as Phaser from 'phaser';
import { Sfx } from '../audio/Sfx';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';

export function textStyle(size: number, color = '#ffffff'): Phaser.Types.GameObjects.Text.TextStyle {
    return {
        fontFamily: FONT,
        fontSize: `${size}px`,
        color,
        stroke: '#000000',
        strokeThickness: Math.max(3, Math.round(size / 7)),
        align: 'center'
    };
}

interface ButtonOptions {
    width?: number;
    height?: number;
    color?: number;
    fontSize?: number;
}

export function createButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    { width = 360, height = 100, color = COLORS.button, fontSize = 40 }: ButtonOptions = {}
): Phaser.GameObjects.Container {
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-width / 2, -height / 2 + 8, width, height, 24);
    g.fillStyle(color).fillRoundedRect(-width / 2, -height / 2, width, height, 24);
    const text = scene.add.text(0, -2, label, textStyle(fontSize)).setOrigin(0.5);

    const button = scene.add.container(x, y, [g, text]).setSize(width, height);
    button.setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => button.setScale(0.95));
    button.on('pointerout', () => button.setScale(1));
    button.on('pointerup', () => {
        button.setScale(1);
        Sfx.play('click');
        onClick();
    });
    return button;
}

/** Dims whatever is underneath and draws a centred panel. */
export function createPanel(scene: Phaser.Scene, width: number, height: number): void {
    scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    const g = scene.add.graphics();
    g.fillStyle(COLORS.panel, 0.95).fillRoundedRect((GAME_WIDTH - width) / 2, (GAME_HEIGHT - height) / 2, width, height, 32);
    g.lineStyle(4, 0xffffff, 0.25).strokeRoundedRect((GAME_WIDTH - width) / 2, (GAME_HEIGHT - height) / 2, width, height, 32);
}

export function popIn(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, delay = 0): void {
    target.setScale(0);
    scene.tweens.add({ targets: target, scale: 1, duration: 350, delay, ease: 'Back.easeOut' });
}
