import { describe, expect, it } from 'vitest';
import { anExercise, aWorkoutOf, useCleanDatabase } from '../../test/support';
import { findAll as findAllPlans } from '../infra/planned-workout-repository';
import { createPlannedWorkout, duplicateWorkout, updatePlannedWorkout } from './create-planned-workout';
import { listSessionSummaries } from './session-summary';
import {
  completePerformanceSet,
  finishWorkoutSession,
  startPerformanceSet,
  startWorkoutSession,
} from './workout-session-actions';

useCleanDatabase();

describe('Modifier un entraînement', () => {
  it('remplace son nom et son contenu', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 3);

    await updatePlannedWorkout({
      workout: plan,
      name: 'Push day',
      exercises: [{ exerciseId: exercise.id, sets: [{ targets: { duration: 15 } }] }],
    });

    const [reloaded] = await findAllPlans();
    expect(reloaded.name).toBe('Push day');
    expect(reloaded.exercises[0].sets).toHaveLength(1);
    expect(reloaded.exercises[0].sets[0].targets).toEqual({ duration: 15 });
  });

  it('ne touche à aucune séance déjà enregistrée', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 2);

    await startWorkoutSession(plan.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 12 } });
    await finishWorkoutSession();

    // Le plan change après coup : la séance dit ce qui a été fait, pas ce
    // qui était prévu.
    await updatePlannedWorkout({
      workout: plan,
      name: 'Autre chose',
      exercises: [{ exerciseId: exercise.id, sets: [{ targets: { duration: 30 } }] }],
    });

    const [summary] = await listSessionSummaries();
    expect(summary.completedSetCount).toBe(1);
    expect(summary.activities[0].completedSets[0].set.values).toEqual({ BOTH: { duration: 12 } });
  });

  it('refuse une cible qui ne correspond pas aux mesures de l exercice', async () => {
    const exercise = await anExercise('Advanced Tuck', ['duration']);
    const plan = await aWorkoutOf(exercise.id, 1);

    // La règle croisée vaut pour toute écriture, pas seulement la première.
    await expect(
      updatePlannedWorkout({
        workout: plan,
        name: 'Pull day',
        exercises: [{ exerciseId: exercise.id, sets: [{ targets: { reps: 8 } }] }],
      }),
    ).rejects.toThrow(/ne se mesure pas/);
  });

  it('accepte de garder son propre nom', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 1);

    await expect(
      updatePlannedWorkout({
        workout: plan,
        name: plan.name,
        exercises: [{ exerciseId: exercise.id, sets: [{ targets: { duration: 20 } }] }],
      }),
    ).resolves.not.toThrow();
  });

  it('refuse le nom d un autre entraînement', async () => {
    const exercise = await anExercise();
    await createPlannedWorkout({
      name: 'Push day',
      exercises: [{ exerciseId: exercise.id, sets: [{ targets: { duration: 10 } }] }],
    });
    const plan = await aWorkoutOf(exercise.id, 1);

    await expect(
      updatePlannedWorkout({
        workout: plan,
        name: 'Push day',
        exercises: plan.exercises,
      }),
    ).rejects.toThrow(/s'appelle déjà/);
  });
});

describe('Dupliquer un entraînement', () => {
  it('reprend le contenu sous un autre nom', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 3, 'duration', 15);

    const copy = await duplicateWorkout({ workout: plan, name: 'Pull day copie' });

    expect(copy.name).toBe('Pull day copie');
    expect(copy.exercises).toEqual(plan.exercises);
  });

  it('refuse un nom déjà pris', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 1);

    await expect(duplicateWorkout({ workout: plan, name: plan.name })).rejects.toThrow(
      /s'appelle déjà/,
    );
  });
});

describe('Créer un entraînement', () => {
  it('refuse une cible étrangère à l exercice', async () => {
    const exercise = await anExercise('Advanced Tuck', ['duration']);

    await expect(
      createPlannedWorkout({
        name: 'Pull day',
        exercises: [{ exerciseId: exercise.id, sets: [{ targets: { weight: 20 } }] }],
      }),
    ).rejects.toThrow(/ne se mesure pas/);
  });

  it('refuse un nom déjà pris, insensible à la casse et aux accents', async () => {
    const exercise = await anExercise();
    await aWorkoutOf(exercise.id, 1);

    await expect(
      createPlannedWorkout({
        name: 'PULL DAY',
        exercises: [{ exerciseId: exercise.id, sets: [{ targets: { duration: 10 } }] }],
      }),
    ).rejects.toThrow(/s'appelle déjà/);
  });
});
