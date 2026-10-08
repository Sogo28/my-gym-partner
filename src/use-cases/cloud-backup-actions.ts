import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { DomainError } from '../domain/domain-error';
import {
  exportBackup,
  restoreBackup,
  type Backup,
} from '../infra/backup';
import { mediaNamesOf, setVideoNamesOf, validateMediaManifest } from '../infra/backup-media';
import { includeSetVideosInBackup } from './preferences';
import {
  downloadBackup,
  listCloudBackups,
  removeBackups,
  uploadBackup,
  KEPT_GENERATIONS,
} from '../infra/cloud-backup';
import {
  downloadCloudMedia,
  listCloudMedia,
  removeCloudMedia,
  uploadCloudMedia,
} from '../infra/cloud-media';
import {
  assertDownloadedMedia,
  createMediaRestoreStage,
  discardMediaRestoreStage,
  hasLocalMedia,
  inspectLocalMedia,
  installStagedMedia,
  stagedMediaFile,
  type LocalBackupMedia,
} from '../infra/local-media';
import { readSetting, writeSetting } from '../infra/settings-repository';
import { previewOf, type BackupPreview } from './backup-actions';
import {
  backupStatePayload,
  CLOUD_GENERATIONS_KEY,
  CLOUD_HASH_KEY,
  CLOUD_MEDIA_MD5_KEY,
  CLOUD_PUSHED_AT_KEY,
} from './cloud-backup-state';

/**
 * La sauvegarde en ligne, rattachée au compte connecté.
 *
 * Le dossier technique l'écrivait noir sur blanc : « Risque principal --
 * aucune sauvegarde. Les données n'existent que sur l'appareil. » C'est ce
 * que ce fichier corrige, et rien de plus : ce n'est PAS une synchronisation.
 * Le téléphone reste la vérité, le cloud en garde des copies datées.
 *
 * La conséquence est à connaître : restaurer REMPLACE tout. Deux appareils
 * qui s'entraîneraient en parallèle s'écraseraient l'un l'autre, et c'est
 * pourquoi l'application ne les propose pas.
 */

/**
 * Le délai minimal entre deux envois automatiques.
 *
 * Il ne protège pas le serveur mais le téléphone : chaque vérification lit
 * la base entière pour en calculer l'empreinte. Passer d'un écran à l'autre
 * ne doit pas déclencher ce travail dix fois par minute.
 */
const MIN_INTERVAL_MS = 5 * 60_000;

export type CloudState = {
  readonly lastSavedAt: Date | null;
  /** Combien de copies le compte détient en ligne. */
  readonly generations: number;
  /** La taille de la plus récente, en octets. */
  readonly size: number;
  /** Les fichiers mutualisés entre les générations. */
  readonly mediaFiles: number;
  readonly mediaSize: number;
};

export async function cloudState(userId: string): Promise<CloudState> {
  const [backups, media] = await Promise.all([listCloudBackups(userId), listCloudMedia(userId)]);
  const latest = backups[0];

  return {
    lastSavedAt: latest?.savedAt ?? null,
    generations: backups.length,
    size: latest?.size ?? 0,
    mediaFiles: media.length,
    mediaSize: media.reduce((total, file) => total + file.size, 0),
  };
}

export type CloudPushResult = {
  readonly savedAt: Date;
  readonly mediaFiles: number;
  /** Absents du téléphone au moment de la copie. */
  readonly missingMedia: number;
  /** Les vidéos de séries laissées de côté, par choix. */
  readonly excludedMedia: number;
  /**
   * Présents, mais refusés à l'envoi -- trop lourds pour le projet, le plus
   * souvent. La copie part sans eux, et le prochain envoi les retentera.
   */
  readonly failedMedia: number;
};

export type CloudPushProgress = {
  readonly sent: number;
  readonly total: number;
};

/**
 * Envoie l'état actuel de la base, sans rien demander ni rien écraser.
 *
 * L'empreinte est retenue pour que l'envoi AUTOMATIQUE puisse se taire quand
 * rien n'a changé -- ouvrir l'application pour consulter son historique ne
 * mérite pas une copie de plus.
 */
