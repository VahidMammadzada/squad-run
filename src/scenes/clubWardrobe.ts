// The LOCKER ROOM stall: the manager's wardrobe. Tapping an item tries it on
// (the 3D manager above the sheet shows it); owned items are worn straight
// away, others show their price and a second tap buys them.
import type * as Phaser from 'phaser';
import { TEX } from '../art/textures';
import { Sfx } from '../audio/Sfx';
import { canBuyItem, isEquipped, isOwned, itemsFor, withItem, type ManagerEquip, type WardrobeItem, type WardrobeSlot } from '../club/wardrobe';
import { COLORS, GAME_WIDTH } from '../config';
import { Progress } from '../state/Progress';
import { textStyle } from '../ui/widgets';
import { floatText, GREY, INK, shake, SUB, type ClubHost } from './clubUi';

type Tab = 'body' | 'outfit' | 'hat' | 'accessory' | 'celebration';

const TABS: [Tab, string][] = [
    ['body', 'BODY'],
    ['outfit', 'OUTFIT'],
    ['hat', 'HAT'],
    ['accessory', 'EXTRA'],
    ['celebration', 'CELEBRATE']
];

/** Kept across rebuilds of the panel. */
let tab: Tab = 'outfit';
let tryOn: WardrobeItem | null = null;

export function resetWardrobe(): void {
    tab = 'outfit';
    tryOn = null;
}

export function buildWardrobe(host: ClubHost, root: Phaser.GameObjects.Container, top: number): void {
    const { scene } = host;
    const m = Progress.data.manager;
    // Show the try-on (if any) on top of what's worn.
    host.preview?.(tryOn ? withItem(m, tryOn) : null);

    // Slot tabs.
    const tw = 128;
    TABS.forEach(([id, label], i) => {
        const x = GAME_WIDTH / 2 + (i - 2) * (tw + 8);
        const selected = id === tab;
        const g = scene.add.graphics();
        g.fillStyle(selected ? COLORS.buttonAccent : COLORS.panel).fillRoundedRect(-tw / 2, -24, tw, 48, 24);
        if (selected) g.lineStyle(4, 0xffffff).strokeRoundedRect(-tw / 2, -24, tw, 48, 24);
        const pill = scene.add.container(x, top + 100, [g, scene.add.text(0, -2, label, textStyle(label.length > 7 ? 18 : 22)).setOrigin(0.5)]);
        pill.setSize(tw, 48).setInteractive({ useHandCursor: true });
        pill.on('pointerup', () => {
            if (tab === id) return;
            Sfx.play('click');
            tab = id;
            tryOn = null;
            host.refresh();
        });
        root.add(pill);
    });

    if (tab === 'body') {
        swatches(host, root, 'skin', 'SKIN', top + 182);
        swatches(host, root, 'hairColor', 'HAIR COLOUR', top + 282);
        grid(host, root, itemsFor('hairStyle'), top + 405, 96);
    } else {
        grid(host, root, itemsFor(tab as WardrobeSlot), top + 230, 160);
    }
}

/** A row of colour swatches (all free): tap to wear. */
function swatches(host: ClubHost, root: Phaser.GameObjects.Container, slot: 'skin' | 'hairColor', label: string, y: number): void {
    const { scene } = host;
    const items = itemsFor(slot);
    root.add(scene.add.text(40, y - 34, label, textStyle(22)).setOrigin(0, 0.5));
    const step = Math.min(84, 600 / items.length);
    items.forEach((w, i) => {
        const x = GAME_WIDTH / 2 + (i - (items.length - 1) / 2) * step;
        const on = isEquipped(Progress.data.manager, w);
        const g = scene.add.graphics();
        g.fillStyle(COLORS.ink, 0.35).fillCircle(0, 4, 28);
        g.fillStyle(w.value as number).fillCircle(0, 0, 28);
        g.lineStyle(on ? 6 : 3, on ? COLORS.gold : 0xffffff).strokeCircle(0, 0, 28);
        const c = scene.add.container(x, y + 12, [g]).setSize(60, 60).setInteractive({ useHandCursor: true });
        c.on('pointerup', () => wear(host, w, c));
        root.add(c);
    });
}

