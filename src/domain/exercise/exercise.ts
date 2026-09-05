import type { MeasurementId } from './measurement';

export type ExerciseId = string;

export type CreateExerciseInput = {
  /** Fourni par l'appelant : le domaine ne génère pas d'identifiants (voir note en bas). */
  id: ExerciseId;
  name: string;
  isUnilateral: boolean;
  measurementIds: readonly MeasurementId[];
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
  ) {}

  static create(input: CreateExerciseInput): Exercise {
    const name = normalizeName(input.name);
    const measurementIds = normalizeMeasurementIds(input.measurementIds);
    return new Exercise(input.id, name, input.isUnilateral, measurementIds);
  }

  get name(): string {
    return this._name;
  }

  get measurementIds(): readonly MeasurementId[] {
    return this._measurementIds;
  }

  rename(newName: string): void {
    this._name = normalizeName(newName);
  }
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error("Le nom d'un exercice ne peut pas être vide.");
  }
  return trimmed;
}

function normalizeMeasurementIds(ids: readonly MeasurementId[]): readonly MeasurementId[] {
  if (ids.length === 0) {
    throw new Error('Un exercice doit être mesurable par au moins une mesure.');
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error('Un exercice ne peut pas référencer deux fois la même mesure.');
  }
  return [...ids];
}
