import type { PerformanceSet } from '../performance/exercise-performance';
import type { Rest, WorkoutSession } from './workout-session';

/**
 * Métriques dérivées (§23) : calculées à partir des performances enregistrées,
 * jamais persistées comme des entités. Elles croisent la séance et les
 * performances, donc elles n'appartiennent à aucun des deux agrégats.
 *
 * Toutes les durées sont en secondes.
 */

/** Durée totale de la séance, null tant qu'elle n'est pas terminée. */
export function sessionDuration(session: WorkoutSession): number | null {
  if (!session.endedAt) return null;
  return seconds(session.startedAt, session.endedAt);
}

/** Temps passé en récupération : seuls les repos terminés sont comptés. */
export function totalRest(session: WorkoutSession): number {
  return session.rests.reduce(
    (total, rest) => total + (rest.endedAt ? seconds(rest.startedAt, rest.endedAt) : 0),
    0,
  );
}

/**
 * Le repos pris avant chaque série.
 *
 * Aucun lien direct n'existe entre un repos et une série -- c'est le prix de
 * leur indépendance (n°19). On les rapproche donc par le temps : on additionne
 * les repos qui tombent entre la fin de la série précédente et le début de
 * celle-ci. Passer par un intervalle plutôt que par le repos "le plus proche"
 * évite les faux rapprochements quand l'utilisateur enchaîne librement.
 *
 * La première série n'a pas de repos avant elle : null.
 */
export function restBeforeEachSet(
  sets: readonly PerformanceSet[],
  rests: readonly Rest[],
): (number | null)[] {
  return sets.map((set, index) => {
    const previousEnd = index === 0 ? null : sets[index - 1].endedAt;
    if (!previousEnd) return null;

    const total = rests
      .filter(
        (rest) =>
          rest.endedAt !== null &&
          rest.startedAt >= previousEnd &&
          rest.endedAt <= set.startedAt,
      )
      .reduce((sum, rest) => sum + seconds(rest.startedAt, rest.endedAt!), 0);

    return total;
  });
}

function seconds(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 1000);
}
