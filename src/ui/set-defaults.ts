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
