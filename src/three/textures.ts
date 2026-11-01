import * as THREE from 'three';
import { COLORS, FONT } from '../config';

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
        ctx.fillStyle = css(COLORS.grassA);
        ctx.fillRect(0, 0, 256, 128);
        ctx.fillStyle = css(COLORS.grassB);
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

/** A solid, glossy gate panel with its modifier in huge outlined numbers. */
export function gateTexture(label: string, color: number): THREE.CanvasTexture {
    return canvasTexture(512, 256, (ctx) => {
        const base = new THREE.Color(color);
        const light = base.clone().lerp(new THREE.Color(0xffffff), 0.35);
        const dark = base.clone().lerp(new THREE.Color(0x000000), 0.25);
        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, `#${light.getHexString()}`);
        grad.addColorStop(0.5, css(color));
        grad.addColorStop(1, `#${dark.getHexString()}`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(6, 6, 500, 244, 28);
        ctx.fill();
        // Gloss band across the top half.
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.roundRect(22, 18, 468, 92, 22);
        ctx.fill();
        ctx.lineWidth = 12;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(6, 6, 500, 244, 28);
        ctx.stroke();

        ctx.font = `150px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.fillStyle = 'rgba(27,42,92,0.55)';
        ctx.fillText(label, 256, 144);
        ctx.lineWidth = 22;
        ctx.strokeStyle = '#1b2a5c';
        ctx.strokeText(label, 256, 134);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, 256, 134);
    });
}

/** Vertical sky gradient, used as the scene background. */
export function skyTexture(): THREE.CanvasTexture {
    return canvasTexture(4, 256, (ctx) => {
        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, css(COLORS.skyTop));
        grad.addColorStop(1, css(COLORS.skyHorizon));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 4, 256);
    });
}

/** Rows of seats with a colourful crowd; rows run along the texture's v axis. */
export function crowdTexture(): THREE.CanvasTexture {
    const shirts = ['#ff3b3b', '#ffd21f', '#ffffff', '#ff9f1a', '#ff5c9e'];
    const tex = canvasTexture(256, 256, (ctx) => {
        const rows = 8;
        const w = 256 / rows;
        for (let r = 0; r < rows; r++) {
            ctx.fillStyle = r % 2 === 0 ? '#4aa3ff' : '#6fb8ff';
            ctx.fillRect(r * w, 0, w, 256);
            ctx.fillStyle = 'rgba(27,42,92,0.18)';
            ctx.fillRect(r * w + w - 4, 0, 4, 256);
            for (let y = 10; y < 256; y += 22) {
                if (Math.random() < 0.15) continue;
                ctx.fillStyle = shirts[Math.floor(Math.random() * shirts.length)];
                ctx.beginPath();
                ctx.arc(r * w + w / 2 + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4, 8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

/** Pitch-side advertising boards: made-up slogans on candy-coloured blocks. */
export function boardTexture(): THREE.CanvasTexture {
    const blocks: [string, string, string][] = [
        ['#2f8cff', '#ffffff', 'SQUAD RUN'],
        ['#ffd21f', '#1b2a5c', 'GOAL!'],
        ['#ff3b3b', '#ffffff', 'RUN!'],
        ['#ffffff', '#2f8cff', '⚽ PLAY'],
        ['#ff9f1a', '#ffffff', 'WIN!']
    ];
    const bw = 256;
    const tex = canvasTexture(bw * blocks.length, 64, (ctx) => {
        blocks.forEach(([bg, fg, text], i) => {
            ctx.fillStyle = bg;
            ctx.fillRect(i * bw, 0, bw, 64);
            ctx.font = `40px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = fg;
            ctx.fillText(text, i * bw + bw / 2, 34);
        });
    });
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
}

/** Coin face: gold with a raised inner ring and a star. */
export function coinFaceTexture(): THREE.CanvasTexture {
    return canvasTexture(128, 128, (ctx) => {
        ctx.fillStyle = css(COLORS.coin);
        ctx.fillRect(0, 0, 128, 128);
        ctx.lineWidth = 8;
        ctx.strokeStyle = css(COLORS.coinRim);
        ctx.beginPath();
        ctx.arc(64, 64, 46, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = css(COLORS.coinInner);
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? 30 : 13;
            const a = -Math.PI / 2 + (i * Math.PI) / 5;
            ctx.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
        }
        ctx.fill();
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