export async function pushBackup(
  userId: string,
  onProgress?: (progress: CloudPushProgress) => void,
): Promise<CloudPushResult> {
  return send(userId, await prepareBackup(), onProgress);
}

/**
 * Envoie, mais seulement si ça vaut la peine.
 *
 * Deux raisons de s'abstenir, dans cet ordre : c'était il y a moins de cinq
 * minutes, ou rien n'a changé depuis. Rend l'instant de l'envoi, ou null
 * quand il n'a pas eu lieu.
 *
 * Aucune erreur n'en sort : un envoi automatique qui échoue -- réseau absent
 * au fond d'une salle -- ne doit rien interrompre ni rien annoncer. Le
 * prochain passage réessaiera, et l'écran du profil dit la vérité sur la
 * date de la dernière copie.
 */
export async function pushBackupIfWorthwhile(userId: string): Promise<Date | null> {
  try {
    if (await pushedRecently()) return null;

    const { backup, localMedia } = await prepareBackup();
    const payload = backupStatePayload(backup);
    if ((await fingerprint(payload)) === (await readSetting(CLOUD_HASH_KEY))) {
      // Rien de neuf. On note quand même le passage : sans cela, chaque
      // retour en arrière-plan relirait la base pour le redécouvrir.
      await writeSetting(CLOUD_PUSHED_AT_KEY, new Date().toISOString());
      return null;
    }

    return (await send(userId, { backup, localMedia })).savedAt;
  } catch (error) {
    console.warn('Sauvegarde automatique échouée, sans conséquence :', error);
    return null;
  }
}

/**
 * La dernière sauvegarde en ligne, lue mais PAS appliquée.
 *
 * Comme pour un fichier choisi à la main : on annonce ce qu'on s'apprête à
 * écrire, et c'est l'utilisateur qui décide. `applyCloudBackup` fait le reste.
 */
export async function latestCloudBackup(userId: string): Promise<BackupPreview | null> {
  const [latest] = await listCloudBackups(userId);
  if (latest === undefined) return null;

  return previewOf(await downloadBackup(latest.path));
}

export type CloudRestoreResult = {
  /** `false` pour une ancienne génération qui ne savait sauver que SQLite. */
  readonly includedMedia: boolean;
  readonly restoredMedia: number;
  readonly missingMedia: number;
  /** Les vidéos de séries que cette copie avait laissées de côté. */
  readonly excludedMedia: number;
};

/**
 * Rapatrie tous les fichiers dans un sas AVANT de toucher à SQLite.
 *
 * Une coupure réseau laisse ainsi les données actuelles intactes. Les médias
 * validés deviennent durables juste avant le remplacement transactionnel de
 * la base ; s'il échoue ensuite, quelques fichiers sans référence sont le seul
 * résidu possible et pourront être ramassés plus tard.
 */
export async function applyCloudBackup(userId: string, backup: Backup): Promise<CloudRestoreResult> {
  if (backup.media === undefined) {
    await restoreAsDomainError(backup);
    return { includedMedia: false, restoredMedia: 0, missingMedia: 0, excludedMedia: 0 };
  }

  const manifest = validateMediaManifest(backup);
  const stage = createMediaRestoreStage();
  try {
    for (const media of manifest.files) {
      if (hasLocalMedia(media)) continue;
      const destination = stagedMediaFile(stage, media.name);
      const downloaded = await downloadCloudMedia(userId, media, destination);
      assertDownloadedMedia(downloaded, media);
    }

    await installStagedMedia(stage);
    await restoreAsDomainError(backup);
    return {
      includedMedia: true,
      restoredMedia: manifest.files.length,
      missingMedia: manifest.missing.length,
      excludedMedia: manifest.excluded?.length ?? 0,
    };
  } finally {
    discardMediaRestoreStage(stage);
  }
}

/**
 * Oublie ce qu'on a envoyé, sans toucher au cloud.
 *
 * Se déconnecter puis se reconnecter sur un autre compte ne doit pas faire
 * croire que SA base est déjà sauvegardée : l'empreinte retenue parlait des
 * données d'un autre.
 */
