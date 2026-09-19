import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { exportBackup } from '../infra/backup';
import {
  downloadBackup,
  listCloudBackups,
  removeBackups,
  uploadBackup,
  KEPT_GENERATIONS,
} from '../infra/cloud-backup';
import { readSetting, writeSetting } from '../infra/settings-repository';
import { previewOf, type BackupPreview } from './backup-actions';

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

/** L'empreinte de la dernière sauvegarde envoyée, et son instant. */
const HASH_KEY = 'cloud.lastHash';
const PUSHED_AT_KEY = 'cloud.lastPushedAt';

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
};

export async function cloudState(userId: string): Promise<CloudState> {
  const backups = await listCloudBackups(userId);
  const latest = backups[0];

  return {
    lastSavedAt: latest?.savedAt ?? null,
    generations: backups.length,
    size: latest?.size ?? 0,
  };
}

/**
 * Envoie l'état actuel de la base, sans rien demander ni rien écraser.
 *
 * L'empreinte est retenue pour que l'envoi AUTOMATIQUE puisse se taire quand
 * rien n'a changé -- ouvrir l'application pour consulter son historique ne
 * mérite pas une copie de plus.
 */
export async function pushBackup(userId: string): Promise<Date> {
  const backup = await exportBackup();
  const at = new Date();

  await uploadBackup(userId, backup, at);

  await remember(JSON.stringify(backup), at);
  await pruneOldGenerations(userId);

  return at;
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

    const backup = await exportBackup();
    const serialized = JSON.stringify(backup);
    if ((await fingerprint(serialized)) === (await readSetting(HASH_KEY))) {
      // Rien de neuf. On note quand même le passage : sans cela, chaque
      // retour en arrière-plan relirait la base pour le redécouvrir.
      await writeSetting(PUSHED_AT_KEY, new Date().toISOString());
      return null;
    }

    const at = new Date();
    await uploadBackup(userId, backup, at);
    await remember(serialized, at);
    await pruneOldGenerations(userId);
    return at;
  } catch (error) {
    console.warn('Sauvegarde automatique échouée, sans conséquence :', error);
    return null;
  }
}

/**
 * La dernière sauvegarde en ligne, lue mais PAS appliquée.
 *
 * Comme pour un fichier choisi à la main : on annonce ce qu'on s'apprête à
 * écrire, et c'est l'utilisateur qui décide. `applyBackup` fait le reste.
 */
export async function latestCloudBackup(userId: string): Promise<BackupPreview | null> {
  const [latest] = await listCloudBackups(userId);
  if (latest === undefined) return null;

  return previewOf(await downloadBackup(latest.path));
}

/**
 * Oublie ce qu'on a envoyé, sans toucher au cloud.
 *
 * Se déconnecter puis se reconnecter sur un autre compte ne doit pas faire
 * croire que SA base est déjà sauvegardée : l'empreinte retenue parlait des
 * données d'un autre.
 */
export async function forgetPushHistory(): Promise<void> {
  await writeSetting(HASH_KEY, '');
  await writeSetting(PUSHED_AT_KEY, '');
}

async function remember(serialized: string, at: Date): Promise<void> {
  await writeSetting(HASH_KEY, await fingerprint(serialized));
  await writeSetting(PUSHED_AT_KEY, at.toISOString());
}

async function pushedRecently(): Promise<boolean> {
  const stored = await readSetting(PUSHED_AT_KEY);
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
 * N'en garde que dix.
 *
 * Sans plafond, une sauvegarde automatique toutes les cinq minutes finirait
 * par coûter cher pour des copies que personne ne relira. Dix générations
 * couvrent largement le seul cas qui compte : s'apercevoir d'une bêtise, et
 * remonter avant elle.
 *
 * L'échec du ménage n'est PAS l'échec de la sauvegarde : elle est déjà
 * déposée, et c'est tout ce qu'on lui demandait.
 */
async function pruneOldGenerations(userId: string): Promise<void> {
  try {
    const backups = await listCloudBackups(userId);
    const extra = backups.slice(KEPT_GENERATIONS);
    if (extra.length > 0) await removeBackups(extra.map((entry) => entry.path));
  } catch (error) {
    console.warn('Ménage des anciennes sauvegardes échoué :', error);
  }
}
