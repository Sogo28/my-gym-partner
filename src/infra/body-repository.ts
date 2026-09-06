import { BodyMetric, BodyReading } from '../domain/body/body-metric';
import { getDatabase } from './db';

type MetricRow = {
  id: string;
  name: string;
  unit: string;
  position: number;
  built_in: number;
};
type MuscleRow = { metric_id: string; muscle_id: string };
type ReadingRow = { id: string; metric_id: string; value: number; taken_at: string };

export async function saveMetric(metric: BodyMetric): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    // La position ne sert qu'à l'ordre d'affichage : une mensuration ajoutée
    // par l'utilisateur se range après le catalogue de départ.
    await db.runAsync(
      `INSERT INTO body_metrics (id, name, unit, position, built_in)
       VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM body_metrics), ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, unit = excluded.unit;`,
      metric.id,
      metric.name,
      metric.unit,
      metric.isBuiltIn ? 1 : 0,
    );

    await db.runAsync('DELETE FROM body_metric_muscles WHERE metric_id = ?;', metric.id);
    for (const muscleId of metric.muscleIds) {
      await db.runAsync(
        'INSERT INTO body_metric_muscles (metric_id, muscle_id) VALUES (?, ?);',
        metric.id,
        muscleId,
      );
    }
  });
}

export async function findAllMetrics(): Promise<BodyMetric[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<MetricRow>('SELECT * FROM body_metrics ORDER BY position;');
  const muscleRows = await db.getAllAsync<MuscleRow>(
    'SELECT metric_id, muscle_id FROM body_metric_muscles;',
  );

  const musclesOf = new Map<string, string[]>();
  for (const row of muscleRows) {
    const list = musclesOf.get(row.metric_id) ?? [];
    list.push(row.muscle_id);
    musclesOf.set(row.metric_id, list);
  }

  return rows.map((row) =>
    BodyMetric.create({
      id: row.id,
      name: row.name,
      unit: row.unit,
      muscleIds: musclesOf.get(row.id) ?? [],
      isBuiltIn: row.built_in === 1,
    }),
  );
}

/** Une mensuration du catalogue de départ ne se supprime pas. */
export async function removeMetric(metricId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM body_metrics WHERE id = ? AND built_in = 0;', metricId);
}

export async function saveReading(reading: BodyReading): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO body_readings (id, metric_id, value, taken_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET value = excluded.value, taken_at = excluded.taken_at;`,
    reading.id,
    reading.metricId,
    reading.value,
    reading.takenAt.toISOString(),
  );
}

export async function removeReading(readingId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM body_readings WHERE id = ?;', readingId);
}

/** Les relevés d'une mensuration, du plus récent au plus ancien. */
export async function findReadings(metricId: string): Promise<BodyReading[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ReadingRow>(
    'SELECT * FROM body_readings WHERE metric_id = ? ORDER BY taken_at DESC;',
    metricId,
  );
  return rows.map(toReading);
}

/** Le relevé le plus récent : ce qu'une condition regarde. */
export async function findLatestReading(metricId: string): Promise<BodyReading | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ReadingRow>(
    'SELECT * FROM body_readings WHERE metric_id = ? ORDER BY taken_at DESC LIMIT 1;',
    metricId,
  );
  return row ? toReading(row) : null;
}

/** Tous les relevés, pour afficher un suivi sans requête par mensuration. */
export async function findAllReadings(): Promise<BodyReading[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ReadingRow>(
    'SELECT * FROM body_readings ORDER BY taken_at DESC;',
  );
  return rows.map(toReading);
}

function toReading(row: ReadingRow): BodyReading {
  return BodyReading.restore({
    id: row.id,
    metricId: row.metric_id,
    value: row.value,
    takenAt: new Date(row.taken_at),
  });
}
