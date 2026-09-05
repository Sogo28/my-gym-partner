import { describe, expect, it } from 'vitest';
import { WorkoutSession } from './workout-session';

const t = (minutes: number) => new Date(2026, 8, 5, 18, minutes);
const startSession = () => WorkoutSession.start({ id: 'ws-1', at: t(0) });

describe('WorkoutSession', () => {
  it('démarre ACTIVE, avec ou sans entraînement planifié', () => {
    expect(startSession().status).toBe('ACTIVE');
    expect(startSession().plannedWorkoutId).toBeNull();

    const fromPlan = WorkoutSession.start({ id: 'ws-2', plannedWorkoutId: 'pw-1', at: t(0) });
    expect(fromPlan.plannedWorkoutId).toBe('pw-1');
  });

  it('passe de ACTIVE à COMPLETED en retenant l heure de fin', () => {
    const session = startSession();

    session.finish(t(45));

    expect(session.status).toBe('COMPLETED');
    expect(session.endedAt).toEqual(t(45));
  });

  it('conserve les activités déjà enregistrées quand la séance est annulée', () => {
    const session = startSession();
    session.startActivity('pull-up', 'perf-pull-up', t(2));
    session.finishCurrentActivity(t(15));

    session.cancel(t(20));

    expect(session.status).toBe('CANCELLED');
    expect(session.activities).toHaveLength(1);
    expect(session.activities[0].exerciseId).toBe('pull-up');
  });

  it('refuse toute transition depuis un état terminal', () => {
    const completed = startSession();
    completed.finish(t(45));

    expect(() => completed.finish(t(50))).toThrow(/déjà terminée/);
    expect(() => completed.cancel(t(50))).toThrow(/déjà terminée/);
    expect(() => completed.startActivity('dip', 'perf-dip', t(50))).toThrow(/déjà terminée/);

    const cancelled = startSession();
    cancelled.cancel(t(10));
    expect(() => cancelled.finish(t(20))).toThrow(/annulée/);
  });

  it('interdit deux exercices en cours en même temps', () => {
    const session = startSession();
    session.startActivity('pull-up', 'perf-pull-up', t(2));

    expect(() => session.startActivity('row', 'perf-row', t(5))).toThrow(/en cours/);
  });

  it('enchaîne un exercice après l autre : finir puis démarrer', () => {
    const session = startSession();
    session.startActivity('pull-up', 'perf-pull-up', t(2));
    session.finishCurrentActivity(t(15));
    session.startActivity('row', 'perf-row', t(16));

    expect(session.activities.map((a) => a.exerciseId)).toEqual(['pull-up', 'row']);
    expect(session.currentActivity?.exerciseId).toBe('row');
  });

  it('accepte un exercice qui n était pas prévu au plan', () => {
    const session = WorkoutSession.start({ id: 'ws-3', plannedWorkoutId: 'pw-1', at: t(0) });

    expect(() => session.startActivity('exercice-improvisé', 'perf-exercice-improvisé', t(5))).not.toThrow();
  });

  it('clôt l exercice en cours quand la séance se termine', () => {
    const session = startSession();
    session.startActivity('pull-up', 'perf-pull-up', t(2));

    session.finish(t(30));

    expect(session.currentActivity).toBeNull();
    expect(session.activities[0].finishedAt).toEqual(t(30));
  });

  it('démarre et arrête un repos', () => {
    const session = startSession();

    session.startRest(t(10));
    expect(session.currentRest?.startedAt).toEqual(t(10));

    session.stopRest(t(12));
    expect(session.currentRest).toBeNull();
    expect(session.rests[0].endedAt).toEqual(t(12));
  });

  it('interdit deux repos en cours en même temps', () => {
    const session = startSession();
    session.startRest(t(10));

    expect(() => session.startRest(t(11))).toThrow(/déjà en cours/);
  });

  it('refuse d arrêter un repos quand aucun n est en cours', () => {
    expect(() => startSession().stopRest(t(10))).toThrow(/Aucun repos/);
  });

  it('enchaîne plusieurs repos successifs', () => {
    const session = startSession();
    session.startRest(t(10));
    session.stopRest(t(12));
    session.startRest(t(20));
    session.stopRest(t(22));

    expect(session.rests).toHaveLength(2);
  });

  it('clôt le repos en cours quand la séance se termine', () => {
    const session = startSession();
    session.startRest(t(10));

    session.finish(t(30));

    expect(session.currentRest).toBeNull();
    expect(session.rests[0].endedAt).toEqual(t(30));
  });

  it('refuse de terminer un exercice quand aucun n est en cours', () => {
    const session = startSession();

    expect(() => session.finishCurrentActivity(t(5))).toThrow(/Aucun exercice/);
  });
});
