import * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { Sfx } from '../audio/Sfx';
import { MERCH_DOUBLE_MIN, UPGRADES, type UpgradeDef } from '../club/balance';
import { merchCap, merchPerLevel } from '../club/merch';
import { canUpgradeStadium, isActive, merchMultiplier, stadiumMerchBonus } from '../club/office';
import { isMaxed, maxLevel, nextPrice } from '../club/upgrades';
import { COLORS, GAME_WIDTH } from '../config';
import { getKit } from '../data/kits';
import { REWARD_IDS } from '../game/adPolicy';
import { Progress } from '../state/Progress';
import { createRewardedButton } from '../ui/rewardedButton';
import { createButton, drawBackdrop, drawCandy, drawChip, textStyle } from '../ui/widgets';
import { buildOffice } from './clubOffice';
import { buildDoctor, buildScout, buildSquad } from './clubStars';
import { CONTENT_Y, type Booth, type ClubHost } from './clubUi';
import { startNextLevel } from './nextLevel';

const INK = '#1b2a5c';
const TAB_W = 108;
const TAB_H = 132;
const TAB_GAP = 6;
const TAB_Y = 340;
const ROW_W = 640;
const ROW_H = 118;
const PILL_W = 170;
const PILL_H = 56;
const COIN_CHIP = { x: GAME_WIDTH / 2 - 150, y: 210 };

/**
 * The club hub: booths along the top act as tabs, the selected booth's
 * contents fill the middle, PLAY and MENU sit at the bottom.
 */
export class ClubScene extends Phaser.Scene {
    private booth: Booth = 'squad';
    private content?: Phaser.GameObjects.Container;
    private coinText!: Phaser.GameObjects.Text;
    private fanText!: Phaser.GameObjects.Text;
    private boothCards = new Map<
        Booth,
        { container: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics; badge: Phaser.GameObjects.Container }
    >();
    private leaving = false;

    constructor() {
        super('Club');
    }

    init(data: { booth?: Booth }): void {
        const injured = Progress.data.roster.some((s) => s.injuredLevels > 0);
        this.booth = data.booth ?? (Progress.data.merchPending > 0 ? 'merch' : injured ? 'doctor' : 'squad');
        this.leaving = false;
        this.content = undefined;
        this.boothCards.clear();
    }

    create(): void {
        const cx = GAME_WIDTH / 2;
        drawBackdrop(this);
        this.add.text(cx, 100, 'MY CLUB', textStyle(84)).setOrigin(0.5).setAngle(-3);

        const chips = this.add.graphics();
        drawChip(chips, COIN_CHIP.x - 110, COIN_CHIP.y - 32, 220, 64);
        drawChip(chips, cx + 40, COIN_CHIP.y - 32, 220, 64);
        this.add.image(COIN_CHIP.x - 72, COIN_CHIP.y, TEX.coin).setScale(1.3);
        this.coinText = this.add.text(COIN_CHIP.x + 92, COIN_CHIP.y, '', textStyle(36)).setOrigin(1, 0.5);
        this.add.image(cx + 78, COIN_CHIP.y, TEX.fan).setScale(1.25);
        this.fanText = this.add.text(cx + 242, COIN_CHIP.y, '', textStyle(36, '#ff8fb6')).setOrigin(1, 0.5);

        const tabs: [Booth, string, Phaser.GameObjects.Image][] = [
            ['squad', 'SQUAD', this.add.image(0, -18, TEX.star).setScale(1.7)],
            ['scout', 'SCOUT', this.add.image(0, -18, TEX.scout).setScale(0.9)],
            ['doctor', 'DOCTOR', this.add.image(0, -18, TEX.medic).setScale(0.85)],
            ['training', 'TRAINING', this.add.image(0, -18, TEX.cone).setScale(0.9)],
            ['merch', 'MERCH', this.add.image(0, -18, TEX.shirt).setTint(getKit(Progress.data.selectedKit).shirt).setScale(0.9)],
            ['office', 'OFFICE', this.add.image(0, -18, TEX.office).setScale(0.85)]
        ];
        const left = cx - (tabs.length * TAB_W + (tabs.length - 1) * TAB_GAP) / 2 + TAB_W / 2;
        tabs.forEach(([booth, label, icon], i) => this.createBooth(booth, left + i * (TAB_W + TAB_GAP), label, icon));

        createButton(this, 150, 1180, 'MENU', () => this.leave(() => this.scene.start('Title')), {
            width: 210,
            height: 90,
            fontSize: 36,
            color: COLORS.buttonAlt
        });
        createButton(this, 470, 1180, 'PLAY', () => this.leave(() => void startNextLevel(this)), {
            width: 380,
            height: 116,
            fontSize: 60,
            pulse: true
        });

        this.refresh();
    }

