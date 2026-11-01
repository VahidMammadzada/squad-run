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
    bg: 0x0d2b12,
    grassA: 0x3f9b3f,
    grassB: 0x47a847,
    line: 0xffffff,
    gateGood: 0x29b6f6,
    gateBad: 0xef5350,
    defender: 0x37474f,
    coin: 0xffc107,
    coinInner: 0xffe082,
    keeper: 0x111111,
    keeperTrim: 0xffeb3b,
    button: 0x43a047,
    buttonAlt: 0x1e88e5,
    panel: 0x10301a,
    gold: 0xffeb3b
} as const;
