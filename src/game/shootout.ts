import * as Phaser from 'phaser';
import { Sfx } from '../audio/Sfx';
import { PITCH_CENTER } from '../config';
import { GOAL_HALF_WIDTH, type World3D } from '../three/World3D';
import { goalsFor, playersPerGoal } from './scoring';

/** Long shootouts are batched so the sequence never drags on. */
const MAX_SHOTS = 20;

interface ShootoutCallbacks {
    /** The squad shrinks as players are spent on shots. */
    onSquad: (count: number) => void;
    onScore: (goalsSoFar: number) => void;
    onDone: (goals: number) => void;
}

/**
 * The end-of-level charge on goal. Every `playersPerGoal` squad members score
 * one goal; a squad too small to score gets one shot that the keeper saves.
 */
export function runShootout(scene: Phaser.Scene, world: World3D, squadCount: number, level: number, cb: ShootoutCallbacks): void {
    const perGoal = playersPerGoal(level);
    const goals = goalsFor(squadCount, level);
    const shots = goals === 0 ? 1 : Math.min(goals, MAX_SHOTS);
    // Goals each shot is worth when batched.
    const worth = Array.from({ length: shots }, (_, i) => Math.floor(goals / shots) + (i < goals % shots ? 1 : 0));
    const interval = shots > 10 ? 220 : 380;
    let scored = 0;
    let count = squadCount;

    world.squad.hideBall();

    worth.forEach((value, i) => {
        scene.time.delayedCall(300 + i * interval, () => {
            const target = PITCH_CENTER + Phaser.Math.Between(-GOAL_HALF_WIDTH + 30, GOAL_HALF_WIDTH - 30);
            const isGoal = value > 0;

            if (isGoal) {
                count = Math.max(1, count - value * perGoal);
                cb.onSquad(count);
                // Keeper dives the wrong way.
                world.keeperTo(target < PITCH_CENTER ? PITCH_CENTER + 100 : PITCH_CENTER - 100, 260, true);
            } else {
                world.keeperTo(target, 240, true);
            }

            world.shoot(target, isGoal, () => {
                if (isGoal) {
                    scored += value;
                    cb.onScore(scored);
                    world.flashNet();
                    Sfx.play('goal');
                } else {
                    Sfx.play('save');
                }
            });
        });
    });

    scene.time.delayedCall(300 + shots * interval + 900, () => cb.onDone(goals));
}
