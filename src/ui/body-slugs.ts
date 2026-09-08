import type { Slug } from 'react-native-body-highlighter';

/**
 * Nos douze groupes, traduits vers les régions du schéma corporel.
 *
 * Même principe que la traduction du catalogue RepDB : le vocabulaire du
 * dessin reste chez lui. Nos groupes sont plus larges que ses régions -- notre
 * « Dos » couvre dorsaux ET trapèzes --, donc un groupe peut en éclairer
 * plusieurs.
 */
const REGIONS: Readonly<Record<string, readonly Slug[]>> = {
  pectoraux: ['chest'],
  dos: ['upper-back', 'trapezius'],
  epaules: ['deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  avantbras: ['forearm'],
  abdominaux: ['abs', 'obliques'],
  lombaires: ['lower-back'],
  fessiers: ['gluteal'],
  quadriceps: ['quadriceps'],
  ischiojambiers: ['hamstring'],
  mollets: ['calves'],
};

export type HighlightedPart = { slug: Slug; intensity: number };

/**
 * Ce que le schéma doit éclairer, et à quelle force.
 *
 * Deux niveaux, et pas un dégradé calculé : un muscle est VISÉ par au moins un
 * exercice de la séance, ou il travaille en SOUTIEN. C'est exactement la
 * distinction que porte le modèle -- inventer une échelle à partir du nombre
 * de séries donnerait une précision que la donnée n'a pas.
 */
export function highlight(
  primaryMuscleIds: readonly string[],
  secondaryMuscleIds: readonly string[],
): HighlightedPart[] {
  const parts = new Map<Slug, number>();

  for (const muscleId of secondaryMuscleIds) {
    for (const slug of REGIONS[muscleId] ?? []) parts.set(slug, 1);
  }
  // Le principal passe après : il écrase le soutien, jamais l'inverse.
  for (const muscleId of primaryMuscleIds) {
    for (const slug of REGIONS[muscleId] ?? []) parts.set(slug, 2);
  }

  return [...parts].map(([slug, intensity]) => ({ slug, intensity }));
}
