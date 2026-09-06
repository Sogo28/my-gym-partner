import { describe, expect, it } from 'vitest';
import { ScheduledWorkout } from './scheduled-workout';

const day = (d: number, hour = 18) => new Date(2026, 8, d, hour, 0);

const scheduled = () =>
  ScheduledWorkout.schedule({ id: 'sw-1', plannedWorkoutId: 'pw-1', at: day(10) });

describe('ScheduledWorkout', () => {
  it('naît SCHEDULED à la date voulue', () => {
    const schedule = scheduled();

    expect(schedule.status).toBe('SCHEDULED');
    expect(schedule.scheduledAt).toEqual(day(10));
  });

  it('reste SCHEDULED une fois la date passée : il n existe pas d état MISSED', () => {
    const schedule = scheduled();

    expect(schedule.isOverdue(day(12))).toBe(true);
    expect(schedule.status).toBe('SCHEDULED');
  });

  it('se déplace tant qu il n a pas été exécuté', () => {
    const schedule = scheduled();

    schedule.reschedule(day(11));

    expect(schedule.scheduledAt).toEqual(day(11));
  });

  it('passe à EXECUTED, puis n accepte plus rien', () => {
    const schedule = scheduled();

    schedule.markExecuted();

    expect(schedule.status).toBe('EXECUTED');
    expect(() => schedule.reschedule(day(11))).toThrow(/déjà été exécuté/);
    expect(() => schedule.cancel()).toThrow(/déjà été exécuté/);
    expect(() => schedule.markExecuted()).toThrow(/déjà été exécuté/);
  });

  it('s annule, et n est alors plus déplaçable', () => {
    const schedule = scheduled();

    schedule.cancel();

    expect(schedule.status).toBe('CANCELLED');
    expect(() => schedule.reschedule(day(11))).toThrow(/annulé/);
    expect(() => schedule.markExecuted()).toThrow(/annulé/);
  });

  it('n est pas en retard quand il est annulé ou déjà exécuté', () => {
    const cancelled = scheduled();
    cancelled.cancel();
    const executed = scheduled();
    executed.markExecuted();

    expect(cancelled.isOverdue(day(12))).toBe(false);
    expect(executed.isOverdue(day(12))).toBe(false);
  });
});