export async function forgetPushHistory(): Promise<void> {
  await writeSetting(CLOUD_HASH_KEY, '');
  await writeSetting(CLOUD_PUSHED_AT_KEY, '');
}

async function remember(payload: string, at: Date): Promise<void> {
  await writeSetting(CLOUD_HASH_KEY, await fingerprint(payload));
  await writeSetting(CLOUD_PUSHED_AT_KEY, at.toISOString());
}

async function pushedRecently(): Promise<boolean> {
  const stored = await readSetting(CLOUD_PUSHED_AT_KEY);
  if (!stored) return false;

  const last = new Date(stored).getTime();
  if (Number.isNaN(last)) return false;

  return Date.now() - last < MIN_INTERVAL_MS;
}

/** Une empreinte, pour comparer deux états sans les comparer en entier. */
function fingerprint(serialized: string): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, serialized);
}

/**
 * Envoie les médias manquants, puis la copie de la base.
 *
 * Un média REFUSÉ -- une vidéo plus lourde que ce que le projet accepte --
 * ne bloque plus tout : avant, la base ne partait pas non plus, à chaque
 * tentative, et la sauvegarde automatique le taisait. Il passe dans les
 * absents de CETTE copie, qui reste ainsi honnête à la restauration, et le
 * prochain envoi le retentera.
 */
async function send(
  userId: string,
  { backup, localMedia }: { backup: Backup; localMedia: readonly LocalBackupMedia[] },
  onProgress?: (progress: CloudPushProgress) => void,
): Promise<CloudPushResult> {
  const failed = await uploadMissingMedia(userId, localMedia, onProgress);
  const manifest = backup.media ?? { files: [], missing: [] };
  const sent: Backup =
    failed.size === 0
      ? backup
      : {
          ...backup,
          media: {
            ...manifest,
            files: manifest.files.filter((media) => !failed.has(media.name)),
            missing: [...manifest.missing, ...failed].sort(),
          },
        };

  const at = new Date();
  const uploaded = await uploadBackup(userId, sent, at);
  // L'empreinte de ce qui est PARTI : avec des médias refusés, elle diffère
  // de l'état du téléphone, et le prochain envoi automatique réessaiera.
  await remember(backupStatePayload(sent), at);
  await pruneOldGenerations(userId, {
    path: uploaded.path,
    names: sent.media?.files.map((media) => media.name) ?? [],
  });

  return {
    savedAt: at,
    mediaFiles: sent.media?.files.length ?? 0,
    missingMedia: manifest.missing.length,
    excludedMedia: manifest.excluded?.length ?? 0,
    failedMedia: failed.size,
  };
}

/**
 * N'en garde que dix.
 *
 * Sans plafond, une sauvegarde automatique toutes les cinq minutes finirait
 * par coûter cher pour des copies que personne ne relira. Dix générations
 * couvrent largement le seul cas qui compte : s'apercevoir d'une bêtise, et
 * remonter avant elle.
 *
 * Les médias cités par chaque génération sont retenus sur le téléphone
 * (`CLOUD_GENERATIONS_KEY`) : avant, le ménage retéléchargeait les dix copies
 * à chaque envoi pour les relire. Seule une génération inconnue -- déposée
 * par un autre téléphone, ou avant ce registre -- est encore relue, une fois.
 *
 * L'échec du ménage n'est PAS l'échec de la sauvegarde : elle est déjà
 * déposée, et c'est tout ce qu'on lui demandait.
 */
