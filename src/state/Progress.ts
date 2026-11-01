import { FITNESS_MAX, HEAL_PRICE, REST_PRICE, TRANSFER_REFRESH_LEVELS, type CampaignId, type UpgradeId } from '../club/balance';
import { accrueMerch } from '../club/merch';
import {
    campaignDef,
    canStartCampaign,
    canUpgradeStadium,
    extendCampaign,
    isActive,
    merchMultiplier,
    newCampaign,
    stadiumPrice,
    tickCampaign
} from '../club/office';
import { canBuy, nextPrice } from '../club/upgrades';
import { canSign, generateCandidates, releaseRefund, starPrice, tickRun, type StarPlayer } from '../club/stars';
import { getKit } from '../data/kits';
import { Playables } from '../sdk/Playables';
import { defaultSave, sanitizeSave, type SaveData, type TransferList } from './saveData';

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
        data.merchPending = accrueMerch(data.merchPending, data.fans, merchMultiplier(data.stadiumTier, data.campaign));
        data.roster = tickRun(data.roster, data.activeStar, false);
        // Campaigns count completed levels only, after this level's boost applied.
        data.campaign = tickCampaign(data.campaign);
        const newBest = goals > data.bestScore;
        if (newBest) data.bestScore = goals;
        // The score sent to YouTube is fans, and must match the fans in the save.
        const fans = data.fans;
        void this.save().then((ok) => {
            if (ok && fansEarned > 0) Playables.sendScore(fans);
        });
        return { newBest };
    },

    /**
     * A run ended in failure and the player moved on (retry or menu). Not
     * called when they revive, so a revive spares the star an injury.
     */
    failRun(injured: boolean): void {
        if (data.roster.length === 0) return;
        data.roster = tickRun(data.roster, data.activeStar, injured);
        void this.save();
    },

    star(id: string | null): StarPlayer | undefined {
        return data.roster.find((s) => s.id === id);
    },

    /** The scout's list, replaced with a fresh one every few levels. */
    transferList(): TransferList {
        const t = data.transfer;
        if (!t || data.level - t.refreshedAtLevel >= TRANSFER_REFRESH_LEVELS) {
            this.refreshTransfer();
        }
        return data.transfer!;
    },

    /** New transfer list now (rewarded refresh, or when the old one is stale). */
    refreshTransfer(): void {
        const popBonus = isActive(data.campaign, 'talentBuzz') ? 1 : 0;
        data.transfer = { refreshedAtLevel: data.level, candidates: generateCandidates(data.scoutSeed, data.level, popBonus) };
        data.scoutSeed++;
        void this.save();
    },

    /** Signs a candidate from the transfer list; the first star signed becomes active. */
    buyStar(id: string): boolean {
        const candidate = data.transfer?.candidates.find((s) => s.id === id);
        if (!candidate || canSign(candidate, data.coins, data.fans, data.roster) !== 'ok') return false;
        const price = starPrice(candidate.popularity);
        data.coins -= price;
        data.roster.push({ ...candidate, paid: price });
        data.transfer!.candidates = data.transfer!.candidates.filter((s) => s.id !== id);
        if (!data.activeStar) data.activeStar = id;
        void this.save();
        return true;
    },

    /** Lets a star go for half what they cost. Returns the refund, or 0 if not found. */
    releaseStar(id: string): number {
        const star = this.star(id);
        if (!star) return 0;
        const refund = releaseRefund(star);
        data.roster = data.roster.filter((s) => s.id !== id);
        data.coins += refund;
        if (data.activeStar === id) data.activeStar = null;
        void this.save();
        return refund;
    },

    /** Picks the star who leads the squad (null benches everyone). Injured stars can't start. */
    setActiveStar(id: string | null): boolean {
        if (id !== null) {
            const star = this.star(id);
            if (!star || star.injuredLevels > 0) return false;
        }
        if (data.activeStar === id) return true;
        data.activeStar = id;
        void this.save();
        return true;
    },

    /** Doctor: ends an injury, for coins or free after a rewarded ad. */
    healStar(id: string, free: boolean): boolean {
        const star = this.star(id);
        if (!star || star.injuredLevels <= 0 || (!free && data.coins < HEAL_PRICE)) return false;
        if (!free) data.coins -= HEAL_PRICE;
        star.injuredLevels = 0;
        void this.save();
        return true;
    },

    /** Doctor: restores a tired star to full fitness. */
    restStar(id: string): boolean {
        const star = this.star(id);
        if (!star || star.fitness >= FITNESS_MAX || data.coins < REST_PRICE) return false;
        data.coins -= REST_PRICE;
        star.fitness = FITNESS_MAX;
        void this.save();
        return true;
    },

    /** Buys the next stadium tier. */
    upgradeStadium(): boolean {
        if (canUpgradeStadium(data.stadiumTier, data.coins, data.fans) !== 'ok') return false;
        data.coins -= stadiumPrice(data.stadiumTier + 1);
        data.stadiumTier++;
        void this.save();
        return true;
    },

    /** Launches a marketing campaign (one at a time). Talent Buzz brings a new scout list at once. */
    startCampaign(id: CampaignId): boolean {
        if (!canStartCampaign(data.campaign, data.coins, id)) return false;
        data.coins -= campaignDef(id).price;
        data.campaign = newCampaign(id);
        if (id === 'talentBuzz') this.refreshTransfer();
        void this.save();
        return true;
    },

    /** Rewarded: the running campaign lasts 2 more levels (once per campaign). */
    extendCampaign(): boolean {
        const extended = extendCampaign(data.campaign);
        if (!extended) return false;
        data.campaign = extended;
        void this.save();
        return true;
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
