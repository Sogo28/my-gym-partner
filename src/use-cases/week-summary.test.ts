import { describe, expect, it } from 'vitest';
import { anExercise, aWorkoutOf, useCleanDatabase } from '../../test/support';
import { findSessionsOn } from '../infra/session-history';
import { updateExercise } from './edit-catalogue';
import { startOfWeek, summarizeWeek } from './week-summary';
import {
  abandonPerformanceSet,
  cancelWorkoutSession,
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
      isUnilateral: exercise.isUnilateral,
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

/**
 * Ce qui a été FAIT un jour donné.
 *
 * Le piège que ce projection écarte : chercher les séances d'un jour parmi les
 * séances PROGRAMMÉES. Une séance libre n'a jamais été programmée, et le
 * calendrier ne la connaît donc pas -- alors que le schéma des muscles, lui,
 * la voyait. Les deux se contredisaient sur le même jour.
 */
describe('Les séances d un jour', () => {
  it('trouve une séance libre, que nul calendrier ne connaît', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 10 } });
    await finishWorkoutSession();

    const [found] = await findSessionsOn(new Date());

    expect(found.plannedWorkoutId).toBeNull();
    expect(found.completedSets).toBe(1);
  });

  it('retient l entraînement quand la séance en vient', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 2);
    await startWorkoutSession(plan.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 10 } });
    await finishWorkoutSession();

    expect((await findSessionsOn(new Date()))[0].plannedWorkoutId).toBe(plan.id);
  });

  it('ignore une séance ouverte sans rien valider', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await abandonPerformanceSet();
    await finishWorkoutSession();

    // Même règle que les carrés du calendrier : sans série validée, on n'a
    // pas entraîné.
    expect(await findSessionsOn(new Date())).toHaveLength(0);
  });

  it('ignore une séance annulée, même avec des séries validées', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 10 } });
    await cancelWorkoutSession();

    expect(await findSessionsOn(new Date())).toHaveLength(0);
  });

  it('ne regarde que le jour demandé', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 10 } });
    await finishWorkoutSession();

    const hier = new Date();
    hier.setDate(hier.getDate() - 1);

    expect(await findSessionsOn(hier)).toHaveLength(0);
  });
});
