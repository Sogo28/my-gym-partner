import { describe, expect, it } from 'vitest';
import { anExercise, useCleanDatabase } from '../../test/support';
import { updateExercise } from './edit-catalogue';
import { startOfWeek, summarizeWeek } from './week-summary';
import {
  abandonPerformanceSet,
  completePerformanceSet,
  finishWorkoutSession,
  startActivity,
  startPerformanceSet,
  startWorkoutSession,
} from './workout-session-actions';

useCleanDatabase();

describe('La semaine écoulée', () => {
  it('commence le lundi à zéro heure', () => {
    // Un mercredi, un dimanche : la même semaine.
    expect(startOfWeek(new Date('2026-09-09T18:00:00')).toDateString()).toBe(
      new Date('2026-09-07T00:00:00').toDateString(),
    );
    expect(startOfWeek(new Date('2026-09-13T23:59:00')).toDateString()).toBe(
      new Date('2026-09-07T00:00:00').toDateString(),
    );
  });

  it('retient les muscles des exercices travaillés, par rôle', async () => {
    const exercise = await anExercise();
    await updateExercise({
      exercise,
      name: exercise.name,
      measurementIds: [...exercise.measurementIds],
      primaryMuscleId: 'dos',
      secondaryMuscleIds: ['biceps'],
      media: [],
    });

    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 12 } });
    await finishWorkoutSession();

    const week = await summarizeWeek(new Date());
    expect(week.primaryMuscleIds).toEqual(['dos']);
    expect(week.secondaryMuscleIds).toEqual(['biceps']);
  });

  it('ne compte pas une séance où rien n a été validé', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await abandonPerformanceSet();
    await finishWorkoutSession();

    // Ouvrir une séance n'entraîne rien : l'accueil ne doit pas prétendre
    // le contraire.
    expect((await summarizeWeek(new Date())).exerciseCount).toBe(0);
  });
});
