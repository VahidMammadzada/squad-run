import * as Phaser from 'phaser';
import { Sfx } from './audio/Sfx';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { LevelCompleteScene } from './scenes/LevelCompleteScene';
import { ShopScene } from './scenes/ShopScene';
import { TitleScene } from './scenes/TitleScene';
import { Playables } from './sdk/Playables';
import { Progress } from './state/Progress';
import { Stage } from './three/Stage';
import lilitaUrl from './assets/fonts/LilitaOne-Regular.ttf?url';

// Dev only: `?mock` installs a fake SDK with a debug panel. The DEV check is
// constant-folded away in production builds, taking the import with it.
const sdkReady: Promise<void> =
    import.meta.env.DEV && new URLSearchParams(location.search).has('mock')
        ? import('./sdk/mockYtgame').then((m) => m.installMockYtgame())
        : Promise.resolve();

// Canvas text (Phaser and the 3D gate labels) only uses a font that is already
// loaded, so load it before anything draws. A failure just falls back to Arial Black.
const fontReady: Promise<unknown> = new FontFace('Lilita One', `url(${lilitaUrl})`)
    .load()
    .then((face) => document.fonts.add(face))
    .catch(() => undefined);

void Promise.all([sdkReady, fontReady]).then(() => Playables.boot(() => {
    const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'game',
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        // Transparent so the Three.js gameplay canvas underneath shows through.
        transparent: true,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        // Sound goes through Sfx so it can follow YouTube's audio setting.
        audio: { noAudio: true },
        disableContextMenu: true,
        banner: false,
        scene: [BootScene, TitleScene, GameScene, LevelCompleteScene, GameOverScene, ShopScene]
    });
    Stage.attach(game);
    // Dev only: lets scripts/capture.mjs see which scenes are running.
    if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;

    Playables.onPause(() => {
        game.pause();
        Sfx.suspend();
        void Progress.save();
    });
    Playables.onResume(() => {
        game.resume();
        Sfx.resume();
    });
}));
