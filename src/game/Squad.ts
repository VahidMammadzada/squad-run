import { PITCH_LEFT, PITCH_RIGHT } from '../config';

/**
 * The striker plus the crowd following them, as game state. `count` includes
 * the striker. Drawing lives in three/SquadView.
 */
export class Squad {
    count: number;
    /** Leader's position across the pitch, in pitch pixels. */
    x: number;
    /** Where steering wants the leader to be; x eases towards it. */
    targetX: number;

    constructor(x: number, count: number) {
        this.x = this.targetX = x;
        this.count = count;
    }

    static clampX(x: number): number {
        return Math.max(PITCH_LEFT + 20, Math.min(PITCH_RIGHT - 20, x));
    }

    update(dt: number): void {
        this.x += (this.targetX - this.x) * (1 - Math.exp(-14 * dt));
    }
}
