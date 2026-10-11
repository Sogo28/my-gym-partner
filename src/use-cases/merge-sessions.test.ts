import { describe, expect, it } from 'vitest';
import { anExercise, useCleanDatabase } from '../../test/support';
import { findById as findPerformance } from '../infra/performance-repository';
import { findAll, findById } from '../infra/workout-session-repository';
import { findMergeCandidates, mergeSessions } from './merge-sessions';
import { moveSession } from './move-session';
import {
  completePerformanceSet,
  finishWorkoutSession,
  startActivity,
  startPerformanceSet,
  startWorkoutSession,
} from './workout-session-actions';

useCleanDatabase();

async function aSession(exerciseId: string, duration: number) {
  const session = await startWorkoutSession();
  await startActivity(exerciseId);
  await startPerformanceSet();
  await completePerformanceSet({ BOTH: { duration } });
  await finishWorkoutSession();
  return session.id;
}

describe('Fusionner des séances', () => {
  it('ne propose que les autres séances terminées du même jour', async () => {
    const exercise = await anExercise();
    const first = await aSession(exercise.id, 10);
    const second = await aSession(exercise.id, 12);
    const yesterday = await aSession(exercise.id, 14);
    const day = (await findById(yesterday))!.startedAt;
    await moveSession(yesterday, new Date(day.getTime() - 86_400_000));

    const candidates = await findMergeCandidates(first);

    expect(candidates.map((session) => session.id)).toEqual([second]);
  });

  it('garde la première, avec les séries de la seconde', async () => {
    const pullUp = await anExercise('Pull-up');
    const dips = await anExercise('Dips');
    const first = await aSession(pullUp.id, 10);
    const second = await aSession(dips.id, 12);
    // Une minute plus tard : deux séances d'un test naissent dans la même
    // milliseconde, et l'ordre ne se lirait plus.
    const end = (await findById(first))!.endedAt!;
    await moveSession(second, new Date(end.getTime() + 60_000));

    // Depuis la seconde : c'est quand même la première qui reste.
    const kept = await mergeSessions(second, first);

    expect(kept).toBe(first);
    expect((await findAll()).map((session) => session.id)).toEqual([first]);
    const merged = (await findById(first))!;
    expect(merged.activities.map((activity) => activity.exerciseId)).toEqual([pullUp.id, dips.id]);
    // Les séries ont suivi, intactes.
    const performance = await findPerformance(merged.activities[1].performanceId!);
    expect(performance?.sets[0].values).toEqual({ BOTH: { duration: 12 } });
  });

  it('refuse deux séances de jours différents', async () => {
    const exercise = await anExercise();
    const first = await aSession(exercise.id, 10);
    const other = await aSession(exercise.id, 12);
    const at = (await findById(other))!.startedAt;
    await moveSession(other, new Date(at.getTime() + 86_400_000));

    await expect(mergeSessions(first, other)).rejects.toThrow(/même jour/);
  });
});
