import type { MeasurementId } from '../exercise/measurement';
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
 * Fonction pure. Elle ne va chercher aucune donnée et ne sait pas d'où elle
 * vient : on lui remet des ÉCHANTILLONS déjà regroupés par fenêtre, et elle
 * sert à chaque condition ceux que sa propre fenêtre désigne.
 *
 * Un échantillon est un jeu de valeurs mesurées. Il peut venir d'une série
 * (côté faible déjà appliqué, séries abandonnées déjà écartées) ou d'un
 * relevé corporel -- l'évaluation n'a pas à faire la différence. C'est ce qui
 * permet à un objectif de porter sur un tour de cuisse comme sur un
 * Front Lever.
 */
export type Sample = Readonly<Record<MeasurementId, number>>;

export type SamplesByWindow = Readonly<Partial<Record<EvaluationWindow, readonly Sample[]>>>;

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
  samples: SamplesByWindow,
): RequirementEvaluation {
  const evaluations = requirements.map((requirement) => evaluateRequirement(requirement, samples));
  return {
    satisfied: evaluations.every((evaluation) => evaluation.satisfied),
    results: evaluations.flatMap((evaluation) => evaluation.results),
  };
}

export function evaluateRequirement(
  requirement: Requirement,
  samples: SamplesByWindow,
): RequirementEvaluation {
  const results = requirement.conditions.map((condition) => {
    // Chaque condition lit la fenêtre qu'elle déclare, pas une fenêtre
    // supposée par le code qui l'évalue.
    const window = samples[condition.window] ?? [];
    const actual = aggregate(condition.aggregation, condition.measurementId, window);

    return {
      condition,
      actual,
      satisfied: actual !== null && compare(actual, condition.operator, condition.target),
      hasData: window.length > 0,
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

/** null quand rien n'alimente la métrique : aucun échantillon ne la porte. */
function aggregate(
  aggregation: Aggregation,
  measurementId: string | null,
  samples: readonly Sample[],
): number | null {
  if (aggregation === 'setCount') return samples.length;
  if (measurementId === null) return null;

  const values = samples
    .map((sample) => sample[measurementId])
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
