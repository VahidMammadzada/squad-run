import * as Phaser from 'phaser';
import { createPlaceholderTextures } from '../art/textures';
import { Sfx } from '../audio/Sfx';
import { COLORS, GAME_WIDTH } from '../config';
import { Playables } from '../sdk/Playables';
import { Progress } from '../state/Progress';
import { textStyle } from '../ui/widgets';

/** Loading screen: builds textures and waits for the cloud save. */
export class BootScene extends Phaser.Scene {
    constructor() {
        super('Boot');
    }

    create(): void {
        // Playables must pause only on the SDK's onPause, never on the Page
        // Visibility API, so drop Phaser's own hidden/visible handlers. (They are
        // attached after the postBoot callback, so this can't go there.)
        this.game.events.off(Phaser.Core.Events.HIDDEN);
        this.game.events.off(Phaser.Core.Events.VISIBLE);

        this.cameras.main.setBackgroundColor(COLORS.bg);
        this.add.text(GAME_WIDTH / 2, 560, 'SQUAD RUN', textStyle(80)).setOrigin(0.5);
        this.add.text(GAME_WIDTH / 2, 670, 'Loading…', textStyle(32)).setOrigin(0.5);

        // The loading screen above is now what's on screen.
        this.game.events.once(Phaser.Core.Events.POST_RENDER, () => Playables.firstFrameReady());

        createPlaceholderTextures(this);
        Sfx.init();
        void Progress.load().then(async () => {
            if (import.meta.env.DEV && (await import('../dev/devStart')).devStartScene(this)) return;
            this.scene.start('Title');
        });
    }
}
