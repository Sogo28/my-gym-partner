import * as SQLite from 'expo-sqlite';

/**
 * Ouverture de la base SQLite embarquée + création du schéma.
 *
 * `user_version` est un compteur fourni par SQLite lui-même : on l'utilise
 * comme numéro de version du schéma. Chaque future évolution ajoutera un bloc
 * `if (version < N)`, ce qui nous donne des migrations sans outil externe.
 */
const SCHEMA_VERSION = 4;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= openAndMigrate();
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('my-gym-partner.db');

  // Les clés étrangères sont désactivées par défaut dans SQLite.
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE measurements (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        unit TEXT NOT NULL
      );

      CREATE TABLE exercises (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        is_unilateral INTEGER NOT NULL
      );

      -- Un exercice référence plusieurs mesures, une mesure sert à plusieurs
      -- exercices : la relation a besoin de sa propre table.
      -- 'position' conserve l'ordre dans lequel l'utilisateur les a choisies.
      CREATE TABLE exercise_measurements (
        exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        measurement_id TEXT NOT NULL REFERENCES measurements(id),
        position INTEGER NOT NULL,
        PRIMARY KEY (exercise_id, measurement_id)
      );
    `);
    await seedMeasurements(db);
  }

  // Migration 2 : entraînements planifiés (Slice 2).
  // Ce bloc s'exécute AUSSI sur une base déjà en version 1 -- celle qui
  // contient déjà tes exercices. Le bloc précédent, lui, ne rejouera pas :
  // c'est tout l'intérêt du compteur, faire évoluer le schéma sans effacer
  // les données existantes.
  if (version < 2) {
    await db.execAsync(`
      CREATE TABLE planned_workouts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL
      );

      -- 'position' fait partie de la clé : c'est elle qui identifie un
      -- exercice planifié, puisqu'un même exercice peut figurer deux fois.
      CREATE TABLE planned_workout_exercises (
        workout_id TEXT NOT NULL REFERENCES planned_workouts(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        exercise_id TEXT NOT NULL REFERENCES exercises(id),
        PRIMARY KEY (workout_id, position)
      );

      -- Une ligne par cible : "set 1 = 8 reps à +10 kg" occupe deux lignes.
      -- La clé étrangère vers measurements garantit qu'on ne peut pas cibler
      -- une mesure qui n'existe pas.
      CREATE TABLE planned_workout_sets (
        workout_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        set_index INTEGER NOT NULL,
        measurement_id TEXT NOT NULL REFERENCES measurements(id),
        target_value REAL NOT NULL,
        PRIMARY KEY (workout_id, position, set_index, measurement_id),
        FOREIGN KEY (workout_id, position)
          REFERENCES planned_workout_exercises(workout_id, position) ON DELETE CASCADE
      );
    `);
  }

  // Migration 3 : séances réelles (Slice 3).
  if (version < 3) {
    await db.execAsync(`
      -- SQLite n'a pas de type date : on stocke les instants en ISO 8601
      -- ('2026-09-05T18:00:00.000Z'), qui a la bonne propriété de se trier
      -- chronologiquement en tant que texte.
      CREATE TABLE workout_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        planned_workout_id TEXT REFERENCES planned_workouts(id),
        started_at TEXT NOT NULL,
        ended_at TEXT,
        -- La base refuse elle-même un état inconnu : l'invariant du domaine
        -- est doublé par une garantie du stockage.
        status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED'))
      );

      CREATE TABLE session_activities (
        session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        exercise_id TEXT NOT NULL REFERENCES exercises(id),
        started_at TEXT NOT NULL,
        finished_at TEXT,
        PRIMARY KEY (session_id, position)
      );
    `);
  }

  // Migration 4 : performances réelles (Slice 4).
  if (version < 4) {
    await db.execAsync(`
      -- ALTER TABLE plutôt que recréation : les séances déjà enregistrées
      -- restent en place, leur performance_id vaut simplement NULL.
      ALTER TABLE session_activities ADD COLUMN performance_id TEXT;

      CREATE TABLE exercise_performances (
        id TEXT PRIMARY KEY NOT NULL,
        exercise_id TEXT NOT NULL REFERENCES exercises(id),
        started_at TEXT NOT NULL
      );

      -- Les mesures sont copiées au moment de la performance : si l'exercice
      -- change plus tard, la performance garde le sens qu'elle avait (§2).
      CREATE TABLE exercise_performance_measurements (
        performance_id TEXT NOT NULL REFERENCES exercise_performances(id) ON DELETE CASCADE,
        measurement_id TEXT NOT NULL REFERENCES measurements(id),
        position INTEGER NOT NULL,
        PRIMARY KEY (performance_id, measurement_id)
      );

      CREATE TABLE performance_sets (
        performance_id TEXT NOT NULL REFERENCES exercise_performances(id) ON DELETE CASCADE,
        set_index INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ABANDONED')),
        started_at TEXT NOT NULL,
        ended_at TEXT,
        PRIMARY KEY (performance_id, set_index)
      );

      CREATE TABLE performance_set_values (
        performance_id TEXT NOT NULL,
        set_index INTEGER NOT NULL,
        measurement_id TEXT NOT NULL REFERENCES measurements(id),
        value REAL NOT NULL,
        PRIMARY KEY (performance_id, set_index, measurement_id),
        FOREIGN KEY (performance_id, set_index)
          REFERENCES performance_sets(performance_id, set_index) ON DELETE CASCADE
      );
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  return db;
}

/**
 * Catalogue de départ. Measurement reste un Aggregate Root : il aura ses
 * propres use cases le jour où un besoin réel de les gérer apparaîtra.
 */
async function seedMeasurements(db: SQLite.SQLiteDatabase): Promise<void> {
  const measurements = [
    { id: 'reps', name: 'Répétitions', unit: 'reps' },
    { id: 'weight', name: 'Poids', unit: 'kg' },
    { id: 'duration', name: 'Durée', unit: 's' },
    { id: 'distance', name: 'Distance', unit: 'm' },
  ];

  for (const m of measurements) {
    await db.runAsync('INSERT INTO measurements (id, name, unit) VALUES (?, ?, ?);', m.id, m.name, m.unit);
  }
}
