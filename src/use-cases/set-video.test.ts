import { describe, expect, it } from 'vitest';
import { anExercise, useCleanDatabase } from '../../test/support';
import { findById } from '../infra/performance-repository';
import { findActive } from '../infra/workout-session-repository';
import { attachSetVideo, detachSetVideo } from './set-video';
import {
  completePerformanceSet,
  startActivity,
  startPerformanceSet,
  startWorkoutSession,
} from './workout-session-actions';

useCleanDatabase();

/**
 * La captation d'une série : elle appartient au fait daté, pas à l'exercice.
 */
describe('La vidéo d une série', () => {
  async function aSetInProgress() {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    const session = await findActive();
    return session!.currentActivity!.performanceId!;
  }

  it('survit à la relecture depuis la base', async () => {
    const performanceId = await aSetInProgress();

    await attachSetVideo(performanceId, 0, 'abc.mp4');

    expect((await findById(performanceId))!.sets[0].videoUri).toBe('abc.mp4');
  });

  it('reste attachée quand la série se termine', async () => {
    const performanceId = await aSetInProgress();
    await attachSetVideo(performanceId, 0, 'abc.mp4');

    // On filme PENDANT : la vidéo ne doit pas se perdre à la validation.
    await completePerformanceSet({ BOTH: { duration: 12 } });

    expect((await findById(performanceId))!.sets[0].videoUri).toBe('abc.mp4');
  });

  it('se retire sans toucher à ce qui a été mesuré', async () => {
    const performanceId = await aSetInProgress();
    await attachSetVideo(performanceId, 0, 'abc.mp4');
    await completePerformanceSet({ BOTH: { duration: 12 } });

    await detachSetVideo(performanceId, 0);

    const set = (await findById(performanceId))!.sets[0];
    expect(set.videoUri).toBeNull();
    expect(set.values).toEqual({ BOTH: { duration: 12 } });
    expect(set.status).toBe('COMPLETED');
  });

  it('refuse une série qui n existe pas', async () => {
    const performanceId = await aSetInProgress();

    await expect(attachSetVideo(performanceId, 7, 'abc.mp4')).rejects.toThrow(/n'existe pas/);
  });
});
