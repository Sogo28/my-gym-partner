import {
  PlannedWorkout,
  type PlannedExercise,
  type PlannedSet,
} from '../domain/planned-workout/planned-workout';
import { getDatabase } from './db';

type WorkoutRow = { id: string; name: string; archived: number };
type ExerciseRow = { workout_id: string; position: number; exercise_id: string };
type SetRow = {
  workout_id: string;
  position: number;
  set_index: number;
  measurement_id: string;
  target_value: number;
};

export async function save(workout: PlannedWorkout): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO planned_workouts (id, name, archived) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, archived = excluded.archived;`,
      workout.id,
      workout.name,
      workout.isArchived ? 1 : 0,
    );

    // On efface puis on réécrit tout le contenu de l'agrégat. Les séries
    // partent d'elles-mêmes grâce au ON DELETE CASCADE : l'agrégat est
    // l'unité de cohérence, on ne calcule pas de différentiel.
    await db.runAsync('DELETE FROM planned_workout_exercises WHERE workout_id = ?;', workout.id);

    for (const [position, exercise] of workout.exercises.entries()) {
      await db.runAsync(
        'INSERT INTO planned_workout_exercises (workout_id, position, exercise_id) VALUES (?, ?, ?);',
        workout.id,
        position,
        exercise.exerciseId,
      );

      for (const [setIndex, set] of exercise.sets.entries()) {
        for (const [measurementId, value] of Object.entries(set.targets)) {
          await db.runAsync(
            `INSERT INTO planned_workout_sets
               (workout_id, position, set_index, measurement_id, target_value)
             VALUES (?, ?, ?, ?, ?);`,
            workout.id,
            position,
            setIndex,
            measurementId,
            value,
          );
        }
      }
    }
  });
}

/**
 * Charger un agrégat "en profondeur" : trois requêtes à plat, puis on
 * reconstitue la hiérarchie en mémoire. Toujours pas de requête par
 * entraînement -- avec cinquante entraînements, ce serait cent-cinquante
 * allers-retours vers la base.
 */
/** Un entraînement déjà exécuté ne se supprime pas : des séances en dépendent. */
export async function isReferenced(workoutId: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ used: number }>(
    'SELECT EXISTS (SELECT 1 FROM workout_sessions WHERE planned_workout_id = ?) AS used;',
    workoutId,
  );
  return (row?.used ?? 0) === 1;
}

export async function remove(workoutId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM planned_workouts WHERE id = ?;', workoutId);
}

export async function findAll(): Promise<PlannedWorkout[]> {
  const db = await getDatabase();

  const workouts = await db.getAllAsync<WorkoutRow>(
    'SELECT id, name, archived FROM planned_workouts ORDER BY name;',
  );
  const exerciseRows = await db.getAllAsync<ExerciseRow>(
    'SELECT workout_id, position, exercise_id FROM planned_workout_exercises ORDER BY workout_id, position;',
  );
  const setRows = await db.getAllAsync<SetRow>(
    `SELECT workout_id, position, set_index, measurement_id, target_value
     FROM planned_workout_sets ORDER BY workout_id, position, set_index;`,
  );

  // Une série est éclatée sur plusieurs lignes (une par mesure ciblée) :
  // on regroupe d'abord par exercice, puis par numéro de série.
  const setsByExercise = new Map<string, Map<number, Record<string, number>>>();
  for (const row of setRows) {
    const exerciseKey = `${row.workout_id}|${row.position}`;
    const sets = setsByExercise.get(exerciseKey) ?? new Map<number, Record<string, number>>();
    const targets = sets.get(row.set_index) ?? {};
    targets[row.measurement_id] = row.target_value;
    sets.set(row.set_index, targets);
    setsByExercise.set(exerciseKey, sets);
  }

  const setsOf = (exerciseKey: string): PlannedSet[] =>
    [...(setsByExercise.get(exerciseKey) ?? new Map())]
      .sort(([a], [b]) => a - b)
      .map(([, targets]) => ({ targets }));

  const exercisesByWorkout = new Map<string, PlannedExercise[]>();
  for (const row of exerciseRows) {
    const list = exercisesByWorkout.get(row.workout_id) ?? [];
    list.push({
      exerciseId: row.exercise_id,
      sets: setsOf(`${row.workout_id}|${row.position}`),
    });
    exercisesByWorkout.set(row.workout_id, list);
  }

  return workouts.map((row) =>
    PlannedWorkout.create({
      id: row.id,
      name: row.name,
      exercises: exercisesByWorkout.get(row.id) ?? [],
      isArchived: row.archived === 1,
    }),
  );
}
