import type { Exercise } from '../domain/exercise/exercise';
import { toDraft, type CatalogueEntry } from '../infra/repdb/mapping';
import { createExercise } from './create-exercise';

/**
 * Adopter une entrée de catalogue, sans jamais toucher au FICHIER qui la
 * contient : l'entrée est déjà là, en mémoire.
 *
 * Module à part pour cette raison : le lire ne doit pas entraîner le système
 * de fichiers derrière lui, sinon la règle de traduction ne serait plus
 * testable sans émulateur.
 */
/** L'origine que porte un exercice adopté : `repdb:pull-up`. */
export function originOf(entry: CatalogueEntry): string {
  return `repdb:${entry.id}`;
}

/**
 * Adopte une entrée telle quelle : l'exercice existe, on peut l'utiliser.
 *
 * C'est le chemin de la SÉANCE, où l'on n'a pas le temps de remplir un
 * formulaire. Le nom anglais et les mesures devinées se corrigent depuis sa
 * fiche, plus tard ; ce qui compte à cet instant est de pouvoir enchaîner.
 */
export async function adoptFromCatalogue(entry: CatalogueEntry): Promise<Exercise> {
  const draft = toDraft(entry);

  return createExercise({
    name: draft.name,
    isUnilateral: draft.isUnilateral,
    measurementIds: draft.measurementIds,
    primaryMuscleId: draft.primaryMuscleId,
    secondaryMuscleIds: draft.secondaryMuscleIds,
    media: draft.imageUris.map((uri) => ({
      kind: 'image' as const,
      uri,
      label: null,
      trim: null,
    })),
    origin: originOf(entry),
  });
}

