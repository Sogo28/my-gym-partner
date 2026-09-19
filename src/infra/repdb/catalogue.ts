import { Directory, File, Paths } from 'expo-file-system';
import { DomainError } from '../../domain/domain-error';
import { fold } from '../../text';
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
export const ATTRIBUTION = "Données d'exercices par RepDB (repdb.co)";
export const ATTRIBUTION_URL = 'https://repdb.co';

/**
 * Le fichier analysé, gardé en mémoire.
 *
 * Sans lui, chaque frappe dans la recherche relisait et analysait 2 Mo de
 * JSON, de façon SYNCHRONE, sur le fil qui dessine l'écran. Le fichier ne
 * change qu'au téléchargement ou à l'effacement : ce sont les deux seuls
 * endroits où l'oublier.
 */
let parsed: CatalogueEntry[] | null = null;

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
  parsed = null;

  try {
    await File.downloadFileAsync(SOURCE, existing);
  } catch {
    throw new DomainError("Le catalogue n'a pas pu être téléchargé. Vérifie ta connexion.");
  }
}

export function forget(): void {
  const file = catalogueFile();
  if (file.exists) file.delete();
  parsed = null;
}

/** Les entrées, analysées une fois puis servies de mémoire. */
export function read(): CatalogueEntry[] {
  if (parsed !== null) return parsed;

  const file = catalogueFile();
  if (!file.exists) return [];

  let content: unknown;
  try {
    content = JSON.parse(file.textSync());
  } catch {
    throw new DomainError('Le catalogue téléchargé est illisible. Retélécharge-le.');
  }

  const list = (content as { exercises?: unknown[] })?.exercises;
  if (!Array.isArray(list)) return [];

  parsed = list.map(toEntry);
  return parsed;
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
