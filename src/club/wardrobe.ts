// The manager's wardrobe: catalogue, ownership and the resulting look. Pure, so
// prices and gates are unit tested; src/three/ManagerView draws the look.

export type WardrobeSlot = 'skin' | 'hairColor' | 'hairStyle' | 'outfit' | 'hat' | 'accessory' | 'celebration';

export type HairStyle = 'short' | 'buzz' | 'curly' | 'long' | 'bald' | 'mohawk';
export type OutfitId = 'tracksuit' | 'hoodie' | 'suit' | 'retro' | 'coat' | 'gold';
export type HatId = 'none' | 'cap' | 'beanie' | 'flatcap' | 'headset' | 'tophat';
export type AccessoryId = 'none' | 'whistle' | 'clipboard' | 'sunglasses' | 'scarf' | 'trophy';
export type CelebrationId = 'fistpump' | 'jump' | 'spin' | 'dance' | 'kneeslide' | 'backflip';

export interface WardrobeItem {
    /** Unique across slots, e.g. 'hat-cap'. */
    id: string;
    slot: WardrobeSlot;
    /** What the slot is set to when equipped (a style id, or a colour as a number). */
    value: string | number;
    name: string;
    price: number;
    /** Fans the club needs before this can be bought (prestige items). */
    fans: number;
}

const item = (slot: WardrobeSlot, value: string | number, name: string, price = 0, fans = 0): WardrobeItem => ({
    id: `${slot}-${typeof value === 'number' ? value.toString(16) : value}`,
    slot,
    value,
    name,
    price,
    fans
});

export const SKIN_TONES = [0xf5d0b0, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a1e];
export const HAIR_TONES = [0x3e2723, 0x1a1a1a, 0x8e5a2b, 0xd35400, 0xf2c94c, 0xeeeeee, 0x2f6fed, 0xe91e63];

export const WARDROBE: readonly WardrobeItem[] = [
    ...SKIN_TONES.map((c, i) => item('skin', c, `Tone ${i + 1}`)),
    ...HAIR_TONES.map((c, i) => item('hairColor', c, `Colour ${i + 1}`)),
    item('hairStyle', 'short', 'Short'),
    item('hairStyle', 'buzz', 'Buzz cut'),
    item('hairStyle', 'bald', 'Bald', 50),
    item('hairStyle', 'curly', 'Curly', 100),
    item('hairStyle', 'long', 'Long', 120),
    item('hairStyle', 'mohawk', 'Mohawk', 150),
    item('outfit', 'tracksuit', 'Club tracksuit'),
    item('outfit', 'hoodie', 'Hoodie', 200),
    item('outfit', 'suit', 'Sharp suit', 300),
    item('outfit', 'retro', 'Retro kit', 400),
    item('outfit', 'coat', 'Long coat', 600),
    item('outfit', 'gold', 'Gold suit', 2500, 2000),
    item('hat', 'none', 'No hat'),
    item('hat', 'cap', 'Cap', 150),
    item('hat', 'beanie', 'Beanie', 150),
    item('hat', 'flatcap', 'Flat cap', 250),
    item('hat', 'headset', 'Headset', 300),
    item('hat', 'tophat', 'Top hat', 900, 1000),
    item('accessory', 'none', 'Nothing'),
    item('accessory', 'whistle', 'Whistle', 100),
    item('accessory', 'clipboard', 'Clipboard', 150),
    item('accessory', 'sunglasses', 'Sunglasses', 200),
    item('accessory', 'scarf', 'Club scarf', 200),
    item('accessory', 'trophy', 'Trophy', 3000, 2500),
    item('celebration', 'fistpump', 'Fist pump'),
    item('celebration', 'jump', 'Jump', 200),
    item('celebration', 'spin', 'Spin', 400),
    item('celebration', 'dance', 'Dance', 600),
    item('celebration', 'kneeslide', 'Knee slide', 900),
    item('celebration', 'backflip', 'Backflip', 2000, 1500)
];

/** What the manager has on: one value per slot. */
export interface ManagerEquip {
    skin: number;
    hairColor: number;
    hairStyle: HairStyle;
    outfit: OutfitId;
    hat: HatId;
    accessory: AccessoryId;
    celebration: CelebrationId;
}

