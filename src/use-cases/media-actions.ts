import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { DomainError } from '../domain/domain-error';
import { isRemote, type ExerciseMedia } from '../domain/exercise/media';
import { findAll } from '../infra/exercise-repository';
import { findAllSetVideos } from '../infra/performance-repository';

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

/** L'adresse d'un fichier gardé, par son seul nom. Voir `mediaUri`. */
export function fileUri(name: string): string {
  return new File(mediaDirectory(), name).uri;
}

/** Le fichier est-il toujours là ? */
export function fileExists(name: string): boolean {
  return new File(mediaDirectory(), name).exists;
}

/**
 * Garde la captation d'une série, et rend le nom sous lequel la retrouver.
 *
 * La caméra écrit dans le cache : s'y référer marcherait aujourd'hui et
 * échouerait demain, quand le système fera le ménage. On déménage donc le
 * fichier plutôt que de le copier -- personne d'autre ne le réclame, et une
 * vidéo pèse trop lourd pour en garder deux exemplaires le temps d'un
 * effacement.
 */
export async function keepRecording(uri: string): Promise<string> {
  const source = new File(uri);
  const name = `${randomUUID()}.mp4`;
  const kept = new File(ensureMediaDirectory(), name);

  try {
    await source.move(kept);
  } catch {
    throw new DomainError("Cette vidéo n'a pas pu être enregistrée.");
  }
  return name;
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
  // Les captations de séries comptent AUSSI parmi les fichiers réclamés :
  // sans cela, la première passe de ramassage les effacerait toutes, alors
  // qu'aucun exercice ne les référencera jamais.
  const kept = new Set([
    ...(await findAll()).flatMap((exercise) =>
      exercise.media.map((media) => (isRemote(media) ? cacheOf(media.uri).name : media.uri)),
    ),
    ...(await findAllSetVideos()),
  ]);

  for (const entry of directory.list()) {
    if (entry instanceof File && !kept.has(entry.name)) entry.delete();
  }
}
