// The MERCH stall: collect shop takings (x2 with a rewarded ad), and the kit shop.
import * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { Sfx } from '../audio/Sfx';
import { MERCH_DOUBLE_MIN } from '../club/balance';
import { merchCap, merchPerLevel } from '../club/merch';
import { isActive, merchMultiplier, stadiumMerchBonus } from '../club/office';
import { COLORS, GAME_WIDTH } from '../config';
import { REWARD_IDS } from '../game/adPolicy';
import { Progress } from '../state/Progress';
import { createRewardedButton } from '../ui/rewardedButton';
import { createButton, textStyle } from '../ui/widgets';
import { CONTENT_Y, ROW_W, type ClubHost } from './clubUi';

/** `backTo` is the scene the kit shop's BACK button returns to. */
export function buildMerch(host: ClubHost, root: Phaser.GameObjects.Container, backTo: string): void {
    const { scene } = host;
    const cx = GAME_WIDTH / 2;
    const { fans, merchPending, stadiumTier, campaign } = Progress.data;
    const mult = merchMultiplier(stadiumTier, campaign);
    // e.g. "stadium +50%, promo x2", so players see what their upgrades pay.
    const boosts = [
        stadiumTier > 1 ? `stadium +${Math.round((stadiumMerchBonus(stadiumTier) - 1) * 100)}%` : '',
        isActive(campaign, 'merchPromo') ? 'promo x2' : ''
    ].filter(Boolean);

    const card = scene.add.graphics();
    const top = CONTENT_Y + 20;
    const h = 400;
    card.fillStyle(COLORS.ink, 0.3).fillRoundedRect(cx - ROW_W / 2, top + 8, ROW_W, h, 30);
    card.fillStyle(COLORS.panel).fillRoundedRect(cx - ROW_W / 2, top, ROW_W, h, 30);
    card.lineStyle(6, 0xffffff).strokeRoundedRect(cx - ROW_W / 2, top, ROW_W, h, 30);
    root.add(card);

    root.add(scene.add.text(cx, top + 50, 'SHOP TAKINGS', textStyle(34, '#cfe3ff')).setOrigin(0.5));
    root.add(scene.add.image(cx - 80, top + 125, TEX.coin).setScale(2.2));
    root.add(scene.add.text(cx - 40, top + 125, String(merchPending), textStyle(80, '#ffd21f')).setOrigin(0, 0.5));
    root.add(
        scene.add
            .text(cx, top + 182, `+${merchPerLevel(fans, mult)} per level from your fans (holds up to ${merchCap(fans, mult)})`, textStyle(22, '#cfe3ff', false))
            .setOrigin(0.5)
    );
    if (boosts.length > 0) root.add(scene.add.text(cx, top + 210, boosts.join(', '), textStyle(20, '#7dff8a', false)).setOrigin(0.5));

    if (merchPending > 0) {
        const double =
            merchPending >= MERCH_DOUBLE_MIN
                ? createRewardedButton(scene, cx, top + 250, 'COLLECT ×2', REWARD_IDS.merchDouble, () => collect(host, 2), {
                      width: 400,
                      height: 88,
                      fontSize: 40,
                      canGrant: () => !host.isLeaving()
                  })
                : null;
        const collectY = double ? top + 340 : top + 290;
        if (double) root.add(double);
        root.add(createButton(scene, cx, collectY, 'COLLECT', () => collect(host, 1), { width: 300, height: 70, fontSize: 34, pulse: !double }));
    } else {
        root.add(scene.add.text(cx, top + 290, 'Play a level to sell more!', textStyle(30)).setOrigin(0.5));
    }

    root.add(
        createButton(scene, cx, CONTENT_Y + 520, 'KITS', () => host.leave(() => scene.scene.start('Shop', { back: backTo })), {
            width: 300,
            height: 90,
            fontSize: 40,
            color: COLORS.buttonAlt
        })
    );
}

function collect(host: ClubHost, multiplier: 1 | 2): void {
    const amount = Progress.collectMerch(multiplier);
    if (amount <= 0) return;
    Sfx.play(multiplier === 2 ? 'win' : 'coin');
    flyCoins(host, Math.min(12, 4 + Math.floor(amount / 10)));
    host.coinsChanged();
    host.refresh();
}

/** A handful of coins fly from the takings into the coin counter. */
function flyCoins(host: ClubHost, count: number): void {
    const { scene, coinTarget } = host;
    for (let i = 0; i < count; i++) {
        const coin = scene.add.image(GAME_WIDTH / 2 + Phaser.Math.Between(-80, 80), CONTENT_Y + 145, TEX.coin).setScale(1.6).setDepth(10);
        scene.tweens.add({
            targets: coin,
            x: coinTarget.x,
            y: coinTarget.y,
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
