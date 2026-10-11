import type { Backup } from '../infra/backup';

/** Ce qu'une sauvegarde contient, pour l'annoncer avant de l'appliquer. */
export type BackupPreview = {
  readonly backup: Backup;
  readonly exportedAt: Date;
  readonly exercises: number;
  readonly sessions: number;
  readonly performances: number;
  /** `null` désigne une ancienne sauvegarde SQLite seule. */
  readonly mediaFiles: number | null;
  readonly missingMedia: number | null;
  /** Les vidéos de séries laissées de côté par choix ; 0 quand rien ne l'a été. */
  readonly excludedMedia: number;
};

/**
 * Ce qu'une sauvegarde annonce d'elle-même, sans rien appliquer.
 *
 * Trois nombres suffisent à reconnaître SA sauvegarde : le reste en découle,
 * et une liste exhaustive ne se lit pas dans un dialogue de confirmation.
 */
export function previewOf(backup: Backup): BackupPreview {
  const media = backup.media as unknown;
  const manifest =
    typeof media === 'object' && media !== null
      ? (media as { files?: unknown; missing?: unknown; excluded?: unknown })
      : null;

  return {
    backup,
    exportedAt: new Date(backup.exportedAt),
    exercises: backup.tables.exercises?.length ?? 0,
    sessions: backup.tables.workout_sessions?.length ?? 0,
    performances: backup.tables.exercise_performances?.length ?? 0,
    mediaFiles: Array.isArray(manifest?.files) ? manifest.files.length : null,
    missingMedia: Array.isArray(manifest?.missing) ? manifest.missing.length : null,
    excludedMedia: Array.isArray(manifest?.excluded) ? manifest.excluded.length : 0,
  };
}
