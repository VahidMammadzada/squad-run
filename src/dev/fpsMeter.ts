import { Stage } from '../three/Stage';

/**
 * `?fps` overlay for checking frame rate on a real phone: frames per second,
 * the slowest frame of the last second, and the 3D renderer's load. Loaded
 * lazily from main.ts only when the URL asks for it, so it costs nothing in
 * normal play (YouTube never adds the parameter).
 */
export function installFpsMeter(): void {
    const el = document.createElement('div');
    el.style.cssText =
        'position:fixed;left:4px;top:4px;z-index:9999;padding:4px 6px;border-radius:6px;' +
        'background:rgba(0,0,0,0.65);color:#fff;font:12px/1.35 monospace;pointer-events:none;white-space:pre';
    document.body.appendChild(el);

    let frames = 0;
    let worst = 0;
    let last = performance.now();
    let windowStart = last;

    const tick = (now: number): void => {
        worst = Math.max(worst, now - last);
        last = now;
        frames++;
        if (now - windowStart >= 1000) {
            const fps = Math.round((frames * 1000) / (now - windowStart));
            const s = Stage.stats();
            const gl = s ? `\n${s.calls} calls ${Math.round(s.triangles / 1000)}k tris\n${s.width}x${s.height} @${devicePixelRatio}x` : '';
            el.textContent = `${fps} fps  worst ${Math.round(worst)} ms${gl}`;
            el.style.color = fps >= 55 ? '#7dff8a' : fps >= 40 ? '#ffd21f' : '#ff6b6b';
            frames = 0;
            worst = 0;
            windowStart = now;
        }
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}
