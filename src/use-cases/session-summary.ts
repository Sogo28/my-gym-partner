import type { PerformanceSet } from '../domain/performance/exercise-performance';
import {
  restBeforeEachSet,
  sessionDuration,
  totalRest,
} from '../domain/workout-session/session-metrics';
import type { WorkoutSession } from '../domain/workout-session/workout-session';
import { findByIds } from '../infra/performance-repository';
import {
  findAll as findAllSessions,
  findById as findSessionById,
} from '../infra/workout-session-repository';

export type CompletedSetSummary = {
  readonly set: PerformanceSet;
  /**
   * Son rang parmi TOUTES les séries de la performance, abandons compris.
   *
   * C'est cet index qu'attend le domaine pour corriger la série. Le calculer
   * dans la vue, qui n'affiche que les séries validées, désignerait la
   * mauvaise dès qu'un abandon s'intercale.
   */
  readonly index: number;
  /** Le repos pris avant elle, null pour la première. */
  readonly restBefore: number | null;
};

export type ActivitySummary = {
  readonly exerciseId: string;
  readonly performanceId: string | null;
  /** Les mesures figées au moment de la performance. */
  readonly measurementIds: readonly string[];
  /** Seules les séries validées : les autres ne sont pas des performances. */
  readonly completedSets: readonly CompletedSetSummary[];
};

export type SessionSummary = {
  readonly session: WorkoutSession;
  /** En secondes ; null tant que la séance n'est pas terminée. */
  readonly duration: number | null;
  readonly restTotal: number;
  readonly completedSetCount: number;
  readonly activities: readonly ActivitySummary[];
};

/**
 * GetWorkoutSessionSummary (§29).
 *
 * Le résumé est CALCULÉ, jamais stocké (§23) : il dérive des performances, et
 * les recalculer coûte moins cher que de les maintenir en double.
 *
 * Ce travail vivait dans l'écran d'historique, donc hors de portée des tests.
 */
export async function listSessionSummaries(): Promise<SessionSummary[]> {
  const sessions = await findAllSessions();

  // Toutes les performances en un appel, jamais une par activité.
  const performanceIds = sessions
    .flatMap((session) => session.activities)
    .map((activity) => activity.performanceId)
    .filter((id): id is string => id !== null);

  const performances = await findByIds(performanceIds);

  return sessions.map((session) => summarize(session, performances));
}

/**
 * Le résumé d'UNE séance : celui qu'on regarde en la terminant.
 *
 * Ciblé plutôt que filtré sur l'historique entier -- une séance ne devrait
 * pas coûter la lecture de toutes les autres.
 */
export async function findSessionSummary(sessionId: string): Promise<SessionSummary | null> {
  const session = await findSessionById(sessionId);
  if (!session) return null;

  const performanceIds = session.activities
    .map((activity) => activity.performanceId)
    .filter((id): id is string => id !== null);

  return summarize(session, await findByIds(performanceIds));
}

function summarize(
  session: WorkoutSession,
  performances: Awaited<ReturnType<typeof findByIds>>,
): SessionSummary {
  const activities = session.activities.map((activity): ActivitySummary => {
    const performance = activity.performanceId
      ? performances.get(activity.performanceId)
      : undefined;
    const completed = performance?.completedSets ?? [];
    // Repos et séries n'ont aucun lien direct : on les rapproche par les
    // instants (voir session-metrics).
    const rests = restBeforeEachSet(completed, session.rests);

    return {
      exerciseId: activity.exerciseId,
      performanceId: activity.performanceId,
      measurementIds: performance?.measurementIds ?? [],
      completedSets: completed.map((set, position) => ({
        set,
        index: performance?.sets.indexOf(set) ?? position,
        restBefore: rests[position],
      })),
    };
  });

  return {
    session,
    duration: sessionDuration(session),
    restTotal: totalRest(session),
    completedSetCount: activities.reduce(
      (total, activity) => total + activity.completedSets.length,
      0,
    ),
    activities,
  };
}
