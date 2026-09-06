import {
  ScheduledWorkout,
  type ScheduledWorkoutStatus,
} from '../domain/scheduling/scheduled-workout';
import { getDatabase } from './db';

type Row = {
  id: string;
  planned_workout_id: string;
  scheduled_at: string;
  status: ScheduledWorkoutStatus;
};

export async function save(schedule: ScheduledWorkout): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO scheduled_workouts (id, planned_workout_id, scheduled_at, status)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       scheduled_at = excluded.scheduled_at, status = excluded.status;`,
    schedule.id,
    schedule.plannedWorkoutId,
    schedule.scheduledAt.toISOString(),
    schedule.status,
  );
}

/** GetCalendar (§28) : le planning, du plus proche au plus lointain. */
export async function findAll(): Promise<ScheduledWorkout[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM scheduled_workouts ORDER BY scheduled_at;',
  );
  return rows.map(toDomain);
}

export async function findById(id: string): Promise<ScheduledWorkout | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Row>('SELECT * FROM scheduled_workouts WHERE id = ?;', id);
  return row ? toDomain(row) : null;
}

function toDomain(row: Row): ScheduledWorkout {
  return ScheduledWorkout.restore({
    id: row.id,
    plannedWorkoutId: row.planned_workout_id,
    scheduledAt: new Date(row.scheduled_at),
    status: row.status,
  });
}
