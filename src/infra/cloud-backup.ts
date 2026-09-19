import { DomainError } from '../domain/domain-error';
import type { Backup } from './backup';
import { fileNameAt, instantOf } from './cloud-backup-names';
import { supabase } from './supabase';

/**
 * Les sauvegardes déposées chez Supabase, dans le seau `backups`.
 *
 * Chaque compte écrit dans un dossier qui porte son identifiant, et les
 * politiques RLS du projet lui interdisent d'en sortir (`docs/supabase-storage.sql`).
 * L'application ne s'appuie PAS sur ce cloisonnement pour être correcte --
 * elle préfixe elle-même ses chemins -- mais c'est lui qui le garantit :
 * un client mobile est une pièce que n'importe qui peut modifier.
 *
 * Une sauvegarde n'écrase jamais la précédente. Le nom porte l'instant, et
 * les dix dernières restent : une base effacée par erreur puis sauvegardée
 * par-dessus emporterait sinon la seule copie qui valait quelque chose.
 */
const BUCKET = 'backups';

/** Combien de générations on garde. Au-delà, la plus ancienne s'efface. */
export const KEPT_GENERATIONS = 10;

export type CloudBackup = {
  /** Le chemin complet dans le seau, dossier du compte compris. */
  readonly path: string;
  readonly savedAt: Date;
  /** En octets. Zéro quand le serveur ne le dit pas. */
  readonly size: number;
};

/**
 * Les sauvegardes du compte, de la plus récente à la plus ancienne.
 *
 * Le tri est demandé au serveur, par NOM : les noms étant des instants, son
 * ordre alphabétique est le nôtre. Les objets dont le nom ne se lit pas sont
 * ignorés plutôt que devinés -- ils ne viennent pas de cette application.
 */
export async function listCloudBackups(userId: string): Promise<CloudBackup[]> {
  const { data, error } = await supabase()
    .storage.from(BUCKET)
    .list(userId, { limit: 100, sortBy: { column: 'name', order: 'desc' } });

  if (error) throw storageFailure(error);

  return (data ?? []).flatMap((entry) => {
    const savedAt = instantOf(entry.name);
    if (savedAt === null) return [];
    return [
      {
        path: `${userId}/${entry.name}`,
        savedAt,
        size: typeof entry.metadata?.size === 'number' ? entry.metadata.size : 0,
      },
    ];
  });
}

/** Dépose une sauvegarde de plus. N'écrase rien. */
export async function uploadBackup(
  userId: string,
  backup: Backup,
  at: Date,
): Promise<CloudBackup> {
  const body = JSON.stringify(backup);
  const path = `${userId}/${fileNameAt(at)}`;

  const { error } = await supabase()
    .storage.from(BUCKET)
    .upload(path, body, { contentType: 'application/json' });

  if (error) throw storageFailure(error);

  return { path, savedAt: at, size: body.length };
}

/**
 * Relit une sauvegarde déposée.
 *
 * Par URL signée plutôt que par `download()` : celle-ci rend un `Blob`, dont
 * React Native n'implémente pas `text()`. Un `fetch` sur une URL temporaire
 * emprunte le chemin que la plateforme sait faire, et rend directement du
 * JSON.
 */
export async function downloadBackup(path: string): Promise<Backup> {
  const { data, error } = await supabase().storage.from(BUCKET).createSignedUrl(path, 60);
  if (error) throw storageFailure(error);

  const response = await fetch(data.signedUrl);
  if (!response.ok) {
    throw new DomainError('La sauvegarde n’a pas pu être téléchargée. Réessaie.');
  }

  try {
    return (await response.json()) as Backup;
  } catch {
    throw new DomainError('Cette sauvegarde en ligne est illisible.');
  }
}

/** Efface des sauvegardes. Le compte ne peut atteindre que les siennes. */
export async function removeBackups(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase().storage.from(BUCKET).remove(paths);
  if (error) throw storageFailure(error);
}

/**
 * Le refus du stockage, dit à qui s'entraîne.
 *
 * Deux causes valent d'être distinguées, parce qu'elles appellent deux gestes
 * différents : le seau qui n'existe pas encore est une installation à
 * terminer, le reste est une panne ordinaire.
 */
function storageFailure(error: { message: string }): Error {
  if (/bucket not found/i.test(error.message)) {
    return new DomainError(
      'Le seau « backups » n’existe pas encore sur le projet Supabase. Il se crée une fois, avec le script docs/supabase-storage.sql.',
    );
  }
  if (/row-level security|violates|not authorized|permission/i.test(error.message)) {
    return new DomainError(
      'Le projet Supabase refuse cette sauvegarde. Ses politiques d’accès n’ont probablement pas été posées : docs/supabase-storage.sql.',
    );
  }
  return new Error(`Stockage Supabase : ${error.message}`);
}