    private leave(go: () => void): void {
        if (this.leaving) return;
        this.leaving = true;
        go();
    }

    private createBooth(booth: Booth, x: number, label: string, icon: Phaser.GameObjects.Image): void {
        const bg = this.add.graphics();
        const name = this.add.text(0, 40, label, textStyle(label.length > 6 ? 18 : 21)).setOrigin(0.5);
        const badge = this.add.container(TAB_W / 2 - 14, -TAB_H / 2 + 6);
        const container = this.add.container(x, TAB_Y, [bg, icon, name, badge]).setSize(TAB_W, TAB_H);
        container.setInteractive({ useHandCursor: true });
        container.on('pointerdown', () => container.setScale(0.95));
        container.on('pointerout', () => container.setScale(1));
        container.on('pointerup', () => {
            container.setScale(1);
            if (this.booth === booth) return;
            Sfx.play('click');
            this.showBooth(booth);
        });
        this.boothCards.set(booth, { container, bg, badge });
    }

    private showBooth(booth: Booth): void {
        this.booth = booth;
        this.refresh();
    }

    /** What the star panels need from the hub. */
    private host(): ClubHost {
        return {
            scene: this,
            refresh: () => this.refresh(),
            showBooth: (b) => this.showBooth(b),
            isLeaving: () => this.leaving,
            coinsChanged: () => this.bump(this.coinText)
        };
    }

    private refresh(): void {
        const { coins, fans, merchPending, roster, stadiumTier } = Progress.data;
        this.coinText.setText(String(coins));
        this.fanText.setText(String(fans));

        // Red badges: merch takings waiting, stars needing the doctor.
        const injured = roster.filter((s) => s.injuredLevels > 0).length;
        const badges: Partial<Record<Booth, string>> = {
            merch: merchPending > 0 ? `+${merchPending}` : undefined,
            doctor: injured > 0 ? String(injured) : undefined,
            office: canUpgradeStadium(stadiumTier, coins, fans) === 'ok' ? '!' : undefined
        };

        for (const [booth, { bg, container, badge }] of this.boothCards) {
            const selected = booth === this.booth;
            bg.clear();
            drawCandy(bg, -TAB_W / 2, -TAB_H / 2, TAB_W, TAB_H, selected ? COLORS.buttonAccent : COLORS.panel, 24);
            if (selected) bg.lineStyle(6, 0xffffff).strokeRoundedRect(-TAB_W / 2, -TAB_H / 2, TAB_W, TAB_H, 24);
            container.setScale(selected ? 1.04 : 1);

            badge.removeAll(true);
            const text = badges[booth];
            if (text) {
                const label = this.add.text(0, -2, text, textStyle(22)).setOrigin(0.5);
                const w = Math.max(40, label.width + 20);
                const g = this.add.graphics();
                g.fillStyle(COLORS.gateBad).fillRoundedRect(-w / 2, -19, w, 38, 19);
                g.lineStyle(3, 0xffffff).strokeRoundedRect(-w / 2, -19, w, 38, 19);
                badge.add([g, label]);
            }
        }

        this.content?.destroy(true);
        this.content = this.add.container(0, 0);
        const host = this.host();
        switch (this.booth) {
            case 'squad':
                buildSquad(host, this.content);
                break;
            case 'scout':
                buildScout(host, this.content);
                break;
            case 'doctor':
                buildDoctor(host, this.content);
                break;
            case 'training':
                this.buildTraining(this.content);
                break;
            case 'merch':
                this.buildMerch(this.content);
                break;
            case 'office':
                buildOffice(host, this.content);
                break;
        }
    }

