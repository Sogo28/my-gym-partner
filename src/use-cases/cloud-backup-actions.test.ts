import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCleanDatabase } from '../../test/support';
import type { Backup } from '../infra/backup';
import { writeSetting } from '../infra/settings-repository';

/**
 * Le stockage en ligne et les fichiers du téléphone, en mémoire : ce sont
 * les seules pièces que Node ne sait pas faire tourner. Tout le reste -- la
 * base, les règles d'envoi, le ménage -- est le vrai code.
 */
const cloud = vi.hoisted(() => ({
  backups: new Map<string, { savedAt: Date; backup: Backup }>(),
  media: new Map<string, number>(),
  uploads: [] as string[],
  clock: 0,
}));
const local = vi.hoisted(() => new Map<string, number>());

vi.mock('../infra/cloud-backup', () => ({
  KEPT_GENERATIONS: 10,
  listCloudBackups: async (userId: string) =>
    [...cloud.backups.entries()]
      .filter(([path]) => path.startsWith(`${userId}/`))
      .map(([path, entry]) => ({ path, savedAt: entry.savedAt, size: 1 }))
      .sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime()),
  uploadBackup: async (userId: string, backup: Backup) => {
    // Des instants qui avancent toujours : deux envois du même test ne
    // tombent pas dans la même milliseconde.
    cloud.clock += 1000;
    const savedAt = new Date(Date.UTC(2026, 9, 11, 9, 0, 0) + cloud.clock);
    const path = `${userId}/${savedAt.toISOString()}.json`;
    cloud.backups.set(path, { savedAt, backup: JSON.parse(JSON.stringify(backup)) as Backup });
    return { path, savedAt, size: 1 };
  },
  downloadBackup: async (path: string) => cloud.backups.get(path)!.backup,
  removeBackups: async (paths: string[]) => paths.forEach((path) => cloud.backups.delete(path)),
}));

vi.mock('../infra/cloud-media', () => ({
  listCloudMedia: async () => [...cloud.media].map(([name, size]) => ({ name, size })),
  uploadCloudMedia: async (_userId: string, media: { name: string; size: number }) => {
    cloud.uploads.push(media.name);
    cloud.media.set(media.name, media.size);
  },
  downloadCloudMedia: async () => ({}),
  removeCloudMedia: async (_userId: string, names: readonly string[]) =>
    names.forEach((name) => cloud.media.delete(name)),
}));

vi.mock('../infra/local-media', () => ({
  inspectLocalMedia: (names: readonly string[]) => {
    const present = [...new Set(names)].sort().filter((name) => local.has(name));
    const files = present.map((name) => ({
      name,
      size: local.get(name)!,
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
      contentType: 'video/mp4',
      file: {},
    }));
    return {
      files,
      manifest: {
        files: files.map(({ file: _file, ...media }) => media),
        missing: [...new Set(names)].sort().filter((name) => !local.has(name)),
      },
    };
  },
  hasLocalMedia: () => true,
  createMediaRestoreStage: () => ({}),
  stagedMediaFile: () => ({}),
  assertDownloadedMedia: () => undefined,
  installStagedMedia: async () => undefined,
  discardMediaRestoreStage: () => undefined,
}));

const {
  applyCloudBackup,
  listCloudCopies,
  MAX_CLOUD_MEDIA_BYTES,
  pushBackup,
  pushBackupIfWorthwhile,
} = await import('./cloud-backup-actions');
const { attachSessionPhoto } = await import('./session-photo');
const { finishWorkoutSession, startWorkoutSession } = await import('./workout-session-actions');
const { CLOUD_PUSHED_AT_KEY } = await import('./cloud-backup-state');

useCleanDatabase();

const USER = 'user-1';
const PHOTO = '11111111-1111-4111-8111-111111111111.jpg';
const BIG = '22222222-2222-4222-8222-222222222222.mp4';

beforeEach(() => {
  cloud.backups.clear();
  cloud.media.clear();
  cloud.uploads.length = 0;
  local.clear();
});

/** Fait comme si le dernier envoi datait d'une heure : le délai de cinq minutes est passé. */
async function later() {
  await writeSetting(CLOUD_PUSHED_AT_KEY, new Date(Date.now() - 3_600_000).toISOString());
}

async function aSessionWithPhoto(name = PHOTO) {
  const session = await startWorkoutSession();
  await finishWorkoutSession();
  await attachSessionPhoto(session.id, name);
  return session.id;
}

describe('Sauvegarde automatique', () => {
  it('ne dépose rien depuis un téléphone qui n est pas relié à un compte qui a déjà des copies', async () => {
    // Une copie déposée par un autre téléphone.
    await aSessionWithPhoto();
    local.set(PHOTO, 1000);
    await pushBackup(USER);
    const before = cloud.backups.size;

    // Ce téléphone-ci est neuf : rien ne le relie au compte.
    const { forgetPushHistory } = await import('./cloud-backup-actions');
    await forgetPushHistory();

    expect(await pushBackupIfWorthwhile(USER)).toBeNull();
    expect(cloud.backups.size).toBe(before);
  });

  it('relie le premier téléphone d un compte vide', async () => {
    await aSessionWithPhoto();

    expect(await pushBackupIfWorthwhile(USER)).not.toBeNull();

    await startWorkoutSession();
    await finishWorkoutSession();
    await later();
    expect(await pushBackupIfWorthwhile(USER)).not.toBeNull();
    expect(cloud.backups.size).toBe(2);
  });

  it('ne renvoie pas une copie juste après une restauration', async () => {
    await aSessionWithPhoto();
    local.set(PHOTO, 1000);
    await pushBackup(USER);
    const [copy] = await listCloudCopies(USER);

    await applyCloudBackup(USER, copy.backup);
    await later();

    expect(await pushBackupIfWorthwhile(USER)).toBeNull();
    expect(cloud.backups.size).toBe(1);
  });
});

describe('Médias trop lourds', () => {
  it('ne les tente pas, et les dit à part', async () => {
    await aSessionWithPhoto(BIG);
    local.set(BIG, MAX_CLOUD_MEDIA_BYTES + 1);

    const result = await pushBackup(USER);

    expect(cloud.uploads).toEqual([]);
    expect(result.tooLargeMedia).toBe(1);
    expect(result.mediaFiles).toBe(0);
  });
});

describe('Ménage des anciennes copies', () => {
  it('garde un fichier en ligne tant qu une copie le cite, même comme manquant', async () => {
    await aSessionWithPhoto();
    local.set(PHOTO, 1000);
    await pushBackup(USER);
    expect(cloud.media.has(PHOTO)).toBe(true);

    // Le fichier a disparu du téléphone : les copies suivantes le citent
    // comme manquant. Il reste le seul exemplaire, en ligne.
    local.clear();
    for (let i = 0; i < 12; i += 1) {
      await startWorkoutSession();
      await finishWorkoutSession();
      await pushBackup(USER);
    }

    expect(cloud.backups.size).toBe(10);
    expect(cloud.media.has(PHOTO)).toBe(true);
  });
});

describe('Choisir une copie', () => {
  it('les liste toutes, avec ce qu elles contiennent', async () => {
    await aSessionWithPhoto();
    local.set(PHOTO, 1000);
    await pushBackup(USER);
    await startWorkoutSession();
    await finishWorkoutSession();
    await pushBackup(USER);

    const copies = await listCloudCopies(USER);

    expect(copies.map((copy) => copy.sessions)).toEqual([2, 1]);
    expect(copies[0].mediaFiles).toBe(1);
  });
});
