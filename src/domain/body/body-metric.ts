import { DomainError } from '../domain-error';
import type { MuscleId } from '../exercise/muscle';

export type BodyMetricId = string;

/**
 * BodyMetric : une mensuration que l'on suit -- tour de cuisse, poids.
 *
 * À ne pas confondre avec Measurement, qui dit comment se mesure une
 * PERFORMANCE (répétitions, durée). Une mensuration ne sort d'aucune série :
 * elle se relève au mètre ruban ou sur une balance, et se saisit à la main.
 *
 * Elle déclare les muscles qu'elle concerne : c'est ce qui permettra de
 * montrer, à côté d'un objectif de tour de cuisse, les exercices qui
 * travaillent les quadriceps -- comme contexte, jamais comme preuve.
 */
export class BodyMetric {
  private constructor(
    readonly id: BodyMetricId,
    private _name: string,
    private _unit: string,
    private _muscleIds: readonly MuscleId[],
    /** Le catalogue de départ ne se supprime pas. */
    readonly isBuiltIn: boolean,
  ) {}

  static create(input: {
    id: BodyMetricId;
    name: string;
    unit: string;
    muscleIds?: readonly MuscleId[];
    isBuiltIn?: boolean;
  }): BodyMetric {
    return new BodyMetric(
      input.id,
      requireText(input.name, "Le nom d'une mensuration ne peut pas être vide."),
      requireText(input.unit, 'Une mensuration doit avoir une unité (cm, kg...).'),
      [...new Set(input.muscleIds ?? [])],
      input.isBuiltIn ?? false,
    );
  }

  get name(): string {
    return this._name;
  }

  get unit(): string {
    return this._unit;
  }

  get muscleIds(): readonly MuscleId[] {
    return [...this._muscleIds];
  }

  rename(name: string): void {
    this._name = requireText(name, "Le nom d'une mensuration ne peut pas être vide.");
  }

  changeMuscles(muscleIds: readonly MuscleId[]): void {
    this._muscleIds = [...new Set(muscleIds)];
  }
}

/**
 * BodyReading : un relevé daté.
 *
 * Une valeur et un instant, rien de plus. C'est le grain le plus fin du
 * suivi corporel, et il n'appartient à aucune séance.
 */
export type BodyReadingId = string;

export class BodyReading {
  private constructor(
    readonly id: BodyReadingId,
    readonly metricId: BodyMetricId,
    private _value: number,
    private _takenAt: Date,
  ) {}

  static record(input: {
    id: BodyReadingId;
    metricId: BodyMetricId;
    value: number;
    at: Date;
  }): BodyReading {
    return new BodyReading(input.id, input.metricId, checkValue(input.value), input.at);
  }

  static restore(input: {
    id: BodyReadingId;
    metricId: BodyMetricId;
    value: number;
    takenAt: Date;
  }): BodyReading {
    return new BodyReading(input.id, input.metricId, input.value, input.takenAt);
  }

  get value(): number {
    return this._value;
  }

  get takenAt(): Date {
    return this._takenAt;
  }

  /** Corriger une saisie : un relevé mal noté reste un relevé à corriger. */
  correct(value: number, at: Date = this._takenAt): void {
    this._value = checkValue(value);
    this._takenAt = at;
  }
}

function checkValue(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainError('Un relevé doit être un nombre strictement positif.');
  }
  return value;
}

function requireText(value: string, message: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new DomainError(message);
  }
  return trimmed;
}