async function pruneOldGenerations(
  userId: string,
  justSent: { path: string; names: string[] },
): Promise<void> {
  try {
    const backups = await listCloudBackups(userId);
    const extra = backups.slice(KEPT_GENERATIONS);
    if (extra.length > 0) await removeBackups(extra.map((entry) => entry.path));

    const known = readRecord<string[]>(await readSetting(CLOUD_GENERATIONS_KEY));
    known[justSent.path] = justSent.names;

    // Les objets sont partagés par les générations : un fichier ne devient
    // effaçable que lorsque AUCUN des dix manifestes conservés ne le cite.
    const kept = backups.slice(0, KEPT_GENERATIONS);
    const registry: Record<string, string[]> = {};
    for (const entry of kept) {
      registry[entry.path] =
        known[entry.path] ??
        (await downloadBackup(entry.path)).media?.files.map((file) => file.name) ??
        [];
    }
    await writeSetting(CLOUD_GENERATIONS_KEY, JSON.stringify(registry));

    const protectedNames = new Set(Object.values(registry).flat());
    const remoteMedia = await listCloudMedia(userId);
    const unused = remoteMedia.filter((file) => !protectedNames.has(file.name));
    if (unused.length > 0) await removeCloudMedia(userId, unused.map((file) => file.name));
  } catch (error) {
    console.warn('Ménage des anciennes sauvegardes échoué :', error);
  }
}

/** Un registre JSON tenu dans les réglages ; abîmé ou absent, il repart vide. */
function readRecord<T>(stored: string | null): Record<string, T> {
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, T>) : {};
  } catch {
    return {};
  }
}

async function prepareBackup(): Promise<{
  backup: Backup;
  localMedia: readonly LocalBackupMedia[];
}> {
  const database = await exportBackup();
  const knownMd5 = readRecord<{ size: number; md5: string }>(
    await readSetting(CLOUD_MEDIA_MD5_KEY),
  );
  // Les vidéos des séries restent hors de la copie quand on l'a choisi :
  // citées comme EXCLUES, la restauration sait qu'elles manquent exprès.
  const excluded = (await includeSetVideosInBackup()) ? [] : setVideoNamesOf(database);
  const skipped = new Set(excluded);
  const inventory = inspectLocalMedia(
    mediaNamesOf(database).filter((name) => !skipped.has(name)),
    knownMd5,
  );

  // Les empreintes calculées cette fois sont gardées pour les suivantes --
  // et seules celles des fichiers encore là : un média effacé n'y reste pas.
  const nextMd5 = Object.fromEntries(
    inventory.files.flatMap((media) =>
      media.md5 ? [[media.name, { size: media.size, md5: media.md5 }]] : [],
    ),
  );
  if (JSON.stringify(nextMd5) !== JSON.stringify(knownMd5)) {
    await writeSetting(CLOUD_MEDIA_MD5_KEY, JSON.stringify(nextMd5));
  }

  return {
    backup: { ...database, media: { ...inventory.manifest, excluded } },
    localMedia: inventory.files,
  };
}

/** Envoie ce qui manque en ligne, et rend les noms de ceux qui ont été refusés. */
async function uploadMissingMedia(
  userId: string,
  localMedia: readonly LocalBackupMedia[],
  onProgress?: (progress: CloudPushProgress) => void,
): Promise<Set<string>> {
  const remote = new Map((await listCloudMedia(userId)).map((file) => [file.name, file.size]));
  const pending = localMedia.filter((media) => remote.get(media.name) !== media.size);
  const total = pending.reduce((sum, media) => sum + media.size, 0);
  const failed = new Set<string>();
  let completed = 0;
  if (total > 0) onProgress?.({ sent: 0, total });

  for (const media of pending) {
    try {
      // Borné à la taille du fichier : le compte d'octets de l'envoi peut
      // dépasser celle-ci -- en-têtes, morceau renvoyé après une coupure --,
      // et le pourcentage passait au-delà de 100 % avant d'y revenir.
      await uploadCloudMedia(userId, media, (sent) =>
        onProgress?.({ sent: completed + Math.min(sent, media.size), total }),
      );
    } catch (error) {
      console.warn(`Média non sauvegardé (${media.name}) :`, error);
      failed.add(media.name);
    }
    completed += media.size;
    onProgress?.({ sent: Math.min(completed, total), total });
  }
  return failed;
}

async function restoreAsDomainError(backup: Backup): Promise<void> {
  try {
    await restoreBackup(backup);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError(error instanceof Error ? error.message : String(error));
  }
}
