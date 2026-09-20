import { describe, expect, it } from 'vitest';
import { anExercise, aWorkoutOf, useCleanDatabase } from '../../test/support';
import { findSessionsWorking } from '../infra/exercise-history';
import { findActive } from '../infra/workout-session-repository';
import { logPastSession } from './log-session';
import { moveSession } from './move-session';
import { correctPastSet } from './correct-past-set';
import { findSessionSummary, listSessionSummaries } from './session-summary';
import { startActivity, startWorkoutSession } from './workout-session-actions';

useCleanDatabase();

const HIER = new Date(Date.now() - 86_400_000);

/**
 * Enregistrer une séance qu'on a faite sans le téléphone.
 */
describe('Enregistrer une séance passée', () => {
  it('la range dans l historique, terminée, à sa date', async () => {
    const exercise = await anExercise('Traction', ['reps']);

    await logPastSession({
      at: HIER,
      durationSeconds: 3600,
      exercises: [{ exerciseId: exercise.id, sets: [{ BOTH: { reps: 8 } }] }],
    });

    const [summary] = await listSessionSummaries();
    expect(summary.session.status).toBe('COMPLETED');
    expect(summary.session.startedAt.toDateString()).toBe(HIER.toDateString());
    expect(summary.duration).toBe(3600);
  });

  it('en fait de vraies performances', async () => {
    const exercise = await anExercise('Traction', ['reps', 'weight']);

    await logPastSession({
      at: HIER,
      durationSeconds: 3600,
      exercises: [
        {
          exerciseId: exercise.id,
          sets: [
            { BOTH: { reps: 8, weight: 60 } },
            { BOTH: { reps: 6, weight: 60 } },
          ],
        },
      ],
    });

    // Ce que lit la fiche de l'exercice, donc ses records et son graphe.
    const [worked] = await findSessionsWorking(exercise.id);
    expect(worked.startedAt.toDateString()).toBe(HIER.toDateString());

    const [summary] = await listSessionSummaries();
    expect(summary.completedSetCount).toBe(2);
    expect(summary.activities[0].completedSets.map(({ set }) => set.values)).toEqual([
      { BOTH: { reps: 8, weight: 60 } },
      { BOTH: { reps: 6, weight: 60 } },
    ]);
  });

  it('n invente ni repos ni temps d exécution', async () => {
    const exercise = await anExercise('Traction', ['reps']);

    await logPastSession({
      at: HIER,
      durationSeconds: 3600,
      exercises: [
        { exerciseId: exercise.id, sets: [{ BOTH: { reps: 8 } }, { BOTH: { reps: 6 } }] },
      ],
    });

    const [summary] = await listSessionSummaries();
    expect(summary.restTotal).toBe(0);
    // Une série déclarée n'a pas de fin : rien ne prétend savoir combien de
    // temps elle a pris, ni combien on a soufflé avant la suivante.
    expect(summary.activities[0].completedSets.map(({ set }) => set.endedAt)).toEqual([null, null]);
    expect(summary.activities[0].completedSets.map((done) => done.restBefore)).toEqual([
      null,
      null,
    ]);
  });

  it('garde les exercices dans l ordre déclaré', async () => {
    const traction = await anExercise('Traction', ['reps']);
    const gainage = await anExercise('Gainage', ['duration']);

    await logPastSession({
      at: HIER,
      durationSeconds: 1800,
      exercises: [
        { exerciseId: traction.id, sets: [{ BOTH: { reps: 8 } }] },
        { exerciseId: gainage.id, sets: [{ BOTH: { duration: 60 } }] },
      ],
    });

    const [summary] = await listSessionSummaries();
    expect(summary.activities.map((activity) => activity.exerciseId)).toEqual([
      traction.id,
      gainage.id,
    ]);
  });

  it('retient l entraînement dont elle est partie', async () => {
    const exercise = await anExercise('Traction', ['reps']);
    const plan = await aWorkoutOf(exercise.id, 2, 'reps', 8);

    await logPastSession({
      at: HIER,
      durationSeconds: 1800,
      plannedWorkoutId: plan.id,
      exercises: [{ exerciseId: exercise.id, sets: [{ BOTH: { reps: 8 } }] }],
    });

    const [summary] = await listSessionSummaries();
    expect(summary.session.plannedWorkoutId).toBe(plan.id);
  });

  it('se corrige et se déplace ensuite comme n importe quelle séance', async () => {
    const exercise = await anExercise('Traction', ['reps']);
    const session = await logPastSession({
      at: HIER,
      durationSeconds: 3600,
      exercises: [{ exerciseId: exercise.id, sets: [{ BOTH: { reps: 8 } }] }],
    });

    const avantHier = new Date(Date.now() - 2 * 86_400_000);
    await moveSession(session.id, avantHier);
    const performanceId = (await findSessionSummary(session.id))!.activities[0].performanceId!;
    await correctPastSet({ performanceId, setIndex: 0, values: { BOTH: { reps: 9 } } });

    const corrected = (await findSessionSummary(session.id))!;
    expect(corrected.session.startedAt.toDateString()).toBe(avantHier.toDateString());
    expect(corrected.activities[0].completedSets[0].set.values).toEqual({ BOTH: { reps: 9 } });
  });

  it('ne touche pas à la séance en cours', async () => {
    const exercise = await anExercise('Traction', ['reps']);
    const live = await startWorkoutSession();
    await startActivity(exercise.id);

    // Une séance déjà finie n'entre en concurrence avec rien : elle ne
    // devient jamais la séance en cours.
    await logPastSession({
      at: HIER,
      durationSeconds: 3600,
      exercises: [{ exerciseId: exercise.id, sets: [{ BOTH: { reps: 8 } }] }],
    });

    expect((await findActive())?.id).toBe(live.id);
  });

  it('refuse une séance qui n a pas encore eu lieu', async () => {
    const exercise = await anExercise('Traction', ['reps']);

    await expect(
      logPastSession({
        at: new Date(Date.now() + 3_600_000),
        durationSeconds: 3600,
        exercises: [{ exerciseId: exercise.id, sets: [{ BOTH: { reps: 8 } }] }],
      }),
    ).rejects.toThrow(/futur/);
  });

  it('refuse une séance vide, un exercice sans série, une durée nulle', async () => {
    const exercise = await anExercise('Traction', ['reps']);
    const base = { at: HIER, durationSeconds: 3600 };

    await expect(logPastSession({ ...base, exercises: [] })).rejects.toThrow(/au moins un exercice/);
    await expect(
      logPastSession({ ...base, exercises: [{ exerciseId: exercise.id, sets: [] }] }),
    ).rejects.toThrow(/au moins une série/);
    await expect(
      logPastSession({
        at: HIER,
        durationSeconds: 0,
        exercises: [{ exerciseId: exercise.id, sets: [{ BOTH: { reps: 8 } }] }],
      }),
    ).rejects.toThrow(/dure plus longtemps/);
  });

  it('refuse un exercice inconnu et une mesure étrangère', async () => {
    const exercise = await anExercise('Traction', ['reps']);

    await expect(
      logPastSession({
        at: HIER,
        durationSeconds: 3600,
        exercises: [{ exerciseId: 'fantome', sets: [{ BOTH: { reps: 8 } }] }],
      }),
    ).rejects.toThrow(/n'existe pas/);

    await expect(
      logPastSession({
        at: HIER,
        durationSeconds: 3600,
        exercises: [{ exerciseId: exercise.id, sets: [{ BOTH: { weight: 60 } }] }],
      }),
    ).rejects.toThrow(/ne se mesure pas/);
  });

  it('n écrit rien quand une seule série est refusée', async () => {
    const exercise = await anExercise('Traction', ['reps']);

    await expect(
      logPastSession({
        at: HIER,
        durationSeconds: 3600,
        exercises: [
          { exerciseId: exercise.id, sets: [{ BOTH: { reps: 8 } }, { BOTH: { weight: 60 } }] },
        ],
      }),
    ).rejects.toThrow();

    // Tout est vérifié avant la première écriture : une saisie refusée ne
    // laisse pas la moitié d'une séance derrière elle.
    expect(await listSessionSummaries()).toHaveLength(0);
    expect(await findSessionsWorking(exercise.id)).toHaveLength(0);
  });
});
