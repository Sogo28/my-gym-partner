import type { Aggregation, Condition, EvaluationWindow } from '../domain/goal/goal';

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
};

/** Pour les boutons de choix. */
export const WINDOW_LABELS: { value: EvaluationWindow; label: string }[] = [
  { value: 'LAST_SESSION', label: 'Dernière séance' },
  { value: 'ALL_TIME', label: 'Tout l historique' },
];

/** « moyenne des valeurs lors de la dernière séance ». */
export function describeSource(condition: Condition): string {
  return `${AGGREGATION_PHRASES[condition.aggregation]} ${WINDOW_PHRASES[condition.window]}`;
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
  if (condition.aggregation === 'setCount') {
    return `séries complétées ${condition.operator} ${condition.target}`;
  }

  const label = AGGREGATION_PHRASES[condition.aggregation];
  return `${label} ${condition.operator} ${condition.target} ${unitOf(condition.measurementId!)}`;
}
