import type { PerformanceSet } from '../performance/exercise-performance';
import type { Condition, Metric, Operator, ProgressionStep, Requirement } from './goal';

/**
 * L'évaluation d'une étape (§22).
 *
 * Fonction pure : elle reçoit les séries et rend un verdict. Elle ne sait ni
 * les chercher, ni d'où elles viennent -- c'est ce qui la rend testable sans
 * base de données, et c'est le use case qui décidera quelles séries lui
 * donner (en V1, celles de la dernière séance pertinente).
 *
 * Seules les séries COMPLETED sont admises (décision gelée n°18) : une série
 * en cours ou abandonnée n'est pas une performance.
 */
export type ConditionResult = {
  readonly condition: Condition;
  readonly actual: number | null;
  readonly satisfied: boolean;
};

export type StepEvaluation = {
  readonly satisfied: boolean;
  readonly results: readonly ConditionResult[];
};

export function evaluateStep(
  step: ProgressionStep,
  sets: readonly PerformanceSet[],
): StepEvaluation {
  const completed = sets.filter((set) => set.status === 'COMPLETED');

  const results = step.requirements.flatMap((requirement: Requirement) =>
    requirement.conditions.map((condition) => evaluateCondition(condition, completed)),
  );

  // Toutes les conditions de tous les requirements doivent tenir.
  return { satisfied: results.every((result) => result.satisfied), results };
}

function evaluateCondition(
  condition: Condition,
  completed: readonly PerformanceSet[],
): ConditionResult {
  const actual = measure(condition.metric, completed);
  const satisfied = actual !== null && compare(actual, condition.operator, condition.value);
  return { condition, actual, satisfied };
}

/** null quand la métrique n'a rien à mesurer : aucune série ne l'alimente. */
function measure(metric: Metric, completed: readonly PerformanceSet[]): number | null {
  if (metric.type === 'setCount') {
    return completed.length;
  }

  const values = completed
    .map((set) => set.values[metric.measurementId])
    .filter((value): value is number => value !== undefined);

  if (values.length === 0) return null;

  switch (metric.type) {
    case 'average':
      return values.reduce((total, value) => total + value, 0) / values.length;
    case 'max':
      return Math.max(...values);
    case 'min':
      return Math.min(...values);
    case 'total':
      return values.reduce((total, value) => total + value, 0);
  }
}

function compare(actual: number, operator: Operator, expected: number): boolean {
  switch (operator) {
    case '>=':
      return actual >= expected;
    case '>':
      return actual > expected;
    case '<=':
      return actual <= expected;
    case '<':
      return actual < expected;
    case '==':
      return actual === expected;
  }
}
