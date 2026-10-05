import type { PerformanceSet } from '../domain/performance/exercise-performance';
import { recordsBeaten, type BeatenRecord } from '../domain/performance/records';
import {
  restBeforeEachSet,
  sessionDuration,
  totalRest,
} from '../domain/workout-session/session-metrics';
import type { WorkoutSession } from '../domain/workout-session/workout-session';
import { findSessionsWorking } from '../infra/exercise-history';
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
  // Sur la séquence CHRONOLOGIQUE complète de la séance, toutes activités
  // confondues : une seule activité peut être en cours à la fois (le domaine
  // l'impose), donc les concaténer dans l'ordre de la séance suffit à
  // retrouver l'ordre réel. Restreindre le calcul à une seule performance
  // perdait le repos pris en changeant d'exercice -- il tombe précisément
  // entre deux performances distinctes.
  const bySession = session.activities.flatMap((activity) => {
    const performance = activity.performanceId
      ? performances.get(activity.performanceId)
      : undefined;
    return performance?.completedSets ?? [];
  });
  const restBefore = restBeforeEachSet(bySession, session.rests);

  let cursor = 0;
  const activities = session.activities.map((activity): ActivitySummary => {
    const performance = activity.performanceId
      ? performances.get(activity.performanceId)
      : undefined;
    const completed = performance?.completedSets ?? [];
    const completedSets = completed.map((set, position) => ({
      set,
      index: performance?.sets.indexOf(set) ?? position,
      restBefore: restBefore[cursor + position],
    }));
    cursor += completed.length;

    return {
      exerciseId: activity.exerciseId,
      performanceId: activity.performanceId,
      measurementIds: performance?.measurementIds ?? [],
      completedSets,
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

/** Un record battu pendant une séance, et l'exercice sur lequel il l'a été. */
export type SessionRecord = BeatenRecord & { readonly exerciseId: string };

/**
 * Les records qu'une séance a battus (§23 : dérivés, jamais stockés).
 *
 * « Avant » veut dire avant CETTE séance, et non avant aujourd'hui : relire
 * une séance d'il y a un mois doit dire ce qu'elle avait battu ce jour-là,
 * pas s'effacer parce qu'on a fait mieux depuis.
 *
 * Un exercice repris dans la même séance -- un finisher -- se juge en une
 * fois : c'est la séance qui bat un record, pas chacun de ses passages.
 */
export async function findSessionRecords(summary: SessionSummary): Promise<SessionRecord[]> {
  const { session } = summary;
  const exerciseIds = [...new Set(summary.activities.map((activity) => activity.exerciseId))];
  const records: SessionRecord[] = [];

  for (const exerciseId of exerciseIds) {
    const now = summary.activities
      .filter((activity) => activity.exerciseId === exerciseId)
      .flatMap((activity) => activity.completedSets.map((entry) => entry.set));
    if (now.length === 0) continue;

    const earlier = (await findSessionsWorking(exerciseId)).filter(
      (entry) => entry.sessionId !== session.id && entry.startedAt < session.startedAt,
    );
    const performances = await findByIds(earlier.flatMap((entry) => entry.performanceIds));
    const before = [...performances.values()].flatMap((performance) => performance.sets);

    for (const record of recordsBeaten(before, now)) records.push({ ...record, exerciseId });
  }

  return records;
}
