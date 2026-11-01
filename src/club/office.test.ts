import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LEVELS } from './balance';
import { accrueMerch, merchPerLevel } from './merch';
import { canStartCampaign, canUpgradeStadium, extendCampaign, merchMultiplier, newCampaign, stadiumGate, stadiumPrice, tickCampaign } from './office';
import { runModifiers } from './runModifiers';
import { generateCandidates } from './stars';

const NO_UPGRADES = { youth: 0, magnet: 0, fanclub: 0, finishing: 0 };

describe('stadium', () => {
    it('prices and gates each tier', () => {
        expect(stadiumPrice(2)).toBe(300);
        expect(stadiumPrice(5)).toBe(3000);
        expect(stadiumGate(2)).toBe(0);
        expect(stadiumGate(3)).toBe(500);
    });

    it('checks max, fans, then coins', () => {
        expect(canUpgradeStadium(5, 1e9, 1e9)).toBe('max');
        expect(canUpgradeStadium(2, 1e9, 499)).toBe('fans');
        expect(canUpgradeStadium(2, 799, 500)).toBe('coins');
        expect(canUpgradeStadium(2, 800, 500)).toBe('ok');
        expect(canUpgradeStadium(1, 300, 0)).toBe('ok');
    });

    it('multiplies merch by tier and Merch Promo', () => {
        expect(merchMultiplier(1, null)).toBe(1);
        expect(merchMultiplier(3, null)).toBe(1.5);
        expect(merchMultiplier(5, newCampaign('merchPromo'))).toBe(4);
        expect(merchMultiplier(3, newCampaign('fanDrive'))).toBe(1.5);
        expect(merchPerLevel(1000, 1.5)).toBe(60);
        expect(accrueMerch(0, 1000, 2)).toBe(80);
    });
});

describe('campaigns', () => {
    it('one at a time, if affordable', () => {
        expect(canStartCampaign(null, 150, 'fanDrive')).toBe(true);
        expect(canStartCampaign(null, 149, 'fanDrive')).toBe(false);
        expect(canStartCampaign(newCampaign('merchPromo'), 1e9, 'fanDrive')).toBe(false);
    });

    it('counts down completed levels, then ends', () => {
        let c = newCampaign('fanDrive');
        for (let i = 1; i < CAMPAIGN_LEVELS; i++) c = tickCampaign(c)!;
        expect(c.levelsLeft).toBe(1);
        expect(tickCampaign(c)).toBeNull();
    });

    it('extends by 2, only once', () => {
        const once = extendCampaign(newCampaign('talentBuzz'));
        expect(once).toMatchObject({ levelsLeft: CAMPAIGN_LEVELS + 2, extended: true });
        expect(extendCampaign(once)).toBeNull();
        expect(extendCampaign(null)).toBeNull();
    });

    it('Fan Drive boosts fans in the run', () => {
        expect(runModifiers({ upgrades: NO_UPGRADES, campaign: newCampaign('fanDrive') }).fanMult).toBeCloseTo(1.5);
        expect(runModifiers({ upgrades: NO_UPGRADES, campaign: newCampaign('merchPromo') }).fanMult).toBeCloseTo(1);
    });

    it('Talent Buzz raises scouted popularity, capped at 5', () => {
        const plain = generateCandidates(4, 30);
        const buzzed = generateCandidates(4, 30, 1);
        buzzed.forEach((s, i) => expect(s.popularity).toBe(Math.min(5, plain[i].popularity + 1)));
    });
});
