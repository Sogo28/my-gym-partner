import type { ExerciseId } from '../exercise/exercise';
import type { ExercisePerformanceId } from '../performance/exercise-performance';
import type { PlannedWorkoutId } from '../planned-workout/planned-workout';
import type { ScheduledWorkoutId } from '../scheduling/scheduled-workout';

export type WorkoutSessionId = string;

/** États de la séance (§31). Une fois terminée ou annulée, elle ne bouge plus. */
export type WorkoutSessionStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

/**
 * Activity : l'exécution d'un exercice dans une séance (§9).
 *
 * Elle APPARTIENT à la séance et n'est pas un Aggregate Root (décision gelée
 * n°8) : elle dit "j'ai fait du pull-up à 18h05 pendant cette séance". La
 * performance réelle, elle, vivra dans un agrégat séparé pour survivre à
 * l'annulation de la séance.
 */
export type Activity = {
  readonly exerciseId: ExerciseId;
  /**
   * Un LIEN vers la performance, pas la performance elle-même : elle vit dans
   * son propre agrégat et survivra à l'annulation de cette séance.
   *
   * Nullable uniquement pour les activités enregistrées avant que les
   * performances n'existent : toute nouvelle activité en a une.
   */
  readonly performanceId: ExercisePerformanceId | null;
  /**
   * D'où vient cet exercice : sa position dans le PlannedWorkout, ou null
   * s'il a été ajouté librement (§9). Le même exercice pouvant figurer deux
   * fois dans un plan, l'identifiant seul ne suffirait pas à le retrouver.
   */
  readonly plannedPosition: number | null;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
};

/**
 * Rest : une période de repos (§13).
 *
 * Elle appartient au fil temporel de la SÉANCE, pas à une série : un repos a
 * un début, une fin, et peut être interrompu. Le cahier des charges écarte
 * explicitement la modélisation naïve d'un nombre de secondes posé sur la
 * série (n°19).
 */
export type Rest = {
  readonly startedAt: Date;
  readonly endedAt: Date | null;
};

/**
 * WorkoutSession : l'exécution réelle d'un entraînement (§8).
 *
 * Peut naître d'un PlannedWorkout ou de rien du tout (séance libre, n°13).
 * Même issue d'un plan, elle peut en dévier librement (n°14) : le plan n'est
 * qu'une intention, la séance enregistre ce qui se passe vraiment.
 *
 * Le temps entre par les paramètres (`at`) au lieu d'être lu dans l'horloge :
 * c'est ce qui rend les transitions testables de façon déterministe.
 */
export class WorkoutSession {
  private constructor(
    readonly id: WorkoutSessionId,
    readonly plannedWorkoutId: PlannedWorkoutId | null,
    /** L'intention programmée dont vient cette séance, s'il y en a une (§8). */
    readonly scheduledWorkoutId: ScheduledWorkoutId | null,
    readonly startedAt: Date,
    private _status: WorkoutSessionStatus,
    private _endedAt: Date | null,
    private _activities: Activity[],
    private _rests: Rest[],
  ) {}

  static start(input: {
    id: WorkoutSessionId;
    plannedWorkoutId?: PlannedWorkoutId | null;
    scheduledWorkoutId?: ScheduledWorkoutId | null;
    at: Date;
  }): WorkoutSession {
    return new WorkoutSession(
      input.id,
      input.plannedWorkoutId ?? null,
      input.scheduledWorkoutId ?? null,
      input.at,
      'ACTIVE',
      null,
      [],
      [],
    );
  }

  /** Utilisé par le repository pour reconstruire une séance déjà commencée. */
  static restore(input: {
    id: WorkoutSessionId;
    plannedWorkoutId: PlannedWorkoutId | null;
    scheduledWorkoutId?: ScheduledWorkoutId | null;
    startedAt: Date;
    status: WorkoutSessionStatus;
    endedAt: Date | null;
    activities: readonly Activity[];
    rests?: readonly Rest[];
  }): WorkoutSession {
    return new WorkoutSession(
      input.id,
      input.plannedWorkoutId,
      input.scheduledWorkoutId ?? null,
      input.startedAt,
      input.status,
      input.endedAt,
      [...input.activities],
      [...(input.rests ?? [])],
    );
  }

  get status(): WorkoutSessionStatus {
    return this._status;
  }

  get endedAt(): Date | null {
    return this._endedAt;
  }

  get activities(): readonly Activity[] {
    return [...this._activities];
  }

  get rests(): readonly Rest[] {
    return [...this._rests];
  }

  /** Le repos en cours, s'il y en a un. */
  get currentRest(): Rest | null {
    const last = this._rests.at(-1);
    return last && last.endedAt === null ? last : null;
  }

  startRest(at: Date): void {
    this.requireActive();
    if (this.currentRest) {
      throw new Error('Un repos est déjà en cours.');
    }
    this._rests.push({ startedAt: at, endedAt: null });
  }

  /** Termine le repos, qu'il soit arrivé à son terme ou interrompu (§13). */
  stopRest(at: Date): void {
    this.requireActive();
    const current = this.currentRest;
    if (!current) {
      throw new Error("Aucun repos n'est en cours.");
    }
    this._rests[this._rests.length - 1] = { ...current, endedAt: at };
  }

  /** Une seule activité peut être en cours à la fois. */
  get currentActivity(): Activity | null {
    const last = this._activities.at(-1);
    return last && last.finishedAt === null ? last : null;
  }

  /**
   * L'exercice peut être planifié ou ajouté librement (§30) : la séance ne
   * consulte pas le plan pour l'autoriser. Dévier fait partie du métier.
   */
  startActivity(
    exerciseId: ExerciseId,
    performanceId: ExercisePerformanceId,
    at: Date,
    plannedPosition: number | null = null,
  ): void {
    this.requireActive();
    if (this.currentActivity) {
      throw new Error("Termine l'exercice en cours avant d'en commencer un autre.");
    }
    this._activities.push({
      exerciseId,
      performanceId,
      plannedPosition,
      startedAt: at,
      finishedAt: null,
    });
  }

  finishCurrentActivity(at: Date): void {
    this.requireActive();
    const index = this._activities.length - 1;
    if (!this.currentActivity) {
      throw new Error("Aucun exercice n'est en cours.");
    }
    this._activities[index] = { ...this._activities[index], finishedAt: at };
  }

  /**
   * ACTIVE -> COMPLETED. On clôt l'exercice en cours au passage : laisser une
   * activité sans fin dans une séance terminée serait un état incohérent.
   */
  finish(at: Date): void {
    this.requireActive();
    this.closeCurrentActivity(at);
    this._status = 'COMPLETED';
    this._endedAt = at;
  }

  /**
   * ACTIVE -> CANCELLED. Les activités déjà enregistrées sont conservées : la
   * séance annulée reste la trace de ce qui a réellement eu lieu (n°15).
   */
  cancel(at: Date): void {
    this.requireActive();
    this.closeCurrentActivity(at);
    this._status = 'CANCELLED';
    this._endedAt = at;
  }

  /** Une séance terminée ne laisse ni exercice ni repos ouvert derrière elle. */
  private closeCurrentActivity(at: Date): void {
    if (this.currentActivity) {
      this.finishCurrentActivity(at);
    }
    if (this.currentRest) {
      this.stopRest(at);
    }
  }

  private requireActive(): void {
    if (this._status !== 'ACTIVE') {
      throw new Error(
        this._status === 'COMPLETED'
          ? 'Cette séance est déjà terminée.'
          : 'Cette séance a été annulée.',
      );
    }
  }
}
