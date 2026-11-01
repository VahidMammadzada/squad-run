import { describe, expect, it } from 'vitest';
import { START_SQUAD } from '../config';
import { KITS } from '../data/kits';
import { generateLevel } from '../game/levelGen';
import { COINS_PER_GOAL, goalsFor } from '../game/scoring';
import { REST_PRICE, STAR_FAN_GATES, TRANSFER_REFRESH_LEVELS, UPGRADE_IDS, type UpgradeId } from './balance';
import { fansForLevel } from './fans';
import { accrueMerch } from './merch';
import { runModifiers } from './runModifiers';
import { canSign, generateCandidates, isTired, starPrice, tickRun, type StarPlayer } from './stars';
import { nextPrice } from './upgrades';

/**
 * A casual player: picks up some coins, ends with a modest squad, collects merch
 * every level, buys whatever is cheapest (upgrades, kits, stars), rests a tired star.
 */
const PICKUP_RATE = 0.6;
const endSquad = (level: number, startBonus: number) => START_SQUAD + startBonus + 10 + level;

function simulate(levels: number) {
    let coins = 0;
    let fans = 0;
    let merch = 0;
    const upgrades = Object.fromEntries(UPGRADE_IDS.map((id) => [id, 0])) as Record<UpgradeId, number>;
    const kits = KITS.filter((k) => k.price > 0).map((k) => k.price);
    const purchases: number[] = [];
    const rows: string[] = [];
    let roster: StarPlayer[] = [];
    let candidates: StarPlayer[] = [];
    let firstStarAt: number | null = null;
    let topStarUnlockedAt: number | null = null;

    for (let level = 1; level <= levels; level++) {
        if ((level - 1) % TRANSFER_REFRESH_LEVELS === 0) candidates = generateCandidates(level, level);
        const club = { upgrades, roster, activeStar: roster[0]?.id ?? null };
        const mods = runModifiers(club);
        const spec = generateLevel(level);
        const pickups = Math.round(spec.coins.length * Math.min(1, PICKUP_RATE * mods.coinReachMult));
        const goals = goalsFor(endSquad(level, mods.startSquadBonus), level, mods.perGoalDelta);
        const earnedFans = fansForLevel(goals, mods.fanMult);
        fans += earnedFans;
        merch = accrueMerch(merch, fans);
        coins += pickups + goals * COINS_PER_GOAL + merch;
        merch = 0;
        roster = tickRun(roster, club.activeStar, false);
        if (topStarUnlockedAt === null && fans >= STAR_FAN_GATES[4]) topStarUnlockedAt = level;
        if (roster[0] && isTired(roster[0]) && coins >= REST_PRICE) {
            coins -= REST_PRICE;
            roster[0] = { ...roster[0], fitness: 100 };
        }

        // A first star is the shiny new thing: save up and sign the cheapest one.
        if (roster.length === 0) {
            const first = candidates
                .filter((c) => canSign(c, Infinity, fans, roster) === 'ok')
                .sort((x, y) => starPrice(x.popularity) - starPrice(y.popularity))[0];
            if (first && coins < starPrice(first.popularity)) {
                rows.push(`L${level} goals ${goals} fans +${earnedFans}=${fans} coins ${coins} saving for a star`);
                continue;
            }
            if (first) {
                coins -= starPrice(first.popularity);
                roster = [{ ...first, paid: starPrice(first.popularity) }];
                candidates = candidates.filter((x) => x !== first);
                firstStarAt = level;
                purchases.push(level);
            }
        }

        // Then buy the cheapest thing on offer until nothing is affordable.
        for (;;) {
            const offers: { price: number; buy: () => unknown }[] = [];
            for (const id of UPGRADE_IDS) {
                const price = nextPrice(id, upgrades[id]);
                if (price !== null) offers.push({ price, buy: () => upgrades[id]++ });
            }
            kits.forEach((price, i) => offers.push({ price, buy: () => kits.splice(i, 1) }));
            for (const c of candidates) {
                if (canSign(c, Infinity, fans, roster) !== 'ok') continue;
                offers.push({
                    price: starPrice(c.popularity),
                    buy: () => {
                        roster = [...roster, { ...c, paid: starPrice(c.popularity) }];
                        candidates = candidates.filter((x) => x !== c);
                        firstStarAt ??= level;
                    }
                });
            }
            const cheapest = offers.sort((a, b) => a.price - b.price)[0];
            if (!cheapest || cheapest.price > coins) break;
            coins -= cheapest.price;
            cheapest.buy();
            purchases.push(level);
        }
        rows.push(`L${level} goals ${goals} fans +${earnedFans}=${fans} coins ${coins} stars ${roster.length} bought ${purchases.filter((l) => l === level).length}`);
    }
    return { purchases, rows, firstStarAt, topStarUnlockedAt };
}

describe('club economy (casual player model)', () => {
    const { purchases, rows, firstStarAt, topStarUnlockedAt } = simulate(40);
    console.log(rows.join('\n'));

    it('makes the first purchase within 3 levels', () => {
        expect(purchases[0]).toBeLessThanOrEqual(3);
    });

    it('offers a purchase about every 3 levels or sooner through level 30', () => {
        const levelsWithPurchase = new Set(purchases.filter((l) => l <= 30));
        const gaps: number[] = [];
        let last = 0;
        for (const level of [...levelsWithPurchase].sort((a, b) => a - b)) {
            gaps.push(level - last);
            last = level;
        }
        gaps.push(30 - last);
        const average = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        expect(average).toBeLessThanOrEqual(3);
    });

    it('signs a first star early', () => {
        expect(firstStarAt).not.toBeNull();
        expect(firstStarAt!).toBeLessThanOrEqual(6);
    });

    it('unlocks the popularity-4 fan gate in the mid game', () => {
        expect(topStarUnlockedAt).not.toBeNull();
        expect(topStarUnlockedAt!).toBeGreaterThanOrEqual(15);
        expect(topStarUnlockedAt!).toBeLessThanOrEqual(25);
    });
});
