import { describe, expect, it } from 'vitest';
import { anExercise, useCleanDatabase } from '../../test/support';
import { findAll as findAllWorkouts } from '../infra/planned-workout-repository';
import { createWorkoutFromSession, plannedExercisesOf } from './workout-from-session';
import {
  abandonPerformanceSet,
  completePerformanceSet,
  finishActivity,
  finishWorkoutSession,
  markActivityAsEmom,
  startActivity,
  startPerformanceSet,
  startWorkoutSession,
} from './workout-session-actions';

useCleanDatabase();

describe('Un entraînement tiré d une séance', () => {
  it('reprend chaque série faite, avec ce qui a été fait pour cible', async () => {
    const pullUp = await anExercise('Pull-up', ['reps']);
    const hold = await anExercise('Tuck', ['duration']);
    const session = await startWorkoutSession();
    await startActivity(pullUp.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { reps: 8 } });
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { reps: 6 } });
    // Abandonnée : elle ne dit pas ce qu'on sait faire.
    await startPerformanceSet();
    await abandonPerformanceSet();
    await finishActivity();
    await startActivity(hold.id);
    await startPerformanceSet();
    await completePerformanceSet({ LEFT: { duration: 12 }, RIGHT: { duration: 9 } });
    await finishWorkoutSession();

    expect(await plannedExercisesOf(session.id)).toEqual([
      { exerciseId: pullUp.id, sets: [{ targets: { reps: 8 } }, { targets: { reps: 6 } }], intervalSeconds: null },
      // Des deux côtés : le plus faible.
      { exerciseId: hold.id, sets: [{ targets: { duration: 9 } }], intervalSeconds: null },
    ]);

    const workout = await createWorkoutFromSession({ sessionId: session.id, name: 'Mardi' });
    expect((await findAllWorkouts()).map((w) => w.name)).toEqual(['Mardi']);
    expect(workout.exercises).toHaveLength(2);
  });

  it('garde le rythme d un EMOM lancé en séance libre', async () => {
    const pullUp = await anExercise('Pull-up', ['reps']);
    const session = await startWorkoutSession();
    await startActivity(pullUp.id);
    await startPerformanceSet();
    await markActivityAsEmom(60);
    await completePerformanceSet({ BOTH: { reps: 5 } });
    await finishWorkoutSession();

    const [exercise] = await plannedExercisesOf(session.id);
    expect(exercise.intervalSeconds).toBe(60);
  });

  it('refuse une séance sans aucune série faite', async () => {
    const exercise = await anExercise();
    const session = await startWorkoutSession();
    await startActivity(exercise.id);
    await finishWorkoutSession();

    await expect(createWorkoutFromSession({ sessionId: session.id, name: 'Vide' })).rejects.toThrow(
      /Aucune série/,
    );
  });
});
