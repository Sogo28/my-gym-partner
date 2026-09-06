import { File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { DomainError } from '../domain/domain-error';
import { exportBackup, restoreBackup, type Backup } from '../infra/backup';

/**
 * Sauvegarder et restaurer les données.
 *
 * Elles ne vivent que sur le téléphone : sans copie ailleurs, un appareil
 * perdu emporte tout l'historique. Le fichier produit est rangé où
 * l'utilisateur veut -- messagerie, cloud, ordinateur -- l'application ne
 * décide pas à sa place et n'envoie rien nulle part.
 */

/** Le nom du fichier porte la date : deux sauvegardes ne s'écrasent pas. */
function backupFileName(): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  return `my-gym-partner-${stamp}.json`;
}

/**
 * Écrit la sauvegarde puis propose de la partager.
 *
 * Le fichier est écrit dans le cache : c'est une copie de travail destinée à
 * partir ailleurs, pas une donnée que l'application doit conserver.
 */
export async function shareBackup(): Promise<void> {
  const backup = await exportBackup();

  const file = new File(Paths.cache, backupFileName());
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup, null, 2));

  if (!(await isAvailableAsync())) {
    throw new DomainError("Le partage n'est pas disponible sur cet appareil.");
  }

  await shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Sauvegarder mes données',
  });
}

/** Ce qu'une sauvegarde contient, pour l'annoncer avant de l'appliquer. */
export type BackupPreview = {
  readonly backup: Backup;
  readonly exportedAt: Date;
  readonly exercises: number;
  readonly sessions: number;
  readonly performances: number;
};

/**
 * Laisse choisir un fichier et en lit le contenu, SANS rien remplacer.
 *
 * La restauration efface tout : on annonce d'abord ce qu'on s'apprête à
 * écrire, et c'est l'utilisateur qui confirme.
 */
export async function pickBackup(): Promise<BackupPreview | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json'] });
  if (picked.canceled) return null;

  let backup: Backup;
  try {
    backup = JSON.parse(await picked.result.text()) as Backup;
  } catch {
    throw new DomainError("Ce fichier n'est pas lisible comme une sauvegarde.");
  }

  if (backup?.app !== 'my-gym-partner') {
    throw new DomainError("Ce fichier n'est pas une sauvegarde de l'application.");
  }

  return {
    backup,
    exportedAt: new Date(backup.exportedAt),
    exercises: backup.tables.exercises?.length ?? 0,
    sessions: backup.tables.workout_sessions?.length ?? 0,
    performances: backup.tables.exercise_performances?.length ?? 0,
  };
}

/** Remplace toutes les données par celles de la sauvegarde. */
export async function applyBackup(backup: Backup): Promise<void> {
  try {
    await restoreBackup(backup);
  } catch (error) {
    throw new DomainError(error instanceof Error ? error.message : String(error));
  }
}
