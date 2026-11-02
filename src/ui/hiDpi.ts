import * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

/** Beyond this the canvas costs more fill than the extra sharpness is worth. */
const MAX_SCALE = 3;

/**
 * How many canvas pixels each game pixel gets: enough to match the screen's
 * physical pixels where the 720×1280 game is shown, so text and UI stay sharp
 * on high-density phones instead of being stretched by the browser.
 */
function wantedScale(): number {
    const fitWidth = Math.min(window.innerWidth, (window.innerHeight * GAME_WIDTH) / GAME_HEIGHT);
    const physical = (fitWidth * (window.devicePixelRatio || 1)) / GAME_WIDTH;
    // Quarter steps, rounded up, so a small resize doesn't rebuild the canvas.
    return Math.min(MAX_SCALE, Math.max(1, Math.ceil(physical * 4) / 4));
}

let scale = wantedScale();

/** Canvas size for the Phaser game config. Game code keeps using GAME_WIDTH × GAME_HEIGHT. */
export function canvasSize(): { width: number; height: number } {
    return { width: GAME_WIDTH * scale, height: GAME_HEIGHT * scale };
}

// Text renders its own canvas at our scale unless a style asks otherwise.
// Phaser treats resolution 0 as 1, so 0 also counts as "not set".
const factory = Phaser.GameObjects.GameObjectFactory.prototype;
const addText = factory.text;
factory.text = function (x, y, text, style) {
    return addText.call(this, x, y, text, { ...style, resolution: style?.resolution || scale });
};

/**
 * Zooms a camera by `factor` around the middle of the screen, on top of the
 * canvas scale. Use this instead of setting `cam.zoom`, which would undo it.
 */
export function setCameraZoom(cam: Phaser.Cameras.Scene2D.Camera, factor = 1): void {
    // Zoom from the top-left corner so world (0, 0) stays at the canvas corner,
    // then scroll so the screen's centre stays put (no scroll at factor 1).
    cam.setOrigin(0, 0).setZoom(scale * factor);
    const k = 1 - 1 / factor;
    cam.setScroll((GAME_WIDTH / 2) * k, (GAME_HEIGHT / 2) * k);
}

function zoomCameras(scene: Phaser.Scene): void {
    for (const cam of scene.cameras?.cameras ?? []) setCameraZoom(cam);
}

function sharpenTexts(list: Phaser.GameObjects.GameObject[]): void {
    for (const obj of list) {
        if (obj instanceof Phaser.GameObjects.Text) obj.setResolution(scale);
        else if (obj instanceof Phaser.GameObjects.Container) sharpenTexts(obj.list);
    }
}

/**
 * Keeps every scene's cameras zoomed to the canvas scale (scenes started later
 * included) and rebuilds the canvas when the window or pixel density changes.
 * Code that reads pointers must use worldX/worldY, which undo the zoom.
 */
export function installHiDpi(game: Phaser.Game): void {
    const hook = () => {
        for (const scene of game.scene.scenes) {
            scene.sys.events.on(Phaser.Scenes.Events.READY, () => zoomCameras(scene));
            if (scene.sys.settings.status >= Phaser.Scenes.START) zoomCameras(scene);
        }
    };
    // Scenes exist once READY has fired, which is just before isRunning turns true.
    if (game.isRunning) hook();
    else game.events.once(Phaser.Core.Events.READY, hook);

    window.addEventListener('resize', () => {
        const next = wantedScale();
        if (next === scale) return;
        scale = next;
        game.scale.setGameSize(GAME_WIDTH * scale, GAME_HEIGHT * scale);
        // Phaser may already have handled this resize, and setGameSize alone
        // refits to the old parent size, so refit to the new one.
        game.scale.refresh();
        for (const scene of game.scene.scenes) {
            if (scene.sys.settings.status < Phaser.Scenes.START) continue;
            zoomCameras(scene);
            sharpenTexts(scene.children.list);
        }
    });
}
