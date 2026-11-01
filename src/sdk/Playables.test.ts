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
        ads: {
            requestInterstitialAd: vi.fn(async () => {}),
            requestRewardedAd: vi.fn(async () => true)
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

    describe('showInterstitial', () => {
        it('resolves true when the request succeeds', async () => {
            const yt = fakeYt(() => Promise.resolve(''));
            const Playables = await boot(yt);
            expect(await Playables.showInterstitial(1000)).toBe(true);
            expect(yt.ads.requestInterstitialAd).toHaveBeenCalledTimes(1);
        });

        it('resolves false instead of rejecting when the request fails', async () => {
            const yt = fakeYt(() => Promise.resolve(''));
            yt.ads.requestInterstitialAd.mockRejectedValueOnce(undefined);
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            const Playables = await boot(yt);
            expect(await Playables.showInterstitial(1000)).toBe(false);
        });

        it('resolves false when the request never settles', async () => {
            vi.useFakeTimers();
            try {
                const yt = fakeYt(() => Promise.resolve(''));
                yt.ads.requestInterstitialAd.mockReturnValueOnce(new Promise(() => {}));
                const Playables = await boot(yt);
                const result = Playables.showInterstitial(500);
                await vi.advanceTimersByTimeAsync(500);
                expect(await result).toBe(false);
            } finally {
                vi.useRealTimers();
            }
        });

        it('resolves false outside the Playables environment', async () => {
            const yt = fakeYt(() => Promise.resolve(''));
            const Playables = await boot({ ...yt, IN_PLAYABLES_ENV: false });
            expect(await Playables.showInterstitial(1000)).toBe(false);
            expect(yt.ads.requestInterstitialAd).not.toHaveBeenCalled();
        });
    });

    describe('showRewarded', () => {
        it('reports earned and skipped from the SDK result', async () => {
            const yt = fakeYt(() => Promise.resolve(''));
            yt.ads.requestRewardedAd.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
            const Playables = await boot(yt);
            expect(await Playables.showRewarded('revive-squad')).toBe('earned');
            expect(await Playables.showRewarded('revive-squad')).toBe('skipped');
            expect(yt.ads.requestRewardedAd).toHaveBeenCalledWith('revive-squad');
        });

        it('reports failed on a transient error and keeps offering', async () => {
            const yt = fakeYt(() => Promise.resolve(''));
            yt.ads.requestRewardedAd.mockRejectedValueOnce(undefined);
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            const Playables = await boot(yt);
            expect(await Playables.showRewarded('x')).toBe('failed');
            expect(Playables.rewardedAvailable()).toBe(true);
        });

        it('stops offering once the SDK says the API is unavailable', async () => {
            const yt = { ...fakeYt(() => Promise.resolve('')), SdkErrorType: { API_UNAVAILABLE: 'API_UNAVAILABLE' } };
            yt.ads.requestRewardedAd.mockRejectedValueOnce({ errorType: 'API_UNAVAILABLE' });
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            const Playables = await boot(yt);
            expect(await Playables.showRewarded('x')).toBe('failed');
            expect(Playables.rewardedAvailable()).toBe(false);
            expect(await Playables.showRewarded('x')).toBe('failed');
            expect(yt.ads.requestRewardedAd).toHaveBeenCalledTimes(1);
        });

        it('is unavailable outside the Playables environment', async () => {
            const yt = fakeYt(() => Promise.resolve(''));
            const Playables = await boot({ ...yt, IN_PLAYABLES_ENV: false });
            expect(Playables.rewardedAvailable()).toBe(false);
            expect(await Playables.showRewarded('x')).toBe('failed');
        });
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
