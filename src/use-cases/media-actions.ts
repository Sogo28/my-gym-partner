import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { DomainError } from '../domain/domain-error';
import { isRemote, type ExerciseMedia } from '../domain/exercise/media';
import { findAll } from '../infra/exercise-repository';
import { findAllSetVideos } from '../infra/performance-repository';
import { findAllSessionPhotos } from '../infra/workout-session-repository';

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
 * L'extension d'une image ou vidéo choisie dans la galerie.
 *
 * Le nom du fichier la porte le plus souvent ; à défaut, le type MIME.
 * `File.pickFileAsync` la lisait sur un chemin de fichier classique -- la
 * galerie ne rend ni l'un ni l'autre de la même façon.
 */
function extensionOf(asset: ImagePicker.ImagePickerAsset, fallback: string): string {
  const fromName = asset.fileName?.split('.').pop();
  if (fromName) return fromName.toLowerCase();
  return asset.mimeType?.split('/').pop()?.toLowerCase() || fallback;
}

/**
 * Copie dans l'application le fichier qu'un sélecteur vient de rendre.
 *
 * Une COPIE et non un déplacement : contrairement à une captation qui sort du
 * cache de la caméra et n'appartient qu'à nous, un fichier choisi dans la
 * galerie reste celui de l'utilisateur -- lui retirer son original serait la
 * dernière chose à faire pour lui rendre service.
 */
async function copyPicked(sourceUri: string, extension: string): Promise<File> {
  const copy = new File(ensureMediaDirectory(), `${randomUUID()}.${extension}`);
  await new File(sourceUri).copy(copy);
  return copy;
}

/**
 * Choisit une démonstration -- image ou vidéo -- dans la galerie, et en
 * garde une copie.
 *
 * Un seul geste pour les deux : celui qui ajoute une démonstration se demande
 * quoi montrer, pas de quel type de fichier il s'agit.
 */
export async function pickDemonstration(): Promise<ExerciseMedia | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    quality: 1,
  });
  if (picked.canceled) return null;

  const asset = picked.assets[0];
  const kind = asset.type === 'video' ? 'video' : 'image';
  const extension = extensionOf(asset, kind === 'video' ? 'mp4' : 'jpg');

  let copy: File;
  try {
    copy = await copyPicked(asset.uri, extension);
  } catch {
    throw new DomainError("Cette démonstration n'a pas pu être copiée dans l'application.");
  }

  // Bornes vides : une vidéo se lit en entier tant qu'on ne l'a pas rognée.
  return { kind, uri: copy.name, label: null, trim: null };
}

/**
 * Choisit la photo de fin de séance dans la galerie, et en garde une copie.
 *
 * Une image seulement -- rien à rogner, rien à montrer en boucle comme une
 * démonstration : c'est un instantané, pas une captation.
 */
export async function pickSessionPhoto(): Promise<string | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (picked.canceled) return null;

  const asset = picked.assets[0];

  try {
    const copy = await copyPicked(asset.uri, extensionOf(asset, 'jpg'));
    return copy.name;
  } catch {
    throw new DomainError("Cette photo n'a pas pu être copiée dans l'application.");
  }
}

/**
 * Choisit dans la galerie la captation d'une série déjà faite, et en garde
 * une copie.
 *
 * Complète l'enregistrement en direct (§ record.tsx, expo-camera) : une
 * série filmée avec l'appareil photo du téléphone plutôt que depuis l'app,
 * ou une captation ratée qu'on veut remplacer après coup, doit pouvoir
 * s'attacher sans être passée par le compte à rebours de la caméra intégrée.
 */
export async function pickSetVideo(): Promise<string | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    quality: 1,
  });
  if (picked.canceled) return null;

  const asset = picked.assets[0];

  try {
    const copy = await copyPicked(asset.uri, extensionOf(asset, 'mp4'));
    return copy.name;
  } catch {
    throw new DomainError("Cette vidéo n'a pas pu être copiée dans l'application.");
  }
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
  // Pas de système de fichiers -- la version web, qui ne sert qu'à regarder
  // les écrans --, donc rien à ramasser : la passe s'arrête là au lieu de
  // faire échouer l'enregistrement qui l'a déclenchée.
  let directory: ReturnType<typeof mediaDirectory>;
  try {
    directory = mediaDirectory();
  } catch {
    return;
  }
  if (!directory.exists) return;
  // Les captations de séries comptent AUSSI parmi les fichiers réclamés :
  // sans cela, la première passe de ramassage les effacerait toutes, alors
  // qu'aucun exercice ne les référencera jamais.
  const kept = new Set([
    ...(await findAll()).flatMap((exercise) =>
      exercise.media.map((media) => (isRemote(media) ? cacheOf(media.uri).name : media.uri)),
    ),
    ...(await findAllSetVideos()),
    ...(await findAllSessionPhotos()),
  ]);

  for (const entry of directory.list()) {
    if (entry instanceof File && !kept.has(entry.name)) entry.delete();
  }
}
