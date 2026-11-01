import { MERCH_CAP_LEVELS, MERCH_MIN, MERCH_RATE } from './balance';

/** Coins the merch store makes per completed level. */
export function merchPerLevel(fans: number): number {
    return Math.max(MERCH_MIN, Math.floor(fans * MERCH_RATE));
}

/** Most uncollected merch coins that can pile up. */
export function merchCap(fans: number): number {
    return merchPerLevel(fans) * MERCH_CAP_LEVELS;
}

/** Pending merch after one more completed level. */
export function accrueMerch(pending: number, fans: number): number {
    return Math.min(merchCap(fans), Math.max(0, pending) + merchPerLevel(fans));
}
