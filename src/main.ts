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

Playables.boot(() => {
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

    Playables.onPause(() => {
        game.pause();
        Sfx.suspend();
        void Progress.save();
    });
    Playables.onResume(() => {
        game.resume();
        Sfx.resume();
    });
});
