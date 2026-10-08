import { getDatabase } from './db';

/**
 * Les jours où une séance a réellement produit quelque chose, depuis une date.
 *
 * Même règle que partout : au moins une série VALIDÉE. Une séance ouverte
 * puis abandonnée n'a pas entraîné, et le calendrier ne doit pas l'afficher
 * comme un jour travaillé.
 *
 * Une séance ANNULÉE non plus, même avec des séries validées : l'annuler,
 * c'est dire qu'elle ne compte pas comme une séance. Ses séries restent dans
 * l'historique et les records ; l'accueil, lui, ne la raconte pas.
 */
export async function findWorkedDaysSince(since: Date): Promise<Date[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{ started_at: string }>(
    `SELECT DISTINCT s.started_at
     FROM workout_sessions s
     JOIN session_activities a ON a.session_id = s.id
     JOIN performance_sets ps
       ON ps.performance_id = a.performance_id AND ps.status = 'COMPLETED'
     WHERE s.started_at >= ?1 AND s.status != 'CANCELLED';`,
    since.toISOString(),
  );

  return rows.map((row) => new Date(row.started_at));
}

/** Une séance telle que l'accueil la raconte : ce qu'elle était, ce qu'elle a produit. */
export type DaySession = {
  readonly id: string;
  readonly plannedWorkoutId: string | null;
  readonly startedAt: Date;
  readonly completedSets: number;
};

/**
 * Les séances RÉELLEMENT faites un jour donné.
 *
 * À ne pas confondre avec ce qui y était programmé : une séance libre, ou
 * lancée depuis la fiche d'un entraînement, n'a jamais été programmée et
 * n'apparaît donc dans aucun calendrier. La chercher parmi les intentions,
 * c'était ne jamais la trouver.
 *
 * Même règle que les carrés de la semaine -- au moins une série VALIDÉE --
 * pour que le carré vert et le bloc du jour ne se contredisent pas.
 */
export async function findSessionsOn(day: Date): Promise<DaySession[]> {
  const db = await getDatabase();

  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);

  const rows = await db.getAllAsync<{
    id: string;
    planned_workout_id: string | null;
    started_at: string;
    completed: number;
  }>(
    `SELECT s.id, s.planned_workout_id, s.started_at, COUNT(*) AS completed
     FROM workout_sessions s
     JOIN session_activities a ON a.session_id = s.id
     JOIN performance_sets ps
       ON ps.performance_id = a.performance_id AND ps.status = 'COMPLETED'
     WHERE s.started_at >= ?1 AND s.started_at < ?2 AND s.status != 'CANCELLED'
     GROUP BY s.id
     ORDER BY s.started_at;`,
    from.toISOString(),
    to.toISOString(),
  );

  return rows.map((row) => ({
    id: row.id,
    plannedWorkoutId: row.planned_workout_id,
    startedAt: new Date(row.started_at),
    completedSets: row.completed,
  }));
}

/**
 * Pour chaque entraînement, le début de la dernière séance qui l'a suivi.
 *
 * Ce qui aide à choisir lequel refaire : « fait jeudi » se compare d'un coup
 * d'oeil, là où il faudrait sinon ouvrir l'historique.
 *
 * Même règle que le calendrier -- au moins une série VALIDÉE : une séance
 * ouverte puis annulée n'a pas « fait » l'entraînement. Une projection, et
 * non toutes les séances chargées pour n'en garder qu'une date chacune.
 */
export async function findLastDoneByPlan(): Promise<Map<string, Date>> {
  const db = await getDatabase();

  // MAX sur le texte suffit : les dates sont écrites en ISO, en UTC, donc
  // l'ordre alphabétique est l'ordre du temps.
  const rows = await db.getAllAsync<{ planned_workout_id: string; last: string }>(
    `SELECT s.planned_workout_id, MAX(s.started_at) AS last
     FROM workout_sessions s
     WHERE s.planned_workout_id IS NOT NULL
       AND s.status != 'CANCELLED'
       AND EXISTS (
         SELECT 1
         FROM session_activities a
         JOIN performance_sets ps
           ON ps.performance_id = a.performance_id AND ps.status = 'COMPLETED'
         WHERE a.session_id = s.id
       )
     GROUP BY s.planned_workout_id;`,
  );

  return new Map(rows.map((row) => [row.planned_workout_id, new Date(row.last)]));
}
