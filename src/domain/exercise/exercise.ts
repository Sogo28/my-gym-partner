import type { MeasurementId } from './measurement';
import type { MuscleId } from './muscle';
import { DomainError } from '../domain-error';

export type ExerciseId = string;

export type CreateExerciseInput = {
  /** Fourni par l'appelant : le domaine ne génère pas d'identifiants (voir note en bas). */
  id: ExerciseId;
  name: string;
  isUnilateral: boolean;
  measurementIds: readonly MeasurementId[];
  /** Les groupes musculaires sollicités. Facultatif : aide au classement. */
  muscleIds?: readonly MuscleId[];
};

/**
 * Exercise : la définition d'un exercice (§4).
 *
 * Aggregate Root (décision gelée n°1). Il définit ce qu'est l'exercice et
 * comment sa performance peut être mesurée -- jamais les valeurs mesurées,
 * qui appartiennent aux données de performance.
 *
 * Les Measurement sont référencés PAR IDENTIFIANT et non par objet : ce sont
 * des agrégats distincts, avec leur propre cycle de vie. Un exercice ne peut
 * donc pas modifier une mesure, seulement s'y référer.
 */
export class Exercise {
  private constructor(
    readonly id: ExerciseId,
    private _name: string,
    readonly isUnilateral: boolean,
    private _measurementIds: readonly MeasurementId[],
    private _muscleIds: readonly MuscleId[],
    private _isArchived: boolean,
  ) {}

  static create(input: CreateExerciseInput): Exercise {
    const name = normalizeName(input.name);
    const measurementIds = normalizeMeasurementIds(input.measurementIds);
    return new Exercise(
      input.id,
      name,
      input.isUnilateral,
      measurementIds,
      unique(input.muscleIds ?? []),
      false,
    );
  }

  /** Utilisé par le repository pour recharger un exercice existant. */
  static restore(input: CreateExerciseInput & { isArchived: boolean }): Exercise {
    return new Exercise(
      input.id,
      input.name,
      input.isUnilateral,
      [...input.measurementIds],
      [...(input.muscleIds ?? [])],
      input.isArchived,
    );
  }

  get name(): string {
    return this._name;
  }

  get measurementIds(): readonly MeasurementId[] {
    return this._measurementIds;
  }

  get muscleIds(): readonly MuscleId[] {
    return [...this._muscleIds];
  }

  get isArchived(): boolean {
    return this._isArchived;
  }

  rename(newName: string): void {
    this._name = normalizeName(newName);
  }

  /**
   * Changer les mesures d'un exercice n'affecte AUCUNE performance passée :
   * chacune a copié les siennes au moment où elle a eu lieu (§2). On peut
   * donc corriger une définition sans réécrire l'histoire.
   */
  changeMeasurements(measurementIds: readonly MeasurementId[]): void {
    this._measurementIds = normalizeMeasurementIds(measurementIds);
  }

  /**
   * Les muscles ciblés servent à retrouver un exercice, jamais à juger une
   * performance : les modifier n'a donc aucun effet sur l'historique, et
   * n'en cibler aucun reste valide.
   */
  changeMuscles(muscleIds: readonly MuscleId[]): void {
    this._muscleIds = unique(muscleIds);
  }

  /**
   * Archiver plutôt que supprimer : l'exercice sort des listes de choix mais
   * reste rattaché à tout ce qu'il a produit. Supprimer romprait le lien avec
   * des performances qui, elles, ont bien eu lieu.
   */
  archive(): void {
    this._isArchived = true;
  }

  unarchive(): void {
    this._isArchived = false;
  }
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new DomainError("Le nom d'un exercice ne peut pas être vide.");
  }
  return trimmed;
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

function normalizeMeasurementIds(ids: readonly MeasurementId[]): readonly MeasurementId[] {
  if (ids.length === 0) {
    throw new DomainError('Un exercice doit être mesurable par au moins une mesure.');
  }
  if (new Set(ids).size !== ids.length) {
    throw new DomainError('Un exercice ne peut pas référencer deux fois la même mesure.');
  }
  return [...ids];
}
