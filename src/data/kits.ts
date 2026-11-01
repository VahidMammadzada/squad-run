export interface Kit {
    id: string;
    name: string;
    shirt: number;
    price: number;
}

export const DEFAULT_KIT = 'blue';

export const KITS: readonly Kit[] = [
    { id: 'blue', name: 'Classic Blue', shirt: 0x2f6fed, price: 0 },
    { id: 'red', name: 'Crimson', shirt: 0xe53935, price: 100 },
    { id: 'yellow', name: 'Sunshine', shirt: 0xfdd835, price: 250 },
    { id: 'purple', name: 'Royal', shirt: 0x8e24aa, price: 400 },
    { id: 'orange', name: 'Tangerine', shirt: 0xfb8c00, price: 600 },
    { id: 'white', name: 'All White', shirt: 0xf5f5f5, price: 900 },
    { id: 'pink', name: 'Flamingo', shirt: 0xff5c9e, price: 1200 },
    { id: 'mint', name: 'Mint', shirt: 0x26c6a6, price: 1600 }
];

export function getKit(id: string): Kit {
    return KITS.find((k) => k.id === id) ?? KITS[0];
}
