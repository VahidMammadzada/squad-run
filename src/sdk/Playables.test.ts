import { afterEach, describe, expect, it, vi } from 'vitest';
import type { YtGame } from './ytgame';

function fakeYt(loadResult: () => Promise<string>) {
    return {
        SDK_VERSION: 'test',
        IN_PLAYABLES_ENV: true,
        game: {
            firstFrameReady: vi.fn(),
            gameReady: vi.fn(),
            loadData: vi.fn(loadResult),
            saveData: vi.fn(async () => {})
        },
        system: {
            isAudioEnabled: () => true,
            onAudioEnabledChange: vi.fn(() => () => {}),
            onPause: vi.fn(() => () => {}),
            onResume: vi.fn(() => () => {})
        },
        engagement: { sendScore: vi.fn(async () => {}) }
    } satisfies YtGame;
}

// Playables keeps its state at module level, so each test boots a fresh copy.
async function boot(yt: YtGame) {
    vi.resetModules();
    vi.stubGlobal('window', { ytgame: yt });
    vi.stubGlobal('document', { readyState: 'complete' });
    const { Playables } = await import('./Playables');
    Playables.boot(() => {});
    return Playables;
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('Playables', () => {
    it('refuses to save before a load has succeeded', async () => {
        const yt = fakeYt(() => Promise.reject(new Error('offline')));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const Playables = await boot(yt);
        expect(await Playables.saveData({ a: 1 })).toBe(false);
        expect(await Playables.loadData()).toBeNull();
        expect(await Playables.saveData({ a: 1 })).toBe(false);
        expect(yt.game.saveData).not.toHaveBeenCalled();
    });

    it('saves once the load succeeded', async () => {
        const yt = fakeYt(() => Promise.resolve('{"level":3}'));
        const Playables = await boot(yt);
        expect(await Playables.loadData()).toEqual({ level: 3 });
        expect(await Playables.saveData({ level: 4 })).toBe(true);
        expect(yt.game.saveData).toHaveBeenCalledWith('{"level":4}');
    });

    it('treats corrupt save JSON as no save, but still allows saving', async () => {
        const yt = fakeYt(() => Promise.resolve('{not json'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const Playables = await boot(yt);
        expect(await Playables.loadData()).toBeNull();
        expect(await Playables.saveData({})).toBe(true);
    });

    it('sends firstFrameReady before gameReady, each exactly once', async () => {
        const yt = fakeYt(() => Promise.resolve(''));
        const Playables = await boot(yt);
        Playables.gameReady();
        Playables.firstFrameReady();
        Playables.gameReady();
        expect(yt.game.firstFrameReady).toHaveBeenCalledTimes(1);
        expect(yt.game.gameReady).toHaveBeenCalledTimes(1);
        expect(yt.game.firstFrameReady.mock.invocationCallOrder[0]).toBeLessThan(yt.game.gameReady.mock.invocationCallOrder[0]);
    });

    it('drops scores sent before the game is ready', async () => {
        const yt = fakeYt(() => Promise.resolve(''));
        const Playables = await boot(yt);
        Playables.sendScore(5);
        Playables.gameReady();
        Playables.sendScore(6);
        await new Promise((r) => setTimeout(r, 0));
        expect(yt.engagement.sendScore).toHaveBeenCalledTimes(1);
        expect(yt.engagement.sendScore).toHaveBeenCalledWith({ value: 6 });
    });
});
