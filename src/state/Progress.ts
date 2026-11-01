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

    completeLevel(goals: number, coinsEarned: number): { newBest: boolean } {
        data.level += 1;
        data.coins += coinsEarned;
        const newBest = goals > data.bestScore;
        if (newBest) data.bestScore = goals;
        // The score sent to YouTube must match the best score in the save.
        void this.save().then((ok) => {
            if (ok && newBest) Playables.sendScore(data.bestScore);
        });
        return { newBest };
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
