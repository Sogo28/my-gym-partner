import { describe, expect, it } from 'vitest';
import { anExercise, useCleanDatabase } from '../../test/support';
import type { Condition } from '../domain/goal/goal';
import { recordReading } from './body-actions';
import { setEvaluationWindow } from './preferences';
import { archiveGoal, createGoal, evaluateGoal, goalsReachedBy, listGoals } from './goal-actions';
import {
  completePerformanceSet,
  finishActivity,
  finishWorkoutSession,
  startActivity,
  startPerformanceSet,
  startWorkoutSession,
} from './workout-session-actions';

/**
 * La résolution des fenêtres d'évaluation : quelles séries sont réellement
 * servies à chaque condition. C'est un aller-retour complet -- séances,
 * activités, performances -- qu'aucun test de domaine ne peut couvrir.
 */
useCleanDatabase();

const hold = (over: Partial<Condition> = {}): Condition => ({
  measurementId: 'duration',
  window: 'LAST_SESSION',
  aggregation: 'average',
  operator: '>=',
  target: 10,
  ...over,
});

/** Une séance où l'exercice est travaillé une fois, avec ces tenues. */
async function aSessionOf(exerciseId: string, durations: number[]) {
  await startWorkoutSession();
  await startActivity(exerciseId);
  for (const duration of durations) {
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration } });
  }
  await finishWorkoutSession();
}

async function goalOn(exerciseId: string, conditions: Condition[]) {
  return createGoal({
    name: 'Front Lever',
    target: {
      kind: 'simple',
      subject: { kind: 'exercise', exerciseId },
      requirements: [{ conditions }],
    },
  });
}

describe('LAST_SESSION', () => {
  it('évalue la dernière séance, pas les précédentes', async () => {
    const exercise = await anExercise();
    await aSessionOf(exercise.id, [7, 9, 8]);
    await aSessionOf(exercise.id, [10, 11, 9]);

    const evaluation = await evaluateGoal(await goalOn(exercise.id, [hold()]));

    // Sur tout l'historique, la moyenne vaudrait 9 et échouerait.
    expect(evaluation!.results[0].actual).toBe(10);
    expect(evaluation!.satisfied).toBe(true);
  });

  it('additionne les deux passages d un même exercice dans une séance', async () => {
    const exercise = await anExercise();

    // Le vrai travail au début, un finisher fatigué à la fin.
    await startWorkoutSession();
    await startActivity(exercise.id);
    for (const duration of [10, 11, 9]) {
      await startPerformanceSet();
      await completePerformanceSet({ BOTH: { duration } });
    }
    await finishActivity();
    await startActivity(exercise.id);
    for (const duration of [6, 5]) {
      await startPerformanceSet();
      await completePerformanceSet({ BOTH: { duration } });
    }
    await finishWorkoutSession();

    const evaluation = await evaluateGoal(await goalOn(exercise.id, [hold()]));

    // (10+11+9+6+5)/5 = 8,2 -- et non 5,5, qui ne lirait que le finisher.
    expect(evaluation!.results[0].actual).toBeCloseTo(8.2);
  });

  it('ignore une séance où rien n a été validé', async () => {
    const exercise = await anExercise();
    await aSessionOf(exercise.id, [10, 11, 9]);

    // Une séance plus récente, mais sans aucune série complétée.
    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await finishWorkoutSession();

    const evaluation = await evaluateGoal(await goalOn(exercise.id, [hold()]));

    // La séance vide ne masque pas la précédente.
    expect(evaluation!.results[0].actual).toBe(10);
  });

  it('ne trouve rien quand l exercice n a jamais été travaillé', async () => {
    const exercise = await anExercise();

    const evaluation = await evaluateGoal(await goalOn(exercise.id, [hold()]));

    expect(evaluation!.results[0].actual).toBeNull();
    expect(evaluation!.results[0].hasData).toBe(false);
  });
});

