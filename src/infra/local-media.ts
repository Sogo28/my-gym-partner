import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { DomainError } from '../domain/domain-error';
import type { BackupMedia, BackupMediaManifest } from './backup';
import { assertMediaDescription, isSafeMediaName } from './backup-media';

const MEDIA_FOLDER = 'media';
const RESTORE_FOLDER = 'cloud-media-restore';

/** Le dossier durable où vivent les photos et vidéos appartenant à l'app. */
export function mediaDirectory(): Directory {
  return new Directory(Paths.document, MEDIA_FOLDER);
}

/** Sa création n'a lieu qu'au premier fichier écrit. */
export function ensureMediaDirectory(): Directory {
  const directory = mediaDirectory();
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

export function localMediaFile(name: string): File {
  assertSafeName(name);
  return new File(mediaDirectory(), name);
}

export type LocalBackupMedia = BackupMedia & { readonly file: File };

/**
 * Décrit les fichiers présents sans lire leur contenu en JavaScript.
 * `size`, `type` et `md5` sont fournis par l'API native d'Expo.
 *
 * L'empreinte d'un fichier se calcule en le relisant EN ENTIER, d'un bloc :
 * pour quelques centaines de Mo de vidéos, l'écran se figeait à chaque
 * retour au premier plan. Elle ne se calcule donc qu'une fois par fichier
 * (`knownMd5`, tenu par l'appelant) : les noms sont des UUID, un fichier ne
 * change jamais de contenu sans changer de nom. Sa taille suffit à
 * reconnaître celui qu'on a déjà haché.
 */
export function inspectLocalMedia(
  names: readonly string[],
  knownMd5: Readonly<Record<string, { size: number; md5: string }>> = {},
): {
  readonly files: readonly LocalBackupMedia[];
  readonly manifest: BackupMediaManifest;
} {
  const files: LocalBackupMedia[] = [];
  const missing: string[] = [];

  for (const name of [...new Set(names)].sort()) {
    assertSafeName(name);
    let file: File;
    try {
      file = localMediaFile(name);
    } catch {
      missing.push(name);
      continue;
    }

    if (!file.exists) {
      missing.push(name);
      continue;
    }

    const size = file.size;
    const known = knownMd5[name];
    files.push({
      name,
      size,
      md5: known && known.size === size ? known.md5 : file.md5,
      contentType: file.type || contentTypeOf(name),
      file,
    });
  }

  return {
    files,
    manifest: {
      files: files.map(({ file: _file, ...description }) => description),
      missing,
    },
  };
}

export type MediaRestoreStage = {
  readonly directory: Directory;
  readonly downloaded: Map<string, File>;
};

/** Un sas : rien dans les médias durables ne bouge tant que tout n'est pas téléchargé. */
export function createMediaRestoreStage(): MediaRestoreStage {
  const root = new Directory(Paths.cache, RESTORE_FOLDER);
  if (!root.exists) root.create({ intermediates: true });

  const directory = new Directory(root, randomUUID());
  directory.create();
  return { directory, downloaded: new Map() };
}

export function stagedMediaFile(stage: MediaRestoreStage, name: string): File {
  assertSafeName(name);
  const file = new File(stage.directory, name);
  stage.downloaded.set(name, file);
  return file;
}

/** Un fichier local déjà identique n'a pas besoin de refaire le voyage. */
export function hasLocalMedia(media: BackupMedia): boolean {
  assertMediaDescription(media);
  const file = localMediaFile(media.name);
  if (!file.exists || file.size !== media.size) return false;
  return media.md5 === null || file.md5 === media.md5;
}

export function assertDownloadedMedia(file: File, media: BackupMedia): void {
  if (!file.exists || file.size !== media.size || (media.md5 !== null && file.md5 !== media.md5)) {
    throw new DomainError(`Le média « ${media.name} » téléchargé est incomplet.`);
  }
}

/**
 * Rend les téléchargements durables. En cas d'échec ultérieur de la base, ces
 * fichiers supplémentaires sont inoffensifs : aucune ligne ne les référence.
 */
export async function installStagedMedia(stage: MediaRestoreStage): Promise<void> {
  const destination = ensureMediaDirectory();
  for (const [name, staged] of stage.downloaded) {
    const target = new File(destination, name);
    if (target.exists) target.delete();
    await staged.move(target);
  }
}

export function discardMediaRestoreStage(stage: MediaRestoreStage): void {
  if (stage.directory.exists) stage.directory.delete();
}

function assertSafeName(name: string): void {
  if (!isSafeMediaName(name)) {
    throw new DomainError('Cette sauvegarde contient un chemin de média invalide.');
  }
}

function contentTypeOf(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase();
  const known: Record<string, string> = {
    gif: 'image/gif',
    heic: 'image/heic',
    heif: 'image/heif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    m4v: 'video/x-m4v',
    mov: 'video/quicktime',
    mp4: 'video/mp4',
    png: 'image/png',
    webm: 'video/webm',
    webp: 'image/webp',
  };
  return (extension && known[extension]) || 'application/octet-stream';
}
