import { DomainError } from '../domain/domain-error';
import { readSetting, writeSetting } from '../infra/settings-repository';

type MediaLibraryModule = typeof import('expo-media-library');

/**
 * Le module de la galerie, chargé SANS le supposer présent : il est natif,
 * et une application construite avant lui ne le porte pas.
 */
function mediaLibrary(): MediaLibraryModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-media-library') as MediaLibraryModule;
  } catch {
    return null;
  }
}

/**
 * Copie une vidéo de l'application dans la galerie du téléphone (décidé le
 * 2026-10-08).
 *
 * Une COPIE : l'application garde la sienne, rattachée à sa série. La
 * galerie, elle, la garde à sa façon -- sauvegardée par le téléphone, prête à
 * partager --, sans peser sur la sauvegarde en ligne de l'application.
 *
 * L'autorisation demandée est l'ÉCRITURE seule : l'application n'a pas à
 * lire la galerie pour y déposer un fichier.
 */
export async function saveToGallery(fileUri: string): Promise<void> {
  const library = mediaLibrary();
  if (!library) {
    throw new DomainError(
      "L'enregistrement dans la galerie demande une nouvelle version de l'application.",
    );
  }

  const permission = await library.requestPermissionsAsync(true);
  if (!permission.granted) {
    throw new DomainError(
      "Sans l'autorisation d'accès à la galerie, la vidéo ne peut pas y être enregistrée.",
    );
  }

  try {
    await library.Asset.create(fileUri);
  } catch {
    throw new DomainError("La vidéo n'a pas pu être enregistrée dans la galerie.");
  }

  const saved = await savedNames();
  const name = nameOf(fileUri);
  if (!saved.includes(name)) await writeSetting(SAVED_KEY, JSON.stringify([...saved, name]));
}

/**
 * Les vidéos déjà copiées dans la galerie, par nom de fichier.
 *
 * Le bouton le dit au lieu de proposer une seconde copie : la galerie ne
 * dédoublonne pas, et deux appuis faisaient deux fois la même vidéo.
 */
const SAVED_KEY = 'gallery.savedVideos';

export async function isInGallery(fileUri: string): Promise<boolean> {
  return (await savedNames()).includes(nameOf(fileUri));
}

async function savedNames(): Promise<string[]> {
  try {
    const parsed: unknown = JSON.parse((await readSetting(SAVED_KEY)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

/** Le nom seul : le dossier de l'app change d'un téléphone, ou d'une restauration, à l'autre. */
function nameOf(fileUri: string): string {
  return fileUri.slice(fileUri.lastIndexOf('/') + 1);
}
