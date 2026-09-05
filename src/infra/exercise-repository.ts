import { Exercise } from '../domain/exercise/exercise';
import type { Measurement } from '../domain/exercise/measurement';
import { getDatabase } from './db';

type ExerciseRow = { id: string; name: string; is_unilateral: number };
type LinkRow = { exercise_id: string; measurement_id: string };

/**
 * Repository : la seule porte d'entrée pour charger et sauvegarder l'agrégat
 * Exercise. Il parle le vocabulaire du domaine (save / findAll), pas celui de
 * SQL, ce qui permettra de changer de base sans toucher au domaine.
 */
export async function save(exercise: Exercise): Promise<void> {
  const db = await getDatabase();

  // Une transaction : les trois écritures ci-dessous forment UN SEUL fait
  // métier ("cet exercice existe avec ces mesures"). Si l'insertion des
  // mesures échoue après celle de l'exercice, on se retrouverait avec un
  // exercice sans mesure -- un état que le domaine interdit. La transaction
  // garantit que soit tout est écrit, soit rien ne l'est.
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO exercises (id, name, is_unilateral) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name;`,
      exercise.id,
      exercise.name,
      exercise.isUnilateral ? 1 : 0,
    );

    // On remplace la liste complète des mesures plutôt que de calculer un
    // différentiel : l'agrégat est l'unité de cohérence, on écrit son état actuel.
    await db.runAsync('DELETE FROM exercise_measurements WHERE exercise_id = ?;', exercise.id);

    for (const [position, measurementId] of exercise.measurementIds.entries()) {
      await db.runAsync(
        'INSERT INTO exercise_measurements (exercise_id, measurement_id, position) VALUES (?, ?, ?);',
        exercise.id,
        measurementId,
        position,
      );
    }
  });
}

export async function findAll(): Promise<Exercise[]> {
  const db = await getDatabase();

  // Deux requêtes, pas une par exercice : on charge tout puis on assemble
  // en mémoire (éviter le "N+1", qui deviendrait lent avec 100 exercices).
  const rows = await db.getAllAsync<ExerciseRow>('SELECT id, name, is_unilateral FROM exercises ORDER BY name;');
  const links = await db.getAllAsync<LinkRow>(
    'SELECT exercise_id, measurement_id FROM exercise_measurements ORDER BY exercise_id, position;',
  );

  const measurementsByExercise = new Map<string, string[]>();
  for (const link of links) {
    const list = measurementsByExercise.get(link.exercise_id) ?? [];
    list.push(link.measurement_id);
    measurementsByExercise.set(link.exercise_id, list);
  }

  // On reconstruit de vrais objets du domaine : ce qui sort du repository est
  // un Exercise, pas une ligne de base de données.
  return rows.map((row) =>
    Exercise.create({
      id: row.id,
      name: row.name,
      isUnilateral: row.is_unilateral === 1,
      measurementIds: measurementsByExercise.get(row.id) ?? [],
    }),
  );
}

export async function findAllMeasurements(): Promise<Measurement[]> {
  const db = await getDatabase();
  return db.getAllAsync<Measurement>('SELECT id, name, unit FROM measurements ORDER BY rowid;');
}
