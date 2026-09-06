import type { ValuesBySide } from '../domain/performance/exercise-performance';

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
