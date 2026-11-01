/** Tunable ad cadence. Starting points from industry guidance; tune with Developer Portal data. */
export const AD_CONFIG = {
    /** No interstitial before loading this level. */
    firstAdLevel: 4,
    /** Minimum time between interstitials. */
    minGapMs: 90_000,
    /** Minimum completed levels between interstitials. */
    minGapLevels: 2,
    /** Give up on an ad request that never settles and carry on. */
    requestTimeoutMs: 10_000
} as const;

/** Rewarded ad ids: stable per reward type, no user data. Don't rename once live. */
export const REWARD_IDS = {
    revive: 'revive-squad',
    tripleCoins: 'triple-coins',
    merchDouble: 'merch-double',
    scoutRefresh: 'scout-refresh',
    doctorHeal: 'doctor-heal'
} as const;

/**
 * Decides when an interstitial may be shown. Session-only state (not saved), and
 * time is passed in so the rules are testable.
 */
export class AdPolicy {
    private levelsSinceAd = 0;
    private lastAdAt: number | null = null;
    private lastRewardedAt: number | null = null;

    /** Call once each time the player finishes a level. */
    levelCompleted(): void {
        this.levelsSinceAd++;
    }

    /** `nextLevel` is the level about to load. */
    canShowInterstitial(nextLevel: number, now: number): boolean {
        if (nextLevel < AD_CONFIG.firstAdLevel) return false;
        if (this.levelsSinceAd < AD_CONFIG.minGapLevels) return false;
        if (this.lastAdAt !== null && now - this.lastAdAt < AD_CONFIG.minGapMs) return false;
        // Never stack an interstitial right behind a rewarded ad.
        if (this.lastRewardedAt !== null && now - this.lastRewardedAt < AD_CONFIG.minGapMs) return false;
        return true;
    }

    interstitialShown(now: number): void {
        this.levelsSinceAd = 0;
        this.lastAdAt = now;
    }

    rewardedShown(now: number): void {
        this.lastRewardedAt = now;
    }
}

export const adPolicy = new AdPolicy();
