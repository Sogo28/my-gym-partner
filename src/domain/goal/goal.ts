import type { BodyMetricId } from '../body/body-metric';
import type { ExerciseId } from '../exercise/exercise';
import type { MeasurementId } from '../exercise/measurement';
import { DomainError } from '../domain-error';

export type GoalId = string;
export type GoalStatus = 'ACTIVE' | 'ARCHIVED';

/** Comment les valeurs d'une mesure sont réduites à un nombre (§7 du modèle). */
export type Aggregation = 'average' | 'max' | 'min' | 'total' | 'setCount';

/**
 * Sur quoi porte l'évaluation (§6).
 *
 * La fenêtre appartient à la CONDITION et non à l'objectif : deux conditions
 * d'une même exigence peuvent regarder des périodes différentes -- la forme
 * du jour d'un côté, le volume accumulé de l'autre.
 *
 * LAST_SESSION : la dernière séance où l'exercice a été réellement travaillé,
 *   toutes ses performances confondues -- un exercice repris en fin de séance
 *   compte avec celui du début.
 * ALL_TIME     : tout l'historique de l'exercice.
 */
export type EvaluationWindow = 'LAST_SESSION' | 'ALL_TIME' | 'LATEST_READING';

/**
 * Sur quoi porte un objectif ou une étape.
 *
 * Un exercice, dont les performances se produisent en séance -- ou une
 * mensuration, qui ne sort d'aucune séance et se relève à la main. Les deux
 * s'évaluent de la même façon une fois les données rassemblées, mais elles ne
 * viennent pas du même endroit.
 */
export type GoalSubject =
  | { readonly kind: 'exercise'; readonly exerciseId: ExerciseId }
  | { readonly kind: 'body'; readonly metricId: BodyMetricId };

/** Les fenêtres qu'un sujet sait alimenter. */
export function windowsFor(subject: GoalSubject): EvaluationWindow[] {
  return subject.kind === 'exercise' ? ['LAST_SESSION', 'ALL_TIME'] : ['LATEST_READING'];
}

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
  readonly subject: GoalSubject;
  readonly requirements: readonly Requirement[];
};

/**
 * Un objectif simple : un exercice et un requirement, sans étape (n°3, n°4).
 * On ne fabrique pas de ProgressionStep pour le représenter.
 */
export type SimpleTarget = {
  readonly kind: 'simple';
  readonly subject: GoalSubject;
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

  /** Ce qui est actuellement visé, quelle que soit la forme de l'objectif. */
  get currentSubject(): GoalSubject {
    return this._target.kind === 'simple'
      ? this._target.subject
      : this._target.steps[this._currentStep].subject;
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
      throw new DomainError('Cet objectif est archivé.');
    }
    if (this._target.kind === 'simple') {
      throw new DomainError("Cet objectif n'a pas d'étapes.");
    }
    if (this.isOnLastStep) {
      throw new DomainError('Cet objectif est déjà à sa dernière étape.');
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
    throw new DomainError("Le nom d'un objectif ne peut pas être vide.");
  }
  return trimmed;
}

function checkTarget(target: GoalTarget): GoalTarget {
  if (target.kind === 'simple') {
    if (target.requirements.length === 0) {
      throw new DomainError('Un objectif simple doit avoir au moins un requirement.');
    }
    target.requirements.forEach((requirement) => checkRequirement(requirement, target.subject));
    return target;
  }

  if (target.steps.length === 0) {
    throw new DomainError('Une progression doit avoir au moins une étape.');
  }
  for (const step of target.steps) {
    step.requirements.forEach((requirement) => checkRequirement(requirement, step.subject));
  }
  return { kind: 'progressive', steps: [...target.steps] };
}

function checkRequirement(requirement: Requirement, subject: GoalSubject): void {
  if (requirement.conditions.length === 0) {
    throw new DomainError('Un requirement sans condition ne pourrait jamais être évalué.');
  }

  const allowed = windowsFor(subject);
  for (const condition of requirement.conditions) {
    if (condition.aggregation !== 'setCount' && condition.measurementId === null) {
      throw new DomainError('Cette condition doit préciser la mesure qu elle observe.');
    }
    // Une mensuration n'a pas de séances, un exercice n'a pas de relevés :
    // une condition ne peut pas demander une période que son sujet ignore.
    if (!allowed.includes(condition.window)) {
      throw new DomainError(
        subject.kind === 'body'
          ? 'Une mensuration ne s évalue que sur son dernier relevé.'
          : 'Un exercice ne s évalue pas sur un relevé corporel.',
      );
    }
  }
}
