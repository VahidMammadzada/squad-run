#!/usr/bin/env node
// Screenshots the game (or any URL) with headless Chromium via Playwright.
// Starts the Vite dev server itself if nothing is listening on :8080.
//
//   node scripts/capture.mjs --scene Game --level 3 --shots 0,1500,4000 --steer weave
//   node scripts/capture.mjs --url https://example.com --shots 0,3000
//
// See .claude/skills/capture-game/SKILL.md for all options.
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const args = parseArgs(process.argv.slice(2));
const PORT = 8080;
const BASE = `http://localhost:${PORT}/`;
const scene = args.scene ?? 'Title';
const external = args.url;
const [width, height] = (args.size ?? '540x960').split('x').map(Number);
const shots = (args.shots ?? (scene === 'Game' && !external ? '0,1500,4000,8000' : '0')).split(',').map(Number);
const outDir = resolve(args.out ?? '.captures');
const prefix = args.name ?? (external ? 'external' : `${scene.toLowerCase()}${args.level ? `-l${args.level}` : ''}`);
const steer = args.steer; // left | right | weave
const run = scene === 'Game' && !external && args.tap !== 'false';

mkdirSync(outDir, { recursive: true });

let server;
if (!external && !(await isUp())) {
    console.log('Starting Vite dev server…');
    server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'ignore' });
    for (let i = 0; i < 60 && !(await isUp()); i++) await wait(500);
    if (!(await isUp())) fail('Dev server did not start on :8080');
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, locale: 'en-US', hasTouch: false });
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    if (external) {
        await page.goto(external, { waitUntil: 'domcontentloaded' });
        await acceptConsent(page);
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    } else {
        const query = new URLSearchParams({ scene, ...(args.level ? { level: args.level } : {}), ...(args.mock ? { mock: '' } : {}) });
        await page.goto(`${BASE}?${query}`);
        // Wait until the requested scene (or the overlay) is actually running.
        await page.waitForFunction((key) => window.__game?.scene.isActive(key), scene, { timeout: 20000 });
        await wait(900); // let pop-in tweens settle
    }

    if (run) {
        // A tap starts the run; keyboard steers.
        await page.mouse.click(width / 2, height * 0.7);
    }

    const start = Date.now();
    const saved = [];
    let steerTimer;
    if (run && steer) steerTimer = steerLoop(page, steer);
    for (const t of shots.sort((a, b) => a - b)) {
        const delay = t - (Date.now() - start);
        if (delay > 0) await wait(delay);
        const file = resolve(outDir, `${prefix}-${String(t).padStart(5, '0')}ms.png`);
        await page.screenshot({ path: file });
        saved.push(file);
    }
    if (steerTimer) steerTimer.stop();
    saved.forEach((f) => console.log(`saved ${f}`));
} finally {
    await browser.close();
    if (server) killTree(server.pid);
}
if (errors.length) {
    console.log(`\n${errors.length} console error(s):`);
    [...new Set(errors)].slice(0, 20).forEach((e) => console.log(`  ${e}`));
}

function steerLoop(page, mode) {
    let stopped = false;
    (async () => {
        let dir = mode === 'left' ? 'ArrowLeft' : 'ArrowRight';
        while (!stopped) {
            await page.keyboard.down(dir);
            await wait(mode === 'weave' ? 600 : 250);
            await page.keyboard.up(dir);
            if (mode === 'weave') dir = dir === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
            await wait(mode === 'weave' ? 200 : 750);
        }
    })().catch(() => {});
    return { stop: () => (stopped = true) };
}

async function acceptConsent(page) {
    // Google/YouTube cookie walls; harmless elsewhere.
    for (const label of [/accept all/i, /alles accepteren/i, /i agree/i, /^consent$/i, /accept/i]) {
        const button = page.getByRole('button', { name: label }).first();
        if (await button.isVisible().catch(() => false)) {
            await button.click();
            await page.waitForLoadState('domcontentloaded');
            return;
        }
    }
}

async function isUp() {
    try {
        return (await fetch(BASE)).ok;
    } catch {
        return false;
    }
}

function killTree(pid) {
    try {
        if (process.platform === 'win32') execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
        else process.kill(-pid);
    } catch {
        /* already gone */
    }
}

function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        if (!argv[i].startsWith('--')) continue;
        const key = argv[i].slice(2);
        const next = argv[i + 1];
        out[key] = next && !next.startsWith('--') ? (i++, next) : 'true';
    }
    return out;
}

function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function fail(msg) {
    console.error(msg);
    if (server) killTree(server.pid);
    process.exit(1);
}
