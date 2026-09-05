import { randomUUID } from 'expo-crypto';
import type { ExerciseId } from '../domain/exercise/exercise';
import type { MeasurementId } from '../domain/exercise/measurement';
import {
  PlannedWorkout,
  type PlannedExercise,
} from '../domain/planned-workout/planned-workout';
import { assertTargetsAreMeasurable } from '../domain/planned-workout/target-rules';
import { findAll as findAllExercises } from '../infra/exercise-repository';
import { save } from '../infra/planned-workout-repository';

/**
 * Use case CreatePlannedWorkout (§27).
 *
 * C'est ici que vit la règle qui traverse DEUX agrégats : une série ne peut
 * cibler que les mesures de son exercice. PlannedWorkout ne peut pas la
 * vérifier lui-même, il ne connaît que des identifiants d'exercices -- et
 * c'est très bien ainsi : s'il tenait les Exercise, il pourrait les modifier
 * et la frontière entre agrégats n'existerait plus.
 *
 * Le use case, lui, a le droit de charger les deux et de les confronter.
 * C'est sa raison d'être : orchestrer, pas contenir des règles internes.
 */
export async function createPlannedWorkout(input: {
  name: string;
  exercises: readonly PlannedExercise[];
}): Promise<PlannedWorkout> {
  const measurementsByExercise = new Map<ExerciseId, readonly MeasurementId[]>(
    (await findAllExercises()).map((exercise) => [exercise.id, exercise.measurementIds]),
  );

  assertTargetsAreMeasurable(input.exercises, measurementsByExercise);

  // Les règles internes à l'agrégat (nom non vide, cibles positives...) sont
  // vérifiées par le domaine lui-même, à la construction.
  const workout = PlannedWorkout.create({ id: randomUUID(), ...input });

  await save(workout);
  return workout;
}
