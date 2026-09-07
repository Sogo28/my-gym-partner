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
import { adoptFromCatalogue, originOf } from './adopt-exercise';
import { findAll } from '../infra/exercise-repository';
import { DomainError } from '../domain/domain-error';

export type { CatalogueEntry, ExerciseDraft };
export { ATTRIBUTION, ATTRIBUTION_URL };
export { adoptFromCatalogue, originOf };

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

/** Une entrée précise, relue depuis le fichier. */
export function entryById(id: string): CatalogueEntry | undefined {
  return search('', Number.MAX_SAFE_INTEGER).find((entry) => entry.id === id);
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

/**
 * Ce que le catalogue propose EN PLUS de ce que tu as déjà.
 *
 * L'origine est le seul lien : une fois « Pull Up » renommé « Tractions »,
 * plus rien d'autre ne dit qu'il vient de là -- et le reproposer créerait un
 * doublon que rien ne distinguerait.
 */
export async function searchUnadopted(query: string): Promise<CatalogueEntry[]> {
  const adopted = new Set(
    (await findAll()).map((exercise) => exercise.origin).filter((origin) => origin !== null),
  );
  return search(query).filter((entry) => !adopted.has(originOf(entry)));
}

/**
 * Ce qu'il faut passer au sélecteur pour qu'il propose aussi le catalogue.
 *
 * Un seul endroit : les trois écrans qui choisissent un exercice doivent
 * proposer la même chose, et l'adoption doit y produire exactement le même
 * exercice.
 */
export function catalogueSource(onAdopted?: () => void) {
  if (!catalogueState().downloaded) return undefined;

  return {
    suggest: async (query: string) => {
      const entries = await searchUnadopted(query);
      return entries.slice(0, 15).map((entry) => ({
        id: entry.id,
        name: entry.name,
        detail: entry.equipment.replace(/_/g, ' ') || 'catalogue',
      }));
    },
    adopt: async (id: string) => {
      const entry = entryById(id);
      if (!entry) throw new DomainError('Cet exercice n est plus dans le catalogue.');
      const created = await adoptFromCatalogue(entry);
      onAdopted?.();
      return created.id;
    },
  };
}
