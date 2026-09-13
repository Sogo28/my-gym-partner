/**
 * Ce que vise une série qu'on n'a pas encore réglée.
 *
 * Partir d'une valeur plausible se corrige plus vite que de partir de rien :
 * douze répétitions ou douze secondes se rectifient d'un geste, là où un zéro
 * demande de tout saisir. Ces valeurs sont donc un POINT DE DÉPART et non une
 * règle : rien dans le domaine ne les connaît.
 *
 * Partagé par la création d'un entraînement et par la séance libre, qui
 * doivent proposer les mêmes : une série improvisée et une série prévue ne
 * partiraient sinon pas du même endroit.
 */
const DEFAULTS: Record<string, number> = {
  reps: 12,
  weight: 10,
  duration: 12,
  distance: 100,
};

/** Les cibles de départ d'un exercice, mesure par mesure. */
export function defaultTargets(measurementIds: readonly string[]): Record<string, number> {
  return Object.fromEntries(measurementIds.map((id) => [id, DEFAULTS[id] ?? 0]));
}

/**
 * Le pas d'ajustement : on n'ajoute pas un kilo comme une répétition.
 *
 * Ici et non dans chaque écran, où il était recopié trois fois : c'est une
 * propriété de la MESURE, pas de la page qui l'affiche.
 */
const STEPS: Record<string, number> = { reps: 1, weight: 2.5, duration: 1, distance: 10 };

export function stepOf(measurementId: string): number {
  return STEPS[measurementId] ?? 1;
}

/**
 * Jusqu'où la roulette monte.
 *
 * Une borne est nécessaire : une roulette se fabrique cran par cran, et sans
 * fin elle n'aurait pas de hauteur. Ces valeurs sont larges à dessein --
 * au-delà, ce n'est plus une série mais une faute de frappe.
 */
const CEILINGS: Record<string, number> = {
  reps: 200,
  weight: 400,
  duration: 3600,
  distance: 5000,
};

export function ceilingOf(measurementId: string): number {
  return CEILINGS[measurementId] ?? 500;
}

/** Les crans d'une colonne : de zéro au plafond, de pas en pas. */
export function ladder(step: number, ceiling: number): number[] {
  const rungs = Math.floor(ceiling / step) + 1;
  // Arrondi à deux décimales : additionner 2,5 cent fois dérive autrement.
  return Array.from({ length: rungs }, (_, n) => Math.round(n * step * 100) / 100);
}
