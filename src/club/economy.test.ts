import { describe, expect, it } from 'vitest';
import { START_SQUAD } from '../config';
import { KITS } from '../data/kits';
import { generateLevel } from '../game/levelGen';
import { COINS_PER_GOAL, goalsFor } from '../game/scoring';
import { UPGRADE_IDS, type UpgradeId } from './balance';
import { fansForLevel } from './fans';
import { accrueMerch } from './merch';
import { runModifiers } from './runModifiers';
import { nextPrice } from './upgrades';

/** A casual player: picks up some coins, ends with a modest squad, collects merch every level, buys whatever is cheapest. */
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

    for (let level = 1; level <= levels; level++) {
        const mods = runModifiers({ upgrades });
        const spec = generateLevel(level);
        const pickups = Math.round(spec.coins.length * Math.min(1, PICKUP_RATE * mods.coinReachMult));
        const goals = goalsFor(endSquad(level, mods.startSquadBonus), level, mods.perGoalDelta);
        const earnedFans = fansForLevel(goals, mods.fanClubLevel);
        fans += earnedFans;
        merch = accrueMerch(merch, fans);
        coins += pickups + goals * COINS_PER_GOAL + merch;
        merch = 0;

        // Buy the cheapest thing on offer until nothing is affordable.
        for (;;) {
            const offers: { price: number; buy: () => unknown }[] = [];
            for (const id of UPGRADE_IDS) {
                const price = nextPrice(id, upgrades[id]);
                if (price !== null) offers.push({ price, buy: () => upgrades[id]++ });
            }
            kits.forEach((price, i) => offers.push({ price, buy: () => kits.splice(i, 1) }));
            const cheapest = offers.sort((a, b) => a.price - b.price)[0];
            if (!cheapest || cheapest.price > coins) break;
            coins -= cheapest.price;
            cheapest.buy();
            purchases.push(level);
        }
        rows.push(`L${level} goals ${goals} fans +${earnedFans}=${fans} coins ${coins} bought ${purchases.filter((l) => l === level).length}`);
    }
    return { purchases, rows };
}

describe('club economy (casual player model)', () => {
    const { purchases, rows } = simulate(40);
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
});
