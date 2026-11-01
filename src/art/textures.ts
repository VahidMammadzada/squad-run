import * as Phaser from 'phaser';
import { COLORS, GAME_WIDTH, PITCH_LEFT, PITCH_RIGHT } from '../config';

/**
 * 2D textures for menus and the HUD (gameplay itself is 3D, see src/three).
 * To swap in real sprites, load images under these keys before
 * createPlaceholderTextures runs; it skips any key that already exists.
 * Player icons are tinted with the kit colour, so they should be white or greyscale.
 */
export const TEX = {
    leader: 'leader',
    mate: 'mate',
    ball: 'ball',
    coin: 'coin',
    pitch: 'pitch'
} as const;

/** Height of one repeat of the pitch tile (two grass stripes). */
const PITCH_TILE = 256;

export function createPlaceholderTextures(scene: Phaser.Scene): void {
    const make = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
        if (scene.textures.exists(key)) return;
        const g = scene.add.graphics();
        draw(g);
        g.generateTexture(key, w, h);
        g.destroy();
    };

    make(TEX.leader, 40, 40, (g) => {
        g.fillStyle(0xffffff).fillCircle(20, 20, 19);
        g.lineStyle(4, 0x000000, 0.45).strokeCircle(20, 20, 17);
    });

    make(TEX.mate, 26, 26, (g) => {
        g.fillStyle(0xffffff).fillCircle(13, 13, 12);
        g.lineStyle(2, 0x000000, 0.3).strokeCircle(13, 13, 11);
    });

    make(TEX.ball, 18, 18, (g) => {
        g.fillStyle(0xffffff).fillCircle(9, 9, 8);
        g.lineStyle(2, 0x000000).strokeCircle(9, 9, 7);
        g.fillStyle(0x000000).fillCircle(9, 9, 3);
    });

    make(TEX.coin, 30, 30, (g) => {
        g.fillStyle(COLORS.coin).fillCircle(15, 15, 14);
        g.fillStyle(COLORS.coinInner).fillCircle(15, 15, 9);
    });

    make(TEX.pitch, GAME_WIDTH, PITCH_TILE, (g) => {
        g.fillStyle(COLORS.grassA).fillRect(0, 0, GAME_WIDTH, PITCH_TILE / 2);
        g.fillStyle(COLORS.grassB).fillRect(0, PITCH_TILE / 2, GAME_WIDTH, PITCH_TILE / 2);
        g.fillStyle(COLORS.line).fillRect(PITCH_LEFT - 6, 0, 5, PITCH_TILE);
        g.fillStyle(COLORS.line).fillRect(PITCH_RIGHT + 1, 0, 5, PITCH_TILE);
    });
}
