// The TRAINING stall: buy upgrade levels.
import type * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { Sfx } from '../audio/Sfx';
import { UPGRADES, type UpgradeDef } from '../club/balance';
import { isMaxed, maxLevel, nextPrice } from '../club/upgrades';
import { COLORS, GAME_WIDTH } from '../config';
import { Progress } from '../state/Progress';
import { drawCandy, onTap, textStyle } from '../ui/widgets';
import { cardBackground, CONTENT_Y, GREY, INK, ROW_W, shake, SUB, type ClubHost } from './clubUi';

const ROW_H = 118;
const PILL_W = 170;
const PILL_H = 56;

export function buildTraining(host: ClubHost, root: Phaser.GameObjects.Container): void {
    UPGRADES.forEach((def, i) => root.add(upgradeRow(host, def, GAME_WIDTH / 2, CONTENT_Y + 80 + i * (ROW_H + 14))));
}

function upgradeRow(host: ClubHost, def: UpgradeDef, x: number, y: number): Phaser.GameObjects.Container {
    const { scene } = host;
    const level = Progress.upgradeLevel(def.id);
    const maxed = isMaxed(def.id, level);
    const price = nextPrice(def.id, level);
    const affordable = price !== null && Progress.data.coins >= price;

    const left = -ROW_W / 2 + 28;
    const name = scene.add.text(left, -26, def.name.toUpperCase(), textStyle(30, INK, false)).setOrigin(0, 0.5);
    const effect = scene.add.text(left, 8, def.effect, textStyle(22, SUB, false)).setOrigin(0, 0.5);

    // Level pips.
    const pips = scene.add.graphics();
    for (let p = 0; p < maxLevel(def.id); p++) {
        const px = left + 12 + p * 30;
        pips.fillStyle(p < level ? COLORS.gold : 0xdde3ee).fillCircle(px, 38, 10);
        pips.lineStyle(3, COLORS.ink, p < level ? 0.8 : 0.25).strokeCircle(px, 38, 10);
    }

    const pillX = ROW_W / 2 - PILL_W / 2 - 22;
    const pill = scene.add.graphics();
    drawCandy(pill, pillX - PILL_W / 2, -PILL_H / 2, PILL_W, PILL_H, maxed ? COLORS.gold : affordable ? COLORS.button : GREY, PILL_H / 2);
    const items: Phaser.GameObjects.GameObject[] = [cardBackground(scene, ROW_H), name, effect, pips, pill];
    if (maxed) {
        items.push(scene.add.text(pillX, -3, 'MAX', textStyle(28)).setOrigin(0.5));
    } else {
        items.push(scene.add.image(pillX - 46, -3, TEX.coin), scene.add.text(pillX + 14, -3, String(price), textStyle(28)).setOrigin(0.5));
    }

    const row = scene.add.container(x, y, items).setSize(ROW_W, ROW_H);
    if (!maxed) {
        row.setInteractive({ useHandCursor: true });
        row.on('pointerdown', () => row.setScale(0.97));
        row.on('pointerout', () => row.setScale(1));
        row.on('pointerup', () => row.setScale(1));
        onTap(row, () => {
            if (Progress.buyUpgrade(def.id)) {
                Sfx.play('coin');
                host.coinsChanged();
                host.refresh();
            } else {
                Sfx.play('gateBad');
                shake(scene, row);
            }
        });
    }
    return row;
}
