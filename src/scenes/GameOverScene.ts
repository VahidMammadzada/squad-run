import * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { COLORS, GAME_WIDTH } from '../config';
import { REWARD_IDS } from '../game/adPolicy';
import { INJURY_RUNS } from '../club/balance';
import { REVIVE_SQUAD } from '../game/revive';
import { Playables } from '../sdk/Playables';
import { Progress } from '../state/Progress';
import { createRewardedButton } from '../ui/rewardedButton';
import { createButton, createPanel, textStyle } from '../ui/widgets';
import type { GameScene } from './GameScene';

export interface GameOverData {
    level: number;
    coins: number;
    /** Offer a rewarded revive (once per attempt, and only where rewarded ads exist). */
    canRevive?: boolean;
    /** The active star picked up an injury; it sticks unless the player revives. */
    injuredStar?: { id: string; name: string };
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
        const injured = this.result.injuredStar;
        // The revive offer and the injury notice each need a row; the panel grows around them.
        const injuryRow = injured ? 50 : 0;
        const dy = (revive ? -60 : 0) - injuryRow / 2;
        createPanel(this, 600, (revive ? 740 : 620) + injuryRow, COLORS.gateBad, 190);

        this.add.text(cx, 425 + dy, 'SQUAD\nLOST!', textStyle(68)).setOrigin(0.5).setLineSpacing(-8);
        this.add.text(cx, 565 + dy, `LEVEL ${this.result.level}`, textStyle(36)).setOrigin(0.5);
        this.add.container(cx, 625 + dy, [
            this.add.image(-150, 0, TEX.coin).setScale(1.3),
            this.add.text(-125, 0, `+${this.result.coins} COINS KEPT`, textStyle(32, '#ffd21f')).setOrigin(0, 0.5)
        ]);
        if (injured) {
            const note = revive ? 'REVIVE TO AVOID IT' : `OUT ${INJURY_RUNS} LEVELS`;
            this.add
                .text(cx, 625 + dy + 46, `${injured.name.toUpperCase()} INJURED! ${note}`, textStyle(24, '#ffb3b3'))
                .setOrigin(0.5);
        }
        const by = dy + injuryRow;

        const reviveButton = revive
            ? createRewardedButton(this, cx, 748 + by, `REVIVE +${REVIVE_SQUAD}`, REWARD_IDS.revive, () => this.revive(), {
                  width: 440,
                  height: 110,
                  fontSize: 48,
                  canGrant: () => !this.leaving
              })
            : null;
        const retryY = reviveButton ? 748 + by + 124 : 748 + by;

        // RETRY stays a full-size button: carrying on without the ad must always be easy.
        createButton(this, cx, retryY, 'RETRY', () => this.moveOn(() => this.scene.start('Game', { level: this.result.level })), {
            width: 400,
            height: reviveButton ? 100 : 110,
            fontSize: reviveButton ? 44 : 52,
            pulse: !reviveButton
        });
        // Back to the club to spend coins or heal a star; the title is one tap away from there.
        createButton(
            this,
            cx,
            retryY + 118,
            'STADIUM',
            () =>
                this.moveOn(() => {
                    this.scene.stop('Game');
                    this.scene.start('Stadium', {});
                }),
            { width: 300, height: 80, fontSize: 32, color: COLORS.buttonAlt }
        );
    }

    private leave(go: () => void): void {
        if (this.leaving) return;
        this.leaving = true;
        go();
    }

    /** Leaves without reviving: the run counts as failed for the star (fitness, injury). */
    private moveOn(go: () => void): void {
        this.leave(() => {
            Progress.failRun(this.result.injuredStar !== undefined);
            go();
        });
    }

    private revive(): void {
        this.leave(() => {
            const game = this.scene.get('Game') as GameScene;
            this.scene.stop();
            game.revive();
        });
    }
}
