import { findAll as findAllExercises, isReferenced, remove } from '../infra/exercise-repository';
import {
  findAll as findAllWorkouts,
  isReferenced as isWorkoutReferenced,
  remove as removeWorkout,
  save as saveWorkout,
} from '../infra/planned-workout-repository';
import { save as saveExercise } from '../infra/exercise-repository';
import type { Exercise } from '../domain/exercise/exercise';
import type { MeasurementId } from '../domain/exercise/measurement';
import type { PlannedWorkout } from '../domain/planned-workout/planned-workout';

/**
 * UpdateExercise (§26).
 *
 * Modifier la définition ne touche à aucune performance : chacune a copié ses
 * mesures au moment où elle a eu lieu (§2).
 */
export async function updateExercise(input: {
  exercise: Exercise;
  name: string;
  measurementIds: readonly MeasurementId[];
}): Promise<Exercise> {
  input.exercise.rename(input.name);
  input.exercise.changeMeasurements(input.measurementIds);
  await saveExercise(input.exercise);
  return input.exercise;
}

/**
 * Retirer un exercice du catalogue.
 *
 * S'il a déjà servi -- un entraînement, une séance, une performance, un
 * objectif -- il est ARCHIVÉ : le supprimer romprait le lien avec des faits
 * qui ont bien eu lieu. Sinon, il est réellement supprimé.
 *
 * C'est la base qui répond à la question "a-t-il servi ?", pas une hypothèse.
 */
export async function discardExercise(
  exercise: Exercise,
): Promise<'archived' | 'deleted'> {
  if (await isReferenced(exercise.id)) {
    exercise.archive();
    await saveExercise(exercise);
    return 'archived';
  }

  await remove(exercise.id);
  return 'deleted';
}

export async function unarchiveExercise(exercise: Exercise): Promise<void> {
  exercise.unarchive();
  await saveExercise(exercise);
}

/** Même règle pour un entraînement : archivé s'il a produit des séances. */
export async function discardWorkout(
  workout: PlannedWorkout,
): Promise<'archived' | 'deleted'> {
  if (await isWorkoutReferenced(workout.id)) {
    workout.archive();
    await saveWorkout(workout);
    return 'archived';
  }

  await removeWorkout(workout.id);
  return 'deleted';
}

export async function unarchiveWorkout(workout: PlannedWorkout): Promise<void> {
  workout.unarchive();
  await saveWorkout(workout);
}

export async function renameWorkout(workout: PlannedWorkout, name: string): Promise<void> {
  workout.rename(name);
  await saveWorkout(workout);
}

/** Ce que les écrans de choix doivent proposer : le catalogue vivant. */
export async function listActiveExercises(): Promise<Exercise[]> {
  return (await findAllExercises()).filter((exercise) => !exercise.isArchived);
}

export async function listActiveWorkouts(): Promise<PlannedWorkout[]> {
  return (await findAllWorkouts()).filter((workout) => !workout.isArchived);
}