export interface ManagerState extends ManagerEquip {
    /** Ids of bought items (free items are always owned). */
    owned: string[];
}

export function defaultManager(): ManagerState {
    return {
        skin: SKIN_TONES[2],
        hairColor: HAIR_TONES[0],
        hairStyle: 'short',
        outfit: 'tracksuit',
        hat: 'none',
        accessory: 'none',
        celebration: 'fistpump',
        owned: []
    };
}

export function wardrobeItem(id: string): WardrobeItem | undefined {
    return WARDROBE.find((w) => w.id === id);
}

export function itemsFor(slot: WardrobeSlot): WardrobeItem[] {
    return WARDROBE.filter((w) => w.slot === slot);
}

export function isOwned(m: ManagerState, w: WardrobeItem): boolean {
    return w.price === 0 || m.owned.includes(w.id);
}

export function isEquipped(m: ManagerEquip, w: WardrobeItem): boolean {
    return m[w.slot] === w.value;
}

export type BuyCheck = 'owned' | 'fans' | 'coins' | 'ok';

export function canBuyItem(m: ManagerState, w: WardrobeItem, coins: number, fans: number): BuyCheck {
    if (isOwned(m, w)) return 'owned';
    if (fans < w.fans) return 'fans';
    if (coins < w.price) return 'coins';
    return 'ok';
}

/** The equip with one item swapped in (for try-on previews and equipping). */
export function withItem(m: ManagerEquip, w: WardrobeItem): ManagerEquip {
    return { ...m, [w.slot]: w.value } as ManagerEquip;
}

/** Everything ManagerView needs to dress the manager. */
export interface ManagerLook {
    skin: number;
    hair: number;
    hairStyle: HairStyle;
    top: number;
    trim: number;
    trousers: number;
    shoes: number;
    outfit: OutfitId;
    hat: HatId;
    accessory: AccessoryId;
    /** Club kit colour, for club-coloured details (scarf, tie, cap). */
    club: number;
}

/** Outfit colours; `null` means the club's kit colour. */
const OUTFITS: Record<OutfitId, { top: number | null; trim: number | null; trousers: number | null; shoes: number }> = {
    tracksuit: { top: null, trim: 0xffffff, trousers: 0x1b2a5c, shoes: 0x1a1a1a },
    hoodie: { top: 0x9aa4b5, trim: null, trousers: 0x37474f, shoes: 0xffffff },
    suit: { top: 0x263238, trim: 0xffffff, trousers: 0x263238, shoes: 0x1a1a1a },
    retro: { top: null, trim: 0xffffff, trousers: 0xffffff, shoes: 0x1a1a1a },
    coat: { top: 0x5d4037, trim: null, trousers: 0x212121, shoes: 0x3e2723 },
    gold: { top: 0xffd21f, trim: 0xffffff, trousers: 0xffd21f, shoes: 0xffffff }
};

export function managerLook(m: ManagerEquip, club: number): ManagerLook {
    const o = OUTFITS[m.outfit];
    return {
        skin: m.skin,
        hair: m.hairColor,
        hairStyle: m.hairStyle,
        top: o.top ?? club,
        trim: o.trim ?? club,
        trousers: o.trousers ?? club,
        shoes: o.shoes,
        outfit: m.outfit,
        hat: m.hat,
        accessory: m.accessory,
        club
    };
}

/** Repairs a saved manager: unknown values fall back to defaults; only real, priced items stay owned. */
export function sanitizeManager(raw: unknown): ManagerState {
    const m = defaultManager();
    if (typeof raw !== 'object' || raw === null) return m;
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.owned)) {
        m.owned = [...new Set(r.owned.filter((id): id is string => typeof id === 'string' && (wardrobeItem(id)?.price ?? 0) > 0))];
    }
    for (const slot of ['skin', 'hairColor', 'hairStyle', 'outfit', 'hat', 'accessory', 'celebration'] as const) {
        const w = WARDROBE.find((it) => it.slot === slot && it.value === r[slot]);
        // Only keep what the manager actually owns; otherwise the default for the slot.
        if (w && isOwned(m, w)) (m as unknown as Record<string, unknown>)[slot] = w.value;
    }
    return m;
}