/** Item cards, 3 per row. */
function grid(host: ClubHost, root: Phaser.GameObjects.Container, items: WardrobeItem[], y0: number, h: number): void {
    const { scene } = host;
    const w = 200;
    const { manager: m, coins, fans } = Progress.data;
    items.forEach((it, i) => {
        const x = GAME_WIDTH / 2 + ((i % 3) - 1) * (w + 14);
        const y = y0 + Math.floor(i / 3) * (h + 14);
        const owned = isOwned(m, it);
        const equipped = isEquipped(m, it);
        const trying = tryOn?.id === it.id;
        const check = canBuyItem(m, it, coins, fans);

        const g = scene.add.graphics();
        g.fillStyle(COLORS.ink, 0.3).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 20);
        g.fillStyle(trying ? 0xfff6d6 : 0xffffff).fillRoundedRect(-w / 2, -h / 2, w, h, 20);
        if (equipped || trying) g.lineStyle(6, equipped ? COLORS.gold : COLORS.buttonAccent).strokeRoundedRect(-w / 2, -h / 2, w, h, 20);
        const parts: Phaser.GameObjects.GameObject[] = [g, scene.add.text(0, -h / 2 + 30, it.name.toUpperCase(), textStyle(20, INK, false)).setOrigin(0.5)];

        // Status pill along the bottom: WORN / WEAR / price / fan lock.
        const py = h / 2 - 30;
        const pill = scene.add.graphics();
        let label: string;
        let color: number;
        let icon: string | null = null;
        if (equipped) [label, color] = ['WORN', COLORS.gold];
        else if (owned) [label, color] = ['WEAR', COLORS.buttonAlt];
        else if (check === 'fans') [label, color, icon] = [String(it.fans), GREY, TEX.fan];
        else [label, color, icon] = [trying ? `BUY ${it.price}` : String(it.price), check === 'ok' ? COLORS.button : GREY, TEX.coin];
        pill.fillStyle(color).fillRoundedRect(-80, py - 22, 160, 44, 22);
        parts.push(pill);
        const text = scene.add.text(icon ? 14 : 0, py - 2, label, textStyle(22)).setOrigin(0.5);
        parts.push(text);
        if (icon) parts.push(scene.add.image(text.x - text.width / 2 - 18, py - 2, icon).setScale(0.8));
        if (!owned && h > 120) parts.push(scene.add.text(0, -6, check === 'fans' ? 'FANS NEEDED' : 'tap to try on', textStyle(16, SUB, false)).setOrigin(0.5));

        const card = scene.add.container(x, y, parts).setSize(w, h).setInteractive({ useHandCursor: true });
        card.on('pointerdown', () => card.setScale(0.96));
        card.on('pointerout', () => card.setScale(1));
        card.on('pointerup', () => {
            card.setScale(1);
            wear(host, it, card);
        });
        root.add(card);
    });
}

/** Owned: wear it. Not owned: first tap tries it on, second tap buys it. */
function wear(host: ClubHost, it: WardrobeItem, target: Phaser.GameObjects.Container): void {
    const { scene } = host;
    const owned = isOwned(Progress.data.manager, it);
    if (!owned && tryOn?.id !== it.id) {
        tryOn = it;
        Sfx.play('click');
        if (it.slot === 'celebration') host.celebrate?.(it.value as ManagerEquip['celebration']);
        host.refresh();
        return;
    }
    if (Progress.wearItem(it.id)) {
        tryOn = null;
        Sfx.play(owned ? 'click' : 'win');
        if (!owned) {
            host.coinsChanged();
            floatText(scene, 'NEW LOOK!', GAME_WIDTH / 2, target.y, '#ffd21f');
        }
        if (it.slot === 'celebration') host.celebrate?.(it.value as ManagerEquip['celebration']);
        host.refresh();
    } else {
        Sfx.play('gateBad');
        shake(scene, target);
    }
}