    // --- Training ---

    private buildTraining(root: Phaser.GameObjects.Container): void {
        const cx = GAME_WIDTH / 2;
        UPGRADES.forEach((def, i) => root.add(this.upgradeRow(def, cx, CONTENT_Y + 80 + i * (ROW_H + 14))));
    }

    private upgradeRow(def: UpgradeDef, x: number, y: number): Phaser.GameObjects.Container {
        const level = Progress.upgradeLevel(def.id);
        const maxed = isMaxed(def.id, level);
        const price = nextPrice(def.id, level);
        const affordable = price !== null && Progress.data.coins >= price;

        const bg = this.add.graphics();
        bg.fillStyle(COLORS.ink, 0.3).fillRoundedRect(-ROW_W / 2, -ROW_H / 2 + 7, ROW_W, ROW_H, 24);
        bg.fillStyle(0xffffff).fillRoundedRect(-ROW_W / 2, -ROW_H / 2, ROW_W, ROW_H, 24);

        const left = -ROW_W / 2 + 28;
        const name = this.add.text(left, -26, def.name.toUpperCase(), textStyle(30, INK, false)).setOrigin(0, 0.5);
        const effect = this.add.text(left, 8, def.effect, textStyle(22, '#5a6a94', false)).setOrigin(0, 0.5);

        // Level pips.
        const pips = this.add.graphics();
        for (let p = 0; p < maxLevel(def.id); p++) {
            const px = left + 12 + p * 30;
            pips.fillStyle(p < level ? COLORS.gold : 0xdde3ee).fillCircle(px, 38, 10);
            pips.lineStyle(3, COLORS.ink, p < level ? 0.8 : 0.25).strokeCircle(px, 38, 10);
        }

        const pillX = ROW_W / 2 - PILL_W / 2 - 22;
        const pill = this.add.graphics();
        drawCandy(pill, pillX - PILL_W / 2, -PILL_H / 2, PILL_W, PILL_H, maxed ? COLORS.gold : affordable ? COLORS.button : 0xb0b8c8, PILL_H / 2);
        const items: Phaser.GameObjects.GameObject[] = [bg, name, effect, pips, pill];
        if (maxed) {
            items.push(this.add.text(pillX, -3, 'MAX', textStyle(28)).setOrigin(0.5));
        } else {
            items.push(this.add.image(pillX - 46, -3, TEX.coin), this.add.text(pillX + 14, -3, String(price), textStyle(28)).setOrigin(0.5));
        }

        const row = this.add.container(x, y, items).setSize(ROW_W, ROW_H);
        if (!maxed) {
            row.setInteractive({ useHandCursor: true });
            row.on('pointerdown', () => row.setScale(0.97));
            row.on('pointerout', () => row.setScale(1));
            row.on('pointerup', () => {
                row.setScale(1);
                this.buyUpgrade(def, row);
            });
        }
        return row;
    }

    private buyUpgrade(def: UpgradeDef, row: Phaser.GameObjects.Container): void {
        if (Progress.buyUpgrade(def.id)) {
            Sfx.play('coin');
            this.refresh();
            // The rebuilt row for this upgrade pops.
            const index = UPGRADES.indexOf(def);
            const fresh = this.content?.list[index] as Phaser.GameObjects.Container | undefined;
            if (fresh) this.tweens.add({ targets: fresh, scale: { from: 1.08, to: 1 }, duration: 300, ease: 'Back.easeOut' });
            this.bump(this.coinText);
        } else {
            Sfx.play('gateBad');
            this.tweens.add({ targets: row, x: row.x + 10, duration: 50, yoyo: true, repeat: 3 });
        }
    }

    // --- Merch ---

