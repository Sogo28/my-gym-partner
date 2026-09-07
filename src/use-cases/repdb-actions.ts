import {
  ATTRIBUTION,
  ATTRIBUTION_URL,
  download,
  downloadedSize,
  forget,
  isDownloaded,
  search,
} from '../infra/repdb/catalogue';
import { toDraft, type CatalogueEntry, type ExerciseDraft } from '../infra/repdb/mapping';

export type { CatalogueEntry, ExerciseDraft };
export { ATTRIBUTION, ATTRIBUTION_URL };

export type CatalogueState = { downloaded: boolean; size: number };

export function catalogueState(): CatalogueState {
  return { downloaded: isDownloaded(), size: downloadedSize() };
}

/** ImportCatalogue : le fichier arrive sur le téléphone, rien de plus. */
export async function downloadCatalogue(): Promise<CatalogueState> {
  await download();
  return catalogueState();
}

export function forgetCatalogue(): CatalogueState {
  forget();
  return catalogueState();
}

export function searchCatalogue(query: string): CatalogueEntry[] {
  return search(query);
}

/**
 * Ce qu'une entrée propose comme exercice.
 *
 * Un BROUILLON, jamais un exercice créé : le nom arrive en anglais, les
 * mesures sont devinées, et un muscle que nous ne nommons pas a été écarté.
 * C'est à l'utilisateur de relire avant d'enregistrer.
 */
export function draftFrom(entry: CatalogueEntry): ExerciseDraft {
  return toDraft(entry);
}
