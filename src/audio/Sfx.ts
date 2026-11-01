import { Playables } from '../sdk/Playables';

// Placeholder sound effects synthesized with Web Audio, so there are no audio
// files to download. Swap in real samples later behind the same play() names.

export type SfxName = 'click' | 'coin' | 'gateGood' | 'gateBad' | 'hit' | 'goal' | 'save' | 'win' | 'lose';

interface Tone {
    freq: number;
    /** Glide to this frequency over the tone's duration. */
    to?: number;
    dur: number;
    delay?: number;
    type?: OscillatorType;
    vol?: number;
}

const SOUNDS: Record<SfxName, Tone[]> = {
    click: [{ freq: 660, dur: 0.05, type: 'square', vol: 0.06 }],
    coin: [
        { freq: 988, dur: 0.06, type: 'square', vol: 0.06 },
        { freq: 1319, dur: 0.1, delay: 0.06, type: 'square', vol: 0.06 }
    ],
    gateGood: [{ freq: 440, to: 880, dur: 0.18, type: 'triangle', vol: 0.2 }],
    gateBad: [{ freq: 330, to: 150, dur: 0.25, type: 'sawtooth', vol: 0.1 }],
    hit: [{ freq: 180, to: 60, dur: 0.15, type: 'square', vol: 0.12 }],
    goal: [
        { freq: 523, dur: 0.08, type: 'triangle', vol: 0.2 },
        { freq: 784, dur: 0.14, delay: 0.08, type: 'triangle', vol: 0.2 }
    ],
    save: [{ freq: 220, to: 110, dur: 0.2, type: 'triangle', vol: 0.2 }],
    win: [523, 659, 784, 1047].map((freq, i) => ({ freq, dur: 0.14, delay: i * 0.12, type: 'triangle' as const, vol: 0.2 })),
    lose: [{ freq: 392, to: 98, dur: 0.6, type: 'sawtooth', vol: 0.1 }]
};

let ctx: AudioContext | null = null;
// YouTube's mute/audio setting.
let enabled = true;
// SDK onPause.
let paused = false;

function sync(): void {
    if (!ctx) return;
    if (enabled && !paused) void ctx.resume();
    else void ctx.suspend();
}

export const Sfx = {
    init(): void {
        enabled = Playables.isAudioEnabled();
        Playables.onAudioEnabledChange((on) => {
            enabled = on;
            sync();
        });
        // Browsers only allow audio to start from a user gesture.
        const unlock = () => {
            ctx ??= new AudioContext();
            sync();
        };
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
    },

    /** @param pitch frequency multiplier, e.g. rising pitch on coin chains */
    play(name: SfxName, pitch = 1): void {
        if (!ctx || !enabled || paused) return;
        const now = ctx.currentTime;
        for (const tone of SOUNDS[name]) {
            const start = now + (tone.delay ?? 0);
            const end = start + tone.dur;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = tone.type ?? 'sine';
            osc.frequency.setValueAtTime(tone.freq * pitch, start);
            if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to * pitch, end);
            gain.gain.setValueAtTime(tone.vol ?? 0.15, start);
            gain.gain.exponentialRampToValueAtTime(0.001, end);
            osc.connect(gain).connect(ctx.destination);
            osc.start(start);
            osc.stop(end + 0.02);
        }
    },

    suspend(): void {
        paused = true;
        sync();
    },

    resume(): void {
        paused = false;
        sync();
    }
};
