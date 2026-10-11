import type { Backup } from '../infra/backup';

export const CLOUD_HASH_KEY = 'cloud.lastHash';
export const CLOUD_PUSHED_AT_KEY = 'cloud.lastPushedAt';
/** Les empreintes déjà calculées des médias, par nom : `{ size, md5 }`. */
export const CLOUD_MEDIA_MD5_KEY = 'cloud.mediaMd5';
/**
 * Les médias que cite chaque génération en ligne, par chemin -- présents,
 * manquants ou exclus : tout ce qu'elle cite protège le fichier du ménage.
 *
 * `.v2` depuis le 2026-10-11 : l'ancien registre ne retenait que les
 * présents, et une vidéo citée comme manquante ou exclue a été effacée en
 * ligne alors qu'une copie la nommait encore. Le nouveau se reconstruit en
 * relisant une fois chaque génération.
 */
export const CLOUD_GENERATIONS_KEY = 'cloud.generationMedia.v2';
const LEGACY_GENERATIONS_KEY = 'cloud.generationMedia';
/**
 * Le compte auquel CE téléphone est relié : il en a restauré une copie, ou
 * y en a déposé une à la main. Sans ce lien, la sauvegarde automatique se
 * tait dès que le compte a déjà des copies -- une app réinstallée, vide,
 * écrasait sinon les bonnes par du rien (décidé le 2026-10-11).
 */
export const CLOUD_LINKED_KEY = 'cloud.linkedAccount';

/** Les réglages qui décrivent la sauvegarde elle-même, et non les données. */
const BOOKKEEPING = new Set([
  CLOUD_HASH_KEY,
  CLOUD_PUSHED_AT_KEY,
  CLOUD_MEDIA_MD5_KEY,
  CLOUD_GENERATIONS_KEY,
  LEGACY_GENERATIONS_KEY,
  CLOUD_LINKED_KEY,
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
