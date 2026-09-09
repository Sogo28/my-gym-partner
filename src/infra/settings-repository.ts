import { getDatabase } from './db';

/**
 * Les préférences, en clé/valeur.
 *
 * Ce ne sont pas des données du domaine : aucune règle métier n'en dépend, et
 * les perdre ne perdrait rien de ce qu'on a fait. Elles n'ont donc ni agrégat
 * ni repository au sens strict -- juste un endroit où se souvenir d'un choix.
 */
export async function readSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?;',
    key,
  );
  return row?.value ?? null;
}

export async function writeSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    key,
    value,
  );
}
