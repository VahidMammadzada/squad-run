import {
    CAMPAIGN_EXTEND,
    CAMPAIGN_LEVELS,
    CAMPAIGNS,
    MAX_STADIUM_TIER,
    MERCH_PROMO_MULT,
    STADIUM_FAN_GATES,
    STADIUM_MERCH_BONUS,
    STADIUM_PRICES,
    type CampaignDef,
    type CampaignId
} from './balance';

export interface Campaign {
    id: CampaignId;
    /** Completed levels left; the campaign ends when this reaches 0. */
    levelsLeft: number;
    /** The rewarded extension has been used. */
    extended: boolean;
}

export function campaignDef(id: CampaignId): CampaignDef {
    return CAMPAIGNS.find((c) => c.id === id)!;
}

export function stadiumPrice(nextTier: number): number {
    return STADIUM_PRICES[Math.min(MAX_STADIUM_TIER, Math.max(0, nextTier))];
}

export function stadiumGate(nextTier: number): number {
    return STADIUM_FAN_GATES[Math.min(MAX_STADIUM_TIER, Math.max(0, nextTier))];
}

export type UpgradeCheck = 'ok' | 'max' | 'fans' | 'coins';

export function canUpgradeStadium(tier: number, coins: number, fans: number): UpgradeCheck {
    if (tier >= MAX_STADIUM_TIER) return 'max';
    if (fans < stadiumGate(tier + 1)) return 'fans';
    if (coins < stadiumPrice(tier + 1)) return 'coins';
    return 'ok';
}

/** Merch bonus from the stadium alone, e.g. 1.5 at tier 3. */
export function stadiumMerchBonus(tier: number): number {
    return 1 + STADIUM_MERCH_BONUS * (Math.max(1, tier) - 1);
}

/** Everything that multiplies merch income. */
export function merchMultiplier(tier: number, campaign: Campaign | null): number {
    return stadiumMerchBonus(tier) * (campaign?.id === 'merchPromo' ? MERCH_PROMO_MULT : 1);
}

export function isActive(campaign: Campaign | null, id: CampaignId): boolean {
    return campaign?.id === id && campaign.levelsLeft > 0;
}

export function canStartCampaign(current: Campaign | null, coins: number, id: CampaignId): boolean {
    return (current === null || current.levelsLeft <= 0) && coins >= campaignDef(id).price;
}

export function newCampaign(id: CampaignId): Campaign {
    return { id, levelsLeft: CAMPAIGN_LEVELS, extended: false };
}

/** One completed level: counts down, and ends the campaign at zero. */
export function tickCampaign(campaign: Campaign | null): Campaign | null {
    if (!campaign) return null;
    const levelsLeft = campaign.levelsLeft - 1;
    return levelsLeft > 0 ? { ...campaign, levelsLeft } : null;
}

/** The rewarded extension: once per campaign. */
export function extendCampaign(campaign: Campaign | null): Campaign | null {
    if (!campaign || campaign.extended || campaign.levelsLeft <= 0) return null;
    return { ...campaign, levelsLeft: campaign.levelsLeft + CAMPAIGN_EXTEND, extended: true };
}
