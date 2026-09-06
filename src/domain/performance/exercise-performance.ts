import type { ExerciseId } from '../exercise/exercise';
import type { MeasurementId } from '../exercise/measurement';
import { DomainError } from '../domain-error';

export type ExercisePerformanceId = string;

/** États d'une série réelle (§11). */
export type PerformanceSetStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

/** Les valeurs réellement réalisées d'un côté : { reps: 8, weight: 10 }. */
export type SetValues = Readonly<Record<MeasurementId, number>>;

/**
 * De quel côté du corps une valeur a été réalisée.
 *
 * Le côté n'est PAS une mesure (décision gelée n°22) : c'est une propriété de
 * l'exécution. Un exercice bilatéral n'en connaît qu'un, BOTH.
 */
export type Side = 'BOTH' | 'LEFT' | 'RIGHT';

/**
 * Les valeurs d'une série, par côté.
 *
 * Une série unilatérale porte les DEUX côtés (§4) : ce n'est pas deux séries.
 * Un côté peut manquer -- on rattrape parfois le côté faible seul, ou on
 * s'épargne un côté blessé -- et cette absence n'est pas un zéro.
 */
export type ValuesBySide = Readonly<Partial<Record<Side, SetValues>>>;

/**
 * Ce qui compte pour les statistiques et les objectifs : le côté le plus
 * faible (décidé le 2026-09-06).
 *
 * On progresse au rythme du côté qui suit le moins ; laisser un côté fort
 * compenser l'autre validerait une étape à moitié acquise. Quand un seul côté
 * a été fait, c'est lui qui parle : il n'y a rien à comparer.
 */
export function weakestValues(values: ValuesBySide): SetValues {
  const sides = Object.values(values).filter((side): side is SetValues => side !== undefined);
  if (sides.length === 0) return {};

  const measurementIds = new Set(sides.flatMap((side) => Object.keys(side)));
  const weakest: Record<MeasurementId, number> = {};

  for (const measurementId of measurementIds) {
    const done = sides
      .map((side) => side[measurementId])
      .filter((value): value is number => value !== undefined);
    if (done.length > 0) weakest[measurementId] = Math.min(...done);
  }

  return weakest;
}

/**
 * PerformanceSet : l'exécution réelle d'une série (§11).
 *
 * IN_PROGRESS n'est pas une performance historique, ABANDONED n'est pas une
 * série complétée (n°18) : seules les COMPLETED comptent pour les
 * statistiques, l'historique et l'évaluation des objectifs.
 */
export type PerformanceSet = {
  readonly status: PerformanceSetStatus;
  readonly values: ValuesBySide;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
};

/**
 * ExercisePerformance : la performance réelle sur un exercice (§10).
 *
 * Aggregate Root (décision gelée n°6), volontairement SÉPARÉ de la séance :
 * c'est ce qui permet à des séries complétées de survivre à l'annulation de
 * la séance qui les a produites (n°15).
 *
 * Les mesures de l'exercice sont COPIÉES à la création. Une performance est un
 * fait daté : elle ne doit pas changer de sens parce que la définition de
 * l'exercice évolue plus tard (§2).
 */
export class ExercisePerformance {
  private constructor(
    readonly id: ExercisePerformanceId,
    readonly exerciseId: ExerciseId,
    readonly measurementIds: readonly MeasurementId[],
    readonly startedAt: Date,
    private _sets: PerformanceSet[],
  ) {}

  static start(input: {
    id: ExercisePerformanceId;
    exerciseId: ExerciseId;
    measurementIds: readonly MeasurementId[];
    at: Date;
  }): ExercisePerformance {
    if (input.measurementIds.length === 0) {
      throw new DomainError('Un exercice sans mesure ne peut pas être enregistré.');
    }
    return new ExercisePerformance(
      input.id,
      input.exerciseId,
      [...input.measurementIds],
      input.at,
      [],
    );
  }

  static restore(input: {
    id: ExercisePerformanceId;
    exerciseId: ExerciseId;
    measurementIds: readonly MeasurementId[];
    startedAt: Date;
    sets: readonly PerformanceSet[];
  }): ExercisePerformance {
    return new ExercisePerformance(
      input.id,
      input.exerciseId,
      [...input.measurementIds],
      input.startedAt,
      [...input.sets],
    );
  }

