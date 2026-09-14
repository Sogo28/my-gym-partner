import type { PlannedWorkout } from '../domain/planned-workout/planned-workout';
import { formatTargets } from '../ui/set-values';

/**
 * Un entraînement en texte brut, pour le partager hors de l'app.
 *
 * Un exercice sans série prévue le dit plutôt que de laisser un titre seul :
 * la fiche elle-même l'affiche ainsi.
 */
export function describeWorkout(
  workout: PlannedWorkout,
  nameOf: (exerciseId: string) => string,
  unitOf: (measurementId: string) => string,
): string {
  const totalSets = workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

  const lines = [
    workout.name,
    `${workout.exercises.length} exercice${workout.exercises.length > 1 ? 's' : ''} · ${totalSets} série${totalSets > 1 ? 's' : ''}`,
    '',
  ];

  workout.exercises.forEach((exercise, index) => {
    lines.push(`${index + 1}. ${nameOf(exercise.exerciseId)}`);
    if (exercise.sets.length === 0) {
      lines.push('   aucune série prévue');
    } else {
      exercise.sets.forEach((set, setIndex) => {
        lines.push(`   ${setIndex + 1}. ${formatTargets(set.targets, unitOf)}`);
      });
    }
  });

  return lines.join('\n');
}
