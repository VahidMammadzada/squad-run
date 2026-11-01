import * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { COLORS, GAME_WIDTH } from '../config';
import { Sfx } from '../audio/Sfx';
import { REWARD_IDS } from '../game/adPolicy';
import { COIN_MULTIPLIER, multiplierBonus } from '../game/scoring';
import { Playables } from '../sdk/Playables';
import { Progress } from '../state/Progress';
import { createRewardedButton } from '../ui/rewardedButton';
import { createButton, createPanel, popIn, textStyle } from '../ui/widgets';

export interface LevelCompleteData {
    level: number;
    goals: number;
    coinsCollected: number;
    goalBonus: number;
    /** Fans the club gained this level. */
    fans: number;
    newBest: boolean;
}

/** Shown over the paused Game scene. */
export class LevelCompleteScene extends Phaser.Scene {
    private result!: LevelCompleteData;
    /** Set once a button is pressed, so taps during an ad request can't start two things. */
    private leaving = false;

    constructor() {
        super('LevelComplete');
    }

    init(data: LevelCompleteData): void {
        this.result = data;
        this.leaving = false;
    }

    create(): void {
        const cx = GAME_WIDTH / 2;
        const { level, goals, coinsCollected, goalBonus, fans, newBest } = this.result;
        const earned = coinsCollected + goalBonus;
        // The ×3 offer needs one more row; everything above it moves up to make room.
        const offer = earned > 0 && Playables.rewardedAvailable();
        const dy = offer ? -60 : 0;
        createPanel(this, 620, offer ? 920 : 800, COLORS.button);
        this.coinShower();

        this.add.text(cx, 325 + dy, `LEVEL ${level}
COMPLETE!`, textStyle(56)).setOrigin(0.5).setLineSpacing(-6);
        const goalsText = this.add.text(cx, 500 + dy, '0', textStyle(140, '#ffd21f')).setOrigin(0.5);
        popIn(this, goalsText, 150);
        this.add.text(cx, 590 + dy, goals === 1 ? 'GOAL' : 'GOALS', textStyle(40)).setOrigin(0.5);
        // Coins and fans side by side.
        const coinsText = this.add.text(cx - 130, 668 + dy, '+0', textStyle(44, '#ffd21f')).setOrigin(0, 0.5);
        const fansText = this.add.text(cx + 100, 668 + dy, '+0', textStyle(44, '#ff8fb6')).setOrigin(0, 0.5);
        this.add.image(cx - 160, 668 + dy, TEX.coin).setScale(1.5);
        this.add.image(cx + 70, 668 + dy, TEX.fan).setScale(1.4);
        const detail = this.add
            .text(cx, 718 + dy, `${coinsCollected} collected + ${goalBonus} goal bonus`, textStyle(24, '#cfe3ff', false))
            .setOrigin(0.5);

        // Goals, then coins, count up.
        this.countUp(goalsText, goals, 150, '');
        this.countUp(coinsText, earned, 700, '+');
        this.countUp(fansText, fans, 900, '+');
        if (newBest) {
            const best = this.add.text(cx, 776 + dy, 'NEW BEST!', textStyle(44, '#ffd21f')).setOrigin(0.5).setAngle(-4);
            popIn(this, best, 1300);
            this.tweens.add({ targets: best, angle: 4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 1650 });
        }

        const tripled = offer
            ? createRewardedButton(
                  this,
                  cx,
                  812,
                  `×${COIN_MULTIPLIER} COINS`,
                  REWARD_IDS.tripleCoins,
                  () => {
                      const bonus = multiplierBonus(earned);
                      Progress.addCoins(bonus);
                      detail.setText(`${coinsCollected} collected + ${goalBonus} goal bonus, ×${COIN_MULTIPLIER}`);
                      this.countUp(coinsText, earned + bonus, 0, '+', earned);
                      this.coinShower();
                      Sfx.play('win');
                  },
                  { width: 420, height: 100, fontSize: 46, canGrant: () => !this.leaving }
              )
            : null;
        const nextY = tripled ? 932 : 872;

        // Every level ends in the stadium, where PLAY starts the next one. This
        // button stays full-size: carrying on without the ad must always be easy.
        createButton(this, cx, nextY, 'TO THE STADIUM', () => this.toStadium(), {
            width: 420,
            height: 110,
            fontSize: 40,
            pulse: !tripled
        });
        createButton(
            this,
            cx,
            nextY + 116,
            'MENU',
            () => {
                if (this.leaving) return;
                this.leaving = true;
                this.scene.stop('Game');
                this.scene.start('Title');
            },
            { width: 260, height: 80, fontSize: 32, color: COLORS.buttonAlt }
        );
    }

    private toStadium(): void {
        if (this.leaving) return;
        this.leaving = true;
        this.scene.stop('Game');
        this.scene.start('Stadium');
    }

    private coinShower(): void {
        for (let i = 0; i < 26; i++) {
            const coin = this.add.image(Phaser.Math.Between(30, GAME_WIDTH - 30), -40 - Math.random() * 300, TEX.coin).setScale(1.2 + Math.random());
            this.tweens.add({
                targets: coin,
                y: 1350,
                angle: Phaser.Math.Between(-360, 360),
                duration: Phaser.Math.Between(1100, 1800),
                delay: 200 + i * 35,
                ease: 'Quad.easeIn',
                onComplete: () => coin.destroy()
            });
        }
    }

    private countUp(text: Phaser.GameObjects.Text, to: number, delay: number, prefix: string, from = 0): void {
        const counter = { value: from };
        this.tweens.add({
            targets: counter,
            value: to,
            delay,
            duration: Math.min(900, 120 + (to - from) * 25),
            ease: 'Cubic.easeOut',
            onUpdate: () => text.setText(`${prefix}${Math.round(counter.value)}`),
            onComplete: () => {
                text.setText(`${prefix}${to}`);
                this.tweens.add({ targets: text, scale: { from: 1.25, to: 1 }, duration: 250, ease: 'Back.easeOut' });
            }
        });
    }
}