  get sets(): readonly PerformanceSet[] {
    return [...this._sets];
  }

  get currentSet(): PerformanceSet | null {
    const last = this._sets.at(-1);
    return last && last.status === 'IN_PROGRESS' ? last : null;
  }

  /** Les seules séries qui comptent comme performance (n°18). */
  get completedSets(): readonly PerformanceSet[] {
    return this._sets.filter((set) => set.status === 'COMPLETED');
  }

  startSet(at: Date): void {
    if (this.currentSet) {
      throw new DomainError('Une série est déjà en cours.');
    }
    this._sets.push({ status: 'IN_PROGRESS', values: {}, startedAt: at, endedAt: null });
  }

  /** IN_PROGRESS -> COMPLETED : les valeurs deviennent une performance. */
  completeCurrentSet(values: ValuesBySide, at: Date): void {
    this.replaceCurrentSet('COMPLETED', this.checkValues(values), at);
  }

  /**
   * IN_PROGRESS -> ABANDONED. On garde les valeurs saisies avant l'abandon
   * (elles restent lisibles pendant la séance) mais la série ne comptera pas
   * comme performance.
   */
  abandonCurrentSet(at: Date, values: ValuesBySide = {}): void {
    this.replaceCurrentSet('ABANDONED', values, at);
  }

  /**
   * Marque comme ABANDONNÉES les séries prévues qui n'ont pas été faites.
   *
   * Appelé quand on passe à l'exercice suivant sans terminer le programme :
   * l'historique garde la trace de ce qui était prévu, sans jamais compter
   * ces séries comme des performances (n°18).
   */
  abandonRemainingPlannedSets(plannedCount: number, at: Date): void {
    if (this.currentSet) {
      this.abandonCurrentSet(at);
    }
    for (let index = this._sets.length; index < plannedCount; index += 1) {
      this.startSet(at);
      this.abandonCurrentSet(at);
    }
  }

  /**
   * Corriger la saisie d'une série déjà terminée.
   *
   * Nécessaire parce qu'on valide la série avec les valeurs prévues puis on
   * corrige pendant le repos : la performance reste ce que l'utilisateur
   * confirme, il faut donc pouvoir revenir sur une valeur supposée.
   * Ne change pas l'état de la série : une série abandonnée le reste.
   */
  correctSetValues(setIndex: number, values: ValuesBySide): void {
    const set = this._sets[setIndex];
    if (!set) {
      throw new DomainError("Cette série n'existe pas.");
    }
    if (set.status === 'IN_PROGRESS') {
      throw new DomainError("Cette série est encore en cours : termine-la d'abord.");
    }
    this._sets[setIndex] = { ...set, values: this.checkValues(values) };
  }

  private replaceCurrentSet(status: PerformanceSetStatus, values: ValuesBySide, at: Date): void {
    const current = this.currentSet;
    if (!current) {
      throw new DomainError("Aucune série n'est en cours.");
    }
    this._sets[this._sets.length - 1] = { ...current, status, values, endedAt: at };
  }

  private checkValues(values: ValuesBySide): ValuesBySide {
    const sides = Object.entries(values).filter(([, side]) => side !== undefined);
    if (sides.length === 0 || sides.every(([, side]) => Object.keys(side!).length === 0)) {
      throw new DomainError('Une série complétée doit avoir au moins une valeur.');
    }

    const checked: Record<string, SetValues> = {};
    for (const [side, sideValues] of sides) {
      for (const [measurementId, value] of Object.entries(sideValues!)) {
        // La performance connaît les mesures de son exercice : elle peut donc
        // refuser une valeur qui n'a pas de sens pour lui.
        if (!this.measurementIds.includes(measurementId)) {
          throw new DomainError(`Cet exercice ne se mesure pas en "${measurementId}".`);
        }
        if (!Number.isFinite(value) || value < 0) {
          throw new DomainError(`La valeur de "${measurementId}" doit être un nombre positif.`);
        }
      }
      checked[side] = { ...sideValues! };
    }

    return checked;
  }
}
