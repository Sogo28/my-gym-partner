import {
  ExercisePerformance,
  type PerformanceSet,
  type PerformanceSetStatus,
  type SetValues,
  type Side,
} from '../domain/performance/exercise-performance';
import { getDatabase } from './db';

type PerformanceRow = { id: string; exercise_id: string; started_at: string };
type MeasurementRow = { performance_id: string; measurement_id: string };
type SetRow = {
  performance_id: string;
  set_index: number;
  status: PerformanceSetStatus;
  started_at: string;
  ended_at: string | null;
};
type ValueRow = {
  performance_id: string;
  set_index: number;
  side: Side;
  measurement_id: string;
  value: number;
};

export async function save(performance: ExercisePerformance): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO exercise_performances (id, exercise_id, started_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO NOTHING;`,
      performance.id,
      performance.exerciseId,
      performance.startedAt.toISOString(),
    );

    await db.runAsync(
      'DELETE FROM exercise_performance_measurements WHERE performance_id = ?;',
      performance.id,
    );
    for (const [position, measurementId] of performance.measurementIds.entries()) {
      await db.runAsync(
        `INSERT INTO exercise_performance_measurements (performance_id, measurement_id, position)
         VALUES (?, ?, ?);`,
        performance.id,
        measurementId,
        position,
      );
    }

    await db.runAsync('DELETE FROM performance_sets WHERE performance_id = ?;', performance.id);
    for (const [setIndex, set] of performance.sets.entries()) {
      await db.runAsync(
        `INSERT INTO performance_sets (performance_id, set_index, status, started_at, ended_at)
         VALUES (?, ?, ?, ?, ?);`,
        performance.id,
        setIndex,
        set.status,
        set.startedAt.toISOString(),
        set.endedAt?.toISOString() ?? null,
      );
      for (const [side, sideValues] of Object.entries(set.values)) {
        for (const [measurementId, value] of Object.entries(sideValues ?? {})) {
          await db.runAsync(
            `INSERT INTO performance_set_values
               (performance_id, set_index, side, measurement_id, value)
             VALUES (?, ?, ?, ?, ?);`,
            performance.id,
            setIndex,
            side,
            measurementId,
            value,
          );
        }
      }
    }
  });
}

export async function findById(id: string): Promise<ExercisePerformance | null> {
  const performances = await findByIds([id]);
  return performances.get(id) ?? null;
}

/**
 * Charge plusieurs performances d'un coup : l'historique d'une séance en
 * demande une par activité, ce qui ferait autant de requêtes une par une.
 */
export async function findByIds(ids: readonly string[]): Promise<Map<string, ExercisePerformance>> {
  const result = new Map<string, ExercisePerformance>();
  if (ids.length === 0) return result;

  const db = await getDatabase();
  // Autant de "?" que d'identifiants : SQLite n'accepte pas de liste en
  // paramètre, on construit les emplacements et on passe les valeurs à côté
  // (jamais par concaténation de chaînes, qui ouvrirait une injection SQL).
  const holes = ids.map(() => '?').join(', ');

  const rows = await db.getAllAsync<PerformanceRow>(
    `SELECT * FROM exercise_performances WHERE id IN (${holes});`,
    ...ids,
  );
  const measurementRows = await db.getAllAsync<MeasurementRow>(
    `SELECT performance_id, measurement_id FROM exercise_performance_measurements
     WHERE performance_id IN (${holes}) ORDER BY performance_id, position;`,
    ...ids,
  );
  const setRows = await db.getAllAsync<SetRow>(
    `SELECT * FROM performance_sets WHERE performance_id IN (${holes})
     ORDER BY performance_id, set_index;`,
    ...ids,
  );
  const valueRows = await db.getAllAsync<ValueRow>(
    `SELECT * FROM performance_set_values WHERE performance_id IN (${holes});`,
    ...ids,
  );

  const measurementsOf = new Map<string, string[]>();
  for (const row of measurementRows) {
    const list = measurementsOf.get(row.performance_id) ?? [];
    list.push(row.measurement_id);
    measurementsOf.set(row.performance_id, list);
  }

  // Regroupées par série, puis par côté du corps.
  const valuesOf = new Map<string, Record<string, Record<string, number>>>();
  for (const row of valueRows) {
    const key = `${row.performance_id}|${row.set_index}`;
    const bySide = valuesOf.get(key) ?? {};
    const values = bySide[row.side] ?? {};
    values[row.measurement_id] = row.value;
    bySide[row.side] = values;
    valuesOf.set(key, bySide);
  }

  const setsOf = new Map<string, PerformanceSet[]>();
  for (const row of setRows) {
    const list = setsOf.get(row.performance_id) ?? [];
    list.push({
      status: row.status,
      values: (valuesOf.get(`${row.performance_id}|${row.set_index}`) ?? {}) as Record<
        Side,
        SetValues
      >,
      startedAt: new Date(row.started_at),
      endedAt: row.ended_at ? new Date(row.ended_at) : null,
    });
    setsOf.set(row.performance_id, list);
  }

  for (const row of rows) {
    result.set(
      row.id,
      ExercisePerformance.restore({
        id: row.id,
        exerciseId: row.exercise_id,
        measurementIds: measurementsOf.get(row.id) ?? [],
        startedAt: new Date(row.started_at),
        sets: setsOf.get(row.id) ?? [],
      }),
    );
  }

  return result;
}

/**
 * Les exercices récemment travaillés, du plus récent au plus ancien.
 *
 * Projection de LECTURE : elle ne reconstruit aucune performance, elle ne
 * répond qu'à la question « qu'ai-je fait dernièrement ? » que pose le
 * sélecteur d'exercices.
 */
export async function findRecentExerciseIds(limit = 5): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ exercise_id: string }>(
    `SELECT exercise_id, MAX(started_at) AS last_at
     FROM exercise_performances
     GROUP BY exercise_id
     ORDER BY last_at DESC
     LIMIT ?;`,
    limit,
  );
  return rows.map((row) => row.exercise_id);
}
