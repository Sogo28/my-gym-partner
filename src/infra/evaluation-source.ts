import type { SetsByWindow } from '../domain/goal/evaluation';
import type { EvaluationWindow } from '../domain/goal/goal';
import type { PerformanceSet } from '../domain/performance/exercise-performance';
import { getDatabase } from './db';
import { findByIds } from './performance-repository';

/**
 * Résout les séries à fournir à l'évaluation, fenêtre par fenêtre.
 *
 * C'est une projection de LECTURE, et non le repository d'un agrégat : elle
 * traverse séances, activités et performances pour répondre à une question que
 * seul l'évaluateur se pose. La ranger parmi les repositories laisserait
 * croire que la séance possède les performances, ce que le modèle interdit.
 */
export async function loadSetsForWindows(
  exerciseId: string,
  windows: readonly EvaluationWindow[],
): Promise<SetsByWindow> {
  const result: { -readonly [K in EvaluationWindow]?: readonly PerformanceSet[] } = {};

  for (const window of windows) {
    result[window] =
      window === 'LAST_SESSION' ? await lastSessionSets(exerciseId) : await allTimeSets(exerciseId);
  }

  return result;
}

/**
 * Toutes les séries de cet exercice lors de la dernière séance où il a
 * réellement été travaillé (décidé le 2026-09-06).
 *
 * « Réellement travaillé » = la séance contient au moins une série COMPLETED
 * pour cet exercice ; une séance où rien n'a été validé ne masque donc pas la
 * précédente. Et si l'exercice y a été repris une seconde fois -- un finisher
 * en fin de séance -- ses deux performances comptent ensemble.
 *
 * Les séances ANNULÉES comptent : leurs séries validées restent des
 * performances (décision gelée n°15).
 */
async function lastSessionSets(exerciseId: string): Promise<readonly PerformanceSet[]> {
  const db = await getDatabase();

  const session = await db.getFirstAsync<{ session_id: string }>(
    `SELECT s.id AS session_id
     FROM workout_sessions s
     JOIN session_activities a ON a.session_id = s.id AND a.exercise_id = ?1
     JOIN performance_sets ps
       ON ps.performance_id = a.performance_id AND ps.status = 'COMPLETED'
     ORDER BY s.started_at DESC
     LIMIT 1;`,
    exerciseId,
  );
  if (!session) return [];

  const rows = await db.getAllAsync<{ performance_id: string }>(
    `SELECT performance_id FROM session_activities
     WHERE session_id = ?1 AND exercise_id = ?2 AND performance_id IS NOT NULL
     ORDER BY position;`,
    session.session_id,
    exerciseId,
  );

  return setsOf(rows.map((row) => row.performance_id));
}

/** Tout l'historique de l'exercice, séances confondues. */
async function allTimeSets(exerciseId: string): Promise<readonly PerformanceSet[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM exercise_performances WHERE exercise_id = ? ORDER BY started_at;',
    exerciseId,
  );
  return setsOf(rows.map((row) => row.id));
}

/** Les performances sont chargées en un seul appel, jamais une par une. */
async function setsOf(performanceIds: string[]): Promise<readonly PerformanceSet[]> {
  if (performanceIds.length === 0) return [];
  const performances = await findByIds(performanceIds);
  return [...performances.values()].flatMap((performance) => performance.sets);
}