describe('la période choisie décide pour tout', () => {
  /**
   * Le modèle laisse chaque condition porter sa période (couvert par
   * `evaluation.test.ts`). L'application, elle, n'en veut qu'une : celle du
   * réglage, appliquée à TOUS les objectifs, et tout de suite.
   */
  it('évalue sur tout l historique quand c est ce qui est choisi', async () => {
    const exercise = await anExercise();
    await aSessionOf(exercise.id, [7, 9, 8]);
    await aSessionOf(exercise.id, [10, 11, 9]);
    await setEvaluationWindow('ALL_TIME');

    const evaluation = await evaluateGoal(
      await goalOn(exercise.id, [
        hold({ window: 'LAST_SESSION', aggregation: 'setCount', measurementId: null, target: 6 }),
      ]),
    );

    // La condition dit « dernière séance » ; le réglage dit autrement.
    expect(evaluation!.results[0].actual).toBe(6);
    expect(evaluation!.satisfied).toBe(true);
  });

  it('ramène toutes les conditions à la même période', async () => {
    const exercise = await anExercise();
    await aSessionOf(exercise.id, [4, 5, 4]);
    await aSessionOf(exercise.id, [10, 11, 9]);

    const evaluation = await evaluateGoal(
      await goalOn(exercise.id, [
        hold({ window: 'LAST_SESSION', target: 10 }),
        hold({ window: 'ALL_TIME', aggregation: 'setCount', measurementId: null, target: 6 }),
      ]),
    );

    // Par défaut la dernière séance : le décompte ne voit donc plus que 3
    // séries, là où la condition en réclamait 6 sur tout l'historique.
    expect(evaluation!.results[0].actual).toBe(10);
    expect(evaluation!.results[1].actual).toBe(3);
    expect(evaluation!.satisfied).toBe(false);
  });

  it('laisse une mensuration sur son relevé', async () => {
    await setEvaluationWindow('ALL_TIME');
    await recordReading({ metricId: 'tourdecuisse', value: 42 });

    const goal = await createGoal({
      name: 'Cuisses',
      target: {
        kind: 'simple',
        subject: { kind: 'body', metricId: 'tourdecuisse' },
        requirements: [
          {
            conditions: [
              {
                measurementId: 'tourdecuisse',
                window: 'LATEST_READING',
                aggregation: 'max',
                operator: '>=',
                target: 40,
              },
            ],
          },
        ],
      },
    });

    // Une mensuration n'a pas de séances : lui imposer une période de séance
    // n'aurait rien à lire.
    expect((await evaluateGoal(goal))!.results[0].actual).toBe(42);
  });
});

describe('Objectif de mensuration', () => {
  it('s évalue sur le dernier relevé, pas sur les séances', async () => {
    await recordReading({ metricId: 'tourdecuisse', value: 56, at: new Date(2026, 7, 1) });
    await recordReading({ metricId: 'tourdecuisse', value: 58.5, at: new Date(2026, 8, 1) });

    const goal = await createGoal({
      name: 'Des cuisses à la hauteur',
      target: {
        kind: 'simple',
        subject: { kind: 'body', metricId: 'tourdecuisse' },
        requirements: [
          {
            conditions: [
              {
                measurementId: 'tourdecuisse',
                window: 'LATEST_READING',
                aggregation: 'max',
                operator: '>=',
                target: 60,
              },
            ],
          },
        ],
      },
    });

    const evaluation = await evaluateGoal(goal);

    // Le dernier relevé, pas le plus grand jamais atteint ni une moyenne.
    expect(evaluation!.results[0].actual).toBe(58.5);
    expect(evaluation!.satisfied).toBe(false);
  });

  it('n a aucune donnée tant que rien n a été relevé', async () => {
    const goal = await createGoal({
      name: 'Poids de forme',
      target: {
        kind: 'simple',
        subject: { kind: 'body', metricId: 'poids' },
        requirements: [
          {
            conditions: [
              {
                measurementId: 'poids',
                window: 'LATEST_READING',
                aggregation: 'max',
                operator: '>=',
                target: 75,
              },
            ],
          },
        ],
      },
    });

    const evaluation = await evaluateGoal(goal);

    expect(evaluation!.results[0].hasData).toBe(false);
    expect(evaluation!.results[0].actual).toBeNull();
  });

  it('refuse une condition qui demande une période inexistante pour son sujet', async () => {
    // Une mensuration n'a pas de séances.
    await expect(
      createGoal({
        name: 'Incohérent',
        target: {
          kind: 'simple',
          subject: { kind: 'body', metricId: 'poids' },
          requirements: [
            {
              conditions: [
                {
                  measurementId: 'poids',
                  window: 'LAST_SESSION',
                  aggregation: 'average',
                  operator: '>=',
                  target: 75,
                },
              ],
            },
          ],
        },
      }),
    ).rejects.toThrow(/dernier relevé/);
  });
});

describe('Exercice unilatéral', () => {
  it('évalue le côté le plus faible', async () => {
    const exercise = await anExercise('One Leg Front Lever', ['duration']);

    await startWorkoutSession();
    await startActivity(exercise.id);
    for (const [left, right] of [
      [12, 8],
      [11, 7],
    ]) {
      await startPerformanceSet();
      await completePerformanceSet({ LEFT: { duration: left }, RIGHT: { duration: right } });
    }
    await finishWorkoutSession();

    const evaluation = await evaluateGoal(await goalOn(exercise.id, [hold()]));

    // (8+7)/2 = 7,5 : le côté fort ne compense pas. Compter les quatre
    // valeurs donnerait 9,5, et l'étape passerait à moitié acquise.
    expect(evaluation!.results[0].actual).toBe(7.5);
    expect(evaluation!.satisfied).toBe(false);
  });

  it('se contente du côté enregistré quand l autre manque', async () => {
    const exercise = await anExercise('One Leg Front Lever', ['duration']);

    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await completePerformanceSet({ LEFT: { duration: 12 } });
    await finishWorkoutSession();

    const evaluation = await evaluateGoal(await goalOn(exercise.id, [hold()]));

    expect(evaluation!.results[0].actual).toBe(12);
  });
});

