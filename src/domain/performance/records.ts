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
 * Le volume d'une SÉRIE : le produit de ce qu'elle a mesuré.
 *
 * Douze répétitions à soixante kilos valent 720 ; douze tenues de dix
 * secondes, 120. Le produit marche parce qu'il dit la même chose dans les
 * deux cas -- combien de travail cette série a demandé -- là où chaque mesure
 * prise seule n'en dit qu'une moitié : soixante kilos ne distingue pas cinq
 * répétitions de douze.
 *
 * Il faut AU MOINS DEUX mesures. Avec une seule, le produit vaut cette mesure
 * : un volume qui répéterait la durée n'apprendrait rien qu'elle ne dise
 * déjà, et se donnerait pour un autre chiffre.
 *
 * Ce nombre n'a pas d'unité. Des kilos par répétition ne sont une grandeur
 * d'aucune physique : c'est un indice, comparable à lui-même d'une séance à
 * l'autre, et à rien d'autre.
 */
export function volumeOf(set: PerformanceSet): number | null {
  if (set.status !== 'COMPLETED') return null;

  const values = Object.values(weakestValues(set.values));
  if (values.length < 2) return null;

  return values.reduce((product, value) => product * value, 1);
}

/** Le meilleur volume atteint par une série, et le jour où il l'a été. */
export function bestVolume(
  sets: readonly PerformanceSet[],
): { value: number; at: Date } | null {
  let best: { value: number; at: Date } | null = null;

  for (const set of sets) {
    const value = volumeOf(set);
    if (value === null) continue;

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

/**
 * Le volume MOYEN des séries d'une séance.
 *
 * La moyenne et non la meilleure : une séance est un ensemble de séries, et
 * sa meilleure n'en raconte qu'une. Trois séries à 700 puis une à 300 valent
 * mieux qu'une à 700 suivie de trois à 300, alors que leur meilleure est la
 * même.
 *
 * Et non la somme : celle-ci monterait pour la seule raison qu'on a fait une
 * série de plus, même plus faible. On vient lire une progression, pas un
 * décompte d'efforts.
 */
export function averageVolume(sets: readonly PerformanceSet[]): number | null {
  return average(sets.map(volumeOf));
}

/** La moyenne d'une MESURE sur les séries d'une séance, même règle. */
export function averageValue(
  sets: readonly PerformanceSet[],
  measurementId: string,
): number | null {
  return average(
    sets.map((set) =>
      set.status === 'COMPLETED' ? (weakestValues(set.values)[measurementId] ?? null) : null,
    ),
  );
}

function average(values: readonly (number | null)[]): number | null {
  const kept = values.filter((value): value is number => value !== null);
  if (kept.length === 0) return null;
  return kept.reduce((total, value) => total + value, 0) / kept.length;
}
