import { describe, expect, it } from 'vitest';
import { anExercise, aWorkoutOf, useCleanDatabase } from '../../test/support';
import { findSessionSummary, listSessionSummaries } from './session-summary';
import {
  abandonPerformanceSet,
  cancelWorkoutSession,
  completePerformanceSet,
  finishActivity,
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

  it('rattache le repos pris en changeant d exercice à la première série du suivant', async () => {
    const first = await anExercise('Advanced Tuck');
    const second = await anExercise('Pull-ups', ['reps']);
    await startWorkoutSession();
    await startActivity(first.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 10 } });
    // Le repos démarré par la série précédente se poursuit ici : changer
    // d'exercice ne l'interrompt pas, seule une nouvelle série le fait.
    await finishActivity();
    await startActivity(second.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { reps: 8 } });
    await finishWorkoutSession();

    const [summary] = await listSessionSummaries();

    // La première série du premier exercice n'a rien avant elle ; celle du
    // second, si -- c'est justement le repos pris en changeant d'exercice.
    expect(summary.activities[0].completedSets[0].restBefore).toBeNull();
    expect(summary.activities[1].completedSets[0].restBefore).not.toBeNull();
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

/**
 * Le résumé d'une seule séance.
 *
 * Ciblé, mais il doit dire EXACTEMENT ce que l'historique dit d'elle : deux
 * chemins de lecture qui divergeraient feraient deux vérités.
 */
describe('Résumé d une séance précise', () => {
  it('dit la même chose que l historique', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 10 } });
    await startPerformanceSet();
    await abandonPerformanceSet();
    await finishWorkoutSession();

    const [fromHistory] = await listSessionSummaries();
    const found = await findSessionSummary(fromHistory.session.id);

    expect(found?.completedSetCount).toBe(fromHistory.completedSetCount);
    expect(found?.duration).toBe(fromHistory.duration);
    expect(found?.activities[0].completedSets.map((entry) => entry.index)).toEqual(
      fromHistory.activities[0].completedSets.map((entry) => entry.index),
    );
  });

  it('ne trouve rien pour une séance qui n existe pas', async () => {
    expect(await findSessionSummary('inconnue')).toBeNull();
  });
});
