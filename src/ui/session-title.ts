import type { PlannedWorkout } from '../domain/planned-workout/planned-workout';
import type { WorkoutSession } from '../domain/workout-session/workout-session';

/**
 * Ce qu'une séance s'appelle : le nom qu'on lui a donné, sinon celui de son
 * entraînement, sinon « Séance libre ». Le même partout où elle se nomme.
 */
export function sessionTitle(
  session: Pick<WorkoutSession, 'name'>,
  plan: Pick<PlannedWorkout, 'name'> | undefined | null,
): string {
  return session.name ?? plan?.name ?? 'Séance libre';
}
