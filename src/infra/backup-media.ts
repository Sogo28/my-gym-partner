import { DomainError } from '../domain/domain-error';
import type { Backup, BackupMedia, BackupMediaManifest } from './backup';

/** Une URL distante est la source elle-même ; sa copie locale n'est qu'un cache. */
function isRemote(uri: string): boolean {
  return /^https?:\/\//i.test(uri);
}

function stringsIn(
  backup: Backup,
  table: string,
  column: string,
  accept: (value: string) => boolean = () => true,
): string[] {
  return (backup.tables[table] ?? []).flatMap((row) => {
    const value = row[column];
    return typeof value === 'string' && value !== '' && accept(value) ? [value] : [];
  });
}

/**
 * Tous les vrais fichiers que la base réclame.
 *
 * On lit le SNAPSHOT plutôt que les repositories vivants : une sauvegarde
 * commencée pendant que l'app évolue doit décrire exactement les lignes
 * qu'elle emporte, pas un second état lu quelques instants plus tard.
 */
export function mediaNamesOf(backup: Backup): string[] {
  return [
    ...new Set([
      ...stringsIn(backup, 'exercise_media', 'uri', (uri) => !isRemote(uri)),
      ...stringsIn(backup, 'performance_sets', 'video_uri'),
      ...stringsIn(backup, 'workout_sessions', 'photo_uri'),
    ]),
  ].sort();
}

/**
 * Les vidéos de séries, et elles seules : un fichier qu'un exercice ou une
 * séance cite aussi n'en fait pas partie -- l'exclure les priverait d'elle.
 */
export function setVideoNamesOf(backup: Backup): string[] {
  const elsewhere = new Set([
    ...stringsIn(backup, 'exercise_media', 'uri', (uri) => !isRemote(uri)),
    ...stringsIn(backup, 'workout_sessions', 'photo_uri'),
  ]);
  return [...new Set(stringsIn(backup, 'performance_sets', 'video_uri'))]
    .filter((name) => !elsewhere.has(name))
    .sort();
}

/** Un nom de fichier, jamais un chemin rendu par une sauvegarde non fiable. */
export function isSafeMediaName(name: string): boolean {
  return (
    name !== '.' &&
    name !== '..' &&
    !name.includes('/') &&
    !name.includes('\\') &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)
  );
}

/** Valide le morceau d'un JSON distant avant tout accès au disque. */
export function validateMediaManifest(backup: Backup): BackupMediaManifest {
  const raw = backup.media as unknown;
  if (typeof raw !== 'object' || raw === null) {
    throw new DomainError('Cette sauvegarde contient un manifeste de médias invalide.');
  }
  const candidate = raw as { files?: unknown; missing?: unknown; excluded?: unknown };
  if (
    !Array.isArray(candidate.files) ||
    !Array.isArray(candidate.missing) ||
    (candidate.excluded !== undefined && !Array.isArray(candidate.excluded))
  ) {
    throw new DomainError('Cette sauvegarde contient un manifeste de médias invalide.');
  }
  const excluded = (candidate.excluded ?? []) as unknown[];

  const names = new Set<string>();
  for (const media of candidate.files) {
    assertMediaDescription(media);
    if (names.has(media.name)) {
      throw new DomainError('Cette sauvegarde cite deux fois le même média.');
    }
    names.add(media.name);
  }
  for (const name of [...candidate.missing, ...excluded]) {
    if (typeof name !== 'string' || !isSafeMediaName(name) || names.has(name)) {
      throw new DomainError('Cette sauvegarde contient un manifeste de médias invalide.');
    }
    names.add(name);
  }

  const referenced = mediaNamesOf(backup);
  if (referenced.length !== names.size || referenced.some((name) => !names.has(name))) {
    throw new DomainError('Cette sauvegarde ne décrit pas correctement ses médias.');
  }

  return {
    files: candidate.files,
    missing: candidate.missing as string[],
    excluded: excluded as string[],
  };
}

export function assertMediaDescription(media: unknown): asserts media is BackupMedia {
  if (typeof media !== 'object' || media === null) {
    throw new DomainError('Cette sauvegarde décrit un média invalide.');
  }
  const candidate = media as Partial<BackupMedia>;
  if (
    typeof candidate.name !== 'string' ||
    typeof candidate.size !== 'number' ||
    (candidate.md5 !== null && typeof candidate.md5 !== 'string') ||
    typeof candidate.contentType !== 'string' ||
    !isSafeMediaName(candidate.name) ||
    !Number.isSafeInteger(candidate.size) ||
    candidate.size < 0 ||
    (candidate.md5 !== null && !/^[a-f\d]{32}$/i.test(candidate.md5)) ||
    !/^[-\w.+]+\/[-\w.+]+$/.test(candidate.contentType)
  ) {
    throw new DomainError('Cette sauvegarde décrit un média invalide.');
  }
}
