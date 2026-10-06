import { afterEach, describe, expect, it, vi } from 'vitest';
import { anExercise, aWorkoutOf, useCleanDatabase } from '../../test/support';
import {
  cancelWorkoutSession,
  completePerformanceSet,
  finishWorkoutSession,
  startActivity,
  startPerformanceSet,
  startWorkoutSession,
} from '../use-cases/workout-session-actions';
import { findLastDoneByPlan } from './session-history';

useCleanDatabase();

/**
 * La dernière fois qu'un entraînement a été fait.
 *
 * L'horloge est figée d'une séance à l'autre : deux séances lancées dans la
 * même milliseconde ne diraient pas laquelle est la dernière.
 */
describe('Dernière séance par entraînement', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function on(day: number) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, day, 18, 0));
    return new Date(2026, 8, day, 18, 0);
  }

  async function aPlannedSessionOn(day: number, planId: string) {
    on(day);
    await startWorkoutSession(planId);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 10 } });
    await finishWorkoutSession();
  }

  it('retient la plus récente des séances faites', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 1);
    await aPlannedSessionOn(1, plan.id);
    await aPlannedSessionOn(4, plan.id);

    expect((await findLastDoneByPlan()).get(plan.id)).toEqual(new Date(2026, 8, 4, 18, 0));
  });

  it('ignore une séance annulée sans aucune série validée', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 1);
    on(2);
    await startWorkoutSession(plan.id);
    await cancelWorkoutSession();

    expect((await findLastDoneByPlan()).has(plan.id)).toBe(false);
  });

  it('ne range pas une séance libre sous un entraînement', async () => {
    const exercise = await anExercise();
    on(3);
    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 10 } });
    await finishWorkoutSession();

    expect((await findLastDoneByPlan()).size).toBe(0);
  });
});