    private buildMerch(root: Phaser.GameObjects.Container): void {
        const cx = GAME_WIDTH / 2;
        const { fans, merchPending, stadiumTier, campaign } = Progress.data;
        const mult = merchMultiplier(stadiumTier, campaign);
        // e.g. "stadium +50%, promo x2", so players see what their upgrades pay.
        const boosts = [
            stadiumTier > 1 ? `stadium +${Math.round((stadiumMerchBonus(stadiumTier) - 1) * 100)}%` : '',
            isActive(campaign, 'merchPromo') ? 'promo x2' : ''
        ].filter(Boolean);

        const card = this.add.graphics();
        const top = CONTENT_Y + 20;
        const h = 400;
        card.fillStyle(COLORS.ink, 0.3).fillRoundedRect(cx - ROW_W / 2, top + 8, ROW_W, h, 30);
        card.fillStyle(COLORS.panel).fillRoundedRect(cx - ROW_W / 2, top, ROW_W, h, 30);
        card.lineStyle(6, 0xffffff).strokeRoundedRect(cx - ROW_W / 2, top, ROW_W, h, 30);
        root.add(card);

        root.add(this.add.text(cx, top + 50, 'SHOP TAKINGS', textStyle(34, '#cfe3ff')).setOrigin(0.5));
        root.add(this.add.image(cx - 80, top + 125, TEX.coin).setScale(2.2));
        const amount = this.add.text(cx - 40, top + 125, String(merchPending), textStyle(80, '#ffd21f')).setOrigin(0, 0.5);
        root.add(amount);
        root.add(
            this.add
                .text(cx, top + 182, `+${merchPerLevel(fans, mult)} per level from your fans (holds up to ${merchCap(fans, mult)})`, textStyle(22, '#cfe3ff', false))
                .setOrigin(0.5)
        );
        if (boosts.length > 0) root.add(this.add.text(cx, top + 210, boosts.join(', '), textStyle(20, '#7dff8a', false)).setOrigin(0.5));

        if (merchPending > 0) {
            const double =
                merchPending >= MERCH_DOUBLE_MIN
                    ? createRewardedButton(this, cx, top + 250, 'COLLECT ×2', REWARD_IDS.merchDouble, () => this.collect(2), {
                          width: 400,
                          height: 88,
                          fontSize: 40,
                          canGrant: () => !this.leaving
                      })
                    : null;
            const collectY = double ? top + 340 : top + 290;
            if (double) root.add(double);
            root.add(createButton(this, cx, collectY, 'COLLECT', () => this.collect(1), { width: 300, height: 70, fontSize: 34, pulse: !double }));
        } else {
            root.add(this.add.text(cx, top + 290, 'Play a level to sell more!', textStyle(30)).setOrigin(0.5));
        }

        root.add(
            createButton(this, cx, CONTENT_Y + 520, 'KITS', () => this.leave(() => this.scene.start('Shop', { back: 'Club' })), {
                width: 300,
                height: 90,
                fontSize: 40,
                color: COLORS.buttonAlt
            })
        );
    }

    private collect(multiplier: 1 | 2): void {
        const amount = Progress.collectMerch(multiplier);
        if (amount <= 0) return;
        Sfx.play(multiplier === 2 ? 'win' : 'coin');
        this.flyCoins(Math.min(12, 4 + Math.floor(amount / 10)));
        this.refresh();
        this.bump(this.coinText);
    }

    /** A handful of coins fly from the takings into the coin chip. */
    private flyCoins(count: number): void {
        for (let i = 0; i < count; i++) {
            const coin = this.add.image(GAME_WIDTH / 2 + Phaser.Math.Between(-80, 80), CONTENT_Y + 145, TEX.coin).setScale(1.6).setDepth(10);
            this.tweens.add({
                targets: coin,
                x: COIN_CHIP.x - 72,
                y: COIN_CHIP.y,
                scale: 1.1,
                delay: i * 45,
                duration: 450,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                    coin.destroy();
                    Sfx.play('coin', 1 + i * 0.04);
                }
            });
        }
    }

    private bump(text: Phaser.GameObjects.Text): void {
        this.tweens.add({ targets: text, scale: { from: 1.3, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    }
}
