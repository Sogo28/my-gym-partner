import { describe, expect, it } from 'vitest';
import { anExercise, useCleanDatabase } from '../../test/support';
import { removePastSet } from './correct-past-set';
import { listSessionSummaries } from './session-summary';
import {
  completePerformanceSet,
  finishWorkoutSession,
  startActivity,
  startPerformanceSet,
  startWorkoutSession,
} from './workout-session-actions';

useCleanDatabase();

describe('Retirer une série d une séance passée', () => {
  async function aSessionWithTwoSets(exerciseId: string) {
    await startWorkoutSession();
    await startActivity(exerciseId);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 8 } });
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 6 } });
    await finishWorkoutSession();
  }

  it('enlève la série visée, et garde les autres', async () => {
    const exercise = await anExercise();
    await aSessionWithTwoSets(exercise.id);
    const [before] = await listSessionSummaries();
    const performanceId = before.activities[0].performanceId!;

    await removePastSet({ performanceId, setIndex: 0 });

    const [after] = await listSessionSummaries();
    expect(after.activities[0].completedSets).toHaveLength(1);
    expect(after.activities[0].completedSets[0].set.values).toEqual({ BOTH: { duration: 6 } });
  });

  it('refuse une performance introuvable', async () => {
    await expect(removePastSet({ performanceId: 'inconnue', setIndex: 0 })).rejects.toThrow(
      /introuvable/,
    );
  });
});

describe('Refaire une série abandonnée', () => {
  it('efface l abandon : la série repart au même rang, et compte une fois faite', async () => {
    const exercise = await anExercise();
    const { abandonPerformanceSet } = await import('./workout-session-actions');
    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 10 } });
    await startPerformanceSet();
    const abandoned = await abandonPerformanceSet();

    await removePastSet({ performanceId: abandoned.id, setIndex: 1 });
    const redone = await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 12 } });

    expect(redone.sets).toHaveLength(2);
    const [summary] = await listSessionSummaries();
    expect(summary.completedSetCount).toBe(2);
  });
});
