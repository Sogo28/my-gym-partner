import { describe, expect, it } from 'vitest';
import { anExercise, aWorkoutOf, useCleanDatabase } from '../../test/support';
import { findAll as findAllExercises } from '../infra/exercise-repository';
import { findAll as findAllWorkouts } from '../infra/planned-workout-repository';
import { discardExercise, discardWorkout, listActiveExercises, updateExercise } from './edit-catalogue';
import { startActivity, startWorkoutSession } from './workout-session-actions';

/**
 * Retirer du catalogue : c'est la BASE qui décide entre archiver et
 * supprimer, en regardant si quelque chose référence l'élément. La règle ne
 * peut donc s'éprouver qu'avec une vraie base.
 */
useCleanDatabase();

describe('Retirer un exercice', () => {
  it('le supprime réellement quand rien ne le référence', async () => {
    const exercise = await anExercise();

    expect(await discardExercise(exercise)).toBe('deleted');
    expect(await findAllExercises()).toHaveLength(0);
  });

  it('l archive dès qu un entraînement s en sert', async () => {
    const exercise = await anExercise();
    await aWorkoutOf(exercise.id, 3);

    expect(await discardExercise(exercise)).toBe('archived');

    const all = await findAllExercises();
    expect(all).toHaveLength(1);
    expect(all[0].isArchived).toBe(true);
  });

  it('l archive dès qu une séance l a travaillé', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);

    expect(await discardExercise(exercise)).toBe('archived');
  });

  it('le retire des listes de choix sans effacer son passé', async () => {
    const exercise = await anExercise();
    await aWorkoutOf(exercise.id, 2);
    await discardExercise(exercise);

    expect(await listActiveExercises()).toHaveLength(0);
    // Mais il existe toujours, pour nommer ce qu'il a produit.
    expect(await findAllExercises()).toHaveLength(1);
  });
});

describe('Retirer un entraînement', () => {
  it('le supprime quand aucune séance n en est issue', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 3);

    expect(await discardWorkout(plan)).toBe('deleted');
    expect(await findAllWorkouts()).toHaveLength(0);
  });

  it('l archive dès qu une séance en est issue', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 3);
    await startWorkoutSession(plan.id);

    expect(await discardWorkout(plan)).toBe('archived');
    expect((await findAllWorkouts())[0].isArchived).toBe(true);
  });
});

describe('Muscles d un exercice', () => {
  it('garde le principal et les secondaires distincts jusqu en base', async () => {
    const exercise = await anExercise();

    await updateExercise({
      exercise,
      name: exercise.name,
      measurementIds: [...exercise.measurementIds],
      primaryMuscleId: 'dos',
      secondaryMuscleIds: ['biceps', 'abdominaux'],
    });

    // Relu depuis SQLite : c'est le rôle stocké qui doit revenir, pas l'ordre
    // du catalogue des muscles.
    const [reloaded] = await findAllExercises();
    expect(reloaded.primaryMuscleId).toBe('dos');
    expect([...reloaded.secondaryMuscleIds].sort()).toEqual(['abdominaux', 'biceps']);
    expect(reloaded.muscleIds[0]).toBe('dos');
  });

  it('refuse de viser deux fois le même muscle', async () => {
    const exercise = await anExercise();

    await expect(
      updateExercise({
        exercise,
        name: exercise.name,
        measurementIds: [...exercise.measurementIds],
        primaryMuscleId: 'dos',
        secondaryMuscleIds: ['dos'],
      }),
    ).rejects.toThrow();
  });
});
