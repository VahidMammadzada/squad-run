import { Rng } from '../util/random';
import {
    FIRST_NAMES,
    FITNESS_DRAIN,
    FITNESS_MAX,
    FITNESS_RECOVER,
    HAIR_COLORS,
    INJURY_CHANCE,
    INJURY_RUNS,
    LAST_NAMES,
    MAX_POPULARITY,
    MAX_ROSTER,
    RELEASE_REFUND,
    SKILL_IDS,
    SKILLS,
    STAR_FAN_GATES,
    STAR_PRICES,
    TIRED_BELOW,
    TRANSFER_SIZE,
    type SkillDef,
    type SkillId
} from './balance';

export interface StarPlayer {
    id: string;
    name: string;
    popularity: number;
    skill: SkillId;
    fitness: number;
    /** Runs left before an injured star can play again; 0 = fit to play. */
    injuredLevels: number;
    hair: number;
    /** Coins paid on signing; release refunds half. */
    paid: number;
}

export function skillDef(id: SkillId): SkillDef {
    return SKILLS.find((s) => s.id === id)!;
}

export function starPrice(popularity: number): number {
    return STAR_PRICES[clampPop(popularity)];
}

export function fanGate(popularity: number): number {
    return STAR_FAN_GATES[clampPop(popularity)];
}

export function releaseRefund(star: StarPlayer): number {
    return Math.floor(star.paid * RELEASE_REFUND);
}

function clampPop(p: number): number {
    return Math.min(MAX_POPULARITY, Math.max(1, Math.floor(p)));
}

/** Highest popularity the scout can find at this level. */
export function maxScoutPopularity(level: number): number {
    return Math.min(MAX_POPULARITY, 2 + Math.floor(level / 5));
}

/** The scout's list: deterministic for a seed, so reloading shows the same players. */
export function generateCandidates(seed: number, level: number): StarPlayer[] {
    const rng = new Rng(seed * 7919 + 13);
    const top = maxScoutPopularity(level);
    return Array.from({ length: TRANSFER_SIZE }, (_, i) => {
        // Always one cheap pick; the rest spread up to the top popularity on offer.
        const popularity = i === 0 ? 1 : rng.int(1, top);
        const name = `${FIRST_NAMES[rng.int(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[rng.int(0, LAST_NAMES.length - 1)]}`;
        return {
            id: `s${seed}-${i}`,
            name,
            popularity,
            skill: SKILL_IDS[rng.int(0, SKILL_IDS.length - 1)],
            fitness: FITNESS_MAX,
            injuredLevels: 0,
            hair: HAIR_COLORS[rng.int(0, HAIR_COLORS.length - 1)],
            paid: 0
        };
    });
}

export type SignCheck = 'ok' | 'full' | 'fans' | 'coins' | 'signed';

export function canSign(star: StarPlayer, coins: number, fans: number, roster: readonly StarPlayer[]): SignCheck {
    if (roster.some((s) => s.id === star.id)) return 'signed';
    if (roster.length >= MAX_ROSTER) return 'full';
    if (fans < fanGate(star.popularity)) return 'fans';
    if (coins < starPrice(star.popularity)) return 'coins';
    return 'ok';
}

export function isAvailable(star: StarPlayer): boolean {
    return star.injuredLevels <= 0;
}

export function isTired(star: StarPlayer): boolean {
    return star.fitness < TIRED_BELOW;
}

/** True when a game over injures the active star; `random` is in [0, 1). */
export function rollInjury(random: number): boolean {
    return random < INJURY_CHANCE;
}

/**
 * One run played: the active star tires (and may get injured), benched stars
 * recover, injuries count down. Returns a new roster.
 */
export function tickRun(roster: readonly StarPlayer[], activeId: string | null, injured: boolean): StarPlayer[] {
    return roster.map((star) => {
        const s = { ...star };
        const playing = s.id === activeId && isAvailable(star);
        if (s.injuredLevels > 0) s.injuredLevels--;
        if (playing) {
            s.fitness = Math.max(0, s.fitness - FITNESS_DRAIN);
            if (injured) s.injuredLevels = INJURY_RUNS;
        } else {
            s.fitness = Math.min(FITNESS_MAX, s.fitness + FITNESS_RECOVER);
        }
        return s;
    });
}
