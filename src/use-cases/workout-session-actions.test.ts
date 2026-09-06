import { describe, expect, it } from 'vitest';
import { anExercise, aWorkoutOf, useCleanDatabase } from '../../test/support';
import { findById as findPerformanceById } from '../infra/performance-repository';
import { findAll as findAllSessions, findActive } from '../infra/workout-session-repository';
import { findAll as findAllSchedule } from '../infra/scheduled-workout-repository';
import { createPlannedWorkout } from './create-planned-workout';
import { scheduleWorkout } from './scheduling-actions';
import {
  cancelWorkoutSession,
  completePerformanceSet,
  finishActivity,
  finishWorkoutSession,
  goToNextExercise,
  startActivity,
  startPerformanceSet,
  startWorkoutSession,
} from './workout-session-actions';

/**
 * Les règles qui vivent dans l'orchestration : elles parlent de plusieurs
 * agrégats ou de plusieurs instances d'un même agrégat, donc aucune ne peut
 * être vérifiée à l'intérieur du domaine.
 */
useCleanDatabase();

/** Les séries de l'exercice en cours, telles qu'elles sont en base. */
async function currentSets() {
  const session = await findActive();
  const performance = await findPerformanceById(session!.currentActivity!.performanceId!);
  return performance!.sets;
}

describe('StartWorkoutSession', () => {
  it('refuse une seconde séance tant que la première est ouverte', async () => {
    await startWorkoutSession();

    await expect(startWorkoutSession()).rejects.toThrow(/déjà en cours/);
  });

  it('accepte une nouvelle séance une fois la précédente terminée', async () => {
    await startWorkoutSession();
    await finishWorkoutSession();

    await expect(startWorkoutSession()).resolves.toBeDefined();
    expect(await findAllSessions()).toHaveLength(2);
  });

  it('démarre sur le premier exercice du plan, sans le choisir', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 3);

    const session = await startWorkoutSession(plan.id);

    expect(session.currentActivity?.exerciseId).toBe(exercise.id);
    expect(session.currentActivity?.plannedPosition).toBe(0);
  });
});

describe('StartActivity', () => {
  it('crée la performance AVANT de la référencer dans la séance', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();

    const session = await startActivity(exercise.id);

    // L'inverse laisserait la séance pointer vers une performance absente.
    const performance = await findPerformanceById(session.currentActivity!.performanceId!);
    expect(performance).not.toBeNull();
  });

  it('fige les mesures de l exercice dans la performance', async () => {
    const exercise = await anExercise('Front Lever', ['duration']);
    await startWorkoutSession();

    const session = await startActivity(exercise.id);
    const performance = await findPerformanceById(session.currentActivity!.performanceId!);

    expect(performance!.measurementIds).toEqual(['duration']);
  });
});

describe('Séries prévues non faites', () => {
  it('les consigne comme abandonnées quand on passe à l exercice suivant', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 4);
    await startWorkoutSession(plan.id);

    await startPerformanceSet();
    await completePerformanceSet({ duration: 12 });

    const performanceId = (await findActive())!.currentActivity!.performanceId!;
    await goToNextExercise();

    const performance = await findPerformanceById(performanceId);
    expect(performance!.sets.map((set) => set.status)).toEqual([
      'COMPLETED',
      'ABANDONED',
      'ABANDONED',
      'ABANDONED',
    ]);
  });

  it('les consigne aussi quand la séance se termine', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 4);
    await startWorkoutSession(plan.id);

    await startPerformanceSet();
    await completePerformanceSet({ duration: 12 });

    const performanceId = (await findActive())!.currentActivity!.performanceId!;
    await finishWorkoutSession();

    // Le geste physique est le même que ci-dessus : l'historique doit l'être.
    const performance = await findPerformanceById(performanceId);
    expect(performance!.sets.filter((set) => set.status === 'ABANDONED')).toHaveLength(3);
  });

  it('les consigne aussi quand la séance est annulée', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 3);
    await startWorkoutSession(plan.id);

    await startPerformanceSet();
    await completePerformanceSet({ duration: 12 });

    const performanceId = (await findActive())!.currentActivity!.performanceId!;
    await cancelWorkoutSession();

    const performance = await findPerformanceById(performanceId);
    expect(performance!.completedSets).toHaveLength(1);
    expect(performance!.sets).toHaveLength(3);
  });
});

