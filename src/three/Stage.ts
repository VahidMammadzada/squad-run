import * as Phaser from 'phaser';
import * as THREE from 'three';

let renderer: THREE.WebGLRenderer | null = null;
let phaserGame: Phaser.Game | null = null;

/** Lines the 3D canvas up exactly under Phaser's (letterboxed) canvas. */
function layout(): void {
    if (!renderer || !phaserGame) return;
    const canvas = phaserGame.canvas;
    const parent = canvas.parentElement!;
    const r = canvas.getBoundingClientRect();
    const p = parent.getBoundingClientRect();
    const style = renderer.domElement.style;
    style.left = `${r.left - p.left}px`;
    style.top = `${r.top - p.top}px`;
    style.width = `${r.width}px`;
    style.height = `${r.height}px`;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(r.width, r.height, false);
}

/**
 * One shared WebGL renderer for gameplay, drawn underneath Phaser's transparent
 * canvas. Phaser keeps menus, HUD and input; Three.js draws the pitch.
 * Rendering happens from GameScene.update, so it stops whenever Phaser pauses.
 */
export const Stage = {
    attach(game: Phaser.Game): void {
        phaserGame = game;
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        const el = renderer.domElement;
        el.style.position = 'absolute';
        el.style.pointerEvents = 'none';
        el.style.display = 'none';
        game.canvas.parentElement!.insertBefore(el, game.canvas);
        // Keep Phaser's canvas (UI and input) above the 3D one.
        game.canvas.style.position = 'relative';
        game.canvas.style.zIndex = '1';
        game.scale.on(Phaser.Scale.Events.RESIZE, layout);
        window.addEventListener('resize', layout);
    },

    show(): void {
        if (!renderer) return;
        renderer.domElement.style.display = 'block';
        layout();
    },

    hide(): void {
        if (renderer) renderer.domElement.style.display = 'none';
    },

    render(scene: THREE.Scene, camera: THREE.Camera): void {
        renderer?.render(scene, camera);
    }
};
