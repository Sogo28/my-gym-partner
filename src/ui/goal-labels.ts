import type { Aggregation, Clause, Condition, EvaluationWindow } from '../domain/goal/goal';

/**
 * Le vocabulaire des objectifs, en français.
 *
 * Partagé entre l'écran de création et celui de suivi : deux listes de
 * libellés séparées finiraient par diverger, et une condition ne se lirait
 * plus pareil selon l'endroit où on la regarde.
 */

/** Pour les boutons de choix. */
export const AGGREGATION_LABELS: { value: Aggregation; label: string }[] = [
  { value: 'average', label: 'Moyenne' },
  { value: 'max', label: 'Meilleure série' },
  { value: 'min', label: 'Plus faible série' },
  { value: 'total', label: 'Cumul' },
  { value: 'setCount', label: 'Nombre de séries' },
];

/** Ce que l'agrégation calcule réellement, en toutes lettres. */
export const AGGREGATION_PHRASES: Record<Aggregation, string> = {
  average: 'moyenne des valeurs',
  max: 'meilleure valeur',
  min: 'plus faible valeur',
  total: 'somme des valeurs',
  setCount: 'nombre de séries complétées',
};

/** Dans une phrase : « moyenne des valeurs sur tout l'historique ». */
export const WINDOW_PHRASES: Record<EvaluationWindow, string> = {
  LAST_SESSION: 'lors de la dernière séance',
  ALL_TIME: 'sur tout l historique',
  LATEST_READING: 'au dernier relevé',
};

/** Pour les boutons de choix. */
export const WINDOW_LABELS: { value: EvaluationWindow; label: string }[] = [
  { value: 'LAST_SESSION', label: 'Dernière séance' },
  { value: 'ALL_TIME', label: 'Tout l historique' },
  { value: 'LATEST_READING', label: 'Dernier relevé' },
];

/** « moyenne des valeurs lors de la dernière séance ». */
export function describeSource(condition: Condition): string {
  if (condition.window === 'LATEST_READING') return 'valeur de ton dernier relevé';
  return `${sourcePhrase(condition)} ${WINDOW_PHRASES[condition.window]}`;
}

/** Un décompte qui décrit ses séries ne compte plus les mêmes. */
function sourcePhrase(condition: Condition): string {
  return qualifying(condition).length > 0
    ? 'nombre de séries qualifiantes'
    : AGGREGATION_PHRASES[condition.aggregation];
}

function qualifying(condition: Condition): readonly Clause[] {
  return condition.qualifying ?? [];
}

/**
 * La description d'une série : « 10 reps · 60 kg ».
 *
 * Les cibles sont séparées par un point médian et non par « et » : elles ne
 * sont pas deux exigences, mais une seule série vue sous deux mesures.
 */
export function describeClauses(
  clauses: readonly Clause[],
  unitOf: (measurementId: string) => string,
): string {
  return clauses
    .map((clause) => {
      const prefix = clause.operator === '>=' ? '' : `${clause.operator} `;
      return `${prefix}${clause.target} ${unitOf(clause.measurementId)}`;
    })
    .join(' · ');
}

/** L'unité de la cible : un décompte se compte en séries. */
export function targetUnit(
  condition: Condition,
  unitOf: (measurementId: string) => string,
): string {
  if (condition.aggregation === 'setCount') return 'séries';
  return condition.measurementId === null ? '' : unitOf(condition.measurementId);
}

/**
 * La condition entière : « moyenne >= 10 s ».
 *
 * L'unité vient de l'appelant, qui seul a chargé le catalogue des mesures.
 */
export function describeCondition(
  condition: Condition,
  unitOf: (measurementId: string) => string,
): string {
  // Un relevé est une valeur unique : moyenne, meilleure ou cumul y donnent
  // tous le même nombre. Nommer l'agrégation ne ferait qu'embrouiller.
  if (condition.window === 'LATEST_READING') {
    return `${condition.operator} ${condition.target} ${unitOf(condition.measurementId!)}`;
  }

  if (condition.aggregation === 'setCount') {
    const clauses = qualifying(condition);
    const counted =
      clauses.length > 0 ? `séries de ${describeClauses(clauses, unitOf)}` : 'séries complétées';
    return `${counted} ${condition.operator} ${condition.target}`;
  }

  const label = AGGREGATION_PHRASES[condition.aggregation];
  return `${label} ${condition.operator} ${condition.target} ${unitOf(condition.measurementId!)}`;
}

/** Les mêmes mots, en abrégé, pour une vignette qui n'a pas la place. */
const AGGREGATION_SHORT: Record<Aggregation, string> = {
  average: 'moyenne',
  max: 'meilleure',
  min: 'plus faible',
  total: 'cumul',
  setCount: 'séries',
};

const WINDOW_SHORT: Record<EvaluationWindow, string> = {
  LAST_SESSION: 'dernière séance',
  ALL_TIME: 'tout l historique',
  LATEST_READING: 'dernier relevé',
};

/**
 * « moyenne dernière séance » : de quoi situer la valeur sans la phrase.
 *
 * La forme longue -- « moyenne des valeurs lors de la dernière séance » --
 * est juste, mais tronquée elle ne dit plus rien : sur l'accueil, elle
 * s'arrêtait à « der. ».
 */
export function describeSourceShort(condition: Condition): string {
  if (condition.window === 'LATEST_READING') return WINDOW_SHORT.LATEST_READING;
  return `${AGGREGATION_SHORT[condition.aggregation]} ${WINDOW_SHORT[condition.window]}`;
}
