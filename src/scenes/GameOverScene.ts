import * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { COLORS, GAME_WIDTH } from '../config';
import { REWARD_IDS } from '../game/adPolicy';
import { REVIVE_SQUAD } from '../game/revive';
import { Playables } from '../sdk/Playables';
import { createRewardedButton } from '../ui/rewardedButton';
import { createButton, createPanel, textStyle } from '../ui/widgets';
import type { GameScene } from './GameScene';

export interface GameOverData {
    level: number;
    coins: number;
    /** Offer a rewarded revive (once per attempt, and only where rewarded ads exist). */
    canRevive?: boolean;
}

/** Shown over the paused Game scene when the squad is wiped out. */
export class GameOverScene extends Phaser.Scene {
    private result!: GameOverData;
    /** Set once the player leaves, so a late ad reward can't revive a level they quit. */
    private leaving = false;

    constructor() {
        super('GameOver');
    }

    init(data: GameOverData): void {
        this.result = data;
        this.leaving = false;
    }

    create(): void {
        const cx = GAME_WIDTH / 2;
        // The revive offer needs one more row; everything moves up to make room.
        const revive = this.result.canRevive === true && Playables.rewardedAvailable();
        const dy = revive ? -60 : 0;
        createPanel(this, 600, revive ? 740 : 620, COLORS.gateBad, 190);

        this.add.text(cx, 425 + dy, 'SQUAD\nLOST!', textStyle(68)).setOrigin(0.5).setLineSpacing(-8);
        this.add.text(cx, 565 + dy, `LEVEL ${this.result.level}`, textStyle(36)).setOrigin(0.5);
        this.add.container(cx, 625 + dy, [
            this.add.image(-150, 0, TEX.coin).setScale(1.3),
            this.add.text(-125, 0, `+${this.result.coins} COINS KEPT`, textStyle(32, '#ffd21f')).setOrigin(0, 0.5)
        ]);

        const reviveButton = revive
            ? createRewardedButton(this, cx, 748 + dy, `REVIVE +${REVIVE_SQUAD}`, REWARD_IDS.revive, () => this.revive(), {
                  width: 440,
                  height: 110,
                  fontSize: 48,
                  canGrant: () => !this.leaving
              })
            : null;
        const retryY = reviveButton ? 748 + dy + 124 : 748 + dy;

        // RETRY stays a full-size button: carrying on without the ad must always be easy.
        createButton(this, cx, retryY, 'RETRY', () => this.leave(() => this.scene.start('Game', { level: this.result.level })), {
            width: 400,
            height: reviveButton ? 100 : 110,
            fontSize: reviveButton ? 44 : 52,
            pulse: !reviveButton
        });
        createButton(
            this,
            cx,
            retryY + 118,
            'MENU',
            () =>
                this.leave(() => {
                    this.scene.stop('Game');
                    this.scene.start('Title');
                }),
            { width: 260, height: 80, fontSize: 32, color: COLORS.buttonAlt }
        );
    }

    private leave(go: () => void): void {
        if (this.leaving) return;
        this.leaving = true;
        go();
    }

    private revive(): void {
        this.leave(() => {
            const game = this.scene.get('Game') as GameScene;
            this.scene.stop();
            game.revive();
        });
    }
}
