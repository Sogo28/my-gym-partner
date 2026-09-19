import type { PlannedWorkout } from '../domain/planned-workout/planned-workout';
import { formatEmomPace, formatTargets } from '../ui/set-values';

/**
 * Une espace INSÉCABLE, pas une espace ordinaire.
 *
 * SMS, mail, notes... la plupart des destinataires rendent le texte comme du
 * HTML, qui réduit toute suite d'espaces normales à une seule : l'indentation
 * disparaissait purement et simplement à l'arrivée. Une insécable n'est
 * jamais fondue de cette façon.
 */
const INDENT = '   ';

/**
 * Un entraînement en texte brut, pour le partager hors de l'app.
 *
 * Un exercice sans série prévue le dit plutôt que de laisser un titre seul :
 * la fiche elle-même l'affiche ainsi. Une ligne vide sépare les exercices :
 * même sans l'indentation, la liste reste lisible.
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
  ];

  workout.exercises.forEach((exercise, index) => {
    lines.push('');
    lines.push(`${index + 1}. ${nameOf(exercise.exerciseId)}`);
    if (exercise.sets.length === 0) {
      lines.push(`${INDENT}aucune série prévue`);
    } else {
      // La cadence en tête, puis les rounds comme des séries : à l'arrivée,
      // c'est ainsi qu'on raconte un EMOM à quelqu'un.
      if (exercise.intervalSeconds) {
        lines.push(`${INDENT}${formatEmomPace(exercise.intervalSeconds)}`);
      }
      exercise.sets.forEach((set, setIndex) => {
        lines.push(`${INDENT}${setIndex + 1}. ${formatTargets(set.targets, unitOf)}`);
      });
    }
  });

  return lines.join('\n');
}
