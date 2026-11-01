// Typed port of src/YouTubePlayables.js from the official Phaser YouTube
// Playables template (MIT, Phaser Studio), plus the ad calls. Every call is a
// safe no-op outside the Playables environment.
import type { YtGame } from './ytgame';

/** Dev-server only stand-in for cloud saves; stripped from production builds. */
const DEV_SAVE_KEY = 'squad-run-dev-save';

let yt: YtGame | null = null;
let firstFrameSent = false;
let gameReadySent = false;
// YouTube rejects saveData until loadData has succeeded, and saving defaults
// over a cloud save we failed to read would wipe the player's progress.
let loadSucceeded = false;
// Set when the SDK says rewarded ads don't exist here, so offers stay hidden.
let rewardedOff = false;

export type RewardedResult = 'earned' | 'skipped' | 'failed';

function inEnv(): boolean {
    return yt !== null && yt.IN_PLAYABLES_ENV;
}

export const Playables = {
    /** Waits for the DOM, picks up window.ytgame, then starts the game. */
    boot(start: () => void): void {
        const run = () => {
            yt = window.ytgame ?? null;
            if (!yt) {
                console.warn('YouTube Playables SDK not found; running standalone.');
            }
            start();
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run, { once: true });
        } else {
            run();
        }
    },

    /** Call while a loading screen is on screen. */
    firstFrameReady(): void {
        if (firstFrameSent) return;
        firstFrameSent = true;
        if (inEnv()) yt!.game.firstFrameReady();
    },

    /** Call once the player can interact. */
    gameReady(): void {
        if (gameReadySent) return;
        this.firstFrameReady();
        gameReadySent = true;
        if (inEnv()) yt!.game.gameReady();
    },

    /** Resolves to the parsed save, or null when there is none or it can't be read. */
    async loadData(): Promise<unknown> {
        let raw: string | null = null;
        try {
            if (inEnv()) {
                raw = await yt!.game.loadData();
            } else if (import.meta.env.DEV) {
                raw = localStorage.getItem(DEV_SAVE_KEY);
            }
            loadSucceeded = true;
        } catch (err) {
            console.error('loadData failed; progress will not be saved this session.', err);
            return null;
        }
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            console.error('Save data is not valid JSON; starting fresh.');
            return null;
        }
    },

    /** Never rejects. Resolves true when the save went through. */
    async saveData(data: unknown): Promise<boolean> {
        if (!loadSucceeded) return false;
        const json = JSON.stringify(data);
        try {
            if (inEnv()) {
                await yt!.game.saveData(json);
            } else if (import.meta.env.DEV) {
                localStorage.setItem(DEV_SAVE_KEY, json);
            }
            return true;
        } catch (err) {
            console.error('saveData failed', err);
            return false;
        }
    },

    sendScore(value: number): void {
        if (!inEnv() || !gameReadySent) return;
        Promise.resolve()
            .then(() => yt!.engagement.sendScore({ value }))
            .catch((err) => console.error('sendScore failed', err));
    },

    /**
     * Requests an interstitial; call only at a natural break between screens.
     * Never rejects. Resolves true when the request succeeded, false when it
     * failed, timed out, or there is no SDK (the ad may still not have shown).
     */
    async showInterstitial(timeoutMs: number): Promise<boolean> {
        if (!inEnv()) return false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<boolean>((resolve) => {
            timer = setTimeout(() => resolve(false), timeoutMs);
        });
        const request = (async () => {
            try {
                await yt!.ads.requestInterstitialAd();
                return true;
            } catch (err) {
                console.warn('requestInterstitialAd failed', err);
                return false;
            }
        })();
        try {
            return await Promise.race([request, timeout]);
        } finally {
            clearTimeout(timer);
        }
    },

    /** False when a rewarded offer should not be shown at all this session. */
    rewardedAvailable(): boolean {
        return inEnv() && !rewardedOff;
    },

    /**
     * Requests a rewarded ad; call only from a clearly labelled button the player
     * pressed. Never rejects. 'earned': grant the reward; 'skipped': an ad ran but
     * the player left early; 'failed': no ad (the offer should go away).
     */
    async showRewarded(rewardId: string): Promise<RewardedResult> {
        if (!this.rewardedAvailable()) return 'failed';
        try {
            return (await yt!.ads.requestRewardedAd(rewardId)) ? 'earned' : 'skipped';
        } catch (err) {
            const unavailable = yt!.SdkErrorType?.API_UNAVAILABLE;
            if (unavailable !== undefined && (err as { errorType?: unknown } | undefined)?.errorType === unavailable) {
                rewardedOff = true;
            }
            console.warn('requestRewardedAd failed', err);
            return 'failed';
        }
    },

    isAudioEnabled(): boolean {
        return inEnv() ? yt!.system.isAudioEnabled() : true;
    },

    onAudioEnabledChange(callback: (enabled: boolean) => void): void {
        if (inEnv()) yt!.system.onAudioEnabledChange(callback);
    },

    onPause(callback: () => void): void {
        if (inEnv()) yt!.system.onPause(callback);
    },

    onResume(callback: () => void): void {
        if (inEnv()) yt!.system.onResume(callback);
    }
};