describe('Passer à l exercice suivant', () => {
  it('enchaîne sur l exercice suivant du plan', async () => {
    const first = await anExercise('Advanced Tuck');
    const second = await anExercise('Pull-ups', ['reps']);
    const plan = await createPlannedWorkout({
      name: 'Pull day',
      exercises: [
        { exerciseId: first.id, sets: [{ targets: { duration: 10 } }] },
        { exerciseId: second.id, sets: [{ targets: { reps: 8 } }] },
      ],
    });
    await startWorkoutSession(plan.id);

    const session = await goToNextExercise();

    expect(session.currentActivity?.exerciseId).toBe(second.id);
    expect(session.currentActivity?.plannedPosition).toBe(1);
  });

  it('ne démarre rien depuis un exercice ajouté hors programme', async () => {
    const planned = await anExercise('Advanced Tuck');
    const free = await anExercise('Dips', ['reps']);
    const plan = await aWorkoutOf(planned.id, 2);
    await startWorkoutSession(plan.id);

    // On quitte le plan pour un exercice libre, sans position planifiée.
    await finishActivity();
    await startActivity(free.id);
    const session = await goToNextExercise();

    // Sans position dans le plan, il n'y a pas de "suivant" à enchaîner.
    expect(session.currentActivity).toBeNull();
  });

  it('ne démarre rien quand aucun exercice n est en cours', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 2);
    await startWorkoutSession(plan.id);
    await finishActivity();

    const session = await goToNextExercise();

    // Le calcul de position ne doit pas retomber sur le premier exercice.
    expect(session.currentActivity).toBeNull();
  });
});

describe('Annulation d une séance', () => {
  it('conserve les séries déjà validées', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);

    await startPerformanceSet();
    await completePerformanceSet({ duration: 14 });
    const performanceId = (await findActive())!.currentActivity!.performanceId!;

    await cancelWorkoutSession();

    const performance = await findPerformanceById(performanceId);
    expect(performance!.completedSets[0].values).toEqual({ duration: 14 });
  });
});

describe('Repos', () => {
  it('démarre à la validation d une série et s arrête à la suivante', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);

    await startPerformanceSet();
    await completePerformanceSet({ duration: 10 });
    expect((await findActive())!.currentRest).not.toBeNull();

    await startPerformanceSet();
    expect((await findActive())!.currentRest).toBeNull();
  });

  it('garde la trace du repos écoulé', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);

    await startPerformanceSet();
    await completePerformanceSet({ duration: 10 });
    await startPerformanceSet();

    const session = await findActive();
    expect(session!.rests).toHaveLength(1);
    expect(session!.rests[0].endedAt).not.toBeNull();
  });
});

describe('Entraînement programmé', () => {
  it('passe à EXECUTED quand la séance se termine', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 1);
    const schedule = await scheduleWorkout({ plannedWorkoutId: plan.id, at: new Date() });

    await startWorkoutSession(plan.id, schedule.id);
    expect((await findAllSchedule())[0].status).toBe('SCHEDULED');

    await finishWorkoutSession();

    expect((await findAllSchedule())[0].status).toBe('EXECUTED');
  });

  it('reste SCHEDULED quand la séance est annulée : la journée reste rattrapable', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 1);
    const schedule = await scheduleWorkout({ plannedWorkoutId: plan.id, at: new Date() });

    await startWorkoutSession(plan.id, schedule.id);
    await cancelWorkoutSession();

    expect((await findAllSchedule())[0].status).toBe('SCHEDULED');
  });
});

describe('Correction pendant la séance', () => {
  it('n altère pas les séries voisines', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);

    await startPerformanceSet();
    await completePerformanceSet({ duration: 10 });
    await startPerformanceSet();
    await completePerformanceSet({ duration: 8 });

    const sets = await currentSets();
    expect(sets.map((set) => set.values.duration)).toEqual([10, 8]);
  });
});
