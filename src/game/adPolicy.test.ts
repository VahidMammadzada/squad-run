import { describe, expect, it } from 'vitest';
import { AD_CONFIG, AdPolicy } from './adPolicy';

const LONG = AD_CONFIG.minGapMs * 10;

function completed(policy: AdPolicy, n: number): void {
    for (let i = 0; i < n; i++) policy.levelCompleted();
}

describe('AdPolicy', () => {
    it('never shows before the first ad level', () => {
        const p = new AdPolicy();
        completed(p, 5);
        expect(p.canShowInterstitial(AD_CONFIG.firstAdLevel - 1, LONG)).toBe(false);
        expect(p.canShowInterstitial(AD_CONFIG.firstAdLevel, LONG)).toBe(true);
    });

    it('needs enough completed levels, even when time has passed', () => {
        const p = new AdPolicy();
        completed(p, 3);
        p.interstitialShown(0);
        completed(p, AD_CONFIG.minGapLevels - 1);
        expect(p.canShowInterstitial(9, LONG)).toBe(false);
        p.levelCompleted();
        expect(p.canShowInterstitial(9, LONG)).toBe(true);
    });

    it('needs enough time, even when enough levels were completed', () => {
        const p = new AdPolicy();
        completed(p, 3);
        p.interstitialShown(1000);
        completed(p, 10);
        expect(p.canShowInterstitial(9, 1000 + AD_CONFIG.minGapMs - 1)).toBe(false);
        expect(p.canShowInterstitial(9, 1000 + AD_CONFIG.minGapMs)).toBe(true);
    });

    it('does not reset the counters when no ad was shown', () => {
        const p = new AdPolicy();
        completed(p, 3);
        expect(p.canShowInterstitial(4, LONG)).toBe(true);
        // The request failed, so interstitialShown is never called.
        p.levelCompleted();
        expect(p.canShowInterstitial(5, LONG)).toBe(true);
    });

    it('stays quiet for a while after a rewarded ad', () => {
        const p = new AdPolicy();
        completed(p, 5);
        p.rewardedShown(5000);
        expect(p.canShowInterstitial(6, 5000 + AD_CONFIG.minGapMs - 1)).toBe(false);
        expect(p.canShowInterstitial(6, 5000 + AD_CONFIG.minGapMs)).toBe(true);
    });
});