describe('Séries abandonnées', () => {
  it('ne les compte dans aucune fenêtre', async () => {
    const exercise = await anExercise();

    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 12 } });
    await startPerformanceSet(); // laissée en cours, donc abandonnée à la fin
    await finishWorkoutSession();

    const evaluation = await evaluateGoal(
      await goalOn(exercise.id, [
        hold({ aggregation: 'setCount', measurementId: null, target: 1 }),
      ]),
    );

    expect(evaluation!.results[0].actual).toBe(1);
  });
});

/**
 * Les séries qualifiantes, de la base jusqu'au verdict.
 *
 * Les clauses vivent dans leur propre table : un aller-retour complet est le
 * seul moyen de vérifier qu'elles rejoignent bien LEUR condition.
 */
describe('les séries qualifiantes', () => {
  const benchGoal = (exerciseId: string, count: number) =>
    goalOn(exerciseId, [
      {
        measurementId: null,
        window: 'LAST_SESSION',
        aggregation: 'setCount',
        operator: '>=',
        target: count,
        qualifying: [
          { measurementId: 'reps', operator: '>=', target: 10 },
          { measurementId: 'weight', operator: '>=', target: 60 },
        ],
      },
    ]);

  /** Une séance de développé couché : chaque série porte ses deux mesures. */
  async function aBenchSession(exerciseId: string, sets: [number, number][]) {
    await startWorkoutSession();
    await startActivity(exerciseId);
    for (const [reps, weight] of sets) {
      await startPerformanceSet();
      await completePerformanceSet({ BOTH: { reps, weight } });
    }
    await finishWorkoutSession();
  }

  it('ne valide pas deux séries dont seule la moyenne atteint les cibles', async () => {
    const exercise = await anExercise('Développé couché', ['reps', 'weight']);
    await aBenchSession(exercise.id, [
      [15, 40],
      [5, 80],
    ]);

    const evaluation = await evaluateGoal(await benchGoal(exercise.id, 1));

    expect(evaluation?.satisfied).toBe(false);
    expect(evaluation?.results[0].actual).toBe(0);
  });

  it('compte les séries qui atteignent les deux cibles ensemble', async () => {
    const exercise = await anExercise('Développé couché', ['reps', 'weight']);
    await aBenchSession(exercise.id, [
      [10, 60],
      [12, 62],
      [8, 70],
    ]);

    const evaluation = await evaluateGoal(await benchGoal(exercise.id, 2));

    expect(evaluation?.satisfied).toBe(true);
    expect(evaluation?.results[0].actual).toBe(2);
  });

  it('relit les clauses telles qu elles ont été enregistrées', async () => {
    const exercise = await anExercise('Développé couché', ['reps', 'weight']);
    await benchGoal(exercise.id, 3);

    const [reloaded] = await listGoals();

    expect(reloaded.currentRequirements[0].conditions[0].qualifying).toEqual([
      { measurementId: 'reps', operator: '>=', target: 10 },
      { measurementId: 'weight', operator: '>=', target: 60 },
    ]);
  });
});

/**
 * Ce qu'une séance vient de mettre à portée.
 *
 * La règle qui compte : on n'annonce QUE ce que cette séance a touché. Un
 * objectif déjà satisfait sur un exercice qu'on n'a pas travaillé était acquis
 * avant d'entrer dans la salle, et l'annoncer serait mentir sur la cause.
 */
describe('goalsReachedBy', () => {
  it('annonce un objectif dont l étape est satisfaite', async () => {
    const exercise = await anExercise();
    await aSessionOf(exercise.id, [10, 11, 12]);
    await goalOn(exercise.id, [hold()]);

    const reached = await goalsReachedBy([exercise.id]);

    expect(reached).toHaveLength(1);
    expect(reached[0].evaluation.satisfied).toBe(true);
  });

  it('n annonce pas un objectif qui n est pas atteint', async () => {
    const exercise = await anExercise();
    await aSessionOf(exercise.id, [7, 8]);
    await goalOn(exercise.id, [hold()]);

    expect(await goalsReachedBy([exercise.id])).toHaveLength(0);
  });

  it('n annonce pas un objectif portant sur un exercice non travaillé', async () => {
    const worked = await anExercise('Advanced Tuck');
    const other = await anExercise('Straddle');
    await aSessionOf(other.id, [10, 11, 12]);
    await goalOn(other.id, [hold()]);

    // L'objectif d'un autre exercice tient, mais la séance n'y est pour rien.
    expect(await goalsReachedBy([worked.id])).toHaveLength(0);
  });

  it('n annonce pas un objectif archivé', async () => {
    const exercise = await anExercise();
    await aSessionOf(exercise.id, [10, 11, 12]);
    await archiveGoal(await goalOn(exercise.id, [hold()]));

    expect(await goalsReachedBy([exercise.id])).toHaveLength(0);
  });
});
