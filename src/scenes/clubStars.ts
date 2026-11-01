// The club's star-player booths (SQUAD, SCOUT, DOCTOR), built into the
// ClubScene content area.
import * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { Sfx } from '../audio/Sfx';
import { FITNESS_MAX, HEAL_PRICE, REST_PRICE, TRANSFER_REFRESH_LEVELS } from '../club/balance';
import { canSign, fanGate, isTired, releaseRefund, skillDef, starPrice, type StarPlayer } from '../club/stars';
import { COLORS, GAME_WIDTH } from '../config';
import { REWARD_IDS } from '../game/adPolicy';
import { Progress } from '../state/Progress';
import { createRewardedButton } from '../ui/rewardedButton';
import { createButton, onTap, textStyle } from '../ui/widgets';
import { cardBackground, CONTENT_Y, fanLock, floatText, GREY, INK, pillButton, ROW_W, shake, SUB, type ClubHost } from './clubUi';

const SKIN = 0xe0ac69;

/** Release asks for a second tap; this remembers which star is waiting for it. */
let confirmRelease: { id: string; until: number } | null = null;

// --- SQUAD ---

export function buildSquad(host: ClubHost, root: Phaser.GameObjects.Container): void {
    const { scene } = host;
    const { roster, activeStar } = Progress.data;
    const cx = GAME_WIDTH / 2;
    if (roster.length === 0) {
        root.add(scene.add.image(cx, CONTENT_Y + 150, TEX.star).setScale(4));
        root.add(scene.add.text(cx, CONTENT_Y + 270, 'NO STARS YET', textStyle(48)).setOrigin(0.5));
        root.add(scene.add.text(cx, CONTENT_Y + 330, 'Stars lead your squad and bring a skill to every run.', textStyle(24, '#e8f1ff', false)).setOrigin(0.5));
        root.add(createButton(scene, cx, CONTENT_Y + 440, 'VISIT THE SCOUT', () => host.showBooth('scout'), { width: 420, height: 96, fontSize: 40, pulse: true }));
        return;
    }
    roster.forEach((star, i) => {
        const row = starRow(scene, star, cx, CONTENT_Y + 70 + i * 114, 104);
        const active = star.id === activeStar;
        const injured = star.injuredLevels > 0;

        // Status pill: PLAYING (tap to bench), START, or OUT n (injured).
        const label = injured ? `OUT ${star.injuredLevels}` : active ? 'PLAYING' : 'START';
        const color = injured ? COLORS.gateBad : active ? COLORS.gold : COLORS.button;
        const pill = pillButton(scene, 220, -18, 160, 50, color, label, injured ? null : () => {
            Sfx.play('click');
            Progress.setActiveStar(active ? null : star.id);
            host.refresh();
        });
        row.add(pill);

        // RELEASE, with a second tap to confirm.
        const refund = releaseRefund(star);
        const confirming = confirmRelease?.id === star.id && confirmRelease.until > scene.time.now;
        const release = scene.add
            .text(220, 32, confirming ? `TAP AGAIN: +${refund}` : 'RELEASE', textStyle(18, confirming ? '#e53935' : '#8a96b8', false))
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        onTap(release, () => {
            if (confirming) {
                confirmRelease = null;
                Progress.releaseStar(star.id);
                Sfx.play('coin');
                host.coinsChanged();
            } else {
                confirmRelease = { id: star.id, until: scene.time.now + 3000 };
                Sfx.play('click');
            }
            host.refresh();
        });
        row.add(release);
        root.add(row);
    });
}

// --- SCOUT ---

export function buildScout(host: ClubHost, root: Phaser.GameObjects.Container): void {
    const { scene } = host;
    const list = Progress.transferList();
    const { level, coins, fans, roster } = Progress.data;
    const cx = GAME_WIDTH / 2;
    const left = Math.max(1, TRANSFER_REFRESH_LEVELS - (level - list.refreshedAtLevel));

    root.add(scene.add.text(48, CONTENT_Y + 36, `NEW LIST IN ${left} ${left === 1 ? 'LEVEL' : 'LEVELS'}`, textStyle(26)).setOrigin(0, 0.5));
    const refresh = createRewardedButton(scene, 548, CONTENT_Y + 36, 'NEW LIST', REWARD_IDS.scoutRefresh, () => {
        Progress.refreshTransfer();
        host.refresh();
    }, { width: 250, height: 64, fontSize: 28, canGrant: () => !host.isLeaving() });
    if (refresh) root.add(refresh);

    if (list.candidates.length === 0) {
        root.add(scene.add.image(cx, CONTENT_Y + 240, TEX.scout).setScale(2.4));
        root.add(scene.add.text(cx, CONTENT_Y + 360, 'The scout is out looking...', textStyle(34)).setOrigin(0.5));
        return;
    }

    list.candidates.forEach((star, i) => {
        const y = CONTENT_Y + 150 + i * 162;
        const row = starRow(scene, star, cx, y, 146, true);
        const check = canSign(star, coins, fans, roster);
        if (check === 'fans') {
            // Hard fan gate: show what it takes, with progress.
            row.add(fanLock(scene, 220, fans, fanGate(star.popularity)));
        } else if (check === 'full') {
            row.add(pillButton(scene, 220, -10, 170, 52, GREY, 'SQUAD FULL', null));
        } else {
            const price = starPrice(star.popularity);
            const pill = pillButton(scene, 220, -10, 170, 56, check === 'ok' ? COLORS.button : GREY, String(price), () => {
                if (Progress.buyStar(star.id)) {
                    Sfx.play('win');
                    host.coinsChanged();
                    host.refresh();
                    floatText(scene, 'SIGNED!', cx, y, '#ffd21f');
                } else {
                    Sfx.play('gateBad');
                    shake(scene, row);
                }
            }, true);
            row.add(pill);
        }
        root.add(row);
    });
}

