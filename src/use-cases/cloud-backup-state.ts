import type { Backup } from '../infra/backup';

export const CLOUD_HASH_KEY = 'cloud.lastHash';
export const CLOUD_PUSHED_AT_KEY = 'cloud.lastPushedAt';
/** Les empreintes déjà calculées des médias, par nom : `{ size, md5 }`. */
export const CLOUD_MEDIA_MD5_KEY = 'cloud.mediaMd5';
/** Les médias que cite chaque génération en ligne, par chemin. */
export const CLOUD_GENERATIONS_KEY = 'cloud.generationMedia';

/** Les réglages qui décrivent la sauvegarde elle-même, et non les données. */
const BOOKKEEPING = new Set([
  CLOUD_HASH_KEY,
  CLOUD_PUSHED_AT_KEY,
  CLOUD_MEDIA_MD5_KEY,
  CLOUD_GENERATIONS_KEY,
]);

/**
 * Ce qui change réellement l'état sauvegardé.
 *
 * `exportedAt` change à chaque lecture et les réglages ci-dessus changent
 * précisément parce qu'une copie vient de partir. Les inclure ferait croire
 * que la base a changé à chaque ouverture, même sans geste de l'utilisateur.
 */
export function backupStatePayload(backup: Backup): string {
  const tables = { ...backup.tables };
  if (tables.settings) {
    tables.settings = tables.settings.filter((row) => !BOOKKEEPING.has(String(row.key)));
  }

  return JSON.stringify({
    app: backup.app,
    schemaVersion: backup.schemaVersion,
    tables,
    media: backup.media,
  });
}
