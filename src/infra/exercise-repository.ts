import { Exercise } from '../domain/exercise/exercise';
import type { Measurement } from '../domain/exercise/measurement';
import type { Muscle } from '../domain/exercise/muscle';
import { getDatabase } from './db';

type ExerciseRow = { id: string; name: string; is_unilateral: number; archived: number };
type LinkRow = { exercise_id: string; measurement_id: string };
type MuscleLinkRow = { exercise_id: string; muscle_id: string; role: 'PRIMARY' | 'SECONDARY' };
type MediaRow = {
  exercise_id: string;
  kind: 'link' | 'file';
  uri: string;
  label: string | null;
};

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
      `INSERT INTO exercises (id, name, is_unilateral, archived) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, archived = excluded.archived;`,
      exercise.id,
      exercise.name,
      exercise.isUnilateral ? 1 : 0,
      exercise.isArchived ? 1 : 0,
    );

    // On remplace la liste complète des mesures plutôt que de calculer un
    // différentiel : l'agrégat est l'unité de cohérence, on écrit son état actuel.
    await db.runAsync('DELETE FROM exercise_measurements WHERE exercise_id = ?;', exercise.id);
    await db.runAsync('DELETE FROM exercise_muscles WHERE exercise_id = ?;', exercise.id);
    await db.runAsync('DELETE FROM exercise_media WHERE exercise_id = ?;', exercise.id);

    for (const [position, media] of exercise.media.entries()) {
      await db.runAsync(
        'INSERT INTO exercise_media (exercise_id, position, kind, uri, label) VALUES (?, ?, ?, ?, ?);',
        exercise.id,
        position,
        media.kind,
        media.uri,
        media.label,
      );
    }

    if (exercise.primaryMuscleId !== null) {
      await db.runAsync(
        "INSERT INTO exercise_muscles (exercise_id, muscle_id, role) VALUES (?, ?, 'PRIMARY');",
        exercise.id,
        exercise.primaryMuscleId,
      );
    }

    for (const muscleId of exercise.secondaryMuscleIds) {
      await db.runAsync(
        "INSERT INTO exercise_muscles (exercise_id, muscle_id, role) VALUES (?, ?, 'SECONDARY');",
        exercise.id,
        muscleId,
      );
    }

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
  const rows = await db.getAllAsync<ExerciseRow>(
    'SELECT id, name, is_unilateral, archived FROM exercises ORDER BY name;',
  );
  const links = await db.getAllAsync<LinkRow>(
    'SELECT exercise_id, measurement_id FROM exercise_measurements ORDER BY exercise_id, position;',
  );
  const muscleLinks = await db.getAllAsync<MuscleLinkRow>(
    `SELECT em.exercise_id, em.muscle_id, em.role FROM exercise_muscles em
     JOIN muscles m ON m.id = em.muscle_id
     ORDER BY em.exercise_id, m.position;`,
  );

  const measurementsByExercise = new Map<string, string[]>();
  for (const link of links) {
    const list = measurementsByExercise.get(link.exercise_id) ?? [];
    list.push(link.measurement_id);
    measurementsByExercise.set(link.exercise_id, list);
  }

  const mediaRows = await db.getAllAsync<MediaRow>(
    'SELECT exercise_id, kind, uri, label FROM exercise_media ORDER BY exercise_id, position;',
  );
  const mediaByExercise = new Map<string, MediaRow[]>();
  for (const row of mediaRows) {
    const list = mediaByExercise.get(row.exercise_id) ?? [];
    list.push(row);
    mediaByExercise.set(row.exercise_id, list);
  }

  const primaryByExercise = new Map<string, string>();
  const secondariesByExercise = new Map<string, string[]>();
  for (const link of muscleLinks) {
    if (link.role === 'PRIMARY') {
      primaryByExercise.set(link.exercise_id, link.muscle_id);
      continue;
    }
    const list = secondariesByExercise.get(link.exercise_id) ?? [];
    list.push(link.muscle_id);
    secondariesByExercise.set(link.exercise_id, list);
  }

  // On reconstruit de vrais objets du domaine : ce qui sort du repository est
  // un Exercise, pas une ligne de base de données.
  return rows.map((row) =>
    Exercise.restore({
      id: row.id,
      name: row.name,
      isUnilateral: row.is_unilateral === 1,
      measurementIds: measurementsByExercise.get(row.id) ?? [],
      primaryMuscleId: primaryByExercise.get(row.id) ?? null,
      secondaryMuscleIds: secondariesByExercise.get(row.id) ?? [],
      media: (mediaByExercise.get(row.id) ?? []).map((media) => ({
        kind: media.kind,
        uri: media.uri,
        label: media.label,
      })),
      isArchived: row.archived === 1,
    }),
  );
}

/**
 * L'exercice est-il déjà rattaché à quelque chose ?
 *
 * C'est la base qui répond, en interrogeant toutes les tables qui le
 * référencent : on ne suppose pas, on regarde.
 */
export async function isReferenced(exerciseId: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ used: number }>(
    `SELECT (
       EXISTS (SELECT 1 FROM planned_workout_exercises WHERE exercise_id = ?1)
       OR EXISTS (SELECT 1 FROM session_activities WHERE exercise_id = ?1)
       OR EXISTS (SELECT 1 FROM exercise_performances WHERE exercise_id = ?1)
       OR EXISTS (SELECT 1 FROM goal_steps WHERE exercise_id = ?1)
       OR EXISTS (SELECT 1 FROM goals WHERE exercise_id = ?1)
     ) AS used;`,
    exerciseId,
  );
  return (row?.used ?? 0) === 1;
}

/** Suppression définitive : réservée à un exercice que rien ne référence. */
export async function remove(exerciseId: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM exercise_measurements WHERE exercise_id = ?;', exerciseId);
    await db.runAsync('DELETE FROM exercises WHERE id = ?;', exerciseId);
  });
}

export async function findAllMuscles(): Promise<Muscle[]> {
  const db = await getDatabase();
  return db.getAllAsync<Muscle>('SELECT id, name FROM muscles ORDER BY position;');
}

export async function findAllMeasurements(): Promise<Measurement[]> {
  const db = await getDatabase();
  return db.getAllAsync<Measurement>('SELECT id, name, unit FROM measurements ORDER BY rowid;');
}
