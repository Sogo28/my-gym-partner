import { getDatabase } from './db';

/** Une séance ayant travaillé un exercice, et ce qu'elle en a produit. */
export type WorkedSession = {
  readonly sessionId: string;
  readonly startedAt: Date;
  /** Un exercice peut être repris dans la même séance : un finisher. */
  readonly performanceIds: readonly string[];
};

/**
 * Les séances qui ont travaillé CET exercice, de la plus récente à la plus
 * ancienne.
 *
 * Projection de lecture, et non le résumé complet de l'historique : la fiche
 * d'un exercice chargeait jusqu'ici toutes les séances jamais faites, avec
 * toutes leurs performances, pour n'en garder qu'une poignée. Le coût
 * grandissait avec l'historique entier, pas avec ce qu'on affiche.
 */
export async function findSessionsWorking(exerciseId: string): Promise<WorkedSession[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    session_id: string;
    started_at: string;
    performance_id: string;
  }>(
    `SELECT s.id AS session_id, s.started_at, a.performance_id
     FROM workout_sessions s
     JOIN session_activities a ON a.session_id = s.id
     WHERE a.exercise_id = ?1 AND a.performance_id IS NOT NULL
       -- Une séance annulée ne compte pas : ni dans l'historique d'un
       -- exercice, ni dans ses records (décidé le 2026-10-08).
       AND s.status != 'CANCELLED'
     ORDER BY s.started_at DESC, a.position;`,
    exerciseId,
  );

  const sessions = new Map<string, WorkedSession & { performanceIds: string[] }>();
  for (const row of rows) {
    const found = sessions.get(row.session_id);
    if (found) {
      found.performanceIds.push(row.performance_id);
      continue;
    }
    sessions.set(row.session_id, {
      sessionId: row.session_id,
      startedAt: new Date(row.started_at),
      performanceIds: [row.performance_id],
    });
  }

  return [...sessions.values()];
}

/**
 * Les exercices réellement travaillés dans un intervalle.
 *
 * « Travaillé » = au moins une série VALIDÉE : une séance ouverte puis
 * abandonnée n'a rien entraîné, et l'accueil ne doit pas prétendre le
 * contraire.
 */
export async function findExercisesWorkedBetween(from: Date, to: Date): Promise<string[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{ exercise_id: string }>(
    `SELECT DISTINCT a.exercise_id
     FROM workout_sessions s
     JOIN session_activities a ON a.session_id = s.id
     JOIN performance_sets ps
       ON ps.performance_id = a.performance_id AND ps.status = 'COMPLETED'
     WHERE s.started_at >= ?1 AND s.started_at < ?2
       -- Une séance annulée ne compte pas à l'accueil : ni sa carte, ni les
       -- muscles qu'elle aurait allumés (voir session-history.ts).
       AND s.status != 'CANCELLED';`,
    from.toISOString(),
    to.toISOString(),
  );

  return rows.map((row) => row.exercise_id);
}
