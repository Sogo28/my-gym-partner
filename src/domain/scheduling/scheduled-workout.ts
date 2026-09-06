import type { PlannedWorkoutId } from '../planned-workout/planned-workout';
import { DomainError } from '../domain-error';

export type ScheduledWorkoutId = string;

/** États du programmé (§31). Pas de MISSED en V1 (décision gelée n°11). */
export type ScheduledWorkoutStatus = 'SCHEDULED' | 'EXECUTED' | 'CANCELLED';

/**
 * ScheduledWorkout : l'intention d'exécuter un entraînement à une date (§7).
 *
 * Aggregate Root (décision gelée n°4). Il ne contient pas l'entraînement, il
 * le RÉFÉRENCE : le même programme peut être placé vingt fois dans le
 * calendrier sans être dupliqué.
 *
 * Une date passée sans exécution reste SCHEDULED : le cahier refuse
 * explicitement un état MISSED, et c'est cohérent -- une séance repoussée
 * n'est pas une séance ratée.
 */
export class ScheduledWorkout {
  private constructor(
    readonly id: ScheduledWorkoutId,
    readonly plannedWorkoutId: PlannedWorkoutId,
    private _scheduledAt: Date,
    private _status: ScheduledWorkoutStatus,
  ) {}

  static schedule(input: {
    id: ScheduledWorkoutId;
    plannedWorkoutId: PlannedWorkoutId;
    at: Date;
  }): ScheduledWorkout {
    return new ScheduledWorkout(input.id, input.plannedWorkoutId, input.at, 'SCHEDULED');
  }

  static restore(input: {
    id: ScheduledWorkoutId;
    plannedWorkoutId: PlannedWorkoutId;
    scheduledAt: Date;
    status: ScheduledWorkoutStatus;
  }): ScheduledWorkout {
    return new ScheduledWorkout(
      input.id,
      input.plannedWorkoutId,
      input.scheduledAt,
      input.status,
    );
  }

  get scheduledAt(): Date {
    return this._scheduledAt;
  }

  get status(): ScheduledWorkoutStatus {
    return this._status;
  }

  /** En retard, mais toujours à faire : ce n'est pas un état, c'est un constat. */
  isOverdue(now: Date): boolean {
    return this._status === 'SCHEDULED' && this._scheduledAt.getTime() < now.getTime();
  }

  /** RescheduleWorkout (§28) : déplacer une intention encore ouverte. */
  reschedule(at: Date): void {
    this.requireScheduled();
    this._scheduledAt = at;
  }

  /** CancelScheduledWorkout (§28). */
  cancel(): void {
    this.requireScheduled();
    this._status = 'CANCELLED';
  }

  /**
   * SCHEDULED -> EXECUTED.
   *
   * Marqué quand la séance est TERMINÉE, et non à son démarrage : une séance
   * annulée laisse donc l'intention ouverte, et la journée reste rattrapable
   * (décidé le 2026-09-06).
   */
  markExecuted(): void {
    this.requireScheduled();
    this._status = 'EXECUTED';
  }

  private requireScheduled(): void {
    if (this._status !== 'SCHEDULED') {
      throw new DomainError(
        this._status === 'EXECUTED'
          ? 'Cet entraînement a déjà été exécuté.'
          : 'Cet entraînement programmé a été annulé.',
      );
    }
  }
}
