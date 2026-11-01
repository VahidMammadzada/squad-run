import * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { Sfx } from '../audio/Sfx';
import { COLORS, GAME_WIDTH } from '../config';
import { KITS, type Kit } from '../data/kits';
import { Progress } from '../state/Progress';
import { createButton, textStyle } from '../ui/widgets';

const CARD_W = 310;
const CARD_H = 190;

interface Card {
    kit: Kit;
    container: Phaser.GameObjects.Container;
    bg: Phaser.GameObjects.Graphics;
    status: Phaser.GameObjects.Text;
}

export class ShopScene extends Phaser.Scene {
    private cards: Card[] = [];
    private coinText!: Phaser.GameObjects.Text;

    constructor() {
        super('Shop');
    }

    create(): void {
        const cx = GAME_WIDTH / 2;
        this.cameras.main.setBackgroundColor(COLORS.bg);
        this.add.text(cx, 90, 'KITS', textStyle(72)).setOrigin(0.5);
        this.add.image(cx - 70, 170, TEX.coin).setScale(1.2);
        this.coinText = this.add.text(cx - 45, 170, '', textStyle(38)).setOrigin(0, 0.5);

        this.cards = KITS.map((kit, i) => {
            const x = cx + (i % 2 === 0 ? -1 : 1) * (CARD_W / 2 + 12);
            const y = 330 + Math.floor(i / 2) * (CARD_H + 22);
            const bg = this.add.graphics();
            const swatch = this.add.image(0, -40, TEX.leader).setTint(kit.shirt).setScale(1.6);
            const name = this.add.text(0, 25, kit.name.toUpperCase(), textStyle(26)).setOrigin(0.5);
            const status = this.add.text(0, 65, '', textStyle(24)).setOrigin(0.5);
            const container = this.add.container(x, y, [bg, swatch, name, status]).setSize(CARD_W, CARD_H);
            container.setInteractive({ useHandCursor: true });
            const card: Card = { kit, container, bg, status };
            container.on('pointerup', () => this.onTap(card));
            return card;
        });

        createButton(this, cx, 1200, 'BACK', () => this.scene.start('Title'), { width: 300, height: 90, color: COLORS.buttonAlt });
        this.refresh();
    }

    private onTap(card: Card): void {
        const { kit } = card;
        if (Progress.isUnlocked(kit.id)) {
            Sfx.play('click');
            Progress.selectKit(kit.id);
        } else if (Progress.buyKit(kit.id)) {
            Sfx.play('coin');
        } else {
            Sfx.play('gateBad');
            this.tweens.add({ targets: card.container, x: card.container.x + 10, duration: 50, yoyo: true, repeat: 3 });
        }
        this.refresh();
    }

    private refresh(): void {
        const { coins, selectedKit } = Progress.data;
        this.coinText.setText(String(coins));
        for (const { kit, bg, status } of this.cards) {
            const owned = Progress.isUnlocked(kit.id);
            const equipped = selectedKit === kit.id;
            bg.clear();
            bg.fillStyle(0x000000, 0.35).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 20);
            bg.lineStyle(5, equipped ? COLORS.gold : 0xffffff, equipped ? 1 : 0.25).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 20);
            if (equipped) {
                status.setText('EQUIPPED').setColor('#ffeb3b');
            } else if (owned) {
                status.setText('TAP TO WEAR').setColor('#ffffff');
            } else {
                status.setText(`${kit.price} COINS`).setColor(coins >= kit.price ? '#a5d6a7' : '#ef9a9a');
            }
        }
    }
}
