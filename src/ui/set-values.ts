import type { ValuesBySide } from '../domain/performance/exercise-performance';
import type { TargetValues } from '../domain/planned-workout/planned-workout';

/**
 * Mise en forme des valeurs d'une série, quel que soit le nombre de côtés.
 *
 * « 8 reps · 20 kg » pour un exercice bilatéral, « 12 s g · 9 s d » pour un
 * unilatéral. Les deux côtés tiennent sur une ligne : ce sont les deux
 * moitiés d'une même série, pas deux séries.
 */
const SIDE_SUFFIX: Record<string, string> = { BOTH: '', LEFT: ' g', RIGHT: ' d' };

export function formatSetValues(
  values: ValuesBySide,
  unitOf: (measurementId: string) => string,
): string {
  return Object.entries(values)
    .filter(([, sideValues]) => sideValues && Object.keys(sideValues).length > 0)
    .map(([side, sideValues]) =>
      Object.entries(sideValues!)
        .map(([id, value]) => `${value} ${unitOf(id)}${SIDE_SUFFIX[side] ?? ''}`)
        .join(' · '),
    )
    .join(' · ');
}

/** Version courte, pour les pastilles : « 12s g · 9s d ». */
export function formatSetValuesShort(
  values: ValuesBySide,
  unitOf: (measurementId: string) => string,
): string {
  return Object.entries(values)
    .filter(([, sideValues]) => sideValues && Object.keys(sideValues).length > 0)
    .map(([side, sideValues]) =>
      Object.entries(sideValues!)
        .map(([id, value]) => `${value}${unitOf(id)}${SIDE_SUFFIX[side] ?? ''}`)
        .join('·'),
    )
    .join(' · ');
}

/**
 * Ce qu'une série PRÉVUE annonce : « 10 reps · 20 kg ».
 *
 * Le plan ne distingue pas les côtés -- les mêmes cibles valent pour chacun --
 * là où une série faite les porte séparément. Sans cette conversion, les
 * cibles passées telles quelles au formateur des séries faites ressortaient
 * vides : leurs clés sont des mesures, pas des côtés.
 */
export function formatTargets(
  targets: TargetValues,
  unitOf: (measurementId: string) => string,
): string {
  return formatSetValues({ BOTH: targets }, unitOf);
}

/** La même chose en version courte, pour les pastilles. */
export function formatTargetsShort(
  targets: TargetValues,
  unitOf: (measurementId: string) => string,
): string {
  return formatSetValuesShort({ BOTH: targets }, unitOf);
}
