import * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { crowdFill } from '../club/fans';
import { COLORS, GAME_WIDTH, PITCH_CENTER } from '../config';
import { getKit } from '../data/kits';
import { generateLevel } from '../game/levelGen';
import { Playables } from '../sdk/Playables';
import { Progress } from '../state/Progress';
import { Stage } from '../three/Stage';
import { World3D } from '../three/World3D';
import { createButton, drawChip, textStyle } from '../ui/widgets';
import { GOAL_DISTANCE } from './GameScene';

/** Squad size jogging on the start line behind the logo. */
const PREVIEW_SQUAD = 12;

export class TitleScene extends Phaser.Scene {
    private world!: World3D;

    constructor() {
        super('Title');
    }

    create(): void {
        const cx = GAME_WIDTH / 2;
        const { level, fans, coins, selectedKit } = Progress.data;
        const kit = getKit(selectedKit);

        // The next level's stadium, with the squad jogging on the spot in the equipped kit.
        this.world = new World3D(this, generateLevel(level), kit.shirt, GOAL_DISTANCE, { crowdFill: crowdFill(fans), stadiumTier: Progress.data.stadiumTier });
        Stage.show();
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.world.dispose();
            Stage.hide();
        });

        const chips = this.add.graphics();
        drawChip(chips, GAME_WIDTH - 190, 26, 170, 64);
        this.add.image(GAME_WIDTH - 152, 58, TEX.coin).setScale(1.3);
        this.add.text(GAME_WIDTH - 40, 58, String(coins), textStyle(38)).setOrigin(1, 0.5);

        const logo = this.add.container(cx, 270, [
            this.add.text(0, -62, 'SQUAD', textStyle(124)).setOrigin(0.5),
            this.add.text(0, 66, 'RUN', textStyle(150, '#ffd21f')).setOrigin(0.5)
        ]);
        logo.setAngle(-4);
        logo.setScale(0);
        this.tweens.add({ targets: logo, scale: 1, duration: 500, ease: 'Back.easeOut' });
        this.tweens.add({ targets: logo, y: 255, angle: -2, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        drawChip(chips, cx - 200, 448, 400, 64);
        const levelText = this.add.text(0, 0, `LEVEL ${level}  •`, textStyle(32)).setOrigin(0, 0.5);
        const fanIcon = this.add.image(0, 0, TEX.fan).setScale(1.1);
        const fanText = this.add.text(0, 0, `${fans} FANS`, textStyle(32, '#ff8fb6')).setOrigin(0, 0.5);
        // Centre "LEVEL n • ♥ X FANS" as one line inside the chip.
        const width = levelText.width + 12 + fanIcon.displayWidth + 8 + fanText.width;
        const left = cx - width / 2;
        levelText.setPosition(left, 480);
        fanIcon.setPosition(left + levelText.width + 12 + fanIcon.displayWidth / 2, 480);
        fanText.setPosition(left + levelText.width + 12 + fanIcon.displayWidth + 8, 480);

        createButton(this, cx, 1075, 'PLAY', () => this.scene.start('Game', { level: Progress.data.level }), {
            width: 420,
            height: 116,
            fontSize: 64,
            pulse: true
        });
        createButton(this, cx, 1196, 'CLUB', () => this.scene.start('Stadium'), { width: 260, height: 78, fontSize: 36, color: COLORS.buttonAccent });

        // Fine to call every time the title shows; only the first call goes through.
        Playables.gameReady();
    }

    update(_time: number, deltaMs: number): void {
        this.world.update(Math.min(deltaMs, 50) / 1000, PITCH_CENTER, 0, PREVIEW_SQUAD, true);
    }
}
