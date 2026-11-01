export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

/** Playable width of the pitch, between the touchlines. */
export const PITCH_LEFT = 60;
export const PITCH_RIGHT = 660;
export const PITCH_CENTER = (PITCH_LEFT + PITCH_RIGHT) / 2;

/** Screen y where the squad leader sits while running. */
export const PLAYER_SCREEN_Y = 900;

export const START_SQUAD = 5;
export const MAX_SQUAD = 999;
/** Squad members beyond this are counted but not drawn. */
export const MAX_VISIBLE_MATES = 80;

export const FONT = '"Arial Black", "Arial Bold", Arial, sans-serif';

export const COLORS = {
    bg: 0x2f8cff,
    /** Dark navy for outlines, shadows and panels (softer than black). */
    ink: 0x1b2a5c,
    skyTop: 0x2f9cf4,
    skyHorizon: 0xc9ecff,
    grassA: 0x5fd35f,
    grassB: 0x4fc24f,
    line: 0xffffff,
    gateGood: 0x1e90ff,
    gateBad: 0xff3b3b,
    defender: 0x23232f,
    coin: 0xffc928,
    coinInner: 0xfff3a0,
    coinRim: 0xe08a00,
    keeper: 0x111111,
    keeperTrim: 0xffeb3b,
    button: 0x3ddc4a,
    buttonAlt: 0x2f8cff,
    buttonAccent: 0xff9f1a,
    panel: 0x23356f,
    gold: 0xffd21f
} as const;
