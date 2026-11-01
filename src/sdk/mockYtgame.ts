// Dev-server only stand-in for window.ytgame, so SDK behaviour can be tested
// without the Playables test suite. Enabled with `?mock` in the URL; main.ts
// only imports it in dev, so it never reaches a production build.
import type { YtGame } from './ytgame';

const SAVE_KEY = 'squad-run-mock-save';
const FAIL_LOAD_KEY = 'squad-run-mock-fail-load';
/** The real SDK rejects saves larger than this. */
const MAX_SAVE_BYTES = 3 * 1024 * 1024;

type Listener<T extends unknown[] = []> = (...args: T) => void;

const log = (...args: unknown[]) => console.info('%c[ytgame mock]', 'color:#e53935;font-weight:bold', ...args);

export function installMockYtgame(): void {
    let audio = true;
    let loaded = false;
    let failNextSave = false;
    let adMode: 'ok' | 'fail' | 'slow' | 'hang' = 'ok';
    const pauseListeners = new Set<Listener>();
    const resumeListeners = new Set<Listener>();
    const audioListeners = new Set<Listener<[boolean]>>();

    const subscribe = <T extends unknown[]>(set: Set<Listener<T>>, cb: Listener<T>) => {
        set.add(cb);
        return () => set.delete(cb);
    };

    const mock: YtGame = {
        SDK_VERSION: 'mock',
        IN_PLAYABLES_ENV: true,
        game: {
            firstFrameReady: () => log('firstFrameReady'),
            gameReady: () => log('gameReady'),
            loadData: async () => {
                if (sessionStorage.getItem(FAIL_LOAD_KEY)) {
                    sessionStorage.removeItem(FAIL_LOAD_KEY);
                    log('loadData → REJECTED (forced)');
                    throw new Error('mock loadData failure');
                }
                loaded = true;
                const raw = localStorage.getItem(SAVE_KEY) ?? '';
                log('loadData →', raw || '(empty)');
                return raw;
            },
            saveData: async (data: string) => {
                if (!loaded) {
                    log('saveData → REJECTED: loadData has not succeeded');
                    throw new Error('saveData before loadData');
                }
                if (failNextSave) {
                    failNextSave = false;
                    log('saveData → REJECTED (forced)');
                    throw new Error('mock saveData failure');
                }
                if (new Blob([data]).size > MAX_SAVE_BYTES) {
                    log('saveData → REJECTED: over 3 MiB');
                    throw new Error('save too large');
                }
                localStorage.setItem(SAVE_KEY, data);
                log('saveData', data);
            }
        },
        system: {
            isAudioEnabled: () => audio,
            onAudioEnabledChange: (cb) => subscribe(audioListeners, cb),
            onPause: (cb) => subscribe(pauseListeners, cb),
            onResume: (cb) => subscribe(resumeListeners, cb)
        },
        ads: {
            requestInterstitialAd: async () => {
                log('requestInterstitialAd, mode:', adMode);
                if (adMode === 'fail') throw new Error('mock ad failure');
                if (adMode === 'slow') await new Promise((r) => setTimeout(r, 3000));
                // Never settles: the game must give up after AD_CONFIG.requestTimeoutMs and carry on.
                if (adMode === 'hang') await new Promise(() => undefined);
                log('requestInterstitialAd → done');
            },
            requestRewardedAd: async (id: string) => {
                log('requestRewardedAd', id, 'mode:', adMode);
                if (adMode === 'fail') throw new Error('mock ad failure');
                if (adMode === 'slow') await new Promise((r) => setTimeout(r, 3000));
                return true;
            }
        },
        engagement: {
            sendScore: async ({ value }) => log('sendScore', value)
        }
    };
    window.ytgame = mock;

    const buttons: [string, () => void][] = [
        ['Pause', () => (log('→ onPause'), pauseListeners.forEach((cb) => cb()))],
        ['Resume', () => (log('→ onResume'), resumeListeners.forEach((cb) => cb()))],
        ['Audio on/off', () => {
            audio = !audio;
            log('→ onAudioEnabledChange', audio);
            audioListeners.forEach((cb) => cb(audio));
        }],
        // Load happens once at boot, so this flag survives a reload.
        ['Fail next load', () => (sessionStorage.setItem(FAIL_LOAD_KEY, '1'), log('next loadData will fail; reload the page'))],
        ['Fail next save', () => (failNextSave = true, log('next saveData will fail'))],
        ['Ads: ok/fail/slow/hang', () => {
            adMode = adMode === 'ok' ? 'fail' : adMode === 'fail' ? 'slow' : adMode === 'slow' ? 'hang' : 'ok';
            log('ad mode →', adMode);
        }],
        ['Clear save', () => (localStorage.removeItem(SAVE_KEY), log('save cleared'))]
    ];

    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;top:4px;left:4px;z-index:9999;display:flex;flex-direction:column;gap:2px;font:11px sans-serif;opacity:0.85';
    for (const [label, action] of buttons) {
        const b = document.createElement('button');
        b.textContent = label;
        b.onclick = action;
        panel.appendChild(b);
    }
    const attach = () => document.body.appendChild(panel);
    if (document.body) attach();
    else document.addEventListener('DOMContentLoaded', attach, { once: true });

    log('installed');
}
