import * as Phaser from 'phaser';
import { COLORS } from '../config';
import { adPolicy } from '../game/adPolicy';
import { Playables } from '../sdk/Playables';
import { createButton, textStyle } from './widgets';

interface RewardedButtonOptions {
    width?: number;
    height?: number;
    fontSize?: number;
    color?: number;
    /** Return false to drop a reward that arrives too late (e.g. the player already left). */
    canGrant?: () => boolean;
}

/**
 * An opt-in "watch an ad for X" button with a play badge. Returns null when
 * rewarded ads aren't available, so callers lay out without it. While the ad
 * runs the button is disabled; other buttons on screen stay usable, as the
 * certification rules require a way to carry on without watching.
 */
export function createRewardedButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    rewardId: string,
    onEarned: () => void,
    { width = 420, height = 100, fontSize = 40, color = COLORS.buttonAccent, canGrant = () => true }: RewardedButtonOptions = {}
): Phaser.GameObjects.Container | null {
    if (!Playables.rewardedAvailable()) return null;

    let gone = false;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (gone = true));

    let busy = false;
    const button = createButton(
        scene,
        x,
        y,
        label,
        async () => {
            if (busy) return;
            busy = true;
            button.disableInteractive().setAlpha(0.6);
            const result = await Playables.showRewarded(rewardId);
            if (result !== 'failed') adPolicy.rewardedShown(Date.now());
            if (gone) return;
            if (result === 'earned') {
                button.destroy();
                if (canGrant()) onEarned();
            } else if (result === 'failed') {
                button.destroy();
                noAdToast(scene, x, y);
            } else {
                busy = false;
                button.setInteractive().setAlpha(1);
            }
        },
        { width, height, fontSize, color, pulse: true }
    );

    // Play badge to the left of the label marks this as an ad.
    const text = button.list[1] as Phaser.GameObjects.Text;
    const badgeSize = Math.round(height * 0.46);
    text.x = badgeSize / 2 + 6;
    const bx = text.x - text.width / 2 - badgeSize / 2 - 12;
    const badge = scene.add.graphics();
    badge.fillStyle(0xffffff).fillRoundedRect(bx - badgeSize / 2, -3 - badgeSize / 2, badgeSize, badgeSize, badgeSize * 0.28);
    const t = badgeSize * 0.22;
    badge.fillStyle(color).fillTriangle(bx - t * 0.8, -3 - t, bx - t * 0.8, -3 + t, bx + t * 1.1, -3);
    button.add(badge);
    return button;
}

function noAdToast(scene: Phaser.Scene, x: number, y: number): void {
    const toast = scene.add.text(x, y, 'NO AD RIGHT NOW', textStyle(30, '#cfe3ff')).setOrigin(0.5);
    scene.tweens.add({ targets: toast, alpha: 0, y: y - 30, delay: 1200, duration: 400, onComplete: () => toast.destroy() });
}
