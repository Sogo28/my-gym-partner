import { DatabaseSync } from 'node:sqlite';

/**
 * L'API d'expo-sqlite, servie par la SQLite intégrée à Node.
 *
 * Vitest substitue ce module à `expo-sqlite` : le code de production n'en sait
 * rien et ne change pas d'une ligne. Le dialecte est le même des deux côtés,
 * donc les tests exercent le VRAI schéma, les VRAIES migrations et les VRAIS
 * mappings -- pas une imitation.
 */
let db = new DatabaseSync(':memory:');

/** Vide les données entre deux tests, en gardant schéma et catalogue. */
export function __clearData(): void {
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%';`,
    )
    .all() as { name: string }[];

  // Les contraintes sont relâchées le temps du nettoyage : l'ordre de
  // suppression n'a alors pas d'importance.
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const { name } of tables) {
    // measurements est un catalogue installé par la migration 1, pas une
    // donnée de test : le vider casserait toutes les clés étrangères.
    if (name !== 'measurements') db.exec(`DELETE FROM ${name};`);
  }
  db.exec('PRAGMA foreign_keys = ON;');
}

const handle = {
  async execAsync(sql: string): Promise<void> {
    db.exec(sql);
  },

  async runAsync(sql: string, ...params: unknown[]) {
    const result = db.prepare(sql).run(...(params as never[]));
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  },

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return db.prepare(sql).all(...(params as never[])) as T[];
  },

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    return (db.prepare(sql).get(...(params as never[])) as T) ?? null;
  },

  /**
   * Les transactions sont réelles : un test peut donc vérifier qu'une écriture
   * en plusieurs étapes ne laisse pas d'état intermédiaire derrière elle.
   */
  async withTransactionAsync(action: () => Promise<void>): Promise<void> {
    db.exec('BEGIN;');
    try {
      await action();
      db.exec('COMMIT;');
    } catch (error) {
      db.exec('ROLLBACK;');
      throw error;
    }
  },
};

export type SQLiteDatabase = typeof handle;

export async function openDatabaseAsync(): Promise<SQLiteDatabase> {
  return handle;
}
