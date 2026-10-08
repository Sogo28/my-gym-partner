import { describe, expect, it } from 'vitest';
import { anExercise, aWorkoutOf, useCleanDatabase } from '../../test/support';
import { findAll as findAllPlans } from '../infra/planned-workout-repository';
import {
  createPlannedWorkout,
  duplicateWorkout,
  retargetPlannedSet,
  updatePlannedWorkout,
} from './create-planned-workout';
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

  it('garde le rythme imposé d un exercice d un enregistrement à l autre', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 1);

    await updatePlannedWorkout({
      workout: plan,
      name: 'Grease the groove',
      exercises: [
        {
          exerciseId: exercise.id,
          // Trois rounds d'une minute : le nombre de rounds est le nombre de
          // séries, seul l'intervalle s'ajoute.
          sets: [
            { targets: { duration: 15 } },
            { targets: { duration: 15 } },
            { targets: { duration: 15 } },
          ],
          intervalSeconds: 60,
        },
      ],
    });

    const [reloaded] = await findAllPlans();
    expect(reloaded.exercises[0].intervalSeconds).toBe(60);
    expect(reloaded.exercises[0].sets).toHaveLength(3);
  });

  it('revient aux séries libres quand le rythme imposé est retiré', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 1);

    await updatePlannedWorkout({
      workout: plan,
      name: 'En EMOM',
      exercises: [
        { exerciseId: exercise.id, sets: [{ targets: { duration: 15 } }], intervalSeconds: 60 },
      ],
    });
    await updatePlannedWorkout({
      workout: plan,
      name: 'En séries',
      exercises: [{ exerciseId: exercise.id, sets: [{ targets: { duration: 15 } }] }],
    });

    const [reloaded] = await findAllPlans();
    expect(reloaded.exercises[0].intervalSeconds).toBeNull();
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

describe('Changer la cible d une série prévue', () => {
  it('ne touche que cette série', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 3);

    await retargetPlannedSet({
      workoutId: plan.id,
      position: 0,
      setIndex: 1,
      targets: { duration: 42 },
    });

    const [reloaded] = await findAllPlans();
    expect(reloaded.exercises[0].sets.map((set) => set.targets)).toEqual([
      plan.exercises[0].sets[0].targets,
      { duration: 42 },
      plan.exercises[0].sets[2].targets,
    ]);
  });

  it('refuse une série qui n existe pas', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 1);

    await expect(
      retargetPlannedSet({ workoutId: plan.id, position: 0, setIndex: 4, targets: { duration: 5 } }),
    ).rejects.toThrow(/n'existe plus/);
  });
});
