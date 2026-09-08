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
