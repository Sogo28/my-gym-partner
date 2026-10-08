import { File } from 'expo-file-system';
import { Upload } from 'tus-js-client';
import { DomainError } from '../domain/domain-error';
import type { BackupMedia } from './backup';
import { isSafeMediaName } from './backup-media';
import { BACKUP_BUCKET, storageFailure } from './cloud-backup';
import type { LocalBackupMedia } from './local-media';
import { supabase } from './supabase';
import { tusUrlStorage } from './tus-url-storage';

const MEDIA_FOLDER = 'media';
const PAGE_SIZE = 1000;
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
const MAX_RESUME_AGE_MS = 23 * 60 * 60 * 1000;

/**
 * Lit le fichier morceau par morceau, directement sur le disque.
 *
 * Par défaut, sous React Native, tus-js-client charge le fichier ENTIER en
 * mémoire avant de le découper : une vidéo de plusieurs centaines de Mo
 * pouvait faire tomber l'application. Ici, seul le morceau en cours d'envoi
 * -- 6 Mo -- est en mémoire.
 *
 * tus-js-client lit la taille d'un morceau dans `value.size` : un tableau
 * d'octets n'en a pas, on la lui ajoute. Le XMLHttpRequest de React Native
 * sait envoyer un tableau d'octets tel quel.
 */
const chunkedFileReader = {
  async openFile(input: File) {
    const size = input.size;
    const handle = input.open();
    return {
      size,
      async slice(start: number, end: number) {
        const until = Math.min(end, size);
        handle.offset = start;
        const bytes = handle.readBytes(Math.max(0, until - start));
        return { value: Object.assign(bytes, { size: bytes.length }), done: until >= size };
      },
      close() {
        handle.close();
      },
    };
  },
};

export type CloudMedia = {
  readonly name: string;
  readonly size: number;
};

function mediaPath(userId: string, name: string): string {
  if (!isSafeMediaName(name)) throw new DomainError('Un média porte un nom invalide.');
  return `${userId}/${MEDIA_FOLDER}/${name}`;
}

/** Tous les objets déjà déposés, pour ne jamais renvoyer le même UUID. */
export async function listCloudMedia(userId: string): Promise<CloudMedia[]> {
  const found: CloudMedia[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase()
      .storage.from(BACKUP_BUCKET)
      .list(`${userId}/${MEDIA_FOLDER}`, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
    if (error) throw storageFailure(error);

    const page = (data ?? []).flatMap((entry) =>
      entry.id
        ? [{ name: entry.name, size: typeof entry.metadata?.size === 'number' ? entry.metadata.size : 0 }]
        : [],
    );
    found.push(...page);
    if ((data ?? []).length < PAGE_SIZE) return found;
    offset += PAGE_SIZE;
  }
}

/**
 * Dépose un fichier par morceaux reprenables. Une coupure au milieu d'une
 * vidéo ne renvoie ni les morceaux acceptés, ni les autres médias déjà là.
 */
export async function uploadCloudMedia(
  userId: string,
  media: LocalBackupMedia,
  onProgress?: (sent: number, total: number) => void,
): Promise<void> {
  const path = mediaPath(userId, media.name);
  const { data } = await supabase().auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new DomainError('La session a expiré. Reconnecte-toi pour sauvegarder.');

  const fingerprint = `${userId}:${media.name}:${media.size}:${media.md5 ?? ''}`;
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(media.file, {
      endpoint: resumableEndpoint(),
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-upsert': 'true',
      },
      metadata: {
        bucketName: BACKUP_BUCKET,
        objectName: path,
        contentType: media.contentType,
        cacheControl: '31536000',
      },
      chunkSize: TUS_CHUNK_SIZE,
      fileReader: chunkedFileReader,
      retryDelays: [0, 3_000, 5_000, 10_000, 20_000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      storeFingerprintForResuming: true,
      urlStorage: tusUrlStorage,
      fingerprint: async () => fingerprint,
      onProgress,
      onError: (error) =>
        reject(new DomainError(`Le média « ${media.name} » n’a pas pu être sauvegardé : ${error.message}`)),
      onSuccess: () => resolve(),
    });

    upload
      .findPreviousUploads()
      .then(async (previous) => {
        const valid = previous.find(
          (entry) =>
            entry.uploadUrl &&
            Date.now() - new Date(entry.creationTime).getTime() < MAX_RESUME_AGE_MS,
        );
        await Promise.all(
          previous
            .filter((entry) => entry !== valid)
            .map((entry) => tusUrlStorage.removeUpload(entry.urlStorageKey)),
        );
        if (valid) upload.resumeFromPreviousUpload(valid);
        upload.start();
      })
      .catch(reject);
  });
}

/** Télécharge vers le sas local ; l'appelant vérifie taille et empreinte. */
export async function downloadCloudMedia(
  userId: string,
  media: BackupMedia,
  destination: File,
): Promise<File> {
  const path = mediaPath(userId, media.name);
  const { data, error } = await supabase()
    .storage.from(BACKUP_BUCKET)
    .createSignedUrl(path, 10 * 60, {
      // Un objet est immuable en fonctionnement normal. Ce nonce protège tout
      // de même une réparation en écrasement d'une ancienne réponse CDN.
      cacheNonce: media.md5 ?? String(media.size),
    });
  if (error) throw storageFailure(error);

  try {
    return await File.downloadFileAsync(data.signedUrl, destination, { idempotent: true });
  } catch {
    throw new DomainError(`Le média « ${media.name} » n’a pas pu être téléchargé.`);
  }
}

export async function removeCloudMedia(userId: string, names: readonly string[]): Promise<void> {
  if (names.length === 0) return;
  const paths = names.map((name) => mediaPath(userId, name));
  const { error } = await supabase().storage.from(BACKUP_BUCKET).remove(paths);
  if (error) throw storageFailure(error);
}

function resumableEndpoint(): string {
  const configured = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!configured) throw new Error('Supabase non configuré.');

  const url = new URL(configured);
  const project = /^(?<project>[^.]+)\.supabase\.co$/i.exec(url.hostname)?.groups?.project;
  return project
    ? `https://${project}.storage.supabase.co/storage/v1/upload/resumable`
    : `${configured.replace(/\/$/, '')}/storage/v1/upload/resumable`;
}
