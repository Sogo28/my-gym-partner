import { describe, expect, it } from 'vitest';
import type { PerformanceSet } from '../performance/exercise-performance';
import { restBeforeEachSet, sessionDuration, totalRest } from './session-metrics';
import { WorkoutSession } from './workout-session';

const t = (minutes: number, secs = 0) => new Date(2026, 8, 5, 18, minutes, secs);

const set = (startedAt: Date, endedAt: Date): PerformanceSet => ({
  status: 'COMPLETED',
  values: { BOTH: { reps: 8 } },
  startedAt,
  endedAt,
});

describe('métriques de séance', () => {
  it('ne donne pas de durée tant que la séance n est pas terminée', () => {
    expect(sessionDuration(WorkoutSession.start({ id: 'ws', at: t(0) }))).toBeNull();
  });

  it('calcule la durée entre le début et la fin', () => {
    const session = WorkoutSession.start({ id: 'ws', at: t(0) });
    session.finish(t(45));

    expect(sessionDuration(session)).toBe(45 * 60);
  });

  it('additionne les repos terminés et ignore celui en cours', () => {
    const session = WorkoutSession.start({ id: 'ws', at: t(0) });
    session.startRest(t(10));
    session.stopRest(t(12));
    session.startRest(t(20)); // toujours en cours

    expect(totalRest(session)).toBe(120);
  });

  it('rattache à chaque série le repos qui la précède', () => {
    const sets = [set(t(5), t(6)), set(t(9), t(10))];
    const rests = [{ startedAt: t(6), endedAt: t(9) }];

    expect(restBeforeEachSet(sets, rests)).toEqual([null, 180]);
  });

  it('additionne plusieurs repos pris entre deux séries', () => {
    const sets = [set(t(5), t(6)), set(t(12), t(13))];
    const rests = [
      { startedAt: t(6), endedAt: t(8) },
      { startedAt: t(9), endedAt: t(11) },
    ];

    expect(restBeforeEachSet(sets, rests)).toEqual([null, 240]);
  });

  it('ignore un repos pris en dehors de l intervalle entre les deux séries', () => {
    const sets = [set(t(5), t(6)), set(t(9), t(10))];
    const rests = [{ startedAt: t(20), endedAt: t(22) }];

    expect(restBeforeEachSet(sets, rests)).toEqual([null, 0]);
  });
});
