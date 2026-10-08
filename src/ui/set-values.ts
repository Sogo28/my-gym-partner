import { weakestValues, type ValuesBySide } from '../domain/performance/exercise-performance';
import type { TargetValues } from '../domain/planned-workout/planned-workout';
import { formatDuration, isDuration } from './format';

/**
 * Mise en forme des valeurs d'une série, quel que soit le nombre de côtés.
 *
 * « 8 reps · 20 kg » pour un exercice bilatéral, « 12 s g · 9 s d » pour un
 * unilatéral. Les deux côtés tiennent sur une ligne : ce sont les deux
 * moitiés d'une même série, pas deux séries.
 */
const SIDE_SUFFIX: Record<string, string> = { BOTH: '', LEFT: ' g', RIGHT: ' d' };

/**
 * Une valeur et son unité, sauf pour une durée : celle-ci porte déjà la
 * sienne. « 150 s » ne dit pas deux minutes et demie tant qu'on n'a pas
 * divisé, et l'app permet désormais de saisir de telles durées.
 */
function measure(value: number, unit: string, separator: string, bare = false): string {
  if (isDuration(unit)) return formatDuration(value);
  return bare ? `${value}` : `${value}${separator}${unit}`;
}

/**
 * Les répétitions se disent sans leur unité dès qu'une autre mesure les
 * accompagne (décidé le 2026-10-08) : « 12 × 20 kg » se lit comme on le dit
 * en salle, là où « 12 reps × 20 kg » répétait ce que le × dit déjà. Seules,
 * elles la gardent : « 12 » ne dirait pas ce qu'il compte.
 */
const REPS = 'reps';

function sideOf(
  sideValues: Readonly<Record<string, number>>,
  unitOf: (measurementId: string) => string,
  separator: string,
  between: string,
  suffix: string,
): string {
  const entries = Object.entries(sideValues);
  return entries
    .map(([id, value]) => {
      const unit = unitOf(id);
      return `${measure(value, unit, separator, entries.length > 1 && unit === REPS)}${suffix}`;
    })
    .join(between);
}

/** Une valeur seule avec son unité : « 20 kg », « 1:30 ». */
export function formatMeasure(value: number, unit: string): string {
  return measure(value, unit, ' ');
}

export function formatSetValues(
  values: ValuesBySide,
  unitOf: (measurementId: string) => string,
  /**
   * Ce qui sépare les mesures d'un même côté. « 12 × 17.5 kg » se lit
   * comme ce qu'est une série -- tant de fois tant -- là où le point
   * médian les posait côte à côte comme deux faits. Les CÔTÉS, eux, restent
   * séparés par le point : gauche et droite ne se multiplient pas.
   */
  between = ' × ',
): string {
  return Object.entries(values)
    .filter(([, sideValues]) => sideValues && Object.keys(sideValues).length > 0)
    .map(([side, sideValues]) =>
      sideOf(sideValues!, unitOf, ' ', between, SIDE_SUFFIX[side] ?? ''),
    )
    .join(' · ');
}

/** Version courte, pour les pastilles : « 12×20kg », « 12s g · 9s d ». */
export function formatSetValuesShort(
  values: ValuesBySide,
  unitOf: (measurementId: string) => string,
): string {
  return Object.entries(values)
    .filter(([, sideValues]) => sideValues && Object.keys(sideValues).length > 0)
    .map(([side, sideValues]) => sideOf(sideValues!, unitOf, '', '×', SIDE_SUFFIX[side] ?? ''))
    .join(' · ');
}

/**
 * Ce qu'une série PRÉVUE annonce : « 10 × 20 kg ».
 *
 * Le plan ne distingue pas les côtés -- les mêmes cibles valent pour chacun --
 * là où une série faite les porte séparément. Sans cette conversion, les
 * cibles passées telles quelles au formateur des séries faites ressortaient
 * vides : leurs clés sont des mesures, pas des côtés.
 */
export function formatTargets(
  targets: TargetValues,
  unitOf: (measurementId: string) => string,
  between = ' × ',
): string {
  return formatSetValues({ BOTH: targets }, unitOf, between);
}

/**
 * La cadence d'un exercice au rythme imposé : « EMOM · un round toutes les
 * 1:00 ».
 *
 * Une ANNOTATION, pas un résumé qui remplacerait la liste : les rounds se
 * lisent exactement comme des séries, numérotés et chiffrés, parce qu'ils en
 * sont. Seule la façon dont ils s'enchaînent demande à être dite.
 */
export function formatEmomPace(intervalSeconds: number): string {
  return `EMOM · un round toutes les ${formatDuration(intervalSeconds)}`;
}

/** La même chose en version courte, pour les pastilles. */
export function formatTargetsShort(
  targets: TargetValues,
  unitOf: (measurementId: string) => string,
): string {
  return formatSetValuesShort({ BOTH: targets }, unitOf);
}

/** Ce qu'une série dit par rapport à ce qui était prévu. */
export type PlanComparison = 'above' | 'on-target' | 'below';

/**
 * Compare une série faite à sa cible.
 *
 * Le côté le plus faible compte (décidé le 2026-09-06, comme pour les
 * objectifs) : une série unilatérale ne se juge pas sur son meilleur côté.
 * Sans cible (série faite en plus, hors plan) : dépassée. Sans série faite
 * (cible jamais atteinte) : en dessous. Entre plusieurs mesures qui
 * divergent -- plus de répétitions mais moins de poids --, la moindre reçoit
 * le dernier mot : mieux vaut sous-déclarer une séance que la surclasser.
 */
export function compareToPlan(
  planned: TargetValues | undefined,
  values: ValuesBySide | undefined,
): PlanComparison {
  if (!values) return 'below';
  if (!planned) return 'above';

  const done = weakestValues(values);
  const measurementIds = new Set([...Object.keys(planned), ...Object.keys(done)]);
  let above = false;
  let below = false;
  for (const measurementId of measurementIds) {
    const target = planned[measurementId] ?? 0;
    const actual = done[measurementId] ?? 0;
    if (actual > target) above = true;
    if (actual < target) below = true;
  }
  if (below) return 'below';
  if (above) return 'above';
  return 'on-target';
}
