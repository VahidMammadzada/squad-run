import * as Phaser from 'phaser';
import { Sfx } from '../audio/Sfx';
import { stallDef, type StallId } from '../club/concourse';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { textStyle } from '../ui/widgets';
import { buildMerch } from './clubMerch';
import { buildOffice } from './clubOffice';
import { buildDoctor, buildScout, buildSquad } from './clubStars';
import { buildTraining } from './clubTraining';
import type { ClubHost } from './clubUi';
import type { StadiumScene } from './StadiumScene';

/** Top of the sheet; the concourse stays visible (dimmed) above it. */
const SHEET_TOP = 360;

/**
 * A stall's menu, shown as a bottom sheet over the walkable stadium. It reuses
 * the club booth builders (clubStars, clubOffice, clubTraining, clubMerch),
 * which lay out from CONTENT_Y downwards.
 */
export class StallPanelScene extends Phaser.Scene {
    private stall!: StallId;
    private sheet!: Phaser.GameObjects.Container;
    private content?: Phaser.GameObjects.Container;
    private closing = false;
    private leaving = false;

    constructor() {
        super('StallPanel');
    }

    init(data: { stall: StallId }): void {
        this.stall = data.stall;
        this.closing = false;
        this.leaving = false;
        this.content = undefined;
    }

    private get stadium(): StadiumScene {
        return this.scene.get('Stadium') as StadiumScene;
    }

    create(): void {
        // Tapping the dimmed concourse above the sheet closes it.
        const dim = this.add.rectangle(0, 0, GAME_WIDTH, SHEET_TOP, COLORS.ink, 0.35).setOrigin(0).setInteractive();
        dim.on('pointerup', () => this.close());

        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.25).fillRoundedRect(0, SHEET_TOP - 10, GAME_WIDTH, GAME_HEIGHT, 36);
        bg.fillStyle(COLORS.bg).fillRoundedRect(0, SHEET_TOP, GAME_WIDTH, GAME_HEIGHT, 36);
        bg.lineStyle(6, 0xffffff).strokeRoundedRect(3, SHEET_TOP + 3, GAME_WIDTH - 6, GAME_HEIGHT, 34);
        // The sheet swallows taps so they don't reach the concourse.
        const blocker = this.add.rectangle(0, SHEET_TOP, GAME_WIDTH, GAME_HEIGHT - SHEET_TOP, 0, 0).setOrigin(0).setInteractive();
        const title = this.add.text(36, SHEET_TOP + 46, stallDef(this.stall).label, textStyle(44)).setOrigin(0, 0.5);

        const close = this.add.container(GAME_WIDTH - 56, SHEET_TOP + 46);
        const cg = this.add.graphics();
        cg.fillStyle(COLORS.ink, 0.35).fillCircle(0, 4, 30);
        cg.fillStyle(COLORS.gateBad).fillCircle(0, 0, 30);
        cg.lineStyle(5, 0xffffff).strokeCircle(0, 0, 30);
        close.add([cg, this.add.text(0, -2, 'X', textStyle(34)).setOrigin(0.5)]);
        close.setSize(64, 64).setInteractive({ useHandCursor: true });
        close.on('pointerup', () => this.close());

        this.sheet = this.add.container(0, GAME_HEIGHT - SHEET_TOP, [bg, blocker, title, close]);
        this.tweens.add({ targets: this.sheet, y: 0, duration: 240, ease: 'Back.easeOut' });
        this.refresh();
    }

    private host(): ClubHost {
        return {
            scene: this,
            refresh: () => this.refresh(),
            // A panel asking for another stall (e.g. "visit the scout"): close, then walk there.
            showBooth: (b) => {
                this.close();
                this.stadium.walkTo(b);
            },
            isLeaving: () => this.leaving,
            coinsChanged: () => this.stadium.bumpCoins(),
            leave: (go) => {
                if (this.leaving) return;
                this.leaving = true;
                this.scene.stop('Stadium');
                go();
            },
            coinTarget: this.stadium.coinTarget
        };
    }

    private refresh(): void {
        this.content?.destroy(true);
        this.content = this.add.container(0, 0);
        this.sheet.add(this.content);
        const host = this.host();
        switch (this.stall) {
            case 'squad':
                buildSquad(host, this.content);
                break;
            case 'scout':
                buildScout(host, this.content);
                break;
            case 'doctor':
                buildDoctor(host, this.content);
                break;
            case 'training':
                buildTraining(host, this.content);
                break;
            case 'merch':
                buildMerch(host, this.content, 'Stadium');
                break;
            case 'office':
                buildOffice(host, this.content);
                break;
        }
        this.stadium.refreshHud();
    }

    /** Slides the sheet away and hands control back to the concourse. */
    close(): void {
        if (this.closing || this.leaving) return;
        this.closing = true;
        Sfx.play('click');
        this.tweens.add({
            targets: this.sheet,
            y: GAME_HEIGHT - SHEET_TOP,
            duration: 180,
            ease: 'Quad.easeIn',
            onComplete: () => {
                this.stadium.panelClosed();
                this.scene.stop();
            }
        });
    }
}
