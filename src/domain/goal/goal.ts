import type { ExerciseId } from '../exercise/exercise';
import type { MeasurementId } from '../exercise/measurement';

export type GoalId = string;
export type GoalStatus = 'ACTIVE' | 'ARCHIVED';

/**
 * Ce qu'une condition mesure (§21, §23).
 *
 * Toutes les métriques sont DÉRIVÉES des séries complétées : rien n'est
 * stocké, tout est recalculé. 'setCount' ne porte pas de mesure, puisqu'elle
 * compte des séries et non des valeurs.
 */
export type Metric =
  | { type: 'average'; measurementId: MeasurementId }
  | { type: 'max'; measurementId: MeasurementId }
  | { type: 'min'; measurementId: MeasurementId }
  | { type: 'total'; measurementId: MeasurementId }
  | { type: 'setCount' };

export type Operator = '>=' | '>' | '<=' | '<' | '==';

/** Par exemple : moyenne des tenues >= 10 secondes. */
export type Condition = {
  readonly metric: Metric;
  readonly operator: Operator;
  readonly value: number;
};

/** Toutes ses conditions doivent être satisfaites (décision gelée n°29). */
export type Requirement = {
  readonly conditions: readonly Condition[];
};

/**
 * Une étape de progression (§19), rattachée à UN exercice.
 *
 * C'est ici que se matérialise la décision du 2026-09-05 : les variantes d'un
 * mouvement sont des exercices distincts, et c'est l'ordre des étapes qui les
 * relie. Un Front Lever tuck et un advanced tuck sont deux exercices ; la
 * progression est ce qui en fait une lignée.
 */
export type ProgressionStep = {
  readonly exerciseId: ExerciseId;
  readonly requirements: readonly Requirement[];
};

/**
 * Goal : un objectif sportif (§17). Aggregate Root (décision gelée n°7).
 *
 * Un objectif simple est un objectif à une seule étape : pas besoin d'un
 * second concept pour le représenter.
 */
export class Goal {
  private constructor(
    readonly id: GoalId,
    private _name: string,
    private _steps: readonly ProgressionStep[],
    private _currentStep: number,
    private _status: GoalStatus,
  ) {}

  static create(input: {
    id: GoalId;
    name: string;
    steps: readonly ProgressionStep[];
  }): Goal {
    return new Goal(input.id, normalizeName(input.name), requireSteps(input.steps), 0, 'ACTIVE');
  }

  static restore(input: {
    id: GoalId;
    name: string;
    steps: readonly ProgressionStep[];
    currentStep: number;
    status: GoalStatus;
  }): Goal {
    return new Goal(
      input.id,
      input.name,
      [...input.steps],
      input.currentStep,
      input.status,
    );
  }

  get name(): string {
    return this._name;
  }

  get status(): GoalStatus {
    return this._status;
  }

  get steps(): readonly ProgressionStep[] {
    return [...this._steps];
  }

  get currentStepIndex(): number {
    return this._currentStep;
  }

  get currentStep(): ProgressionStep {
    return this._steps[this._currentStep];
  }

  /** Sur la dernière étape : il n'y a plus rien après. */
  get isOnLastStep(): boolean {
    return this._currentStep === this._steps.length - 1;
  }

  rename(newName: string): void {
    this._name = normalizeName(newName);
  }

  /**
   * AdvanceProgression (§25) : passer à l'étape suivante.
   *
   * Jamais automatique -- le système propose, l'utilisateur décide
   * (décisions gelées n°32 et 33). L'agrégat ne vérifie donc pas que l'étape
   * est atteinte : c'est un choix, pas une conséquence.
   */
  advance(): void {
    if (this._status !== 'ACTIVE') {
      throw new Error('Cet objectif est archivé.');
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

function requireSteps(steps: readonly ProgressionStep[]): readonly ProgressionStep[] {
  if (steps.length === 0) {
    throw new Error('Un objectif doit avoir au moins une étape.');
  }
  for (const step of steps) {
    if (step.requirements.length === 0) {
      throw new Error("Une étape doit avoir au moins une condition à remplir.");
    }
    for (const requirement of step.requirements) {
      if (requirement.conditions.length === 0) {
        throw new Error('Un requirement sans condition ne pourrait jamais être évalué.');
      }
    }
  }
  return [...steps];
}
