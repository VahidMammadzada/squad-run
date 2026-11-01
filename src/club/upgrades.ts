import { UPGRADES, type UpgradeDef, type UpgradeId } from './balance';

export function upgradeDef(id: UpgradeId): UpgradeDef {
    return UPGRADES.find((u) => u.id === id)!;
}

export function maxLevel(id: UpgradeId): number {
    return upgradeDef(id).prices.length;
}

export function isMaxed(id: UpgradeId, level: number): boolean {
    return level >= maxLevel(id);
}

/** Price of the next level, or null when maxed. */
export function nextPrice(id: UpgradeId, level: number): number | null {
    return isMaxed(id, level) ? null : upgradeDef(id).prices[Math.max(0, level)];
}

export function canBuy(id: UpgradeId, level: number, coins: number): boolean {
    const price = nextPrice(id, level);
    return price !== null && coins >= price;
}
