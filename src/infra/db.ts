import * as SQLite from 'expo-sqlite';

/**
 * Ouverture de la base SQLite embarquée + création du schéma.
 *
 * `user_version` est un compteur fourni par SQLite lui-même : on l'utilise
 * comme numéro de version du schéma. Chaque future évolution ajoutera un bloc
 * `if (version < N)`, ce qui nous donne des migrations sans outil externe.
 */
const SCHEMA_VERSION = 1;

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
