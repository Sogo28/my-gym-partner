import type { ExerciseId } from '../exercise/exercise';
import type { MeasurementId } from '../exercise/measurement';
import type { PlannedExercise } from './planned-workout';
import { DomainError } from '../domain-error';

/**
 * Une règle métier qui traverse deux agrégats : une série ne peut cibler que
 * les mesures de son exercice.
 *
 * Elle n'appartient à aucun des deux -- PlannedWorkout ne tient pas les
 * Exercise, et Exercise ignore les entraînements. On l'écrit donc comme une
 * fonction du domaine, à part : ce que le DDD appelle un "service de domaine",
 * c'est-à-dire une règle métier sans objet naturel à qui l'attacher.
 *
 * Elle reçoit ce dont elle a besoin en paramètre plutôt que d'aller le
 * chercher : c'est ce qui la rend testable sans base de données.
 */
export function assertTargetsAreMeasurable(
  exercises: readonly PlannedExercise[],
  measurementsByExercise: ReadonlyMap<ExerciseId, readonly MeasurementId[]>,
): void {
  for (const planned of exercises) {
    const allowed = measurementsByExercise.get(planned.exerciseId);
    if (!allowed) {
      throw new DomainError("Cet exercice n'existe pas.");
    }
    for (const set of planned.sets) {
      for (const measurementId of Object.keys(set.targets)) {
        if (!allowed.includes(measurementId)) {
          throw new DomainError(
            `Cet exercice ne se mesure pas en "${measurementId}", la série ne peut pas le cibler.`,
          );
        }
      }
    }
  }
}
