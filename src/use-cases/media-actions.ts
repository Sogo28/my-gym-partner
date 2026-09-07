import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { DomainError } from '../domain/domain-error';
import { isRemote, type ExerciseMedia } from '../domain/exercise/media';
import { findAll } from '../infra/exercise-repository';

/** Où vivent les vidéos importées, à côté de la base et jamais dans le cache. */
const FOLDER = 'media';

/**
 * Le dossier, sans le créer : `mediaUri` est appelé pendant un RENDU, et
 * écrire sur le disque en dessinant un écran est une surprise qu'on finit
 * toujours par payer.
 */
function mediaDirectory(): Directory {
  return new Directory(Paths.document, FOLDER);
}

/** Sa création n'a lieu qu'au moment d'y déposer un fichier. */
function ensureMediaDirectory(): Directory {
  const directory = mediaDirectory();
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
  if (isRemote(media)) return media.uri;
  return new File(mediaDirectory(), media.uri).uri;
}

/** Le fichier est-il toujours là ? Une sauvegarde restaurée ailleurs dit non. */
export function mediaExists(media: ExerciseMedia): boolean {
  if (isRemote(media)) return true;
  return new File(mediaDirectory(), media.uri).exists;
}

/**
 * Choisit une démonstration -- image ou vidéo -- et en garde une COPIE.
 *
 * Un seul geste pour les deux : celui qui ajoute une démonstration se demande
 * quoi montrer, pas de quel type de fichier il s'agit. Le sélecteur rend un
 * fichier temporaire : s'y référer suffirait aujourd'hui et échouerait demain,
 * quand le système aura fait le ménage.
 */
export async function pickDemonstration(): Promise<ExerciseMedia | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['image/*', 'video/*'] });
  if (picked.canceled) return null;

  const source = picked.result;
  const extension = source.extension.replace('.', '') || 'mp4';
  const copy = new File(ensureMediaDirectory(), `${randomUUID()}.${extension}`);

  try {
    await source.copy(copy);
  } catch {
    throw new DomainError("Cette vidéo n'a pas pu être copiée dans l'application.");
  }

  // L'extension dit ce que c'est : le sélecteur, lui, ne le dit pas.
  const kind = /^(mp4|mov|m4v|webm|avi|mkv)$/i.test(extension) ? 'video' : 'image';

  // Bornes vides : une vidéo se lit en entier tant qu'on ne l'a pas rognée.
  return { kind, uri: copy.name, label: null, trim: null };
}

/**
 * Le fichier où se cache une image distante, qu'elle soit déjà là ou non.
 *
 * Le nom vient de l'ADRESSE : deux exercices qui partagent une illustration
 * partagent son fichier, et une image perdue se retrouve sans avoir stocké
 * quoi que ce soit de plus.
 */
function cacheOf(uri: string): File {
  const name = uri.split('/').pop() ?? 'image';
  return new File(mediaDirectory(), name.replace(/[^\w.-]/g, '_'));
}

/**
 * L'adresse locale d'une image distante, téléchargée au premier besoin.
 *
 * L'adresse reste la vérité, la copie n'est qu'un cache : une sauvegarde
 * restaurée sur un autre téléphone rapporte la ligne, et l'image revient
 * d'elle-même à la première consultation.
 */
export async function cachedImage(uri: string): Promise<string> {
  const cached = cacheOf(uri);
  if (cached.exists) return cached.uri;

  ensureMediaDirectory();
  const downloaded = await File.downloadFileAsync(uri, cached);
  return downloaded.uri;
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
  if (!directory.exists) return;
  const kept = new Set(
    (await findAll()).flatMap((exercise) =>
      exercise.media.map((media) => (isRemote(media) ? cacheOf(media.uri).name : media.uri)),
    ),
  );

  for (const entry of directory.list()) {
    if (entry instanceof File && !kept.has(entry.name)) entry.delete();
  }
}
