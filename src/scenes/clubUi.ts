// Shared building blocks for the club booths (ClubScene, clubStars, clubOffice).
import * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import type { StallId } from '../club/concourse';
import type { CelebrationId, ManagerEquip } from '../club/wardrobe';
import { COLORS } from '../config';
import { drawCandy, onTap, textStyle } from '../ui/widgets';

export type Booth = StallId;

/** Top of the area below the booth tabs. */
export const CONTENT_Y = 450;

/** What the booth panels need from the hub. */
export interface ClubHost {
    scene: Phaser.Scene;
    refresh(): void;
    showBooth(booth: Booth): void;
    isLeaving(): boolean;
    coinsChanged(): void;
    /** Leaves the scene (e.g. to the kit shop); ignored if already leaving. */
    leave(go: () => void): void;
    /** Screen position of the coin counter, for flying-coin effects. */
    coinTarget: { x: number; y: number };
    /** Dresses the 3D manager in a try-on look (null = back to what's saved). */
    preview?(equip: ManagerEquip | null): void;
    /** Plays a celebration on the 3D manager. */
    celebrate?(id: CelebrationId): void;
}

export const INK = '#1b2a5c';
export const SUB = '#5a6a94';
export const ROW_W = 640;
export const GREY = 0xb0b8c8;

/** White rounded card with a soft shadow, centred on (0, 0) of its container. */
export function cardBackground(scene: Phaser.Scene, h: number, w = ROW_W): Phaser.GameObjects.Graphics {
    const bg = scene.add.graphics();
    bg.fillStyle(COLORS.ink, 0.3).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, 24);
    bg.fillStyle(0xffffff).fillRoundedRect(-w / 2, -h / 2, w, h, 24);
    return bg;
}

/** Small candy pill; with `coin`, the label is a price. A null action makes it a plain label. */
export function pillButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    label: string,
    action: (() => void) | null,
    coin = false
): Phaser.GameObjects.Container {
    const g = scene.add.graphics();
    drawCandy(g, -w / 2, -h / 2, w, h, color, h / 2);
    const text = scene.add.text(coin ? 14 : 0, -3, label, textStyle(label.length > 8 ? 20 : 26)).setOrigin(0.5);
    const items: Phaser.GameObjects.GameObject[] = [g, text];
    if (coin) items.push(scene.add.image(text.x - text.width / 2 - 18, -3, TEX.coin).setScale(0.9));
    const pill = scene.add.container(x, y, items).setSize(w, h);
    if (action) {
        pill.setInteractive({ useHandCursor: true });
        pill.on('pointerdown', () => pill.setScale(0.93));
        pill.on('pointerout', () => pill.setScale(1));
        pill.on('pointerup', () => pill.setScale(1));
        onTap(pill, action);
    }
    return pill;
}

/**
 * A hard fan gate at (x, 0) of a card: grey pill with the fans needed, a label
 * with the club's current fans, and a progress bar.
 */
export function fanLock(scene: Phaser.Scene, x: number, fans: number, gate: number): Phaser.GameObjects.GameObject[] {
    const g = scene.add.graphics();
    drawCandy(g, x - 85, -56, 170, 48, GREY, 24);
    g.fillStyle(0xdde3ee).fillRoundedRect(x - 75, 34, 150, 14, 7);
    g.fillStyle(0xff4f8b).fillRoundedRect(x - 75, 34, Math.max(14, 150 * Math.min(1, fans / gate)), 14, 7);
    return [
        g,
        scene.add.image(x - 52, -34, TEX.fan).setScale(0.9),
        scene.add.text(x + 16, -34, String(gate), textStyle(26)).setOrigin(0.5),
        scene.add.text(x, 16, `FANS NEEDED (${fans})`, textStyle(16, SUB, false)).setOrigin(0.5)
    ];
}

/** Big text that pops up and floats away, e.g. "SIGNED!". */
export function floatText(scene: Phaser.Scene, text: string, x: number, y: number, color: string): void {
    const t = scene.add.text(x, y, text, textStyle(56, color)).setOrigin(0.5).setDepth(20).setScale(0);
    scene.tweens.add({ targets: t, scale: 1, duration: 250, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: t, y: y - 80, alpha: 0, delay: 700, duration: 400, onComplete: () => t.destroy() });
}

/** Little horizontal shake for "can't do that". */
export function shake(scene: Phaser.Scene, target: Phaser.GameObjects.Container): void {
    scene.tweens.add({ targets: target, x: target.x + 10, duration: 50, yoyo: true, repeat: 3 });
}
