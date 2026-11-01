import type { UpgradeId } from '../club/balance';
import { accrueMerch } from '../club/merch';
import { canBuy, nextPrice } from '../club/upgrades';
import { getKit } from '../data/kits';
import { Playables } from '../sdk/Playables';
import { defaultSave, sanitizeSave, type SaveData } from './saveData';

let data: SaveData = defaultSave();

/** The player's saved progress. Every change is written straight to cloud save. */
export const Progress = {
    get data(): Readonly<SaveData> {
        return data;
    },

    async load(): Promise<void> {
        data = sanitizeSave(await Playables.loadData());
    },

    save(): Promise<boolean> {
        return Playables.saveData(data);
    },

    addCoins(amount: number): void {
        if (amount <= 0) return;
        data.coins += amount;
        void this.save();
    },

    completeLevel(goals: number, coinsEarned: number, fansEarned: number): { newBest: boolean } {
        data.level += 1;
        data.coins += Math.max(0, coinsEarned);
        data.fans += Math.max(0, fansEarned);
        data.merchPending = accrueMerch(data.merchPending, data.fans);
        const newBest = goals > data.bestScore;
        if (newBest) data.bestScore = goals;
        // The score sent to YouTube is fans, and must match the fans in the save.
        const fans = data.fans;
        void this.save().then((ok) => {
            if (ok && fansEarned > 0) Playables.sendScore(fans);
        });
        return { newBest };
    },

    upgradeLevel(id: UpgradeId): number {
        return data.upgrades[id];
    },

    /** Buys the next level of a Training upgrade. Returns false if maxed or unaffordable. */
    buyUpgrade(id: UpgradeId): boolean {
        const level = data.upgrades[id];
        if (!canBuy(id, level, data.coins)) return false;
        data.coins -= nextPrice(id, level)!;
        data.upgrades[id] = level + 1;
        void this.save();
        return true;
    },

    /** Moves pending merch coins (times `multiplier`) into the wallet; returns the amount. */
    collectMerch(multiplier: 1 | 2): number {
        const amount = data.merchPending * multiplier;
        if (amount <= 0) return 0;
        data.coins += amount;
        data.merchPending = 0;
        void this.save();
        return amount;
    },

    isUnlocked(kitId: string): boolean {
        return data.unlockedKits.includes(kitId);
    },

    selectKit(kitId: string): void {
        if (!this.isUnlocked(kitId) || data.selectedKit === kitId) return;
        data.selectedKit = kitId;
        void this.save();
    },

    /** Buys and equips a kit. Returns false if the player can't afford it. */
    buyKit(kitId: string): boolean {
        const kit = getKit(kitId);
        if (this.isUnlocked(kitId) || data.coins < kit.price) return false;
        data.coins -= kit.price;
        data.unlockedKits.push(kitId);
        data.selectedKit = kitId;
        void this.save();
        return true;
    }
};
