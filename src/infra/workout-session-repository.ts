import {
  WorkoutSession,
  type Activity,
  type WorkoutSessionStatus,
} from '../domain/workout-session/workout-session';
import { getDatabase } from './db';

type SessionRow = {
  id: string;
  planned_workout_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: WorkoutSessionStatus;
};

type ActivityRow = {
  session_id: string;
  exercise_id: string;
  performance_id: string | null;
  started_at: string;
  finished_at: string | null;
};

export async function save(session: WorkoutSession): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO workout_sessions (id, planned_workout_id, started_at, ended_at, status)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET ended_at = excluded.ended_at, status = excluded.status;`,
      session.id,
      session.plannedWorkoutId,
      session.startedAt.toISOString(),
      session.endedAt?.toISOString() ?? null,
      session.status,
    );

    await db.runAsync('DELETE FROM session_activities WHERE session_id = ?;', session.id);

    for (const [position, activity] of session.activities.entries()) {
      await db.runAsync(
        `INSERT INTO session_activities
           (session_id, position, exercise_id, performance_id, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        session.id,
        position,
        activity.exerciseId,
        activity.performanceId,
        activity.startedAt.toISOString(),
        activity.finishedAt?.toISOString() ?? null,
      );
    }
  });
}

/** La séance en cours, s'il y en a une. */
export async function findActive(): Promise<WorkoutSession | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SessionRow>(
    "SELECT * FROM workout_sessions WHERE status = 'ACTIVE' ORDER BY started_at DESC LIMIT 1;",
  );
  return row ? hydrate(db, row) : null;
}

/** L'historique, les plus récentes d'abord. */
export async function findAll(): Promise<WorkoutSession[]> {
  const db = await getDatabase();

  // Deux requêtes au total, pas une par séance : on charge toutes les
  // activités d'un coup et on les regroupe en mémoire.
  const rows = await db.getAllAsync<SessionRow>(
    'SELECT * FROM workout_sessions ORDER BY started_at DESC;',
  );
  const activityRows = await db.getAllAsync<ActivityRow>(
    'SELECT * FROM session_activities ORDER BY session_id, position;',
  );

  const bySession = new Map<string, Activity[]>();
  for (const row of activityRows) {
    const list = bySession.get(row.session_id) ?? [];
    list.push(toActivity(row));
    bySession.set(row.session_id, list);
  }

  return rows.map((row) => restore(row, bySession.get(row.id) ?? []));
}

function toActivity(row: ActivityRow): Activity {
  return {
    exerciseId: row.exercise_id,
    performanceId: row.performance_id,
    startedAt: new Date(row.started_at),
    finishedAt: row.finished_at ? new Date(row.finished_at) : null,
  };
}

/**
 * On passe par restore() et non start() : une séance rechargée n'est pas une
 * séance qui commence. Le domaine doit pouvoir revenir à un état
 * intermédiaire sans rejouer son histoire.
 */
function restore(row: SessionRow, activities: Activity[]): WorkoutSession {
  return WorkoutSession.restore({
    id: row.id,
    plannedWorkoutId: row.planned_workout_id,
    startedAt: new Date(row.started_at),
    status: row.status,
    endedAt: row.ended_at ? new Date(row.ended_at) : null,
    activities,
  });
}

async function hydrate(
  db: Awaited<ReturnType<typeof getDatabase>>,
  row: SessionRow,
): Promise<WorkoutSession> {
  const activities = await db.getAllAsync<ActivityRow>(
    'SELECT * FROM session_activities WHERE session_id = ? ORDER BY position;',
    row.id,
  );
  return restore(row, activities.map(toActivity));
}
