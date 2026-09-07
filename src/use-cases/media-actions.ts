import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { DomainError } from '../domain/domain-error';
import type { ExerciseMedia } from '../domain/exercise/media';
import { findAll } from '../infra/exercise-repository';

/** Où vivent les vidéos importées, à côté de la base et jamais dans le cache. */
const FOLDER = 'media';

function mediaDirectory(): Directory {
  const directory = new Directory(Paths.document, FOLDER);
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

/**
 * L'adresse à lire pour ce média.
 *
 * En base, un fichier est enregistré par son SEUL NOM, jamais par son chemin
 * complet : iOS change le dossier de l'application à chaque mise à jour, et
 * des chemins absolus stockés pointeraient un jour dans le vide.
 */
export function mediaUri(media: ExerciseMedia): string {
  if (media.kind === 'link') return media.uri;
  return new File(mediaDirectory(), media.uri).uri;
}

/** Le fichier est-il toujours là ? Une sauvegarde restaurée ailleurs dit non. */
export function mediaExists(media: ExerciseMedia): boolean {
  if (media.kind === 'link') return true;
  return new File(mediaDirectory(), media.uri).exists;
}

/**
 * Choisit une vidéo et en garde une COPIE.
 *
 * Le sélecteur rend un fichier temporaire : s'y référer suffirait aujourd'hui
 * et échouerait demain, quand le système aura fait le ménage.
 */
export async function pickVideo(): Promise<ExerciseMedia | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['video/*'] });
  if (picked.canceled) return null;

  const source = picked.result;
  const extension = source.extension.replace('.', '') || 'mp4';
  const copy = new File(mediaDirectory(), `${randomUUID()}.${extension}`);

  try {
    await source.copy(copy);
  } catch {
    throw new DomainError("Cette vidéo n'a pas pu être copiée dans l'application.");
  }

  return { kind: 'file', uri: copy.name, label: null };
}

/**
 * Efface les vidéos que plus aucun exercice ne réclame.
 *
 * Passe de ramassage plutôt que suppression à la volée : retirer un média
 * d'un formulaire qu'on abandonne ensuite ne doit pas détruire le fichier
 * que l'exercice enregistré référence toujours.
 */
export async function forgetUnusedMedia(): Promise<void> {
  const directory = mediaDirectory();
  const kept = new Set(
    (await findAll()).flatMap((exercise) =>
      exercise.media.filter((media) => media.kind === 'file').map((media) => media.uri),
    ),
  );

  for (const entry of directory.list()) {
    if (entry instanceof File && !kept.has(entry.name)) entry.delete();
  }
}
