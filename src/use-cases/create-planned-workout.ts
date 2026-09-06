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
  await assertMeasurable(input.exercises);

  // Les règles internes à l'agrégat (nom non vide, cibles positives...) sont
  // vérifiées par le domaine lui-même, à la construction.
  const workout = PlannedWorkout.create({ id: randomUUID(), ...input });

  await save(workout);
  return workout;
}

/**
 * UpdatePlannedWorkout (§27).
 *
 * Modifier un entraînement ne touche à AUCUNE séance passée : celles-ci ont
 * enregistré ce qui a été fait, pas ce qui était prévu. Un plan corrigé
 * aujourd'hui ne réécrit donc pas l'histoire (§2).
 *
 * La même règle croisée qu'à la création s'applique : elle vaut pour toute
 * écriture, pas seulement pour la première.
 */
export async function updatePlannedWorkout(input: {
  workout: PlannedWorkout;
  name: string;
  exercises: readonly PlannedExercise[];
}): Promise<PlannedWorkout> {
  await assertMeasurable(input.exercises);

  input.workout.rename(input.name);
  input.workout.replaceExercises(input.exercises);

  await save(input.workout);
  return input.workout;
}

/** Une série ne peut cibler que les mesures de son exercice. */
async function assertMeasurable(exercises: readonly PlannedExercise[]): Promise<void> {
  const measurementsByExercise = new Map<ExerciseId, readonly MeasurementId[]>(
    (await findAllExercises()).map((exercise) => [exercise.id, exercise.measurementIds]),
  );

  assertTargetsAreMeasurable(exercises, measurementsByExercise);
}
