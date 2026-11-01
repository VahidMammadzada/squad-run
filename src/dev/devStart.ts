// Dev-server only: `?scene=<Key>&level=<n>` jumps straight to a scene so
// screenshots (scripts/capture.mjs) don't have to click through menus.
// BootScene only imports this in dev, so it never reaches a production build.
import * as Phaser from 'phaser';
import type { GameOverData } from '../scenes/GameOverScene';
import type { LevelCompleteData } from '../scenes/LevelCompleteScene';

const SCENES = ['Title', 'Shop', 'Club', 'Game', 'LevelComplete', 'GameOver'] as const;
type SceneKey = (typeof SCENES)[number];

/** Starts the scene named in the URL; returns false if there is none. */
export function devStartScene(boot: Phaser.Scene): boolean {
    const params = new URLSearchParams(location.search);
    const key = params.get('scene') as SceneKey | null;
    if (!key || !SCENES.includes(key)) return false;
    const level = Math.max(1, Number(params.get('level')) || 1);

    if (key === 'LevelComplete' || key === 'GameOver') {
        // Overlays need a paused Game scene underneath, like in real play.
        const data: LevelCompleteData | GameOverData =
            key === 'LevelComplete'
                ? { level, goals: 3, coinsCollected: 42, goalBonus: 30, fans: 30, newBest: true }
                : { level, coins: 17, canRevive: true };
        const game = boot.scene.get('Game');
        // After the first update, so the 3D world has rendered a frame behind the overlay.
        game.events.once(Phaser.Scenes.Events.POST_UPDATE, () => {
            game.scene.pause();
            game.scene.launch(key, data);
        });
        boot.scene.start('Game', { level });
    } else {
        boot.scene.start(key, { level });
    }
    return true;
}