// --- DOCTOR ---

export function buildDoctor(host: ClubHost, root: Phaser.GameObjects.Container): void {
    const { scene } = host;
    const cx = GAME_WIDTH / 2;
    const patients = Progress.data.roster.filter((s) => s.injuredLevels > 0 || s.fitness < FITNESS_MAX);
    if (patients.length === 0) {
        root.add(scene.add.image(cx, CONTENT_Y + 170, TEX.medic).setScale(2.4));
        root.add(scene.add.text(cx, CONTENT_Y + 290, "EVERYONE'S FIT!", textStyle(48)).setOrigin(0.5));
        const hint = Progress.data.roster.length === 0 ? 'Sign a star at the scout first.' : 'Tired or injured stars come here.';
        root.add(scene.add.text(cx, CONTENT_Y + 350, hint, textStyle(24, '#e8f1ff', false)).setOrigin(0.5));
        return;
    }
    patients.forEach((star, i) => {
        const row = starRow(scene, star, cx, CONTENT_Y + 70 + i * 120, 110);
        if (star.injuredLevels > 0) {
            row.add(
                pillButton(scene, 220, -24, 170, 44, Progress.data.coins >= HEAL_PRICE ? COLORS.button : GREY, String(HEAL_PRICE), () => treat(host, row, Progress.healStar(star.id, false)), true)
            );
            const free = createRewardedButton(scene, 220, 22, 'HEAL FREE', REWARD_IDS.doctorHeal, () => treat(host, row, Progress.healStar(star.id, true)), {
                width: 170,
                height: 38,
                fontSize: 20,
                canGrant: () => !host.isLeaving()
            });
            if (free) row.add(free);
        } else {
            row.add(pillButton(scene, 220, -6, 170, 52, Progress.data.coins >= REST_PRICE ? COLORS.button : GREY, String(REST_PRICE), () => treat(host, row, Progress.restStar(star.id)), true));
            row.add(scene.add.text(220, 34, 'REST TO 100', textStyle(16, SUB, false)).setOrigin(0.5));
        }
        root.add(row);
    });
}

function treat(host: ClubHost, row: Phaser.GameObjects.Container, ok: boolean): void {
    if (ok) {
        Sfx.play('win');
        host.coinsChanged();
        floatText(host.scene, 'ALL BETTER!', row.x, row.y, '#7dff8a');
        host.refresh();
    } else {
        Sfx.play('gateBad');
        shake(host.scene, row);
    }
}

// --- Shared pieces ---

/** White card with avatar, name, popularity, skill and fitness. Buttons go on the right (x ≈ 220). */
function starRow(scene: Phaser.Scene, star: StarPlayer, x: number, y: number, h: number, big = false): Phaser.GameObjects.Container {
    const bg = cardBackground(scene, h);

    const r = big ? 44 : 36;
    const ax = -ROW_W / 2 + 22 + r;
    const avatar = scene.add.graphics();
    avatar.fillStyle(Progress.data.activeStar === star.id ? COLORS.gold : 0xdde3ee).fillCircle(ax, 0, r);
    avatar.fillStyle(SKIN).fillRoundedRect(ax - r * 0.42, -r * 0.42, r * 0.84, r * 0.84, r * 0.15);
    avatar.fillStyle(star.hair).fillRoundedRect(ax - r * 0.48, -r * 0.6, r * 0.96, r * 0.32, r * 0.1);
    avatar.fillStyle(COLORS.ink).fillCircle(ax - r * 0.17, r * 0.02, r * 0.07).fillCircle(ax + r * 0.17, r * 0.02, r * 0.07);
    avatar.fillStyle(COLORS.ink, 0.15).fillRect(ax - r * 0.42, r * 0.42, r * 0.84, r * 0.12);

    const tx = ax + r + 18;
    const items: Phaser.GameObjects.GameObject[] = [bg, avatar];
    const name = scene.add.text(tx, big ? -38 : -28, star.name.toUpperCase(), textStyle(big ? 30 : 26, INK, false)).setOrigin(0, 0.5);
    items.push(name);
    // Popularity: under the name on big cards, after it on compact rows.
    for (let p = 0; p < star.popularity; p++) {
        const px = big ? tx + 12 + p * 24 : name.x + name.width + 18 + p * 22;
        items.push(scene.add.image(px, big ? -4 : name.y, TEX.star).setScale(0.62));
    }
    const skill = skillDef(star.skill);
    const tired = isTired(star);
    items.push(
        scene.add
            .text(tx, big ? 30 : 4, `${skill.name.toUpperCase()}: ${tired ? 'tired, half strength' : skill.effect}`, textStyle(18, tired ? '#d9822b' : SUB, false))
            .setOrigin(0, 0.5)
    );
    if (!big) {
        const bar = scene.add.graphics();
        const w = 150;
        const fit = star.fitness / FITNESS_MAX;
        bar.fillStyle(0xdde3ee).fillRoundedRect(tx, 26, w, 14, 7);
        bar.fillStyle(fit >= 0.5 ? COLORS.button : fit >= 0.25 ? COLORS.buttonAccent : COLORS.gateBad).fillRoundedRect(tx, 26, Math.max(14, w * fit), 14, 7);
        items.push(bar, scene.add.text(tx + w + 10, 33, `FIT ${star.fitness}`, textStyle(16, SUB, false)).setOrigin(0, 0.5));
    }
    return scene.add.container(x, y, items).setSize(ROW_W, h);
}
