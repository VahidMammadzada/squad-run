import * as Phaser from 'phaser';
import { Sfx } from '../audio/Sfx';
import { PITCH_CENTER } from '../config';
import { GOAL_HALF_WIDTH, type World3D } from '../three/World3D';
import { playersPerGoal } from './scoring';
import { planShootout } from './shootoutPlan';

interface ShootoutCallbacks {
    /** The squad shrinks as players are spent on shots. */
    onSquad: (count: number) => void;
    onScore: (goalsSoFar: number) => void;
    onDone: (goals: number) => void;
}

/** The end-of-level charge on goal, played out from `planShootout`. */
export function runShootout(scene: Phaser.Scene, world: World3D, squadCount: number, level: number, cb: ShootoutCallbacks): void {
    const perGoal = playersPerGoal(level);
    const { goals, worth, interval } = planShootout(squadCount, level);
    const shots = worth.length;
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
