import { weakestValues, type PerformanceSet } from './exercise-performance';

/** Le meilleur d'une mesure, et la série qui l'a produit. */
export type PerformanceRecord = {
  readonly measurementId: string;
  readonly value: number;
  readonly at: Date;
};

/**
 * Les records d'un exercice : la meilleure valeur atteinte, mesure par mesure.
 *
 * Une mesure par record, et non deux colonnes figées « poids » et « reps » :
 * un exercice déclare LES SIENNES, et un front lever se juge en secondes.
 *
 * Seules les séries validées comptent -- une série abandonnée n'est pas une
 * performance (n°18) --, et pour un exercice unilatéral c'est le côté le plus
 * faible qui fait foi, comme partout ailleurs dans l'application.
 */
export function bestByMeasurement(sets: readonly PerformanceSet[]): PerformanceRecord[] {
  const best = new Map<string, PerformanceRecord>();

  for (const set of sets) {
    if (set.status !== 'COMPLETED') continue;

    for (const [measurementId, value] of Object.entries(weakestValues(set.values))) {
      const current = best.get(measurementId);
      if (current === undefined || value > current.value) {
        best.set(measurementId, { measurementId, value, at: endOf(set) });
      }
    }
  }

  return [...best.values()];
}

/**
 * Le meilleur volume d'une série : répétitions x charge.
 *
 * Null dès qu'une des deux mesures manque. Un exercice au poids du corps n'a
 * pas un volume de zéro -- il n'a pas de volume, et afficher zéro serait
 * affirmer quelque chose de faux.
 */
export function bestVolume(
  sets: readonly PerformanceSet[],
  repsId: string,
  weightId: string,
): { value: number; at: Date } | null {
  let best: { value: number; at: Date } | null = null;

  for (const set of sets) {
    if (set.status !== 'COMPLETED') continue;

    const values = weakestValues(set.values);
    const reps = values[repsId];
    const weight = values[weightId];
    if (reps === undefined || weight === undefined) continue;

    const value = reps * weight;
    if (best === null || value > best.value) best = { value, at: endOf(set) };
  }

  return best;
}

/** Une série close a une fin ; à défaut, son début situe la performance. */
function endOf(set: PerformanceSet): Date {
  return set.endedAt ?? set.startedAt;
}

/**
 * La meilleure valeur d'une mesure sur un ensemble de séries, ou null si
 * aucune série validée ne la porte.
 *
 * Ce qu'on suit d'une séance à l'autre pour lire une progression : la série
 * la plus forte, et non la moyenne, qui baisse dès qu'on ajoute un exercice
 * de plus en fin de séance.
 */
export function bestValue(sets: readonly PerformanceSet[], measurementId: string): number | null {
  let best: number | null = null;

  for (const set of sets) {
    if (set.status !== 'COMPLETED') continue;
    const value = weakestValues(set.values)[measurementId];
    if (value === undefined) continue;
    if (best === null || value > best) best = value;
  }

  return best;
}
