import { weakestValues, type PerformanceSet } from '../performance/exercise-performance';
import type {
  Aggregation,
  Condition,
  EvaluationWindow,
  Operator,
  Requirement,
} from './goal';

/**
 * L'évaluation d'un Requirement (§4, §6).
 *
 * Fonction pure. Elle ne va chercher aucune donnée : on lui remet les séries
 * DÉJÀ regroupées par fenêtre, et elle sert à chaque condition celles que sa
 * propre fenêtre désigne. C'est ce qui permet à deux conditions d'une même
 * exigence de porter sur des périodes différentes.
 *
 * Seules les séries COMPLETED sont retenues (n°18 du cahier) : une série en
 * cours ou abandonnée n'est pas une performance.
 */
export type SetsByWindow = Readonly<Partial<Record<EvaluationWindow, readonly PerformanceSet[]>>>;

export type ConditionResult = {
  readonly condition: Condition;
  readonly actual: number | null;
  readonly satisfied: boolean;
  /** Faux quand la fenêtre de cette condition ne contient aucune série. */
  readonly hasData: boolean;
};

export type RequirementEvaluation = {
  /** Faux tant qu'une seule condition ne tient pas (n°12). */
  readonly satisfied: boolean;
  readonly results: readonly ConditionResult[];
};

/**
 * Plusieurs Requirements se combinent en ET (décidé le 2026-09-05) : tous
 * doivent tenir pour que l'étape soit atteinte.
 */
export function evaluateRequirements(
  requirements: readonly Requirement[],
  sets: SetsByWindow,
): RequirementEvaluation {
  const evaluations = requirements.map((requirement) => evaluateRequirement(requirement, sets));
  return {
    satisfied: evaluations.every((evaluation) => evaluation.satisfied),
    results: evaluations.flatMap((evaluation) => evaluation.results),
  };
}

export function evaluateRequirement(
  requirement: Requirement,
  sets: SetsByWindow,
): RequirementEvaluation {
  const results = requirement.conditions.map((condition) => {
    // Chaque condition lit la fenêtre qu'elle déclare, pas une fenêtre
    // supposée par le code qui l'évalue.
    const completed = (sets[condition.window] ?? []).filter(
      (set) => set.status === 'COMPLETED',
    );
    const actual = aggregate(condition.aggregation, condition.measurementId, completed);

    return {
      condition,
      actual,
      satisfied: actual !== null && compare(actual, condition.operator, condition.target),
      hasData: completed.length > 0,
    };
  });

  return { satisfied: results.every((result) => result.satisfied), results };
}

/** Les fenêtres qu'il faudra résoudre pour évaluer ces exigences. */
export function windowsUsedBy(requirements: readonly Requirement[]): EvaluationWindow[] {
  const windows = new Set<EvaluationWindow>();
  for (const requirement of requirements) {
    for (const condition of requirement.conditions) {
      windows.add(condition.window);
    }
  }
  return [...windows];
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
    // Pour un exercice unilatéral, c'est le côté le plus faible qui compte :
    // un côté fort ne doit pas valider une étape à moitié acquise.
    .map((set) => weakestValues(set.values)[measurementId])
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
