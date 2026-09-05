import type { ExerciseId } from '../exercise/exercise';
import type { MeasurementId } from '../exercise/measurement';

export type GoalId = string;
export type GoalStatus = 'ACTIVE' | 'ARCHIVED';

/** Comment les valeurs d'une mesure sont réduites à un nombre (§7 du modèle). */
export type Aggregation = 'average' | 'max' | 'min' | 'total' | 'setCount';

/**
 * Sur quoi porte l'évaluation (§6).
 *
 * En V1 il n'existe qu'une fenêtre, mais elle appartient explicitement à la
 * Condition : c'est une donnée du modèle, pas une hypothèse du code qui
 * l'évalue.
 */
export type EvaluationWindow = 'LAST_SESSION';

export type Operator = '>=' | '>' | '<=' | '<' | '==';

/**
 * Une Condition (§5) : quelle mesure, sur quelle fenêtre, agrégée comment,
 * comparée par quel opérateur, à quelle cible.
 *
 * measurementId est nul pour 'setCount', qui compte des séries et non des
 * valeurs.
 */
export type Condition = {
  readonly measurementId: MeasurementId | null;
  readonly window: EvaluationWindow;
  readonly aggregation: Aggregation;
  readonly operator: Operator;
  readonly target: number;
};

/** Au moins une Condition, et toutes doivent être satisfaites (n°9, n°10). */
export type Requirement = {
  readonly conditions: readonly Condition[];
};

/**
 * Une étape cible un Exercise et possède un ou plusieurs Requirements (n°9),
 * ou aucun -- elle est alors validée à la main.
 *
 * Plusieurs Requirements se combinent en ET : l'étape est atteinte quand tous
 * le sont.
 */
export type ProgressionStep = {
  readonly exerciseId: ExerciseId;
  readonly requirements: readonly Requirement[];
};

/**
 * Un objectif simple : un exercice et un requirement, sans étape (n°3, n°4).
 * On ne fabrique pas de ProgressionStep pour le représenter.
 */
export type SimpleTarget = {
  readonly kind: 'simple';
  readonly exerciseId: ExerciseId;
  readonly requirements: readonly Requirement[];
};

/** Un objectif progressif : des étapes ordonnées, au moins une (n°5, n°6). */
export type Progression = {
  readonly kind: 'progressive';
  readonly steps: readonly ProgressionStep[];
};

export type GoalTarget = SimpleTarget | Progression;

/**
 * Goal (§1). Aggregate Root.
 *
 * Simple ou progressif : les deux formes sont distinctes dans le modèle, et
 * non une forme dégradée de l'autre.
 */
export class Goal {
  private constructor(
    readonly id: GoalId,
    private _name: string,
    private _target: GoalTarget,
    private _currentStep: number,
    private _status: GoalStatus,
  ) {}

  static create(input: { id: GoalId; name: string; target: GoalTarget }): Goal {
    return new Goal(input.id, normalizeName(input.name), checkTarget(input.target), 0, 'ACTIVE');
  }

  static restore(input: {
    id: GoalId;
    name: string;
    target: GoalTarget;
    currentStep: number;
    status: GoalStatus;
  }): Goal {
    return new Goal(input.id, input.name, input.target, input.currentStep, input.status);
  }

  get name(): string {
    return this._name;
  }

  get status(): GoalStatus {
    return this._status;
  }

  get target(): GoalTarget {
    return this._target;
  }

  get isProgressive(): boolean {
    return this._target.kind === 'progressive';
  }

  /** Les étapes, ou un tableau vide pour un objectif simple. */
  get steps(): readonly ProgressionStep[] {
    return this._target.kind === 'progressive' ? this._target.steps : [];
  }

  get currentStepIndex(): number {
    return this._currentStep;
  }

  /** L'exercice actuellement visé, quelle que soit la forme de l'objectif. */
  get currentExerciseId(): ExerciseId {
    return this._target.kind === 'simple'
      ? this._target.exerciseId
      : this._target.steps[this._currentStep].exerciseId;
  }

  /** Ce qu'il faut satisfaire aujourd'hui. Vide si rien n'est imposé. */
  get currentRequirements(): readonly Requirement[] {
    return this._target.kind === 'simple'
      ? this._target.requirements
      : this._target.steps[this._currentStep].requirements;
  }

  /** Un objectif simple est toujours à sa dernière (et unique) cible. */
  get isOnLastStep(): boolean {
    return this._target.kind === 'simple' || this._currentStep === this._target.steps.length - 1;
  }

  rename(newName: string): void {
    this._name = normalizeName(newName);
  }

  /**
   * Modifier la règle d'évaluation (§9).
   *
   * Ne touche à aucune performance : l'historique dit ce qui s'est passé, le
   * requirement dit comment on le juge. Les deux ne se mélangent pas.
   */
  changeTarget(target: GoalTarget): void {
    this._target = checkTarget(target);
    this._currentStep = Math.min(this._currentStep, Math.max(this.steps.length - 1, 0));
  }

  /** AdvanceProgression : jamais automatique, c'est un choix (n°17, n°18). */
  advance(): void {
    if (this._status !== 'ACTIVE') {
      throw new Error('Cet objectif est archivé.');
    }
    if (this._target.kind === 'simple') {
      throw new Error("Cet objectif n'a pas d'étapes.");
    }
    if (this.isOnLastStep) {
      throw new Error('Cet objectif est déjà à sa dernière étape.');
    }
    this._currentStep += 1;
  }

  archive(): void {
    this._status = 'ARCHIVED';
  }
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error("Le nom d'un objectif ne peut pas être vide.");
  }
  return trimmed;
}

function checkTarget(target: GoalTarget): GoalTarget {
  if (target.kind === 'simple') {
    if (target.requirements.length === 0) {
      throw new Error('Un objectif simple doit avoir au moins un requirement.');
    }
    target.requirements.forEach(checkRequirement);
    return target;
  }

  if (target.steps.length === 0) {
    throw new Error('Une progression doit avoir au moins une étape.');
  }
  for (const step of target.steps) {
    step.requirements.forEach(checkRequirement);
  }
  return { kind: 'progressive', steps: [...target.steps] };
}

function checkRequirement(requirement: Requirement): void {
  if (requirement.conditions.length === 0) {
    throw new Error('Un requirement sans condition ne pourrait jamais être évalué.');
  }
  for (const condition of requirement.conditions) {
    if (condition.aggregation !== 'setCount' && condition.measurementId === null) {
      throw new Error('Cette condition doit préciser la mesure qu elle observe.');
    }
  }
}
