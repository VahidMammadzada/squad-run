import * as THREE from 'three';
import { FONT } from '../config';

// Canvas-drawn textures, so the 3D scene needs no image files.

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext('2d')!);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;

/** Two grass stripes with touchlines down both edges; repeats along the pitch. */
export function pitchTexture(): THREE.CanvasTexture {
    const tex = canvasTexture(256, 256, (ctx) => {
        ctx.fillStyle = '#3f9b3f';
        ctx.fillRect(0, 0, 256, 128);
        ctx.fillStyle = '#47a847';
        ctx.fillRect(0, 128, 256, 128);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 5, 256);
        ctx.fillRect(251, 0, 5, 256);
    });
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

export function checkerTexture(cols: number, rows: number): THREE.CanvasTexture {
    const size = 32;
    const tex = canvasTexture(cols * size, rows * size, (ctx) => {
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                ctx.fillStyle = (c + r) % 2 === 0 ? '#ffffff' : '#111111';
                ctx.fillRect(c * size, r * size, size, size);
            }
        }
    });
    tex.magFilter = THREE.NearestFilter;
    return tex;
}

export function netTexture(): THREE.CanvasTexture {
    const tex = canvasTexture(64, 64, (ctx) => {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, 64, 64);
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

/** A translucent gate panel with its modifier written on it. */
export function gateTexture(label: string, color: number): THREE.CanvasTexture {
    return canvasTexture(256, 128, (ctx) => {
        ctx.fillStyle = css(color);
        ctx.globalAlpha = 0.55;
        ctx.fillRect(0, 0, 256, 128);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = css(color);
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, 246, 118);
        ctx.font = `64px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(label, 128, 68);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, 128, 68);
    });
}

/** Small rounded badge, e.g. a defender's "−3". */
export function badgeTexture(label: string, color: number): THREE.CanvasTexture {
    return canvasTexture(128, 64, (ctx) => {
        ctx.fillStyle = css(color);
        ctx.beginPath();
        ctx.roundRect(4, 4, 120, 56, 20);
        ctx.fill();
        ctx.font = `40px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, 64, 34);
    });
}

export function ballTexture(): THREE.CanvasTexture {
    return canvasTexture(128, 64, (ctx) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 128, 64);
        ctx.fillStyle = '#111111';
        for (const [x, y] of [[16, 16], [48, 40], [80, 14], [112, 40], [32, 56], [96, 58], [64, 4]]) {
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}
