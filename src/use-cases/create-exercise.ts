import { randomUUID } from 'expo-crypto';
import type { ExerciseMedia } from '../domain/exercise/media';
import { Exercise } from '../domain/exercise/exercise';
import type { MeasurementId } from '../domain/exercise/measurement';
import { save } from '../infra/exercise-repository';

/**
 * Use case CreateExercise (§26).
 *
 * C'est ici que l'identifiant est fabriqué -- pas dans le domaine, qui doit
 * rester déterministe et testable. UUID généré côté client, jamais un
 * auto-increment : c'est ce qui permettra à deux appareils de créer des
 * exercices hors ligne sans collision le jour où on ajoutera la synchronisation.
 */
export async function createExercise(input: {
  name: string;
  isUnilateral: boolean;
  measurementIds: readonly MeasurementId[];
  primaryMuscleId?: string | null;
  secondaryMuscleIds?: readonly string[];
  media?: readonly ExerciseMedia[];
}): Promise<Exercise> {
  // Les règles métier sont vérifiées ici, avant toute écriture :
  // une donnée invalide n'atteint jamais la base.
  const exercise = Exercise.create({ id: randomUUID(), ...input });

  await save(exercise);
  return exercise;
}
