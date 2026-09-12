import { getDatabase } from './db';

/**
 * Les jours où une séance a réellement produit quelque chose, depuis une date.
 *
 * Même règle que partout : au moins une série VALIDÉE. Une séance ouverte
 * puis abandonnée n'a pas entraîné, et le calendrier ne doit pas l'afficher
 * comme un jour travaillé.
 */
export async function findWorkedDaysSince(since: Date): Promise<Date[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{ started_at: string }>(
    `SELECT DISTINCT s.started_at
     FROM workout_sessions s
     JOIN session_activities a ON a.session_id = s.id
     JOIN performance_sets ps
       ON ps.performance_id = a.performance_id AND ps.status = 'COMPLETED'
     WHERE s.started_at >= ?1;`,
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
     WHERE s.started_at >= ?1 AND s.started_at < ?2
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
