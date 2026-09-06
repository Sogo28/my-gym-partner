import { beforeEach } from 'vitest';
import { __clearData } from './fake-expo-sqlite';
import { getDatabase } from '../src/infra/db';
import { createExercise } from '../src/use-cases/create-exercise';
import { createPlannedWorkout } from '../src/use-cases/create-planned-workout';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { PlannedWorkout } from '../src/domain/planned-workout/planned-workout';

/**
 * Chaque test repart d'une base vide mais migrée : le schéma est celui de la
 * production, seules les données disparaissent.
 */
export function useCleanDatabase(): void {
  beforeEach(async () => {
    // Le premier appel joue les migrations ; les suivants ne font que
    // récupérer la même base.
    await getDatabase();
    __clearData();
  });
}

/** Un exercice mesuré en secondes, comme une tenue de Front Lever. */
export function anExercise(name = 'Advanced Tuck', measurementIds = ['duration']): Promise<Exercise> {
  return createExercise({ name, isUnilateral: false, measurementIds });
}

/** Un entraînement d'un exercice, avec `sets` séries visant chacune `target`. */
export function aWorkoutOf(
  exerciseId: string,
  sets: number,
  measurementId = 'duration',
  target = 10,
): Promise<PlannedWorkout> {
  return createPlannedWorkout({
    name: 'Pull day',
    exercises: [
      {
        exerciseId,
        sets: Array.from({ length: sets }, () => ({ targets: { [measurementId]: target } })),
      },
    ],
  });
}
