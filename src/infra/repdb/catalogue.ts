import { Directory, File, Paths } from 'expo-file-system';
import { DomainError } from '../../domain/domain-error';
import { fold } from '../../ui/search';
import type { CatalogueEntry } from './mapping';

/**
 * Le catalogue RepDB, gardé en FICHIER et non en table.
 *
 * Notre sauvegarde exporte toutes les tables : une table catalogue partirait
 * dans chaque export -- 601 lignes de données tierces dans un fichier qu'on
 * partage, et des sauvegardes dix fois plus lourdes. Un fichier se retélécharge,
 * une sauvegarde alourdie ne se dégonfle pas.
 *
 * Sa licence interdit d'ailleurs de le redistribuer : il n'a rien à faire
 * dans le dépôt, ni dans une sauvegarde.
 */
const SOURCE = 'https://exercise-dataset.com/exercises.json';
const FOLDER = 'repdb';
const FILE = 'exercises.json';

/** L'attribution que sa licence exige, à afficher là où le catalogue sert. */
export const ATTRIBUTION = 'Données d exercices par RepDB (repdb.co)';
export const ATTRIBUTION_URL = 'https://repdb.co';

function catalogueFile(): File {
  return new File(new Directory(Paths.document, FOLDER), FILE);
}

export function isDownloaded(): boolean {
  return catalogueFile().exists;
}

/** Sa taille sur le disque, pour que l'écran de réglages puisse la dire. */
export function downloadedSize(): number {
  const file = catalogueFile();
  return file.exists ? file.size : 0;
}

export async function download(): Promise<void> {
  const directory = new Directory(Paths.document, FOLDER);
  if (!directory.exists) directory.create({ intermediates: true });

  const existing = catalogueFile();
  if (existing.exists) existing.delete();

  try {
    await File.downloadFileAsync(SOURCE, existing);
  } catch {
    throw new DomainError('Le catalogue n a pas pu être téléchargé. Vérifie ta connexion.');
  }
}

export function forget(): void {
  const file = catalogueFile();
  if (file.exists) file.delete();
}

/**
 * Les entrées, relues à chaque recherche.
 *
 * 2 Mo de JSON analysés à la volée plutôt que gardés en mémoire : l'écran
 * d'import ne vit que le temps d'un choix, et une app de suivi sportif n'a
 * pas à porter un catalogue tiers en permanence.
 */
export function read(): CatalogueEntry[] {
  const file = catalogueFile();
  if (!file.exists) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(file.textSync());
  } catch {
    throw new DomainError('Le catalogue téléchargé est illisible. Retélécharge-le.');
  }

  const list = (parsed as { exercises?: unknown[] })?.exercises;
  if (!Array.isArray(list)) return [];

  return list.map(toEntry);
}

/** Les exercices dont le nom contient la recherche, les premiers seulement. */
export function search(query: string, limit = 40): CatalogueEntry[] {
  const needle = fold(query.trim());
  const all = read();
  const matching = needle === '' ? all : all.filter((entry) => fold(entry.name).includes(needle));
  return matching.slice(0, limit);
}

/** Leur JSON n'est pas notre modèle : on ne garde que ce qu'on sait utiliser. */
function toEntry(raw: unknown): CatalogueEntry {
  const source = raw as Record<string, unknown>;
  const images = (source.images as { flat?: Record<string, string> })?.flat ?? {};

  return {
    id: String(source.id ?? ''),
    name: String(source.name_en ?? ''),
    equipment: String(source.equipment ?? ''),
    primaryMuscles: asStrings(source.primary_muscles),
    secondaryMuscles: asStrings(source.secondary_muscles),
    isUnilateral: source.is_unilateral === true,
    isBodyweight: source.is_bodyweight === true,
    images: Object.values(images).filter((path): path is string => typeof path === 'string'),
  };
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
