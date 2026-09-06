import { describe, expect, it } from 'vitest';
import { anExercise, aWorkoutOf, useCleanDatabase } from '../../test/support';
import { listSessionSummaries } from './session-summary';
import {
  abandonPerformanceSet,
  cancelWorkoutSession,
  completePerformanceSet,
  finishWorkoutSession,
  startActivity,
  startPerformanceSet,
  startWorkoutSession,
} from './workout-session-actions';

useCleanDatabase();

describe('Résumé de séance', () => {
  it('donne à chaque série validée son rang réel, abandons compris', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);

    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 10 } });
    await startPerformanceSet();
    await abandonPerformanceSet();
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 9 } });
    await finishWorkoutSession();

    const [summary] = await listSessionSummaries();
    const sets = summary.activities[0].completedSets;

    // Deux séries affichées, mais la seconde est la TROISIÈME de la
    // performance : corriger d'après son rang d'affichage viserait l'abandon.
    expect(sets).toHaveLength(2);
    expect(sets.map((entry) => entry.index)).toEqual([0, 2]);
  });

  it('compte les séries validées, jamais les abandonnées', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 3);
    await startWorkoutSession(plan.id);

    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 12 } });
    // Les deux séries prévues restantes seront consignées abandonnées.
    await finishWorkoutSession();

    const [summary] = await listSessionSummaries();

    expect(summary.completedSetCount).toBe(1);
    expect(summary.activities[0].completedSets).toHaveLength(1);
  });

  it('donne une durée une fois la séance terminée', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);
    await finishWorkoutSession();

    const [summary] = await listSessionSummaries();

    expect(summary.duration).not.toBeNull();
    expect(summary.duration).toBeGreaterThanOrEqual(0);
  });

  it('laisse la durée nulle tant que la séance est ouverte', async () => {
    await startWorkoutSession();

    const [summary] = await listSessionSummaries();

    expect(summary.duration).toBeNull();
  });

  it('cumule le temps de repos de la séance', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);

    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 10 } }); // démarre un repos
    await startPerformanceSet(); // l'interrompt
    await completePerformanceSet({ BOTH: { duration: 9 } });
    await finishWorkoutSession();

    const [summary] = await listSessionSummaries();

    // Deux repos : celui entre les séries, et celui clos par la fin de séance.
    expect(summary.session.rests).toHaveLength(2);
    expect(summary.restTotal).toBeGreaterThanOrEqual(0);
  });

  it('conserve le résumé d une séance annulée', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 14 } });

    await cancelWorkoutSession();

    const [summary] = await listSessionSummaries();

    // Annuler ne détruit pas ce qui a été validé (n°15).
    expect(summary.session.status).toBe('CANCELLED');
    expect(summary.completedSetCount).toBe(1);
  });

  it('rend les séances de la plus récente à la plus ancienne', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);
    await finishWorkoutSession();
    await startWorkoutSession();
    await finishWorkoutSession();

    const summaries = await listSessionSummaries();

    expect(summaries).toHaveLength(2);
    expect(summaries[0].session.startedAt.getTime()).toBeGreaterThanOrEqual(
      summaries[1].session.startedAt.getTime(),
    );
  });
});
