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
    it('sends fans as the score only after the save succeeds, matching the save', async () => {
        const Progress = await freshProgress();
        Progress.completeLevel(7, 20, 70);
        await flush();
        expect(Progress.data.fans).toBe(70);
        expect(sdk.sendScore).toHaveBeenCalledWith(70);
        expect(sdk.saveData.mock.invocationCallOrder[0]).toBeLessThan(sdk.sendScore.mock.invocationCallOrder[0]);
    });

    it('does not send a score when the save fails', async () => {
        const Progress = await freshProgress();
        sdk.saveData.mockResolvedValue(false);
        Progress.completeLevel(7, 0, 70);
        await flush();
        expect(sdk.sendScore).not.toHaveBeenCalled();
    });

    it('does not send a score when no fans were earned', async () => {
        const Progress = await freshProgress();
        Progress.completeLevel(0, 5, 0);
        await flush();
        expect(sdk.sendScore).not.toHaveBeenCalled();
    });

    it('still tracks the best goals for display', async () => {
        const Progress = await freshProgress({ version: 1, level: 3, coins: 0, bestScore: 10, unlockedKits: ['blue'], selectedKit: 'blue' });
        expect(Progress.completeLevel(4, 5, 40).newBest).toBe(false);
        expect(Progress.completeLevel(12, 0, 120).newBest).toBe(true);
        expect(Progress.data).toMatchObject({ level: 5, coins: 5, bestScore: 12 });
    });

    it('accrues merch takings each level', async () => {
        const Progress = await freshProgress();
        Progress.completeLevel(3, 0, 30);
        expect(Progress.data.merchPending).toBeGreaterThan(0);
    });
});

describe('Progress club', () => {
    it('buys upgrade levels until maxed, deducting coins', async () => {
        const Progress = await freshProgress();
        Progress.addCoins(10_000);
        let bought = 0;
        while (Progress.buyUpgrade('finishing')) bought++;
        expect(bought).toBe(3);
        expect(Progress.upgradeLevel('finishing')).toBe(3);
        expect(Progress.data.coins).toBe(10_000 - 200 - 500 - 1000);
    });

    it('refuses an upgrade the player cannot afford', async () => {
        const Progress = await freshProgress();
        expect(Progress.buyUpgrade('youth')).toBe(false);
        expect(Progress.upgradeLevel('youth')).toBe(0);
        expect(sdk.saveData).not.toHaveBeenCalled();
    });

    it('collects merch once, doubled when asked', async () => {
        const Progress = await freshProgress({ version: 2, level: 4, coins: 10, merchPending: 15 });
        expect(Progress.collectMerch(2)).toBe(30);
        expect(Progress.data).toMatchObject({ coins: 40, merchPending: 0 });
        expect(Progress.collectMerch(1)).toBe(0);
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
