import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KITS } from '../data/kits';

const sdk = vi.hoisted(() => ({
    loadData: vi.fn<() => Promise<unknown>>(),
    saveData: vi.fn<(data: unknown) => Promise<boolean>>(),
    sendScore: vi.fn<(value: number) => void>()
}));
vi.mock('../sdk/Playables', () => ({ Playables: sdk }));

// Progress keeps its save in module state, so each test gets a fresh copy.
async function freshProgress(save: unknown = null) {
    vi.resetModules();
    sdk.loadData.mockResolvedValue(save);
    const { Progress } = await import('./Progress');
    await Progress.load();
    return Progress;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
    vi.clearAllMocks();
    sdk.saveData.mockResolvedValue(true);
});

describe('Progress.completeLevel', () => {
    it('sends a new best score only after the save succeeds, matching the save', async () => {
        const Progress = await freshProgress();
        expect(Progress.completeLevel(7, 20)).toEqual({ newBest: true });
        await flush();
        expect(sdk.sendScore).toHaveBeenCalledWith(7);
        expect(Progress.data.bestScore).toBe(7);
        expect(sdk.saveData.mock.invocationCallOrder[0]).toBeLessThan(sdk.sendScore.mock.invocationCallOrder[0]);
    });

    it('does not send a score when the save fails', async () => {
        const Progress = await freshProgress();
        sdk.saveData.mockResolvedValue(false);
        Progress.completeLevel(7, 0);
        await flush();
        expect(sdk.sendScore).not.toHaveBeenCalled();
    });

    it('does not send a score that is not a new best', async () => {
        const Progress = await freshProgress({ version: 1, level: 3, coins: 0, bestScore: 10, unlockedKits: ['blue'], selectedKit: 'blue' });
        expect(Progress.completeLevel(4, 5).newBest).toBe(false);
        await flush();
        expect(sdk.sendScore).not.toHaveBeenCalled();
        expect(Progress.data).toMatchObject({ level: 4, coins: 5, bestScore: 10 });
    });
});

describe('Progress kits', () => {
    const red = KITS.find((k) => k.id === 'red')!;

    it('refuses kits the player cannot afford', async () => {
        const Progress = await freshProgress();
        expect(Progress.buyKit('red')).toBe(false);
        expect(Progress.isUnlocked('red')).toBe(false);
        expect(sdk.saveData).not.toHaveBeenCalled();
    });

    it('buys, deducts and equips', async () => {
        const Progress = await freshProgress();
        Progress.addCoins(red.price + 5);
        expect(Progress.buyKit('red')).toBe(true);
        expect(Progress.data).toMatchObject({ coins: 5, selectedKit: 'red' });
        expect(Progress.data.unlockedKits).toContain('red');
        expect(Progress.buyKit('red')).toBe(false);
        expect(Progress.data.coins).toBe(5);
    });

    it('ignores selecting a locked kit', async () => {
        const Progress = await freshProgress();
        Progress.selectKit('red');
        expect(Progress.data.selectedKit).toBe('blue');
        expect(sdk.saveData).not.toHaveBeenCalled();
    });
});
