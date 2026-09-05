import type { PerformanceSet } from '../performance/exercise-performance';
import type { Aggregation, Condition, Operator, Requirement } from './goal';

/**
 * L'évaluation d'un Requirement (§4, §6).
 *
 * Fonction pure : elle reçoit les séries et rend un verdict, condition par
 * condition. Elle ne sait pas les chercher -- c'est le use case qui choisit
 * quelles séries lui donner, en respectant la fenêtre déclarée par chaque
 * condition (en V1, la dernière session pertinente).
 *
 * Seules les séries COMPLETED sont admises (n°18 du cahier) : une série en
 * cours ou abandonnée n'est pas une performance.
 */
export type ConditionResult = {
  readonly condition: Condition;
  readonly actual: number | null;
  readonly satisfied: boolean;
};

export type RequirementEvaluation = {
  /** Faux tant qu'une seule condition ne tient pas (n°10). */
  readonly satisfied: boolean;
  readonly results: readonly ConditionResult[];
};

export function evaluateRequirement(
  requirement: Requirement,
  sets: readonly PerformanceSet[],
): RequirementEvaluation {
  const completed = sets.filter((set) => set.status === 'COMPLETED');
  const results = requirement.conditions.map((condition) => {
    const actual = aggregate(condition.aggregation, condition.measurementId, completed);
    return {
      condition,
      actual,
      satisfied: actual !== null && compare(actual, condition.operator, condition.target),
    };
  });

  return { satisfied: results.every((result) => result.satisfied), results };
}

/** null quand rien n'alimente la métrique : aucune série ne porte la mesure. */
function aggregate(
  aggregation: Aggregation,
  measurementId: string | null,
  completed: readonly PerformanceSet[],
): number | null {
  if (aggregation === 'setCount') return completed.length;
  if (measurementId === null) return null;

  const values = completed
    .map((set) => set.values[measurementId])
    .filter((value): value is number => value !== undefined);

  if (values.length === 0) return null;

  switch (aggregation) {
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

function compare(actual: number, operator: Operator, target: number): boolean {
  switch (operator) {
    case '>=':
      return actual >= target;
    case '>':
      return actual > target;
    case '<=':
      return actual <= target;
    case '<':
      return actual < target;
    case '==':
      return actual === target;
  }
}
