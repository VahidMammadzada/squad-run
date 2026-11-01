import * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { Sfx } from '../audio/Sfx';
import { COLORS, GAME_WIDTH } from '../config';
import { KITS, type Kit } from '../data/kits';
import { Progress } from '../state/Progress';
import { createButton, drawBackdrop, drawCandy, drawChip, onTap, textStyle } from '../ui/widgets';

const CARD_W = 310;
const CARD_H = 196;
const PILL_W = 220;
const PILL_H = 50;
const INK = '#1b2a5c';

interface Card {
    kit: Kit;
    container: Phaser.GameObjects.Container;
    bg: Phaser.GameObjects.Graphics;
    pill: Phaser.GameObjects.Graphics;
    status: Phaser.GameObjects.Text;
    price: Phaser.GameObjects.Container;
    priceText: Phaser.GameObjects.Text;
}

export class ShopScene extends Phaser.Scene {
    private cards: Card[] = [];
    private coinText!: Phaser.GameObjects.Text;
    /** Scene the BACK button returns to. */
    private back = 'Title';

    constructor() {
        super('Shop');
    }

    init(data: { back?: string }): void {
        this.back = data.back ?? 'Title';
    }

    create(): void {
        const cx = GAME_WIDTH / 2;
        drawBackdrop(this);
        this.add.text(cx, 100, 'KITS', textStyle(84)).setOrigin(0.5).setAngle(-3);
        drawChip(this.add.graphics(), cx - 100, 162, 200, 60);
        this.add.image(cx - 62, 192, TEX.coin).setScale(1.25);
        this.coinText = this.add.text(cx + 75, 192, '', textStyle(36)).setOrigin(1, 0.5);

        this.cards = KITS.map((kit, i) => {
            const x = cx + (i % 2 === 0 ? -1 : 1) * (CARD_W / 2 + 12);
            const y = 345 + Math.floor(i / 2) * (CARD_H + 22);
            const bg = this.add.graphics();
            const shirt = this.add.image(0, -48, TEX.shirt).setTint(kit.shirt).setScale(1.25);
            const name = this.add.text(0, 14, kit.name.toUpperCase(), textStyle(26, INK, false)).setOrigin(0.5);
            const pill = this.add.graphics();
            const status = this.add.text(0, 58, '', textStyle(24)).setOrigin(0.5);
            const priceText = this.add.text(18, 0, '', textStyle(26)).setOrigin(0.5);
            const price = this.add.container(0, 58, [this.add.image(-48, 0, TEX.coin), priceText]);
            const container = this.add.container(x, y, [bg, shirt, name, pill, status, price]).setSize(CARD_W, CARD_H);
            container.setInteractive({ useHandCursor: true });
            container.on('pointerdown', () => container.setScale(0.95));
            container.on('pointerout', () => container.setScale(1));
            const card: Card = { kit, container, bg, pill, status, price, priceText };
            container.on('pointerup', () => container.setScale(1));
            onTap(container, () => this.onTap(card));
            return card;
        });

        createButton(this, cx, 1196, 'BACK', () => this.scene.start(this.back, { booth: 'merch' }), { width: 280, height: 84, color: COLORS.buttonAccent });
        this.refresh();
    }

    private onTap(card: Card): void {
        const { kit } = card;
        if (Progress.isUnlocked(kit.id)) {
            Sfx.play('click');
            Progress.selectKit(kit.id);
        } else if (Progress.buyKit(kit.id)) {
            Sfx.play('coin');
            this.tweens.add({ targets: card.container, scale: { from: 1.15, to: 1 }, duration: 300, ease: 'Back.easeOut' });
        } else {
            Sfx.play('gateBad');
            this.tweens.add({ targets: card.container, x: card.container.x + 10, duration: 50, yoyo: true, repeat: 3 });
        }
        this.refresh();
    }

    private refresh(): void {
        const { coins, selectedKit } = Progress.data;
        this.coinText.setText(String(coins));
        for (const { kit, bg, pill, status, price, priceText } of this.cards) {
            const owned = Progress.isUnlocked(kit.id);
            const equipped = selectedKit === kit.id;
            const affordable = coins >= kit.price;
            bg.clear();
            bg.fillStyle(COLORS.ink, 0.3).fillRoundedRect(-CARD_W / 2, -CARD_H / 2 + 8, CARD_W, CARD_H, 26);
            bg.fillStyle(0xffffff).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 26);
            bg.fillStyle(kit.shirt, 0.18).fillRoundedRect(-CARD_W / 2 + 10, -CARD_H / 2 + 10, CARD_W - 20, 92, 18);
            if (equipped) bg.lineStyle(8, COLORS.gold).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 26);

            pill.clear();
            const pillColor = equipped ? COLORS.gold : owned ? COLORS.buttonAlt : affordable ? COLORS.button : 0xb0b8c8;
            drawCandy(pill, -PILL_W / 2, 58 - PILL_H / 2, PILL_W, PILL_H, pillColor, PILL_H / 2);
            status.setVisible(owned).setText(equipped ? 'EQUIPPED' : 'WEAR');
            price.setVisible(!owned);
            priceText.setText(String(kit.price));
        }
    }
}
