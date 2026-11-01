// The club OFFICE booth: stadium upgrades and marketing campaigns.
import type * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { Sfx } from '../audio/Sfx';
import { CAMPAIGN_LEVELS, CAMPAIGNS, MAX_STADIUM_TIER } from '../club/balance';
import { campaignDef, canStartCampaign, canUpgradeStadium, stadiumGate, stadiumPrice } from '../club/office';
import { COLORS, GAME_WIDTH } from '../config';
import { REWARD_IDS } from '../game/adPolicy';
import { Progress } from '../state/Progress';
import { createRewardedButton } from '../ui/rewardedButton';
import { textStyle } from '../ui/widgets';
import { cardBackground, CONTENT_Y, fanLock, floatText, GREY, INK, pillButton, ROW_W, shake, SUB, type ClubHost } from './clubUi';

/** What each stadium tier looks like and pays, shown on the stadium card. */
const TIER_PERKS = [
    '',
    'Basic stands',
    'Club-colour seats, merch +25%',
    'Upper tier, merch +50%',
    'Roof and club boards, merch +75%',
    'Floodlights, merch x2'
];

const RIGHT_X = 220;

export function buildOffice(host: ClubHost, root: Phaser.GameObjects.Container): void {
    root.add(stadiumCard(host, CONTENT_Y + 115));
    root.add(host.scene.add.text(48, CONTENT_Y + 262, 'MARKETING', textStyle(34)).setOrigin(0, 0.5));
    marketing(host, root, CONTENT_Y + 262);
}

function stadiumCard(host: ClubHost, y: number): Phaser.GameObjects.Container {
    const { scene } = host;
    const { stadiumTier: tier, coins, fans } = Progress.data;
    const h = 200;
    const left = -ROW_W / 2 + 28;
    const items: Phaser.GameObjects.GameObject[] = [cardBackground(scene, h)];

    items.push(scene.add.text(left, -66, 'STADIUM', textStyle(34, INK, false)).setOrigin(0, 0.5));
    items.push(scene.add.text(left + 168, -64, `TIER ${tier}/${MAX_STADIUM_TIER}`, textStyle(24, SUB, false)).setOrigin(0, 0.5));
    // Tier pips: little stands, growing taller.
    const pips = scene.add.graphics();
    for (let t = 1; t <= MAX_STADIUM_TIER; t++) {
        const ph = 14 + t * 6;
        const px = left + (t - 1) * 40;
        pips.fillStyle(t <= tier ? COLORS.gold : 0xdde3ee).fillRoundedRect(px, -12 - ph / 2 + 14, 32, ph, 6);
        pips.lineStyle(3, COLORS.ink, t <= tier ? 0.8 : 0.25).strokeRoundedRect(px, -12 - ph / 2 + 14, 32, ph, 6);
    }
    items.push(pips);
    items.push(scene.add.text(left, 44, `NOW: ${TIER_PERKS[tier]}`, textStyle(20, SUB, false)).setOrigin(0, 0.5));
    if (tier < MAX_STADIUM_TIER) {
        items.push(scene.add.text(left, 72, `NEXT: ${TIER_PERKS[tier + 1]}`, textStyle(20, '#2f8cff', false)).setOrigin(0, 0.5));
    }

    const card = scene.add.container(GAME_WIDTH / 2, y, items).setSize(ROW_W, h);
    const check = canUpgradeStadium(tier, coins, fans);
    if (check === 'max') {
        card.add(pillButton(scene, RIGHT_X, -40, 170, 56, COLORS.gold, 'MAX', null));
    } else if (check === 'fans') {
        card.add(fanLock(scene, RIGHT_X, fans, stadiumGate(tier + 1)).map((o) => offsetY(o, -24)));
    } else {
        card.add(
            pillButton(scene, RIGHT_X, -40, 170, 56, check === 'ok' ? COLORS.button : GREY, String(stadiumPrice(tier + 1)), () => {
                if (Progress.upgradeStadium()) {
                    Sfx.play('win');
                    host.coinsChanged();
                    host.refresh();
                    floatText(scene, `TIER ${tier + 1}!`, GAME_WIDTH / 2, y, '#ffd21f');
                } else {
                    Sfx.play('gateBad');
                    shake(scene, card);
                }
            }, true)
        );
    }
    return card;
}

function marketing(host: ClubHost, root: Phaser.GameObjects.Container, headerY: number): void {
    const { scene } = host;
    const { campaign, coins } = Progress.data;
    const cx = GAME_WIDTH / 2;

    if (campaign) {
        // One campaign at a time: show it, with the rewarded extension.
        const def = campaignDef(campaign.id);
        const h = 220;
        const y = headerY + 50 + h / 2;
        const card = scene.add.container(cx, y, [
            cardBackground(scene, h),
            scene.add.image(-ROW_W / 2 + 70, -46, TEX.office).setScale(1.3),
            scene.add.text(-ROW_W / 2 + 130, -76, def.name.toUpperCase(), textStyle(34, INK, false)).setOrigin(0, 0.5),
            scene.add.text(-ROW_W / 2 + 130, -42, def.effect, textStyle(24, SUB, false)).setOrigin(0, 0.5),
            scene.add
                .text(-ROW_W / 2 + 130, -8, `${campaign.levelsLeft} ${campaign.levelsLeft === 1 ? 'LEVEL' : 'LEVELS'} LEFT`, textStyle(28, '#2f8cff', false))
                .setOrigin(0, 0.5)
        ]);
        if (!campaign.extended) {
            const extend = createRewardedButton(scene, 0, 62, 'EXTEND +2', REWARD_IDS.campaignExtend, () => {
                if (Progress.extendCampaign()) {
                    Sfx.play('win');
                    host.refresh();
                    floatText(scene, '+2 LEVELS!', cx, y, '#7dff8a');
                }
            }, { width: 320, height: 66, fontSize: 30, canGrant: () => !host.isLeaving() });
            if (extend) card.add(extend);
        } else {
            card.add(scene.add.text(0, 60, 'Already extended', textStyle(22, SUB, false)).setOrigin(0.5));
        }
        root.add(card);
        return;
    }

    root.add(scene.add.text(GAME_WIDTH - 48, headerY, `ONE AT A TIME · ${CAMPAIGN_LEVELS} LEVELS`, textStyle(18, '#e8f1ff', false)).setOrigin(1, 0.5));
    CAMPAIGNS.forEach((def, i) => {
        const h = 96;
        const y = headerY + 50 + h / 2 + i * (h + 12);
        const ok = canStartCampaign(campaign, coins, def.id);
        const row = scene.add.container(cx, y, [
            cardBackground(scene, h),
            scene.add.text(-ROW_W / 2 + 28, -16, def.name.toUpperCase(), textStyle(28, INK, false)).setOrigin(0, 0.5),
            scene.add.text(-ROW_W / 2 + 28, 20, def.effect, textStyle(20, SUB, false)).setOrigin(0, 0.5)
        ]);
        row.add(
            pillButton(scene, RIGHT_X, -2, 170, 52, ok ? COLORS.button : GREY, String(def.price), () => {
                if (Progress.startCampaign(def.id)) {
                    Sfx.play('win');
                    host.coinsChanged();
                    host.refresh();
                    floatText(scene, 'LAUNCHED!', cx, y, '#ffd21f');
                } else {
                    Sfx.play('gateBad');
                    shake(scene, row);
                }
            }, true)
        );
        root.add(row);
    });
}

function offsetY<T extends Phaser.GameObjects.GameObject>(o: T, dy: number): T {
    const t = o as unknown as { y: number };
    t.y += dy;
    return o;
}
