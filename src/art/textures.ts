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
    /** Heart: the club's fans. */
    fan: 'fan',
    /** Training cone: the Training booth. */
    cone: 'cone',
    shirt: 'shirt',
    flag: 'flag',
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
        g.fillStyle(COLORS.coinRim).fillCircle(15, 15, 14);
        g.fillStyle(COLORS.coin).fillCircle(15, 14, 12);
        g.fillStyle(COLORS.coinInner).fillCircle(15, 14, 7);
        g.fillStyle(0xffffff, 0.6).fillCircle(10, 9, 3);
    });

    make(TEX.fan, 32, 30, (g) => {
        const heart = (dy: number, color: number, r: number) => {
            g.fillStyle(color);
            g.fillCircle(16 - r * 0.55, 10 + dy, r);
            g.fillCircle(16 + r * 0.55, 10 + dy, r);
            g.fillTriangle(16 - r * 1.5, 12 + dy, 16 + r * 1.5, 12 + dy, 16, 12 + dy + r * 1.75);
        };
        heart(1.5, COLORS.ink, 10);
        heart(0, 0xff4f8b, 8.5);
        g.fillStyle(0xffffff, 0.6).fillCircle(10.5, 7, 2.5);
    });

    make(TEX.cone, 56, 60, (g) => {
        g.fillStyle(COLORS.ink).fillRoundedRect(2, 48, 52, 11, 4);
        g.fillStyle(COLORS.buttonAccent).fillRoundedRect(4, 46, 48, 9, 3);
        g.fillStyle(COLORS.ink).fillTriangle(28, 1, 6, 50, 50, 50);
        g.fillStyle(COLORS.buttonAccent).fillTriangle(28, 5, 10, 48, 46, 48);
        g.fillStyle(0xffffff).fillTriangle(28, 5, 22.5, 18, 33.5, 18);
        g.fillStyle(0xffffff).fillRect(16.5, 30, 23, 6);
        g.fillStyle(0xffffff, 0.35).fillTriangle(28, 8, 20, 44, 24, 44);
    });

    // White football shirt with a navy outline; tinted with the kit colour.
    make(TEX.shirt, 64, 60, (g) => {
        const shirt = [
            [20, 4], [26, 8], [38, 8], [44, 4], [60, 14], [54, 28], [48, 25],
            [48, 56], [16, 56], [16, 25], [10, 28], [4, 14]
        ].map(([x, y]) => new Phaser.Math.Vector2(x, y));
        g.fillStyle(0xffffff).fillPoints(shirt, true);
        g.lineStyle(4, COLORS.ink).strokePoints(shirt, true);
        g.fillStyle(0x000000, 0.12).fillRect(17, 44, 30, 11);
    });

    // Small chequered finish flag on a pole; origin is the pole's foot.
    make(TEX.flag, 40, 48, (g) => {
        g.fillStyle(COLORS.ink).fillRect(4, 2, 5, 46);
        const size = 7;
        for (let c = 0; c < 4; c++) {
            for (let r = 0; r < 3; r++) {
                g.fillStyle((c + r) % 2 === 0 ? 0xffffff : 0x111111).fillRect(9 + c * size, 3 + r * size, size, size);
            }
        }
        g.lineStyle(2, COLORS.ink).strokeRect(9, 3, size * 4, size * 3);
    });

    make(TEX.pitch, GAME_WIDTH, PITCH_TILE, (g) => {
        g.fillStyle(COLORS.grassA).fillRect(0, 0, GAME_WIDTH, PITCH_TILE / 2);
        g.fillStyle(COLORS.grassB).fillRect(0, PITCH_TILE / 2, GAME_WIDTH, PITCH_TILE / 2);
        g.fillStyle(COLORS.line).fillRect(PITCH_LEFT - 6, 0, 5, PITCH_TILE);
        g.fillStyle(COLORS.line).fillRect(PITCH_RIGHT + 1, 0, 5, PITCH_TILE);
    });
}
