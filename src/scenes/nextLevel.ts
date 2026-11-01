import type * as Phaser from 'phaser';
import { AD_CONFIG, adPolicy } from '../game/adPolicy';
import { Playables } from '../sdk/Playables';
import { Progress } from '../state/Progress';

/**
 * Starts the player's next level from a screen shown after a level (results or
 * club): the natural break where an interstitial may run, paced by adPolicy.
 */
export async function startNextLevel(scene: Phaser.Scene): Promise<void> {
    const next = Progress.data.level;
    if (adPolicy.canShowInterstitial(next, Date.now())) {
        if (await Playables.showInterstitial(AD_CONFIG.requestTimeoutMs)) adPolicy.interstitialShown(Date.now());
    }
    scene.scene.start('Game', { level: next });
}
