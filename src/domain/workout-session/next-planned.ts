import type { Activity } from './workout-session';

/**
 * La prochaine position du programme à faire : la première qu'aucune activité
 * de la séance n'a encore occupée, ou null quand tout y est passé.
 *
 * Calculée sur ce qui a été FAIT, et non à partir de l'exercice en cours :
 * un exercice ajouté en route n'a pas de position, et « la suivante » ne
 * voulait alors plus rien dire -- le programme s'arrêtait là (décidé le
 * 2026-10-07 : on ajoute un exercice à tout moment, puis on reprend).
 */
export function nextPlannedPosition(
  activities: readonly Pick<Activity, 'plannedPosition'>[],
  plannedCount: number,
): number | null {
  const visited = new Set(activities.map((activity) => activity.plannedPosition));
  for (let position = 0; position < plannedCount; position++) {
    if (!visited.has(position)) return position;
  }
  return null;
}
