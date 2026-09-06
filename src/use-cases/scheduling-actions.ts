import { randomUUID } from 'expo-crypto';
import { ScheduledWorkout } from '../domain/scheduling/scheduled-workout';
import type { PlannedWorkoutId } from '../domain/planned-workout/planned-workout';
import { findAll, findById, save } from '../infra/scheduled-workout-repository';

/** ScheduleWorkout (§28) : placer un entraînement à une date. */
export async function scheduleWorkout(input: {
  plannedWorkoutId: PlannedWorkoutId;
  at: Date;
}): Promise<ScheduledWorkout> {
  const schedule = ScheduledWorkout.schedule({ id: randomUUID(), ...input });
  await save(schedule);
  return schedule;
}

export async function rescheduleWorkout(schedule: ScheduledWorkout, at: Date): Promise<void> {
  schedule.reschedule(at);
  await save(schedule);
}

export async function cancelScheduledWorkout(schedule: ScheduledWorkout): Promise<void> {
  schedule.cancel();
  await save(schedule);
}

/**
 * Marque l'intention comme exécutée à la FIN de la séance (décidé le
 * 2026-09-06) : démarrer ne suffit pas, sinon une séance annulée laisserait
 * l'entraînement marqué exécuté sans retour arrière possible.
 *
 * Silencieux si l'intention n'est plus ouverte : terminer une séance ne doit
 * pas échouer parce que son programmé a été annulé entre-temps.
 */
export async function markScheduleExecuted(scheduledWorkoutId: string): Promise<void> {
  const schedule = await findById(scheduledWorkoutId);
  if (!schedule || schedule.status !== 'SCHEDULED') return;

  schedule.markExecuted();
  await save(schedule);
}

export const listSchedule = findAll;
