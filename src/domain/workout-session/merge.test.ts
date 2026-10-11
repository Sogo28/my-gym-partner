import { describe, expect, it } from 'vitest';
import { mergeSessions } from './merge';
import { WorkoutSession } from './workout-session';

const t = (minutes: number) => new Date(2026, 9, 10, 18, minutes);

function aSession(input: {
  id: string;
  from: number;
  to: number;
  exerciseId: string;
  plannedWorkoutId?: string | null;
  plannedPosition?: number | null;
  rest?: [number, number];
}) {
  return WorkoutSession.restore({
    id: input.id,
    plannedWorkoutId: input.plannedWorkoutId ?? null,
    startedAt: t(input.from),
    status: 'COMPLETED',
    endedAt: t(input.to),
    activities: [
      {
        exerciseId: input.exerciseId,
        performanceId: `perf-${input.id}`,
        plannedPosition: input.plannedPosition ?? null,
        startedAt: t(input.from),
        finishedAt: t(input.to),
      },
    ],
    rests: input.rest ? [{ startedAt: t(input.rest[0]), endedAt: t(input.rest[1]) }] : [],
  });
}

describe('Fusionner deux séances', () => {
  it('met bout à bout leurs activités, dans l ordre où elles ont eu lieu', () => {
    const early = aSession({ id: 'a', from: 0, to: 20, exerciseId: 'pull-up' });
    const late = aSession({ id: 'b', from: 24, to: 40, exerciseId: 'dips' });

    // Peu importe laquelle on ouvre : la première absorbe la seconde.
    const merged = mergeSessions(late, early);

    expect(merged.id).toBe('a');
    expect(merged.startedAt).toEqual(t(0));
    expect(merged.endedAt).toEqual(t(40));
    expect(merged.activities.map((activity) => activity.exerciseId)).toEqual(['pull-up', 'dips']);
    expect(merged.activities.map((activity) => activity.performanceId)).toEqual(['perf-a', 'perf-b']);
  });

  it('fait de l écart entre les deux un repos', () => {
    const merged = mergeSessions(
      aSession({ id: 'a', from: 0, to: 20, exerciseId: 'pull-up', rest: [10, 12] }),
      aSession({ id: 'b', from: 24, to: 40, exerciseId: 'dips', rest: [30, 31] }),
    );

    expect(merged.rests).toEqual([
      { startedAt: t(10), endedAt: t(12) },
      { startedAt: t(20), endedAt: t(24) },
      { startedAt: t(30), endedAt: t(31) },
    ]);
  });

  it('garde le programme de la première, et détache les activités de l autre', () => {
    const merged = mergeSessions(
      aSession({ id: 'a', from: 0, to: 20, exerciseId: 'pull-up', plannedWorkoutId: 'pw-1', plannedPosition: 0 }),
      aSession({ id: 'b', from: 24, to: 40, exerciseId: 'dips', plannedWorkoutId: 'pw-2', plannedPosition: 0 }),
    );

    expect(merged.plannedWorkoutId).toBe('pw-1');
    expect(merged.activities.map((activity) => activity.plannedPosition)).toEqual([0, null]);
  });

  it('reprend le programme de la seconde quand la première est libre', () => {
    const merged = mergeSessions(
      aSession({ id: 'a', from: 0, to: 20, exerciseId: 'pull-up' }),
      aSession({ id: 'b', from: 24, to: 40, exerciseId: 'dips', plannedWorkoutId: 'pw-2', plannedPosition: 1 }),
    );

    expect(merged.plannedWorkoutId).toBe('pw-2');
    expect(merged.activities.map((activity) => activity.plannedPosition)).toEqual([null, 1]);
  });

  it('refuse deux séances qui se chevauchent', () => {
    expect(() =>
      mergeSessions(
        aSession({ id: 'a', from: 0, to: 30, exerciseId: 'pull-up' }),
        aSession({ id: 'b', from: 20, to: 40, exerciseId: 'dips' }),
      ),
    ).toThrow(/chevauchent/);
  });

  it('refuse une séance avec elle-même, ou une séance en cours', () => {
    const done = aSession({ id: 'a', from: 0, to: 20, exerciseId: 'pull-up' });
    expect(() => mergeSessions(done, done)).toThrow();

    const running = WorkoutSession.start({ id: 'c', at: t(30) });
    expect(() => mergeSessions(done, running)).toThrow(/terminées/);
  });
});
