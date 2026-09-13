import { describe, expect, it } from 'vitest';
import { anExercise, useCleanDatabase } from '../../test/support';
import { findById } from '../infra/workout-session-repository';
import { findSessionsWorking } from '../infra/exercise-history';
import { moveSession } from './move-session';
import { listSessionSummaries } from './session-summary';
import {
  completePerformanceSet,
  finishWorkoutSession,
  startActivity,
  startPerformanceSet,
  startWorkoutSession,
} from './workout-session-actions';

useCleanDatabase();

/**
 * Déplacer une séance : elle est un BLOC de temps, pas une date.
 */
describe('Déplacer une séance', () => {
  async function aSession(exerciseId: string) {
    const session = await startWorkoutSession();
    await startActivity(exerciseId);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 12 } });
    await finishWorkoutSession();
    return session.id;
  }

  it('emmène avec elle ce qu elle a produit', async () => {
    const exercise = await anExercise();
    const id = await aSession(exercise.id);
    const hier = new Date();
    hier.setDate(hier.getDate() - 1);

    await moveSession(id, hier);

    // La fiche d'un exercice lit la date de la séance ; les records et le
    // graphe lisent celles des séries. Les deux doivent dire le même jour.
    expect((await findSessionsWorking(exercise.id))[0].startedAt.toDateString()).toBe(
      hier.toDateString(),
    );
    const [summary] = await listSessionSummaries();
    expect(summary.activities[0].completedSets[0].set.startedAt.toDateString()).toBe(
      hier.toDateString(),
    );
  });

  it('garde les durées intactes', async () => {
    const exercise = await anExercise();
    const id = await aSession(exercise.id);
    const [before] = await listSessionSummaries();

    const ailleurs = new Date(2026, 0, 15, 9, 30);
    await moveSession(id, ailleurs);

    // Tout bouge du même écart : une séance déplacée dure ce qu'elle durait.
    expect((await listSessionSummaries())[0].duration).toBe(before.duration);
  });

  it('pose la séance à l heure demandée', async () => {
    const exercise = await anExercise();
    const id = await aSession(exercise.id);
    const ailleurs = new Date(2026, 0, 15, 9, 30);

    await moveSession(id, ailleurs);

    expect((await findById(id))?.startedAt.getTime()).toBe(ailleurs.getTime());
  });

  it('refuse une séance en cours', async () => {
    const exercise = await anExercise();
    const session = await startWorkoutSession();
    await startActivity(exercise.id);

    await expect(moveSession(session.id, new Date())).rejects.toThrow(/en cours/);
  });
});
