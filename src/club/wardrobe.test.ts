import { describe, expect, it } from 'vitest';
import { canBuyItem, defaultManager, isEquipped, isOwned, itemsFor, managerLook, sanitizeManager, WARDROBE, wardrobeItem, withItem } from './wardrobe';

describe('wardrobe catalogue', () => {
    it('has unique ids and a free default in every slot', () => {
        expect(new Set(WARDROBE.map((w) => w.id)).size).toBe(WARDROBE.length);
        const m = defaultManager();
        for (const slot of ['skin', 'hairColor', 'hairStyle', 'outfit', 'hat', 'accessory', 'celebration'] as const) {
            const equipped = itemsFor(slot).find((w) => isEquipped(m, w));
            expect(equipped, slot).toBeDefined();
            expect(equipped!.price).toBe(0);
        }
    });

    it('checks ownership, then fans, then coins', () => {
        const m = defaultManager();
        const cap = wardrobeItem('hat-cap')!;
        const tophat = wardrobeItem('hat-tophat')!;
        expect(canBuyItem(m, wardrobeItem('hat-none')!, 0, 0)).toBe('owned');
        expect(canBuyItem(m, cap, 149, 0)).toBe('coins');
        expect(canBuyItem(m, cap, 150, 0)).toBe('ok');
        expect(canBuyItem(m, tophat, 1e6, 999)).toBe('fans');
        expect(canBuyItem({ ...m, owned: ['hat-cap'] }, cap, 0, 0)).toBe('owned');
    });

    it('swaps one slot for try-ons', () => {
        const m = defaultManager();
        const on = withItem(m, wardrobeItem('outfit-suit')!);
        expect(on.outfit).toBe('suit');
        expect(on.hat).toBe(m.hat);
    });
});

describe('managerLook', () => {
    it('dresses the tracksuit in the club colour', () => {
        const look = managerLook(defaultManager(), 0xe53935);
        expect(look).toMatchObject({ top: 0xe53935, outfit: 'tracksuit', hat: 'none', club: 0xe53935 });
    });

    it('keeps fixed outfit colours', () => {
        expect(managerLook({ ...defaultManager(), outfit: 'gold' }, 0x123456).top).toBe(0xffd21f);
    });
});

describe('sanitizeManager', () => {
    it('defaults for junk, keeps owned equipped items, drops unowned ones', () => {
        expect(sanitizeManager(null)).toEqual(defaultManager());
        const m = sanitizeManager({ owned: ['hat-cap', 'bogus', 'hat-none', 5], hat: 'cap', outfit: 'gold', hairStyle: 'mohawk', skin: 0x8d5524 });
        expect(m.owned).toEqual(['hat-cap']);
        expect(m.hat).toBe('cap');
        // Not owned, so back to the free default.
        expect(m.outfit).toBe('tracksuit');
        expect(m.hairStyle).toBe('short');
        // Free item, always owned.
        expect(m.skin).toBe(0x8d5524);
        expect(isOwned(m, wardrobeItem('skin-8d5524')!)).toBe(true);
    });
});
