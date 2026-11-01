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

describe('Progress stars', () => {
    const fresh = (over: Record<string, unknown> = {}) => freshProgress({ version: 3, level: 2, coins: 5000, fans: 0, ...over });

    it('signs from the transfer list; the first star becomes active', async () => {
        const Progress = await fresh();
        const cheap = Progress.transferList().candidates[0];
        expect(Progress.buyStar(cheap.id)).toBe(true);
        expect(Progress.data.roster.map((s) => s.id)).toEqual([cheap.id]);
        expect(Progress.data.activeStar).toBe(cheap.id);
        expect(Progress.data.roster[0].paid).toBeGreaterThan(0);
        expect(Progress.data.coins).toBe(5000 - Progress.data.roster[0].paid);
        // Gone from the list, can't be signed twice.
        expect(Progress.transferList().candidates.some((s) => s.id === cheap.id)).toBe(false);
        expect(Progress.buyStar(cheap.id)).toBe(false);
    });

    it('replaces a stale transfer list, and refreshes on demand', async () => {
        const Progress = await fresh();
        const first = Progress.transferList();
        expect(Progress.transferList()).toBe(first);
        Progress.refreshTransfer();
        expect(Progress.transferList().candidates).not.toEqual(first.candidates);
        for (let i = 0; i < 5; i++) Progress.completeLevel(0, 0, 0);
        expect(Progress.transferList().refreshedAtLevel).toBe(Progress.data.level);
    });

    it('releases for half, benching the star if they were active', async () => {
        const Progress = await fresh();
        const id = Progress.transferList().candidates[0].id;
        Progress.buyStar(id);
        const paid = Progress.data.roster[0].paid;
        const coins = Progress.data.coins;
        expect(Progress.releaseStar(id)).toBe(Math.floor(paid / 2));
        expect(Progress.data).toMatchObject({ coins: coins + Math.floor(paid / 2), roster: [], activeStar: null });
    });

    it('records a failed run: injury sticks, the doctor heals it', async () => {
        const Progress = await fresh();
        const id = Progress.transferList().candidates[0].id;
        Progress.buyStar(id);
        Progress.failRun(true);
        expect(Progress.star(id)).toMatchObject({ injuredLevels: 3, fitness: 85 });
        expect(Progress.setActiveStar(id)).toBe(false);
        const coins = Progress.data.coins;
        expect(Progress.healStar(id, false)).toBe(true);
        expect(Progress.data.coins).toBe(coins - 120);
        expect(Progress.star(id)?.injuredLevels).toBe(0);
        expect(Progress.healStar(id, true)).toBe(false);
    });

    it('rests a tired star for coins', async () => {
        const Progress = await fresh();
        const id = Progress.transferList().candidates[0].id;
        Progress.buyStar(id);
        Progress.completeLevel(1, 0, 10);
        expect(Progress.star(id)?.fitness).toBe(85);
        expect(Progress.restStar(id)).toBe(true);
        expect(Progress.star(id)?.fitness).toBe(100);
        expect(Progress.restStar(id)).toBe(false);
    });
});

describe('Progress office', () => {
    const fresh = (over: Record<string, unknown> = {}) => freshProgress({ version: 4, level: 5, coins: 5000, fans: 0, ...over });

    it('upgrades the stadium, respecting the fan gate', async () => {
        const Progress = await fresh();
        expect(Progress.upgradeStadium()).toBe(true);
        expect(Progress.data).toMatchObject({ stadiumTier: 2, coins: 4700 });
        expect(Progress.upgradeStadium()).toBe(false);
        expect(Progress.data.stadiumTier).toBe(2);
    });

    it('runs a campaign for 3 completed levels; failed runs do not count', async () => {
        const Progress = await fresh();
        expect(Progress.startCampaign('merchPromo')).toBe(true);
        expect(Progress.startCampaign('fanDrive')).toBe(false);
        Progress.failRun(false);
        Progress.completeLevel(0, 0, 0);
        expect(Progress.data.campaign?.levelsLeft).toBe(2);
        expect(Progress.extendCampaign()).toBe(true);
        expect(Progress.extendCampaign()).toBe(false);
        for (let i = 0; i < 4; i++) Progress.completeLevel(0, 0, 0);
        expect(Progress.data.campaign).toBeNull();
    });

    it('Merch Promo and the stadium multiply merch takings', async () => {
        const Progress = await fresh({ fans: 1000, stadiumTier: 3 });
        Progress.startCampaign('merchPromo');
        Progress.completeLevel(0, 0, 0);
        // 1000 fans × 4% = 40, × 1.5 stadium × 2 promo = 120.
        expect(Progress.data.merchPending).toBe(120);
    });

    it('Talent Buzz brings a new, better scout list at once', async () => {
        const Progress = await fresh();
        const before = Progress.transferList();
        Progress.startCampaign('talentBuzz');
        const after = Progress.transferList();
        expect(after).not.toBe(before);
        expect(after.candidates[0].popularity).toBe(2);
    });
});

describe('Progress wardrobe', () => {
    const fresh = (over: Record<string, unknown> = {}) => freshProgress({ version: 5, level: 3, coins: 500, fans: 0, ...over });

    it('buys and wears an item, then re-wears it for free', async () => {
        const Progress = await fresh();
        expect(Progress.wearItem('hat-cap')).toBe(true);
        expect(Progress.data.coins).toBe(350);
        expect(Progress.data.manager).toMatchObject({ hat: 'cap', owned: ['hat-cap'] });
        Progress.wearItem('hat-none');
        expect(Progress.wearItem('hat-cap')).toBe(true);
        expect(Progress.data.coins).toBe(350);
    });

    it('refuses what the club cannot afford or has not earned', async () => {
        const Progress = await fresh();
        expect(Progress.wearItem('outfit-coat')).toBe(false);
        expect(Progress.wearItem('hat-tophat')).toBe(false);
        expect(Progress.wearItem('nope')).toBe(false);
        expect(Progress.data.manager.hat).toBe('none');
    });
});
