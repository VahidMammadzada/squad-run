import { MERCH_CAP_LEVELS, MERCH_MIN, MERCH_RATE } from './balance';

/** Coins the merch store makes per completed level; `mult` is stadium and promo bonuses. */
export function merchPerLevel(fans: number, mult = 1): number {
    return Math.floor(Math.max(MERCH_MIN, Math.floor(fans * MERCH_RATE)) * mult);
}

/** Most uncollected merch coins that can pile up. */
export function merchCap(fans: number, mult = 1): number {
    return merchPerLevel(fans, mult) * MERCH_CAP_LEVELS;
}

/** Pending merch after one more completed level. */
export function accrueMerch(pending: number, fans: number, mult = 1): number {
    return Math.min(merchCap(fans, mult), Math.max(0, pending) + merchPerLevel(fans, mult));
}
