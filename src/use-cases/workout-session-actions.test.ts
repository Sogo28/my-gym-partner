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
  correctSet,
  finishActivity,
  finishWorkoutSession,
  goToNextExercise,
  goToPreviousExercise,
  startActivity,
  startPerformanceSet,
  beginWorkoutSession,
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

describe('BeginWorkoutSession', () => {
  /**
   * Une séance DATE de sa première série. Créer l'une sans l'autre laisserait,
   * entre les deux, une séance qui existe sans avoir commencé.
   */
  it('ouvre la séance et sa première série d un seul geste', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 3);

    await beginWorkoutSession(plan.id);

    const session = await findActive();
    expect(session?.currentActivity?.exerciseId).toBe(exercise.id);
    expect((await currentSets()).at(-1)?.status).toBe('IN_PROGRESS');
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
    await completePerformanceSet({ BOTH: { duration: 12 } });

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
    await completePerformanceSet({ BOTH: { duration: 12 } });

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
    await completePerformanceSet({ BOTH: { duration: 12 } });

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

  it('reprend le programme après un exercice ajouté en route', async () => {
    const first = await anExercise('Advanced Tuck');
    const second = await anExercise('Pull-ups', ['reps']);
    const added = await anExercise('Face pull', ['reps']);
    const plan = await createPlannedWorkout({
      name: 'Pull day',
      exercises: [
        { exerciseId: first.id, sets: [{ targets: { duration: 10 } }] },
        { exerciseId: second.id, sets: [{ targets: { reps: 8 } }] },
      ],
    });
    await startWorkoutSession(plan.id);

    await finishActivity();
    await startActivity(added.id);
    const session = await goToNextExercise();

    expect(session.currentActivity?.exerciseId).toBe(second.id);
    expect(session.currentActivity?.plannedPosition).toBe(1);
  });

  it('ne démarre rien depuis un exercice ajouté une fois le programme fait', async () => {
    const planned = await anExercise('Advanced Tuck');
    const free = await anExercise('Dips', ['reps']);
    const plan = await aWorkoutOf(planned.id, 2);
    await startWorkoutSession(plan.id);

    // On quitte le plan pour un exercice libre, sans position planifiée.
    await finishActivity();
    await startActivity(free.id);
    const session = await goToNextExercise();

    // Le seul exercice du programme est passé : plus rien à reprendre.
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

describe('Revenir à l exercice précédent', () => {
  it('rattrape un passage au suivant fait par erreur', async () => {
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
    await goToNextExercise();

    const session = await goToPreviousExercise();

    expect(session.currentActivity?.exerciseId).toBe(first.id);
    expect(session.currentActivity?.finishedAt).toBeNull();
    expect(session.activities).toHaveLength(1);
  });

  it('efface la performance vide laissée par l exercice annulé', async () => {
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
    await goToNextExercise();
    const abandoned = (await findActive())!.currentActivity!.performanceId!;

    await goToPreviousExercise();

    expect(await findPerformanceById(abandoned)).toBeNull();
  });

  it('refuse si une série a déjà été faite sur l exercice en cours', async () => {
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
    await goToNextExercise();
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { reps: 8 } });

    await expect(goToPreviousExercise()).rejects.toThrow(/impossible de revenir/);
  });

  it('refuse sans exercice précédent', async () => {
    const exercise = await anExercise();
    const plan = await aWorkoutOf(exercise.id, 1);
    await startWorkoutSession(plan.id);

    await expect(goToPreviousExercise()).rejects.toThrow(/Aucun exercice précédent/);
  });
});

describe('Annulation d une séance', () => {
  it('conserve les séries déjà validées', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);

    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 14 } });
    const performanceId = (await findActive())!.currentActivity!.performanceId!;

    await cancelWorkoutSession();

    const performance = await findPerformanceById(performanceId);
    expect(performance!.completedSets[0].values).toEqual({ BOTH: { duration: 14 } });
  });
});

describe('Repos', () => {
  it('démarre à la validation d une série et s arrête à la suivante', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);

    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 10 } });
    expect((await findActive())!.currentRest).not.toBeNull();

    await startPerformanceSet();
    expect((await findActive())!.currentRest).toBeNull();
  });

  it('garde la trace du repos écoulé', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);

    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 10 } });
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
    await completePerformanceSet({ BOTH: { duration: 10 } });
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 8 } });

    const sets = await currentSets();
    expect(sets.map((set) => set.values.BOTH?.duration)).toEqual([10, 8]);
  });
});

/**
 * L'écran de séance écrit SANS attendre : chaque cran d'une valeur part pour
 * lui-même, et pendant un EMOM l'horloge écrit de son côté -- elle note le
 * round et démarre le suivant toute seule.
 *
 * Deux allers-retours qui se chevauchent lisent le même état de départ, et la
 * seconde écriture efface la première. Sans erreur : la correction disparaît,
 * simplement.
 */
describe('Deux actions lancées sans s attendre', () => {
  async function twoCompletedSets(exerciseId: string) {
    await startWorkoutSession();
    await startActivity(exerciseId);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { reps: 10 } });
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { reps: 10 } });
  }

  it('ne perdent pas la correction de l une au profit de l autre', async () => {
    const exercise = await anExercise('Traction', ['reps']);
    await twoCompletedSets(exercise.id);

    await Promise.all([
      correctSet(0, { BOTH: { reps: 8 } }),
      correctSet(1, { BOTH: { reps: 6 } }),
    ]);

    const sets = await currentSets();
    expect(sets.map((set) => set.values.BOTH?.reps)).toEqual([8, 6]);
  });

  it('gardent la correction quand une série démarre au même instant', async () => {
    const exercise = await anExercise('Traction', ['reps']);
    await twoCompletedSets(exercise.id);

    // Ce que fait l'horloge d'un EMOM pendant qu'on corrige un round.
    await Promise.all([correctSet(0, { BOTH: { reps: 8 } }), startPerformanceSet()]);

    const sets = await currentSets();
    expect(sets).toHaveLength(3);
    expect(sets[0].values.BOTH?.reps).toBe(8);
  });
});

describe('Démarrer à l heure du zéro', () => {
  it('date la série et la fin du repos du zéro, et non du déverrouillage', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 10 } });

    // Le zéro est passé pendant que le téléphone était verrouillé : l'écran
    // ne lance la série qu'au retour, mais elle a commencé au zéro.
    const zero = new Date(Date.now() - 30_000);
    await startPerformanceSet(zero);

    const sets = await currentSets();
    expect(sets[1].startedAt.getTime()).toBe(zero.getTime());
    const session = await findActive();
    expect(session!.rests.at(-1)!.endedAt!.getTime()).toBe(zero.getTime());
  });

  it('clôt un round à sa minute, et non au déverrouillage', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);
    const start = new Date(Date.now() - 125_000);
    await startPerformanceSet(start);

    // Deux minutes passées téléphone verrouillé : le premier round finit à
    // sa minute, le second commence à la même, et se finit à la suivante.
    const first = new Date(start.getTime() + 60_000);
    const second = new Date(start.getTime() + 120_000);
    await completePerformanceSet({ BOTH: { duration: 10 } }, first);
    await startPerformanceSet(first);
    await completePerformanceSet({ BOTH: { duration: 10 } }, second);
    await startPerformanceSet(second);

    const sets = await currentSets();
    expect(sets.map((set) => set.startedAt.getTime())).toEqual([
      start.getTime(),
      first.getTime(),
      second.getTime(),
    ]);
    expect(sets[0].endedAt!.getTime()).toBe(first.getTime());
  });
});
