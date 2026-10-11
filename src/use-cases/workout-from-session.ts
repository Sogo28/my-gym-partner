import { DomainError } from '../domain/domain-error';
import { weakestValues } from '../domain/performance/exercise-performance';
import type {
  PlannedExercise,
  PlannedWorkout,
  TargetValues,
} from '../domain/planned-workout/planned-workout';
import { findAll as findAllExercises } from '../infra/exercise-repository';
import { findByIds } from '../infra/performance-repository';
import { findAll as findAllWorkouts } from '../infra/planned-workout-repository';
import { findById } from '../infra/workout-session-repository';
import { createPlannedWorkout } from './create-planned-workout';

/**
 * Ce qu'un entraînement tiré de cette séance contiendrait (décidé le
 * 2026-10-10) : ses exercices dans l'ordre, une série prévue par série
 * FAITE, et pour cible ce qui a été réellement fait.
 *
 * - Les séries abandonnées ne comptent pas : elles ne disent pas ce qu'on
 *   sait faire.
 * - Un exercice fait des deux côtés vise le plus faible des deux : c'est
 *   celui qu'on est sûr de refaire.
 * - Un exercice repris juste après une coupure -- deux morceaux de séance
 *   fusionnés, par exemple -- ne fait qu'un.
 * - Un exercice fait en EMOM le reste, au même rythme -- lancé depuis un
 *   entraînement ou en séance libre.
 */
export async function plannedExercisesOf(sessionId: string): Promise<PlannedExercise[]> {
  const session = await findById(sessionId);
  if (!session) {
    throw new DomainError("Cette séance n'existe plus.");
  }

  const [performances, exercises, workouts] = await Promise.all([
    findByIds(
      session.activities
        .map((activity) => activity.performanceId)
        .filter((id): id is string => id !== null),
    ),
    findAllExercises(),
    findAllWorkouts(),
  ]);
  const plan = workouts.find((workout) => workout.id === session.plannedWorkoutId);

  const planned: PlannedExercise[] = [];
  for (const activity of session.activities) {
    const performance = activity.performanceId ? performances.get(activity.performanceId) : undefined;
    const exercise = exercises.find((candidate) => candidate.id === activity.exerciseId);
    if (!performance || !exercise) continue;

    // Les mesures d'AUJOURD'HUI : l'exercice a pu en changer depuis, et un
    // entraînement ne peut viser que ce que l'exercice mesure.
    const sets = performance.sets
      .filter((set) => set.status === 'COMPLETED')
      .map((set) => ({ targets: targetsOf(weakestValues(set.values), exercise.measurementIds) }))
      .filter((set) => Object.keys(set.targets).length > 0);
    if (sets.length === 0) continue;

    // Celui que la séance a retenu, sinon celui du plan -- les séances
    // d'avant la migration 30 ne retenaient rien.
    const intervalSeconds =
      activity.intervalSeconds ??
      (activity.plannedPosition !== null
        ? (plan?.exercises[activity.plannedPosition]?.intervalSeconds ?? null)
        : null);

    const previous = planned[planned.length - 1];
    if (
      previous &&
      previous.exerciseId === activity.exerciseId &&
      (previous.intervalSeconds ?? null) === intervalSeconds
    ) {
      planned[planned.length - 1] = { ...previous, sets: [...previous.sets, ...sets] };
    } else {
      planned.push({ exerciseId: activity.exerciseId, sets, intervalSeconds });
    }
  }

  return planned;
}

function targetsOf(values: TargetValues, measurementIds: readonly string[]): TargetValues {
  const targets: Record<string, number> = {};
  for (const id of measurementIds) {
    const value = values[id];
    if (value !== undefined && Number.isFinite(value) && value >= 0) targets[id] = value;
  }
  return targets;
}

/** Créer l'entraînement, sous le nom choisi. */
export async function createWorkoutFromSession(input: {
  sessionId: string;
  name: string;
}): Promise<PlannedWorkout> {
  const exercises = await plannedExercisesOf(input.sessionId);
  if (exercises.length === 0) {
    throw new DomainError("Aucune série n'a été faite dans cette séance : rien à reprendre.");
  }
  return createPlannedWorkout({ name: input.name, exercises });
}
